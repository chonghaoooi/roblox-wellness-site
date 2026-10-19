import { z } from "zod";

const num = (label: string, min: number, max: number, int = false) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .transform(Number)
    .pipe(
      (int ? z.number().int(`${label} must be a whole number`) : z.number("Enter a number")).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`),
    );

export const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username needs 3+ characters")
    .max(20, "Username can be at most 20 characters")
    .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and _ only"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password needs 8+ characters").max(72, "Password can be at most 72 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

// Everything about a day is optional: blank fields are simply not logged.
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optNum = (label: string, min: number, max: number, int = false) =>
  z.preprocess(
    blank,
    z.coerce
      .number(`${label} must be a number`)
      .refine((n) => !int || Number.isInteger(n), `${label} must be a whole number`)
      .refine((n) => n >= min, `${label} must be at least ${min}`)
      .refine((n) => n <= max, `${label} must be at most ${max}`)
      .optional(),
  );

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const note = z.preprocess(blank, z.string().trim().max(280, "Notes can be at most 280 characters").optional());

// Weight and height are entered in the user's unit (height in cm); the action converts weight to kg.
export const weighInSchema = z
  .object({ date: dateField, weight: optNum("Weight", 20, 500), heightCm: optNum("Height", 90, 250), notes: note })
  .refine((d) => d.weight !== undefined || d.heightCm !== undefined, { message: "Enter a weight or a height", path: ["weight"] });

export const manualStepsSchema = z.object({ date: dateField, steps: optNum("Steps", 1, 100000, true) });

export const mealSchema = z.object({
  date: dateField,
  calories: optNum("Calories", 0, 5000, true),
  protein: optNum("Protein", 0, 300, true),
  caption: z.preprocess(blank, z.string().trim().max(80, "Caption can be at most 80 characters").optional()),
});

export { EXERCISES, type Exercise } from "./lifts.ts";

export const settingsSchema = z.object({
  weightUnit: z.enum(["kg", "lb"]),
  distanceUnit: z.enum(["km", "mi"]),
  calorieGoal: num("Calorie goal", 500, 10000, true),
  stepGoal: num("Step goal", 500, 100000, true),
  caloriesPerStep: num("Calories per step", 0.01, 0.2),
  strideLengthM: num("Stride length", 0.3, 1.5),
});

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; message?: string };

export function toFieldErrors(err: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const i of err.issues) fieldErrors[String(i.path[0])] ??= i.message;
  return { error: "Fix the highlighted fields", fieldErrors };
}
