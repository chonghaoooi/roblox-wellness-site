// Synthetic payment events against a staged deployment, using a disposable zero-balance account.
// No real payment is made. Fixtures and test ledger entries are removed in finally.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { makePayCode } from "../src/lib/shop.ts";

const deployment = process.argv[2];
if (!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(deployment ?? "")) throw new Error("Pass the staged deployment URL");
const db = neon(process.env.DATABASE_URL);
const marker = `qa-kofi-${randomUUID()}`;
const code = makePayCode(randomBytes(6));
let userId;
function send(token) {
  const body = new URLSearchParams({ data: JSON.stringify({ verification_token: token, type: "Donation",
    kofi_transaction_id: marker, amount: "5.00", currency: "SGD", message: `QA integration ${code}` }) }).toString();
  const runner = `import subprocess,sys
r=subprocess.run(['npx.cmd','--yes','vercel','curl',sys.argv[1]+'/api/kofi','--scope','chs-projects-c640c1f7','--','--silent','--request','POST','--header','Content-Type: application/x-www-form-urlencoded','--data-binary','@-'],input=sys.stdin.read(),capture_output=True,text=True)
sys.stdout.write(r.stdout)
sys.stderr.write(r.stderr)
sys.exit(r.returncode)`;
  const r = spawnSync("python", ["-c", runner, deployment], { input: body, encoding: "utf8", windowsHide: true });
  if (r.status !== 0) throw new Error("Authenticated webhook request failed: " + (r.stderr ?? "").slice(-400));
  return JSON.parse(r.stdout);
}
try {
  const [u] = await db`insert into users (username, email, password_hash, pay_code) values (${marker}, ${`${marker}@example.invalid`}, 'not-a-login-hash', ${code}) returning id`;
  userId = u.id;
  assert.deepEqual(send("wrong-token"), { error: "Not accepted" });
  assert.deepEqual(send(process.env.KOFI_VERIFICATION_TOKEN), { ok: true, credited: true });
  assert.deepEqual(send(process.env.KOFI_VERIFICATION_TOKEN), { ok: true, credited: false });
  const [check] = await db`select balance_cents, (select count(*)::int from wallet_ledger where user_id = ${userId}) as entries from users where id = ${userId}`;
  assert.deepEqual(check, { balance_cents: 500, entries: 1 });
  console.log("Ko-fi delivery passed: invalid token rejected; SGD credited; duplicate delivery did not credit twice.");
} finally {
  if (userId) await db`delete from users where id = ${userId} and username = ${marker}`;
  await db`delete from app_state where key = 'kofi_unmatched:kofi:qa-unmatched-20261018'`;
  console.log("Synthetic payment account and ledger removed.");
}
