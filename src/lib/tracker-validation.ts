import { z } from "zod";

export const TRACKER_SOURCES = ["apple_health", "health_connect"] as const;
export const trackerSyncSchema = z.object({
  userId: z.number().int().positive(),
  source: z.enum(TRACKER_SOURCES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().min(0).max(150_000),
}).strict();

export { totalAggregatedSteps, trackerDayWindow } from "./tracker-shared.ts";
