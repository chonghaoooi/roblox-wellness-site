import assert from "node:assert/strict";
import { test } from "node:test";
import { adminIdSchema, adminPasswordSchema, parseAdminLog, tickerSchema } from "./admin-validation.ts";

test("admin edits validate each log type and ignore unwanted fields", () => {
  assert.deepEqual(parseAdminLog("meal", { calories: "700", note: "Corrected meal", userId: 999 }).data, { calories: 700, note: "Corrected meal" });
  assert.equal(parseAdminLog("meal", { calories: "", note: "" }).success, false);
  assert.equal(parseAdminLog("steps", { steps: "4.5", note: "" }).success, false);
  assert.equal(parseAdminLog("steps", { steps: "100001", note: "" }).success, false);
  assert.equal(parseAdminLog("weight", { weightKg: "", heightCm: "", note: "" }).success, false);
  assert.deepEqual(parseAdminLog("weight", { weightKg: "80.5", heightCm: "", note: "" }).data, { weightKg: 80.5, heightCm: null, note: "" });
  assert.equal(parseAdminLog("lift", { exercise: "pullup", liftKg: "0", reps: "10", note: "" }).success, true);
  assert.equal(parseAdminLog("lift", { exercise: "bench", liftKg: "0", reps: "10", note: "" }).success, false);
  assert.equal(parseAdminLog("not-a-log", {}).success, false);
});

test("ticker, identifiers and admin passwords have bounded input", () => {
  assert.equal(tickerSchema.parse("  hello • world  "), "hello • world");
  assert.equal(tickerSchema.parse(""), "");
  assert.equal(tickerSchema.safeParse("a".repeat(501)).success, false);
  assert.equal(adminIdSchema.safeParse("1 OR 1=1").success, false);
  assert.equal(adminIdSchema.safeParse("-1").success, false);
  assert.equal(adminPasswordSchema.safeParse("short").success, false);
  assert.equal(adminPasswordSchema.safeParse("🐱".repeat(19)).success, false);
  assert.equal(adminPasswordSchema.safeParse("A sufficiently long password").success, true);
});
