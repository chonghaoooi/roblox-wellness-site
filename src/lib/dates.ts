import { fmtDate, parseDate } from "./calc";

/** Calendar date (YYYY-MM-DD) "today" in APP_TIMEZONE. */
export function todayStr(now = new Date()): string {
  const tz = process.env.APP_TIMEZONE || "UTC";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(s: string, n: number): string {
  return fmtDate(new Date(parseDate(s).getTime() + n * 86400000));
}
