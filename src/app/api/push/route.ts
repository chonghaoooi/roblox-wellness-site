import { and, eq, lt, or, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { requireDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getAppName } from "@/lib/site-config";
import { currentPushDevice, endpointHash, pushConfigured, pushPublicKey, removeCurrentPushDevice, sendPush } from "@/lib/push";
import { defaultPushPreferences, PUSH_DEVICE_COOKIE, pushRequestSchema } from "@/lib/push-validation";

export const runtime = "nodejs";
const response = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  const user = await getUser();
  if (!user) return response({ error: "Log in to manage notifications." }, 401);
  const row = await currentPushDevice(user.id);
  return response({ configured: pushConfigured(), publicKey: pushPublicKey(), active: Boolean(row && row.publicKey === pushPublicKey()),
    endpointHash: row ? endpointHash(row.endpoint) : null,
    preferences: row ? { meals: row.meals, gym: row.gym, steps: row.steps, weight: row.weight, reminders: row.reminders, updates: row.updates } : defaultPushPreferences });
}

export async function POST(request: Request) {
  // Route handlers need their own CSRF protection; a session cookie alone is insufficient.
  if (request.headers.get("origin") !== new URL(request.url).origin) return response({ error: "Open notifications on this site and try again." }, 403);
  const user = await getUser();
  if (!user) return response({ error: "Log in to manage notifications." }, 401);
  if (Number(request.headers.get("content-length") || 0) > 8192) return response({ error: "Request is too large." }, 413);
  const text = await request.text();
  if (text.length > 8192) return response({ error: "Request is too large." }, 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return response({ error: "Invalid notification settings." }, 400); }
  const input = pushRequestSchema.safeParse(body);
  if (!input.success) return response({ error: "Invalid notification subscription or settings." }, 400);
  const data = input.data;
  const db = requireDb();
  if (data.action === "unsubscribe") {
    await removeCurrentPushDevice(user.id);
    return response({ ok: true });
  }
  if (!pushConfigured()) return response({ error: "Mobile notifications are not configured yet." }, 503);
  if (data.action === "subscribe") {
    const { subscription, preferences } = data;
    const existing = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, subscription.endpoint))).limit(1);
    if (!existing.length) {
      const count = await db.execute(sql`select count(*)::int as n from push_subscriptions where user_id=${user.id}`);
      if (Number(count.rows[0].n) >= 5) return response({ error: "Notifications are already enabled on five devices. Turn them off on an older device first." }, 429);
    }
    const values = { userId: user.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth,
      publicKey: process.env.VAPID_PUBLIC_KEY!, ...preferences, updatedAt: new Date() };
    const [row] = await db.insert(pushSubscriptions).values(values).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values }).returning({ id: pushSubscriptions.id });
    (await cookies()).set(PUSH_DEVICE_COOKIE, row.id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 365 * 86400 });
    return response({ ok: true });
  }
  const row = await currentPushDevice(user.id);
  if (!row || row.publicKey !== pushPublicKey()) return response({ error: "Enable notifications on this device first." }, 404);
  if (data.action === "preferences") {
    await db.update(pushSubscriptions).set({ ...data.preferences, updatedAt: new Date() }).where(and(eq(pushSubscriptions.id, row.id), eq(pushSubscriptions.userId, user.id)));
    return response({ ok: true });
  }
  const [slot] = await db.update(pushSubscriptions).set({ lastTestAt: new Date() }).where(and(eq(pushSubscriptions.id, row.id), eq(pushSubscriptions.userId, user.id),
    or(isNull(pushSubscriptions.lastTestAt), lt(pushSubscriptions.lastTestAt, new Date(Date.now() - 30_000))))).returning({ id: pushSubscriptions.id });
  if (!slot) return response({ error: "Wait 30 seconds before sending another test." }, 429);
  try {
    await sendPush({ id: row.id, endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      { title: `${await getAppName()} · Test notification`, body: "Mobile notifications are enabled on this device.", url: "/notifications", tag: "roblox-test" });
    return response({ ok: true, message: "Test sent. Check your phone's notifications." });
  } catch (error) {
    const status = Number((error as { statusCode?: number })?.statusCode);
    if (status === 404 || status === 410) {
      await removeCurrentPushDevice(user.id);
      return response({ error: "This device subscription expired. Enable notifications again.", expired: true }, 410);
    }
    console.error("[push] Test delivery failed", { status: status || "network" });
    return response({ error: "The push service could not accept the test. Check your connection and try again." }, 502);
  }
}
