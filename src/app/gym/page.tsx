import { GymBlog } from "@/components/GymBlog";
import { GymSection } from "@/components/GymSection";
import { LogFab } from "@/components/LogFab";
import { getSettings, getUser } from "@/lib/auth";
import { todayStr } from "@/lib/dates";
import { gymBoards, gymPosts, hasGymCheckIn, rankDay, todayRows } from "@/lib/queries";

export const metadata = { title: "Gym + Steps" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function GymPage() {
  const user = await getUser();
  const today = todayStr();
  const [boards, dayRows, posts, checkedIn, settings] = await Promise.all([
    gymBoards(today),
    todayRows(today),
    gymPosts(30, user?.id),
    user ? hasGymCheckIn(user.id, today) : false,
    user ? getSettings(user.id) : null,
  ]);
  return <>
    <LogFab href={user ? "/log#gym" : "/login"} badge={Boolean(user) && !checkedIn} />
    <GymSection
      boards={boards}
      steps={rankDay(dayRows).steps}
      weightUnit={settings?.weightUnit === "lb" ? "lb" : "kg"}
      me={user?.username}
      blog={<GymBlog posts={posts} me={user?.username} weightUnit={settings?.weightUnit === "lb" ? "lb" : "kg"} />}
    />
  </>;
}
