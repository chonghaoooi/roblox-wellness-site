"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const metrics = [
  { key: "calories", label: "Calories", icon: "taco" },
  { key: "protein", label: "Protein", icon: "protein" },
  { key: "height", label: "Height", icon: "ruler" },
  { key: "weight", label: "Weight", icon: "kettlebell" },
  { key: "bmi", label: "BMI", icon: "scale" },
] as const;
type Metric = (typeof metrics)[number]["key"];

export function DailyLeaderboards({ boards }: { boards: Record<Metric, ReactNode> }) {
  const [selected, setSelected] = useState<Metric>("calories");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    function followHash() {
      const hash = window.location.hash;
      // Existing shared links and queued notifications should still find their content.
      if (hash === "#meal-gallery" || hash.startsWith("#meal-")) router.replace(`/posts${hash}`);
      else if (hash === "#h-steps") router.replace("/gym#h-steps"); // Steps moved to the Gym + Steps page
      else if (hash === "#gym-blog" || hash.startsWith("#gym-post-") || hash.startsWith("#h-gym-")) router.replace(`/gym${hash}`);
      else {
        const metric = metrics.find(({ key }) => hash === `#h-${key}`);
        if (metric) setSelected(metric.key);
      }
    }
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, [router]);

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % metrics.length
      : event.key === "ArrowLeft" ? (index + metrics.length - 1) % metrics.length
      : event.key === "Home" ? 0 : event.key === "End" ? metrics.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(metrics[next].key);
    tabs.current[next]?.focus();
  }

  return (
    <div className="daily-leaderboards">
      <div className="leaderboard-tabs" role="tablist" aria-label="Daily leaderboard category">
        {metrics.map(({ key, label, icon }, index) => (
          <button key={key} ref={(node) => { tabs.current[index] = node; }} type="button"
            id={`tab-${key}`} role="tab" aria-selected={selected === key} aria-controls={`panel-${key}`}
            tabIndex={selected === key ? 0 : -1} onClick={() => setSelected(key)} onKeyDown={(event) => moveTab(event, index)}>
            <Image src={`/assets/${icon}.svg`} alt="" width={32} height={32} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {metrics.map(({ key }) => (
        <div key={key} id={`panel-${key}`} role="tabpanel" aria-labelledby={`tab-${key}`} hidden={selected !== key} tabIndex={0}>
          {boards[key]}
        </div>
      ))}
    </div>
  );
}
