import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { parseKofiPayment } from "@/lib/kofi";
import { credit } from "@/lib/shop-server";

export const runtime = "nodejs";
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Ko-fi calls this when someone pays (Ko-fi > More > API > Webhooks). It sends a form post with one field, "data", holding JSON.
 * Credit is added only when: the verification token matches KOFI_VERIFICATION_TOKEN, the payment is in SGD, and the
 * message contains a payment code (LEAN-XXXXXX) belonging to an account. The Ko-fi transaction id is stored with the
 * credit, so Ko-fi retrying the same call can never credit it twice. Anything else is kept for the owner to sort out
 * by hand in the admin Shop tab.
 */
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 20_000) return reply({ error: "Too large" }, 413);
  const form = await request.formData().catch(() => null);
  const raw = form?.get("data");
  if (typeof raw !== "string" || raw.length > 20_000) return reply({ error: "Bad request" }, 400);
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return reply({ error: "Bad request" }, 400); }
  const payment = parseKofiPayment(json, process.env.KOFI_VERIFICATION_TOKEN);
  if (!payment) return reply({ error: "Not accepted" }, 401);

  const db = requireDb();
  const keep = async (reason: string) => {
    await db.execute(sql`
      insert into app_state (key, value) values (${`kofi_unmatched:${payment.transactionId}`}, ${JSON.stringify({ cents: payment.cents, currency: payment.currency, code: payment.code, reason, at: new Date().toISOString() })})
      on conflict (key) do nothing`);
    return reply({ ok: true, credited: false, reason });
  };
  if (payment.currency !== "SGD") return keep("not in SGD");
  if (!payment.code) return keep("no payment code in the message");
  const found = await db.execute(sql`select id from users where pay_code = ${payment.code}`);
  const user = found.rows[0] as { id: number } | undefined;
  if (!user) return keep("unknown payment code");
  const applied = await credit(user.id, payment.cents, `Ko-fi ${payment.type}`, payment.transactionId);
  return reply({ ok: true, credited: applied });
}
