import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../../context/AppContext.jsx';
import { fmtR } from '../../lib/format.js';
import StatCard from './StatCard.jsx';
import ErrorBanner from '../Layout/ErrorBanner.jsx';
import LoadingBlock from '../Layout/LoadingBlock.jsx';

export default function Dashboard({ onLogTrade }) {
  const { trades, tradesLoading, tradesError, loadTrades } = useApp();

  const stats = useMemo(() => {
    const closed = trades.filter((t) => t.result !== 'open');
    const wins = closed.filter((t) => t.result === 'win');
    const losses = closed.filter((t) => t.result === 'loss');
    const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
    const totalR = closed.reduce((s, t) => s + (Number(t.r_achieved) || 0), 0);
    const avgR = closed.length ? totalR / closed.length : 0;
    const grossWin = wins.reduce((s, t) => s + Math.max(0, Number(t.r_achieved) || 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + Math.min(0, Number(t.r_achieved) || 0), 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
    const disciplineScore = trades.reduce((s, t) => s + (t.followed_routine ? 1 : -1), 0);

    const setupMap = {};
    closed.forEach((t) => {
      const key = t.setup || 'Unnamed';
      if (!setupMap[key]) setupMap[key] = { setup: key, wins: 0, total: 0, totalR: 0 };
      setupMap[key].total += 1;
      if (t.result === 'win') setupMap[key].wins += 1;
      setupMap[key].totalR += Number(t.r_achieved) || 0;
    });
    const setupStats = Object.values(setupMap)
      .map((s) => ({ ...s, winRate: s.total ? (s.wins / s.total) * 100 : 0, avgR: s.total ? s.totalR / s.total : 0 }))
      .sort((a, b) => b.avgR - a.avgR);

    let cum = 0;
    const equityCurve = closed.map((t, i) => {
      cum += Number(t.r_achieved) || 0;
      return { n: i + 1, R: Number(cum.toFixed(2)) };
    });

    return {
      winRate, avgR, profitFactor, disciplineScore, setupStats, equityCurve,
      wins: wins.length, losses: losses.length, closedTrades: closed.length,
    };
  }, [trades]);

  if (tradesLoading && trades.length === 0) {
    return <LoadingBlock label="Loading your trades…" />;
  }

  if (tradesError && trades.length === 0) {
    return <ErrorBanner message={`Couldn't load your trades: ${tradesError}`} onRetry={loadTrades} retrying={tradesLoading} />;
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p className="text-lg">No trades logged yet.</p>
        <p className="text-sm mt-1">Log your first trade to start seeing stats here.</p>
        <button onClick={onLogTrade} className="mt-5 px-4 py-2 rounded-lg bg-brand-500 text-slate-950 font-semibold text-sm hover:bg-brand-400">
          Log a trade
        </button>
      </div>
    );
  }

  const bestSetup = stats.setupStats[0];
  const worstSetup = stats.setupStats[stats.setupStats.length - 1];
  const pieData = [{ name: 'Wins', value: stats.wins }, { name: 'Losses', value: stats.losses }];
  const pieColors = ['#3ecb7e', '#f87171'];

  return (
    <div className="space-y-6">
      {tradesError && <ErrorBanner message={`Showing cached data — refresh failed: ${tradesError}`} onRetry={loadTrades} retrying={tradesLoading} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Win rate" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.wins}W / ${stats.losses}L`} tone="brand" />
        <StatCard label="Avg R" value={fmtR(stats.avgR)} tone={stats.avgR >= 0 ? 'brand' : 'red'} />
        <StatCard label="Profit factor" value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)} tone="amber" />
        <StatCard
          label="Discipline score" value={stats.disciplineScore > 0 ? `+${stats.disciplineScore}` : stats.disciplineScore}
          sub="all-time" tone={stats.disciplineScore >= 0 ? 'brand' : 'red'}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-sm font-medium text-slate-300 mb-2">Equity curve (cumulative R)</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={stats.equityCurve} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="n" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 12 }} labelFormatter={(n) => `Trade #${n}`} />
            <Line type="monotone" dataKey="R" stroke="#3ecb7e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-sm font-medium text-slate-300 mb-2">Avg R by setup</div>
          {stats.setupStats.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">No closed trades yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.setupStats} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="setup" stroke="#64748b" fontSize={10} interval={0} angle={-15} textAnchor="end" height={40} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 12 }} />
                <Bar dataKey="avgR" radius={[4, 4, 0, 0]}>
                  {stats.setupStats.map((s, i) => <Cell key={i} fill={s.avgR >= 0 ? '#3ecb7e' : '#f87171'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-sm font-medium text-slate-300 mb-2">Win / loss split</div>
          {stats.closedTrades === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">No closed trades yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Best setup</div>
          {bestSetup ? (
            <div>
              <div className="text-slate-100 font-medium">{bestSetup.setup}</div>
              <div className="text-sm text-slate-400 mt-1">{fmtR(bestSetup.avgR)} avg · {bestSetup.winRate.toFixed(0)}% win rate · {bestSetup.total} trades</div>
            </div>
          ) : <div className="text-sm text-slate-500">Not enough data yet.</div>}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Weakest setup</div>
          {worstSetup && stats.setupStats.length > 1 ? (
            <div>
              <div className="text-slate-100 font-medium">{worstSetup.setup}</div>
              <div className="text-sm text-slate-400 mt-1">{fmtR(worstSetup.avgR)} avg · {worstSetup.winRate.toFixed(0)}% win rate · {worstSetup.total} trades</div>
            </div>
          ) : <div className="text-sm text-slate-500">Not enough data yet.</div>}
        </div>
      </div>
    </div>
  );
}
