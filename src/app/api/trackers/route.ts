import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireDb } from "@/db";
import { logs } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { notifyActivity } from "@/lib/push";
import { trackerDayWindow, trackerSyncSchema } from "@/lib/tracker-validation";

export const maxDuration = 300;
const response = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const user = await getUser();
  if (!user) return response({ error: "Log in to connect a tracker." }, 401);
  const window = trackerDayWindow(new Date(), process.env.APP_TIMEZONE || "UTC");
  const [latest] = await requireDb().select({ steps: logs.steps, source: logs.source, syncedAt: logs.trackerSyncedAt })
    .from(logs).where(and(eq(logs.userId, user.id), eq(logs.date, window.date), sql`${logs.source} in ('apple_health', 'health_connect')`))
    .orderBy(desc(logs.trackerSyncedAt)).limit(1);
  return response({ ...window, userId: user.id, latest: latest ?? null });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return response({ error: "Log in to sync steps." }, 401);
  if (request.headers.get("origin") !== request.nextUrl.origin) return response({ error: "Invalid request origin." }, 403);
  if (Number(request.headers.get("content-length")) > 1024) return response({ error: "Request too large." }, 413);
  const raw = await request.text();
  if (raw.length > 1024) return response({ error: "Request too large." }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return response({ error: "Invalid request." }, 400); }
  const parsed = trackerSyncSchema.safeParse(body);
  if (!parsed.success) return response({ error: "Invalid step count or tracker." }, 400);
  if (parsed.data.userId !== user.id) return response({ error: "Your account changed. Open tracker settings and sync again." }, 409);
  const today = trackerDayWindow(new Date(), process.env.APP_TIMEZONE || "UTC").date;
  if (parsed.data.date !== today) return response({ error: "The day changed. Sync again to read today's steps." }, 409);
  const { source, date, steps } = parsed.data;
  // One counter per person/day/provider. Atomic upsert prevents retries adding duplicate logs.
  const result = await requireDb().execute(sql`
    insert into logs (user_id, date, kind, steps, source, tracker_synced_at)
    values (${user.id}, ${date}::date, 'steps', ${steps}, ${source}, now())
    on conflict (user_id, date, source) where kind = 'steps' and source in ('apple_health', 'health_connect')
    do update set steps = greatest(logs.steps, excluded.steps), tracker_synced_at = now()
    returning id, steps, (xmax = 0) as inserted`);
  const entry = (result.rows as { id: number; steps: number; inserted: boolean }[])[0];
  if (entry?.inserted && entry.steps > 0) notifyActivity(user, "steps", entry.id);
  for (const path of ["/", "/trends", "/log", "/trackers"]) revalidatePath(path);
  return response({ ok: true, steps: entry.steps, date, source, syncedAt: new Date().toISOString() });
}
