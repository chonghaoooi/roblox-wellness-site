import { announceUpdateIfNew, runReminder } from "@/lib/reminders";
import { isReminderKind } from "@/lib/reminders-shared";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Called by Vercel Cron (see vercel.json), one schedule per reminder: /api/cron/reminders?kind=breakfast
 * Vercel sends "Authorization: Bearer $CRON_SECRET". Add &dry=1 to see how many people WOULD be reminded without sending.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  if (!isReminderKind(kind)) return Response.json({ error: "Unknown reminder kind" }, { status: 400 });
  const dry = url.searchParams.get("dry") === "1";
  // Piggyback: whichever scheduled run comes first after a deploy also announces the new version.
  const update = dry ? null : await announceUpdateIfNew().catch(() => ({ announced: false, reason: "error" }));
  const result = await runReminder(kind, { dry });
  return Response.json({ ...result, update });
}
