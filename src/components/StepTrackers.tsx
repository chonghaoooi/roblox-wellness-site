"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { nativeHealthPlatform, syncNativeSteps, trackerEnabledKey, trackerLastSyncKey, trackerStatus } from "@/lib/native-steps";

export function StepTrackers({ userId }: { userId: number }) {
  const [platform, setPlatform] = useState<"checking" | "web" | "ios" | "android">("checking");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<{ steps: number; syncedAt: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void nativeHealthPlatform().then(value => { if (!cancelled) setPlatform(value); }).catch(() => { if (!cancelled) setPlatform("web"); });
    try { setEnabled(localStorage.getItem(trackerEnabledKey(userId)) === "true"); } catch { /* Storage can be unavailable. */ }
    void trackerStatus().then(status => { if (!cancelled) setLatest(status.latest); }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load tracker status."); });
    return () => { cancelled = true; };
  }, [userId]);

  async function connectOrSync() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await syncNativeSteps(!enabled, userId);
      try { localStorage.setItem(trackerEnabledKey(userId), "true"); localStorage.setItem(trackerLastSyncKey(userId), String(Date.now())); } catch { /* Manual sync still works. */ }
      setEnabled(true); setLatest({ steps: result.steps, syncedAt: result.syncedAt });
      setMessage(`Synced ${result.steps.toLocaleString()} steps. Your leaderboard is updated.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't connect. Please try again."); }
    finally { setBusy(false); }
  }
  function disconnect() {
    try { localStorage.removeItem(trackerEnabledKey(userId)); localStorage.removeItem(trackerLastSyncKey(userId)); } catch { /* Still update the UI. */ }
    setEnabled(false); setMessage("Automatic sync is off on this device. Existing logs stay in Recent logs. You can revoke read access in your phone's health settings.");
  }

  return <div className="mx-auto max-w-2xl space-y-5 px-3 py-8 sm:px-4">
    <h1 className="rb-text text-3xl sm:text-4xl">CONNECT YOUR STEPS</h1>
    <p className="panel p-4">Use Apple Health on iPhone or Health Connect on Samsung/Android. Only your daily step total is shared with this app and its public leaderboards.</p>
    <section className="panel space-y-4 p-5" aria-labelledby="health-source">
      <h2 id="health-source" className="font-display text-2xl">{platform === "ios" ? "Apple Health" : platform === "android" ? "Health Connect" : "iPhone & Samsung Health"}</h2>
      {platform === "checking" ? <p role="status">Checking this device…</p> : platform === "web" ? <>
        <p className="font-semibold text-sun">Native app required for automatic step access</p>
        <p>The browser and bookmarked Home Screen website cannot read Apple Health or Health Connect. Open the native phone app to connect.</p>
        <p>For now, you can upload a screenshot of today’s step count from either health app.</p>
        <Link className="btn btn-green" href="/log#steps">Log steps from a screenshot</Link>
      </> : <>
        <p>{enabled ? "Automatic sync is on for this device." : "Connect to grant read-only access to Steps. No weight, heart rate, location or other health data is requested."}</p>
        <button className="btn btn-green w-full" type="button" onClick={connectOrSync} disabled={busy}>{busy ? "Syncing…" : enabled ? "Sync steps now" : "Connect & sync steps"}</button>
        {enabled && <button className="btn btn-purple" type="button" onClick={disconnect} disabled={busy}>Turn off automatic sync</button>}
        <p className="text-sm text-white/80">After connecting, steps refresh when you open or return to the app, and every five minutes while it is visible. It does not sync while the app is closed.</p>
      </>}
      {latest && <p className="neon">Last sync: {latest.steps.toLocaleString()} steps · {new Date(latest.syncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>}
      {error && <p className="err" role="alert">{error}</p>}
      <p role="status" className="text-neon">{message}</p>
    </section>
    <section className="panel space-y-3 p-5" aria-label="Phone setup">
      <h2 className="font-display text-2xl">Set up your phone</h2>
      <p><strong>iPhone:</strong> open the native app, tap Connect and allow Steps in Apple Health. If no data appears, check Health → your profile → Apps → Roblox.</p>
      <p><strong>Samsung:</strong> in Samsung Health, open Settings → Health Connect and allow Steps sharing. Then open the native app and grant read access to Steps.</p>
      <p className="text-sm text-white/80">The daily board uses the site’s day/timezone. Repeated syncs update a single daily counter; they do not add your total again.</p>
      <Link className="text-neon underline" href="/health-privacy">How step data is used</Link>
    </section>
    <Link className="btn btn-blue" href="/">View leaderboards</Link>
  </div>;
}
