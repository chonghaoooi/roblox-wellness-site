import { z } from "zod";
import { EXERCISE_KEYS, isBodyweight } from "./lifts.ts";

export const tickerSchema = z.string().trim().max(500, "Keep the ticker under 500 characters.");
export const adminPasswordSchema = z.string().min(12, "Use at least 12 characters.")
  .refine((s) => new TextEncoder().encode(s).length <= 72, "Use at most 72 bytes.");
export const adminIdSchema = z.coerce.number().int().positive().max(2147483647);
const nullableNumber = (min: number, max: number) => z.preprocess((v) => v === "" || v == null ? null : v, z.coerce.number().min(min).max(max).nullable());
const note = z.string().trim().max(280);
const number = (min: number, max: number, int = false) => z.preprocess(
  (v) => v == null || (typeof v === "string" && v.trim() === "") ? NaN : v,
  (int ? z.coerce.number().int() : z.coerce.number()).min(min).max(max),
);

export function parseAdminLog(kind: string, input: Record<string, unknown>) {
  switch (kind) {
    case "meal": return z.object({ calories: number(0, 5000, true), note: z.string().trim().max(80) }).safeParse(input);
    case "steps": return z.object({ steps: number(0, 100000, true), note }).safeParse(input);
    case "weight": return z.object({ weightKg: nullableNumber(20, 300), heightCm: nullableNumber(90, 250), note })
      .refine((d) => d.weightKg !== null || d.heightCm !== null, "Enter weight or height.").safeParse(input);
    case "gym": return z.object({ note }).safeParse(input);
    case "lift": return z.object({ exercise: z.enum(EXERCISE_KEYS), liftKg: number(0, 500), reps: number(1, 30, true), note })
      .refine((d) => isBodyweight(d.exercise) || d.liftKg >= 1, "This exercise needs a weight of at least 1 kg.").safeParse(input);
    default: return z.object({ kind: z.literal("supported log type") }).safeParse({ kind });
  }
}
