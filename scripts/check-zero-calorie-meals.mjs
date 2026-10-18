// Fixtures stay inside one transaction and are removed before commit; other connections never see them.
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { mealSchema } from "../src/lib/validation.ts";

const db = neon(process.env.DATABASE_URL);
const id = -randomInt(100_000_000, 1_000_000_000);
const marker = `zero-cal-qa-${randomUUID()}`;
const calories = mealSchema.parse({ date: "2026-10-18", calories: "0" }).calories;
const result = await db.transaction([
  db`insert into users(id,username,email,password_hash) values (${id}, ${marker}, ${marker + '@example.invalid'}, 'not-a-login-hash')`,
  db`insert into logs(user_id,date,kind,calories,source) values (${id}, '2026-10-18', 'meal', ${calories}, 'manual')`,
  db`select calories_in from daily_stats where user_id=${id} and date='2026-10-18'`,
  db`insert into logs(user_id,date,kind,calories,source) values (${id}, '2026-10-18', 'meal', 100, 'manual')`,
  db`select calories_in from daily_stats where user_id=${id} and date='2026-10-18'`,
  db`insert into logs(user_id,date,kind,steps,source) values (${id}, '2026-10-17', 'steps', 1000, 'manual')`,
  db`select calories_in from daily_stats where user_id=${id} and date='2026-10-17'`,
  db`delete from users where id=${id}`,
]);
assert.equal(result[2][0].calories_in, 0, "a logged zero stays zero, so rankings/charts can include it");
assert.equal(result[4][0].calories_in, 100, "zero does not change other meals' totals");
assert.equal(result[6][0].calories_in, null, "no meal is still missing data");
assert.equal((await db`select count(*)::int as n from users where id=${id}`)[0].n, 0);
console.log("Zero-calorie meals passed: validation -> saved log -> daily totals; zero differs from no meal. No fixtures remain.");
