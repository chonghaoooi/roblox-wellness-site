"use server";

import bcrypt from "bcryptjs";
import { and, desc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDb } from "@/db";
import { aiCalls, coachMessages, gymPostPhotos, gymPosts, logBackgrounds, logs, mealPhotos, meals, settings, users } from "@/db/schema";
import { type ChatMsg, aiEnabled, chat, estimateMeal, readSteps } from "@/lib/ai";
import { COACH_SYSTEM, formatCoachContext } from "@/lib/coach";
import { userAverages, userEntries, userGymWeeks, userGymStreak, userLifts } from "@/lib/queries";
import { createSession, destroySession, getSettings, getUser } from "@/lib/auth";
import { addDays, todayStr } from "@/lib/dates";
import { EXERCISES, type Exercise, isBodyweight, parseLiftRows } from "@/lib/lifts";
import { syncCalorieGoals } from "@/lib/goal";
import { adilbotReacts, adilbotReactsToGym } from "@/lib/adilbot";
import { notifyActivity, removeCurrentPushDevice } from "@/lib/push";
import { editPhotoSet } from "@/lib/post-photos";
import { type FormState, loginSchema, manualStepsSchema, mealSchema, settingsSchema, signupSchema, toFieldErrors, weighInSchema } from "@/lib/validation";

function refreshActivityPages() {
  for (const path of ["/", "/posts", "/gym", "/trends", "/log"]) revalidatePath(path);
}

const obj = (fd: FormData) => Object.fromEntries(fd.entries()) as Record<string, string>;

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(obj(fd));
  if (!parsed.success) return toFieldErrors(parsed.error);
  const db = requireDb();
  const { username, email, password } = parsed.data;
  const dupe = await db.select({ u: users.username, e: users.email }).from(users).where(eq(users.email, email)).limit(1);
  if (dupe.length) return { fieldErrors: { email: "That email is already registered" }, error: "Account exists" };
  const taken = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (taken.length) return { fieldErrors: { username: "That username is taken" }, error: "Username taken" };
  const [u] = await db.insert(users).values({ username, email, passwordHash: await bcrypt.hash(password, 10) }).returning({ id: users.id });
  await db.insert(settings).values({ userId: u.id }); // default settings are the only seed
  await createSession(u.id);
  redirect("/log");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(obj(fd));
  if (!parsed.success) return toFieldErrors(parsed.error);
  const db = requireDb();
  const [u] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  // Always run a compare so response time doesn't reveal whether the email exists.
  const hash = u?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const ok = await bcrypt.compare(parsed.data.password, hash);
  if (!u || !ok) return { error: "Wrong email or password" };
  await createSession(u.id);
  redirect("/");
}

export async function logout() {
  const user = await getUser();
  if (user) await removeCurrentPushDevice(user.id);
  await destroySession();
  redirect("/");
}

export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const parsed = settingsSchema.safeParse(obj(fd));
  if (!parsed.success) return toFieldErrors(parsed.error);
  await requireDb()
    .insert(settings)
    .values({ userId: user.id, ...parsed.data })
    .onConflictDoUpdate({ target: settings.userId, set: parsed.data });
  refreshActivityPages();
  return { ok: true };
}

const MAX_PHOTO_BYTES = 800_000;
const MAX_AI_PER_DAY = 25;

