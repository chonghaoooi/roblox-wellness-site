import { z } from "zod";
import type { ActivityKind, PushMessage } from "./push-shared";
export { defaultPushPreferences, type PushPreferences, type ActivityKind, type PushMessage } from "./push-shared.ts";

export const PUSH_DEVICE_COOKIE = "push_device";

export function isPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && (!url.port || url.port === "443") &&
      (url.hostname === "fcm.googleapis.com" || url.hostname === "web.push.apple.com" ||
       url.hostname === "updates.push.services.mozilla.com" || url.hostname.endsWith(".notify.windows.com"));
  } catch { return false; }
}

const base64url = /^[A-Za-z0-9_-]+={0,2}$/;
export const pushPreferencesSchema = z.object({ meals: z.boolean(), gym: z.boolean(), steps: z.boolean(), weight: z.boolean(), reminders: z.boolean().default(true), updates: z.boolean().default(true) });
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().min(1).max(2048).refine(isPushEndpoint, "Unsupported push service"),
  keys: z.object({
    p256dh: z.string().regex(base64url).refine(s => Buffer.from(s, "base64url").length === 65 && Buffer.from(s, "base64url")[0] === 4),
    auth: z.string().regex(base64url).refine(s => Buffer.from(s, "base64url").length === 16),
  }),
});
export const pushRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("subscribe"), subscription: pushSubscriptionSchema, preferences: pushPreferencesSchema }),
  z.object({ action: z.literal("preferences"), preferences: pushPreferencesSchema }),
  z.object({ action: z.literal("unsubscribe") }),
  z.object({ action: z.literal("test") }),
]);

export function activityMessage(username: string, kind: ActivityKind, id: number, isGymPost = false, brand = "+1lean"): PushMessage {
  const content = {
    meals: { body: `${username} shared a meal.`, url: `/posts#meal-${id}` },
    gym: { body: isGymPost ? `${username} shared a workout, lifts or gym notes.` : `${username} checked in at the gym.`, url: isGymPost ? `/gym#gym-post-${id}` : "/gym#h-gym-week" },
    steps: { body: `${username} logged their steps.`, url: "/gym#h-steps" },
    weight: { body: `${username} added a weigh-in or height update.`, url: "/#h-weight" },
  }[kind];
  return { title: `${brand} · New activity`, ...content, tag: `${kind}-${isGymPost ? "post-" : ""}${id}` };
}
