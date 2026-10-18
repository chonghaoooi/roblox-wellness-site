import type { GymPost } from "@/lib/queries";
import { IconPlus } from "./icons";
import { GymCard } from "./PostCards";
import { EmptyState, LinkButton, SectionTitle } from "./ui";

export function GymBlog({ posts, me, weightUnit }: { posts: GymPost[]; me?: string; weightUnit: "kg" | "lb" }) {
  return (
    <section className="gym-blog py-12" aria-label="Gym blog" id="gym-blog">
      <div className="mx-auto max-w-5xl space-y-6 px-3 sm:px-4">
        <SectionTitle sub="The latest workouts, personal bests and gym notes from everyone.">GYM BLOG</SectionTitle>
        <LinkButton href={me ? "/log#gym" : "/signup"} color="purple" icon={<IconPlus />}>{me ? "Share your workout" : "Join the gym blog"}</LinkButton>
        {posts.length === 0 ? <EmptyState>No gym posts yet. Share your first workout!</EmptyState> : (
          <ul className="grid items-start gap-5 md:grid-cols-2">
            {posts.map((post) => <GymCard key={post.id} post={post} me={me} weightUnit={weightUnit} />)}
          </ul>
        )}
      </div>
    </section>
  );
}
