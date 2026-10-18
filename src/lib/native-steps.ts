"use client";

import { totalAggregatedSteps } from "./tracker-shared";

export const trackerEnabledKey = (userId: number) => `health-step-sync:${userId}`;
export const trackerLastSyncKey = (userId: number) => `health-last-sync:${userId}`;

export async function nativeHealthPlatform(): Promise<"ios" | "android" | "web"> {
  const { Capacitor } = await import("@capacitor/core");
  const platform = Capacitor.getPlatform();
  return Capacitor.isNativePlatform() && (platform === "ios" || platform === "android") ? platform : "web";
}

export async function trackerStatus() {
  const response = await fetch("/api/trackers", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(response.status === 401 ? "Log in again to connect a tracker." : "Could not load tracker status. Try again.");
  return response.json() as Promise<{ userId: number; date: string; startDate: string; endDate: string; timeZone: string; latest: { steps: number; source: string; syncedAt: string } | null }>;
}

export async function syncNativeSteps(requestPermission: boolean, userId: number) {
  const platform = await nativeHealthPlatform();
  if (platform === "web") throw new Error("Direct health access needs the native iPhone or Android app. The browser and Home Screen website cannot read your health store.");
  const { Health } = await import("@capgo/capacitor-health");
  const available = await Health.isAvailable();
  if (!available.available) throw new Error(platform === "android" ? "Health Connect is unavailable. Install or update it and let Samsung Health share Steps with Health Connect." : "Apple Health is unavailable on this device.");
  if (requestPermission) await Health.requestAuthorization({ read: ["steps"], write: [] });
  else if (platform === "android") {
    const permissions = await Health.checkAuthorization({ read: ["steps"], write: [] });
    if (!permissions.readAuthorized.includes("steps")) throw new Error("Step access is off. Connect again to grant permission.");
  }
  const day = await trackerStatus();
  if (day.userId !== userId) throw new Error("Your account changed. Open tracker settings and sync again.");
  const { samples } = await Health.queryAggregated({ dataType: "steps", startDate: day.startDate, endDate: day.endDate, bucket: "day", aggregation: "sum" });
  const steps = totalAggregatedSteps(samples);
  const response = await fetch("/api/trackers", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ userId, date: day.date, steps, source: platform === "ios" ? "apple_health" : "health_connect" }),
  });
  const result = await response.json() as { ok?: boolean; error?: string; steps: number; syncedAt: string };
  if (!response.ok) throw new Error(result.error || "Could not save steps. Please try again.");
  return result;
}
