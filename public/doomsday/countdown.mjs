// Marvel's official clock counts down to 2026-12-18T05:00:00Z.
export const TARGET_ISO = '2026-12-18T05:00:00Z';
export const TARGET_MS = Date.parse(TARGET_ISO);

export function timeRemaining(nowMs, targetMs = TARGET_MS) {
  if (nowMs >= targetMs) {
    return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, complete: true };
  }

  const now = new Date(nowMs);
  const target = new Date(targetMs);
  let months = (target.getUTCFullYear() - now.getUTCFullYear()) * 12
    + target.getUTCMonth() - now.getUTCMonth();

  // Count full calendar months, clamping dates at each month's end.
  function addMonths(date, count) {
    const first = new Date(Date.UTC(
      date.getUTCFullYear(), date.getUTCMonth() + count, 1,
      date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()
    ));
    const finalDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(date.getUTCDate(), finalDay));
    return first.getTime();
  }

  while (months > 0 && addMonths(now, months) > targetMs) months--;
  let anchorMs = addMonths(now, months);
  while (addMonths(now, months + 1) <= targetMs) {
    months++;
    anchorMs = addMonths(now, months);
  }

  let secondsLeft = Math.floor((targetMs - anchorMs) / 1000);
  const days = Math.floor(secondsLeft / 86400);
  secondsLeft %= 86400;
  const hours = Math.floor(secondsLeft / 3600);
  secondsLeft %= 3600;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return { months, days, hours, minutes, seconds, complete: false };
}
