"use server";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDb } from "@/db";
import { admins } from "@/db/schema";
import { createAdminSession, destroyAdminSession, getAdmin, requireAdmin } from "@/lib/admin-auth";
import { adminIdSchema, adminPasswordSchema, parseAdminLog, tickerSchema } from "@/lib/admin-validation";
import type { FormState } from "@/lib/validation";

function refreshModeration() {
  revalidatePath("/", "layout");
  revalidatePath("/admin");
}
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const invalid: FormState = { error: "This item no longer exists. Refresh the page." };

export async function adminLogin(_: FormState, fd: FormData): Promise<FormState> {
  if (await getAdmin()) redirect("/admin");
  const username = text(fd, "username").trim();
  const password = text(fd, "password");
  if (!username || username.length > 80 || !password || new TextEncoder().encode(password).length > 72) return { error: "Wrong admin username or password." };
  const db = requireDb();
  // A database counter works across Vercel instances; a fixed key prevents spoofed usernames from evading the cap.
  const attempt = await db.execute(sql`
    insert into admin_login_limits (key, attempts, window_start) values ('admin-login', 1, now())
    on conflict (key) do update set
      attempts = case when admin_login_limits.window_start < now() - interval '15 minutes' then 1 else admin_login_limits.attempts + 1 end,
      window_start = case when admin_login_limits.window_start < now() - interval '15 minutes' then now() else admin_login_limits.window_start end
    returning attempts
  `);
  if (Number(attempt.rows[0].attempts) > 10) return { error: "Too many login attempts. Wait 15 minutes before trying again." };
  const [admin] = await db.select().from(admins).where(eq(admins.username, username)).limit(1);
  const hash = admin?.passwordHash ?? "$2b$12$J7a7KiHLU6woYhgv/af8DOKJWNC4lZkEjE1PjEhT2cMqplcIv1Y9m";
  const valid = await bcrypt.compare(password, hash);
  if (!admin || !valid) return { error: "Wrong admin username or password." };
  await db.execute(sql`delete from admin_login_limits where key='admin-login'`);
  await createAdminSession(admin);
  redirect("/admin");
}

export async function adminLogout() {
  await destroyAdminSession();
  redirect("/admin/login");
}

