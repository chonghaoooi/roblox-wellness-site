import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { suggestedCalorieGoal } from "./calc";

/** Set calorie goals from each person's latest logged weight and height. One user, or everyone when no id is given. Returns what changed. */
export async function syncCalorieGoals(userId?: number): Promise<{ username: string; goal: number }[]> {
  const db = requireDb();
  const res = (await db.execute(sql`
    select u.id, u.username,
      (select weight_kg::float8 from logs where user_id = u.id and weight_kg is not null order by date desc, id desc limit 1) as w,
      (select height_cm::float8 from logs where user_id = u.id and height_cm is not null order by date desc, id desc limit 1) as h
    from users u where u.username <> 'adilbot' ${userId === undefined ? sql`` : sql`and u.id = ${userId}`}`)) as unknown as {
    rows: { id: number; username: string; w: number | null; h: number | null }[];
  };
  const out: { username: string; goal: number }[] = [];
  for (const r of res.rows) {
    if (r.w === null || r.h === null) continue;
    const goal = suggestedCalorieGoal(r.w, r.h);
    await db.execute(sql`insert into settings (user_id, calorie_goal) values (${r.id}, ${goal}) on conflict (user_id) do update set calorie_goal = ${goal}`);
    out.push({ username: r.username, goal });
  }
  return out;
}
