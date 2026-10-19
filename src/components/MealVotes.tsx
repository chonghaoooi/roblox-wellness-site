"use client";

import Link from "next/link";
import { useActionState } from "react";
import { voteMeal } from "@/app/meal-votes";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};
const button = "inline-flex h-6 min-w-7 items-center justify-center gap-0.5 rounded-md border px-0.5 text-[10px] font-semibold leading-none text-violet-100 transition-colors hover:bg-violet-400/30 disabled:cursor-wait disabled:opacity-50";
const idle = "border-violet-300/50 bg-violet-400/15";
const selected = "border-violet-200 bg-violet-600/60";
const count = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function MealVotes({ mealId, upVotes, downVotes, myVote, loggedIn, kind = "meal" }: { mealId: number; upVotes: number; downVotes: number; myVote: number; loggedIn: boolean; kind?: "meal" | "gym" | "log" }) {
  const [state, action, pending] = useActionState(voteMeal, initial);
  if (!loggedIn) return <div className="flex shrink-0 items-center gap-1" aria-label="Meal votes">
      <Link href="/login" className={`${button} ${idle}`} title="Log in to vote · Free" aria-label={`Log in to give a thumbs up. ${upVotes} votes.`}><span aria-hidden="true" className="text-xs">👍</span>{count.format(upVotes)}</Link>
      <Link href="/login" className={`${button} ${idle}`} title="Log in to vote · Free" aria-label={`Log in to give a thumbs down. ${downVotes} votes.`}><span aria-hidden="true" className="text-xs">👎</span>{count.format(downVotes)}</Link>
  </div>;
  return <form action={action} aria-label={kind === "gym" ? "Vote on this workout" : kind === "log" ? "Vote on this post" : "Vote on this meal"} className="relative flex shrink-0 items-center gap-1">
    <input type="hidden" name="mealId" value={mealId} />
    <input type="hidden" name="kind" value={kind} />
      <button name="vote" value={myVote === 1 ? "clear" : "up"} disabled={pending} aria-pressed={myVote === 1} aria-label={`${myVote === 1 ? "Remove your thumbs up" : "Thumbs up"}. ${upVotes} votes.`} className={`${button} ${myVote === 1 ? selected : idle}`}><span aria-hidden="true" className="text-xs">👍</span>{count.format(upVotes)}</button>
      <button name="vote" value={myVote === -1 ? "clear" : "down"} disabled={pending} aria-pressed={myVote === -1} aria-label={`${myVote === -1 ? "Remove your thumbs down" : "Thumbs down"}. ${downVotes} votes.`} className={`${button} ${myVote === -1 ? selected : idle}`}><span aria-hidden="true" className="text-xs">👎</span>{count.format(downVotes)}</button>
    {state.error && <p role="alert" className="err absolute right-0 bottom-full z-10 mb-1 w-40 rounded-md bg-slate-950 p-2 text-xs">{state.error}</p>}
    <p role="status" className="sr-only">{pending ? "Saving vote..." : state.message}</p>
  </form>;
}
