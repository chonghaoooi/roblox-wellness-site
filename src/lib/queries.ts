import { sql } from "drizzle-orm";
import { db } from "@/db";
import { HEALTHY_BMI, bmiCategory, bucketStart, percentile, proteinTarget } from "./calc";
import { addDays } from "./dates";
import { type Exercise, type LiftScore, rankLifts } from "./lifts";
import { weightClassOf } from "./weight-classes";
import { gymStreaksSql } from "./gym-streaks";

async function rows<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  if (!db) return [];
  try {
    const res = await db.execute(q);
    return (res as unknown as { rows: T[] }).rows;
  } catch (e) {
    // Most likely the migrations haven't been applied yet. Keep the site up with empty states.
    console.error("[queries]", e instanceof Error ? e.message : e);
    return [];
  }
}

// Every day-level number comes from the `daily_stats` view (see drizzle/0003): per user and date,
// calories = sum of that day's meals, steps = highest step count logged, weight = latest weigh-in.
// Each field can be null because logging any of them is optional.

// ---------- Today's leaderboards ----------

export type BoardRow = { username: string; value: number; sub?: string; tone?: "good" | "warn" | "bad" };
export type Boards = { bmi: BoardRow[]; steps: BoardRow[]; calories: BoardRow[] };

const BMI_SQL = sql`(e.weight_kg / power(e.height_cm / 100.0, 2))`;

type DayRow = { username: string; bmi: number | null; steps: number | null; calories_in: number | null; goal: number };

export async function todayRows(today: string): Promise<DayRow[]> {
  return rows<DayRow>(sql`
    select u.username, ${BMI_SQL}::float8 as bmi, e.steps::int as steps, e.calories_in::int as calories_in,
           coalesce(s.calorie_goal, 2000)::int as goal
    from daily_stats e
    join users u on u.id = e.user_id
    left join settings s on s.user_id = e.user_id
    where e.date = ${today}::date`);
}

/** BMI row with a plain-English label and how far it is from the healthy target. */
function bmiRow(username: string, v: number): BoardRow & { d: number } {
  const c = bmiCategory(v);
  const off = v - HEALTHY_BMI;
  return { username, value: v, d: Math.abs(off), sub: `${c.label} · ${off >= 0 ? "+" : "−"}${Math.abs(off).toFixed(1)}`, tone: c.tone };
}

function calRow(username: string, cal: number, goal: number): BoardRow & { d: number } {
  const off = Math.round(cal - goal);
  return {
    username,
    value: cal,
    d: Math.abs(off),
    sub: `${off === 0 ? "On goal" : `${Math.abs(off).toLocaleString("en-US")} ${off < 0 ? "under" : "over"} goal`} · target ${goal.toLocaleString("en-US")}`,
    tone: Math.abs(off) <= goal * 0.1 ? "good" : "warn",
  };
}

const byD = (a: { d: number; username: string }, b: { d: number; username: string }) => a.d - b.d || a.username.localeCompare(b.username);

export function rankDay(r: DayRow[]): Boards {
  return {
    bmi: r.flatMap((x) => (x.bmi === null ? [] : [bmiRow(x.username, x.bmi)])).sort(byD),
    steps: r.flatMap((x) => (x.steps === null ? [] : [{ username: x.username, value: x.steps }])).sort((a, b) => b.value - a.value),
    calories: r.flatMap((x) => (x.calories_in === null ? [] : [calRow(x.username, x.calories_in, x.goal)])).sort(byD),
  };
}

type PeriodAgg = { username: string; bmi: number | null; steps: number | null; step_days: number; cal: number | null; goal: number };

export async function periodBoards(from: string, to: string): Promise<Boards> {
  const r = await rows<PeriodAgg>(sql`
    select u.username, avg(${BMI_SQL})::float8 as bmi, sum(e.steps)::float8 as steps, count(e.steps)::int as step_days,
           avg(e.calories_in)::float8 as cal, coalesce(max(s.calorie_goal), 2000)::int as goal
    from daily_stats e
    join users u on u.id = e.user_id
    left join settings s on s.user_id = e.user_id
    where e.date between ${from}::date and ${to}::date
    group by u.username`);
  return {
    bmi: r.flatMap((x) => (x.bmi === null ? [] : [bmiRow(x.username, x.bmi)])).sort(byD),
    steps: r
      .flatMap((x) => (x.steps === null ? [] : [{ username: x.username, value: x.steps, sub: `${x.step_days} ${x.step_days === 1 ? "day" : "days"}` }]))
      .sort((a, b) => b.value - a.value),
    calories: r.flatMap((x) => (x.cal === null ? [] : [calRow(x.username, x.cal, x.goal)])).sort(byD),
  };
}

