"use client";

import { useActionState, useEffect, useState } from "react";
import type { FormState } from "@/lib/validation";
import { IconTrash } from "./icons";

type Props = { deleteAction: () => Promise<void>; editAction: (s: FormState, fd: FormData) => Promise<FormState>; caption: string | null; calories: number | null; protein: number | null };

/** Edit and delete for your own post. Lives in the opened post, not on the card. */
export function MealOwnerActions({ deleteAction, editAction, caption, calories, protein }: Props) {
  const [editing, setEditing] = useState(false);
  const [s, run, pending] = useActionState(editAction, {});
  useEffect(() => { if (s.ok) setEditing(false); }, [s]);
  const fe = s.fieldErrors ?? {};
  const icon = "inline-flex size-9 items-center justify-center rounded-md bg-white/10 text-white/80";
  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => setEditing((e) => !e)} className={`${icon} hover:bg-white/20`} aria-label="Edit this post" aria-expanded={editing}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        </button>
        <form action={deleteAction} onSubmit={(e) => { if (!confirm("Delete this post?")) e.preventDefault(); }}>
          <button className={`${icon} hover:bg-red-500/20 hover:text-red-200`} aria-label="Delete this post"><IconTrash /></button>
        </form>
      </div>
      {editing && (
        <form action={run} className="basis-full space-y-2 rounded-lg bg-white/5 p-3">
          <label className="label" htmlFor="edit-caption">Caption</label>
          <input id="edit-caption" name="caption" maxLength={80} defaultValue={caption ?? ""} className="field" aria-invalid={fe.caption ? true : undefined} />
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor="edit-cal">Calories</label>
              <input id="edit-cal" name="calories" type="number" inputMode="numeric" min={0} max={5000} defaultValue={calories ?? ""} className="field" aria-invalid={fe.calories ? true : undefined} />
            </div>
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor="edit-pro">Protein (g)</label>
              <input id="edit-pro" name="protein" type="number" inputMode="numeric" min={0} max={300} defaultValue={protein ?? ""} className="field" aria-invalid={fe.protein ? true : undefined} />
            </div>
          </div>
          {s.error && <p className="err text-sm" role="alert">{s.error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-green flex-1" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            <button type="button" className="btn flex-1" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </>
  );
}
