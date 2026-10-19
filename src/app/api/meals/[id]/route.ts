import { sql } from "drizzle-orm";
import { db } from "@/db";
import { notFound, photoResponse } from "@/lib/photo-response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!db || !Number.isSafeInteger(id) || id < 1) return notFound();
  const i = Number(new URL(request.url).searchParams.get("i") ?? 0);
  if (i !== 0 && i !== 1 && i !== 2) return notFound();
  const res = (await db.execute(i === 0 ? sql`select data_b64 from meals where id = ${id}` : sql`select data_b64 from meal_photos where meal_id = ${id} and position = ${i}`)) as unknown as { rows: { data_b64: string }[] };
  const row = res.rows[0];
  if (!row?.data_b64) return notFound();
  return photoResponse(row.data_b64, new URL(request.url));
}
