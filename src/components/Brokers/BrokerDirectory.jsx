import { useMemo, useState } from 'react';
import { Star, ExternalLink, Plus, Pencil, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { useBrokers } from '../../context/BrokersContext.jsx';
import { COUNTRIES, countryFlag } from '../../lib/countries.js';
import ErrorBanner from '../Layout/ErrorBanner.jsx';
import LoadingBlock from '../Layout/LoadingBlock.jsx';

function blankBroker() {
  return { name: '', logo_url: '', regulation: '', license_no: '', min_deposit: '', spread_from: '', leverage: '', countries: '', rating: '4', pros: '', cons: '', affiliate_link: '' };
}

function BrokerForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!form.name.trim() || !form.affiliate_link.trim()) { setError('Name and affiliate link are required.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({
        ...form,
        rating: Number(form.rating) || 0,
        countries: form.countries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
        pros: form.pros.split('\n').map((s) => s.trim()).filter(Boolean),
        cons: form.cons.split('\n').map((s) => s.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5">
      <div className="grid sm:grid-cols-2 gap-2.5">
        <input placeholder="Broker name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Logo URL (optional)" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Regulation (e.g. FCA, CySEC)" value={form.regulation} onChange={(e) => setForm({ ...form, regulation: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="License number" value={form.license_no} onChange={(e) => setForm({ ...form, license_no: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Min deposit (e.g. $10)" value={form.min_deposit} onChange={(e) => setForm({ ...form, min_deposit: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Spread from (e.g. 0.1 pips)" value={form.spread_from} onChange={(e) => setForm({ ...form, spread_from: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Leverage (e.g. 1:500)" value={form.leverage} onChange={(e) => setForm({ ...form, leverage: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Rating (0-5)" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Country codes, comma-separated (CM, NG, GH)" value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Affiliate link (your real referral URL)" value={form.affiliate_link} onChange={(e) => setForm({ ...form, affiliate_link: e.target.value })} className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <textarea placeholder="Pros, one per line" rows={3} value={form.pros} onChange={(e) => setForm({ ...form, pros: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <textarea placeholder="Cons, one per line" rows={3} value={form.cons} onChange={(e) => setForm({ ...form, cons: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving} className="px-4 py-1.5 rounded-lg bg-brand-500 text-slate-950 text-sm font-semibold hover:bg-brand-400 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 rounded-lg border border-slate-800 text-slate-400 text-sm">Cancel</button>
      </div>
    </div>
  );
}

export default function BrokerDirectory() {
  const { isAdmin } = useApp();
  const { brokers, brokersLoading, brokersError, loadBrokers, addBroker, updateBroker, deleteBroker } = useBrokers();
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const filtered = useMemo(() => {
    if (countryFilter === 'ALL') return brokers;
    return brokers.filter((b) => (b.countries || []).includes(countryFilter));
  }, [brokers, countryFilter]);

  const usedCountries = useMemo(() => [...new Set(brokers.flatMap((b) => b.countries || []))], [brokers]);

  function toFormShape(b) {
    return { ...b, countries: (b.countries || []).join(', '), pros: (b.pros || []).join('\n'), cons: (b.cons || []).join('\n'), rating: String(b.rating ?? 4) };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100">
          <option value="ALL">All countries</option>
          {COUNTRIES.filter(([code]) => usedCountries.includes(code)).map(([code, name]) => (
            <option key={code} value={code}>{countryFlag(code)} {name}</option>
          ))}
        </select>
        {isAdmin && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-slate-950 text-sm font-semibold hover:bg-brand-400">
            <Plus size={15} /> Add broker
          </button>
        )}
      </div>

      {isAdmin && adding && (
        <BrokerForm initial={blankBroker()} onCancel={() => setAdding(false)} onSave={async (data) => { await addBroker(data); setAdding(false); }} />
      )}

      {brokersError && <ErrorBanner message={`Couldn't load brokers: ${brokersError}`} onRetry={loadBrokers} retrying={brokersLoading} />}

      {brokersLoading && filtered.length === 0 ? (
        <LoadingBlock label="Loading brokers…" />
      ) : filtered.length === 0 && !brokersError ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          {brokers.length === 0 ? (isAdmin ? 'No brokers yet — add your first one above.' : 'No brokers listed yet.') : 'No brokers match that country.'}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((b) => (
            editingId === b.id ? (
              <BrokerForm key={b.id} initial={toFormShape(b)} onCancel={() => setEditingId(null)}
                onSave={async (data) => { await updateBroker(b.id, data); setEditingId(null); }} />
            ) : (
              <div key={b.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {b.logo_url ? <img src={b.logo_url} alt="" className="w-8 h-8 rounded object-contain bg-white/5" /> : <div className="w-8 h-8 rounded bg-slate-800" />}
                    <div>
                      <div className="font-medium text-slate-100">{b.name}</div>
                      <div className="flex items-center gap-1 text-xs text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={11} fill={i < Math.round(b.rating) ? 'currentColor' : 'none'} />)}
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditingId(b.id)} className="p-1 text-slate-500 hover:text-slate-200"><Pencil size={14} /></button>
                      <button onClick={() => deleteBroker(b.id)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div><div className="text-slate-500">Min deposit</div><div className="font-data text-slate-200">{b.min_deposit || '—'}</div></div>
                  <div><div className="text-slate-500">Spread from</div><div className="font-data text-slate-200">{b.spread_from || '—'}</div></div>
                  <div><div className="text-slate-500">Leverage</div><div className="font-data text-slate-200">{b.leverage || '—'}</div></div>
                </div>
                {b.regulation && <div className="text-xs text-slate-500 mt-2">Regulated: {b.regulation} {b.license_no && `(${b.license_no})`}</div>}

                {(b.pros?.length > 0 || b.cons?.length > 0) && (
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <ul className="text-brand-400/90 space-y-0.5">{(b.pros || []).map((p, i) => <li key={i}>+ {p}</li>)}</ul>
                    <ul className="text-red-400/80 space-y-0.5">{(b.cons || []).map((c, i) => <li key={i}>− {c}</li>)}</ul>
                  </div>
                )}

                <a href={`/api/go-broker?id=${b.id}`} target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-brand-500 text-slate-950 text-xs font-semibold hover:bg-brand-400">
                  Visit broker <ExternalLink size={12} />
                </a>
              </div>
            )
          ))}
        </div>
      )}

      <div className="text-xs text-slate-600">Affiliate disclosure: some links on this page are referral links — we may earn a commission if you sign up, at no extra cost to you.</div>
    </div>
  );
}
