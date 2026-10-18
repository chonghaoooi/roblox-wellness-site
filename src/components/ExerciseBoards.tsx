"use client";

import { useState } from "react";
import { kgToLb } from "@/lib/calc";
import { EXERCISES, type Exercise, type LiftScore, isBodyweight, rankByClass } from "@/lib/lifts";
import type { BoardRow } from "@/lib/queries";
import { WEIGHT_CLASSES, UFC_WEIGHT_CLASS_SOURCE, type WeightClassKey, classRange, weightClassOf } from "@/lib/weight-classes";
import { ListBoard } from "./Sections";

/**
 * One strength board at a time: pick the exercise, then a weight class. "All classes" ranks by strength relative to
 * body weight; a single class ranks by the actual weight lifted (everyone in it weighs about the same).
 */
export function ExerciseBoards({ scores, me, weightUnit }: { scores: Record<Exercise, LiftScore[]>; me?: string; weightUnit: "kg" | "lb" }) {
  const [ex, setEx] = useState<Exercise>("bench");
  const [cls, setCls] = useState<WeightClassKey | "all">("all");
  const exercises = Object.keys(EXERCISES) as Exercise[];
  const w = (kg: number) => Math.round(weightUnit === "lb" ? kgToLb(kg) : kg);

  const ranked = rankByClass(scores[ex], cls);
  const detail = (s: LiftScore) =>
    isBodyweight(ex) ? `${s.reps} ${s.reps === 1 ? "rep" : "reps"}${s.liftKg > 0 ? ` +${w(s.liftKg)} ${weightUnit}` : ""}` : `${s.reps} × ${w(s.liftKg)} ${weightUnit}`;
  const rows: BoardRow[] = ranked.map((s) =>
    cls === "all"
      ? { username: s.username, value: s.value, sub: `${detail(s)} · ${weightClassOf(s.bodyKg).label}` }
      : { username: s.username, value: s.e1rmKg, sub: `${s.value.toFixed(2)}× body weight · ${detail(s)}` },
  );
  const active = WEIGHT_CLASSES.find((c) => c.key === cls);
  const countIn = (key: WeightClassKey) => scores[ex].filter((s) => weightClassOf(s.bodyKg).key === key).length;
  const chip = (selected: boolean) => `btn shrink-0 !min-h-11 !px-4 !py-1 !text-base ${selected ? "btn-yellow" : "btn-blue !brightness-75"}`;

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Exercise" className="hbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {exercises.map((k) => (
          <button key={k} role="radio" aria-checked={k === ex} onClick={() => setEx(k)} className={chip(k === ex)}>
            {EXERCISES[k]}
            {scores[k].length > 0 && <span className="rounded bg-black px-1.5 text-xs text-white [-webkit-text-stroke:0]">{scores[k].length}</span>}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Weight class" className="hbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        <button role="radio" aria-checked={cls === "all"} onClick={() => setCls("all")} className={chip(cls === "all")}>All classes</button>
        {WEIGHT_CLASSES.map((c) => (
          <button key={c.key} role="radio" aria-checked={cls === c.key} onClick={() => setCls(c.key)} className={chip(cls === c.key)} title={classRange(c, weightUnit)}>
            {c.label}
            <span className="rounded bg-black px-1.5 text-xs text-white [-webkit-text-stroke:0]">{countIn(c.key)}</span>
          </button>
        ))}
      </div>

      <p className="panel px-4 py-2 text-xs"><a href={UFC_WEIGHT_CLASS_SOURCE} target="_blank" rel="noreferrer" className="text-neon underline">UFC division limits</a>. Upper limits included; no 1 lb allowance. Kg labels are rounded. Above 265 lb (120.2 kg) appears in All classes only.</p>
      <p className="panel inline-block px-4 py-2 text-sm">
        {active
          ? `${active.label} (${classRange(active, weightUnit)}): ranked by the weight actually lifted.`
          : "All classes: ranked by strength compared to body weight, so lighter lifters can win."}
      </p>

      <div className="max-w-xl">
        <ListBoard
          title={`${EXERCISES[ex]} · ${active ? active.label : "All classes"}`}
          rows={rows}
          format={(r) => (cls === "all" ? `${r.value.toFixed(2)}×` : `${w(r.value)} ${weightUnit}`)}
          empty={active ? `Nobody in ${active.label} has logged ${EXERCISES[ex].toLowerCase()} yet.` : `No ${EXERCISES[ex].toLowerCase()} logged yet. Log your weight, then a set!`}
          me={me}
        />
      </div>
    </div>
  );
}
