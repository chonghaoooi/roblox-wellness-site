import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { requireAdmin } from "./admin-auth";

export type AdminLog = {
  id: number; username: string; date: string; kind: string; note: string | null;
  calories: number | null; steps: number | null; weightKg: number | null; heightCm: number | null;
  exercise: string | null; liftKg: number | null; reps: number | null;
};
export type AdminPost = { id: number; username: string; date: string; notes: string | null; hasPhoto: boolean; liftCount: number };
export type AdminMeal = { id: number; username: string; caption: string | null; calories: number | null; logId: number | null; createdAt: string; hasPhoto: boolean };
export type AuditRow = { id: number; username: string; action: string; target: string; details: string; createdAt: string };
export const ADMIN_PAGE_SIZE = 20;

export async function moderationData(view: string, query: string, kind: string, page: number) {
  await requireAdmin();
  const db = requireDb();
  const match = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const offset = (page - 1) * ADMIN_PAGE_SIZE;
  const logs = view === "logs" ? await db.execute(sql`
    select l.id, u.username, l.date::text, l.kind, l.note, l.calories, l.steps,
      l.weight_kg as "weightKg", l.height_cm as "heightCm", l.exercise, l.lift_kg as "liftKg", l.reps
    from logs l join users u on u.id=l.user_id
    where u.username ilike ${match} and (${kind} = '' or l.kind=${kind})
    order by l.date desc, l.id desc limit ${ADMIN_PAGE_SIZE + 1} offset ${offset}
  `) : null;
  const posts = view === "gym" ? await db.execute(sql`
    select p.id, u.username, p.date::text, p.notes, (p.photo_b64 is not null) as "hasPhoto",
      (select count(*)::int from logs where post_id=p.id) as "liftCount"
    from gym_posts p join users u on u.id=p.user_id where u.username ilike ${match}
    order by p.created_at desc, p.id desc limit ${ADMIN_PAGE_SIZE + 1} offset ${offset}
  `) : null;
  const meals = view === "meals" ? await db.execute(sql`
    select m.id, u.username, m.caption, m.log_id as "logId", l.calories, m.created_at::text as "createdAt", (m.data_b64 is not null) as "hasPhoto"
    from meals m join users u on u.id=m.user_id left join logs l on l.id=m.log_id
    where u.username ilike ${match} order by m.created_at desc, m.id desc
    limit ${ADMIN_PAGE_SIZE + 1} offset ${offset}
  `) : null;
  const audit = view === "audit" ? await db.execute(sql`
    select a.id, u.username, a.action, a.target, a.details, a.created_at::text as "createdAt"
    from admin_audit a join admins u on u.id=a.admin_id order by a.id desc
    limit ${ADMIN_PAGE_SIZE + 1} offset ${offset}
  `) : null;
  return {
    logs: (logs?.rows ?? []) as AdminLog[], posts: (posts?.rows ?? []) as AdminPost[],
    meals: (meals?.rows ?? []) as AdminMeal[], audit: (audit?.rows ?? []) as AuditRow[],
  };
}
