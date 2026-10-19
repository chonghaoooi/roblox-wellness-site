import { LogFab } from "@/components/LogFab";
import { PostFeed } from "@/components/PostFeed";
import { todayStr } from "@/lib/dates";
import { getSettings, getUser } from "@/lib/auth";
import { gymPosts, recentMeals, recentSteps, recentWeighIns } from "@/lib/queries";

export const metadata = { title: "Posts" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function PostsPage() {
  const user = await getUser();
  const [meals, gym, steps, weighIns, settings] = await Promise.all([recentMeals(user?.id), gymPosts(60, user?.id), recentSteps(todayStr(), user?.id), recentWeighIns(todayStr(), user?.id), user ? getSettings(user.id) : null]);
  return <>
    <PostFeed meals={meals} gym={gym} steps={steps} weighIns={weighIns} me={user?.username} weightUnit={settings?.weightUnit === "lb" ? "lb" : "kg"} />
    <LogFab href={user ? "/log#meal" : "/login"} />
  </>;
}
