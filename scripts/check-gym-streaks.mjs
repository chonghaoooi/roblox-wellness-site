// Run the production streak SQL against read-only inline fixtures on Postgres. No users or logs are inserted.
import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { gymStreaksSql } from "../src/lib/gym-streaks.ts";

const client = neon(process.env.DATABASE_URL);
const dialect = new PgDialect();
async function streaks(today, dates) {
  const source = dates.length
    ? sql`select user_id, date from (values ${sql.join(dates.map(([id, date]) => sql`(${id}::int, ${date}::date)`), sql`, `)}) fixture(user_id, date)`
    : sql`select 1 as user_id, current_date as date where false`;
  const q = dialect.sqlToQuery(sql`select * from (${gymStreaksSql(today, source)}) s order by user_id`);
  return client.query(q.sql, q.params);
}

assert.deepEqual(await streaks("2026-10-15", []), []);
const fixtures = [
  [1, "2026-10-12"], [1, "2026-10-14"], // Mon -> Wed continues
  [2, "2026-10-12"], [2, "2026-10-15"], // Mon -> Thu resets
  [3, "2026-10-12"], [3, "2026-10-14"], [3, "2026-10-14"], // same-day dedupe
  [4, "2026-10-12"], // expires on Thu without a new check-in
  [5, "2026-10-09"], [5, "2026-10-11"], [5, "2026-10-13"], [5, "2026-10-15"], // crosses week
  [6, "2026-10-16"], // future-only must not start a streak
  [7, "2026-10-12"], [7, "2026-10-14"], [7, "2026-10-16"], // future log ignored
  [8, "2026-10-11"], [8, "2026-10-14"], // old island not counted
];
assert.deepEqual(await streaks("2026-10-15", fixtures), [
  { user_id: 1, visits: 2, last_date: "2026-10-14" },
  { user_id: 2, visits: 1, last_date: "2026-10-15" },
  { user_id: 3, visits: 2, last_date: "2026-10-14" },
  { user_id: 5, visits: 4, last_date: "2026-10-15" },
  { user_id: 7, visits: 2, last_date: "2026-10-14" },
  { user_id: 8, visits: 1, last_date: "2026-10-14" },
]);
for (const today of ["2026-10-12", "2026-10-13", "2026-10-14"]) {
  assert.deepEqual(await streaks(today, [[1, "2026-10-12"]]), [{ user_id: 1, visits: 1, last_date: "2026-10-12" }]);
}
assert.deepEqual(await streaks("2026-10-15", [[1, "2026-10-12"]]), []);
assert.deepEqual(await streaks("2027-01-02", [[1, "2026-12-29"], [1, "2026-12-31"], [1, "2027-01-02"]]), [{ user_id: 1, visits: 3, last_date: "2027-01-02" }]);
const unbridged = [[1, "2026-10-09"], [1, "2026-10-13"], [1, "2026-10-15"]];
assert.equal((await streaks("2026-10-15", unbridged))[0].visits, 2);
assert.equal((await streaks("2026-10-15", [...unbridged, [1, "2026-10-11"]]))[0].visits, 4, "backdated visit bridges islands; removing it restores 2");
console.log("Gym streak SQL passed: gap 2/3, expiry, duplicate dates, first visit, empty/future data, week/year rollover, backdated and removed visits. Read-only fixtures only.");
