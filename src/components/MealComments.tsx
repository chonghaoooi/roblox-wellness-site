"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { COMMENT_LIMIT, type MealComment } from "@/lib/meal-comments";

type Props = { mealId: number; owner: string; caption: string | null; count: number; text: string | null; author: string | null; loggedIn: boolean; kind?: "meal" | "gym" };

export function MealComments({ mealId, owner, caption, count: initialCount, text, author, loggedIn, kind = "meal" }: Props) {
  const noun = kind === "gym" ? "workout" : "meal";
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [comments, setComments] = useState<MealComment[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const endpoint = `/api/${kind === "gym" ? "gym" : "meals"}/${mealId}/comments`;

  async function load(before?: number) {
    setLoading(true); setError("");
    try {
      const response = await fetch(endpoint + (before ? `?before=${before}` : ""), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't load comments.");
      setComments((current) => before ? [...current, ...body.comments] : body.comments);
      setNext(body.next);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load comments."); }
    finally { setLoading(false); }
  }

  function open() { dialog.current?.showModal(); setNotice(""); void load(); }

  async function post(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: draft }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't post your comment.");
      setComments((current) => [body.comment, ...current]); setDraft(""); setNotice("Comment posted."); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't post your comment."); }
    finally { setBusy(false); }
  }

  async function remove(id: number) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${endpoint}?comment=${id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't remove the comment.");
      setComments((current) => current.filter((c) => c.id !== id)); setNotice("Comment removed."); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove the comment."); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" onClick={open} className="meal-comment-preview" aria-haspopup="dialog" aria-label={`View comments on ${owner}'s ${noun}. ${initialCount} comments.`}>
      <span className="min-w-0 flex-1 truncate text-left">{text ? <><b className="text-white">{author}</b> <span>{text}</span></> : "Add a comment…"}</span>
      <span className="flex shrink-0 items-center gap-0.5 text-white/80"><span>{initialCount || ""}</span><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg></span>
    </button>
    <dialog ref={dialog} className="meal-comments-dialog" aria-labelledby={`comments-title-${kind}-${mealId}`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/20 pb-3">
        <div className="min-w-0"><h2 id={`comments-title-${kind}-${mealId}`} className="font-display text-xl">Comments</h2><p className="text-xs text-neon">{owner}&apos;s {noun}</p></div>
        <button type="button" autoFocus onClick={() => dialog.current?.close()} className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xl" aria-label="Close comments">×</button>
      </div>
      {caption && <p className="my-3 text-sm font-semibold break-words">{caption}</p>}
      <div className="meal-comments-list" aria-busy={loading}>
        {!loading && comments.length === 0 && !error && <p className="py-5 text-center text-sm text-white/70">No comments yet. Be first!</p>}
        <ul className="space-y-3">{comments.map((c) => <li key={c.id} className="rounded-lg bg-white/5 px-3 py-2">
          <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold text-neon">{c.username}</span>
            {c.mine && <button type="button" onClick={() => void remove(c.id)} disabled={busy} className="min-h-8 shrink-0 px-1 text-xs text-white/70 underline" aria-label={`Remove your comment: ${c.text}`}>Remove</button>}
          </div><p className="break-words text-sm">{c.text}</p>
        </li>)}</ul>
        {loading && <p className="py-3 text-center text-sm" role="status">Loading comments…</p>}
        {next && !loading && <button type="button" className="mt-3 min-h-10 w-full rounded-lg bg-white/10 text-sm font-bold" onClick={() => void load(next)}>More comments ↓</button>}
      </div>
      {error && <p className="my-2 rounded-lg bg-red-950 p-2 text-sm text-red-100" role="alert">{error}</p>}
      <p role="status" className="sr-only">{notice}</p>
      {loggedIn ? <form onSubmit={post} className="mt-3 flex items-end gap-2 border-t border-white/20 pt-3">
        <label className="min-w-0 flex-1"><span className="sr-only">Your comment</span><textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="field !min-h-11 resize-none !text-base" rows={2} maxLength={COMMENT_LIMIT} placeholder="Add a comment…" required disabled={busy} /></label>
        <button className="btn btn-green !min-h-11 !px-3 !text-sm" disabled={busy || loading || !draft.trim()}>{busy ? "Saving…" : "Post"}</button>
      </form> : <p className="mt-3 border-t border-white/20 pt-3 text-sm"><Link className="text-neon underline" href="/login">Log in</Link> to add a comment.</p>}
    </dialog>
  </>;
}
