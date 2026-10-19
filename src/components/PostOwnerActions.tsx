"use client";

import { useActionState, useEffect, useState } from "react";
import type { FormState } from "@/lib/validation";
import { shrink } from "@/lib/shrink";
import { IconTrash } from "./icons";

type Props = { kind?: "meal" | "gym"; mealId: number; photoCount: number; photoV: number; deleteAction: () => Promise<void>; editAction: (s: FormState, fd: FormData) => Promise<FormState>; caption?: string | null; calories?: number | null; protein?: number | null };

/** Edit and delete for your own post. Lives in the opened post, not on the card. */
export function PostOwnerActions({ kind = "meal", mealId, photoCount, photoV, deleteAction, editAction, caption, calories, protein }: Props) {
  const [editing, setEditing] = useState(false);
  const [removed, setRemoved] = useState<number[]>([]);
  const [s, run, pending] = useActionState(async (prev: FormState, fd: FormData): Promise<FormState> => {
    for (const key of ["replace0", "replace1", "replace2", "add1", "add2", "add3"]) {
      const f = fd.get(key);
      if (!(f instanceof File) || f.size === 0) continue;
      try { fd.set(key, await shrink(f, 1000, 0.8)); } catch { return { error: "Couldn't read that image. Try a JPEG or PNG." }; }
    }
    return editAction(prev, fd);
  }, {});
  useEffect(() => { if (s.ok) { setEditing(false); setRemoved([]); } }, [s]);
  const fe = s.fieldErrors ?? {};
  const icon = "inline-flex size-9 items-center justify-center rounded-md bg-white/10 text-white/80";
  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => { setRemoved([]); setEditing((e) => !e); }} className={`${icon} hover:bg-white/20`} aria-label="Edit this post" aria-expanded={editing}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        </button>
        <form action={deleteAction} onSubmit={(e) => { if (!confirm("Delete this post?")) e.preventDefault(); }}>
          <button className={`${icon} hover:bg-red-500/20 hover:text-red-200`} aria-label="Delete this post"><IconTrash /></button>
        </form>
      </div>
      {editing && (
        <form action={run} className="basis-full space-y-2 rounded-lg bg-white/5 p-3">
          <input type="hidden" name="photoVersion" value={photoV} />
          <fieldset disabled={pending} className="min-w-0 space-y-2">
          <legend className="label">Photos</legend>
          <p className="text-xs text-white/80">Change, add or remove photos. Removals apply when you save; your text and stats stay.</p>
          {removed.map(k => <input key={k} type="hidden" name="remove" value={k} />)}
          <div className="space-y-2">
            {Array.from({ length: photoCount }, (_, k) => (
              <div key={k} className="space-y-1 rounded-md border border-white/20 p-2">
                <div className={`flex items-center gap-2 ${removed.includes(k) ? "opacity-50" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/${kind === "gym" ? "gym" : "meals"}/${mealId}?${k ? `i=${k}&` : ""}w=240&v=${photoV}`} alt="" className="size-12 shrink-0 rounded-md border-2 border-black object-cover" />
                <label className="min-w-0 flex-1 text-xs">Change photo {k + 1}<input name={`replace${k}`} type="file" accept="image/*" disabled={removed.includes(k)} className="field mt-0.5 !min-h-0 !py-1 !text-sm" /></label>
                </div>
                <button type="button" onClick={() => setRemoved(prev => prev.includes(k) ? prev.filter(n => n !== k) : [...prev, k])} aria-label={removed.includes(k) ? `Undo removal of photo ${k + 1}` : `Remove photo ${k + 1}`} className="min-h-9 rounded-md bg-black/40 px-3 text-xs font-bold text-white underline">
                  {removed.includes(k) ? "Undo removal" : "Remove photo"} {k + 1}
                </button>
              </div>
            ))}
            {Array.from({ length: 3 - photoCount + removed.length }, (_, k) => (
              <label key={k} className="block text-xs">Add photo {photoCount - removed.length + k + 1}<input name={`add${k + 1}`} type="file" accept="image/*" className="field mt-0.5 !min-h-0 !py-1 !text-sm" /></label>
            ))}
          </div>
          {kind === "gym" ? <>
            <label className="label" htmlFor="edit-notes">Notes</label>
            <textarea id="edit-notes" name="notes" rows={4} maxLength={1500} defaultValue={caption ?? ""} className="field" aria-invalid={fe.notes ? true : undefined} />
          </> : <>
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
          </>}
          {s.error && <p className="err text-sm" role="alert">{s.error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-green flex-1" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            <button type="button" className="btn flex-1" onClick={() => setEditing(false)}>Cancel</button>
          </div>
          </fieldset>
        </form>
      )}
    </>
  );
}
