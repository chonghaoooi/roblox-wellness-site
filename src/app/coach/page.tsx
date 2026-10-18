import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { CoachChat } from "@/components/CoachChat";
import { requireDb } from "@/db";
import { coachMessages } from "@/db/schema";
import { aiEnabled } from "@/lib/ai";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Adil bot (coach)" };
// The AI can take a while to answer; the default serverless limit on the free plan is shorter than that.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const NOTE =
  "This is a bot with a texting style inspired by Adil. It is not the real Adil. It answers from your own logs (weight, meals, steps, gym check-ins, lifts and goals) plus anonymous community averages, and never sees anyone else's data. It is an AI, not a doctor: for pain, injuries, medical conditions or eating worries, talk to a professional. Your messages are saved so the chat continues next time.";

export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const rows = await requireDb()
    .select({ id: coachMessages.id, role: coachMessages.role, content: coachMessages.content })
    .from(coachMessages)
    .where(eq(coachMessages.userId, user.id))
    .orderBy(desc(coachMessages.id))
    .limit(40);
  const initial = rows.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  return (
    <div className="coach-shell mx-auto flex max-w-3xl flex-col gap-3 px-2 py-2 sm:gap-4 sm:px-4 sm:py-8">
      <h1 className="rb-text text-4xl max-sm:sr-only">ADIL BOT</h1>
      <p className="panel hidden px-4 py-3 text-base sm:block">{NOTE}</p>
      <details className="panel px-3 py-2 text-sm sm:hidden">
        <summary className="cursor-pointer font-display text-base">How this works</summary>
        <p className="mt-2">{NOTE}</p>
      </details>
      <CoachChat initial={initial} aiOn={aiEnabled} />
    </div>
  );
}
