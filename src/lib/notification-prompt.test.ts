import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationsUrl, safeNext, shouldPromptForNotifications, type PromptInput } from "./notification-prompt.ts";

const base: PromptInput = {
  pathname: "/gym", now: 1_000_000, snoozeUntil: 0, native: false, ios: false, standalone: false,
  secure: true, hasServiceWorker: true, hasPushManager: true, hasNotification: true, permission: "default",
};
const ask = (o: Partial<PromptInput> = {}) => shouldPromptForNotifications({ ...base, ...o });

test("prompts on a normal page when notifications could be turned on", () => {
  assert.equal(ask(), true);
  assert.equal(ask({ pathname: "/" }), true);
  assert.equal(ask({ permission: "granted" }), true); // allowed in the browser but not subscribed yet
});

test("never redirects away from the notifications page, sign-in, admin, legal pages or the API", () => {
  for (const pathname of ["/notifications", "/login", "/signup", "/admin", "/admin/users", "/health-privacy", "/api/push"]) {
    assert.equal(ask({ pathname }), false, pathname);
  }
  assert.equal(ask({ pathname: "/notifications-extra" }), true); // only exact path or a sub-path is excluded
});

test("stays quiet when the page could not help", () => {
  assert.equal(ask({ native: true }), false);
  assert.equal(ask({ permission: "denied" }), false);
  assert.equal(ask({ hasPushManager: false }), false);
  assert.equal(ask({ hasServiceWorker: false }), false);
  assert.equal(ask({ hasNotification: false }), false);
  assert.equal(ask({ secure: false }), false);
});

test("iPhone in a Safari tab is sent to the page, which explains Add to Home Screen; the installed app behaves normally", () => {
  assert.equal(ask({ ios: true, standalone: false, hasPushManager: false, hasNotification: false }), true);
  assert.equal(ask({ ios: true, standalone: true }), true);
  assert.equal(ask({ ios: true, standalone: true, permission: "denied" }), false);
});

test("'Maybe later' pauses the prompt until the snooze time passes", () => {
  assert.equal(ask({ snoozeUntil: 1_000_001 }), false);
  assert.equal(ask({ snoozeUntil: 1_000_000 }), true);
  assert.equal(ask({ snoozeUntil: 999_999 }), true);
  assert.equal(ask({ ios: true, snoozeUntil: 5_000_000 }), false);
});

test("the return link can only be a same-site path", () => {
  assert.equal(safeNext("/gym"), "/gym");
  assert.equal(safeNext("/meals#meal-5"), "/meals#meal-5");
  assert.equal(safeNext("/log?x=1#gym"), "/log?x=1#gym");
  for (const bad of ["https://evil.example", "//evil.example", "/" + String.fromCharCode(92) + "evil.example", "javascript:alert(1)", "gym", "", "/a b", "/notifications", "/notifications?next=/", "/api/push", undefined, null, 5, "/" + "a".repeat(400)]) {
    assert.equal(safeNext(bad as never), "/", String(bad));
  }
  assert.equal(notificationsUrl("/gym#h-steps"), "/notifications?next=%2Fgym%23h-steps");
  assert.equal(notificationsUrl("//evil.example"), "/notifications?next=%2F");
});
