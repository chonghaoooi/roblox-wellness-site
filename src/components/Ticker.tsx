"use client";

import { useEffect, useState } from "react";

// China trip starts at 5pm Singapore time on 17 Dec 2026 (UTC+8).
const TRIP_START = Date.parse("2026-12-17T17:00:00+08:00");
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (n: number) => n.toLocaleString("en-US");

// Tap the bar to flip between ways of looking at the same countdown.
const VIEWS = ["clock", "sleeps", "hours", "minutes", "seconds"] as const;

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
  const mode = VIEWS[view];
  const text =
    now === null ? "--d --:--:--"
    : mode === "clock" ? `${pad(Math.floor(s / 86400))}d ${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`
    : mode === "sleeps" ? `${Math.ceil(s / 86400)} sleeps`
    : mode === "hours" ? `${fmt(Math.floor(s / 3600))} hours`
    : mode === "minutes" ? `${fmt(Math.floor(s / 60))} minutes`
    : `${fmt(s)} seconds`;

  return (
    <button
      type="button"
      onClick={() => setView((v) => (v + 1) % VIEWS.length)}
      className={`block w-full overflow-hidden border-b-4 border-black bg-black py-1 text-center font-display text-base text-sun sm:text-lg ${lastDay ? "motion-safe:animate-pulse" : ""}`}
      aria-label={done ? "China trip is here" : `China trip countdown: ${text}. Tap to change the view.`}
    >
      {done ? (
        <span>🇨🇳 CHINA TRIP TIME!! 🐼🎉🥟</span>
      ) : (
        <>🐼 China trip in <span className="tabular-nums">{text}</span> {lastDay ? "🔥" : "✈️"}</>
      )}
    </button>
  );
}
