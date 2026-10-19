import { deleteMeal, deletePost, editMeal, editWorkout } from "@/app/actions";
import { restoreMealPhoto } from "@/app/shop/actions";
import { bmi as calcBmi, kgToLb } from "@/lib/calc";
import { EXERCISES, isBodyweight, type Exercise } from "@/lib/lifts";
import type { GymPost, Meal, StepPost, WeighInPost } from "@/lib/queries";
import { IconTrash } from "./icons";
import { PostCardShell } from "./PostCardShell";
import { PostOwnerActions } from "./PostOwnerActions";
import { MealComments } from "./MealComments";
import { MealVotes } from "./MealVotes";
import { Avatar, fmt } from "./ui";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: process.env.APP_TIMEZONE || "UTC" });

export function MealCard({ m, me }: { m: Meal; me?: string }) {
  return (
    <PostCardShell domId={`meal-${m.id}`} id={m.id} count={m.photoCount} v={m.photoV} alt={m.caption ? `${m.username}'s meal: ${m.caption}` : `Meal by ${m.username}`} expanded={<MealExpanded m={m} me={me} />}>
                <div className="meal-card-details">
                  <div className="flex items-center gap-2">
                    <Avatar name={m.username} size={28} />
                    <span className="min-w-0 flex-1 truncate font-display text-base">{m.username}</span>
                  </div>
                    <p className="neon flex min-w-0 items-center gap-1 whitespace-nowrap text-[0.95rem] leading-5">
                      <span className="shrink-0">{m.calories !== null ? `${m.calories.toLocaleString("en-US")} kcal` : ""}</span>
                      {m.protein ? <span className="min-w-0 truncate font-body text-[0.7rem] text-white/80" title={`${m.protein} g protein`}>· {m.protein}g PRO</span> : null}
                      {m.source === "ai" && <span className="shrink-0 rounded border-2 border-black bg-sun px-1 font-body text-[0.7rem] font-extrabold leading-4 text-black" title="Estimated by AI from the photo">AI</span>}
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
    </PostCardShell>
  );
}

/** The full post shown when a meal card is opened: nothing truncated, plus votes and comments. */
function MealExpanded({ m, me }: { m: Meal; me?: string }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Avatar name={m.username} size={32} />
        <span className="min-w-0 flex-1 truncate font-display text-lg">{m.username}</span>
        <time className="shrink-0 text-xs text-white/75" dateTime={m.createdAt}>{when(m.createdAt)}</time>
        {m.username === me && <PostOwnerActions mealId={m.id} photoCount={m.photoCount} photoV={m.photoV} deleteAction={deleteMeal.bind(null, m.id)} editAction={editMeal.bind(null, m.id)} caption={m.caption} calories={m.calories} protein={m.protein} />}
      </div>
      <p className="neon flex flex-wrap items-center gap-x-2 text-lg">
        {m.calories !== null && <span>{m.calories.toLocaleString("en-US")} kcal</span>}
        {m.protein ? <span className="font-body text-sm text-white/85">{m.protein}g PRO</span> : null}
        {m.source === "ai" && <span className="rounded border-2 border-black bg-sun px-1 font-body text-[0.7rem] font-extrabold leading-4 text-black" title="Estimated by AI from the photo">AI</span>}
        {m.swappedBy && <span className="rounded bg-[#7028d4] px-1 font-body text-[10px] leading-5 text-white">Swapped by {m.swappedBy}</span>}
      </p>
      {m.caption && <p className="break-words text-base font-semibold">{m.caption}</p>}
      <MealVotes mealId={m.id} upVotes={m.upVotes} downVotes={m.downVotes} myVote={m.myVote} loggedIn={Boolean(me)} />
      <MealComments mealId={m.id} owner={m.username} caption={m.caption} count={m.commentCount} text={m.commentText} author={m.commentAuthor} loggedIn={Boolean(me)} />
    </>
  );
}

