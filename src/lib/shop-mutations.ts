import { sql, type SQL } from "drizzle-orm";
import { SHOP_ITEMS, type ShopItem } from "./shop.ts";

/** Debit, effect and ledger commit together. An SQL error rolls all three back. */
export function purchaseSql(userId: number, item: ShopItem, note: string | null, apply: SQL, target: SQL = sql`select 1`) {
  const cents = SHOP_ITEMS[item].cents;
  return sql`
    with target as materialized (${target}), spent as (
      update users set balance_cents = balance_cents - ${cents}
      where id = ${userId} and balance_cents >= ${cents} and exists (select 1 from target)
      and (select count(*) from wallet_ledger where user_id = ${userId}
        and kind = 'purchase' and created_at > now() - interval '1 day') < 15
      returning id
    ), applied as (${apply})
    insert into wallet_ledger (user_id, amount_cents, kind, item, note)
      select id, ${-cents}, 'purchase', ${item}, ${note} from spent
      where exists (select 1 from applied) returning id`;
}

export function refundOrderSql(orderId: number, adminId: number) {
  return sql`
    with changed as (
      update shop_orders set status = 'refunded' where id = ${orderId} and status = 'pending'
      returning id, user_id, price_cents, item
    ), credited as (
      update users set balance_cents = balance_cents + changed.price_cents
      from changed where users.id = changed.user_id returning users.id
    ), ledger as (
      insert into wallet_ledger (user_id, amount_cents, kind, item, ref, note)
      select user_id, price_cents, 'refund', item, 'order-refund:' || id, 'Order declined by owner'
      from changed where exists (select 1 from credited) returning id
    ) insert into admin_audit (admin_id, action, target, details)
      select ${adminId}, 'refund', 'shop-order:' || id, 'Refunded shop order to wallet'
      from changed where exists (select 1 from ledger) returning id`;
}