/** Protein eaten today (AI-estimated meals), highest first, against 1.6 g per kg of each person's latest weight. */
export async function proteinToday(today: string): Promise<BoardRow[]> {
  const r = await rows<{ username: string; protein: number; weight: number | null }>(sql`
    select u.username, sum(l.protein_g)::int as protein,
      (select weight_kg::float8 from logs w where w.user_id = u.id and w.weight_kg is not null order by w.date desc, w.id desc limit 1) as weight
    from logs l join users u on u.id = l.user_id
    where l.kind = 'meal' and l.date = ${today}::date and l.protein_g is not null
    group by u.id, u.username`);
  return r
    .map((x) => {
      const t = x.weight === null ? null : proteinTarget(x.weight);
      return { username: x.username, value: x.protein, sub: t === null ? undefined : `target ${t} g`, tone: t === null ? undefined : x.protein >= t ? ("good" as const) : ("warn" as const) };
    })
    .sort((a, b) => b.value - a.value || a.username.localeCompare(b.username));
}

/** Average daily protein over days with protein logged in [from, to], highest first. */
export async function proteinPeriod(from: string, to: string): Promise<BoardRow[]> {
  const r = await rows<{ username: string; protein: number; days: number; weight: number | null }>(sql`
    select u.username, avg(d.p)::float8 as protein, count(*)::int as days,
      (select weight_kg::float8 from logs w where w.user_id = u.id and w.weight_kg is not null order by w.date desc, w.id desc limit 1) as weight
    from (select user_id, sum(protein_g) as p from logs
          where kind = 'meal' and protein_g is not null and date between ${from}::date and ${to}::date
          group by user_id, date) d
    join users u on u.id = d.user_id
    group by u.id, u.username`);
  return r
    .map((x) => {
      const t = x.weight === null ? null : proteinTarget(x.weight);
      return { username: x.username, value: Math.round(x.protein), sub: `${x.days} ${x.days === 1 ? "day" : "days"}${t === null ? "" : ` · target ${t} g`}`, tone: t === null ? undefined : x.protein >= t ? ("good" as const) : ("warn" as const) };
    })
    .sort((a, b) => b.value - a.value || a.username.localeCompare(b.username));
}

// ---------- Community trends ----------

export type CommunityDay = {
  date: string;
  avgWeight: number | null;
  avgCaloriesIn: number | null;
  avgCaloriesOut: number | null;
  avgSteps: number | null;
  users: number;
};

export async function communitySeries(from: string, to: string): Promise<CommunityDay[]> {
  const r = await rows<{
    date: string;
    w: number | null;
    cin: number | null;
    cout: number | null;
    steps: number | null;
    users: number;
  }>(sql`
    select e.date::text as date, avg(e.weight_kg)::float8 as w, avg(e.calories_in)::float8 as cin,
           avg(e.steps * coalesce(s.calories_per_step, 0.04))::float8 as cout,
           avg(e.steps)::float8 as steps, count(*)::int as users
    from daily_stats e left join settings s on s.user_id = e.user_id
    where e.date between ${from}::date and ${to}::date
    group by e.date order by e.date`);
  return r.map((x) => ({
    date: x.date,
    avgWeight: x.w,
    avgCaloriesIn: x.cin,
    avgCaloriesOut: x.cout,
    avgSteps: x.steps,
    users: x.users,
  }));
}

// ---------- Distributions, scatter, heatmap ----------

export type UserAvg = { username: string; steps: number | null; calories: number | null; bmi: number | null };

export async function userAverages(from: string, to: string): Promise<UserAvg[]> {
  return rows<UserAvg>(sql`
    select u.username, avg(e.steps)::float8 as steps, avg(e.calories_in)::float8 as calories,
           avg(${BMI_SQL})::float8 as bmi
    from daily_stats e join users u on u.id = e.user_id
    where e.date between ${from}::date and ${to}::date
    group by u.username`);
}

export type HeatCell = { date: string; logs: number; steps: number | null };

