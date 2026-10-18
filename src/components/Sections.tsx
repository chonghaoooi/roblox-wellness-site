import { type HeatCell } from "@/lib/queries";
import { type BoardRow } from "@/lib/queries";
import { type PeriodRow, type Summary } from "@/lib/calc";
import { addDays } from "@/lib/dates";
import { bucketStart } from "@/lib/calc";
import { Avatar, EmptyState, fmt } from "./ui";

export function ListBoard({ title, rows, format, empty, me }: { title: string; rows: BoardRow[]; format: (r: BoardRow) => string; empty: string; me?: string }) {
  return (
    <section className="panel p-4" aria-label={title}>
      <h3 className="rb-text mb-3 text-2xl">{title}</h3>
      {rows.length === 0 ? (
        <p className="font-display text-lg text-sun">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {rows.slice(0, 5).map((r, i) => (
            <li key={r.username} className="flex items-center gap-3 rounded-lg border-[3px] border-black bg-gradient-to-b from-[#ffb62e] to-[#f08a00] px-3 py-2" aria-current={r.username === me ? "true" : undefined}>
              <span className="rb-text w-6 text-center text-xl">{i + 1}</span>
              <Avatar name={r.username} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg [-webkit-text-stroke:0.18em_#000] [paint-order:stroke_fill]">{r.username}</span>
                {r.sub && <span className="mt-0.5 inline-block max-w-full truncate rounded-md border-2 border-black bg-black px-1.5 text-xs font-bold leading-5 text-sun">{r.sub}</span>}
              </span>
              <span className="lb-value !text-xl">{format(r)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function Heatmap({ cells, today }: { cells: HeatCell[]; today: string }) {
  const weeks = 12;
  const start = addDays(bucketStart(today, "week"), -7 * (weeks - 1));
  const byDate = new Map(cells.map((c) => [c.date, c]));
  const max = Math.max(1, ...cells.map((c) => c.logs));
  const level = (n: number) => (n === 0 ? 0 : Math.min(3, Math.ceil((n / max) * 3)));
  const colors = ["bg-black/50", "bg-[#2f8f1a]", "bg-[#5be12f]", "bg-[#d9ff7a]"];
  const dows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const total = cells.reduce((a, c) => a + c.logs, 0);
  return (
    <figure className="panel p-4">
      <figcaption className="rb-text mb-3 text-2xl">Daily activity</figcaption>
      {total === 0 ? (
        <p className="font-display text-lg text-sun">No logs in the last 12 weeks. Be the first dot of green!</p>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="inline-grid grid-flow-col gap-1" role="img" aria-label={`Heatmap of how many people logged each day over the last ${weeks} weeks. ${total} logs in total.`}>
            {Array.from({ length: weeks }, (_, w) => (
              <div key={w} className="grid gap-1">
                {dows.map((dow, d) => {
                  const date = addDays(start, w * 7 + d);
                  const c = byDate.get(date);
                  const future = date > today;
                  return (
                    <div
                      key={date}
                      title={`${date}: ${c ? `${c.logs} logged, avg ${c.steps === null ? "n/a" : fmt(c.steps)} steps` : "no logs"}`}
                      className={`h-6 w-6 rounded-[5px] border-2 border-black sm:h-7 sm:w-7 ${future ? "opacity-30" : ""} ${colors[level(c?.logs ?? 0)]}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-sm">
        Fewer
        {colors.map((c) => (
          <span key={c} className={`h-4 w-4 rounded border-2 border-black ${c}`} aria-hidden />
        ))}
        More people logging
      </div>
    </figure>
  );
}

function Tile({ label, value, sub, tone = "neon" }: { label: string; value: string; sub?: string; tone?: "neon" | "sun" }) {
  return (
    <div className="panel px-4 py-3">
      <p className="text-sm font-semibold uppercase tracking-wide">{label}</p>
      <p className={`${tone} text-3xl leading-tight`}>{value}</p>
      {sub && <p className="text-sm">{sub}</p>}
    </div>
  );
}

export function SummaryTiles({ s, wUnit, calGoal, stepGoal }: { s: Summary; wUnit: string; calGoal: number; stepGoal: number }) {
  const pct = (x: number | null) => (x === null ? "no data" : `${Math.round(x * 100)}% hit rate`);
  const n = (x: number | null, d = 0, unit = "") => (x === null ? "—" : `${fmt(x, d)}${unit}`);
  const signed = (x: number | null) => (x === null ? "—" : `${x > 0 ? "+" : ""}${fmt(x, 1)} ${wUnit}`);
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      <Tile label="Current weight" value={n(s.currentWeight, 1, ` ${wUnit}`)} />
      <Tile label="Starting weight" value={n(s.startingWeight, 1, ` ${wUnit}`)} />
      <Tile label="Weight change" value={signed(s.weightChange)} tone="sun" />
      <Tile label="Days logged" value={fmt(s.daysLogged)} />
      <Tile label="Avg calories in" value={n(s.avgCaloriesIn)} />
      <Tile label="Avg calories out" value={n(s.avgCaloriesOut)} />
      <Tile label="Avg net calories" value={n(s.avgNet)} tone="sun" />
      <Tile label="Avg steps / day" value={n(s.avgSteps)} />
      <Tile label="Total steps" value={fmt(s.totalSteps)} />
      <Tile label="Best step day" value={n(s.bestStepDay?.steps ?? null)} sub={s.bestStepDay?.date} />
      <Tile label={`Days ≤ ${fmt(calGoal)} kcal`} value={`${s.daysCalorieGoal}`} sub={pct(s.calorieGoalRate)} />
      <Tile label={`Days ≥ ${fmt(stepGoal)} steps`} value={`${s.daysStepGoal}`} sub={pct(s.stepGoalRate)} />
    </div>
  );
}

export function PeriodTable({ title, rows, wUnit, label }: { title: string; rows: PeriodRow[]; wUnit: string; label: (start: string) => string }) {
  const n = (x: number | null, d = 0) => (x === null ? "—" : fmt(x, d));
  return (
    <section className="panel overflow-x-auto p-4" aria-label={title}>
      <h3 className="rb-text mb-3 text-2xl">{title}</h3>
      <table className="w-full min-w-[34rem] text-left">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="font-display text-sun">
            <th scope="col" className="py-1">Period</th>
            <th scope="col">Days</th>
            <th scope="col">Weight ({wUnit})</th>
            <th scope="col">Cal in</th>
            <th scope="col">Cal out</th>
            <th scope="col">Avg steps</th>
            <th scope="col">Total steps</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(-8).reverse().map((r) => (
            <tr key={r.start} className="border-t-2 border-white/20">
              <th scope="row" className="py-1.5 font-semibold">{label(r.start)}</th>
              <td>{r.days}</td>
              <td>{n(r.avgWeight, 1)}</td>
              <td>{n(r.avgCaloriesIn)}</td>
              <td>{n(r.avgCaloriesOut)}</td>
              <td>{n(r.avgSteps)}</td>
              <td>{fmt(r.totalSteps)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Percentiles({ standing, hasLoggedToday }: { standing: { steps: number | null; bmi: number | null; calories: number | null } | null; hasLoggedToday: boolean }) {
  if (!standing || !hasLoggedToday) {
    return (
      <EmptyState className="relative">
        <span className="badge-bang mr-2 align-middle" aria-hidden>!</span>
        Log today to see where you rank against everyone.
      </EmptyState>
    );
  }
  const p = (x: number | null) => (x === null ? "—" : `Top ${Math.max(1, Math.round(100 - x))}%`);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Tile label="Steps today" value={p(standing.steps)} sub={standing.steps === null ? "Not logged today" : `Ahead of ${Math.round(standing.steps)}% of loggers`} />
      <Tile label="BMI today" value={p(standing.bmi)} sub={standing.bmi === null ? "Weigh in to rank" : `Ahead of ${Math.round(standing.bmi)}% of loggers`} />
      <Tile label="Calories today" value={p(standing.calories)} sub={standing.calories === null ? "Not logged today" : `Ahead of ${Math.round(standing.calories)}% of loggers`} />
    </div>
  );
}
