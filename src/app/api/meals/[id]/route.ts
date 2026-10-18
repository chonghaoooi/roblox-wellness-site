import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!db || !Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const res = (await db.execute(
    sql`select data_b64 from meals where id = ${id}`,
  )) as unknown as { rows: { data_b64: string }[] };
  const row = res.rows[0];
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(row.data_b64, "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
