import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteLogButton, WorkoutForm, MealForm, StepsForm, WeighInForm } from "@/components/forms";
import { fmt } from "@/components/ui";
import { LogNav } from "@/components/LogNav";
import { aiEnabled } from "@/lib/ai";
import { getSettings, getUser } from "@/lib/auth";
import { kgToLb } from "@/lib/calc";
import { todayStr } from "@/lib/dates";
import { type Exercise, isBodyweight } from "@/lib/lifts";
import { EXERCISES } from "@/lib/validation";
import { hasGymCheckIn, recentLogs, userEntries } from "@/lib/queries";

export const metadata = { title: "Log" };
export const maxDuration = 300;

export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const today = todayStr();
  const [s, days, logs, checkedIn] = await Promise.all([getSettings(user.id), userEntries(user.id), recentLogs(user.id), hasGymCheckIn(user.id, today)]);
  const unit = s.weightUnit === "lb" ? "lb" : "kg";
  const w = (kg: number) => (unit === "lb" ? kgToLb(kg) : kg);
  const lastWeight = [...days].reverse().find((d) => d.weightKg !== null)?.weightKg ?? null;
  const lastHeight = [...days].reverse().find((d) => d.heightCm !== null)?.heightCm ?? null;
  const t = days.find((d) => d.date === today);
  const aiOn = aiEnabled;

  const describe = (l: (typeof logs)[number]) =>
    l.kind === "meal"
      ? `Meal · ${fmt(l.calories ?? 0)} kcal${l.source === "ai" ? " (AI)" : ""}${l.note ? ` · ${l.note}` : ""}`
      : l.kind === "gym"
        ? `Gym check-in${l.source === "ai" ? " (photo checked)" : ""}`
        : l.kind === "lift"
          ? `${EXERCISES[l.exercise as keyof typeof EXERCISES] ?? "Lift"} · ${l.liftKg === null || (l.liftKg === 0 && isBodyweight(l.exercise as Exercise)) ? "bodyweight" : `${isBodyweight(l.exercise as Exercise) ? "+" : ""}${fmt(w(l.liftKg), 1)} ${unit}`} × ${l.reps ?? "?"}`
      : l.kind === "steps"
        ? `Steps · ${fmt(l.steps ?? 0)}${l.source === "ai" ? " (from screenshot)" : ""}`
        : `Weigh-in · ${[l.weightKg !== null && `${fmt(w(l.weightKg), 1)} ${unit}`, l.heightCm !== null && `${fmt(l.heightCm, 0)} cm`].filter(Boolean).join(" · ")}`;

  return (
    <div className="log-page mx-auto grid max-w-4xl items-start gap-6 px-3 py-6 sm:px-4 sm:py-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <LogNav />
      <div className="min-w-0 space-y-6">
      <section className="panel mx-auto max-w-lg p-5" aria-label="Today so far">
        <h1 className="rb-text text-2xl sm:text-3xl">Today so far</h1>
        <p className="mt-2 text-lg">
          <span className="neon text-2xl">{fmt(t?.caloriesIn ?? 0)}</span> kcal ·{" "}
          <span className="neon text-2xl">{fmt(t?.steps ?? 0)}</span> steps
        </p>
        <p className="mt-1 text-sm">A new day starts at zero. Log as many meals as you like; the leaderboards update as you add them.</p>
      </section>
      <div id="meal" className="log-anchor" tabIndex={-1}><MealForm today={today} aiOn={aiOn} /></div>
      <div id="steps" className="log-anchor" tabIndex={-1}><StepsForm today={today} aiOn={aiOn} /></div>
      <WorkoutForm today={today} done={checkedIn} weightUnit={unit} />
      <div id="weigh-in" className="log-anchor" tabIndex={-1}><WeighInForm today={today} weightUnit={unit} lastHeight={lastHeight === null ? "" : String(lastHeight)} lastWeight={lastWeight === null ? "" : String(Math.round(w(lastWeight) * 10) / 10)} /></div>
      <section id="log-history" className="log-anchor panel mx-auto max-w-lg p-5" aria-labelledby="recent" tabIndex={-1}>
        <h2 id="recent" className="rb-text mb-3 text-2xl">Recent logs</h2>
        {logs.length === 0 ? (
          <p className="font-display text-lg text-sun">Nothing logged yet. Add your first meal above!</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/50 p-2">
                <span className="neon text-sm">{l.date === today ? "Today" : l.date}</span>
                <span className="min-w-0 flex-1 text-sm">{describe(l)}</span>
                <DeleteLogButton id={l.id} label={describe(l)} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm">
          <Link className="neon underline" href="/">Back to the leaderboards</Link>
        </p>
      </section>
      </div>
    </div>
  );
}
