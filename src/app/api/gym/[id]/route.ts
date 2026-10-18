import { sql } from "drizzle-orm";
import { db } from "@/db";
import { notFound, photoResponse } from "@/lib/photo-response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!db || !Number.isSafeInteger(id) || id < 1) return notFound();
  const res = await db.execute(sql`select photo_b64 from gym_posts where id = ${id} and photo_b64 is not null`);
  const row = (res.rows as { photo_b64: string }[])[0];
  if (!row) return notFound();
  return photoResponse(row.photo_b64, new URL(request.url));
}
