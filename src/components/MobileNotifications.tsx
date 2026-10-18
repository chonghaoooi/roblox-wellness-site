"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SNOOZE_KEY, SNOOZE_MS } from "@/lib/notification-prompt";
import { defaultPushPreferences, pushCategories, type PushPreferences } from "@/lib/push-shared";
import { IconBell } from "./icons";

type Status = { configured: boolean; publicKey: string | null; active: boolean; endpointHash: string | null; preferences: PushPreferences };
async function api(body?: object) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/push", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: controller.signal } : { cache: "no-store", signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || "Couldn't save notification settings."), { expired: data.expired === true });
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The connection timed out. Check your internet connection and try again.");
    throw error;
  } finally { clearTimeout(timer); }
}
function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Please try again.";
  return /push service|registration failed/i.test(message)
    ? "This browser couldn't connect to its push service. Check your connection and use an updated Chrome on Android, or the installed Home Screen app on iPhone, then try again."
    : message;
}
function applicationKey(value: string) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function worker() {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  if (registration.active) return registration;
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Notifications took too long to start. Reload and try again.")), 15000);
    })]);
  } finally { clearTimeout(timer!); }
}

export function MobileNotifications({ next }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"checking" | "ready" | "ios-install" | "unsupported">("checking");
  const [status, setStatus] = useState<Status | null>(null);
  const [preferences, setPreferences] = useState<PushPreferences>(defaultPushPreferences);
  const [active, setActive] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (ios && !standalone) { setMode("ios-install"); return; }
    if (!isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setMode("unsupported"); return; }
    setMode("ready");
    setPermission(Notification.permission);
    (async () => {
      try {
        const [data, registration] = await Promise.all([api() as Promise<Status>, worker()]);
        const subscription = await registration.pushManager.getSubscription();
        const matches = Boolean(subscription && data.active && await hash(subscription.endpoint) === data.endpointHash);
        if (!cancelled) { setStatus(data); setPreferences(data.preferences); setActive(matches && Notification.permission === "granted"); }
      } catch (e) { if (!cancelled) setError(errorMessage(e)); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function run(task: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await task(); }
    catch (e) { if ((e as { expired?: boolean })?.expired) setActive(false); setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  function enable() {
    // Ask immediately within the tap gesture; iOS rejects permission requests made later.
    const requested = Notification.requestPermission();
    void run(async () => {
      const allowed = await requested;
      setPermission(allowed);
      if (allowed !== "granted") throw new Error("Notifications weren't allowed. You can enable them in your browser or phone notification settings.");
      const registration = await worker();
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const key = subscription.options.applicationServerKey;
        const expected = applicationKey(status!.publicKey!);
        if (!key || new Uint8Array(key).some((byte, i) => byte !== expected[i]) || key.byteLength !== expected.byteLength) {
          await subscription.unsubscribe(); subscription = null;
        }
      }
      if (!subscription) {
        let timer: ReturnType<typeof setTimeout>;
        try {
          subscription = await Promise.race([
            registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(status!.publicKey!) }),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("The push service took too long to respond. Check your connection and try again.")), 20000); }),
          ]);
        } finally { clearTimeout(timer!); }
      }
      await api({ action: "subscribe", subscription: subscription.toJSON(), preferences });
      setActive(true); setMessage("Notifications are on for this device. Send a test below to check delivery.");
    });
  }

  return <section className="panel mx-auto max-w-xl space-y-5 p-5" aria-labelledby="mobile-alerts">
    <h1 id="mobile-alerts" className="rb-text flex items-center gap-3 text-3xl"><IconBell />Mobile notifications</h1>
    <p>Get phone alerts when someone else logs or posts, plus reminders to log your meals, hit the gym and log your steps. Choose what you want on this device.</p>
    {mode === "checking" && <p role="status">Checking your phone...</p>}
    {mode === "ios-install" && <div className="rounded-xl border-2 border-sun bg-black/40 p-4">
      <p className="font-display text-xl text-sun">On iPhone, open the Home Screen app first.</p>
      <ol className="mt-2 list-inside list-decimal space-y-2"><li>Open this site in Safari.</li><li>Share → Add to Home Screen → Open as Web App → Add.</li><li>Open the +1lean icon, log in, and tap the bell.</li><li>Tap Enable notifications and allow them.</li></ol>
      <p className="mt-3 text-sm">Requires iOS/iPadOS 16.4 or newer. An ordinary Safari tab cannot receive these alerts.</p>
    </div>}
    {mode === "unsupported" && <p className="rounded-xl border-2 border-sun p-3 text-sun">Push notifications aren't available in this browser. On Android, open the site directly in an updated Chrome browser.</p>}
    {mode === "ready" && <>
      <p className="font-display text-xl text-neon" role="status">{active ? "On for this device" : "Off for this device"}</p>
      {permission === "denied" && <p className="err">Notifications are blocked. Allow them in your browser's site settings or your phone's notification settings, then reload this page.</p>}
      <fieldset disabled={busy} className="space-y-2"><legend className="mb-2 font-display text-xl">Notify me about</legend>
        {pushCategories.map(category => <label key={category.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-black/30 px-3 py-2">
          <input type="checkbox" checked={preferences[category.key]} onChange={e => setPreferences(previous => ({ ...previous, [category.key]: e.target.checked }))} className="size-5 accent-lime" />{category.label}
        </label>)}
      </fieldset>
      {!status ? <p className="text-sm">Loading notification settings...</p> : !status.configured ? <p className="text-sun">Mobile notifications are being set up. Try again shortly.</p> : <div className="flex flex-wrap gap-3">
        {!active ? <button type="button" onClick={enable} disabled={busy || permission === "denied"} className="btn btn-green"><IconBell />{busy ? "Enabling..." : "Enable notifications"}</button> : <>
          <button type="button" disabled={busy} className="btn btn-green" onClick={() => void run(async () => { await api({ action: "preferences", preferences }); setMessage("Your notification choices are saved for this device."); })}>Save choices</button>
          <button type="button" disabled={busy} className="btn btn-blue" onClick={() => void run(async () => { const result = await api({ action: "test" }); setMessage(result.message); })}>Send test</button>
          <button type="button" disabled={busy} className="btn btn-red" onClick={() => void run(async () => {
            await api({ action: "unsubscribe" }); setActive(false);
            try { await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription().then(sub => sub?.unsubscribe()); } catch { /* Server subscription is already removed. */ }
            setMessage("Notifications are off for this device.");
          })}>Turn off</button>
        </>}
      </div>}
      <p className="text-sm text-white/80">Alerts can arrive while the site is closed. Your phone's Focus, Do Not Disturb and notification settings still apply. Logging out turns off alerts on this browser.</p>
    </>}
    {error && <p role="alert" className="err">{error}</p>}
    {message && <p role="status" className="text-neon">{message}</p>}
    {next && <div className="flex flex-wrap items-center gap-3 border-t-2 border-white/15 pt-4">
      {active
        ? <button type="button" className="btn btn-green" onClick={() => router.push(next)}>Continue to the app</button>
        : <>
          <button type="button" className="btn btn-yellow" onClick={() => {
            try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* storage blocked: it will just ask again */ }
            router.push(next);
          }}>Maybe later</button>
          <p className="text-sm text-white/80">We'll ask again tomorrow.</p>
        </>}
    </div>}
    <p className="text-sm text-white/75">Alerts name the activity; they don't include weight values, photos or private notes. You won't receive alerts for your own activity.</p>
  </section>;
}