/** A workout post with its photo, notes and lifts. `wide` lets it span several columns in the mixed feed. */
export function GymCard({ post, me, weightUnit, wide = "", compact }: { post: GymPost; me?: string; weightUnit: "kg" | "lb"; wide?: string; compact?: boolean }) {
  if (compact) return <GymCardCompact post={post} me={me} weightUnit={weightUnit} />;
  return (
    <PostCardShell kind="gym" domId={`gym-post-${post.id}`} id={post.id} count={post.photoCount} v={post.photoV} alt={`Workout shared by ${post.username}`} photoClassName="h-96" contain className={`min-w-0 ${wide}`} expanded={<GymExpanded post={post} me={me} weightUnit={weightUnit} />} heading={
                  <div className="flex items-center gap-3 border-b-2 border-black p-4">
                    <Avatar name={post.username} size={36} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-xl">{post.username}</h3>
                      <time dateTime={post.date} className="text-sm text-sun">{post.date}</time>
                    </div>
                    {post.username === me && <form action={deletePost.bind(null, post.id)}><button className="btn btn-red !min-h-10 !px-3 !py-1" aria-label={`Delete your workout post from ${post.date}`}><IconTrash /></button></form>}
                  </div>
    }>
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
                  <div className="flex flex-col gap-1 border-t-2 border-black p-2">
                    <div className="flex items-center justify-between gap-1">
                      <time className="min-w-0 truncate text-[10px] leading-6 text-white/75" dateTime={post.createdAt} title={when(post.createdAt)}>{when(post.createdAt)}</time>
                      <MealVotes kind="gym" mealId={post.id} upVotes={post.upVotes} downVotes={post.downVotes} myVote={post.myVote} loggedIn={Boolean(me)} />
                    </div>
                    <MealComments kind="gym" mealId={post.id} owner={post.username} caption={post.notes} count={post.commentCount} text={post.commentText} author={post.commentAuthor} loggedIn={Boolean(me)} />
                  </div>
    </PostCardShell>
  );
}

const liftText = (lift: GymPost["lifts"][number], weightUnit: "kg" | "lb") => {
  const bw = isBodyweight(lift.exercise as Exercise);
  const load = weightUnit === "lb" ? kgToLb(lift.kg) : lift.kg;
  return `${bw && lift.kg === 0 ? "BW" : `${bw ? "+" : ""}${fmt(load, 1)}${weightUnit}`} × ${lift.reps}`;
};

/** Same footprint as a meal card: a square top (photo set, or the notes when there is no photo) and a small details area. */
function GymCardCompact({ post, me, weightUnit }: { post: GymPost; me?: string; weightUnit: "kg" | "lb" }) {
  const alt = `Workout shared by ${post.username}`;
  const notesTop = (
    <div className="aspect-square w-full overflow-y-auto border-b-4 border-black bg-black/30 p-3">
      <p className="mb-1 font-display text-sm text-sun">WORKOUT</p>
      {post.notes ? <p className="whitespace-pre-wrap break-words text-sm leading-snug">{post.notes}</p> : post.lifts.length === 0 && <p className="text-sm">Checked in at the gym.</p>}
    </div>
  );
  return (
    <PostCardShell kind="gym" domId={`gym-post-${post.id}`} id={post.id} count={post.photoCount} v={post.photoV} alt={alt} top={notesTop} expanded={<GymExpanded post={post} me={me} weightUnit={weightUnit} />}>
      <div className="gym-card-details">
        <div className="flex items-center gap-2">
          <Avatar name={post.username} size={28} />
          <span className="min-w-0 flex-1 truncate font-display text-base">{post.username}</span>
          <span className="shrink-0 rounded bg-[#7028d4] px-1 text-[10px] leading-5">GYM</span>
        </div>
        <div className="min-h-0 space-y-0.5 overflow-y-auto pr-1 text-xs leading-4">
          {post.lifts.length > 0 && (
            <ul aria-label="Lifts in this workout">
              {post.lifts.map((lift, i) => (
                <li key={i} className="flex justify-between gap-2"><span className="min-w-0 truncate font-semibold">{EXERCISES[lift.exercise as Exercise] ?? lift.exercise}</span><span className="neon shrink-0">{liftText(lift, weightUnit)}</span></li>
              ))}
            </ul>
          )}
          {post.hasPhoto && post.notes && <p className="break-words font-semibold">{post.notes}</p>}
        </div>
        <div className="flex min-w-0 items-center justify-between gap-1">
          <time className="min-w-0 truncate text-[10px] leading-6 text-white/75" dateTime={post.createdAt} title={when(post.createdAt)}>{when(post.createdAt)}</time>
          <MealVotes kind="gym" mealId={post.id} upVotes={post.upVotes} downVotes={post.downVotes} myVote={post.myVote} loggedIn={Boolean(me)} />
        </div>
        <MealComments kind="gym" mealId={post.id} owner={post.username} caption={post.notes} count={post.commentCount} text={post.commentText} author={post.commentAuthor} loggedIn={Boolean(me)} />
      </div>
    </PostCardShell>
  );
}

