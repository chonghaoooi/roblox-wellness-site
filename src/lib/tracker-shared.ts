/** Native health stores already deduplicate devices. Never sum raw watch/phone samples. */
export function totalAggregatedSteps(samples: { value: number; unit: string }[]) {
  if (!samples.length) throw new Error("No step data is available. Check health permissions and try again after your phone has recorded steps.");
  let total = 0;
  for (const sample of samples) {
    if (sample.unit !== "count" || !Number.isFinite(sample.value) || sample.value < 0) throw new Error("The health app returned an invalid step count.");
    total += sample.value;
  }
  total = Math.round(total);
  if (total > 150_000) throw new Error("The step count is outside the supported daily range.");
  return total;
}

/** Site-local midnight, including DST changes. The phone reads exactly this interval. */
export function trackerDayWindow(now = new Date(), timeZone = "Asia/Singapore") {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const parts = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const midnightWall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  let midnight = midnightWall;
  for (let i = 0; i < 4; i++) {
    const local = Object.fromEntries(formatter.formatToParts(new Date(midnight)).map(p => [p.type, p.value]));
    const localWall = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute), Number(local.second));
    midnight += midnightWall - localWall;
  }
  return { date, startDate: new Date(midnight).toISOString(), endDate: now.toISOString(), timeZone };
}