export async function heatmap(from: string, to: string): Promise<HeatCell[]> {
  return rows<HeatCell>(sql`
    select e.date::text as date, count(*)::int as logs, avg(e.steps)::float8 as steps
    from daily_stats e where e.date between ${from}::date and ${to}::date
    group by e.date order by e.date`);
}

// ---------- Extra boards ----------

export type ExtraBoards = {
  streak: BoardRow[];
  improved: BoardRow[];
  bestDay: BoardRow[];
};

export async function extraBoards(today: string): Promise<ExtraBoards> {
  const recentFrom = addDays(today, -6);
  const prevFrom = addDays(today, -13);
  const [streaks, improved, best] = await Promise.all([
    rows<{ username: string; len: number }>(sql`
      with d as (
        select user_id, date, date - (row_number() over (partition by user_id order by date))::int as grp from daily_stats
      )
      select u.username, max(l.len)::int as len from (
        select user_id, count(*) as len from d group by user_id, grp
      ) l join users u on u.id = l.user_id group by u.username order by len desc, u.username limit 10`),
    rows<{ username: string; delta: number }>(sql`
      select u.username,
             (avg(e.steps) filter (where e.date >= ${recentFrom}::date)
              - avg(e.steps) filter (where e.date < ${recentFrom}::date))::float8 as delta
      from daily_stats e join users u on u.id = e.user_id
      where e.date between ${prevFrom}::date and ${today}::date
      group by u.username
      having count(e.steps) filter (where e.date >= ${recentFrom}::date) > 0
         and count(e.steps) filter (where e.date < ${recentFrom}::date) > 0
      order by delta desc limit 10`),
    rows<{ username: string; steps: number; date: string }>(sql`
      select * from (
        select distinct on (e.user_id) u.username, e.steps::int as steps, e.date::text as date
        from daily_stats e join users u on u.id = e.user_id
        where e.steps is not null
        order by e.user_id, e.steps desc, e.date desc
      ) b order by steps desc limit 10`),
  ]);
  return {
    streak: streaks.map((s) => ({ username: s.username, value: s.len })),
    improved: improved.filter((i) => i.delta > 0).map((i) => ({ username: i.username, value: i.delta })),
    bestDay: best.map((b) => ({ username: b.username, value: b.steps, sub: b.date })),
  };
}

// ---------- Per-user ----------

export type DayStat = {
  date: string;
  weightKg: number | null;
  heightCm: number | null;
  caloriesIn: number | null;
  steps: number | null;
};

export async function userEntries(userId: number): Promise<DayStat[]> {
  return rows<DayStat>(sql`
    select date::text as date, weight_kg::float8 as "weightKg", height_cm::float8 as "heightCm",
           calories_in::int as "caloriesIn", steps::int as steps
    from daily_stats where user_id = ${userId} order by date`);
}

export type LogRow = {
  id: number;
  date: string;
  kind: "meal" | "steps" | "weight" | "gym" | "lift";
  calories: number | null;
  steps: number | null;
  weightKg: number | null;
  heightCm: number | null;
  exercise: string | null;
  liftKg: number | null;
  reps: number | null;
  source: string;
  note: string | null;
};

export async function recentLogs(userId: number): Promise<LogRow[]> {
  return rows<LogRow>(sql`
    select id, date::text as date, kind, calories, steps, weight_kg::float8 as "weightKg",
           height_cm::float8 as "heightCm", exercise, lift_kg::float8 as "liftKg", reps, source, note
    from logs where user_id = ${userId} order by date desc, id desc limit 30`);
}

export type Standing = { steps: number | null; bmi: number | null; calories: number | null };

/** Share of today's loggers the user is at or ahead of, per board (100 = top). */
export function standing(day: DayRow[], username: string): Standing | null {
  const me = day.find((d) => d.username === username);
  if (!me) return null;
  const closer = (xs: number[], mine: number) => percentile(-mine, xs.map((x) => -x));
  const nn = <T,>(xs: (T | null)[]) => xs.filter((x): x is T => x !== null);
  return {
    steps: me.steps === null ? null : percentile(me.steps, nn(day.map((d) => d.steps))),
    bmi: me.bmi === null ? null : closer(nn(day.map((d) => (d.bmi === null ? null : Math.abs(d.bmi - HEALTHY_BMI)))), Math.abs(me.bmi - HEALTHY_BMI)),
    calories:
      me.calories_in === null
        ? null
        : closer(nn(day.map((d) => (d.calories_in === null ? null : Math.abs(d.calories_in - d.goal)))), Math.abs(me.calories_in - me.goal)),
  };
}

