// src/lib/timezone.js
// Africa/Douala is fixed at UTC+1 year-round (Cameroon observes no DST), so
// we can safely hardcode the offset rather than depend on the viewer's
// device timezone or a timezone database. This is what makes trade times
// mean the same thing "everywhere" the app is opened from.

export const DOUALA_UTC_OFFSET_HOURS = 1;

// Interprets a <date, time> pair (from the trade form's native date/time
// inputs) as Africa/Douala wall-clock time and returns the correct UTC
// instant — regardless of what timezone the browser/device is actually set
// to. This is what the rules engine and liquidity-window checks run against.
export function doualaWallClockToUTC(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const iso = `${dateStr}T${timeStr}:00+01:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// The Douala wall-clock hour (0–23) for a given real instant — used to draw
// the Liquidity Clock's 24h strip against Douala time explicitly, instead of
// the viewer's own device time.
export function doualaHourOfDay(date) {
  return (date.getUTCHours() + DOUALA_UTC_OFFSET_HOURS + 24) % 24;
}

export function doualaMinuteOfDay(date) {
  return (date.getUTCHours() * 60 + date.getUTCMinutes() + DOUALA_UTC_OFFSET_HOURS * 60) % (24 * 60);
}

// Formats any Date as Africa/Douala local time for display, no matter what
// timezone the viewer's device is actually in.
export function formatDouala(date, opts = {}) {
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Douala', ...opts }).format(date);
}

export function formatDoualaClock(date) {
  return formatDouala(date, { hour: '2-digit', minute: '2-digit' });
}

export function formatDoualaDateTime(isoStringOrDate) {
  const d = isoStringOrDate instanceof Date ? isoStringOrDate : new Date(isoStringOrDate);
  return formatDouala(d, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// "Now", as seen in Africa/Douala — used to default the trade form's date
// and time fields regardless of the device's own timezone.
export function doualaNowParts() {
  const now = new Date();
  const hour = doualaHourOfDay(now);
  const minute = now.getUTCMinutes();

  // The Douala date rolls forward once UTC crosses 23:00 (23:00 UTC = 00:00
  // next day in UTC+1).
  const rolledOver = now.getUTCHours() === 23;
  const d = new Date(now);
  if (rolledOver) d.setUTCDate(d.getUTCDate() + 1);

  const pad = (n) => String(n).padStart(2, '0');
  return {
    dateStr: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    timeStr: `${pad(hour)}:${pad(minute)}`,
  };
}
