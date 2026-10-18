// When to send someone to the notifications page, and where to send them back afterwards. Pure, so it can be unit-tested.

export const SNOOZE_KEY = "notification-prompt-snooze-until";
export const SNOOZE_MS = 24 * 60 * 60 * 1000;

/** Pages that must never be redirected away from (the target itself, auth, admin, legal). */
const EXCLUDED = ["/notifications", "/login", "/signup", "/admin", "/health-privacy", "/api"];

export type PromptInput = {
  pathname: string;
  now: number;
  snoozeUntil: number;
  /** Running inside the native app shell, where web push does not exist. */
  native: boolean;
  ios: boolean;
  standalone: boolean;
  secure: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: "default" | "granted" | "denied";
};

/**
 * Called only for signed-in people whose device is NOT subscribed. Returns true when the notifications page should be
 * shown first. It stays quiet where the page could not help (unsupported browsers, native app), where the person has
 * explicitly blocked notifications, and while they have tapped "Maybe later".
 */
export function shouldPromptForNotifications(i: PromptInput): boolean {
  if (EXCLUDED.some((p) => i.pathname === p || i.pathname.startsWith(`${p}/`))) return false;
  if (i.native) return false;
  if (i.snoozeUntil > i.now) return false;
  // iPhone in a normal Safari tab can't receive push, but the page explains Add to Home Screen, which does help.
  if (i.ios && !i.standalone) return true;
  if (!i.secure || !i.hasServiceWorker || !i.hasPushManager || !i.hasNotification) return false;
  return i.permission !== "denied";
}

/** Only same-site paths are allowed as the "go back to" target, never another site, and never the notifications page itself. */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 300) return "/";
  if (!/^\/(?![/\\])[^\s\u0000-\u001f]*$/.test(raw)) return "/";
  if (raw === "/notifications" || raw.startsWith("/notifications?") || raw.startsWith("/notifications/") || raw.startsWith("/api")) return "/";
  return raw;
}

export const notificationsUrl = (from: string) => `/notifications?next=${encodeURIComponent(safeNext(from))}`;
