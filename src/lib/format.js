// Generic, timezone-independent formatting helpers. Anything date/time
// related that needs to respect the app's Africa/Douala default lives in
// timezone.js instead — see doualaNowParts, formatDouala, etc.

export function fmtR(n) {
  const v = Number(n) || 0;
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
}

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function weekKey(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${pad(week)}`;
}
