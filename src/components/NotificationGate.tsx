"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SNOOZE_KEY, notificationsUrl, shouldPromptForNotifications } from "@/lib/notification-prompt";

/**
 * Rendered only for signed-in people whose device has notifications OFF. The layout is not re-rendered while moving
 * around the app, so this runs once per real page load: opening the app or refreshing the page.
 */
export function NotificationGate() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let snoozeUntil = 0;
    try { snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY)) || 0; } catch { /* storage blocked: just don't snooze */ }
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const go = shouldPromptForNotifications({
      pathname,
      now: Date.now(),
      snoozeUntil,
      native: Boolean(cap?.isNativePlatform?.()),
      ios: /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
      standalone: matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      secure: isSecureContext,
      hasServiceWorker: "serviceWorker" in navigator,
      hasPushManager: "PushManager" in window,
      hasNotification: "Notification" in window,
      permission: "Notification" in window ? Notification.permission : "default",
    });
    if (go) router.replace(notificationsUrl(pathname + window.location.search + window.location.hash));
    // Deliberately once per page load, not on every client-side navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
