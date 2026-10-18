import assert from "node:assert/strict";
import { test } from "node:test";
import { ABOVE_UFC_LIMIT, LB_TO_KG, WEIGHT_CLASSES, classRange, isWeightClassKey, weightClassOf } from "./weight-classes.ts";

test("UFC names and standard pound limits match the source", () => {
  assert.deepEqual(WEIGHT_CLASSES.map((c) => [c.label, c.limitLb]), [
    ["Strawweight", 115], ["Flyweight", 125], ["Bantamweight", 135], ["Featherweight", 145],
    ["Lightweight", 155], ["Welterweight", 170], ["Middleweight", 185], ["Light Heavyweight", 205], ["Heavyweight", 265],
  ]);
});

test("exact upper limits remain in the lighter UFC class, with no one-pound allowance", () => {
  WEIGHT_CLASSES.forEach((c, i) => {
    assert.equal(weightClassOf(c.to).key, c.key);
    assert.equal(weightClassOf(c.to - 0.0001).key, c.key);
    assert.equal(weightClassOf(c.to + 0.0001).key, WEIGHT_CLASSES[i + 1]?.key ?? "above");
    assert.equal(weightClassOf(Math.fround(c.to)).key, c.key, "REAL storage preserves exact pound limits");
    assert.equal(weightClassOf(Math.fround(c.limitLb / 2.2046226218)).key, c.key, "existing lb input conversion preserves limits");
  });
  assert.equal(weightClassOf(155 * LB_TO_KG).key, "light");
  assert.equal(weightClassOf(156 * LB_TO_KG).key, "welter");
  assert.equal(weightClassOf(70).key, "light");
  assert.equal(weightClassOf(75).key, "welter");
  assert.equal(weightClassOf(80).key, "middle");
  assert.equal(weightClassOf(90).key, "light-heavy");
});

test("all valid app weights have one band, with above-limit weights kept distinct", () => {
  for (let kg = 20; kg <= 500; kg += 0.1) {
    const bands = [...WEIGHT_CLASSES, ABOVE_UFC_LIMIT];
    assert.equal(bands.filter((c) => kg > c.from && kg <= c.to).length, 1);
  }
  for (let i = 1; i < WEIGHT_CLASSES.length; i++) assert.equal(WEIGHT_CLASSES[i].from, WEIGHT_CLASSES[i - 1].to);
  assert.equal(weightClassOf(121).label, "Above UFC limit");
});

test("labels show inclusive limits and correctly converted units", () => {
  assert.equal(classRange(WEIGHT_CLASSES[0], "kg"), "≤52.2 kg");
  assert.equal(classRange(WEIGHT_CLASSES[4], "kg"), ">65.8–70.3 kg");
  assert.equal(classRange(WEIGHT_CLASSES[8], "kg"), ">93–120.2 kg");
  assert.equal(classRange(WEIGHT_CLASSES[0], "lb"), "≤115 lb");
  assert.equal(classRange(WEIGHT_CLASSES[4], "lb"), ">145–155 lb");
  assert.equal(classRange(WEIGHT_CLASSES[8], "lb"), ">205–265 lb");
});

test("only UFC class keys are accepted by the filters", () => {
  for (const c of WEIGHT_CLASSES) assert.ok(isWeightClassKey(c.key));
  for (const bad of ["all", "cruiser", "above", "constructor", "", null, 3, "Middle"]) assert.equal(isWeightClassKey(bad), false);
});
