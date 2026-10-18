import { redirect } from "next/navigation";
import { StepTrackers } from "@/components/StepTrackers";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Connect steps" };
export const maxDuration = 300;
export default async function TrackersPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return <StepTrackers userId={user.id} />;
}
