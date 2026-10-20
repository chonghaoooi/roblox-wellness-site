// Trip day is 58 days after 2026-10-20 (Singapore). Counts down at Singapore midnight.
const TRIP_DAY = Date.UTC(2026, 11, 17);

// Always-on scrolling banner. Pauses (static, centred) for people who prefer reduced motion.
export async function Ticker() {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }).split("-").map(Number);
  const days = Math.max(0, Math.round((TRIP_DAY - Date.UTC(y, m - 1, d)) / 864e5));
  const message = `China trip countdown: ${days} ${days === 1 ? "day" : "days"} left`;
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
