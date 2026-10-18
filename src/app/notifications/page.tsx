import { redirect } from "next/navigation";
import { MobileNotifications } from "@/components/MobileNotifications";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/notification-prompt";

export const metadata = { title: "Notifications" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!await getUser()) redirect("/login");
  const { next } = await searchParams;
  // `next` is only set when someone was sent here from another page; it is where they return to.
  return <div className="px-3 py-8 sm:px-4"><MobileNotifications next={next ? safeNext(next) : undefined} /></div>;
}
