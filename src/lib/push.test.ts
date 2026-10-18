import assert from "node:assert/strict";
import { createECDH, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { deliverPush, type PushTarget } from "./push-delivery.ts";
import { activityMessage, isPushEndpoint, pushRequestSchema, defaultPushPreferences } from "./push-validation.ts";

test("subscriptions accept browser push services and reject SSRF targets and malformed keys", () => {
  const key = createECDH("prime256v1"); key.generateKeys();
  const body = { action: "subscribe", preferences: defaultPushPreferences, subscription: {
    endpoint: "https://fcm.googleapis.com/fcm/send/test", keys: { p256dh: key.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
  } };
  assert.equal(pushRequestSchema.safeParse(body).success, true);
  assert.equal(isPushEndpoint("https://web.push.apple.com/token"), true);
  for (const endpoint of ["http://fcm.googleapis.com/x", "https://127.0.0.1/x", "https://fcm.googleapis.com.attacker.example/x", "https://fcm.googleapis.com@attacker.example/x", "https://fcm.googleapis.com:8443/x", "file:///etc/passwd"]) {
    assert.equal(pushRequestSchema.safeParse({ ...body, subscription: { ...body.subscription, endpoint } }).success, false, endpoint);
  }
  assert.equal(pushRequestSchema.safeParse({ ...body, subscription: { ...body.subscription, keys: { ...body.subscription.keys, auth: "bad" } } }).success, false);
});

test("notification payloads use local destinations and omit health values and private notes", () => {
  for (const kind of ["meals", "gym", "steps", "weight"] as const) {
    const message = activityMessage("friend", kind, 42);
    assert.equal(message.url.startsWith("/"), true);
    assert.equal(message.body.includes("friend"), true);
    assert.equal(message.body.includes("42"), false);
  }
  assert.notEqual(activityMessage("friend", "gym", 42).tag, activityMessage("friend", "gym", 42, true).tag);
  assert.equal(activityMessage("friend", "gym", 42, true).url, "/gym#gym-post-42");
  assert.equal(activityMessage("friend", "gym", 42).url, "/gym#h-gym-week");
  assert.equal(activityMessage("friend", "meals", 42).url, "/posts#meal-42");
  assert.equal(activityMessage("friend", "steps", 42).url, "/gym#h-steps");
  assert.equal(activityMessage("friend", "weight", 42).url, "/#h-weight");
});

test("delivery retries transient errors, removes expired devices, and continues after permanent errors", async () => {
  const targets = ["ok", "retry", "expired", "forbidden"].map(id => ({ id, endpoint: "https://fcm.googleapis.com/" + id, keys: { p256dh: "test", auth: "test" } }));
  const attempts = new Map<string, number>(); const removed: string[] = [];
  const result = await deliverPush(targets, activityMessage("friend", "steps", 1), {
    send: async target => { const n = (attempts.get(target.id) ?? 0) + 1; attempts.set(target.id, n);
      if (target.id === "retry" && n === 1) throw { statusCode: 503 };
      if (target.id === "expired") throw { statusCode: 410 };
      if (target.id === "forbidden") throw { statusCode: 403 };
    },
    removeExpired: async id => { removed.push(id); }, pause: async () => {},
  });
  assert.deepEqual(result, { attempted: 4, sent: 2, expired: 1, failed: 1 });
  assert.equal(attempts.get("retry"), 2); assert.deepEqual(removed, ["expired"]);
});

test("an expired-device cleanup error does not stop later batches", async () => {
  const targets = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }) as PushTarget);
  const result = await deliverPush(targets, activityMessage("friend", "steps", 1), {
    send: async target => { if (target.id === "0") throw { statusCode: 404 }; },
    removeExpired: async () => { throw new Error("temporary database failure"); },
  });
  assert.equal(result.sent, 11); assert.equal(result.failed, 1);
});

test("the service worker displays push payloads and opens only this app", async () => {
  const handlers: Record<string, (event: any) => void> = {};
  const shown: any[] = [], navigated: string[] = []; let focused = false;
  const self = {
    location: { origin: "https://site.example" }, addEventListener: (name: string, fn: (e: any) => void) => { handlers[name] = fn; },
    registration: { showNotification: async (title: string, options: object) => { shown.push({ title, ...options }); } },
    clients: { matchAll: async () => [{ url: "https://site.example/", navigate: async (url: string) => { navigated.push(url); }, focus: async () => { focused = true; } }], openWindow: async () => { throw new Error("should reuse existing window"); } },
  };
  runInNewContext(await readFile(new URL("../../public/sw.js", import.meta.url), "utf8"), { self, URL });
  let task: Promise<unknown> = Promise.resolve();
  handlers.push({ data: { json: () => activityMessage("friend", "meals", 12) }, waitUntil: (p: Promise<unknown>) => { task = p; } });
  await task; assert.equal(shown[0].body, "friend shared a meal."); assert.equal(shown[0].data.url, "https://site.example/posts#meal-12");
  handlers.notificationclick({ notification: { data: { url: "https://attacker.example/" }, close() {} }, waitUntil: (p: Promise<unknown>) => { task = p; } });
  await task; assert.deepEqual(navigated, ["https://site.example/"]); assert.equal(focused, true);
});
