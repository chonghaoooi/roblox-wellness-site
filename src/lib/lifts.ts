import { type WeightClassKey, weightClassOf } from "./weight-classes.ts";

// Gym exercises and the strength maths. Pure functions (no I/O) so they can be unit-tested.

export const EXERCISES = {
  bench: "Bench press",
  squat: "Squat",
  deadlift: "Deadlift",
  latpulldown: "Lat pulldown",
  lateralraise: "Cable lateral raise",
  shoulderpress: "Machine shoulder press",
  pullup: "Pull up",
  dips: "Dips",
  chestfly: "Machine chest fly",
  bicepcurl: "Machine bicep curl",
} as const;

export type Exercise = keyof typeof EXERCISES;
export const EXERCISE_KEYS = Object.keys(EXERCISES) as [Exercise, ...Exercise[]];

/** Moves where you lift your own body: the entered weight is the EXTRA weight (0 = bodyweight only). */
const BODYWEIGHT: readonly Exercise[] = ["pullup", "dips"];
/** Free-weight barbell lifts, where the plates in a photo can be checked against the claimed weight. */
const BARBELL: readonly Exercise[] = ["bench", "squat", "deadlift"];

export const isBodyweight = (e: Exercise) => BODYWEIGHT.includes(e);
export const isBarbell = (e: Exercise) => BARBELL.includes(e);

/** Estimated one-rep max (Epley) as a multiple of body weight. For bodyweight moves the load is body + added weight. */
export function strengthRatio(exercise: Exercise, liftKg: number, reps: number, bodyKg: number): number {
  const load = isBodyweight(exercise) ? bodyKg + liftKg : liftKg;
  return (load * (1 + reps / 30)) / bodyKg;
}

export type LiftRow = { exercise: string; username: string; liftKg: number; reps: number; bw: number | null };
/** One person's best set for an exercise. `value` = strength as a multiple of body weight; `e1rmKg` = the actual estimated max. */
export type LiftScore = { username: string; value: number; sub: string; e1rmKg: number; bodyKg: number; liftKg: number; reps: number };

/** Best score per person per exercise, ranked high to low. People with no logged body weight are left out. */
export function rankLifts(rows: LiftRow[]): Record<Exercise, LiftScore[]> {
  const out = Object.fromEntries(EXERCISE_KEYS.map((k) => [k, [] as LiftScore[]])) as Record<Exercise, LiftScore[]>;
  const best = new Map<string, LiftScore>();
  for (const r of rows) {
    if (!Object.hasOwn(EXERCISES, r.exercise) || !r.bw) continue;
    const ex = r.exercise as Exercise;
    const value = strengthRatio(ex, r.liftKg, r.reps, r.bw);
    const key = `${ex}|${r.username}`;
    if (value <= (best.get(key)?.value ?? 0)) continue;
    const sub = isBodyweight(ex)
      ? `${r.reps} ${r.reps === 1 ? "rep" : "reps"}${r.liftKg > 0 ? ` +${Math.round(r.liftKg)} kg` : ""}`
      : `${Math.round(r.liftKg * (1 + r.reps / 30))} kg est. max`;
    const e1rmKg = (isBodyweight(ex) ? r.bw + r.liftKg : r.liftKg) * (1 + r.reps / 30);
    best.set(key, { username: r.username, value, sub, e1rmKg, bodyKg: r.bw, liftKg: r.liftKg, reps: r.reps });
  }
  for (const [key, score] of best) out[key.split("|")[0] as Exercise].push(score);
  for (const k of EXERCISE_KEYS) out[k].sort((a, b) => b.value - a.value || a.username.localeCompare(b.username));
  return out;
}

/**
 * "All classes": ranked by strength relative to body weight. One class: only people in that class, ranked by the
 * actual estimated max (absolute weight), since everyone in a class weighs about the same.
 */
export function rankByClass(scores: LiftScore[], cls: WeightClassKey | "all"): LiftScore[] {
  const list = cls === "all" ? [...scores] : scores.filter((s) => weightClassOf(s.bodyKg).key === cls);
  const metric = (s: LiftScore) => (cls === "all" ? s.value : s.e1rmKg);
  return list.sort((a, b) => metric(b) - metric(a) || b.value - a.value || a.username.localeCompare(b.username));
}

export type ParsedLift = { exercise: Exercise; weight: number; reps: number };
export type LiftParseResult = { lifts: ParsedLift[]; error?: { row: number; message: string } };

export const MAX_LIFT_ROWS = 20;

/**
 * Parses the repeated exercise/weight/reps fields of the workout form. A row where both weight and reps are blank
 * is ignored (so an untouched extra row is harmless). Bodyweight moves may leave weight blank (= 0 added).
 * Row numbers in errors are 1-based.
 */
export function parseLiftRows(exercises: string[], weights: string[], reps: string[]): LiftParseResult {
  const n = Math.max(exercises.length, weights.length, reps.length);
  if (n > MAX_LIFT_ROWS) return { lifts: [], error: { row: MAX_LIFT_ROWS + 1, message: `At most ${MAX_LIFT_ROWS} lifts per post` } };
  const lifts: ParsedLift[] = [];
  for (let i = 0; i < n; i++) {
    const w = (weights[i] ?? "").trim();
    const r = (reps[i] ?? "").trim();
    const ex = (exercises[i] ?? "").trim();
    if (w === "" && r === "") continue;
    if (!Object.hasOwn(EXERCISES, ex)) return { lifts: [], error: { row: i + 1, message: "Pick an exercise" } };
    const exercise = ex as Exercise;
    const repsN = Number(r);
    if (r === "" || !Number.isInteger(repsN) || repsN < 1 || repsN > 30) return { lifts: [], error: { row: i + 1, message: "Reps must be a whole number from 1 to 30" } };
    if (w === "" && !isBodyweight(exercise)) return { lifts: [], error: { row: i + 1, message: "Enter the weight" } };
    const weight = w === "" ? 0 : Number(w);
    if (!Number.isFinite(weight) || weight < (isBodyweight(exercise) ? 0 : 1) || weight > 500) {
      return { lifts: [], error: { row: i + 1, message: isBodyweight(exercise) ? "Added weight must be 0 to 500" : "Weight must be 1 to 500" } };
    }
    lifts.push({ exercise, weight, reps: repsN });
  }
  return { lifts };
}
