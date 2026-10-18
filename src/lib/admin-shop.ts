import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { requireAdmin } from "./admin-auth";

export type ShopPerson = { id: number; username: string; balance: number; code: string | null };
export type ShopOrder = { id: number; username: string; item: string; cents: number; note: string | null; status: string };
export type UnmatchedPayment = { key: string; cents: number; currency: string; code: string | null; reason: string };

export async function adminShopData() {
  await requireAdmin();
  const db = requireDb();
  const [people, orders, swaps, meals, payments] = await Promise.all([
    db.execute(sql`select id, username, balance_cents as balance, pay_code as code from users order by lower(username) limit 500`),
    db.execute(sql`select o.id, u.username, o.item, o.price_cents as cents, o.note, o.status
      from shop_orders o join users u on u.id = o.user_id order by (o.status = 'pending') desc, o.id desc limit 50`),
    db.execute(sql`select u.id, u.username from avatars a join users u on u.id = a.user_id where a.override_b64 is not null order by a.override_at desc limit 50`),
    db.execute(sql`select m.id, u.username from meals m join users u on u.id = m.user_id where m.original_b64 is not null order by m.edited_at desc limit 50`),
    db.execute(sql`select key, value::jsonb->>'currency' as currency, (value::jsonb->>'cents')::int as cents,
      value::jsonb->>'code' as code, value::jsonb->>'reason' as reason from app_state where key like 'kofi_unmatched:%' order by updated_at desc limit 50`),
  ]);
  return { people: people.rows as ShopPerson[], orders: orders.rows as ShopOrder[],
    swaps: swaps.rows as { id: number; username: string }[], meals: meals.rows as { id: number; username: string }[],
    payments: payments.rows as UnmatchedPayment[] };
}
