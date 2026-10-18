import { sql } from "drizzle-orm";
import { db } from "@/db";

// 1x1 transparent PNG: people without a picture get this, so the letter avatar underneath stays visible and the browser logs no 404s.
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==", "base64");
const headers = { "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=60, stale-while-revalidate=300" };

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const username = decodeURIComponent((await params).username).slice(0, 40);
  if (db) {
    try {
      const res = (await db.execute(sql`
        select coalesce(a.override_b64, a.data_b64) as img
        from avatars a join users u on u.id = a.user_id where u.username = ${username}`)) as unknown as { rows: { img: string | null }[] };
      const img = res.rows[0]?.img;
      if (img) return new Response(Buffer.from(img, "base64"), { headers: { ...headers, "Content-Type": "image/jpeg" } });
    } catch {
      console.error("[avatar] lookup failed");
    }
  }
  return new Response(PIXEL, { headers: { ...headers, "Content-Type": "image/png" } });
}
