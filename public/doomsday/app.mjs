import { timeRemaining } from './countdown.mjs';

const fields = Object.fromEntries(
  ['months', 'days', 'hours', 'minutes', 'seconds'].map(key => [key, document.querySelector(`[data-unit="${key}"]`)])
);
const status = document.getElementById('status');
let clockOffsetMs = 0;
let lastMinute = '';
let lastSecond = '';

function render() {
  const remaining = timeRemaining(Date.now() + clockOffsetMs);
  for (const [key, element] of Object.entries(fields)) {
    element.textContent = String(remaining[key]).padStart(2, '0');
  }
  const secondKey = `${remaining.months}-${remaining.days}-${remaining.hours}-${remaining.minutes}-${remaining.seconds}`;
  if (lastSecond && secondKey !== lastSecond && !remaining.complete) {
    window.dispatchEvent(new CustomEvent('doomsday-second', { detail: remaining.seconds }));
  }
  lastSecond = secondKey;
  const minute = `${remaining.months}-${remaining.days}-${remaining.hours}-${remaining.minutes}`;
  if (remaining.complete) {
    status.textContent = 'Doomsday has arrived.';
    document.body.classList.add('arrived');
  } else if (minute !== lastMinute) {
    status.textContent = `${remaining.months} months, ${remaining.days} days, ${remaining.hours} hours and ${remaining.minutes} minutes until Avengers: Doomsday.`;
    lastMinute = minute;
  }
  window.setTimeout(render, Math.max(100, 1000 - ((Date.now() + clockOffsetMs) % 1000) + 10));
}

// A same-origin response's Date header helps correct a device clock that is slightly off.
// The local clock remains usable when the request is unavailable or the header is absent.
async function syncTime() {
  try {
    const sent = Date.now();
    const response = await fetch(location.pathname, { method: 'HEAD', cache: 'no-store' });
    const received = Date.now();
    const serverTime = Date.parse(response.headers.get('Date') || '');
    if (Number.isFinite(serverTime)) {
      clockOffsetMs = serverTime + (received - sent) / 2 - received;
    }
  } catch { /* Local time still drives the clock. */ }
}

render();
syncTime();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncTime();
});
