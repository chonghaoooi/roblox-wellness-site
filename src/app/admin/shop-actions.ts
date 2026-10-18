"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { refundOrderSql } from "@/lib/shop-mutations";
import { sgd } from "@/lib/shop";
import type { FormState } from "@/lib/validation";

const value = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const positiveId = (raw: unknown) => Number.isSafeInteger(Number(raw)) && Number(raw) > 0;
const refresh = () => { revalidatePath("/", "layout"); };

export async function grantCredit(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = Number(fd.get("user"));
  const amount = value(fd, "amount");
  const receipt = value(fd, "receipt");
  const note = value(fd, "note");
  if (!positiveId(userId) || !/^\d{1,5}(?:\.\d{1,2})?$/.test(amount)) return { error: "Pick a user and a valid SGD amount." };
  const cents = Math.round(Number(amount) * 100);
  if (cents < 1 || cents > 1_000_000 || !/^[A-Za-z0-9_.:-]{3,100}$/.test(receipt) || note.length < 3 || note.length > 200) {
    return { error: "Use S$0.01–S$10,000, a unique receipt reference (3–100 letters, digits or . _ : -), and a short payment note." };
  }
  const result = await requireDb().execute(sql`
    with added as (
      insert into wallet_ledger (user_id, amount_cents, kind, item, ref, note)
      select id, ${cents}, 'credit', 'top-up', ${`admin:${receipt}`}, ${note} from users where id = ${userId}
      on conflict (ref) do nothing returning user_id, amount_cents
    ), credited as (
      update users set balance_cents = balance_cents + added.amount_cents from added
      where users.id = added.user_id returning users.id
    ) insert into admin_audit (admin_id, action, target, details)
      select ${admin.id}, 'credit', 'user:' || id, ${`Added ${sgd(cents)} credit; receipt ${receipt}: ${note}`} from credited returning id`);
  if (!result.rows.length) return { error: "This receipt was already credited, or the user no longer exists." };
  refresh();
  return { ok: true, message: `${sgd(cents)} credit added.` };
}

export async function finishOrder(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = Number(fd.get("id"));
  const mode = fd.get("mode");
  if (!positiveId(id) || (mode !== "done" && mode !== "refund")) return { error: "Invalid order." };
  const result = await requireDb().execute(mode === "refund" ? refundOrderSql(id, admin.id) : sql`
    with changed as (update shop_orders set status = 'done' where id = ${id} and status = 'pending' returning id)
    insert into admin_audit (admin_id, action, target, details)
    select ${admin.id}, 'fulfil', 'shop-order:' || id, 'Marked shop order fulfilled' from changed returning id`);
  if (!result.rows.length) return { error: "That order has already been handled." };
  refresh();
  return { ok: true, message: mode === "refund" ? "Order refunded to the buyer's wallet." : "Order marked fulfilled." };
}

export async function resetShopContent(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const mode = value(fd, "mode");
  const id = Number(fd.get("id"));
  let mutation;
  if (mode === "brand") mutation = sql`delete from site_config where key in ('app_name', 'app_icon_b64', 'app_icon_v', 'app_brand_by') returning key::text as target`;
  else if (mode === "avatar" && positiveId(id)) mutation = sql`update avatars set override_b64 = null, override_by = null, override_at = null, updated_at = now() where user_id = ${id} returning user_id::text as target`;
  else if (mode === "meal" && positiveId(id)) mutation = sql`update meals set data_b64 = original_b64, original_b64 = null, edited_by = null, edited_at = null where id = ${id} and original_b64 is not null returning id::text as target`;
  else return { error: "Invalid reset." };
  await requireDb().execute(sql`
    with changed as (${mutation}) insert into admin_audit (admin_id, action, target, details)
    select ${admin.id}, 'restore', ${mode} || ':' || target, 'Restored original shop content' from changed`);
  refresh();
  return { ok: true, message: "Original content restored. Existing phone icons may need reinstalling." };
}

export async function matchKofiPayment(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = Number(fd.get("user"));
  const key = value(fd, "key");
  if (!positiveId(userId) || !/^kofi_unmatched:kofi:[A-Za-z0-9_-]{6,80}$/.test(key)) return { error: "Pick a user and a payment." };
  const result = await requireDb().execute(sql`
    with payment as (select key, value::jsonb as data from app_state where key = ${key} for update),
    added as (
      insert into wallet_ledger (user_id, amount_cents, kind, item, ref, note)
      select u.id, (p.data->>'cents')::int, 'credit', 'top-up', replace(p.key, 'kofi_unmatched:', ''), 'Ko-fi payment matched by owner'
      from payment p cross join users u where u.id = ${userId} and p.data->>'currency' = 'SGD'
      and (p.data->>'cents')::int > 0 on conflict (ref) do nothing returning user_id, amount_cents
    ), credited as (
      update users set balance_cents = balance_cents + added.amount_cents from added where users.id = added.user_id returning users.id
    ), cleared as (delete from app_state where key = ${key} and exists (select 1 from credited) returning key)
    insert into admin_audit (admin_id, action, target, details)
    select ${admin.id}, 'credit', ${key}, 'Matched Ko-fi payment to user ' || ${userId} from cleared returning id`);
  if (!result.rows.length) return { error: "Not credited: already handled, missing user, or payment is not in SGD." };
  refresh();
  return { ok: true, message: "Payment credited once and removed from the unmatched list." };
}