const isJpeg = (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const bad = (field: string, msg: string): FormState => ({ error: msg, fieldErrors: { [field]: msg } });

/** Photos are re-encoded as JPEG by the browser; anything else is rejected (no SVG/HTML smuggling). */
async function readPhoto(fd: FormData, key = "photo"): Promise<{ buf: Buffer } | { error: string }> {
  const file = fd.get(key);
  if (!(file instanceof File) || file.size === 0) return { error: "Pick a photo first" };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photo is too big. Try a smaller one." };
  const buf = Buffer.from(await file.arrayBuffer());
  if (!isJpeg(buf)) return { error: "Only photos (JPEG/PNG/WebP) are allowed" };
  return { buf };
}

/** The user's date comes from their device; accept it only within a window around the server's today. */
function dateOk(date: string, backDays: number) {
  const t = todayStr();
  return date >= addDays(t, -backDays) && date <= addDays(t, 1);
}

/** Counts the attempt first, so failed AI calls can't be used to dodge the daily cap. */
async function takeAiSlot(userId: number): Promise<boolean> {
  const db = requireDb();
  const res = await db.execute(sql`select count(*)::int as n from ai_calls where user_id = ${userId} and created_at > now() - interval '1 day'`);
  const n = (res.rows as { n: number }[])[0].n;
  if (n >= MAX_AI_PER_DAY) return false;
  await db.insert(aiCalls).values({ userId });
  return true;
}

export async function addWeighIn(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const parsed = weighInSchema.safeParse(obj(fd));
  if (!parsed.success) return toFieldErrors(parsed.error);
  const { date, weight, heightCm, notes } = parsed.data;
  if (!dateOk(date, 60)) return bad("date", "Date must be within the last 60 days");
  const s = await getSettings(user.id);
  const weightKg = weight === undefined ? null : s.weightUnit === "lb" ? weight / 2.2046226218 : weight;
  if (weightKg !== null && (weightKg < 20 || weightKg > 300)) return bad("weight", "Weight is out of range");
  const [entry] = await requireDb().insert(logs).values({ userId: user.id, date, kind: "weight", weightKg, heightCm: heightCm ?? null, note: notes ?? null }).returning({ id: logs.id });
  await syncCalorieGoals(user.id);
  notifyActivity(user, "weight", entry.id);
  refreshActivityPages();
  return { ok: true, message: "Saved" };
}

/** Steps need a step-counter screenshot that the AI reads. Manual entry is only allowed while AI isn't configured. */
export async function addSteps(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const date = String(fd.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !dateOk(date, 1)) return bad("date", "Steps can only be logged for today");
  let background: Buffer | null = null;
  const bg = fd.get("background");
  if (bg instanceof File && bg.size > 0) {
    const r = await readPhoto(fd, "background");
    if ("error" in r) return { error: r.error };
    background = r.buf;
  }
  let steps: number;
  let source = "ai";
  if (aiEnabled) {
    const photo = await readPhoto(fd);
    if ("error" in photo) return { error: photo.error };
    if (!(await takeAiSlot(user.id))) return { error: `Screenshot limit reached (${MAX_AI_PER_DAY}/day). Try tomorrow.` };
    try {
      steps = await readSteps(photo.buf);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Couldn't read that screenshot" };
    }
  } else {
    const parsed = manualStepsSchema.safeParse(obj(fd));
    if (!parsed.success) return toFieldErrors(parsed.error);
    if (parsed.data.steps === undefined) return bad("steps", "Enter your steps");
    steps = parsed.data.steps;
    source = "manual";
  }
  const [entry] = await requireDb().insert(logs).values({ userId: user.id, date, kind: "steps", steps, source }).returning({ id: logs.id });
  if (background) await requireDb().insert(logBackgrounds).values({ logId: entry.id, dataB64: background.toString("base64") });
  notifyActivity(user, "steps", entry.id);
  refreshActivityPages();
  return { ok: true, message: `Logged ${steps.toLocaleString("en-US")} steps` };
}

/** A meal = a retained gallery photo + calories (typed, or estimated by the AI when left blank). */
export async function addMeal(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const parsed = mealSchema.safeParse(obj(fd));
  if (!parsed.success) return toFieldErrors(parsed.error);
  const { date, calories: typed, protein: typedProtein, caption } = parsed.data;
  if (!dateOk(date, 1)) return bad("date", "Meals can only be logged for today");
  const photo = await readPhoto(fd);
  if ("error" in photo) return { error: photo.error };
  // Up to two more photos (photo2, photo3) make a swipeable set; blank slots are skipped.
  const extras: Buffer[] = [];
  for (const key of ["photo2", "photo3"]) {
    const f = fd.get(key);
    if (!(f instanceof File) || f.size === 0) continue;
    const more = await readPhoto(fd, key);
    if ("error" in more) return { error: more.error };
    extras.push(more.buf);
  }
  const db = requireDb();
  let calories = typed;
  let protein: number | null = null;
  let source = "manual";
  let note = caption ?? null;
  if (calories === undefined) {
    if (!aiEnabled) return bad("calories", "Enter the calories (AI estimates aren't set up yet)");
    if (!(await takeAiSlot(user.id))) return { error: `AI limit reached (${MAX_AI_PER_DAY}/day). Type the calories instead.` };
    try {
      const g = await estimateMeal(photo.buf, caption);
      calories = g.calories;
      protein = g.protein;
      source = "ai";
      note ??= g.description || null;
    } catch (e) {
      return { error: `${e instanceof Error ? e.message : "AI failed."} You can type the calories instead.` };
    }
  }
  const [log] = await db.insert(logs).values({ userId: user.id, date, kind: "meal", calories, proteinG: typedProtein ?? protein, source, note }).returning({ id: logs.id });
  const [meal] = await db.insert(meals).values({ userId: user.id, logId: log.id, caption: note, dataB64: photo.buf.toString("base64") }).returning({ id: meals.id });
  if (extras.length) await db.insert(mealPhotos).values(extras.map((b, i) => ({ mealId: meal.id, position: i + 1, dataB64: b.toString("base64") })));
  notifyActivity(user, "meals", meal.id);
  adilbotReacts(meal.id, photo.buf, { username: user.username, calories: calories!, caption: note });
  refreshActivityPages();
  return { ok: true, message: `Added ${calories.toLocaleString("en-US")} kcal${source === "ai" ? " (AI estimate)" : ""}` };
}

export async function deleteLog(id: number) {
  const user = await getUser();
  if (!user) redirect("/login");
  await requireDb().delete(logs).where(and(eq(logs.id, id), eq(logs.userId, user.id))); // cascades to the meal photo
  refreshActivityPages();
}

const MAX_COACH_MESSAGES_PER_DAY = 30;
const COACH_HISTORY_TURNS = 10;

export type CoachReply = { reply?: string; error?: string };

/** One coach turn: answers from the signed-in user's own data. Saves both sides of the exchange only on success. */
export async function askCoach(message: string): Promise<CoachReply> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!aiEnabled) return { error: "The coach isn't switched on yet." };
  const text = String(message ?? "").trim();
  if (!text) return { error: "Type a message first." };
  if (text.length > 500) return { error: "Keep it under 500 characters." };
  const db = requireDb();
  const used = await db.execute(sql`select count(*)::int as n from coach_messages where user_id = ${user.id} and role = 'user' and created_at > now() - interval '1 day'`);
  if ((used.rows as { n: number }[])[0].n >= MAX_COACH_MESSAGES_PER_DAY) return { error: `You've used today's ${MAX_COACH_MESSAGES_PER_DAY} coach messages. Try again tomorrow.` };

  const today = todayStr();
  const from = addDays(today, -29);
  const [settingsRow, days, gymWeeks, gymStreak, lifts, avgs, past] = await Promise.all([
    getSettings(user.id),
    userEntries(user.id),
    userGymWeeks(user.id, today),
    userGymStreak(user.id, today),
    userLifts(user.id, today),
    userAverages(from, today),
    db.select({ role: coachMessages.role, content: coachMessages.content }).from(coachMessages).where(eq(coachMessages.userId, user.id)).orderBy(desc(coachMessages.id)).limit(COACH_HISTORY_TURNS),
  ]);
  const mean = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const context = formatCoachContext({
    username: user.username,
    today,
    weightUnit: settingsRow.weightUnit === "lb" ? "lb" : "kg",
    settings: settingsRow,
    days: days.filter((d) => d.date >= from),
    gymWeeks,
    gymStreak,
    lifts,
    community: { people: avgs.length, avgSteps: mean(avgs.map((a) => a.steps)), avgCalories: mean(avgs.map((a) => a.calories)) },
  });
  const history: ChatMsg[] = [...past.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })), { role: "user", content: text }];

  let reply: string;
  try {
    reply = await chat(`${COACH_SYSTEM}\n\nDATA (about the person you are talking to):\n${context}`, history);
  } catch (e) {
    console.error("[coach]", e instanceof Error ? e.message : e);
    return { error: "The coach couldn't answer right now. Try again in a moment." };
  }
  reply = reply.slice(0, 2500);
  if (!reply) return { error: "The coach gave an empty answer. Try rephrasing." };
  await db.insert(coachMessages).values([
    { userId: user.id, role: "user", content: text },
    { userId: user.id, role: "assistant", content: reply },
  ]);
  return { reply };
}

