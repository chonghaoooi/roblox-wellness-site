"use client";

import { useEffect, useState } from "react";

// China trip starts at 5pm Singapore time on 17 Dec 2026 (UTC+8).
const TRIP_START = Date.parse("2026-12-17T17:00:00+08:00");
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (n: number) => n.toLocaleString("en-US");
const CYCLE_MS = 3000;

const Roblox = () => <img src="/icons/roblox-192-v2.png" alt="" className="mx-1 inline-block h-[1.1em] w-[1.1em] rounded-sm align-[-0.15em]" />;

// Cycles by itself every few seconds; tap to jump to the next one.
export function Ticker() {
  const [now, setNow] = useState<number | null>(null);
  const [view, setView] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const s = Math.max(0, Math.floor((TRIP_START - (now ?? TRIP_START)) / 1000));
  const done = now !== null && s === 0;
  const lastDay = now !== null && s > 0 && s < 86400;

  const views: { label: string; icon: React.ReactNode }[] = [
    { icon: "🐼", label: `${Math.floor(s / 86400)}d ${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` },
    { icon: "🚿", label: `${fmt(Math.floor(s / 300))} showers` },
    { icon: <Roblox />, label: `${fmt(Math.floor(s / 300))} Steal an Egg days` },
    { icon: "⛏️", label: `${fmt(Math.floor(s / 1200))} Minecraft days` },
    { icon: "🌌", label: `${fmt(s * 230)} km around the Milky Way` },
    { icon: "👶", label: `${fmt(Math.floor(s * 4.3))} babies born` },
    { icon: "🪦", label: `${fmt(Math.floor(s * 1.8))} people die` },
    { icon: "🩸", label: `${fmt(s * 2400000)} red blood cells made` },
    { icon: "👀", label: `${fmt(Math.floor(s / 4))} blinks` },
  ];
  const v = views[view % views.length];

  // Restarting on every change means a tap also resets the auto-advance timer.
  useEffect(() => {
    const id = setInterval(() => setView((n) => (n + 1) % views.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [view, views.length]);

  return (
    <button
      type="button"
      onClick={() => setView((n) => (n + 1) % views.length)}
      className={`block w-full overflow-hidden border-b-4 border-black bg-black py-1 text-center font-display text-base text-sun sm:text-lg ${lastDay ? "motion-safe:animate-pulse" : ""}`}
      aria-label={done ? "China trip is here" : `China trip countdown: ${now === null ? "loading" : v.label}. Tap for another view.`}
    >
      {done ? (
        <span>🇨🇳 CHINA TRIP TIME!! 🐼🎉🥟</span>
      ) : now === null ? (
        <>🐼 China trip in <span className="tabular-nums">--d --:--:--</span> ✈️</>
      ) : (
        <>China trip in {v.icon} <span className="tabular-nums">{v.label}</span> {lastDay ? "🔥" : "✈️"}</>
      )}
    </button>
  );
}
