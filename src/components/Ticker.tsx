import { getTickerMessage } from "@/lib/site-config";
import { TickerTimers } from "./TickerTimers";

// Always-on scrolling banner. Pauses (static, centred) for people who prefer reduced motion.
export async function Ticker() {
  const message = (await getTickerMessage()).replace(/\s*•\s*/gu, " • ").trim();
  return <TickerTimers message={message} />;
}
