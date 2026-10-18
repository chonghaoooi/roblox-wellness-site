// Reminder definitions. No database or server imports here, so the schedule and wording can be unit-tested.
import type { PushMessage } from "./push-shared";

const DEFAULT_BRAND = "+1lean"; // keep in step with DEFAULT_APP_NAME in shop.ts (this file must stay import-light for the deploy script)

export type ReminderKind = "gym" | "breakfast" | "lunch" | "dinner" | "steps" | "streak" | "weigh";

/**
 * `sgt` is the intended Singapore time and `cron` the matching UTC schedule in vercel.json (Singapore is UTC+8, no daylight
 * saving). The free Vercel plan can fire a job any time within its hour, so "10:00" really means 10:00 to 10:59.
 */
export const REMINDERS: Record<ReminderKind, { sgt: string; cron: string; who: string }> = {
  gym: { sgt: "08:00 daily", cron: "0 0 * * *", who: "no gym check-in yet today" },
  breakfast: { sgt: "10:00 daily", cron: "0 2 * * *", who: "no meal logged yet today" },
  lunch: { sgt: "14:00 daily", cron: "0 6 * * *", who: "fewer than 2 meals logged today" },
  dinner: { sgt: "20:00 daily", cron: "0 12 * * *", who: "fewer than 3 meals logged today" },
  steps: { sgt: "21:00 daily", cron: "0 13 * * *", who: "no steps logged today" },
  streak: { sgt: "18:00 daily", cron: "0 10 * * *", who: "last checked in 2 days ago; their streak resets tomorrow" },
  weigh: { sgt: "09:00 Mondays", cron: "0 1 * * 1", who: "has weighed in before but not in the last 7 days" },
};

export const REMINDER_KINDS = Object.keys(REMINDERS) as ReminderKind[];
export const isReminderKind = (value: unknown): value is ReminderKind => typeof value === "string" && Object.hasOwn(REMINDERS, value);
export const reminderPath = (kind: ReminderKind) => `/api/cron/reminders?kind=${kind}`;

/** Meals logged today needed before each meal reminder is skipped (there is no breakfast/lunch/dinner field). */
export const MEALS_NEEDED = { breakfast: 1, lunch: 2, dinner: 3 } as const;

const copy: Record<ReminderKind, (need: number) => { title: string; body: string; url: string }> = {
  gym: () => ({ title: "Gym time 💪", body: "time to go to the gym?", url: "/log#gym" }),
  breakfast: () => ({ title: "Breakfast 🍳", body: "Morning! Log your breakfast.", url: "/log#meal" }),
  lunch: () => ({ title: "Lunch 🍱", body: "Lunch time. Snap it and log it.", url: "/log#meal" }),
  dinner: () => ({ title: "Dinner 🍜", body: "Dinner time. Don't forget to log your meal.", url: "/log#meal" }),
  steps: () => ({ title: "Steps 👟", body: "Log today's steps before you sleep.", url: "/log#steps" }),
  streak: () => ({
    title: "Streak at risk 🔥",
    body: "Your gym streak resets tomorrow. Check in today to keep it going.",
    url: "/log#gym",
  }),
  weigh: () => ({ title: "Weigh-in ⚖️", body: "Weigh-in day? Log your weight when you can.", url: "/log#weigh-in" }),
};

/** Alerts never contain weights, calories or other health numbers; the streak count is just a number of gym days. */
export function reminderMessage(kind: ReminderKind, localDate: string, need = 1, brand = DEFAULT_BRAND): PushMessage {
  const c = copy[kind](need);
  return { ...c, title: `${brand} · ${c.title}`, tag: `reminder-${kind}-${localDate}` };
}

export const updateMessage = (deploymentId: string, brand = DEFAULT_BRAND): PushMessage => ({
  title: `${brand} · App updated! 🎉`,
  body: "App updated! New stuff just landed. Tap to check it out.",
  url: "/",
  tag: `app-updated-${deploymentId.slice(-8)}`,
});