export const weekStart = (today: string) => bucketStart(today, "week");
export const monthStart = (today: string) => bucketStart(today, "month");

export async function hasEntryOn(userId: number, date: string): Promise<boolean> {
  const r = await rows<{ n: number }>(sql`select 1 as n from daily_stats where user_id = ${userId} and date = ${date}::date limit 1`);
  return r.length > 0;
}

export type Meal = { id: number; username: string; caption: string | null; calories: number | null; protein: number | null; source: string | null; createdAt: string; upVotes: number; downVotes: number; upBy: string[]; myVote: number; swappedBy: string | null; photoV: number; photoCount: number; commentCount: number; commentText: string | null; commentAuthor: string | null };

/** Latest retained meals, newest first. Image bytes are served by /api/meals/[id]. */
export async function recentMeals(viewerId?: number): Promise<Meal[]> {
  return rows<Meal>(sql`
    select m.id, u.username, m.caption, l.calories, l.protein_g as protein, l.source, m.created_at::text as "createdAt",
      v.up as "upVotes", v.down as "downVotes", v.mine as "myVote",
      coalesce((select array_agg(vu.username order by vu.username) from meal_votes mv join users vu on vu.id = mv.user_id where mv.meal_id = m.id and mv.value = 1), '{}') as "upBy",
      eu.username as "swappedBy", coalesce(floor(extract(epoch from m.edited_at) * 1000), 0)::float8 as "photoV",
      ((m.data_b64 is not null)::int + (select count(*)::int from meal_photos mp where mp.meal_id = m.id)) as "photoCount",
      coalesce(c.total, 0)::int as "commentCount", c.text as "commentText", c.username as "commentAuthor"
    from meals m join users u on u.id = m.user_id left join logs l on l.id = m.log_id
    left join users eu on eu.id = m.edited_by and m.original_b64 is not null
    left join lateral (
      select (count(*) filter (where value=1))::int as up,
        (count(*) filter (where value=-1))::int as down,
        coalesce(max(value) filter (where user_id=${viewerId ?? 0}), 0)::int as mine
      from meal_votes where meal_id=m.id
    ) v on true
    left join lateral (
      select c.text, cu.username, count(*) over () as total
      from meal_comments c join users cu on cu.id = c.user_id where c.meal_id = m.id order by c.id desc limit 1
    ) c on true
    order by m.created_at desc limit 60`);
}

// ---------- Steps ----------

type Social = { upVotes: number; downVotes: number; upBy: string[]; myVote: number; commentCount: number; commentText: string | null; commentAuthor: string | null };
export type StepPost = Social & { id: number; username: string; steps: number; source: string | null; createdAt: string; bgId: number | null };
export type WeighInPost = Social & { id: number; username: string; weightKg: number; prevKg: number | null; heightCm: number | null; createdAt: string };

/** Votes and latest comment for step and weigh-in cards (both are rows of `logs`). */
const logSocial = (viewerId?: number) => sql`
  v.up as "upVotes", v.down as "downVotes", v.mine as "myVote",
  coalesce((select array_agg(vu.username order by vu.username) from log_votes lv join users vu on vu.id = lv.user_id where lv.log_id = x.id and lv.value = 1), '{}') as "upBy",
  coalesce(c.total, 0)::int as "commentCount", c.text as "commentText", c.username as "commentAuthor"`;
const logSocialJoins = (viewerId?: number) => sql`
  left join lateral (
    select (count(*) filter (where value=1))::int as up, (count(*) filter (where value=-1))::int as down,
      coalesce(max(value) filter (where user_id=${viewerId ?? 0}), 0)::int as mine
    from log_votes where log_id = x.id
  ) v on true
  left join lateral (
    select c.text, cu.username, count(*) over () as total
    from log_comments c join users cu on cu.id = c.user_id where c.log_id = x.id order by c.id desc limit 1
  ) c on true`;

