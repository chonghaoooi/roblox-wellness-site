// Re-implementation of the Calorie_Step_Tracker.xlsx formulas. Pure functions, no I/O.

export const DEFAULTS = {
  weightUnit: "kg",
  distanceUnit: "km",
  calorieGoal: 2000,
  stepGoal: 10000,
  caloriesPerStep: 0.04,
  strideLengthM: 0.762,
} as const;

export const HEALTHY_BMI = 22;

/** Daily protein target: 1.6 g per kg of bodyweight, rounded to 5 g. */
export const proteinTarget = (weightKg: number) => Math.round((1.6 * weightKg) / 5) * 5;

/** Daily calorie goal from weight and height alone: Mifflin-St Jeor with an assumed age of 25 and a sex-neutral constant, times 1.4 for light activity, rounded to 50. */
export function suggestedCalorieGoal(weightKg: number, heightCm: number): number {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * 25 - 78;
  return Math.min(4000, Math.max(1200, Math.round((bmr * 1.4) / 50) * 50));
}

export type CalcSettings = {
  calorieGoal: number;
  stepGoal: number;
  caloriesPerStep: number;
  strideLengthM: number;
};

export type RawEntry = {
  date: string; // YYYY-MM-DD
  weightKg: number | null;
  heightCm: number | null;
  caloriesIn: number | null;
  steps: number | null;
};

export type DerivedEntry = RawEntry & {
  dayOfWeek: string;
  caloriesOut: number | null;
  net: number | null;
  distanceKm: number | null;
  bmi: number | null;
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const parseDate = (s: string) => new Date(`${s}T00:00:00Z`);
export const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
export const dayOfWeek = (s: string) => DOW[parseDate(s).getUTCDay()];

export const caloriesOut = (steps: number, cps: number) => steps * cps;
export const netCalories = (cin: number, steps: number, cps: number) => cin - caloriesOut(steps, cps);
export const distanceKm = (steps: number, strideM: number) => (steps * strideM) / 1000;
export const bmi = (weightKg: number, heightCm: number) => weightKg / Math.pow(heightCm / 100, 2);

export const kgToLb = (kg: number) => kg * 2.2046226218;
export const kmToMi = (km: number) => km * 0.6213711922;

export type BmiCategory = { label: string; tone: "good" | "warn" | "bad" };

/** Under 25 counts as healthy (house rule); 25-30 is overweight, 30+ obese. */
export function bmiCategory(v: number): BmiCategory {
  if (v < 25) return { label: "Healthy", tone: "good" };
  if (v < 30) return { label: "Overweight", tone: "warn" };
  return { label: "Obese", tone: "bad" };
}

export function derive(e: RawEntry, s: CalcSettings): DerivedEntry {
  const { steps, caloriesIn, weightKg, heightCm } = e;
  return {
    ...e,
    dayOfWeek: dayOfWeek(e.date),
    caloriesOut: steps === null ? null : caloriesOut(steps, s.caloriesPerStep),
    net: steps === null || caloriesIn === null ? null : netCalories(caloriesIn, steps, s.caloriesPerStep),
    distanceKm: steps === null ? null : distanceKm(steps, s.strideLengthM),
    bmi: weightKg === null || heightCm === null ? null : bmi(weightKg, heightCm),
  };
}

const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export type Summary = {
  currentWeight: number | null;
  startingWeight: number | null;
  weightChange: number | null;
  avgCaloriesIn: number | null;
  avgCaloriesOut: number | null;
  avgNet: number | null;
  avgSteps: number | null;
  totalSteps: number;
  bestStepDay: { date: string; steps: number } | null;
  daysLogged: number;
  daysCalorieGoal: number;
  daysStepGoal: number;
  calorieGoalRate: number | null;
  stepGoalRate: number | null;
};

/** Every field is optional per day, so each stat only uses the days that have its inputs. "Hitting the calorie goal" = at or under the goal. */
export function summarize(entries: DerivedEntry[], s: CalcSettings): Summary | null {
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const weighed = sorted.filter((e) => e.weightKg !== null);
  const stepDays = sorted.filter((e) => e.steps !== null);
  const calDays = sorted.filter((e) => e.caloriesIn !== null);
  const best = stepDays.reduce<DerivedEntry | null>((m, e) => (m === null || e.steps! > m.steps! ? e : m), null);
  const dCal = calDays.filter((e) => e.caloriesIn! <= s.calorieGoal).length;
  const dStep = stepDays.filter((e) => e.steps! >= s.stepGoal).length;
  return {
    currentWeight: weighed.length ? weighed[weighed.length - 1].weightKg : null,
    startingWeight: weighed.length ? weighed[0].weightKg : null,
    weightChange: weighed.length ? weighed[weighed.length - 1].weightKg! - weighed[0].weightKg! : null,
    avgCaloriesIn: avg(nums(sorted.map((e) => e.caloriesIn))),
    avgCaloriesOut: avg(nums(sorted.map((e) => e.caloriesOut))),
    avgNet: avg(nums(sorted.map((e) => e.net))),
    avgSteps: avg(nums(sorted.map((e) => e.steps))),
    totalSteps: sum(nums(sorted.map((e) => e.steps))),
    bestStepDay: best ? { date: best.date, steps: best.steps! } : null,
    daysLogged: sorted.length,
    daysCalorieGoal: dCal,
    daysStepGoal: dStep,
    calorieGoalRate: calDays.length ? dCal / calDays.length : null,
    stepGoalRate: stepDays.length ? dStep / stepDays.length : null,
  };
}

export type Period = "day" | "week" | "month";

/** Start of the bucket containing `s`: itself, the Monday of its week, or the 1st of its month. */
export function bucketStart(s: string, period: Period): string {
  if (period === "day") return s;
  const d = parseDate(s);
  if (period === "month") return fmtDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  const back = (d.getUTCDay() + 6) % 7; // Monday = 0
  return fmtDate(new Date(d.getTime() - back * 86400000));
}

export type PeriodRow = {
  start: string;
  days: number;
  avgWeight: number | null;
  avgCaloriesIn: number | null;
  avgCaloriesOut: number | null;
  avgSteps: number | null;
  totalSteps: number;
};

export function groupByPeriod(entries: DerivedEntry[], period: Period): PeriodRow[] {
  const map = new Map<string, DerivedEntry[]>();
  for (const e of entries) {
    const k = bucketStart(e.date, period);
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, es]) => ({
      start,
      days: es.length,
      avgWeight: avg(nums(es.map((e) => e.weightKg))),
      avgCaloriesIn: avg(nums(es.map((e) => e.caloriesIn))),
      avgCaloriesOut: avg(nums(es.map((e) => e.caloriesOut))),
      avgSteps: avg(nums(es.map((e) => e.steps))),
      totalSteps: sum(nums(es.map((e) => e.steps))),
    }));
}

/** Re-bucket an already-daily series of numeric fields by averaging (nulls are skipped). */
export function rebucket<T extends { date: string }>(
  rows: T[],
  period: Period,
  keys: (keyof T)[],
): Record<string, number | string>[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = bucketStart(r.date, period);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rs]) => {
      const out: Record<string, number | string> = { date };
      for (const k of keys) {
        const vals = rs.map((r) => r[k]).filter((v): v is T[keyof T] & number => typeof v === "number");
        const a = avg(vals);
        if (a !== null) out[k as string] = a;
      }
      return out;
    });
}

/** Percentile (0-100) = share of values the given value is at or above. */
export function percentile(value: number, all: number[]): number | null {
  if (!all.length) return null;
  return (all.filter((v) => v <= value).length / all.length) * 100;
}
