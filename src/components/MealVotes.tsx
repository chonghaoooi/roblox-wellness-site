"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { voteMeal } from "@/app/meal-votes";
import type { FormState } from "@/lib/validation";
import { Avatar } from "./ui";

const initial: FormState = {};
const button = "inline-flex h-6 min-w-7 items-center justify-center gap-0.5 rounded-md border px-0.5 text-[10px] font-semibold leading-none text-violet-100 transition-colors hover:bg-violet-400/30 disabled:cursor-wait disabled:opacity-50";
const idle = "border-violet-300/50 bg-violet-400/15";
const selected = "border-violet-200 bg-violet-600/60";
const count = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

// Who liked it: a small face button that opens the full list in a centred sheet (cards clip overflow, so not an inline popover).
function Likers({ names }: { names: string[] }) {
  const [open, setOpen] = useState(false);
  if (!names.length) return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} title="See who liked this" aria-label={`See who liked this. ${names.length} people.`} className="flex items-center rounded-md px-0.5 hover:bg-violet-400/30">
      {names.slice(0, 2).map((n, i) => <span key={n} className={i ? "-ml-2" : ""}><Avatar name={n} size={16} plain /></span>)}
    </button>
    {open && <div role="dialog" aria-label="Liked by" onClick={() => setOpen(false)} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div onClick={(e) => e.stopPropagation()} className="panel max-h-[70vh] w-full max-w-xs overflow-y-auto p-4">
        <p className="mb-2 font-display text-lg">👍 Liked by {names.length}</p>
        <ul className="grid gap-2">{names.map((n) => <li key={n} className="flex items-center gap-2"><Avatar name={n} size={32} plain /><span className="truncate">{n}</span></li>)}</ul>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-purple mt-3 w-full">Close</button>
      </div>
    </div>}
  </>;
}

export function MealVotes({ mealId, upVotes, downVotes, upBy = [], myVote, loggedIn, kind = "meal" }: { mealId: number; upVotes: number; downVotes: number; upBy?: string[]; myVote: number; loggedIn: boolean; kind?: "meal" | "gym" | "log" }) {
  const [state, action, pending] = useActionState(voteMeal, initial);
  if (!loggedIn) return <div className="flex shrink-0 items-center gap-1" aria-label="Meal votes">
      <Link href="/login" className={`${button} ${idle}`} title="Log in to vote · Free" aria-label={`Log in to give a thumbs up. ${upVotes} votes.`}><span aria-hidden="true" className="text-xs">👍</span>{count.format(upVotes)}</Link>
      <Likers names={upBy} />
      <Link href="/login" className={`${button} ${idle}`} title="Log in to vote · Free" aria-label={`Log in to give a thumbs down. ${downVotes} votes.`}><span aria-hidden="true" className="text-xs">👎</span>{count.format(downVotes)}</Link>
  </div>;
  return <form action={action} aria-label={kind === "gym" ? "Vote on this workout" : kind === "log" ? "Vote on this post" : "Vote on this meal"} className="relative flex shrink-0 items-center gap-1">
    <input type="hidden" name="mealId" value={mealId} />
    <input type="hidden" name="kind" value={kind} />
      <button name="vote" value={myVote === 1 ? "clear" : "up"} disabled={pending} aria-pressed={myVote === 1} aria-label={`${myVote === 1 ? "Remove your thumbs up" : "Thumbs up"}. ${upVotes} votes.`} className={`${button} ${myVote === 1 ? selected : idle}`}><span aria-hidden="true" className="text-xs">👍</span>{count.format(upVotes)}</button>
      <Likers names={upBy} />
      <button name="vote" value={myVote === -1 ? "clear" : "down"} disabled={pending} aria-pressed={myVote === -1} aria-label={`${myVote === -1 ? "Remove your thumbs down" : "Thumbs down"}. ${downVotes} votes.`} className={`${button} ${myVote === -1 ? selected : idle}`}><span aria-hidden="true" className="text-xs">👎</span>{count.format(downVotes)}</button>
    {state.error && <p role="alert" className="err absolute right-0 bottom-full z-10 mb-1 w-40 rounded-md bg-slate-950 p-2 text-xs">{state.error}</p>}
    <p role="status" className="sr-only">{pending ? "Saving vote..." : state.message}</p>
  </form>;
}
