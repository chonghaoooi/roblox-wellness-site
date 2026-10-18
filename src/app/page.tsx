import { DailyLeaderboards } from "@/components/DailyLeaderboards";
import { Leaderboard } from "@/components/Leaderboard";
import { IconPlus, IconUserPlus } from "@/components/icons";
import { LinkButton, SectionTitle, fmt } from "@/components/ui";
import { getSettings, getUser } from "@/lib/auth";
import { HEALTHY_BMI, kgToLb } from "@/lib/calc";
import { todayStr } from "@/lib/dates";
import { WEIGHT_CLASSES, classRange } from "@/lib/weight-classes";
import { bodyBoards, gymToday, rankDay, todayRows } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function Home() {
  const today = todayStr();
  const user = await getUser();
  const [dayRows, body, gym, settings] = await Promise.all([
    todayRows(today), bodyBoards(today), gymToday(today), user ? getSettings(user.id) : null,
  ]);
  const boards = rankDay(dayRows);
  const me = user?.username;
  const weightUnit = settings?.weightUnit === "lb" ? "lb" : "kg";
  const weight = weightUnit === "lb" ? kgToLb : (value: number) => value;
  const loggedToday = dayRows.some((row) => row.username === me);

  return (
    <section aria-label="Today's leaderboards" className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
      <SectionTitle>DAILY LEADERBOARDS</SectionTitle>
      <DailyLeaderboards boards={{
        calories: <Leaderboard id="calories" title="CALORIES" icon="taco" rows={boards.calories} format={(n) => fmt(n)} me={me} hideHeading rule="Closest to your own calorie goal ranks first." />,
        gym: <Leaderboard id="gym" title="GYM" icon="dumbbell" rows={gym} format={(n) => (n === 0 ? "checked in" : `${n} ${n === 1 ? "post" : "posts"}`)} me={me} hideHeading emptyText="Nobody has checked in at the gym today." rule="Checked in at the gym today. Ranked by how many gym posts they made today." />,
        height: <Leaderboard id="height" title="HEIGHT" icon="ruler" rows={body.height} format={(n) => `${fmt(n, 0)} cm`} me={me} hideHeading emptyText="Nobody has logged their height yet." rule="Tallest first. Uses each person's latest logged height." />,
        weight: <Leaderboard id="weight" title="WEIGHT" icon="kettlebell" rows={body.weight.map((row) => ({ ...row, value: weight(row.value) }))} format={(n) => `${fmt(n, 1)} ${weightUnit}`} me={me} hideHeading emptyText="Nobody has weighed in lately." rule={`Heaviest first. Latest weigh-in from the last 90 days. UFC classes (upper limits included; kg rounded): ${WEIGHT_CLASSES.map((c) => `${c.label} ${classRange(c, weightUnit)}`).join(" · ")}. Above 265 lb / 120.2 kg: above UFC limit.`} />,
        bmi: <Leaderboard id="bmi" title="BMI" icon="scale" rows={body.bmi} format={(n) => n.toFixed(1)} me={me} hideHeading emptyText="Log your height and weight to join the BMI board." rule={`Closest to a BMI of ${HEALTHY_BMI} ranks first. Uses your latest height and a weigh-in from the last 90 days; it does not reset daily.`} />,
      }} />
      <div className="panel mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-4 px-4 py-3">
        <span className="font-display text-lg">{dayRows.length === 0 ? "Nobody has logged today." : `${dayRows.length} ${dayRows.length === 1 ? "player has" : "players have"} logged today.`}</span>
        {user ? <span className="relative">
          <LinkButton href="/log" color="green" icon={<IconPlus />}>{loggedToday ? "Edit today" : "Log today"}</LinkButton>
          {!loggedToday && <span className="badge-bang absolute -right-2 -top-3" role="img" aria-label="You haven't logged today">!</span>}
        </span> : <LinkButton href="/signup" color="purple" icon={<IconUserPlus />}>Join and log your day</LinkButton>}
      </div>
    </section>
  );
}
