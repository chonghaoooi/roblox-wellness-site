"use client";

import { useActionState } from "react";
import { adminLogin, changeAdminPassword, editGymPost, editLog, editMeal, moderateDelete, saveTicker } from "@/app/admin/actions";
import type { AdminLog, AdminMeal } from "@/lib/admin-data";
import { EXERCISES } from "@/lib/lifts";
import type { FormState } from "@/lib/validation";

const initial: FormState = {};

function Status({ state }: { state: FormState }) {
  return state.error ? <p role="alert" className="err rounded-lg border-2 border-red-400 bg-red-950 p-3">{state.error}</p>
    : state.ok ? <p role="status" className="neon rounded-lg border-2 border-neon bg-black p-3">{state.message ?? "Saved."}</p> : null;
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block"><span className="label">{label}</span><input {...props} className="field mt-1" /></label>;
}

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, initial);
  return <form action={action} className="panel mx-auto max-w-md space-y-5 p-6">
    <h1 className="rb-text text-3xl">ADMIN LOGIN</h1>
    <p>Site owner access. Use your separate admin account.</p>
    <Input name="username" label="Admin username" autoComplete="username" maxLength={80} required />
    <Input name="password" label="Admin password" type="password" autoComplete="current-password" maxLength={72} required />
    <Status state={state} />
    <button disabled={pending} className="btn btn-purple w-full">{pending ? "Signing in..." : "Sign in to admin"}</button>
  </form>;
}

export function TickerEditor({ message }: { message: string }) {
  const [state, action, pending] = useActionState(saveTicker, initial);
  return <form action={action} className="panel space-y-4 p-5 sm:p-6">
    <h2 className="rb-text text-2xl">EDIT THE TICKER</h2>
    <label className="block"><span className="label">Ticker message</span>
      <textarea name="message" defaultValue={message} maxLength={500} rows={5} className="field mt-2" />
    </label>
    <p className="text-sm">Up to 500 characters. Add • between messages. Leave blank to hide the ticker.</p>
    <Status state={state} />
    <button className="btn btn-green" disabled={pending}>{pending ? "Saving..." : "Save ticker"}</button>
  </form>;
}

export function AdminDeleteButton({ id, mode, label, confirmation }: { id: number; mode: "log" | "gym-post" | "gym-photo" | "meal" | "meal-photo"; label: string; confirmation: string }) {
  const [state, action, pending] = useActionState(moderateDelete, initial);
  return <form action={action} onSubmit={(event) => { if (!window.confirm(confirmation)) event.preventDefault(); }} className="space-y-2">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value={mode} />
    <button disabled={pending} className="btn btn-red !text-sm">{pending ? "Removing..." : label}</button>
    <Status state={state} />
  </form>;
}

export function AdminLogEditor({ log }: { log: AdminLog }) {
  const [state, action, pending] = useActionState(editLog, initial);
  return <form action={action} className="mt-4 space-y-4">
    <input type="hidden" name="id" value={log.id} />
    {log.kind === "meal" && <Input name="calories" label="Calories (kcal)" type="number" min={0} max={5000} step={1} defaultValue={log.calories ?? ""} required />}
    {log.kind === "steps" && <Input name="steps" label="Steps" type="number" min={0} max={100000} step={1} defaultValue={log.steps ?? ""} required />}
    {log.kind === "weight" && <div className="grid gap-3 sm:grid-cols-2">
      <Input name="weightKg" label="Weight (kg)" type="number" min={20} max={300} step="any" defaultValue={log.weightKg ?? ""} />
      <Input name="heightCm" label="Height (cm)" type="number" min={90} max={250} step="any" defaultValue={log.heightCm ?? ""} />
    </div>}
    {log.kind === "lift" && <>
      <label className="block"><span className="label">Exercise</span><select name="exercise" defaultValue={log.exercise ?? "bench"} className="field mt-1">{Object.entries(EXERCISES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="liftKg" label="Load / added weight (kg)" type="number" min={0} max={500} step="any" defaultValue={log.liftKg ?? ""} required />
        <Input name="reps" label="Reps" type="number" min={1} max={30} step={1} defaultValue={log.reps ?? ""} required />
      </div>
      <p className="text-sm">For pull ups and dips, enter added weight; 0 means bodyweight.</p>
    </>}
    <label className="block"><span className="label">{log.kind === "meal" ? "Caption" : "Notes"}</span><textarea name="note" defaultValue={log.note ?? ""} rows={3} maxLength={log.kind === "meal" ? 80 : 280} className="field mt-1" /></label>
    <Status state={state} />
    <button className="btn btn-blue" disabled={pending}>{pending ? "Saving..." : "Save log changes"}</button>
  </form>;
}

export function AdminPostEditor({ id, notes }: { id: number; notes: string | null }) {
  const [state, action, pending] = useActionState(editGymPost, initial);
  return <form action={action} className="mt-4 space-y-3">
    <input type="hidden" name="id" value={id} />
    <label className="block"><span className="label">Gym notes</span><textarea name="notes" defaultValue={notes ?? ""} maxLength={1500} rows={5} className="field mt-1" /></label>
    <Status state={state} /><button className="btn btn-blue" disabled={pending}>{pending ? "Saving..." : "Save post changes"}</button>
  </form>;
}

export function AdminMealEditor({ meal }: { meal: AdminMeal }) {
  const [state, action, pending] = useActionState(editMeal, initial);
  return <form action={action} className="mt-4 space-y-3">
    <input type="hidden" name="id" value={meal.id} />
    <Input name="caption" label="Caption" defaultValue={meal.caption ?? ""} maxLength={80} />
    {meal.logId !== null && <Input name="calories" label="Calories (kcal)" type="number" step={1} min={0} max={5000} defaultValue={meal.calories ?? ""} required />}
    <Status state={state} /><button className="btn btn-blue" disabled={pending}>{pending ? "Saving..." : "Save meal changes"}</button>
  </form>;
}

export function AdminPasswordForm() {
  const [state, action, pending] = useActionState(changeAdminPassword, initial);
  return <form action={action} className="panel max-w-lg space-y-4 p-5">
    <h2 className="rb-text text-2xl">CHANGE ADMIN PASSWORD</h2>
    <Input name="currentPassword" label="Current password" type="password" autoComplete="current-password" required maxLength={72} />
    <Input name="newPassword" label="New password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} />
    <Input name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} />
    <p className="text-sm">Use at least 12 characters. Changing your password signs out all other admin sessions.</p>
    <Status state={state} /><button className="btn btn-purple" disabled={pending}>{pending ? "Changing..." : "Change password"}</button>
  </form>;
}
