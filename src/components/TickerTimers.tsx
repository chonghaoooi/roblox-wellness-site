"use client";

import { Fragment, useEffect, useState } from "react";

// China trip starts at 5pm Singapore time on 17 Dec 2026 (UTC+8).
const TRIP_START = Date.parse("2026-12-17T17:00:00+08:00");
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (n: number) => n.toLocaleString("en-US");
const GAP = " ".repeat(10) + "~" + " ".repeat(10);

const Roblox = () => <img src="/icons/roblox-192-v2.png" alt="" className="mx-1 inline-block h-[1.1em] w-[1.1em] rounded-sm align-[-0.15em]" />;

export function TickerTimers({ message }: { message: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const s = Math.max(0, Math.floor((TRIP_START - (now ?? TRIP_START)) / 1000));
  // Timers only exist after mount so server and client markup match.
  const items: { icon?: React.ReactNode; text: string }[] = [];
  if (message) items.push({ text: message });
  if (now !== null) {
    items.push(
      s === 0 ? { icon: "🇨🇳", text: "CHINA TRIP TIME!! 🐼🎉🥟" } : { icon: "🐼", text: `China trip in ${Math.floor(s / 86400)}d ${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` },
      { icon: "🚿", text: `${fmt(Math.floor(s / 300))} showers until China` },
      { icon: <Roblox />, text: `${fmt(Math.floor(s / 300))} Steal an Egg days until China` },
      { icon: "⛏️", text: `${fmt(Math.floor(s / 1200))} Minecraft days until China` },
      { icon: "🌌", text: `${fmt(s * 230)} km around the Milky Way until China` },
      { icon: "👶", text: `${fmt(Math.floor(s * 4.3))} babies born until China` },
      { icon: "🪦", text: `${fmt(Math.floor(s * 1.8))} people die until China` },
      { icon: "🩸", text: `${fmt(s * 2400000)} red blood cells made until China` },
      { icon: "👀", text: `${fmt(Math.floor(s / 4))} blinks until China` },
    );
  }
  if (!items.length) return null;
  const label = items.map((i) => i.text).join(", ");

  return (
    <div className="ticker overflow-hidden border-b-4 border-black bg-black py-1 text-sun" role="marquee" aria-label={label}>
      <div className="ticker-track font-display text-base sm:text-lg" aria-hidden>
        {[0, 1].map((n) => (
          <span key={n} className="ticker-set">
            {items.map((item, i) => (
              <span key={i} className="ticker-message">{item.icon}{item.icon ? " " : ""}{item.text}{GAP}</span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
