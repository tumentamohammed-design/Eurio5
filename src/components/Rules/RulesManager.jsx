import { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { HIGH_LIQUIDITY_WINDOWS, gmtMinutesToClock } from '../../lib/sessions.js';
import ErrorBanner from '../Layout/ErrorBanner.jsx';
import ToggleButtons from '../Layout/ToggleButtons.jsx';

const TYPE_LABELS = {
  session_window: 'Session restriction',
  news_buffer: 'News buffer',
  custom: 'Custom reminder',
};

export default function RulesManager() {
  const { rules, rulesError, addRule, updateRule, deleteRule } = useApp();
  const [type, setType] = useState('custom');
  const [text, setText] = useState('');
  const [selectedWindows, setSelectedWindows] = useState(new Set());
  const [bufferMinutes, setBufferMinutes] = useState(30);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function toggleWindow(name) {
    setSelectedWindows((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  async function handleAdd() {
    setError('');
    if (!text.trim()) { setError('Give the rule a short description.'); return; }

    let config = {};
    if (type === 'session_window') {
      const windows = HIGH_LIQUIDITY_WINDOWS
        .filter((w) => selectedWindows.has(w.name))
        .map((w) => ({ start: w.startGMT, end: w.endGMT }));
      if (windows.length === 0) { setError('Pick at least one allowed window.'); return; }
      config = { windows };
    }
    if (type === 'news_buffer') {
      config = { minutes: Number(bufferMinutes) || 30 };
    }

    setSaving(true);
    try {
      await addRule({ rule_text: text.trim(), type, config, active: true });
      setText('');
      setSelectedWindows(new Set());
      setBufferMinutes(30);
    } catch (err) {
      setError(err.message || 'Failed to add rule.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="text-sm text-slate-400">
        Rules you set here are checked automatically against every trade you log. "Custom" rules are reference-only reminders.
      </div>

      {rulesError && <ErrorBanner message={`Couldn't load your rules: ${rulesError}`} />}

      <div className="space-y-2">
        {rules.length === 0 && <div className="text-sm text-slate-500">No rules yet — add your first one below.</div>}
        {rules.map((r) => (
          <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm ${r.active ? 'text-slate-200' : 'text-slate-600 line-through'}`}>{r.rule_text}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-500 uppercase tracking-wide">
                    {TYPE_LABELS[r.type] || r.type}
                  </span>
                </div>
                {r.type === 'session_window' && r.config?.windows && (
                  <div className="text-xs text-slate-500 mt-1">
                    Allowed: {r.config.windows.map((w) => `${gmtMinutesToClock(w.start)}–${gmtMinutesToClock(w.end)} GMT`).join(', ')}
                  </div>
                )}
                {r.type === 'news_buffer' && (
                  <div className="text-xs text-slate-500 mt-1">Buffer: {r.config?.minutes ?? 30} min around high-impact news</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => updateRule(r.id, { active: !r.active })} className="text-xs text-slate-500 hover:text-brand-300">
                  {r.active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => deleteRule(r.id)} className="text-slate-500 hover:text-red-400">
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="text-sm font-medium text-slate-300">Add a rule</div>

        <ToggleButtons
          options={[
            { value: 'custom', label: 'Custom' },
            { value: 'session_window', label: 'Session restriction' },
            { value: 'news_buffer', label: 'News buffer' },
          ]}
          value={type}
          onChange={setType}
        />

        <div>
          <label className="text-xs text-slate-500">Description (shown as the warning message)</label>
          <input
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder={type === 'session_window' ? 'Trade only London/NY overlap' : type === 'news_buffer' ? 'No trades near high-impact news' : 'e.g. Max 2 trades per day'}
            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
          />
        </div>

        {type === 'session_window' && (
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">Allowed windows</label>
            <div className="flex gap-2 flex-wrap">
              {HIGH_LIQUIDITY_WINDOWS.map((w) => (
                <button
                  key={w.name}
                  type="button"
                  onClick={() => toggleWindow(w.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${
                    selectedWindows.has(w.name)
                      ? 'bg-brand-400/15 border-brand-400/50 text-brand-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {w.name} ({gmtMinutesToClock(w.startGMT)}–{gmtMinutesToClock(w.endGMT)})
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'news_buffer' && (
          <div>
            <label className="text-xs text-slate-500">Buffer (minutes before/after high-impact news)</label>
            <input
              type="number" min="0" value={bufferMinutes} onChange={(e) => setBufferMinutes(e.target.value)}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-data"
            />
          </div>
        )}

        {error && <div className="text-sm text-red-400">{error}</div>}

        <button onClick={handleAdd} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-500 text-slate-950 text-sm font-semibold hover:bg-brand-400 disabled:opacity-50">
          {saving ? 'Adding…' : 'Add rule'}
        </button>
      </div>
    </div>
  );
}
