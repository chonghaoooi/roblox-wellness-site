import "server-only";
import { after } from "next/server";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { aiEnabled, reactToGym, reactToMeal, replyInThread, type GymReactionInput, type MealReaction } from "./ai";
import { BOT_USERNAMES, PERSONA_IDS, PERSONAS, type Persona } from "./personas";

export const BOT_USERNAME = PERSONAS.adil.username;

/** The bot is an ordinary users row that nobody can log in as: its password hash is not a valid bcrypt hash. */
async function botId(persona: Persona): Promise<number | null> {
  if (!db) return null;
  const username = PERSONAS[persona].username;
  const found = await db.execute(sql`
    insert into users (username, email, password_hash)
    values (${username}, ${`${username}@bot.invalid`}, '!')
    on conflict (username) do update set username = excluded.username
    returning id`);
  return (found.rows as { id: number }[])[0]?.id ?? null;
}

/** Runs after the response is sent so it never slows the poster down, and never throws. Votes once and comments once per post. */
function react(save: (botUserId: number, r: MealReaction) => SQL, think: (persona: Persona) => Promise<MealReaction>) {
  if (!aiEnabled || !db) return;
  after(() => Promise.all(PERSONA_IDS.map(async (persona) => {
    try {
      const id = await botId(persona);
      if (!id || !db) return;
      await db.execute(save(id, await think(persona)));
    } catch (e) {
      console.error(`[${persona}bot]`, e instanceof Error ? e.message : e);
    }
  })));
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
    (persona) => reactToMeal(jpeg, ctx, persona),
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
    (persona) => reactToGym(ctx, jpeg, persona),
  );
}

const MAX_BOT_COMMENTS_PER_POST = 12;
const MAX_BOT_COMMENTS_PER_HOUR = 60;

/**
 * When a person comments, both bots answer in the same thread a moment later. They never answer each other or themselves,
 * reply at most 12 times per post each and 60 times an hour each, and read the last few comments for context.
 */
export function adilbotReplies(kind: "meal" | "gym", postId: number, commenter: string) {
  if (!aiEnabled || !db || BOT_USERNAMES.includes(commenter)) return;
  after(async () => {
    try {
      if (!db) return;
      const isGym = kind === "gym";
      const post = await db.execute(isGym
        ? sql`select u.username as owner, coalesce(p.notes, '') || ' | lifts: ' || coalesce((select string_agg(l.exercise || ' ' || l.lift_kg || 'kg x ' || l.reps, '; ') from logs l where l.post_id = p.id), 'none') as about
              from gym_posts p join users u on u.id = p.user_id where p.id = ${postId}`
        : sql`select u.username as owner, coalesce(m.caption, '') || ' | ' || coalesce(l.calories::text, '?') || ' kcal' as about
              from meals m join users u on u.id = m.user_id left join logs l on l.id = m.log_id where m.id = ${postId}`);
      const p = (post.rows as { owner: string; about: string }[])[0];
      if (!p) return;
      const thread = await db.execute(isGym
        ? sql`select u.username, c.text from gym_post_comments c join users u on u.id = c.user_id where c.post_id = ${postId} order by c.id desc limit 8`
        : sql`select u.username, c.text from meal_comments c join users u on u.id = c.user_id where c.meal_id = ${postId} order by c.id desc limit 8`);
      const msgs = (thread.rows as { username: string; text: string }[]).reverse();
      if (!msgs.length || BOT_USERNAMES.includes(msgs[msgs.length - 1].username)) return; // a bot already answered this one
      const replyTo = msgs[msgs.length - 1].username;
      await Promise.all(PERSONA_IDS.map(async (persona) => {
        try {
          const id = await botId(persona);
          if (!id || !db) return;
          const text = await replyInThread({ kind, owner: p.owner, about: p.about, thread: msgs, replyTo }, persona);
          await db.execute(isGym
            ? sql`insert into gym_post_comments (post_id, user_id, text)
                  select id, ${id}, ${text} from gym_posts where id = ${postId}
                    and (select count(*) from gym_post_comments where post_id = ${postId} and user_id = ${id}) < ${MAX_BOT_COMMENTS_PER_POST}
                    and ((select count(*) from gym_post_comments where user_id = ${id} and created_at > now() - interval '1 hour')
                       + (select count(*) from meal_comments where user_id = ${id} and created_at > now() - interval '1 hour')) < ${MAX_BOT_COMMENTS_PER_HOUR}`
            : sql`insert into meal_comments (meal_id, user_id, text)
                  select id, ${id}, ${text} from meals where id = ${postId}
                    and (select count(*) from meal_comments where meal_id = ${postId} and user_id = ${id}) < ${MAX_BOT_COMMENTS_PER_POST}
                    and ((select count(*) from gym_post_comments where user_id = ${id} and created_at > now() - interval '1 hour')
                       + (select count(*) from meal_comments where user_id = ${id} and created_at > now() - interval '1 hour')) < ${MAX_BOT_COMMENTS_PER_HOUR}`);
        } catch (e) {
          console.error(`[${persona}bot reply]`, e instanceof Error ? e.message : e);
        }
      }));
    } catch (e) {
      console.error("[bot reply]", e instanceof Error ? e.message : e);
    }
  });
}
