import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { formatDoualaDateTime } from '../../lib/timezone.js';
import ErrorBanner from '../Layout/ErrorBanner.jsx';
import LoadingBlock from '../Layout/LoadingBlock.jsx';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];

function impactClasses(impact) {
  if (impact === 'High') return 'text-red-400 bg-red-500/10 border-red-500/30';
  if (impact === 'Medium') return 'text-amber-300 bg-amber-400/10 border-amber-400/30';
  if (impact === 'Holiday') return 'text-slate-500 bg-slate-500/10 border-slate-600/30';
  return 'text-slate-400 bg-slate-500/10 border-slate-600/30';
}

export default function FxCalendar() {
  const { calendarEvents, calendarLoading, calendarError, loadCalendar } = useApp();
  const [activeCurrencies, setActiveCurrencies] = useState(new Set(CURRENCIES));

  function toggleCurrency(c) {
    setActiveCurrencies((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  const filtered = useMemo(() => {
    return [...calendarEvents]
      .filter((e) => activeCurrencies.has((e.country || '').toUpperCase()))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [calendarEvents, activeCurrencies]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => toggleCurrency(c)}
              className={`px-2.5 py-1 rounded-md text-xs border font-data transition-colors ${
                activeCurrencies.has(c)
                  ? 'bg-brand-400/15 border-brand-400/40 text-brand-200'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <button onClick={loadCalendar} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-300">
          <RefreshCw size={13} className={calendarLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="text-xs text-slate-600">
        Times shown in Africa/Douala (GMT+1). Source: unofficial community calendar feed — see comments in <code className="font-data">api/calendar.js</code> for details and paid alternatives.
      </div>

      {calendarError && <ErrorBanner message={`Couldn't load the calendar: ${calendarError}`} onRetry={loadCalendar} retrying={calendarLoading} />}

      {calendarLoading && filtered.length === 0 ? (
        <LoadingBlock label="Loading calendar…" />
      ) : filtered.length === 0 && !calendarError ? (
        <div className="text-center py-16 text-slate-500 text-sm">No events match your currency filter this week.</div>
      ) : filtered.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
                <th className="px-3 py-2 font-medium whitespace-nowrap">Time (Douala)</th>
                <th className="px-3 py-2 font-medium">Currency</th>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Impact</th>
                <th className="px-3 py-2 font-medium">Forecast</th>
                <th className="px-3 py-2 font-medium">Actual</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={i} className="border-b border-slate-800/60 last:border-0">
                  <td className="px-3 py-2 font-data text-slate-300 whitespace-nowrap">{formatDoualaDateTime(e.date)}</td>
                  <td className="px-3 py-2 font-data text-slate-400">{e.country}</td>
                  <td className="px-3 py-2 text-slate-200">{e.title}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${impactClasses(e.impact)}`}>{e.impact}</span>
                  </td>
                  <td className="px-3 py-2 font-data text-slate-400">{e.forecast ?? '—'}</td>
                  <td className="px-3 py-2 font-data text-slate-400">{e.actual ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
