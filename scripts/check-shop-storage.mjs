// Database integration check: all fixtures are created and removed inside one transaction.
// Other connections never see them. The failure case must roll the entire transaction back.
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { purchaseSql, refundOrderSql } from "../src/lib/shop-mutations.ts";
import { SHOP_ITEMS } from "../src/lib/shop.ts";

const client = neon(process.env.DATABASE_URL);
const dialect = new PgDialect();
const query = (statement) => { const q = dialect.sqlToQuery(statement); return client.query(q.sql, q.params); };
const id = -randomInt(100_000_000, 1_000_000_000);
const marker = `shop-qa-${randomUUID()}`;
const startingBalance = SHOP_ITEMS.revamp.cents + 1000;
const insertUser = sql`insert into users (id, username, email, password_hash, balance_cents) values (${id}, ${marker}, ${`${marker}@example.invalid`}, 'not-a-login-hash', ${startingBalance})`;
const insertAdmin = sql`insert into admins (id, username, password_hash) values (${id}, ${marker}, 'not-a-login-hash')`;
const applyOrder = sql`insert into shop_orders (user_id, item, price_cents, note) select id, 'revamp', ${SHOP_ITEMS.revamp.cents}, 'QA fixture' from spent returning id`;
const orderId = sql`(select id from shop_orders where user_id = ${id} limit 1)`;
const statements = [
  insertUser, insertAdmin,
  purchaseSql(id, "revamp", "QA", applyOrder),
  sql`select balance_cents from users where id = ${id}`,
  purchaseSql(id, "revamp", "QA insufficient", applyOrder),
  refundOrderSql(orderId, id), refundOrderSql(orderId, id),
  sql`select balance_cents from users where id = ${id}`,
  purchaseSql(id, "ticker", "QA missing target", sql`insert into app_state (key, value) select ${marker}, 'QA' from spent returning key`, sql`select 1 where false`),
  sql`select count(*)::int as n, sum(amount_cents)::int as net from wallet_ledger where user_id = ${id}`,
  sql`delete from admin_audit where admin_id = ${id}`,
  sql`delete from admins where id = ${id}`,
  sql`delete from users where id = ${id}`,
];
const r = await client.transaction(statements.map(query));
assert.equal(r[2].length, 1, "successful purchase recorded");
assert.equal(r[3][0].balance_cents, 1000);
assert.equal(r[4].length, 0, "insufficient credit cannot buy");
assert.equal(r[5].length, 1, "refund applied");
assert.equal(r[6].length, 0, "refund cannot repeat");
assert.equal(r[7][0].balance_cents, startingBalance);
assert.equal(r[8].length, 0, "missing/protected target cannot charge");
assert.deepEqual(r[9][0], { n: 2, net: 0 });

await assert.rejects(client.transaction([
  query(insertUser),
  query(purchaseSql(id, "ticker", "QA forced failure", sql`insert into app_state (key, value) select ${marker}, (1 / 0)::text from spent returning key`)),
]));
const leftovers = await client`select count(*)::int as n from users where id = ${id}`;
assert.equal(leftovers[0].n, 0, "failed transaction leaves no debit, ledger or fixture");
console.log("Shop DB checks passed: purchase, insufficient credit, missing target, single refund, rollback; no fixtures remain.");
