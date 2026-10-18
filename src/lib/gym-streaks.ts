import { sql, type SQL } from "drizzle-orm";

/** Calendar-day gap: Monday to Wednesday continues; Monday to Thursday resets. */
export const GYM_STREAK_RESET_DAYS = 3;
export const GYM_STREAK_RULE = "Check-in days with gaps under 3 days. Mon → Wed continues; Mon → Thu resets. One check-in per day counts.";

/** Current streaks only. All consumers use the same distinct-day, as-of-date calculation. */
export function gymStreaksSql(today: string, source: SQL = sql`select user_id, date from logs where kind = 'gym'`) {
  return sql`
    with gym_days as (
      select distinct user_id, date from (${source}) source where date <= ${today}::date
    ), gaps as (
      select user_id, date, date - lag(date) over (partition by user_id order by date) as gap from gym_days
    ), islands as (
      select user_id, date,
        sum(case when gap is null or gap >= ${GYM_STREAK_RESET_DAYS} then 1 else 0 end)
          over (partition by user_id order by date) as streak_id
      from gaps
    )
    select user_id, count(*)::int as visits, max(date)::text as last_date
    from islands group by user_id, streak_id
    having max(date) > ${today}::date - ${GYM_STREAK_RESET_DAYS}::int`;
}
