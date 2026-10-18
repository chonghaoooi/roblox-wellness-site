"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDb } from "@/db";
import { meals, mealVotes } from "@/db/schema";
import { getUser } from "@/lib/auth";
import type { FormState } from "@/lib/validation";

const input = z.object({ mealId: z.coerce.number().int().positive().max(2147483647), vote: z.enum(["up", "down", "clear"]) });

export async function voteMeal(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Log in to vote. Meal voting is free." };
  const parsed = input.safeParse({ mealId: fd.get("mealId"), vote: fd.get("vote") });
  if (!parsed.success) return { error: "Choose a valid meal and vote." };
  const { mealId, vote } = parsed.data;
  const db = requireDb();
  if (vote === "clear") {
    const [meal] = await db.select({ id: meals.id }).from(meals).where(eq(meals.id, mealId)).limit(1);
    if (!meal) return { error: "This meal is no longer available." };
    await db.delete(mealVotes).where(and(eq(mealVotes.mealId, mealId), eq(mealVotes.userId, user.id)));
  } else {
    const result = await db.execute(sql`
      insert into meal_votes (meal_id, user_id, value)
      select id, ${user.id}, ${vote === "up" ? 1 : -1} from meals where id=${mealId}
      on conflict (meal_id, user_id) do update set value=excluded.value
      returning meal_id
    `);
    if (!result.rows.length) return { error: "This meal is no longer available." };
  }
  revalidatePath("/meals");
  return { ok: true, message: vote === "clear" ? "Vote removed." : "Vote saved." };
}
