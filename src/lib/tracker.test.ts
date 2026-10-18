import assert from "node:assert/strict";
import { test } from "node:test";
import { totalAggregatedSteps, trackerDayWindow, trackerSyncSchema } from "./tracker-validation.ts";

test("step sync accepts only bounded daily totals and known providers", () => {
  assert.equal(trackerSyncSchema.safeParse({ userId: 1, source: "apple_health", date: "2026-10-18", steps: 12345 }).success, true);
  for (const steps of [-1, 150001, 1.5, NaN, Infinity, "1000"]) assert.equal(trackerSyncSchema.safeParse({ userId: 1, source: "health_connect", date: "2026-10-18", steps }).success, false);
  assert.equal(trackerSyncSchema.safeParse({ userId: 1, source: "strava", date: "2026-10-18", steps: 1 }).success, false);
  assert.equal(trackerSyncSchema.safeParse({ source: "apple_health", date: "2026-10-18", steps: 1, userId: 0 }).success, false);
  assert.equal(trackerSyncSchema.safeParse({ source: "apple_health", date: "2026-10-18", steps: 1, userId: 1, email: "private@example.invalid" }).success, false);
});

test("native aggregation rejects no-data, wrong units and unbounded totals", () => {
  assert.equal(totalAggregatedSteps([{ value: 1500, unit: "count" }, { value: 2500, unit: "count" }]), 4000);
  assert.throws(() => totalAggregatedSteps([]), /No step data/);
  assert.throws(() => totalAggregatedSteps([{ value: 5, unit: "meter" }]), /invalid/);
  assert.throws(() => totalAggregatedSteps([{ value: Infinity, unit: "count" }]), /invalid/);
  assert.throws(() => totalAggregatedSteps([{ value: 100000, unit: "count" }, { value: 60000, unit: "count" }]), /range/);
});

test("step windows use site midnight across Singapore and daylight-saving boundaries", () => {
  assert.deepEqual(trackerDayWindow(new Date("2026-10-17T18:30:00Z"), "Asia/Singapore"), {
    date: "2026-10-18", startDate: "2026-10-17T16:00:00.000Z", endDate: "2026-10-17T18:30:00.000Z", timeZone: "Asia/Singapore",
  });
  assert.equal(trackerDayWindow(new Date("2026-03-08T16:00:00Z"), "America/New_York").startDate, "2026-03-08T05:00:00.000Z");
  assert.equal(trackerDayWindow(new Date("2026-11-01T16:00:00Z"), "America/New_York").startDate, "2026-11-01T04:00:00.000Z");
});
