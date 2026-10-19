// Client-side CSV export — no library needed for a flat table like this.
function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const COLUMNS = [
  'date', 'time', 'pair', 'direction', 'entry', 'sl', 'tp', 'planned_rr',
  'setup', 'result', 'r_achieved', 'emotion', 'followed_routine',
  'session', 'liquidity', 'notes',
];

export function tradesToCsv(trades) {
  const header = COLUMNS.join(',');
  const rows = trades.map((t) => COLUMNS.map((col) => csvEscape(t[col])).join(','));
  return [header, ...rows].join('\n');
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
