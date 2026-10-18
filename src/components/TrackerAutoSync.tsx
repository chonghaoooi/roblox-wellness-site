"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncNativeSteps, trackerEnabledKey, trackerLastSyncKey } from "@/lib/native-steps";

/** Opt-in only. Foreground refresh, not a promise of background delivery. */
export function TrackerAutoSync({ userId }: { userId: number }) {
  const router = useRouter();
  useEffect(() => {
    let running = false;
    let disposed = false;
    async function sync() {
      if (disposed || running || document.visibilityState !== "visible") return;
      try {
        if (localStorage.getItem(trackerEnabledKey(userId)) !== "true") return;
        if (Date.now() - Number(localStorage.getItem(trackerLastSyncKey(userId))) < 5 * 60_000) return;
        running = true;
        await syncNativeSteps(false, userId);
        if (!disposed) {
          localStorage.setItem(trackerLastSyncKey(userId), String(Date.now()));
          router.refresh();
        }
      } catch {
        // Permission or network errors are shown on /trackers; never interrupt browsing.
      } finally { running = false; }
    }
    void sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    const timer = window.setInterval(sync, 5 * 60_000);
    return () => { disposed = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", sync); window.removeEventListener("focus", sync); };
  }, [userId, router]);
  return null;
}
