import assert from "node:assert/strict";
import { test } from "node:test";
import { mealSchema } from "./validation.ts";

test("zero-calorie meals are explicit manual entries; blank still requests an AI estimate", () => {
  assert.equal(mealSchema.parse({ date: "2026-10-18", calories: "0" }).calories, 0);
  assert.equal(mealSchema.parse({ date: "2026-10-18", calories: " 0 " }).calories, 0);
  assert.equal(mealSchema.parse({ date: "2026-10-18", calories: "" }).calories, undefined);
  assert.equal(mealSchema.parse({ date: "2026-10-18", calories: "   " }).calories, undefined);
});

test("meal calories keep their whole-number bounds", () => {
  for (const calories of ["-1", "0.5", "5001", "NaN", "Infinity"]) {
    assert.equal(mealSchema.safeParse({ date: "2026-10-18", calories }).success, false, calories);
  }
  assert.equal(mealSchema.parse({ date: "2026-10-18", calories: "5000" }).calories, 5000);
});
