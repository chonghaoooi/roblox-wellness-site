"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getProfile, type Profile, type ProfileDay } from "@/app/profile-actions";

/** Wraps a profile picture: tap it to open that person's stats and trends. */
export function ProfileTrigger({ name, children }: { name: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`View ${name}'s profile`} className="inline-flex shrink-0 cursor-pointer rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        {children}
      </button>
      {open && <ProfileModal name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function Spark({ values, color, label }: { values: (number | null)[]; color: string; label: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <p className="text-sm">Not enough {label.toLowerCase()} logged yet.</p>;
  const lo = Math.min(...pts.map((p) => p.v));
  const hi = Math.max(...pts.map((p) => p.v));
  const span = hi - lo || 1;
  const x = (i: number) => 4 + (i / (values.length - 1)) * 292;
  const y = (v: number) => 4 + (1 - (v - lo) / span) * 52;
  return (
    <svg viewBox="0 0 300 60" className="h-16 w-full" role="img" aria-label={`${label}, ${lo} to ${hi}`}>
      <polyline points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r="2.5" fill={color} />)}
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-black/40 p-2 text-center">
      <div className="text-xs">{label}</div>
      <div className="font-display text-xl">{value}</div>
    </div>
  );
}

const n = (v: number | null, unit = "") => (v === null ? "-" : `${v.toLocaleString("en-US")}${unit}`);
const series = (days: ProfileDay[], k: "weight" | "calories" | "steps") => days.map((d) => d[k]);

function ProfileModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    let alive = true;
    getProfile(name).then((r) => alive && setP(r)).catch(() => alive && setP(null));
    return () => { alive = false; };
  }, [name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") (zoom ? setZoom(false) : onClose()); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [zoom, onClose]);

  const pic = `/api/avatar/${encodeURIComponent(name)}`;
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-3" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${name}'s profile`}>
      <div className="panel max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setZoom(true)} aria-label={`View ${name}'s picture larger`} className="relative grid h-16 w-16 shrink-0 cursor-zoom-in place-items-center overflow-hidden rounded-lg border-[3px] border-black bg-[#1d3b8f] font-display text-3xl text-white">
            {name.slice(0, 1).toUpperCase()}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pic} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="rb-text truncate text-2xl">{name}</h2>
            {p?.joined && <p className="text-xs">Joined {p.joined}</p>}
          </div>
          <button type="button" className="btn btn-red !min-h-10 !px-3" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {p === undefined && <p role="status">Loading…</p>}
        {p === null && <p className="err">Couldn&apos;t load this profile.</p>}
        {p && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Weight" value={n(p.weight, ` ${p.weightUnit}`)} />
              <Stat label="BMI" value={n(p.bmi)} />
              <Stat label="Class" value={p.weightClass ?? "-"} />
              <Stat label="Avg steps" value={n(p.avgSteps)} />
              <Stat label="Avg kcal" value={n(p.avgCalories)} />
              <Stat label="Target kcal" value={n(p.calorieGoal)} />
              <Stat label="Avg PRO" value={n(p.avgProtein, " g")} />
              <Stat label="Target PRO" value={n(p.proteinGoal, " g")} />
              <Stat label="Gym days" value={p.gymDays30} />
              <Stat label="Gym streak" value={p.gymStreak} />
              <Stat label="Meals" value={p.meals30} />
              <Stat label="Height" value={n(p.heightCm, " cm")} />
            </div>
            {p.bmiLabel && <p className="text-sm">BMI says <b>{p.bmiLabel}</b>. Averages and counts cover the last 30 days.</p>}
            <section><h3 className="label">Weight ({p.weightUnit}), 30 days</h3><Spark values={series(p.days, "weight")} color="#4fd1ff" label="Weight" /></section>
            <section><h3 className="label">Calories in, 30 days</h3><Spark values={series(p.days, "calories")} color="#ffd23f" label="Calories" /></section>
            <section><h3 className="label">Steps, 30 days</h3><Spark values={series(p.days, "steps")} color="#5dff8a" label="Steps" /></section>
          </>
        )}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[110] grid cursor-zoom-out place-items-center bg-black/95 p-4" onClick={(e) => { e.stopPropagation(); setZoom(false); }} role="dialog" aria-modal="true" aria-label={`${name}'s picture`}>
          <div className="relative grid aspect-square w-[min(90vw,70vh)] place-items-center overflow-hidden rounded-xl border-4 border-black bg-[#1d3b8f] font-display text-[8rem] text-white">
            {name.slice(0, 1).toUpperCase()}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pic} alt={`${name}'s profile picture`} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