export async function clearCoach() {
  const user = await getUser();
  if (!user) redirect("/login");
  await requireDb().delete(coachMessages).where(eq(coachMessages.userId, user.id));
  revalidatePath("/coach");
}

export async function deleteMeal(id: number) {
  const user = await getUser();
  if (!user) redirect("/login");
  const db = requireDb();
  const [m] = await db.select({ logId: meals.logId }).from(meals).where(and(eq(meals.id, id), eq(meals.userId, user.id)));
  if (!m) return;
  if (m.logId) await db.delete(logs).where(and(eq(logs.id, m.logId), eq(logs.userId, user.id)));
  else await db.delete(meals).where(eq(meals.id, id));
  refreshActivityPages();
}

const MAX_E1RM_TO_BODYWEIGHT = 6; // anything above this is almost certainly a typo
const MAX_POSTS_PER_DAY = 6;
const MAX_NOTES_CHARS = 1500;

/**
 * Gym log in one go: any number of lifts, optional notes and photo. Posting also counts as today's gym check-in.
 * No proof is needed. With nothing filled in it is just a check-in. Anything with notes, a photo or lifts becomes a
 * public gym blog post.
 */
export async function addWorkout(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const date = String(fd.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !dateOk(date, 1)) return bad("date", "Workouts are for today only");
  const notes = String(fd.get("notes") ?? "").trim();
  if (notes.length > MAX_NOTES_CHARS) return bad("notes", `Notes can be at most ${MAX_NOTES_CHARS} characters`);

  const parsed = parseLiftRows(fd.getAll("exercise").map(String), fd.getAll("weight").map(String), fd.getAll("reps").map(String));
  if (parsed.error) return { error: `Lift ${parsed.error.row}: ${parsed.error.message}`, fieldErrors: { lifts: parsed.error.message } };

  let photoB64: string | null = null;
  const file = fd.get("photo");
  if (file instanceof File && file.size > 0) {
    const photo = await readPhoto(fd);
    if ("error" in photo) return { error: photo.error };
    photoB64 = photo.buf.toString("base64");
  }
  const extraPhotos: string[] = [];
  if (photoB64) for (const key of ["photo2", "photo3"]) {
    const f = fd.get(key);
    if (!(f instanceof File) || f.size === 0) continue;
    const more = await readPhoto(fd, key);
    if ("error" in more) return { error: more.error };
    extraPhotos.push(more.buf.toString("base64"));
  }

  const s = await getSettings(user.id);
  const toKg = (w: number) => (s.weightUnit === "lb" ? w / 2.2046226218 : w);
  const db = requireDb();

  // Sanity check each lift against body weight when we know it (estimated one-rep max, Epley).
  if (parsed.lifts.length) {
    const bw = await db.execute(sql`select weight_kg::float8 as w from daily_stats where user_id = ${user.id} and weight_kg is not null order by date desc limit 1`);
    const bodyKg = (bw.rows as { w: number }[])[0]?.w;
    if (bodyKg) {
      const i = parsed.lifts.findIndex((l) => ((isBodyweight(l.exercise) ? bodyKg + toKg(l.weight) : toKg(l.weight)) * (1 + l.reps / 30)) / bodyKg > MAX_E1RM_TO_BODYWEIGHT);
      if (i >= 0) return { error: `Lift ${i + 1}: that is more than 6× your body weight. Check the number.`, fieldErrors: { lifts: "Check the number" } };
    }
  }

  const wantsPost = Boolean(notes) || photoB64 !== null || parsed.lifts.length > 0;
  if (wantsPost) {
    const cnt = await db.execute(sql`select count(*)::int as n from gym_posts where user_id = ${user.id} and created_at > now() - interval '1 day'`);
    if ((cnt.rows as { n: number }[])[0].n >= MAX_POSTS_PER_DAY) return { error: `Max ${MAX_POSTS_PER_DAY} gym posts per day` };
  }

  // One statement keeps the post, all its lifts and the check-in atomic.
  const liftData = parsed.lifts.map((l) => ({ exercise: l.exercise, kg: toKg(l.weight), reps: l.reps }));
  const result = await db.execute(sql`
    with post as (
      insert into gym_posts (user_id, date, notes, photo_b64)
      select ${user.id}, ${date}::date, ${notes || null}, ${photoB64}
      where ${wantsPost}
      returning id
    ), saved_lifts as (
      insert into logs (user_id, date, kind, exercise, lift_kg, reps, source, post_id)
      select ${user.id}, ${date}::date, 'lift', l.exercise, l.kg, l.reps, 'manual', post.id
      from post cross join jsonb_to_recordset(${JSON.stringify(liftData)}::jsonb) as l(exercise text, kg real, reps integer)
      returning id
    ), check_in as (
      insert into logs (user_id, date, kind, source)
      select ${user.id}, ${date}::date, 'gym', 'manual'
      where not exists (select 1 from logs where user_id = ${user.id} and kind = 'gym' and date = ${date}::date)
      returning id
    )
    select exists(select 1 from check_in) as "newCheckIn", (select id from post) as "postId", (select id from check_in) as "checkInId"
  `);
  const { newCheckIn, postId, checkInId } = (result.rows as { newCheckIn: boolean; postId: number | null; checkInId: number | null }[])[0];
  if (postId) {
    if (extraPhotos.length) await db.insert(gymPostPhotos).values(extraPhotos.map((b, i) => ({ postId, position: i + 1, dataB64: b })));
    notifyActivity(user, "gym", postId, true);
    adilbotReactsToGym(
      postId,
      { username: user.username, notes: notes || null, lifts: parsed.lifts.map((l) => ({ name: EXERCISES[l.exercise as Exercise] ?? l.exercise, kg: toKg(l.weight), reps: l.reps, bodyweight: isBodyweight(l.exercise) })) },
      photoB64 ? Buffer.from(photoB64, "base64") : null,
    );
  }
  else if (newCheckIn && checkInId) notifyActivity(user, "gym", checkInId);

  refreshActivityPages();
  const parts = [newCheckIn ? "Checked in" : "Already checked in today", parsed.lifts.length ? `${parsed.lifts.length} ${parsed.lifts.length === 1 ? "lift" : "lifts"} logged` : null, wantsPost ? "posted to the gym blog" : null].filter(Boolean);
  return { ok: true, message: parts.join(" · ") };
}