export async function saveTicker(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = tickerSchema.safeParse(text(fd, "message"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await requireDb().execute(sql`
    with saved as (
      insert into site_config (key, value) values ('ticker', ${parsed.data})
      on conflict (key) do update set value=excluded.value returning key
    ) insert into admin_audit (admin_id, action, target, details)
      select ${admin.id}, 'update', 'ticker', 'Updated the site ticker' from saved
  `);
  refreshModeration();
  return { ok: true, message: parsed.data ? "Ticker updated across the site." : "Ticker hidden." };
}

export async function editLog(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = adminIdSchema.safeParse(fd.get("id"));
  if (!id.success) return { error: "Invalid log." };
  const db = requireDb();
  const found = await db.execute(sql`select kind from logs where id=${id.data}`);
  if (!found.rows.length) return invalid;
  const kind = String(found.rows[0].kind);
  const parsed = parseAdminLog(kind, Object.fromEntries(fd.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data as Record<string, string | number | null>;
  const patch = [sql`note=${data.note || null}`];
  if (kind === "meal") patch.push(sql`calories=${data.calories}, source='manual'`);
  if (kind === "steps") patch.push(sql`steps=${data.steps}, source='manual'`);
  if (kind === "weight") patch.push(sql`weight_kg=${data.weightKg}, height_cm=${data.heightCm}`);
  if (kind === "lift") patch.push(sql`exercise=${data.exercise}, lift_kg=${data.liftKg}, reps=${data.reps}`);
  const changed = await db.execute(sql`
    with changed as (
      update logs set ${sql.join(patch, sql`, `)} where id=${id.data} and kind=${kind} returning id, user_id
    ), caption as (
      update meals set caption=${data.note || null} where log_id in (select id from changed) and ${kind === "meal"} returning id
    ) insert into admin_audit (admin_id, action, target, details)
      select ${admin.id}, 'edit', ${`log:${id.data}`}, ${`Edited ${kind} log`} from changed returning id
  `);
  if (!changed.rows.length) return invalid;
  refreshModeration();
  return { ok: true, message: "Log updated. Totals and leaderboards have been recalculated." };
}

export async function editGymPost(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = adminIdSchema.safeParse(fd.get("id"));
  const notes = text(fd, "notes").trim();
  if (!id.success || notes.length > 1500) return { error: "Use a valid post and at most 1,500 characters." };
  const result = await requireDb().execute(sql`
    with changed as (update gym_posts set notes=${notes || null} where id=${id.data} returning id)
    insert into admin_audit (admin_id, action, target, details)
    select ${admin.id}, 'edit', ${`gym-post:${id.data}`}, 'Edited gym blog notes' from changed returning id
  `);
  if (!result.rows.length) return invalid;
  refreshModeration();
  return { ok: true, message: "Post updated." };
}

export async function editMeal(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = adminIdSchema.safeParse(fd.get("id"));
  if (!id.success) return { error: "Invalid meal." };
  const caption = text(fd, "caption").trim();
  if (caption.length > 80) return { error: "Caption must be 80 characters or fewer." };
  const db = requireDb();
  const selected = await db.execute(sql`select log_id from meals where id=${id.data}`);
  if (!selected.rows.length) return invalid;
  const hasLog = selected.rows[0].log_id !== null;
  const calories = Number(fd.get("calories"));
  if (hasLog && (text(fd, "calories").trim() === "" || !Number.isInteger(calories) || calories < 0 || calories > 5000)) return { error: "Calories must be a whole number from 0 to 5,000." };
  const result = await db.execute(sql`
    with changed as (update meals set caption=${caption || null} where id=${id.data} returning id, log_id),
    logged as (update logs set calories=${hasLog ? calories : null}, note=${caption || null}, source='manual'
      where id in (select log_id from changed) returning id)
    insert into admin_audit (admin_id, action, target, details)
    select ${admin.id}, 'edit', ${`meal:${id.data}`}, 'Edited meal caption and calories' from changed returning id
  `);
  if (!result.rows.length) return invalid;
  refreshModeration();
  return { ok: true, message: "Meal updated." };
}

export async function moderateDelete(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = adminIdSchema.safeParse(fd.get("id"));
  if (!id.success) return { error: "Invalid item." };
  const mode = text(fd, "mode");
  let change;
  switch (mode) {
    case "log": change = sql`delete from logs where id=${id.data} returning id`; break;
    case "gym-post": change = sql`delete from gym_posts where id=${id.data} returning id`; break;
    case "gym-photo": change = sql`update gym_posts set photo_b64=null where id=${id.data} and photo_b64 is not null returning id`; break;
    case "meal-photo": change = sql`delete from meals where id=${id.data} returning id`; break;
    case "meal": {
      const result = await requireDb().execute(sql`
        with target as (select id, log_id from meals where id=${id.data}),
        removed_log as (delete from logs where id in (select log_id from target) returning id),
        removed_photo as (delete from meals where id in (select id from target) and log_id is null returning id)
        insert into admin_audit (admin_id, action, target, details)
        select ${admin.id}, 'delete', ${`meal:${id.data}`}, 'Deleted meal photo and its calorie log' from target returning id
      `);
      if (!result.rows.length) return invalid;
      refreshModeration();
      return { ok: true, message: "Meal and its calorie entry deleted." };
    }
    default: return { error: "Invalid moderation action." };
  }
  const result = await requireDb().execute(sql`
    with changed as (${change}) insert into admin_audit (admin_id, action, target, details)
    select ${admin.id}, 'delete', ${`${mode}:${id.data}`}, ${`Removed ${mode}`} from changed returning id
  `);
  if (!result.rows.length) return invalid;
  refreshModeration();
  return { ok: true, message: "Removed." };
}

export async function changeAdminPassword(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = adminPasswordSchema.safeParse(text(fd, "newPassword"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data !== text(fd, "confirmPassword")) return { error: "New passwords do not match." };
  const db = requireDb();
  const [account] = await db.select().from(admins).where(eq(admins.id, admin.id)).limit(1);
  const current = text(fd, "currentPassword");
  if (new TextEncoder().encode(current).length > 72 || !account || !(await bcrypt.compare(current, account.passwordHash))) return { error: "Current password is incorrect." };
  const hash = await bcrypt.hash(parsed.data, 12);
  const result = await db.execute(sql`
    with changed as (update admins set password_hash=${hash}, session_version=session_version+1
      where id=${admin.id} and session_version=${admin.sessionVersion} returning id, session_version)
    insert into admin_audit (admin_id, action, target, details)
    select id, 'password', 'admin-account', 'Changed password and revoked previous admin sessions' from changed returning admin_id
  `);
  if (!result.rows.length) return { error: "Your session changed. Log in again." };
  await createAdminSession({ id: admin.id, sessionVersion: admin.sessionVersion + 1 });
  return { ok: true, message: "Password changed. All previous admin sessions are signed out." };
}
