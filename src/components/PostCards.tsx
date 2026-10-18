import { deleteMeal, deletePost } from "@/app/actions";
import { restoreMealPhoto } from "@/app/shop/actions";
import { kgToLb } from "@/lib/calc";
import { EXERCISES, isBodyweight, type Exercise } from "@/lib/lifts";
import type { GymPost, Meal } from "@/lib/queries";
import { IconTrash } from "./icons";
import { MealComments } from "./MealComments";
import { MealVotes } from "./MealVotes";
import { Avatar, fmt } from "./ui";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: process.env.APP_TIMEZONE || "UTC" });

export function MealCard({ m, me }: { m: Meal; me?: string }) {
  return (
    <li id={`meal-${m.id}`} className="meal-card panel scroll-mt-36 overflow-hidden !rounded-xl">
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
  );
}

/** A workout post with its photo, notes and lifts. `wide` lets it span several columns in the mixed feed. */
export function GymCard({ post, me, weightUnit, wide = "", compact }: { post: GymPost; me?: string; weightUnit: "kg" | "lb"; wide?: string; compact?: boolean }) {
  if (compact) return <GymCardCompact post={post} me={me} weightUnit={weightUnit} />;
  return (
    <li id={`gym-post-${post.id}`} className={`min-w-0 scroll-mt-36 ${wide}`}>
                <article className="panel overflow-hidden !rounded-xl" aria-label={`Workout by ${post.username} on ${post.date}`}>
                  <div className="flex items-center gap-3 border-b-2 border-black p-4">
                    <Avatar name={post.username} size={36} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-xl">{post.username}</h3>
                      <time dateTime={post.date} className="text-sm text-sun">{post.date}</time>
                    </div>
                    {post.username === me && <form action={deletePost.bind(null, post.id)}><button className="btn btn-red !min-h-10 !px-3 !py-1" aria-label={`Delete your workout post from ${post.date}`}><IconTrash /></button></form>}
                  </div>
                  {post.hasPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/gym/${post.id}`} alt={`Workout shared by ${post.username}`} loading="lazy" className="max-h-96 w-full bg-black/40 object-contain" />
                  )}
                  <div className="space-y-4 p-4">
                    {!post.hasPhoto && !post.notes && post.lifts.length === 0 && <p className="text-sm">This workout photo is no longer available.</p>}
                    {post.notes && <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{post.notes}</p>}
                    {post.lifts.length > 0 && <ul className="space-y-2" aria-label="Lifts in this workout">
                      {post.lifts.map((lift, i) => {
                        const bw = isBodyweight(lift.exercise as Exercise);
                        const load = weightUnit === "lb" ? kgToLb(lift.kg) : lift.kg;
                        return <li key={i} className="rounded-lg border-2 border-white/20 bg-black/40 px-3 py-2">
                          <span className="block font-display">{EXERCISES[lift.exercise as Exercise] ?? lift.exercise}</span>
                          <span className="neon">{bw && lift.kg === 0 ? "Bodyweight" : `${bw ? "+" : ""}${fmt(load, 1)} ${weightUnit}`} × {lift.reps} reps</span>
                        </li>;
                      })}
                    </ul>}
                  </div>
                  <div className="meal-card-details border-t-2 border-black">
                    <div className="flex items-center justify-between gap-1">
                      <time className="min-w-0 truncate text-[10px] leading-6 text-white/75" dateTime={post.createdAt} title={when(post.createdAt)}>{when(post.createdAt)}</time>
                      <MealVotes kind="gym" mealId={post.id} upVotes={post.upVotes} downVotes={post.downVotes} myVote={post.myVote} loggedIn={Boolean(me)} />
                    </div>
                    <MealComments kind="gym" mealId={post.id} owner={post.username} caption={post.notes} count={post.commentCount} text={post.commentText} author={post.commentAuthor} loggedIn={Boolean(me)} />
                  </div>
                </article>
    </li>
  );
}

const liftText = (lift: GymPost["lifts"][number], weightUnit: "kg" | "lb") => {
  const bw = isBodyweight(lift.exercise as Exercise);
  const load = weightUnit === "lb" ? kgToLb(lift.kg) : lift.kg;
  return `${bw && lift.kg === 0 ? "BW" : `${bw ? "+" : ""}${fmt(load, 1)}${weightUnit}`} × ${lift.reps}`;
};

/** Same footprint as a meal card: a square top (photo, or the notes when there is no photo) and a small details area. */
function GymCardCompact({ post, me, weightUnit }: { post: GymPost; me?: string; weightUnit: "kg" | "lb" }) {
  return (
    <li id={`gym-post-${post.id}`} className="meal-card panel scroll-mt-36 overflow-hidden !rounded-xl">
      {post.hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/gym/${post.id}`} alt={`Workout shared by ${post.username}`} loading="lazy" className="aspect-square w-full border-b-4 border-black bg-black/40 object-cover" />
      ) : (
        <div className="aspect-square w-full overflow-y-auto border-b-4 border-black bg-black/30 p-3">
          <p className="mb-1 font-display text-sm text-sun">WORKOUT</p>
          {post.notes ? <p className="whitespace-pre-wrap break-words text-sm leading-snug">{post.notes}</p> : post.lifts.length === 0 && <p className="text-sm">Checked in at the gym.</p>}
        </div>
      )}
      <div className="meal-card-details">
        <div className="flex items-center gap-2">
          <Avatar name={post.username} size={28} />
          <span className="min-w-0 flex-1 truncate font-display text-base">{post.username}</span>
          <span className="shrink-0 rounded bg-[#7028d4] px-1 text-[10px] leading-5">GYM</span>
          {post.username === me && (
            <form action={deletePost.bind(null, post.id)}>
              <button className="inline-flex size-7 items-center justify-center rounded-md text-white/70 hover:bg-red-500/20 hover:text-red-200" aria-label={`Delete your workout post from ${post.date}`}><IconTrash /></button>
            </form>
          )}
        </div>
        {post.lifts.length > 0 && (
          <ul className="max-h-[4.5rem] space-y-0.5 overflow-y-auto pr-1 text-xs leading-4" aria-label="Lifts in this workout">
            {post.lifts.map((lift, i) => (
              <li key={i} className="flex justify-between gap-2"><span className="min-w-0 truncate font-semibold">{EXERCISES[lift.exercise as Exercise] ?? lift.exercise}</span><span className="neon shrink-0">{liftText(lift, weightUnit)}</span></li>
            ))}
          </ul>
        )}
        {post.hasPhoto && post.notes && <p className="line-clamp-2 break-words text-xs font-semibold" title={post.notes}>{post.notes}</p>}
        <div className="flex items-center justify-between gap-1">
          <time className="min-w-0 truncate text-[10px] leading-6 text-white/75" dateTime={post.createdAt} title={when(post.createdAt)}>{when(post.createdAt)}</time>
          <MealVotes kind="gym" mealId={post.id} upVotes={post.upVotes} downVotes={post.downVotes} myVote={post.myVote} loggedIn={Boolean(me)} />
        </div>
        <MealComments kind="gym" mealId={post.id} owner={post.username} caption={post.notes} count={post.commentCount} text={post.commentText} author={post.commentAuthor} loggedIn={Boolean(me)} />
      </div>
    </li>
  );
}
