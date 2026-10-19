import { useEffect, useMemo, useState } from 'react';
import { Camera, Clock, ShieldAlert, X } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { evaluateTradeAgainstRules } from '../../lib/rules.js';
import { getActiveHighLiquidityWindows, getActiveSessions } from '../../lib/sessions.js';
import { doualaWallClockToUTC, doualaNowParts } from '../../lib/timezone.js';
import { resizeImageToBlob } from '../../lib/image.js';
import ToggleButtons from '../Layout/ToggleButtons.jsx';
import UpgradeBanner from '../Billing/UpgradeBanner.jsx';

const PAIR_OPTIONS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/JPY', 'GBP/JPY', 'EUR/GBP', 'XAU/USD'];

function blankTrade() {
  const { dateStr, timeStr } = doualaNowParts();
  return {
    id: null, date: dateStr, time: timeStr, pair: 'EUR/USD', direction: 'Long',
    entry: '', sl: '', tp: '', setup: '', result: 'open', r_achieved: '', emotion: 5, notes: '',
    followed_routine: true, screenshot_path: null,
  };
}

function emotionLabel(n) {
  if (n <= 3) return 'Calm / confident';
  if (n <= 6) return 'Neutral';
  return 'Anxious / FOMO';
}

export default function TradeForm({ editingTrade, onDone }) {
  const { rules, calendarEvents, saveTrade, getScreenshotUrl, trades, atFreeLimit } = useApp();

  const [form, setForm] = useState(editingTrade ? { ...editingTrade } : blankTrade());
  const [previewUrl, setPreviewUrl] = useState(editingTrade?.screenshot_path ? getScreenshotUrl(editingTrade.screenshot_path) : null);
  const [pendingBlob, setPendingBlob] = useState(null);
  const [removeScreenshot, setRemoveScreenshot] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);

  useEffect(() => {
    setForm(editingTrade ? { ...editingTrade } : blankTrade());
    setPreviewUrl(editingTrade?.screenshot_path ? getScreenshotUrl(editingTrade.screenshot_path) : null);
    setPendingBlob(null);
    setRemoveScreenshot(false);
    setManualOverride(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTrade]);

  const usedSetups = useMemo(() => [...new Set(trades.map((t) => t.setup).filter(Boolean))], [trades]);

  // Blocked only for NEW entries — editing an existing trade (e.g. closing
  // out an "open" position, fixing a typo) never counts against the quota,
  // matching the RLS policy in schema.sql which only checks on INSERT.
  const isEdit = !!form.id;
  if (!isEdit && atFreeLimit) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="text-lg font-semibold text-slate-100">Log a trade</div>
        <UpgradeBanner />
        <button onClick={onDone} className="text-sm text-slate-400 hover:text-slate-200">← Back to journal</button>
      </div>
    );
  }

  const doualaInstant = form.date && form.time ? doualaWallClockToUTC(form.date, form.time) : null;
  const sessionInfo = doualaInstant ? {
    active: getActiveSessions(doualaInstant),
    highWindows: getActiveHighLiquidityWindows(doualaInstant),
  } : { active: [], highWindows: [] };

  const violations = useMemo(
    () => evaluateTradeAgainstRules({ dateTimeLocal: doualaInstant?.toISOString(), pair: form.pair }, rules, calendarEvents),
    [doualaInstant, form.pair, rules, calendarEvents]
  );

  useEffect(() => {
    if (!manualOverride) {
      setForm((p) => ({ ...p, followed_routine: violations.length === 0 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [violations.length]);

  async function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const { blob, previewUrl: url } = await resizeImageToBlob(file);
      setPendingBlob(blob);
      setPreviewUrl(url);
      setRemoveScreenshot(false);
    } catch (err) {
      setError('Could not read that image — try a different file.');
    }
  }

  function handleRemoveScreenshot() {
    setPendingBlob(null);
    setPreviewUrl(null);
    setRemoveScreenshot(true);
  }

  async function handleSave() {
    if (!form.date || !form.time || !form.pair) { setError('Date, time and pair are required.'); return; }
    if (form.entry === '' || form.sl === '' || form.tp === '') { setError('Entry, stop loss and take profit are required.'); return; }
    setError('');
    setSaving(true);
    try {
      const risk = Math.abs(Number(form.entry) - Number(form.sl));
      const reward = Math.abs(Number(form.tp) - Number(form.entry));
      const plannedRR = risk > 0 ? reward / risk : 0;

      let rAchieved = form.r_achieved;
      if (rAchieved === '' || rAchieved === null || rAchieved === undefined) {
        if (form.result === 'win') rAchieved = plannedRR;
        else if (form.result === 'loss') rAchieved = -1;
        else rAchieved = 0;
      }

      const payload = {
        id: form.id,
        date: form.date,
        time: form.time,
        pair: form.pair,
        direction: form.direction,
        entry: Number(form.entry),
        sl: Number(form.sl),
        tp: Number(form.tp),
        planned_rr: Number(plannedRR.toFixed(2)),
        setup: form.setup || null,
        result: form.result,
        r_achieved: Number(Number(rAchieved).toFixed(2)),
        emotion: Number(form.emotion),
        notes: form.notes || null,
        followed_routine: form.followed_routine,
        rule_violations: violations,
        session: sessionInfo.active.join(' / ') || null,
        liquidity: sessionInfo.highWindows.length > 0 ? 'High' : 'Standard',
      };

      await saveTrade(payload, pendingBlob, removeScreenshot);
      onDone();
    } catch (err) {
      if (err.message === 'FREE_LIMIT_REACHED') {
        setError("You've hit the free plan's 30 entries/month limit. Upgrade to Pro from the Billing tab for unlimited entries.");
      } else {
        setError(err.message || 'Failed to save trade.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="text-lg font-semibold text-slate-100">{isEdit ? 'Edit trade' : 'Log a trade'}</div>

      <div className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${sessionInfo.highWindows.length ? 'text-brand-300 bg-brand-400/10 border-brand-400/40' : 'text-slate-400 bg-slate-500/10 border-slate-500/30'}`}>
        <Clock size={13} />
        {sessionInfo.active.length ? sessionInfo.active.join(' / ') : 'Off-session'} · {sessionInfo.highWindows.length ? sessionInfo.highWindows.map((w) => w.name).join(', ') : 'standard liquidity'}
      </div>

      {violations.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-sm text-red-300 font-medium">
            <ShieldAlert size={14} /> This breaks your discipline rule{violations.length > 1 ? 's' : ''}:
          </div>
          <ul className="text-xs text-red-300/90 list-disc list-inside">
            {violations.map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">Date</label>
          <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Time (Africa/Douala, GMT+1)</label>
          <input type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
            className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500">Pair</label>
        <input list="pair-options" value={form.pair} onChange={(e) => setForm((p) => ({ ...p, pair: e.target.value }))}
          className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <datalist id="pair-options">{PAIR_OPTIONS.map((p) => <option key={p} value={p} />)}</datalist>
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-1.5">Direction</label>
        <ToggleButtons options={[{ value: 'Long', label: 'Long' }, { value: 'Short', label: 'Short' }]} value={form.direction} onChange={(v) => setForm((p) => ({ ...p, direction: v }))} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500">Entry</label>
          <input type="number" step="any" value={form.entry} onChange={(e) => setForm((p) => ({ ...p, entry: e.target.value }))}
            className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-data" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Stop loss</label>
          <input type="number" step="any" value={form.sl} onChange={(e) => setForm((p) => ({ ...p, sl: e.target.value }))}
            className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-data" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Take profit</label>
          <input type="number" step="any" value={form.tp} onChange={(e) => setForm((p) => ({ ...p, tp: e.target.value }))}
            className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-data" />
        </div>
      </div>
      {form.entry !== '' && form.sl !== '' && form.tp !== '' && (
        <div className="text-xs text-slate-500 -mt-3">
          Planned RR: <span className="font-data text-brand-300">
            {(() => {
              const risk = Math.abs(Number(form.entry) - Number(form.sl));
              const reward = Math.abs(Number(form.tp) - Number(form.entry));
              return risk > 0 ? (reward / risk).toFixed(2) : '—';
            })()}
          </span>
        </div>
      )}

      <div>
        <label className="text-xs text-slate-500">Setup name</label>
        <input list="setup-options" value={form.setup} onChange={(e) => setForm((p) => ({ ...p, setup: e.target.value }))}
          placeholder="e.g. London breakout, EMA pullback…"
          className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <datalist id="setup-options">{usedSetups.map((s) => <option key={s} value={s} />)}</datalist>
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-1.5">Result</label>
        <ToggleButtons
          options={[{ value: 'open', label: 'Open' }, { value: 'win', label: 'Win' }, { value: 'loss', label: 'Loss' }, { value: 'breakeven', label: 'Breakeven' }]}
          value={form.result} onChange={(v) => setForm((p) => ({ ...p, result: v }))}
        />
      </div>

      <div>
        <label className="text-xs text-slate-500">R achieved (leave blank to auto-fill from result)</label>
        <input type="number" step="any" value={form.r_achieved} onChange={(e) => setForm((p) => ({ ...p, r_achieved: e.target.value }))}
          placeholder="auto" className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-data" />
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-1.5">Emotion while in the trade: {form.emotion}/10 — {emotionLabel(form.emotion)}</label>
        <input type="range" min="1" max="10" value={form.emotion} onChange={(e) => setForm((p) => ({ ...p, emotion: e.target.value }))} className="w-full accent-brand-500" />
      </div>

      <div>
        <label className="text-xs text-slate-500">Notes</label>
        <textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
      </div>

      <div>
        <label className="text-xs text-slate-500 block mb-1.5">Screenshot</label>
        {previewUrl ? (
          <div className="relative inline-block">
            <img src={previewUrl} alt="Trade screenshot" className="max-h-48 rounded-lg border border-slate-800" />
            <button onClick={handleRemoveScreenshot} className="absolute -top-2 -right-2 bg-slate-900 border border-slate-700 rounded-full p-1 text-slate-300 hover:text-red-400">
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 w-fit px-3 py-2 rounded-lg border border-dashed border-slate-700 text-sm text-slate-400 cursor-pointer hover:border-slate-600">
            <Camera size={16} /> Upload image
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <label className="text-xs text-slate-500 block mb-2">Did this trade follow your routine?</label>
        <ToggleButtons
          options={[{ value: true, label: '✓ Followed rules (+1)' }, { value: false, label: '✕ Off-routine (−1)' }]}
          value={form.followed_routine}
          onChange={(v) => { setManualOverride(true); setForm((p) => ({ ...p, followed_routine: v })); }}
        />
        <div className="text-xs text-slate-600 mt-2">
          Auto-suggested from your rules engine above — override it if you have good reason.
        </div>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-lg bg-brand-500 text-slate-950 font-semibold text-sm hover:bg-brand-400 disabled:opacity-50">
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save trade'}
        </button>
        <button onClick={onDone} className="px-5 py-2.5 rounded-lg border border-slate-800 text-slate-400 text-sm hover:text-slate-200">
          Cancel
        </button>
      </div>
    </div>
  );
}
