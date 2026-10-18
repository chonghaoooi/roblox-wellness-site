"use client";

import { PhotoInput } from "./PhotoInput";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addWorkout, addMeal, addSteps, addWeighIn, deleteLog, login, saveSettings, signup } from "@/app/actions";
import { bmi } from "@/lib/calc";
import { MAX_LIFT_ROWS, isBodyweight, type Exercise } from "@/lib/lifts";
import { localToday, shrink } from "@/lib/shrink";
import { EXERCISES, type FormState } from "@/lib/validation";
import { IconLogin, IconPlus, IconSave, IconTrash, IconUserPlus } from "./icons";

function Field({ name, label, type = "text", err, hint, id = name, ...rest }: { name: string; label: string; type?: string; err?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} name={name} type={type} className="field mt-1" aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-e` : hint ? `${id}-h` : undefined} {...rest} />
      {hint && !err && <p id={`${id}-h`} className="mt-1 text-sm">{hint}</p>}
      {err && <p id={`${id}-e`} className="err mt-1" role="alert">{err}</p>}
    </div>
  );
}

function Shell({ title, state, children, as: Tag = "h1" }: { title: string; state: FormState; children: React.ReactNode; as?: "h1" | "h2" }) {
  return (
    <div className="panel mx-auto w-full max-w-lg space-y-4 p-5 sm:p-6">
      <Tag className="rb-text text-2xl sm:text-3xl">{title}</Tag>
      {state.error && !state.ok && <p className="err rounded-lg border-2 border-red-400 bg-red-950 p-3" role="alert">{state.error}</p>}
      {state.ok && <p className="neon rounded-lg border-2 border-neon bg-black p-3 text-lg" role="status">{state.message ?? "Saved!"}</p>}
      {children}
    </div>
  );
}

const init: FormState = {};

export function LoginForm() {
  const [s, action, pending] = useActionState(login, init);
  return (
    <form action={action}>
      <Shell title="Login" state={s}>
        <Field name="email" label="Email" type="email" autoComplete="email" required err={s.fieldErrors?.email} />
        <Field name="password" label="Password" type="password" autoComplete="current-password" required err={s.fieldErrors?.password} />
        <button className="btn btn-green w-full" disabled={pending}><IconLogin />{pending ? "Logging in…" : "Login"}</button>
      </Shell>
    </form>
  );
}

export function SignupForm() {
  const [s, action, pending] = useActionState(signup, init);
  return (
    <form action={action}>
      <Shell title="Sign up" state={s}>
        <Field name="username" label="Username" autoComplete="username" required minLength={3} maxLength={20} err={s.fieldErrors?.username} hint="3–20 letters, numbers or _" />
        <Field name="email" label="Email" type="email" autoComplete="email" required err={s.fieldErrors?.email} />
        <Field name="password" label="Password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} err={s.fieldErrors?.password} hint="At least 8 characters" />
        <button className="btn btn-purple w-full" disabled={pending}><IconUserPlus />{pending ? "Creating…" : "Create account"}</button>
      </Shell>
    </form>
  );
}

/** The user's own calendar date, filled in after mount so it matches their device rather than the server. */
function useLocalDate(fallback: string) {
  const [d, setD] = useState(fallback);
  useEffect(() => setD(localToday()), []);
  return d;
}

/** Wraps a server action so the chosen photo is shrunk in the browser first, and the form resets on success. */
function usePhotoAction(action: (s: FormState, fd: FormData) => Promise<FormState>, maxSide: number, quality: number) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, run, pending] = useActionState(async (prev: FormState, fd: FormData): Promise<FormState> => {
    const f = fd.get("photo");
    if (f instanceof File && f.size > 0) {
      try {
        fd.set("photo", await shrink(f, maxSide, quality));
      } catch {
        return { error: "Couldn't read that image. Try a JPEG or PNG." };
      }
    }
    const r = await action(prev, fd);
    if (r.ok) formRef.current?.reset();
    return r;
  }, init);
  return { formRef, state, run, pending };
}

export function MealForm({ today, aiOn, compact }: { today: string; aiOn: boolean; compact?: boolean }) {
  const date = useLocalDate(today);
  const { formRef, state: s, run, pending } = usePhotoAction(addMeal, 1000, 0.8);
  const [picked, setPicked] = useState(false);
  const fe = s.fieldErrors ?? {};
  return (
    <form ref={formRef} action={run} className={compact ? "panel flex flex-wrap items-end gap-4 p-4" : undefined}>
      <input type="hidden" name="date" value={date} />
      {compact ? (
        <>
          <div className="min-w-48 flex-1">
            <label htmlFor="photo-m" className="label">Meal photo</label>
            <PhotoInput id="photo-m" required onPicked={setPicked} />
          </div>
          <div className="w-36">
            <label htmlFor="calories-m" className="label">Calories {aiOn && <span className="text-sm">(or AI)</span>}</label>
            <input id="calories-m" name="calories" type="number" inputMode="numeric" min={0} max={5000} className="field mt-1" placeholder={aiOn ? "AI guesses" : "kcal"} aria-invalid={fe.calories ? true : undefined} required={!aiOn} />
          </div>
          <div className="min-w-40 flex-1">
            <label htmlFor="caption-m" className="label">Caption</label>
            <input id="caption-m" name="caption" maxLength={80} className="field mt-1" placeholder="Tacos, obviously" />
          </div>
          <button className="btn btn-green" disabled={pending || !picked}><IconPlus />{pending ? (aiOn ? "Analysing…" : "Posting…") : "Share meal"}</button>
          <p className="w-full text-sm" role="status">
            {s.error ? <span className="err">{s.error}</span> : s.ok ? <span className="neon">{s.message}. Photo saved to the gallery.</span> : aiOn ? "Leave calories blank and the AI estimates them from the photo. Photos are public." : "Photos are public."}
          </p>
        </>
      ) : (
        <Shell title="Add a meal" as="h2" state={s}>
          <div>
            <label htmlFor="photo-meal" className="label">Meal photo</label>
            <PhotoInput id="photo-meal" required onPicked={setPicked} />
            {aiOn && <p className="mt-1 text-sm">The AI estimates the calories from your photo.</p>}
          </div>
          <Field id="calories-meal" name="calories" label={aiOn ? "Calories (optional, overrides the AI)" : "Calories"} type="number" inputMode="numeric" min={0} max={5000} required={!aiOn} err={fe.calories} />
          <Field id="caption-meal" name="caption" label="Caption (optional)" maxLength={80} />
          <button className="btn btn-green w-full" disabled={pending || !picked}><IconPlus />{pending ? (aiOn ? "Analysing…" : "Saving…") : "Add meal"}</button>
        </Shell>
      )}
    </form>
  );
}

export function StepsForm({ today, aiOn }: { today: string; aiOn: boolean }) {
  const date = useLocalDate(today);
  const { formRef, state: s, run, pending } = usePhotoAction(addSteps, 1600, 0.85);
  const [picked, setPicked] = useState(false);
  return (
    <form ref={formRef} action={run}>
      <input type="hidden" name="date" value={date} />
      <Shell title="Log steps" as="h2" state={s}>
        <Link href="/trackers" className="btn btn-green w-full">Connect Apple Health / Samsung steps</Link>
        {aiOn ? (
          <Field id="photo-steps" name="photo" label="Step counter screenshot" type="file" accept="image/*" required onChange={(e) => setPicked(Boolean(e.target.files?.length))} err={s.fieldErrors?.photo} hint="Upload a screenshot of today's total in your phone's health app. The AI reads the number. Your highest count of the day is used." />
        ) : (
          <Field name="steps" label="Steps today" type="number" inputMode="numeric" min={0} max={100000} required err={s.fieldErrors?.steps} hint="Screenshot verification isn't switched on yet, so typed steps are accepted for now." />
        )}
        <button className="btn btn-blue w-full" disabled={pending || (aiOn && !picked)}><IconSave />{pending ? "Reading…" : "Log steps"}</button>
      </Shell>
    </form>
  );
}

export function WeighInForm({ today, weightUnit, lastHeight, lastWeight }: { today: string; weightUnit: "kg" | "lb"; lastHeight: string; lastWeight: string }) {
  const date = useLocalDate(today);
  const [s, action, pending] = useActionState(addWeighIn, init);
  const [w, setW] = useState(lastWeight);
  const [h, setH] = useState(lastHeight);
  const fe = s.fieldErrors ?? {};
  const kg = weightUnit === "lb" ? Number(w) / 2.2046226218 : Number(w);
  const live = Number(w) > 0 && Number(h) > 0 ? bmi(kg, Number(h)) : null;
  return (
    <form action={action}>
      <input type="hidden" name="date" value={date} />
      <Shell title="Weigh-in (optional)" as="h2" state={s}>
        <p className="text-sm">No need to do this every day. Log it whenever you weigh yourself. Height only needs entering once.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field name="weight" label={`Weight (${weightUnit})`} type="number" inputMode="decimal" step="0.1" min={20} max={500} value={w} onChange={(e) => setW(e.target.value)} err={fe.weight} />
          <Field name="heightCm" label="Height (cm)" type="number" inputMode="decimal" step="0.1" min={90} max={250} value={h} onChange={(e) => setH(e.target.value)} err={fe.heightCm} />
        </div>
        <p className="rounded-lg border-2 border-black bg-black/60 p-3 text-lg" aria-live="polite">
          BMI: <span className="neon text-2xl">{live ? live.toFixed(1) : "—"}</span>
        </p>
        <Field name="notes" label="Notes (optional)" maxLength={280} err={fe.notes} />
        <button className="btn btn-purple w-full" disabled={pending}><IconSave />{pending ? "Saving…" : "Save weigh-in"}</button>
      </Shell>
    </form>
  );
}

type WorkoutLift = { id: number; exercise: Exercise; weight: string; reps: string };
const emptyLift = (id: number): WorkoutLift => ({ id, exercise: "bench", weight: "", reps: "" });

export function WorkoutForm({ today, done, weightUnit }: { today: string; done: boolean; weightUnit: "kg" | "lb" }) {
  const date = useLocalDate(today);
  const nextId = useRef(1);
  const formRef = useRef<HTMLFormElement>(null);
  const [lifts, setLifts] = useState<WorkoutLift[]>([emptyLift(0)]);
  const [notes, setNotes] = useState("");
  const [s, run, pending] = useActionState(async (prev: FormState, fd: FormData): Promise<FormState> => {
    const photo = fd.get("photo");
    if (photo instanceof File && photo.size > 0) {
      try { fd.set("photo", await shrink(photo, 1000, 0.8)); }
      catch { return { error: "Couldn't read that image. Try a JPEG or PNG." }; }
    }
    const result = await addWorkout(prev, fd);
    if (result.ok) {
      formRef.current?.reset();
      setLifts([emptyLift(nextId.current++)]);
      setNotes("");
    }
    return result;
  }, init);
  const update = (id: number, patch: Partial<WorkoutLift>) => setLifts((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  return (
    <form ref={formRef} action={run} id="gym" className="log-anchor" tabIndex={-1}>
      <input type="hidden" name="date" value={date} />
      <Shell title="Gym check-in & blog" as="h2" state={s}>
        <p className="text-sm">{done || s.ok ? "You are checked in today. Share another workout whenever you like." : "Just check in, or log your whole workout in one go. Keep check-ins less than 3 days apart to build your streak."}</p>
        <fieldset id="gym-lifts" disabled={pending} className="log-anchor min-w-0 space-y-4" tabIndex={-1}>
          <legend className="label mb-2">Lifts (optional)</legend>
          {lifts.map((lift, i) => {
            const bw = isBodyweight(lift.exercise);
            return (
              <div key={lift.id} className="space-y-3 rounded-xl border-2 border-white/30 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={`exercise-${lift.id}`} className="label">Lift {i + 1}</label>
                  <button type="button" className="min-h-10 px-2 text-sm text-sun underline" aria-label={`Remove lift ${i + 1}`} onClick={() => setLifts((rows) => rows.filter((row) => row.id !== lift.id))}>Remove</button>
                </div>
                <select id={`exercise-${lift.id}`} name="exercise" className="field" value={lift.exercise} onChange={(e) => update(lift.id, { exercise: e.target.value as Exercise })}>
                  {Object.entries(EXERCISES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <Field id={`weight-${lift.id}`} name="weight" label={`${bw ? "Added weight" : "Weight"} (${weightUnit})`} type="number" inputMode="decimal" step="any" min={bw ? 0 : 1} max={500} value={lift.weight} onChange={(e) => update(lift.id, { weight: e.target.value })} hint={bw ? "Blank or 0 = bodyweight." : undefined} />
                  <Field id={`reps-${lift.id}`} name="reps" label="Reps" type="number" inputMode="numeric" step="1" min={1} max={30} value={lift.reps} onChange={(e) => update(lift.id, { reps: e.target.value })} />
                </div>
              </div>
            );
          })}
          <button type="button" className="btn btn-blue w-full" disabled={lifts.length >= MAX_LIFT_ROWS} onClick={() => { const row = emptyLift(nextId.current++); setLifts((rows) => [...rows, row]); }}><IconPlus />Add another lift</button>
          <p className="text-sm">Up to {MAX_LIFT_ROWS} lifts per post. Leave unused rows blank.</p>
          <div>
            <label htmlFor="gym-notes" className="label">Gym notes (optional)</label>
            <textarea id="gym-notes" name="notes" className="field mt-1 min-h-32" rows={5} maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Today's workout, a new personal best, how it felt..." aria-invalid={s.fieldErrors?.notes ? true : undefined} />
            <p className="mt-1 text-sm">{notes.length}/1500</p>
          </div>
          <div>
            <label htmlFor="gym-photo" className="label">Workout photo (optional)</label>
            <PhotoInput id="gym-photo" />
            <p className="mt-1 text-sm">Photos are public and stay in the blog until you or an admin remove them.</p>
          </div>
          <p className="text-sm">Notes, photos and lifts are shared publicly. Posting also checks you in once for today. All fields can be blank for a check-in.</p>
        </fieldset>
        <button className="btn btn-green w-full" disabled={pending}><IconSave />{pending ? "Saving workout..." : "Save workout / check in"}</button>
      </Shell>
    </form>
  );
}

export function DeleteLogButton({ id, label }: { id: number; label: string }) {
  return (
    <form action={deleteLog.bind(null, id)}>
      <button className="btn btn-red !min-h-9 !px-3 !py-1 text-base" aria-label={`Delete ${label}`}><IconTrash />Delete</button>
    </form>
  );
}

type SettingsInit = { weightUnit: string; distanceUnit: string; calorieGoal: number; stepGoal: number; caloriesPerStep: number; strideLengthM: number };

export function SettingsForm({ initial }: { initial: SettingsInit }) {
  const [s, action, pending] = useActionState(saveSettings, init);
  const fe = s.fieldErrors ?? {};
  return (
    <form action={action}>
      <Shell title="Settings" state={s}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="weightUnit" className="label">Weight unit</label>
            <select id="weightUnit" name="weightUnit" className="field mt-1" defaultValue={initial.weightUnit}><option value="kg">kg</option><option value="lb">lb</option></select>
          </div>
          <div>
            <label htmlFor="distanceUnit" className="label">Distance unit</label>
            <select id="distanceUnit" name="distanceUnit" className="field mt-1" defaultValue={initial.distanceUnit}><option value="km">km</option><option value="mi">mi</option></select>
          </div>
          <Field name="calorieGoal" label="Calorie goal" type="number" min={500} max={10000} step={1} defaultValue={initial.calorieGoal} required err={fe.calorieGoal} />
          <Field name="stepGoal" label="Step goal" type="number" min={500} max={100000} step={1} defaultValue={initial.stepGoal} required err={fe.stepGoal} />
          <Field name="caloriesPerStep" label="Calories per step" type="number" min={0.01} max={0.2} step="any" defaultValue={initial.caloriesPerStep} required err={fe.caloriesPerStep} />
          <Field name="strideLengthM" label="Stride length (m)" type="number" min={0.3} max={1.5} step="any" defaultValue={initial.strideLengthM} required err={fe.strideLengthM} />
        </div>
        <p className="text-sm">Changing the weight unit doesn&apos;t convert past logs — they are always stored in kg.</p>
        <button className="btn btn-blue w-full" disabled={pending}><IconSave />{pending ? "Saving…" : "Save settings"}</button>
      </Shell>
    </form>
  );
}
