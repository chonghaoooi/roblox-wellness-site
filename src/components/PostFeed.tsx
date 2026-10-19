import type { GymPost, Meal, StepPost } from "@/lib/queries";
import { GymCard, MealCard, StepCard } from "./PostCards";
import { EmptyState, SectionTitle } from "./ui";

type Item = { at: string; meal?: Meal; gym?: GymPost; step?: StepPost };

/** Meals, workouts and step counts together, newest first. Workout cards are the same size as meal cards. */
export function PostFeed({ meals, gym, steps = [], me, weightUnit }: { meals: Meal[]; gym: GymPost[]; steps?: StepPost[]; me?: string; weightUnit: "kg" | "lb" }) {
  const items: Item[] = [...meals.map((meal) => ({ at: meal.createdAt, meal })), ...gym.map((g) => ({ at: g.createdAt, gym: g })), ...steps.map((step) => ({ at: step.createdAt, step }))]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, 80);
  return (
    <section id="meal-gallery" className="sky py-12 scroll-mt-28" aria-label="Posts">
      <div className="mx-auto max-w-[110rem] space-y-6 px-4">
        <SectionTitle sub="Meals and workouts from everyone. Vote and comment on any post.">POSTS</SectionTitle>
        {items.length === 0 ? (
          <EmptyState>No posts yet. Snap your lunch or share a workout and be first!</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 items-start gap-4 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((it) => it.meal
              ? <MealCard key={`m${it.meal.id}`} m={it.meal} me={me} />
              : it.step ? <StepCard key={`s${it.step.id}`} s={it.step} />
              : <GymCard key={`g${it.gym!.id}`} post={it.gym!} me={me} weightUnit={weightUnit} compact />)}
          </ul>
        )}
      </div>
    </section>
  );
}
