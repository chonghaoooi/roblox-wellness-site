import assert from "node:assert/strict";
import { test } from "node:test";
import { isBarbell, isBodyweight, rankLifts, strengthRatio } from "./lifts.ts";

test("barbell ratio uses the lifted weight", () => {
  // 100 kg x 5 -> 116.7 kg e1RM; at 80 kg body weight that is 1.458x
  assert.ok(Math.abs(strengthRatio("bench", 100, 5, 80) - 1.4583) < 0.001);
});

test("bodyweight moves include body weight in the load", () => {
  // bodyweight only, 10 reps at 80 kg: 80 * (1 + 10/30) / 80 = 1.333x
  assert.ok(Math.abs(strengthRatio("pullup", 0, 10, 80) - 1.3333) < 0.001);
  // +20 kg for 5 reps: (80+20) * 1.1667 / 80 = 1.458x
  assert.ok(Math.abs(strengthRatio("dips", 20, 5, 80) - 1.4583) < 0.001);
  assert.ok(isBodyweight("pullup") && isBodyweight("dips") && !isBodyweight("bench"));
  assert.ok(isBarbell("squat") && !isBarbell("chestfly"));
});

test("ranking keeps each person's best set and skips people without a body weight", () => {
  const r = rankLifts([
    { exercise: "bench", username: "a", liftKg: 60, reps: 10, bw: 70 },
    { exercise: "bench", username: "a", liftKg: 80, reps: 3, bw: 70 }, // better: 88 kg e1RM
    { exercise: "bench", username: "b", liftKg: 100, reps: 1, bw: 100 },
    { exercise: "bench", username: "c", liftKg: 200, reps: 1, bw: null }, // no weight -> not ranked
    { exercise: "pullup", username: "a", liftKg: 0, reps: 12, bw: 70 },
    { exercise: "nonsense", username: "a", liftKg: 1, reps: 1, bw: 70 },
  ]);
  assert.deepEqual(r.bench.map((x) => x.username), ["a", "b"]);
  assert.equal(r.bench[0].sub, "88 kg est. max");
  assert.equal(r.pullup[0].sub, "12 reps");
  assert.equal(r.squat.length, 0);
});

import { MAX_LIFT_ROWS, parseLiftRows } from "./lifts.ts";

test("parses several lifts at once and skips blank rows", () => {
  const r = parseLiftRows(["bench", "squat", "pullup", "dips"], ["80", "100", "", ""], ["5", "3", "10", ""]);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.lifts, [
    { exercise: "bench", weight: 80, reps: 5 },
    { exercise: "squat", weight: 100, reps: 3 },
    { exercise: "pullup", weight: 0, reps: 10 }, // blank added weight = bodyweight
  ]);
});

test("reports the row that is wrong", () => {
  assert.equal(parseLiftRows(["bench"], ["80"], [""]).error?.row, 1); // reps missing
  assert.equal(parseLiftRows(["bench", "squat"], ["80", ""], ["5", "5"]).error?.row, 2); // squat needs a weight
  assert.equal(parseLiftRows(["bench"], ["0"], ["5"]).error?.message, "Weight must be 1 to 50".concat("0")); // non-bodyweight min 1
  assert.equal(parseLiftRows(["nope"], ["50"], ["5"]).error?.message, "Pick an exercise");
  assert.equal(parseLiftRows(["bench"], ["80"], ["31"]).error?.row, 1);
});

test("caps the number of rows", () => {
  const many = Array.from({ length: MAX_LIFT_ROWS + 1 }, () => "bench");
  assert.ok(parseLiftRows(many, many.map(() => "50"), many.map(() => "5")).error);
});

test("rejects inherited object keys and invalid numbers", () => {
  assert.ok(parseLiftRows(["constructor"], ["50"], ["5"]).error);
  assert.ok(parseLiftRows(["bench"], ["Infinity"], ["5"]).error);
  assert.ok(parseLiftRows(["bench"], ["50"], ["1.5"]).error);
  assert.equal(parseLiftRows([], [], []).lifts.length, 0);
});

import { rankByClass } from "./lifts.ts";

test("classes rank by the weight actually lifted; 'all' ranks by multiple of body weight", () => {
  const r = rankLifts([
    { exercise: "bench", username: "heavy_guy", liftKg: 140, reps: 1, bw: 100 }, // heavyweight, 140 kg, 1.4x
    { exercise: "bench", username: "mid_a", liftKg: 100, reps: 1, bw: 75 },      // welterweight, 100 kg, 1.33x
    { exercise: "bench", username: "mid_b", liftKg: 90, reps: 1, bw: 72 },       // welterweight, 90 kg, 1.25x
    { exercise: "bench", username: "light_c", liftKg: 80, reps: 1, bw: 55 },     // flyweight, 80 kg, 1.45x
  ]).bench;
  assert.deepEqual(rankByClass(r, "all").map((s) => s.username), ["light_c", "heavy_guy", "mid_a", "mid_b"]);
  assert.deepEqual(rankByClass(r, "welter").map((s) => s.username), ["mid_a", "mid_b"]);
  assert.deepEqual(rankByClass(r, "heavy").map((s) => s.username), ["heavy_guy"]);
  assert.deepEqual(rankByClass(r, "light-heavy"), []);
  assert.equal(rankByClass(r, "welter")[0].e1rmKg, 100 * (1 + 1 / 30));
});

test("bodyweight moves compare body plus added weight within a class", () => {
  const r = rankLifts([
    { exercise: "pullup", username: "a", liftKg: 10, reps: 5, bw: 72 },
    { exercise: "pullup", username: "b", liftKg: 0, reps: 15, bw: 72 },
  ]).pullup;
  const mid = rankByClass(r, "welter");
  assert.equal(mid.length, 2);
  assert.ok(mid[0].e1rmKg >= mid[1].e1rmKg);
});
