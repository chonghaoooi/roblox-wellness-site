import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { pushSubscriptions, reminderLog } from "@/db/schema";
import { addDays, todayStr } from "./dates";
import { deliverPush, type PushTarget } from "./push-delivery";
import { pushConfigured, sendPush } from "./push";
import { gymStreaksSql, GYM_STREAK_RESET_DAYS } from "./gym-streaks";
import { getAppName } from "./site-config";
import { MEALS_NEEDED, type ReminderKind, reminderMessage, updateMessage } from "./reminders-shared";

type Eligible = { userId: number; need: number };

const toTarget = (row: typeof pushSubscriptions.$inferSelect): PushTarget => ({ id: row.id, endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } });

/**
 * Who should get this reminder right now. Only people with a notification device that has reminders switched on are
 * considered, so nobody is "claimed" for a reminder they cannot receive.
 */
async function eligible(kind: ReminderKind, today: string): Promise<Eligible[]> {
  const pk = process.env.VAPID_PUBLIC_KEY ?? "";
  const people = sql`(select distinct user_id from push_subscriptions where reminders and public_key = ${pk}) s`;
  const has = (k: string, from = today, to = today) =>
    sql`select 1 from logs l where l.user_id = s.user_id and l.kind = ${k} and l.date between ${from}::date and ${to}::date`;
  let query;
  if (kind === "gym") query = sql`select s.user_id, 1 as need from ${people} where not exists (${has("gym")})`;
  else if (kind === "steps") query = sql`select s.user_id, 1 as need from ${people} where not exists (${has("steps")})`;
  else if (kind === "breakfast" || kind === "lunch" || kind === "dinner") {
    query = sql`select s.user_id, 1 as need from ${people}
      where (select count(*) from logs l where l.user_id = s.user_id and l.kind = 'meal' and l.date = ${today}::date) < ${MEALS_NEEDED[kind]}`;
  } else if (kind === "streak") {
    query = sql`select s.user_id, 1 as need from ${people}
      join (${gymStreaksSql(today)}) g on g.user_id = s.user_id
      where g.last_date::date = ${today}::date - ${GYM_STREAK_RESET_DAYS - 1}::int`;
  } else {
    query = sql`select s.user_id, 1 as need from ${people}
      where exists (select 1 from logs l where l.user_id = s.user_id and l.weight_kg is not null)
        and not exists (select 1 from logs l where l.user_id = s.user_id and l.weight_kg is not null and l.date >= ${addDays(today, -6)}::date)`;
  }
  const res = await requireDb().execute(query);
  return (res.rows as { user_id: number; need: number }[]).map((r) => ({ userId: Number(r.user_id), need: Number(r.need) }));
}

export type ReminderResult = {
  kind: ReminderKind;
  localDate: string;
  eligible: number;
  claimed: number;
  delivery?: { attempted: number; sent: number; expired: number; failed: number };
  wouldNotify?: number[];
  skipped?: string;
};

/**
 * Sends one kind of reminder. Each person is "claimed" in reminder_log first (unique per person, kind and day), so a
 * retried or doubled cron run can never send the same reminder twice. If the push itself then fails, that reminder is
 * lost for the day rather than repeated.
 */
export async function runReminder(kind: ReminderKind, options: { dry?: boolean } = {}): Promise<ReminderResult> {
  const localDate = todayStr();
  const people = await eligible(kind, localDate);
  if (options.dry) return { kind, localDate, eligible: people.length, claimed: 0, wouldNotify: people.map((p) => p.userId) };
  if (!pushConfigured()) return { kind, localDate, eligible: people.length, claimed: 0, skipped: "push is not configured" };
  if (!people.length) return { kind, localDate, eligible: 0, claimed: 0 };

  const db = requireDb();
  const claimedRows = await db.insert(reminderLog).values(people.map((p) => ({ userId: p.userId, kind, localDate }))).onConflictDoNothing().returning({ userId: reminderLog.userId });
  const need = new Map(people.map((p) => [p.userId, p.need]));
  const claimedIds = claimedRows.map((r) => r.userId);
  if (!claimedIds.length) return { kind, localDate, eligible: people.length, claimed: 0 };

  const devices = await db.select().from(pushSubscriptions).where(and(inArray(pushSubscriptions.userId, claimedIds), eq(pushSubscriptions.reminders, true), eq(pushSubscriptions.publicKey, process.env.VAPID_PUBLIC_KEY!)));
  const byNeed = new Map<number, PushTarget[]>();
  for (const d of devices) byNeed.set(need.get(d.userId) ?? 1, [...(byNeed.get(need.get(d.userId) ?? 1) ?? []), toTarget(d)]);
  const delivery = { attempted: 0, sent: 0, expired: 0, failed: 0 };
  const brand = await getAppName();
  for (const [n, targets] of byNeed) {
    const r = await deliverPush(targets, reminderMessage(kind, localDate, n, brand), { send: sendPush, removeExpired: (id) => db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id)) });
    for (const k of Object.keys(delivery) as (keyof typeof delivery)[]) delivery[k] += r[k];
  }
  console.info("[reminders]", { kind, localDate, eligible: people.length, claimed: claimedIds.length, ...delivery });
  return { kind, localDate, eligible: people.length, claimed: claimedIds.length, delivery };
}

/**
 * Sends "App updated!" once per production deployment. The deployment id is stored on first sight, so the many cron runs
 * that follow (and the deploy-time script, which uses the same table row) never announce the same version twice.
 */
export async function announceUpdateIfNew() {
  const id = process.env.VERCEL_DEPLOYMENT_ID;
  if (process.env.VERCEL_ENV !== "production" || !id) return { announced: false, reason: "not a production deployment" };
  if (!pushConfigured()) return { announced: false, reason: "push is not configured" };
  const db = requireDb();
  const claim = await db.execute(sql`
    insert into app_state (key, value) values ('announced_deploy', ${id})
    on conflict (key) do update set value = excluded.value, updated_at = now() where app_state.value <> excluded.value
    returning value`);
  if (!claim.rows.length) return { announced: false, reason: "already announced" };
  const devices = await db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.updates, true), eq(pushSubscriptions.publicKey, process.env.VAPID_PUBLIC_KEY!)));
  const delivery = await deliverPush(devices.map(toTarget), updateMessage(id, await getAppName()), { send: sendPush, removeExpired: (rowId) => db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, rowId)) });
  console.info("[reminders] app updated announcement", delivery);
  return { announced: true, delivery };
}
