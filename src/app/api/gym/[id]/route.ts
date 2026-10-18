import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!db || !Number.isSafeInteger(id) || id < 1) return new Response("Not found", { status: 404 });
  const res = await db.execute(sql`
    select photo_b64 from gym_posts where id = ${id}
      and photo_b64 is not null
  `);
  const row = (res.rows as { photo_b64: string }[])[0];
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(row.photo_b64, "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
