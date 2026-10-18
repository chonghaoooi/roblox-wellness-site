import { z } from "zod";

export const COMMENT_LIMIT = 240;
export const mealCommentInput = z.object({
  text: z.string().transform((s) => s.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Write a comment first.").max(COMMENT_LIMIT, "Keep comments to 240 characters.")),
});
export type MealComment = { id: number; username: string; text: string; createdAt: string; mine: boolean };
