// src/lib/sessions.js
// All times are handled in GMT/UTC minutes-of-day (0–1439). JS Date already
// normalizes to UTC internally, so getUTCHours()/getUTCMinutes() give us
// correct GMT figures regardless of the browser's local timezone.

// The 4 major sessions, for the 24h clock visual (continuous open/close, GMT).
export const SESSIONS = [
  { name: 'Sydney', startGMT: 22 * 60, endGMT: 7 * 60 },
  { name: 'Tokyo', startGMT: 0 * 60, endGMT: 9 * 60 },
  { name: 'London', startGMT: 8 * 60, endGMT: 17 * 60 },
  { name: 'New York', startGMT: 13 * 60, endGMT: 22 * 60 },
];

// Exactly the high-liquidity windows you specified (minutes from 00:00 GMT).
export const HIGH_LIQUIDITY_WINDOWS = [
  { name: 'London Open', startGMT: 7 * 60, endGMT: 10 * 60 },
  { name: 'London/NY Overlap', startGMT: 12 * 60, endGMT: 16 * 60 },
  { name: 'NY Open', startGMT: 12 * 60 + 30, endGMT: 15 * 60 + 30 },
];

function inWindow(minuteOfDay, start, end) {
  return start <= end ? minuteOfDay >= start && minuteOfDay < end : minuteOfDay >= start || minuteOfDay < end;
}

export function gmtMinutesOfDay(date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function getActiveSessions(date) {
  const m = gmtMinutesOfDay(date);
  return SESSIONS.filter((s) => inWindow(m, s.startGMT, s.endGMT)).map((s) => s.name);
}

export function getActiveHighLiquidityWindows(date) {
  const m = gmtMinutesOfDay(date);
  return HIGH_LIQUIDITY_WINDOWS.filter((w) => inWindow(m, w.startGMT, w.endGMT));
}

export function isHighLiquidity(date) {
  return getActiveHighLiquidityWindows(date).length > 0;
}

// Returns { name, startGMT, endGMT, minutesUntil } for whichever
// high-liquidity window starts soonest from `date` (today, wrapping to
// tomorrow if all of today's windows have passed).
export function getNextHighLiquidityWindow(date) {
  const m = gmtMinutesOfDay(date);
  let best = null;
  HIGH_LIQUIDITY_WINDOWS.forEach((w) => {
    let minutesUntil = w.startGMT - m;
    if (minutesUntil < 0) minutesUntil += 24 * 60;
    if (best === null || minutesUntil < best.minutesUntil) best = { ...w, minutesUntil };
  });
  return best;
}

export function minutesToLabel(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}m`;
}

export function gmtMinutesToClock(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
