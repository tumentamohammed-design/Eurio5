import { useState } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, ShieldAlert, Download, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { fmtR } from '../../lib/format.js';
import { tradesToCsv, downloadCsv } from '../../lib/csv.js';
import ErrorBanner from '../Layout/ErrorBanner.jsx';
import LoadingBlock from '../Layout/LoadingBlock.jsx';

export default function TradeList({ onAdd, onEdit }) {
  const { trades, tradesLoading, tradesError, loadTrades, deleteTrade, atFreeLimit, monthlyTradeCount } = useApp();
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  async function handleDelete(t) {
    await deleteTrade(t.id, t.screenshot_path);
    setConfirmDeleteId(null);
  }

  function handleExport() {
    const csv = tradesToCsv(trades);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`fx-journal-${today}.csv`, csv);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-slate-400">
          {trades.length} trade{trades.length !== 1 ? 's' : ''} logged
          {!atFreeLimit && <span className="text-slate-600"> · {monthlyTradeCount}/30 this month on Free</span>}
        </div>
        <div className="flex items-center gap-2">
          {trades.length > 0 && (
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 text-sm hover:bg-slate-900">
              <Download size={15} /> Export CSV
            </button>
          )}
          {atFreeLimit ? (
            <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-sm font-semibold hover:bg-amber-300">
              <Lock size={15} /> Upgrade to add more
            </button>
          ) : (
            <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-slate-950 text-sm font-semibold hover:bg-brand-400">
              <Plus size={16} /> Log trade
            </button>
          )}
        </div>
      </div>

      {tradesError && <ErrorBanner message={`Couldn't load your trades: ${tradesError}`} onRetry={loadTrades} retrying={tradesLoading} />}

      {tradesLoading && trades.length === 0 ? (
        <LoadingBlock label="Loading your trades…" />
      ) : trades.length === 0 && !tradesError ? (
        <div className="text-center py-16 text-slate-500 text-sm">Nothing here yet.</div>
      ) : (
        <div className="space-y-2">
          {[...trades].reverse().map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-100">{t.pair}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">{t.direction}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${
                      t.result === 'win' ? 'border-brand-500/40 text-brand-400' :
                      t.result === 'loss' ? 'border-red-500/40 text-red-400' :
                      t.result === 'breakeven' ? 'border-slate-500/40 text-slate-400' :
                      'border-amber-500/40 text-amber-300'
                    }`}>{t.result}</span>
                    {t.followed_routine ? (
                      <span className="text-xs flex items-center gap-1 text-brand-400"><ShieldCheck size={12} /> routine</span>
                    ) : (
                      <span className="text-xs flex items-center gap-1 text-red-400"><ShieldAlert size={12} /> off-routine</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {t.date} · {t.time} · {t.setup || 'no setup name'} · {t.session || '—'} ({t.liquidity} liquidity)
                  </div>
                  {t.rule_violations && t.rule_violations.length > 0 && (
                    <div className="text-xs text-red-400/80 mt-1">⚠ {t.rule_violations.join('; ')}</div>
                  )}
                  {t.notes ? <div className="text-sm text-slate-400 mt-1.5 line-clamp-2">{t.notes}</div> : null}
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-data text-lg ${Number(t.r_achieved) >= 0 ? 'text-brand-400' : 'text-red-400'}`}>{fmtR(t.r_achieved)}</div>
                  <div className="flex gap-1 mt-2 justify-end">
                    <button onClick={() => onEdit(t)} className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400" aria-label="Edit trade">
                      <Pencil size={14} />
                    </button>
                    {confirmDeleteId === t.id ? (
                      <button onClick={() => handleDelete(t)} className="px-2 py-1 rounded-md bg-red-500/20 text-red-300 text-xs">Confirm?</button>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(t.id)} className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400" aria-label="Delete trade">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
