import "server-only";
import { after } from "next/server";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { aiEnabled, reactToGym, reactToMeal, type GymReactionInput, type MealReaction } from "./ai";

export const BOT_USERNAME = "adilbot";

/** The bot is an ordinary users row that nobody can log in as: its password hash is not a valid bcrypt hash. */
async function botId(): Promise<number | null> {
  if (!db) return null;
  const found = await db.execute(sql`
    insert into users (username, email, password_hash)
    values (${BOT_USERNAME}, 'adilbot@bot.invalid', '!')
    on conflict (username) do update set username = excluded.username
    returning id`);
  return (found.rows as { id: number }[])[0]?.id ?? null;
}

/** Runs after the response is sent so it never slows the poster down, and never throws. Votes once and comments once per post. */
function react(save: (botUserId: number, r: MealReaction) => SQL, think: () => Promise<MealReaction>) {
  if (!aiEnabled || !db) return;
  after(async () => {
    try {
      const id = await botId();
      if (!id || !db) return;
      await db.execute(save(id, await think()));
    } catch (e) {
      console.error("[adilbot]", e instanceof Error ? e.message : e);
    }
  });
}

export function adilbotReacts(mealId: number, jpeg: Buffer, ctx: { username: string; calories: number; caption: string | null }) {
  react(
    (id, r) => sql`
      with v as (
        insert into meal_votes (meal_id, user_id, value)
        select id, ${id}, ${r.vote === "up" ? 1 : -1} from meals where id = ${mealId}
        on conflict (meal_id, user_id) do nothing returning meal_id)
      insert into meal_comments (meal_id, user_id, text)
      select id, ${id}, ${r.comment} from meals
      where id = ${mealId} and not exists (select 1 from meal_comments where meal_id = ${mealId} and user_id = ${id})`,
    () => reactToMeal(jpeg, ctx),
  );
}

export function adilbotReactsToGym(postId: number, ctx: GymReactionInput, jpeg: Buffer | null) {
  react(
    (id, r) => sql`
      with v as (
        insert into gym_post_votes (post_id, user_id, value)
        select id, ${id}, ${r.vote === "up" ? 1 : -1} from gym_posts where id = ${postId}
        on conflict (post_id, user_id) do nothing returning post_id)
      insert into gym_post_comments (post_id, user_id, text)
      select id, ${id}, ${r.comment} from gym_posts
      where id = ${postId} and not exists (select 1 from gym_post_comments where post_id = ${postId} and user_id = ${id})`,
    () => reactToGym(ctx, jpeg),
  );
}
