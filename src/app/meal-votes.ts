"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDb } from "@/db";
import { meals, mealVotes } from "@/db/schema";
import { getUser } from "@/lib/auth";
import type { FormState } from "@/lib/validation";

const input = z.object({ mealId: z.coerce.number().int().positive().max(2147483647), vote: z.enum(["up", "down", "clear"]), kind: z.enum(["meal", "gym"]).default("meal") });

export async function voteMeal(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Log in to vote. Meal voting is free." };
  const parsed = input.safeParse({ mealId: fd.get("mealId"), vote: fd.get("vote"), kind: fd.get("kind") ?? undefined });
  if (!parsed.success) return { error: "Choose a valid meal and vote." };
  const { mealId, vote, kind } = parsed.data;
  if (kind === "gym") return voteGymPost(user.id, mealId, vote);
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
  revalidatePath("/posts");
  return { ok: true, message: vote === "clear" ? "Vote removed." : "Vote saved." };
}

async function voteGymPost(userId: number, postId: number, vote: "up" | "down" | "clear"): Promise<FormState> {
  const db = requireDb();
  if (vote === "clear") {
    const removed = await db.execute(sql`delete from gym_post_votes where post_id = ${postId} and user_id = ${userId} returning post_id`);
    if (!removed.rows.length) {
      const exists = await db.execute(sql`select id from gym_posts where id = ${postId}`);
      if (!exists.rows.length) return { error: "This post is no longer available." };
    }
  } else {
    const result = await db.execute(sql`
      insert into gym_post_votes (post_id, user_id, value)
      select id, ${userId}, ${vote === "up" ? 1 : -1} from gym_posts where id = ${postId}
      on conflict (post_id, user_id) do update set value = excluded.value
      returning post_id`);
    if (!result.rows.length) return { error: "This post is no longer available." };
  }
  revalidatePath("/posts");
  revalidatePath("/gym");
  return { ok: true, message: vote === "clear" ? "Vote removed." : "Vote saved." };
}