export async function deletePost(id: number) {
  const user = await getUser();
  if (!user) redirect("/login");
  // Lifts attached to the post are removed with it (cascade); the day's check-in stays so streaks are not affected.
  await requireDb().delete(gymPosts).where(and(eq(gymPosts.id, id), eq(gymPosts.userId, user.id)));
  refreshActivityPages();
}

/**
 * Apply replacements/removals to the original positions before appending new photos.
 * All resulting photos are saved in order, with no gaps (3 photos max).
 */
async function pickEditedPhotos(fd: FormData, current: string[]): Promise<{ photos: string[]; changed: boolean } | { error: string }> {
  const rawRemoved = fd.getAll("remove");
  if (rawRemoved.some(n => typeof n !== "string" || !/^[0-2]$/.test(n))) return { error: "Invalid photo selection." };
  const removed = rawRemoved.map(Number);
  const replacements: { slot: number; photo: string }[] = [];
  const additions: string[] = [];
  for (const key of ["replace0", "replace1", "replace2", "add1", "add2", "add3"]) {
    const f = fd.get(key);
    if (!(f instanceof File) || f.size === 0) continue;
    const r = await readPhoto(fd, key);
    if ("error" in r) return { error: r.error };
    const photo = r.buf.toString("base64");
    if (key.startsWith("replace")) replacements.push({ slot: Number(key.slice(7)), photo });
    else additions.push(photo);
  }
  return editPhotoSet(current, removed, replacements, additions);
}

