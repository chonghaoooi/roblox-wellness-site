import { deletePost } from "@/app/actions";
import { kgToLb } from "@/lib/calc";
import { EXERCISES, isBodyweight, type Exercise } from "@/lib/lifts";
import type { GymPost } from "@/lib/queries";
import { IconPlus, IconTrash } from "./icons";
import { Avatar, EmptyState, LinkButton, SectionTitle, fmt } from "./ui";

export function GymBlog({ posts, me, weightUnit }: { posts: GymPost[]; me?: string; weightUnit: "kg" | "lb" }) {
  return (
    <section className="gym-blog py-12" aria-label="Gym blog" id="gym-blog">
      <div className="mx-auto max-w-5xl space-y-6 px-3 sm:px-4">
        <SectionTitle sub="The latest workouts, personal bests and gym notes from everyone.">GYM BLOG</SectionTitle>
        <LinkButton href={me ? "/log#gym" : "/signup"} color="purple" icon={<IconPlus />}>{me ? "Share your workout" : "Join the gym blog"}</LinkButton>
        {posts.length === 0 ? <EmptyState>No gym posts yet. Share your first workout!</EmptyState> : (
          <ul className="grid items-start gap-5 md:grid-cols-2">
            {posts.map((post) => (
              <li key={post.id} id={`gym-post-${post.id}`} className="min-w-0 scroll-mt-36">
                <article className="panel overflow-hidden !rounded-xl" aria-label={`Workout by ${post.username} on ${post.date}`}>
                  <div className="flex items-center gap-3 border-b-2 border-black p-4">
                    <Avatar name={post.username} size={36} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-xl">{post.username}</h3>
                      <time dateTime={post.date} className="text-sm text-sun">{post.date}</time>
                    </div>
                    {post.username === me && <form action={deletePost.bind(null, post.id)}><button className="btn btn-red !min-h-10 !px-3 !py-1" aria-label={`Delete your workout post from ${post.date}`}><IconTrash /></button></form>}
                  </div>
                  {post.hasPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/gym/${post.id}`} alt={`Workout shared by ${post.username}`} loading="lazy" className="max-h-96 w-full bg-black/40 object-contain" />
                  )}
                  <div className="space-y-4 p-4">
                    {!post.hasPhoto && !post.notes && post.lifts.length === 0 && <p className="text-sm">This workout photo is no longer available.</p>}
                    {post.notes && <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{post.notes}</p>}
                    {post.lifts.length > 0 && <ul className="space-y-2" aria-label="Lifts in this workout">
                      {post.lifts.map((lift, i) => {
                        const bw = isBodyweight(lift.exercise as Exercise);
                        const load = weightUnit === "lb" ? kgToLb(lift.kg) : lift.kg;
                        return <li key={i} className="rounded-lg border-2 border-white/20 bg-black/40 px-3 py-2">
                          <span className="block font-display">{EXERCISES[lift.exercise as Exercise] ?? lift.exercise}</span>
                          <span className="neon">{bw && lift.kg === 0 ? "Bodyweight" : `${bw ? "+" : ""}${fmt(load, 1)} ${weightUnit}`} × {lift.reps} reps</span>
                        </li>;
                      })}
                    </ul>}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
