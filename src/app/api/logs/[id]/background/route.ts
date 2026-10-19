import { sql } from "drizzle-orm";
import { db } from "@/db";
import { notFound, photoResponse } from "@/lib/photo-response";

/** The custom background a person uploaded for a steps card. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!db || !Number.isSafeInteger(id) || id < 1) return notFound();
  const res = (await db.execute(sql`select data_b64 from log_backgrounds where log_id = ${id}`)) as unknown as { rows: { data_b64: string }[] };
  const row = res.rows[0];
  if (!row) return notFound();
  return photoResponse(row.data_b64, new URL(request.url));
}