/** Each person's highest step count per day over the last 3 days, as feed cards. */
export async function recentSteps(today: string, viewerId?: number): Promise<StepPost[]> {
  return rows<StepPost>(sql`
    select x.id, x.username, x.steps, x.source, x."createdAt", x."bgId", ${logSocial(viewerId)}
    from (
      select distinct on (l.user_id, l.date) l.id, u.username, l.steps::int as steps, l.source, l.created_at::text as "createdAt",
        (select b.log_id from log_backgrounds b join logs bl on bl.id = b.log_id where bl.user_id = l.user_id and bl.date = l.date order by b.log_id desc limit 1) as "bgId"
      from logs l join users u on u.id = l.user_id
      where l.kind = 'steps' and l.steps > 0 and l.date >= ${addDays(today, -2)}::date
      order by l.user_id, l.date, l.steps desc, l.id desc
    ) x ${logSocialJoins(viewerId)}`);
}

/** Each person's latest weigh-in per day over the last 3 days, with their previous weight for the change. */
export async function recentWeighIns(today: string, viewerId?: number): Promise<WeighInPost[]> {
  return rows<WeighInPost>(sql`
    select x.id, x.username, x."weightKg", x."prevKg", x."heightCm", x."createdAt", ${logSocial(viewerId)}
    from (
      select distinct on (l.user_id, l.date) l.id, u.username, l.weight_kg::float8 as "weightKg", l.height_cm::float8 as "heightCm", l.created_at::text as "createdAt",
        (select p.weight_kg::float8 from logs p where p.user_id = l.user_id and p.weight_kg is not null and (p.date, p.id) < (l.date, l.id) order by p.date desc, p.id desc limit 1) as "prevKg"
      from logs l join users u on u.id = l.user_id
      where l.kind = 'weight' and l.weight_kg is not null and l.date >= ${addDays(today, -2)}::date
      order by l.user_id, l.date, l.id desc
    ) x ${logSocialJoins(viewerId)}`);
}

// ---------- Gym ----------

export type GymBoards = {
  week: BoardRow[];
  streak: BoardRow[];
  improved: BoardRow[];
  /** Best set per person per exercise (last 90 days); the page ranks them overall or within a weight class. */
  lifts: Record<Exercise, LiftScore[]>;
};

export async function gymBoards(today: string): Promise<GymBoards> {
  const thisWeek = bucketStart(today, "week");
  const [week, streak, improved, liftRows] = await Promise.all([
    rows<BoardRow>(sql`
      select u.username, count(distinct l.date)::int as value
      from logs l join users u on u.id = l.user_id
      where l.kind = 'gym' and l.date between ${thisWeek}::date and ${today}::date
      group by u.id, u.username order by value desc, u.username`),
    rows<BoardRow>(sql`
      select u.username, s.visits as value
      from (${gymStreaksSql(today)}) s join users u on u.id = s.user_id
      order by value desc, u.username`),
    rows<BoardRow>(sql`
      select u.username,
        (count(distinct l.date) filter (where l.date >= ${addDays(today, -27)}::date)
         - count(distinct l.date) filter (where l.date < ${addDays(today, -27)}::date))::int as value
      from logs l join users u on u.id = l.user_id
      where l.kind = 'gym' and l.date between ${addDays(today, -55)}::date and ${today}::date
      group by u.id, u.username
      having count(distinct l.date) filter (where l.date < ${addDays(today, -27)}::date) > 0
        and count(distinct l.date) filter (where l.date >= ${addDays(today, -27)}::date)
          > count(distinct l.date) filter (where l.date < ${addDays(today, -27)}::date)
      order by value desc, u.username`),
    // Every lift in the last 90 days with the lifter's latest body weight (people with no weigh-in are left out when ranking).
    rows<{ exercise: string; username: string; liftKg: number; reps: number; bw: number | null }>(sql`
      select l.exercise, u.username, l.lift_kg::float8 as "liftKg", l.reps,
             (select d.weight_kg from daily_stats d where d.user_id = l.user_id and d.weight_kg is not null order by d.date desc limit 1)::float8 as bw
      from logs l join users u on u.id = l.user_id
      where l.kind = 'lift' and l.date >= ${addDays(today, -89)}::date and l.lift_kg is not null and l.reps is not null`),
  ]);
  return { week, streak, improved, lifts: rankLifts(liftRows) };
}

