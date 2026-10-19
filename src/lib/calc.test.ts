import assert from "node:assert/strict";
import { test } from "node:test";
import { bmi, bmiCategory, bucketStart, caloriesOut, distanceKm, netCalories, percentile, suggestedCalorieGoal } from "./calc.ts";

test("spreadsheet formulas", () => {
  assert.equal(caloriesOut(10000, 0.04), 400);
  assert.equal(netCalories(2000, 10000, 0.04), 1600);
  assert.ok(Math.abs(distanceKm(10000, 0.762) - 7.62) < 1e-9);
  assert.ok(Math.abs(bmi(70, 175) - 22.857) < 0.001);
});

test("weeks start Monday, months on the 1st", () => {
  assert.equal(bucketStart("2026-10-17", "week"), "2026-10-12"); // Saturday
  assert.equal(bucketStart("2026-10-12", "week"), "2026-10-12");
  assert.equal(bucketStart("2026-10-17", "month"), "2026-10-01");
});

test("percentile", () => {
  assert.equal(percentile(5, []), null);
  assert.equal(percentile(5, [5]), 100);
  assert.equal(percentile(5, [1, 5, 9, 10]), 50);
});

test("anything under 25 is healthy", () => {
  assert.equal(bmiCategory(16).label, "Healthy");
  assert.equal(bmiCategory(24.9).label, "Healthy");
  assert.equal(bmiCategory(25).label, "Overweight");
  assert.equal(bmiCategory(30).label, "Obese");
});

test("suggestedCalorieGoal scales with weight and height, within bounds", () => {
  assert.equal(suggestedCalorieGoal(70, 170), 2200);
  assert.ok(suggestedCalorieGoal(90, 180) > suggestedCalorieGoal(60, 160));
  assert.equal(suggestedCalorieGoal(20, 100), 1200);
  assert.equal(suggestedCalorieGoal(300, 220), 4000);
});