/** The full workout shown when a gym card is opened: all notes and lifts, votes, comments, and edit/delete for the owner. */
function GymExpanded({ post, me, weightUnit }: { post: GymPost; me?: string; weightUnit: "kg" | "lb" }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Avatar name={post.username} size={32} />
        <span className="min-w-0 flex-1 truncate font-display text-lg">{post.username}</span>
        <span className="shrink-0 rounded bg-[#7028d4] px-1 text-[10px] leading-5">GYM</span>
        <time className="shrink-0 text-xs text-white/75" dateTime={post.createdAt}>{when(post.createdAt)}</time>
        {post.username === me && <PostOwnerActions kind="gym" mealId={post.id} photoCount={post.photoCount} photoV={post.photoV} deleteAction={deletePost.bind(null, post.id)} editAction={editWorkout.bind(null, post.id)} caption={post.notes} />}
      </div>
      {post.notes && <p className="whitespace-pre-wrap break-words text-base">{post.notes}</p>}
      {post.lifts.length > 0 && (
        <ul className="space-y-1" aria-label="Lifts in this workout">
          {post.lifts.map((lift, i) => (
            <li key={i} className="flex justify-between gap-2 rounded-lg border-2 border-white/20 bg-black/40 px-3 py-1.5"><span className="min-w-0 truncate font-display">{EXERCISES[lift.exercise as Exercise] ?? lift.exercise}</span><span className="neon shrink-0">{liftText(lift, weightUnit)}</span></li>
          ))}
        </ul>
      )}
      <MealVotes kind="gym" mealId={post.id} upVotes={post.upVotes} downVotes={post.downVotes} myVote={post.myVote} loggedIn={Boolean(me)} />
      <MealComments kind="gym" mealId={post.id} owner={post.username} caption={post.notes} count={post.commentCount} text={post.commentText} author={post.commentAuthor} loggedIn={Boolean(me)} />
    </>
  );
}

/** Background scene by local hour (APP_TIMEZONE): morning sun, afternoon sky, sunset, night moon. */
function scene(iso: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: process.env.APP_TIMEZONE || "UTC" }).format(new Date(iso)));
  return h >= 5 && h < 10 ? "morning" : h >= 10 && h < 16 ? "afternoon" : h >= 16 && h < 19 ? "sunset" : "night";
}

