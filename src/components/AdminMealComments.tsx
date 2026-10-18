import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { removeComment, removeGymComment } from "@/app/admin/comment-actions";

type Row = { id: number; post_id: number; text: string; username: string; kind: "meal" | "gym" };

export async function AdminMealComments() {
  await requireAdmin();
  const result = await requireDb().execute(sql`
    select * from (
      select c.id, c.meal_id as post_id, c.text, u.username, 'meal' as kind, c.created_at
      from meal_comments c join users u on u.id = c.user_id
      union all
      select c.id, c.post_id, c.text, u.username, 'gym' as kind, c.created_at
      from gym_post_comments c join users u on u.id = c.user_id
    ) x order by created_at desc limit 100`);
  const comments = result.rows as Row[];
  return <section className="panel space-y-4 p-5"><h2 className="rb-text text-2xl">POST COMMENTS</h2>
    <p className="text-sm">Latest 100 comments on meals and workouts. Removing a comment keeps the post and its photo.</p>
    {!comments.length && <p>No comments yet.</p>}
    {comments.map((c) => <article key={`${c.kind}${c.id}`} className="space-y-2 rounded-lg bg-black/30 p-3">
      <p className="font-bold text-neon">{c.username} · {c.kind === "gym" ? "workout" : "meal"} #{c.post_id}</p><p className="break-words">{c.text}</p>
      <form action={(c.kind === "gym" ? removeGymComment : removeComment).bind(null, c.id)}><button className="btn btn-red !text-sm">Remove comment</button></form>
    </article>)}
  </section>;
}
