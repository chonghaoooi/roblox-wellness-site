"use client";

import { type ReactNode, useId, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { type Period, rebucket } from "@/lib/calc";

const C = { me: "#b6ff3b", crowd: "#ffd400", out: "#54b4ff", grid: "rgba(255,255,255,0.18)", text: "#ffffff" };

const axis = { stroke: C.text, tick: { fill: C.text, fontSize: 13, fontWeight: 600 }, tickLine: false } as const;
const tip = {
  contentStyle: { background: "#0b0b12", border: "3px solid #000", borderRadius: 12, color: "#fff", fontWeight: 600 },
  labelStyle: { color: "#ffd400" },
  itemStyle: { color: "#fff" },
} as const;
const short = (d: string) => d.slice(5);

export function Segmented<T extends string | number>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.v)}
          role="radio"
          aria-checked={o.v === value}
          onClick={() => onChange(o.v)}
          className={`btn !min-h-11 !px-4 !py-1 !text-base ${o.v === value ? "btn-yellow" : "btn-blue !brightness-75"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const PERIODS = [
  { v: "day" as const, label: "Day" },
  { v: "week" as const, label: "Week" },
  { v: "month" as const, label: "Month" },
];

export function ChartCard({ title, toggle, children, caption }: { title: string; toggle?: ReactNode; children: ReactNode; caption?: string }) {
  const id = useId();
  return (
    <figure className="panel p-4" aria-labelledby={id}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <figcaption id={id} className="rb-text text-2xl">{title}</figcaption>
        {toggle}
      </div>
      <div className="h-64 w-full sm:h-72">{children}</div>
      {caption && <p className="mt-2 text-sm">{caption}</p>}
    </figure>
  );
}

export function NoData({ children }: { children: ReactNode }) {
  return <div className="grid h-full place-items-center text-center font-display text-xl text-sun">{children}</div>;
}

// ---------- Personal charts with the community average line ----------

export type UserDay = { date: string; weight: number | null; calIn: number | null; calOut: number | null; steps: number | null };
export type CommDay = { date: string; cWeight: number | null; cCalIn: number | null; cCalOut: number | null; cSteps: number | null };

function useMerged(user: UserDay[], comm: CommDay[], period: Period) {
  return useMemo(() => {
    const u = rebucket(user, period, ["weight", "calIn", "calOut", "steps"]);
    const c = rebucket(comm, period, ["cWeight", "cCalIn", "cCalOut", "cSteps"]);
    const map = new Map<string, Record<string, number | string>>();
    for (const r of [...u, ...c]) map.set(String(r.date), { ...map.get(String(r.date)), ...r });
    return [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [user, comm, period]);
}

function Lines({ data, lines, unit }: { data: readonly object[]; lines: { key: string; name: string; color: string; dash?: string; width?: number }[]; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={short} {...axis} minTickGap={24} />
        <YAxis {...axis} domain={["auto", "auto"]} width={52} unit={unit} />
        <Tooltip {...tip} formatter={(v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v)} />
        <Legend wrapperStyle={{ color: "#fff", fontWeight: 600 }} />
        {lines.map((l) => (
          <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={l.width ?? 3.5} strokeDasharray={l.dash} dot={data.length < 20} connectNulls type="monotone" />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PersonalCharts({ user, comm, weightUnit }: { user: UserDay[]; comm: CommDay[]; weightUnit: string }) {
  const [period, setPeriod] = useState<Period>("day");
  const data = useMerged(user, comm, period);
  const toggle = <Segmented value={period} onChange={setPeriod} options={PERIODS} label="Chart period" />;
  const crowd = (key: string, name = "Community avg") => ({ key, name, color: C.crowd, dash: "7 6", width: 3 });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Weight over time" toggle={toggle} caption={`In ${weightUnit}. Dashed yellow = community average.`}>
        <Lines data={data} lines={[{ key: "weight", name: "You", color: C.me }, crowd("cWeight")]} />
      </ChartCard>
      <ChartCard title="Calories in vs out" toggle={toggle} caption="Calories out = steps × calories-per-step. Dashed = community average calories in.">
        <Lines data={data} lines={[{ key: "calIn", name: "In", color: C.me }, { key: "calOut", name: "Out", color: C.out }, crowd("cCalIn", "Community in")]} />
      </ChartCard>
      <div className="lg:col-span-2">
        <ChartCard title="Daily steps" toggle={toggle} caption="Bars are you; the dashed line is the community average.">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={short} {...axis} minTickGap={24} />
              <YAxis {...axis} width={52} />
              <Tooltip {...tip} formatter={(v) => (typeof v === "number" ? Math.round(v).toLocaleString() : v)} />
              <Legend wrapperStyle={{ color: "#fff", fontWeight: 600 }} />
              <Bar dataKey="steps" name="You" fill={C.me} stroke="#000" strokeWidth={2} radius={[5, 5, 0, 0]} />
              <Line dataKey="cSteps" name="Community avg" stroke={C.crowd} strokeWidth={3} strokeDasharray="7 6" dot={false} connectNulls type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ---------- Community trend (7 / 30 / 90 days) ----------

export function CommunityTrends({ days }: { days: CommDay[] }) {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const shown = days.slice(-range);
  const metrics: { key: keyof CommDay; title: string; color: string }[] = [
    { key: "cSteps", title: "Average steps", color: C.me },
    { key: "cCalIn", title: "Average calories in", color: C.crowd },
    { key: "cWeight", title: "Average weight", color: C.out },
  ];
  return (
    <div className="space-y-4">
      <Segmented value={range} onChange={setRange} label="Trend range" options={[{ v: 7, label: "7 days" }, { v: 30, label: "30 days" }, { v: 90, label: "90 days" }]} />
      <div className="grid gap-6 lg:grid-cols-3">
        {metrics.map((m) => (
          <ChartCard key={m.key} title={m.title}>
            {shown.length === 0 ? <NoData>No community data yet</NoData> : <Lines data={shown} lines={[{ key: m.key, name: m.title, color: m.color }]} />}
          </ChartCard>
        ))}
      </div>
    </div>
  );
}

// ---------- You vs everyone ----------

export function YouVsEveryone({ user, comm }: { user: UserDay[]; comm: CommDay[] }) {
  const [period, setPeriod] = useState<Period>("day");
  const cut = (xs: { date: string }[]) => xs.slice(-60);
  const data = useMerged(cut(user) as UserDay[], cut(comm) as CommDay[], period);
  return (
    <ChartCard title="Your steps vs the community" toggle={<Segmented value={period} onChange={setPeriod} options={PERIODS} label="Comparison period" />}>
      {data.length === 0 ? <NoData>Log a day to see your line</NoData> : <Lines data={data} lines={[{ key: "steps", name: "You", color: C.me }, { key: "cSteps", name: "Everyone", color: C.crowd, dash: "7 6", width: 3 }]} />}
    </ChartCard>
  );
}

// ---------- Distribution ----------

function histogram(values: number[], mine: number | null, bins: number, lo: number, hi: number) {
  const w = (hi - lo) / bins;
  const out = Array.from({ length: bins }, (_, i) => ({ label: `${Math.round((lo + i * w) * 10) / 10}`, count: 0, mine: false }));
  const idx = (v: number) => Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w)));
  for (const v of values) out[idx(v)].count++;
  if (mine !== null) out[idx(mine)].mine = true;
  return out;
}

export function Distribution({ title, values, mine, bins, lo, hi, caption }: { title: string; values: number[]; mine: number | null; bins: number; lo: number; hi: number; caption: string }) {
  const data = useMemo(() => histogram(values, mine, bins, lo, hi), [values, mine, bins, lo, hi]);
  return (
    <ChartCard title={title} caption={caption}>
      {values.length === 0 ? (
        <NoData>Nobody to chart yet</NoData>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axis} minTickGap={12} />
            <YAxis allowDecimals={false} {...axis} width={40} />
            <Tooltip {...tip} formatter={(v) => [v, "People"]} labelFormatter={(l) => `From ${l}`} />
            <Bar dataKey="count" name="People" stroke="#000" strokeWidth={2} radius={[5, 5, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.mine ? C.me : C.out} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ---------- Scatter ----------

export type Dot = { username: string; steps: number; calories: number };

export function StepsVsCalories({ dots, me }: { dots: Dot[]; me?: string }) {
  const others = dots.filter((d) => d.username !== me);
  const mine = dots.filter((d) => d.username === me);
  return (
    <ChartCard title="Steps vs calories" caption="Each dot is one person's 30-day average. You are the green star.">
      {dots.length === 0 ? (
        <NoData>No dots yet</NoData>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
            <CartesianGrid stroke={C.grid} />
            <XAxis type="number" dataKey="steps" name="Avg steps" {...axis} />
            <YAxis type="number" dataKey="calories" name="Avg calories" {...axis} width={52} />
            <ZAxis range={[90, 90]} />
            <Tooltip {...tip} cursor={{ strokeDasharray: "4 4" }} formatter={(v) => (typeof v === "number" ? Math.round(v).toLocaleString() : v)} />
            <Scatter name="Everyone" data={others} fill={C.crowd} stroke="#000" />
            {mine.length > 0 && <Scatter name="You" data={mine} fill={C.me} stroke="#000" strokeWidth={3} shape="star" />}
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
