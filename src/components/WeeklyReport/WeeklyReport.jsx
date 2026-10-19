import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useApp } from '../../context/AppContext.jsx';
import { weekKey } from '../../lib/format.js';
import ErrorBanner from '../Layout/ErrorBanner.jsx';
import LoadingBlock from '../Layout/LoadingBlock.jsx';

export default function WeeklyReport() {
  const { trades, tradesLoading, tradesError, loadTrades } = useApp();

  const weeklyStats = useMemo(() => {
    const map = {};
    trades.forEach((t) => {
      const key = weekKey(t.date);
      if (!map[key]) map[key] = { week: key, trades: 0, wins: 0, closed: 0, discipline: 0 };
      map[key].trades += 1;
      map[key].discipline += t.followed_routine ? 1 : -1;
      if (t.result !== 'open') {
        map[key].closed += 1;
        if (t.result === 'win') map[key].wins += 1;
      }
    });
    return Object.values(map).sort((a, b) => (a.week < b.week ? 1 : -1));
  }, [trades]);

  if (tradesLoading && trades.length === 0) return <LoadingBlock label="Loading your trades…" />;
  if (tradesError && trades.length === 0) {
    return <ErrorBanner message={`Couldn't load your trades: ${tradesError}`} onRetry={loadTrades} retrying={tradesLoading} />;
  }
  if (weeklyStats.length === 0) {
    return <div className="text-center py-16 text-slate-500 text-sm">No trades logged yet — weekly reports will appear here.</div>;
  }

  const chartData = [...weeklyStats].reverse();

  return (
    <div className="space-y-6">
      {tradesError && <ErrorBanner message={`Showing cached data — refresh failed: ${tradesError}`} onRetry={loadTrades} retrying={tradesLoading} />}

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-sm font-medium text-slate-300 mb-2">Discipline score by week</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="week" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 12 }} />
            <Bar dataKey="discipline" radius={[4, 4, 0, 0]}>
              {chartData.map((w, i) => <Cell key={i} fill={w.discipline >= 0 ? '#3ecb7e' : '#f87171'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {weeklyStats.map((w) => (
          <div key={w.week} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex items-center justify-between">
            <div>
              <div className="font-data text-sm text-slate-200">{w.week}</div>
              <div className="text-xs text-slate-500 mt-1">
                {w.trades} trade{w.trades !== 1 ? 's' : ''} · {w.closed ? `${((w.wins / w.closed) * 100).toFixed(0)}% win rate` : 'no closed trades'}
              </div>
            </div>
            <div className={`font-data text-lg ${w.discipline >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
              {w.discipline > 0 ? `+${w.discipline}` : w.discipline}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
