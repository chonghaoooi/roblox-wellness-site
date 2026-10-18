import "server-only";
import { after } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { aiEnabled, reactToMeal } from "./ai";

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

/** After the response is sent, adil bot votes on and comments on a new meal. Never throws and never blocks the poster. */
export function adilbotReacts(mealId: number, jpeg: Buffer, ctx: { username: string; calories: number; caption: string | null }) {
  if (!aiEnabled || !db) return;
  after(async () => {
    try {
      const id = await botId();
      if (!id || !db) return;
      const r = await reactToMeal(jpeg, ctx);
      await db.execute(sql`
        with v as (
          insert into meal_votes (meal_id, user_id, value)
          select id, ${id}, ${r.vote === "up" ? 1 : -1} from meals where id = ${mealId}
          on conflict (meal_id, user_id) do nothing returning meal_id)
        insert into meal_comments (meal_id, user_id, text)
        select id, ${id}, ${r.comment} from meals
        where id = ${mealId} and not exists (select 1 from meal_comments where meal_id = ${mealId} and user_id = ${id})`);
    } catch (e) {
      console.error("[adilbot]", e instanceof Error ? e.message : e);
    }
  });
}