export type GymPost = {
  id: number;
  username: string;
  date: string;
  notes: string | null;
  hasPhoto: boolean;
  photoCount: number;
  photoV: number;
  createdAt: string;
  lifts: { exercise: string; kg: number; reps: number }[];
  upVotes: number;
  downVotes: number;
  upBy: string[];
  myVote: number;
  commentCount: number;
  commentText: string | null;
  commentAuthor: string | null;
};

/** Latest gym blog posts with the lifts logged in each. Photos are served by /api/gym/[id]. */
export async function gymPosts(limit = 30, viewerId?: number): Promise<GymPost[]> {
  return rows<GymPost>(sql`
    select p.id, u.username, p.date::text as date, p.notes, (p.photo_b64 is not null) as "hasPhoto",
           ((p.photo_b64 is not null)::int + (select count(*)::int from gym_post_photos gp where gp.post_id = p.id)) as "photoCount",
           coalesce(floor(extract(epoch from p.edited_at) * 1000), 0)::float8 as "photoV",
           p.created_at::text as "createdAt",
           coalesce((select json_agg(json_build_object('exercise', l.exercise, 'kg', l.lift_kg, 'reps', l.reps) order by l.id)
                     from logs l where l.post_id = p.id), '[]'::json) as lifts,
           v.up as "upVotes", v.down as "downVotes", v.mine as "myVote",
           coalesce((select array_agg(vu.username order by vu.username) from gym_post_votes gv join users vu on vu.id = gv.user_id where gv.post_id = p.id and gv.value = 1), '{}') as "upBy",
           coalesce(c.total, 0)::int as "commentCount", c.text as "commentText", c.username as "commentAuthor"
    from gym_posts p join users u on u.id = p.user_id
    left join lateral (
      select (count(*) filter (where value=1))::int as up,
        (count(*) filter (where value=-1))::int as down,
        coalesce(max(value) filter (where user_id=${viewerId ?? 0}), 0)::int as mine
      from gym_post_votes where post_id=p.id
    ) v on true
    left join lateral (
      select c.text, cu.username, count(*) over () as total
      from gym_post_comments c join users cu on cu.id = c.user_id where c.post_id = p.id order by c.id desc limit 1
    ) c on true
    order by p.created_at desc limit ${limit}`);
}

export type GymWeek = { weekStart: string; days: number };
export type LoggedLift = { date: string; exercise: string; liftKg: number; reps: number };

export async function userGymStreak(userId: number, today: string): Promise<{ visits: number; lastDate: string } | null> {
  const result = await rows<{ visits: number; lastDate: string }>(sql`
    select visits, last_date as "lastDate" from (${gymStreaksSql(today, sql`select user_id, date from logs where kind = 'gym' and user_id = ${userId}`)}) s`);
  return result[0] ?? null;
}

export async function userGymWeeks(userId: number, today: string): Promise<GymWeek[]> {
  return rows<GymWeek>(sql`
    select date_trunc('week', date)::date::text as "weekStart", count(distinct date)::int as days
    from logs where user_id = ${userId} and kind = 'gym' and date between ${addDays(today, -55)}::date and ${today}::date
    group by date_trunc('week', date) order by 1`);
}

export async function userLifts(userId: number, today: string): Promise<LoggedLift[]> {
  return rows<LoggedLift>(sql`
    select date::text as date, exercise, lift_kg::float8 as "liftKg", reps
    from logs where user_id = ${userId} and kind = 'lift' and lift_kg is not null and reps is not null
      and date >= ${addDays(today, -89)}::date
    order by date desc, id desc limit 60`);
}

export async function hasGymCheckIn(userId: number, date: string): Promise<boolean> {
  const r = await rows<{ n: number }>(sql`select 1 as n from logs where user_id = ${userId} and kind = 'gym' and date = ${date}::date limit 1`);
  return r.length > 0;
}

// ---------- Height and weight boards ----------

export type BodyBoards = { height: BoardRow[]; weight: BoardRow[]; bmi: BoardRow[] };

