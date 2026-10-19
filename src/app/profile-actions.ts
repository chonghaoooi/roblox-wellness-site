"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSettings, getUser } from "@/lib/auth";
import { bmi as calcBmi, bmiCategory, kgToLb, proteinTarget } from "@/lib/calc";
import { addDays, todayStr } from "@/lib/dates";
import { userGymStreak } from "@/lib/queries";
import { weightClassOf } from "@/lib/weight-classes";

export type ProfileDay = { date: string; weight: number | null; calories: number | null; steps: number | null };
export type Profile = {
  username: string;
  joined: string | null;
  weightUnit: "kg" | "lb";
  weight: number | null;
  heightCm: number | null;
  bmi: number | null;
  bmiLabel: string | null;
  weightClass: string | null;
  avgSteps: number | null;
  avgCalories: number | null;
  calorieGoal: number;
  avgProtein: number | null;
  proteinGoal: number | null;
  gymDays30: number;
  gymStreak: number;
  meals30: number;
  days: ProfileDay[]; // last 30 days, oldest first, null where nothing was logged
};

/** Public stats for the profile card: everything shown here is already on the leaderboards and trends for signed-in friends. */
export async function getProfile(username: string): Promise<Profile | null> {
  const me = await getUser();
  if (!me || !db || !/^[A-Za-z0-9_]{1,20}$/.test(username)) return null;
  const found = (await db.execute(sql`select id, username, created_at::date::text as joined from users where lower(username) = lower(${username}) limit 1`)) as unknown as {
    rows: { id: number; username: string; joined: string | null }[];
  };
  const u = found.rows[0];
  if (!u) return null;

  const today = todayStr();
  const from = addDays(today, -29);
  const unit = (await getSettings(me.id))?.weightUnit === "lb" ? "lb" : "kg";
  const conv = (kg: number | null) => (kg === null ? null : Number((unit === "lb" ? kgToLb(kg) : kg).toFixed(1)));

  const stats = (await db.execute(sql`
    select date::text as date, weight_kg::float8 as "weightKg", height_cm::float8 as "heightCm", calories_in::int as calories, steps::int as steps
    from daily_stats where user_id = ${u.id} order by date`)) as unknown as {
    rows: { date: string; weightKg: number | null; heightCm: number | null; calories: number | null; steps: number | null }[];
  };
  const all = stats.rows;
  const lastW = [...all].reverse().find((d) => d.weightKg !== null);
  const lastH = [...all].reverse().find((d) => d.heightCm !== null);
  const b = lastW && lastH?.heightCm ? calcBmi(lastW.weightKg!, lastH.heightCm) : null;

  const recent = new Map(all.filter((d) => d.date >= from).map((d) => [d.date, d]));
  const days: ProfileDay[] = [];
  for (let i = 0; i < 30; i++) {
    const date = addDays(from, i);
    const d = recent.get(date);
    days.push({ date, weight: conv(d?.weightKg ?? null), calories: d?.calories ?? null, steps: d?.steps ?? null });
  }
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? Math.round(v.reduce((a, c) => a + c, 0) / v.length) : null;
  };

  const counts = (await db.execute(sql`
    select (select coalesce(calorie_goal, 2000) from settings where user_id = ${u.id}) as goal,
           (select round(avg(p))::int from (select sum(protein_g) as p from logs where user_id = ${u.id} and kind = 'meal' and protein_g is not null and date >= ${from}::date group by date) x) as protein,
           (select count(distinct date) from logs where user_id = ${u.id} and kind = 'gym' and date >= ${from}::date)::int as gym,
           (select count(*) from meals where user_id = ${u.id} and created_at >= now() - interval '30 days')::int as meals`)) as unknown as {
    rows: { goal: number | null; protein: number | null; gym: number; meals: number }[];
  };
  const streak = await userGymStreak(u.id, today);

  return {
    username: u.username,
    joined: u.joined,
    weightUnit: unit,
    weight: conv(lastW?.weightKg ?? null),
    heightCm: lastH?.heightCm ?? null,
    bmi: b === null ? null : Number(b.toFixed(1)),
    bmiLabel: b === null ? null : bmiCategory(b).label,
    weightClass: lastW ? weightClassOf(lastW.weightKg!).label : null,
    avgSteps: avg(days.map((d) => d.steps)),
    avgCalories: avg(days.map((d) => d.calories)),
    calorieGoal: counts.rows[0]?.goal ?? 2000,
    avgProtein: counts.rows[0]?.protein ?? null,
    proteinGoal: lastW ? proteinTarget(lastW.weightKg!) : null,
    gymDays30: counts.rows[0]?.gym ?? 0,
    gymStreak: streak?.visits ?? 0,
    meals30: counts.rows[0]?.meals ?? 0,
    days,
  };
}
