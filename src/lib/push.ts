import "server-only";
import { createHash } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { after } from "next/server";
import webpush from "web-push";
import { requireDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getAppName } from "./site-config";
import { deliverPush, type PushTarget } from "./push-delivery";
import { activityMessage, PUSH_DEVICE_COOKIE, type ActivityKind, type PushMessage } from "./push-validation";

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;
export const pushConfigured = () => Boolean(pushPublicKey() && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
export const endpointHash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

export async function currentPushDevice(userId: number) {
  const id = (await cookies()).get(PUSH_DEVICE_COOKIE)?.value;
  if (!id || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return null;
  const [row] = await requireDb().select().from(pushSubscriptions).where(and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.userId, userId))).limit(1);
  return row ?? null;
}

export async function removeCurrentPushDevice(userId: number) {
  const row = await currentPushDevice(userId);
  if (row) await requireDb().delete(pushSubscriptions).where(and(eq(pushSubscriptions.id, row.id), eq(pushSubscriptions.userId, userId)));
  (await cookies()).delete(PUSH_DEVICE_COOKIE);
}

export async function sendPush(target: PushTarget, message: PushMessage) {
  if (!pushConfigured()) throw new Error("Push is not configured");
  return webpush.sendNotification(target, JSON.stringify(message), {
    TTL: 24 * 60 * 60,
    urgency: "normal",
    timeout: 5000,
    vapidDetails: { subject: process.env.VAPID_SUBJECT!, publicKey: process.env.VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! },
  });
}

export function notifyActivity(actor: { id: number; username: string }, kind: ActivityKind, entityId: number, isGymPost = false) {
  if (!pushConfigured()) return;
  after(async () => {
    try {
      const message = activityMessage(actor.username, kind, entityId, isGymPost, await getAppName());
      const db = requireDb();
      const rows = await db.select().from(pushSubscriptions).where(and(
        ne(pushSubscriptions.userId, actor.id), eq(pushSubscriptions[kind], true), eq(pushSubscriptions.publicKey, process.env.VAPID_PUBLIC_KEY!),
      ));
      const result = await deliverPush(rows.map(row => ({ id: row.id, endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } })), message, {
        send: sendPush,
        removeExpired: id => db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id)),
      });
      console.info("[push] activity delivery", { kind, ...result });
    } catch { console.error("[push] Could not complete activity delivery"); }
  });
}