/** Persistent body boards: latest height, and latest weight/BMI from a weigh-in in the last 90 days. */
export async function bodyBoards(today: string): Promise<BodyBoards> {
  const r = await rows<{ username: string; heightCm: number | null; weightKg: number | null; weighedOn: string | null }>(sql`
    select u.username, h.height_cm::float8 as "heightCm", w.weight_kg::float8 as "weightKg", w.date::text as "weighedOn"
    from users u
    left join lateral (
      select height_cm from logs where user_id = u.id and height_cm is not null order by date desc, id desc limit 1
    ) h on true
    left join lateral (
      select weight_kg, date from logs
      where user_id = u.id and weight_kg is not null and date >= ${addDays(today, -89)}::date
      order by date desc, id desc limit 1
    ) w on true`);
  return {
    bmi: r.flatMap((x) => x.weightKg === null || x.heightCm === null || x.heightCm <= 0
      ? [] : [bmiRow(x.username, x.weightKg / (x.heightCm / 100) ** 2)]).sort(byD),
    height: r.flatMap((x) => (x.heightCm === null ? [] : [{ username: x.username, value: x.heightCm }])).sort((a, b) => b.value - a.value || a.username.localeCompare(b.username)),
    weight: r
      .flatMap((x) => (x.weightKg === null ? [] : [{ username: x.username, value: x.weightKg, sub: `${weightClassOf(x.weightKg).label} · weighed ${x.weighedOn}` }]))
      .sort((a, b) => b.value - a.value || a.username.localeCompare(b.username)),
  };
}

/**
 * Today's gym board: everyone who checked in today, ranked by how many gym posts they made today
 * (ties: earliest check-in first). Someone who checked in without posting shows 0 posts.
 */
export async function gymToday(today: string): Promise<BoardRow[]> {
  return rows<BoardRow>(sql`
    select u.username, count(distinct p.id)::int as value
    from logs l
    join users u on u.id = l.user_id
    left join gym_posts p on p.user_id = l.user_id and p.date = l.date
    where l.kind = 'gym' and l.date = ${today}::date
    group by u.id, u.username, l.created_at
    order by value desc, l.created_at asc, u.username`);
}

// ---------- Shop ----------

/** Total spent per person in the shop, in cents (refunds are taken off). Only people who have spent something. */
export async function topSpenders(): Promise<BoardRow[]> {
  return rows<BoardRow>(sql`
    select u.username, (-sum(l.amount_cents) filter (where l.kind in ('purchase', 'refund')))::int as value,
           (count(*) filter (where l.kind = 'purchase')::int)::text || ' purchases' as sub
    from wallet_ledger l join users u on u.id = l.user_id
    group by u.id, u.username
    having coalesce(-sum(l.amount_cents) filter (where l.kind in ('purchase', 'refund')), 0) > 0
    order by value desc, u.username limit 50`);
}

export type ShopTarget = { id: number; username: string };
export type ShopMeal = { id: number; username: string; caption: string | null; createdAt: string };

/** Other people's profiles are available for picture swaps. */
export async function prankablePeople(meId: number): Promise<ShopTarget[]> {
  return rows<ShopTarget>(sql`select id, username from users where id <> ${meId} and username not in ('adilbot', 'bitebro') order by lower(username) limit 200`);
}

export async function prankableMeals(meId: number): Promise<ShopMeal[]> {
  return rows<ShopMeal>(sql`
    select m.id, u.username, m.caption, m.created_at::text as "createdAt"
    from meals m join users u on u.id = m.user_id
    where m.user_id <> ${meId} and m.data_b64 is not null order by m.created_at desc limit 40`);
}

export type LedgerRow = { id: number; amountCents: number; kind: string; item: string | null; note: string | null; createdAt: string };
export async function recentLedger(userId: number): Promise<LedgerRow[]> {
  return rows<LedgerRow>(sql`
    select id, amount_cents as "amountCents", kind, item, note, created_at::text as "createdAt"
    from wallet_ledger where user_id = ${userId} order by id desc limit 8`);
}

export type MyShopState = { hasOwnAvatar: boolean; swappedBy: string | null };
export async function myShopState(userId: number): Promise<MyShopState> {
  const r = await rows<{ own: boolean; swapped: string | null }>(sql`
    select coalesce(a.data_b64 is not null, false) as own, su.username as swapped
    from users u left join avatars a on a.user_id = u.id left join users su on su.id = a.override_by and a.override_b64 is not null
    where u.id = ${userId}`);
  return { hasOwnAvatar: r[0]?.own ?? false, swappedBy: r[0]?.swapped ?? null };
}

export async function tickerInfo(): Promise<{ by: string | null }> {
  const r = await rows<{ value: string }>(sql`select value from site_config where key = 'ticker_by'`);
  return { by: r[0]?.value ?? null };
}
