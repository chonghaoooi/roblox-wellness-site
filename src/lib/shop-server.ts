import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { makePayCode } from "./shop";
import sharp from "sharp";

/**
 * Takes `cents` from the person's credit and records the purchase, in ONE statement: the conditional UPDATE only matches
 * while the balance covers the price, so two quick taps (or two devices) can never spend the same credit twice.
 */
export async function charge(userId: number, cents: number, item: string, note: string | null): Promise<boolean> {
  const res = await requireDb().execute(sql`
    with spent as (
      update users set balance_cents = balance_cents - ${cents} where id = ${userId} and balance_cents >= ${cents} returning id
    ) insert into wallet_ledger (user_id, amount_cents, kind, item, note)
      select ${userId}, ${-cents}, 'purchase', ${item}, ${note} from spent returning id`);
  return res.rows.length === 1;
}

/** Puts the money back after something failed once the charge had already gone through. */
export async function refund(userId: number, cents: number, item: string, note: string) {
  await requireDb().execute(sql`
    with back as (update users set balance_cents = balance_cents + ${cents} where id = ${userId} returning id)
    insert into wallet_ledger (user_id, amount_cents, kind, item, note) select ${userId}, ${cents}, 'refund', ${item}, ${note} from back`);
}

/** Adds credit. With a `ref` (e.g. a Ko-fi transaction id) the same payment can never be credited twice. Returns whether it was applied. */
export async function credit(userId: number, cents: number, note: string, ref: string | null = null): Promise<boolean> {
  const res = await requireDb().execute(sql`
    with added as (
      insert into wallet_ledger (user_id, amount_cents, kind, item, ref, note) values (${userId}, ${cents}, 'credit', 'top-up', ${ref}, ${note})
      on conflict (ref) do nothing returning user_id, amount_cents
    ) update users set balance_cents = balance_cents + added.amount_cents from added where users.id = added.user_id returning users.id`);
  return res.rows.length === 1;
}

export async function getBalance(userId: number): Promise<number> {
  const res = await requireDb().execute(sql`select balance_cents from users where id = ${userId}`);
  return Number((res.rows[0] as { balance_cents?: number } | undefined)?.balance_cents ?? 0);
}

export async function purchasesLast24h(userId: number): Promise<number> {
  const res = await requireDb().execute(sql`select count(*)::int as n from wallet_ledger where user_id = ${userId} and kind = 'purchase' and created_at > now() - interval '1 day'`);
  return Number((res.rows[0] as { n: number }).n);
}

/** Each person's code for Ko-fi top-ups, created the first time it is needed. */
export async function getPayCode(userId: number): Promise<string> {
  const db = requireDb();
  const existing = await db.execute(sql`select pay_code from users where id = ${userId}`);
  const have = (existing.rows[0] as { pay_code: string | null } | undefined)?.pay_code;
  if (have) return have;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makePayCode(randomBytes(6));
    const res = await db.execute(sql`update users set pay_code = ${code} where id = ${userId} and pay_code is null and not exists (select 1 from users where pay_code = ${code}) returning pay_code`);
    if (res.rows.length) return code;
    const again = await db.execute(sql`select pay_code from users where id = ${userId}`);
    const now = (again.rows[0] as { pay_code: string | null } | undefined)?.pay_code;
    if (now) return now;
  }
  throw new Error("Could not create a payment code");
}

const MAX_PHOTO_BYTES = 800_000;
const isJpeg = (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** Photos are re-encoded as JPEG by the browser; anything else (SVG, HTML, ...) is rejected. */
export async function readJpeg(fd: FormData, field = "photo"): Promise<{ buf: Buffer } | { error: string }> {
  const file = fd.get(field);
  if (!(file instanceof File) || file.size === 0) return { error: "Pick a photo first." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "That photo is too big. Try a smaller one." };
  const buf = Buffer.from(await file.arrayBuffer());
  if (!isJpeg(buf)) return { error: "Couldn't read that photo. Pick a JPEG, PNG or WebP using the image picker." };
  try {
    const image = await sharp(buf, { limitInputPixels: 20_000_000 }).rotate()
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
    return { buf: image };
  } catch { return { error: "That image couldn't be decoded. Try another photo." }; }
}
