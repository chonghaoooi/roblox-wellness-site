import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { removeComment } from "@/app/admin/comment-actions";

export async function AdminMealComments() {
  await requireAdmin();
  const result = await requireDb().execute(sql`select c.id, c.meal_id, c.text, u.username
    from meal_comments c join users u on u.id = c.user_id order by c.id desc limit 100`);
  const comments = result.rows as { id: number; meal_id: number; text: string; username: string }[];
  return <section className="panel space-y-4 p-5"><h2 className="rb-text text-2xl">MEAL COMMENTS</h2>
    <p className="text-sm">Latest 100 comments. Removing a comment keeps the meal and its photo.</p>
    {!comments.length && <p>No comments yet.</p>}
    {comments.map((c) => <article key={c.id} className="space-y-2 rounded-lg bg-black/30 p-3">
      <p className="font-bold text-neon">{c.username} · meal #{c.meal_id}</p><p className="break-words">{c.text}</p>
      <form action={removeComment.bind(null, c.id)}><button className="btn btn-red !text-sm">Remove comment</button></form>
    </article>)}
  </section>;
}
