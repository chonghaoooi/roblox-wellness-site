import { CommunityTrends, Distribution, PersonalCharts, StepsVsCalories, YouVsEveryone, type CommDay, type UserDay } from "@/components/Charts";
import { Leaderboard } from "@/components/Leaderboard";
import { Heatmap, ListBoard, PeriodTable, Percentiles, SummaryTiles } from "@/components/Sections";
import { EmptyState, LinkButton, SectionTitle, fmt } from "@/components/ui";
import { IconPlus, IconUserPlus } from "@/components/icons";
import { getSettings, getUser } from "@/lib/auth";
import { HEALTHY_BMI, derive, groupByPeriod, kgToLb, summarize } from "@/lib/calc";
import { addDays, todayStr } from "@/lib/dates";
import {
  communitySeries,
  extraBoards,
  heatmap,
  monthStart,
  periodBoards,
  standing,
  todayRows,
  userAverages,
  userEntries,
  weekStart,
} from "@/lib/queries";

export const metadata = { title: "Trends" };

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const f1 = (n: number) => n.toFixed(1);
const f0 = (n: number) => fmt(n);

export default async function TrendsPage() {
  const today = todayStr();
  const user = await getUser();
  const [dayRows, week, month, comm, avgs, heat, extras] = await Promise.all([
    todayRows(today),
    periodBoards(weekStart(today), today),
    periodBoards(monthStart(today), today),
    communitySeries(addDays(today, -179), today),
    userAverages(addDays(today, -29), today),
    heatmap(addDays(weekStart(today), -77), today),
    extraBoards(today),
  ]);
  const me = user?.username;

  // Personal data
  const settings = user ? await getSettings(user.id) : null;
  const mine = user ? await userEntries(user.id) : [];
  const derived = settings ? mine.map((e) => derive(e, settings)) : [];
  const wf = settings?.weightUnit === "lb" ? kgToLb : (x: number) => x;
  const wUnit = settings?.weightUnit === "lb" ? "lb" : "kg";
  const userDays: UserDay[] = derived.slice(-180).map((e) => ({ date: e.date, weight: e.weightKg === null ? null : wf(e.weightKg), calIn: e.caloriesIn, calOut: e.caloriesOut, steps: e.steps }));
  const commDays: CommDay[] = comm.map((c) => ({ date: c.date, cWeight: c.avgWeight === null ? null : wf(c.avgWeight), cCalIn: c.avgCaloriesIn, cCalOut: c.avgCaloriesOut, cSteps: c.avgSteps }));
  const trend90 = commDays.filter((c) => c.date > addDays(today, -90));
  const loggedToday = derived.some((e) => e.date === today);
  const pos = me ? standing(dayRows, me) : null;
  const myAvg = avgs.find((a) => a.username === me);
  const summary = settings && derived.length ? summarize(derived, settings) : null;

  return (
    <>
      {/* ---------- Weekly and monthly ---------- */}
      <section className="wall py-12" aria-label="Weekly and monthly leaderboards">
        <div className="mx-auto max-w-[110rem] space-y-12 px-4" style={{ ["--row" as string]: "4rem" }}>
          {[
            { key: "week", label: "This week", sub: "Weeks start on Monday.", b: week },
            { key: "month", label: "This month", sub: "Resets on the 1st.", b: month },
          ].map(({ key, label, sub, b }) => (
            <div key={key}>
              <SectionTitle sub={sub}>{label.toUpperCase()}</SectionTitle>
              <div className="grid items-start gap-8 lg:grid-cols-3">
                <Leaderboard id={`${key}-cal`} title="CALORIES" icon="taco" rows={b.calories} format={f0} me={me} compact emptyText={`Nobody has logged ${label.toLowerCase()}.`} rule="Average calories closest to goal." />
                <Leaderboard id={`${key}-steps`} title="STEPS" icon="sneaker" rows={b.steps} format={f0} me={me} compact emptyText={`Nobody has logged ${label.toLowerCase()}.`} rule="Total steps." />
                <Leaderboard id={`${key}-bmi`} title="BMI" icon="scale" rows={b.bmi} format={f1} me={me} compact emptyText={`Nobody has logged ${label.toLowerCase()}.`} rule={`Average BMI closest to ${HEALTHY_BMI}.`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Community trends ---------- */}
      <section className="sky py-12" aria-label="Community trends">
        <div className="mx-auto max-w-[110rem] px-4">
          <SectionTitle sub="Everyone's average per day.">COMMUNITY TRENDS</SectionTitle>
          <CommunityTrends days={trend90} />
        </div>
      </section>

      {/* ---------- You vs everyone ---------- */}
      <section className="py-12" aria-label="You versus everyone">
        <div className="mx-auto max-w-[110rem] space-y-8 px-4">
          <SectionTitle sub={user ? `Signed in as ${user.username}` : undefined}>YOU VS EVERYONE</SectionTitle>
          {!user ? (
            <EmptyState>
              <span className="mb-3 block">Sign up to see your own line against the community.</span>
              <LinkButton href="/signup" color="purple" icon={<IconUserPlus />}>Sign up</LinkButton>
            </EmptyState>
          ) : (
            <>
              <Percentiles standing={pos} hasLoggedToday={loggedToday} />
              {derived.length === 0 ? (
                <EmptyState>
                  <span className="mb-3 block">You haven&apos;t logged anything yet.</span>
                  <LinkButton href="/log" color="green" icon={<IconPlus />}>Log your first day</LinkButton>
                </EmptyState>
              ) : (
                <>
                  <YouVsEveryone user={userDays} comm={commDays} />
                  {summary && settings && <SummaryTiles s={summary} wUnit={wUnit} calGoal={settings.calorieGoal} stepGoal={settings.stepGoal} />}
                  <PersonalCharts user={userDays} comm={commDays} weightUnit={wUnit} />
                  <div className="grid gap-6 xl:grid-cols-2">
                    <PeriodTable title="Weekly summary" wUnit={wUnit} rows={groupByPeriod(derived, "week").map((r) => ({ ...r, avgWeight: r.avgWeight === null ? null : wf(r.avgWeight) }))} label={(s) => `Week of ${s}`} />
                    <PeriodTable title="Monthly summary" wUnit={wUnit} rows={groupByPeriod(derived, "month").map((r) => ({ ...r, avgWeight: r.avgWeight === null ? null : wf(r.avgWeight) }))} label={(s) => s.slice(0, 7)} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* ---------- Distributions ---------- */}
      <section className="wall py-12" aria-label="Distributions and activity">
        <div className="mx-auto max-w-[110rem] space-y-8 px-4">
          <SectionTitle sub="Based on everyone's last 30 days.">THE BIG PICTURE</SectionTitle>
          <div className="grid gap-6 lg:grid-cols-2">
            <Distribution title="Steps distribution" values={avgs.flatMap((a) => (a.steps === null ? [] : [a.steps]))} mine={myAvg?.steps ?? null} bins={10} lo={0} hi={20000} caption="People by average daily steps. Your bar is green." />
            <Distribution title="BMI distribution" values={avgs.flatMap((a) => (a.bmi === null ? [] : [a.bmi]))} mine={myAvg?.bmi ?? null} bins={10} lo={14} hi={44} caption={`People by average BMI. Healthy target: ${HEALTHY_BMI}.`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Heatmap cells={heat} today={today} />
            <StepsVsCalories dots={avgs.flatMap((a) => (a.steps === null || a.calories === null ? [] : [{ username: a.username, steps: a.steps, calories: a.calories }]))} me={me} />
          </div>
        </div>
      </section>

      {/* ---------- Extra boards ---------- */}
      <section className="py-12" aria-label="Extra leaderboards">
        <div className="mx-auto max-w-[110rem] space-y-6 px-4">
          <SectionTitle>HALL OF FAME</SectionTitle>
          <div className="grid gap-6 lg:grid-cols-3">
            <ListBoard title="Longest streak" rows={extras.streak} format={(r) => `${r.value} d`} empty="No streaks yet. Log two days in a row!" me={me} />
            <ListBoard title="Most improved" rows={extras.improved} format={(r) => `+${fmt(r.value)}`} empty="Needs a week of logs to compare steps." me={me} />
            <ListBoard title="Best day ever" rows={extras.bestDay} format={(r) => `${fmt(r.value)}`} empty="No days logged yet." me={me} />
          </div>
          <p className="panel inline-block px-4 py-2 text-sm">Most improved = biggest jump in average daily steps, last 7 days vs the 7 before.</p>
        </div>
      </section>
    </>
  );
}
