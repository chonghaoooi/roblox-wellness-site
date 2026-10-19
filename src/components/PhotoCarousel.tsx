"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A meal's photos as a swipeable strip (native scroll-snap) with dots. `auto` slides right to the last photo, then back
 * left, pausing 3s on each; any swipe or dot tap restarts that wait. One photo renders as a plain image, no dots.
 */
export function PhotoCarousel({ id, count, v, alt, w, auto, contain, start = 0, onIndex, onOpen, className = "" }: {
  id: number; count: number; v: number; alt: string; w?: 240 | 480 | 720; auto?: boolean; contain?: boolean; start?: number;
  onIndex?: (i: number) => void; onOpen?: () => void; className?: string;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const dir = useRef(1);
  const [i, setI] = useState(start);
  const src = (n: number) => `/api/meals/${id}?${n ? `i=${n}&` : ""}${w ? `w=${w}&` : ""}v=${v}`;

  function go(n: number) {
    const el = strip.current;
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  }

  useEffect(() => {
    const el = strip.current;
    if (el && start) el.scrollTo({ left: start * el.clientWidth });
  }, [start]);

  useEffect(() => {
    onIndex?.(i);
    if (!auto || count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => {
      if (i + dir.current > count - 1 || i + dir.current < 0) dir.current *= -1;
      go(i + dir.current);
    }, 3000);
    return () => clearTimeout(t);
  }, [i, auto, count, onIndex]);

  const fit = contain ? "object-contain" : "object-cover";
  return (
    <div className={`relative ${className}`}>
      <div
        ref={strip}
        className="photo-strip h-full w-full"
        onScroll={(e) => { const el = e.currentTarget; const n = Math.round(el.scrollLeft / el.clientWidth); if (n !== i) setI(n); }}
        onClick={onOpen}
        onKeyDown={onOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
        role={onOpen ? "button" : undefined}
        tabIndex={onOpen ? 0 : undefined}
        aria-label={onOpen ? "Open post" : undefined}
      >
        {Array.from({ length: count }, (_, n) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={n} src={src(n)} alt={count > 1 ? `${alt} (photo ${n + 1} of ${count})` : alt} loading={n === 0 && !start ? "eager" : "lazy"} decoding="async" draggable={false} className={`h-full w-full shrink-0 ${fit}`} />
        ))}
      </div>
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1.5" role="group" aria-label="Photos">
          {Array.from({ length: count }, (_, n) => (
            <button key={n} type="button" onClick={(e) => { e.stopPropagation(); go(n); }} aria-label={`Photo ${n + 1} of ${count}`} aria-current={n === i} className="flex size-5 items-center justify-center">
              <span className={`block size-2 rounded-full border border-black/60 ${n === i ? "bg-white" : "bg-white/45"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
