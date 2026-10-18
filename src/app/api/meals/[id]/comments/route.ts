import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireDb } from "@/db";
import { getUser } from "@/lib/auth";
import { mealCommentInput } from "@/lib/meal-comments";

type Context = { params: Promise<{ id: string }> };
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const validId = (raw: string | null) => raw !== null && /^\d+$/.test(raw) && Number(raw) > 0 && Number(raw) <= 2147483647;

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  if (!validId(id)) return reply({ error: "Invalid meal." }, 400);
  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  if (before !== null && !validId(before)) return reply({ error: "Invalid page." }, 400);
  const user = await getUser();
  const db = requireDb();
  const found = await db.execute(sql`select id from meals where id = ${Number(id)}`);
  if (!found.rows.length) return reply({ error: "This meal is no longer available." }, 404);
  const result = await db.execute(sql`
    select c.id, u.username, c.text, c.created_at::text as "createdAt", (c.user_id = ${user?.id ?? 0}) as mine
    from meal_comments c join users u on u.id = c.user_id
    where c.meal_id = ${Number(id)} and c.id < ${before ? Number(before) : 2147483647}
    order by c.id desc limit 21`);
  const comments = result.rows.slice(0, 20);
  return reply({ comments, next: result.rows.length > 20 ? comments.at(-1)?.id : null });
}

export async function POST(request: Request, { params }: Context) {
  const user = await getUser();
  if (!user) return reply({ error: "Log in to comment." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid request origin." }, 403);
  const { id } = await params;
  if (!validId(id)) return reply({ error: "Invalid meal." }, 400);
  if (Number(request.headers.get("content-length")) > 2048) return reply({ error: "Comment too long." }, 413);
  const raw = await request.text();
  if (raw.length > 2048) return reply({ error: "Comment too long." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: "Invalid comment." }, 400); }
  const parsed = mealCommentInput.safeParse(body);
  if (!parsed.success) return reply({ error: parsed.error.issues[0].message }, 400);
  const result = await requireDb().execute(sql`
    insert into meal_comments (meal_id, user_id, text)
    select id, ${user.id}, ${parsed.data.text} from meals where id = ${Number(id)}
    and (select count(*) from meal_comments where user_id = ${user.id} and created_at > now() - interval '1 hour') < 30
    returning id, text, created_at::text as "createdAt"`);
  if (!result.rows.length) return reply({ error: "This meal was removed, or you've reached 30 comments this hour. Try again later." }, 409);
  revalidatePath("/meals");
  return reply({ comment: { ...result.rows[0], username: user.username, mine: true } }, 201);
}

export async function DELETE(request: Request, { params }: Context) {
  const user = await getUser();
  if (!user) return reply({ error: "Log in to remove your comment." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid request origin." }, 403);
  const { id } = await params;
  const comment = new URL(request.url).searchParams.get("comment");
  if (!validId(id) || !validId(comment)) return reply({ error: "Invalid comment." }, 400);
  const result = await requireDb().execute(sql`delete from meal_comments where id = ${Number(comment)}
    and meal_id = ${Number(id)} and user_id = ${user.id} returning id`);
  if (!result.rows.length) return reply({ error: "You can only remove your own comments." }, 403);
  revalidatePath("/meals");
  return reply({ ok: true });
}
