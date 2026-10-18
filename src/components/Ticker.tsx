import { getTickerMessage } from "@/lib/site-config";

// Always-on scrolling banner. Pauses (static, centred) for people who prefer reduced motion.
export async function Ticker() {
  const message = (await getTickerMessage()).replace(/\s*•\s*/gu, " • ").trim();
  if (!message) return null;
  return (
    <div className="ticker overflow-hidden border-b-4 border-black bg-black py-1 text-sun" role="marquee" aria-label={message}>
      <div className="ticker-track font-display text-base sm:text-lg" aria-hidden>
        {[0, 1].map((n) => (
          <span key={n} className="ticker-set">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="ticker-message">{message}{" • "}</span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
