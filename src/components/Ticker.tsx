"use client";

import { useEffect, useState } from "react";

// China trip starts at Singapore midnight on 17 Dec 2026 (UTC+8).
const TRIP_START = Date.parse("2026-12-17T00:00:00+08:00");
const pad = (n: number) => String(n).padStart(2, "0");

export function Ticker() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const s = Math.max(0, Math.floor((TRIP_START - (now ?? TRIP_START)) / 1000));
  const text = now === null ? "" : `${pad(Math.floor(s / 86400))}d ${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  return (
    <div className="overflow-hidden border-b-4 border-black bg-black py-1 text-center font-display text-base text-sun sm:text-lg" role="timer" aria-label="China trip countdown">
      China trip in <span className="tabular-nums">{text || "--d --:--:--"}</span>
    </div>
  );
}
