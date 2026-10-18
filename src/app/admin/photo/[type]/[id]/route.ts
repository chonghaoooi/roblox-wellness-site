import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { getAdmin } from "@/lib/admin-auth";
import { adminIdSchema } from "@/lib/admin-validation";

export async function GET(_: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  const values = await params;
  const id = adminIdSchema.safeParse(values.id);
  if (!id.success || !["gym", "meal"].includes(values.type)) return new Response("Not found", { status: 404 });
  const result = await requireDb().execute(values.type === "gym"
    ? sql`select photo_b64 as photo from gym_posts where id=${id.data}`
    : sql`select data_b64 as photo from meals where id=${id.data}`);
  const photo = result.rows[0]?.photo;
  if (typeof photo !== "string") return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(photo, "base64"), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
