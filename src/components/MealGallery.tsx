import { deleteMeal } from "@/app/actions";
import { restoreMealPhoto } from "@/app/shop/actions";
import type { Meal } from "@/lib/queries";
import { IconTrash } from "./icons";
import { MealVotes } from "./MealVotes";
import { MealComments } from "./MealComments";
import { Avatar, EmptyState, SectionTitle } from "./ui";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: process.env.APP_TIMEZONE || "UTC" });

export function MealGallery({ meals, me }: { meals: Meal[]; me?: string }) {
  return (
    <section id="meal-gallery" className="sky py-12 scroll-mt-28" aria-label="Meal gallery">
      <div className="mx-auto max-w-[110rem] space-y-6 px-4">
        <SectionTitle>MEAL GALLERY</SectionTitle>
        {meals.length === 0 ? (
          <EmptyState>No meals yet. Snap your lunch and be first!</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {meals.map((m) => (
              <li key={m.id} id={`meal-${m.id}`} className="meal-card panel scroll-mt-36 overflow-hidden !rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/meals/${m.id}`} alt={m.caption ? `${m.username}'s meal: ${m.caption}` : `Meal by ${m.username}`} loading="lazy" className="aspect-square w-full border-b-4 border-black object-cover" />
                <div className="meal-card-details">
                  <div className="flex items-center gap-2">
                    <Avatar name={m.username} size={28} />
                    <span className="min-w-0 flex-1 truncate font-display text-base">{m.username}</span>
                    {m.username === me && (
                      <form action={deleteMeal.bind(null, m.id)}>
                        <button className="inline-flex size-7 items-center justify-center rounded-md text-white/70 hover:bg-red-500/20 hover:text-red-200" aria-label="Delete this meal"><IconTrash /></button>
                      </form>
                    )}
                  </div>
                    <p className="neon flex items-center gap-1.5 text-base leading-5">
                      {m.calories !== null ? `${m.calories.toLocaleString("en-US")} kcal` : ""}
                      {m.source === "ai" && <span className="rounded border-2 border-black bg-sun px-1 font-body text-[0.7rem] font-extrabold leading-4 text-black" title="Estimated by AI from the photo">AI</span>}
                    </p>
                  <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold" title={m.caption ?? undefined}>{m.caption}</p>
                    {m.swappedBy && <><span className="shrink-0 rounded bg-[#7028d4] px-1 text-[10px] leading-5" title={`Photo swapped by ${m.swappedBy}`}>Swapped</span>
                      {m.username === me && (
                        <form action={restoreMealPhoto.bind(null, m.id)}>
                          <button className="rounded bg-sun px-1 text-xs font-extrabold leading-5 text-black" aria-label="Restore my meal photo">↶</button>
                        </form>
                      )}
                    </>}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <time className="min-w-0 truncate text-[10px] leading-6 text-white/75" dateTime={m.createdAt} title={when(m.createdAt)}>{when(m.createdAt)}</time>
                    <MealVotes mealId={m.id} upVotes={m.upVotes} downVotes={m.downVotes} myVote={m.myVote} loggedIn={Boolean(me)} />
                  </div>
                  <MealComments mealId={m.id} owner={m.username} caption={m.caption} count={m.commentCount} text={m.commentText} author={m.commentAuthor} loggedIn={Boolean(me)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