/** Owner edit of a gym post: notes and photos (lifts stay as logged). */
export async function editWorkout(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const notes = String(fd.get("notes") ?? "").trim();
  if (notes.length > MAX_NOTES_CHARS) return bad("notes", `Notes can be at most ${MAX_NOTES_CHARS} characters`);
  const db = requireDb();
  const [p] = await db.select({ main: gymPosts.photoB64, editedAt: gymPosts.editedAt }).from(gymPosts).where(and(eq(gymPosts.id, id), eq(gymPosts.userId, user.id)));
  if (!p) return { error: "Post not found." };
  if (Number(fd.get("photoVersion")) !== (p.editedAt?.getTime() ?? 0)) { refreshActivityPages(); return { error: "Photos changed since you opened this post. Cancel and reopen the editor, then try again." }; }
  const extra = await db.select({ photo: gymPostPhotos.dataB64 }).from(gymPostPhotos).where(eq(gymPostPhotos.postId, id)).orderBy(gymPostPhotos.position);
  const found = await pickEditedPhotos(fd, [...(p.main ? [p.main] : []), ...extra.map(p => p.photo)]);
  if ("error" in found) return { error: found.error };
  const changes: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [db.update(gymPosts).set({ notes: notes || null, ...(found.changed ? { photoB64: found.photos[0] ?? null, editedAt: new Date() } : {}) }).where(and(eq(gymPosts.id, id), eq(gymPosts.userId, user.id)))];
  if (found.changed) {
    changes.push(db.delete(gymPostPhotos).where(eq(gymPostPhotos.postId, id)));
    if (found.photos.length > 1) changes.push(db.insert(gymPostPhotos).values(found.photos.slice(1).map((dataB64, i) => ({ postId: id, position: i + 1, dataB64 }))));
  }
  await db.batch(changes);
  refreshActivityPages();
  return { ok: true, message: "Saved" };
}