/** Step and weigh-in cards: same footprint as the gym card, with votes and comments on the log row. */
function LogCardFrame({ id, username, bg, top, line, createdAt, me, votes, comments }: {
  id: number; username: string; bg?: string; top: React.ReactNode; line: React.ReactNode; createdAt: string; me?: string;
  votes: { up: number; down: number; mine: number }; comments: { count: number; text: string | null; author: string | null };
}) {
  return (
    <li id={`log-${id}`} className="meal-card panel scroll-mt-36 overflow-hidden !rounded-xl">
      <div className="relative aspect-square w-full overflow-hidden border-b-4 border-black bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bg ?? `/assets/scenes/${scene(createdAt)}.svg`} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" />
        {top}
      </div>
      <div className="gym-card-details">
        <div className="flex items-center gap-2">
          <Avatar name={username} size={28} />
          <span className="min-w-0 flex-1 truncate font-display text-base">{username}</span>
        </div>
        <div className="min-h-0 overflow-hidden text-xs leading-4">{line}</div>
        <div className="flex min-w-0 items-center justify-between gap-1">
          <time className="min-w-0 truncate text-[10px] leading-6 text-white/75" dateTime={createdAt} title={when(createdAt)}>{when(createdAt)}</time>
          <MealVotes kind="log" mealId={id} upVotes={votes.up} downVotes={votes.down} myVote={votes.mine} loggedIn={Boolean(me)} />
        </div>
        <MealComments kind="log" mealId={id} owner={username} caption={null} count={comments.count} text={comments.text} author={comments.author} loggedIn={Boolean(me)} />
      </div>
    </li>
  );
}

/** A day's step count. */
export function StepCard({ s, me }: { s: StepPost; me?: string }) {
  return (
    <LogCardFrame id={s.id} username={s.username} bg={s.bgId ? `/api/logs/${s.bgId}/background?w=480` : undefined} me={me} createdAt={s.createdAt}
      votes={{ up: s.upVotes, down: s.downVotes, mine: s.myVote }} comments={{ count: s.commentCount, text: s.commentText, author: s.commentAuthor }}
      top={<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2.5 pt-8 text-left [text-shadow:0_1px_3px_rgb(0_0_0/0.7)]">
        <p className="neon font-display text-2xl leading-none">{s.steps.toLocaleString("en-US")}</p>
        <p className="font-display text-xs leading-4 text-white">STEPS</p>
      </div>}
      line={<p className="font-semibold">{s.steps.toLocaleString("en-US")} steps logged</p>} />
  );
}

/** A weigh-in: weight in the viewer's unit, change since the previous weigh-in, and BMI when height is known. */
export function WeighInCard({ w, me, weightUnit }: { w: WeighInPost; me?: string; weightUnit: "kg" | "lb" }) {
  const show = (kg: number) => fmt(weightUnit === "lb" ? kgToLb(kg) : kg, 1);
  const delta = w.prevKg === null ? null : (weightUnit === "lb" ? kgToLb(w.weightKg) - kgToLb(w.prevKg) : w.weightKg - w.prevKg);
  const change = delta === null ? "First weigh-in" : Math.abs(delta) < 0.05 ? "No change" : `${delta < 0 ? "▼" : "▲"} ${fmt(Math.abs(delta), 1)} ${weightUnit}`;
  const bmi = w.heightCm ? calcBmi(w.weightKg, w.heightCm) : null;
  return (
    <LogCardFrame id={w.id} username={w.username} me={me} createdAt={w.createdAt}
      votes={{ up: w.upVotes, down: w.downVotes, mine: w.myVote }} comments={{ count: w.commentCount, text: w.commentText, author: w.commentAuthor }}
      top={<div className="absolute inset-y-0 right-0 flex w-3/5 flex-col items-end justify-center gap-0.5 bg-gradient-to-l from-black/55 to-transparent p-3 text-right [text-shadow:0_1px_3px_rgb(0_0_0/0.7)]">
        <p className="neon font-display text-3xl leading-none">{show(w.weightKg)}<span className="ml-1 text-base">{weightUnit}</span></p>
        <p className="font-display text-xs leading-4 text-white">WEIGH-IN</p>
        <p className="font-display text-xs leading-4 text-sun">{change}</p>
      </div>}
      line={<p className="font-semibold">{bmi === null ? change : `BMI ${fmt(bmi, 1)} · ${change}`}</p>} />
  );
}
