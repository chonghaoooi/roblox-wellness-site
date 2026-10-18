import type { ReactNode } from "react";
import { ExerciseBoards } from "./ExerciseBoards";
import { Leaderboard } from "./Leaderboard";
import { SectionTitle, fmt } from "./ui";
import { type BoardRow, type GymBoards } from "@/lib/queries";
import { GYM_STREAK_RULE } from "@/lib/gym-streaks";

/** Gym page order: Check-ins, then the gym blog (passed in as `blog`), then Streak, Steps and Improved. */
export function GymSection({ boards, steps, me, blog, weightUnit }: { boards: GymBoards; steps: BoardRow[]; me?: string; blog: ReactNode; weightUnit: "kg" | "lb" }) {
  const rowVar = { ["--row" as string]: "4rem" };
  return (
    <>
      <section className="pb-4 pt-12" aria-label="Gym check-ins">
        <div className="mx-auto max-w-[110rem] space-y-8 px-3 sm:px-4" style={rowVar}>
          <SectionTitle sub="Today's steps, gym check-ins, streaks and your gym notes.">GYM + STEPS</SectionTitle>
          <div className="mx-auto max-w-xl">
            <Leaderboard id="gym-week" title="CHECK-INS" icon="dumbbell" rows={boards.week} format={(n) => `${n} ${n === 1 ? "day" : "days"}`} me={me} compact emptyText="Nobody has checked in this week." rule="Gym days this week (Mon to today)." />
          </div>
        </div>
      </section>

      {blog}

      <section className="py-12" aria-label="Streak, steps and improvement leaderboards">
        <div className="mx-auto grid max-w-[110rem] items-start gap-8 px-3 sm:px-4 lg:grid-cols-3" style={rowVar}>
          <Leaderboard id="gym-streak" title="STREAK" icon="flame" rows={boards.streak} format={(n) => `${n} ${n === 1 ? "visit" : "visits"}`} me={me} compact emptyText="No active streaks. Check in to start one!" rule={GYM_STREAK_RULE} />
          <Leaderboard id="steps" title="STEPS" icon="sneaker" rows={steps} format={(n) => fmt(n)} me={me} compact emptyText="Nobody has logged steps today." rule="Most steps today ranks first." />
          <Leaderboard id="gym-improved" title="IMPROVED" icon="trophy" rows={boards.improved} format={(n) => `+${n}`} me={me} compact emptyText="Log in both 4-week periods to compare." rule="Extra gym days in the last 4 weeks vs the 4 before." />
        </div>
      </section>

      <section id="best-lifts" className="scroll-mt-36 pb-12" aria-label="Best lifts by weight class">
        <div className="mx-auto max-w-[110rem] space-y-6 px-3 sm:px-4">
          <SectionTitle sub="Pick an exercise and a weight class. Classes use your latest weigh-in from the last 90 days.">BEST LIFTS</SectionTitle>
          <ExerciseBoards scores={boards.lifts} me={me} weightUnit={weightUnit} />
        </div>
      </section>
    </>
  );
}