/** Owner edit of a meal post: caption, calories and protein. Changing the calories makes the entry a manual one. */
export async function editMeal(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const parsed = mealSchema.omit({ date: true }).safeParse(obj(fd));
  if (!parsed.success) return toFieldErrors(parsed.error);
  const { calories, protein, caption } = parsed.data;
  const db = requireDb();
  const [m] = await db.select({ logId: meals.logId, calories: logs.calories, main: meals.dataB64, editedAt: meals.editedAt }).from(meals).leftJoin(logs, eq(logs.id, meals.logId)).where(and(eq(meals.id, id), eq(meals.userId, user.id)));
  if (!m) return { error: "Post not found." };
  if (Number(fd.get("photoVersion")) !== (m.editedAt?.getTime() ?? 0)) { refreshActivityPages(); return { error: "Photos changed since you opened this post. Cancel and reopen the editor, then try again." }; }
  const extra = await db.select({ photo: mealPhotos.dataB64 }).from(mealPhotos).where(eq(mealPhotos.mealId, id)).orderBy(mealPhotos.position);
  const found = await pickEditedPhotos(fd, [...(m.main ? [m.main] : []), ...extra.map(p => p.photo)]);
  if ("error" in found) return { error: found.error };
  const changes: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [db.update(meals).set({ caption: caption ?? null, ...(found.changed ? { dataB64: found.photos[0] ?? null, originalB64: null, editedBy: null, editedAt: new Date() } : {}) }).where(and(eq(meals.id, id), eq(meals.userId, user.id)))];
  if (found.changed) {
    changes.push(db.delete(mealPhotos).where(eq(mealPhotos.mealId, id)));
    if (found.photos.length > 1) changes.push(db.insert(mealPhotos).values(found.photos.slice(1).map((dataB64, i) => ({ mealId: id, position: i + 1, dataB64 }))));
  }
  if (m.logId) {
    const changed = calories !== undefined && calories !== m.calories;
    changes.push(db.update(logs).set({ note: caption ?? null, proteinG: protein ?? null, ...(calories !== undefined ? { calories } : {}), ...(changed ? { source: "manual" } : {}) }).where(and(eq(logs.id, m.logId), eq(logs.userId, user.id))));
  }
  await db.batch(changes);
  refreshActivityPages();
  return { ok: true, message: "Saved" };
}
