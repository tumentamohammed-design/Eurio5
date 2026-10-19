import { useMemo, useState } from 'react';
import { Star, ExternalLink, Plus, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { useBrokers } from '../../context/BrokersContext.jsx';
import { COUNTRIES, countryFlag } from '../../lib/countries.js';
import ErrorBanner from '../Layout/ErrorBanner.jsx';
import LoadingBlock from '../Layout/LoadingBlock.jsx';

function blankFirm() {
  return { name: '', logo_url: '', price: '', account_sizes: '', profit_split: '', countries: '', rating: '4', affiliate_link: '' };
}

function PropFirmForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!form.name.trim() || !form.affiliate_link.trim()) { setError('Name and affiliate link are required.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({ ...form, rating: Number(form.rating) || 0, countries: form.countries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean) });
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5">
      <div className="grid sm:grid-cols-2 gap-2.5">
        <input placeholder="Firm name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Logo URL (optional)" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Challenge price (e.g. $89)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Account sizes (e.g. up to $200k)" value={form.account_sizes} onChange={(e) => setForm({ ...form, account_sizes: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Profit split (e.g. 90%)" value={form.profit_split} onChange={(e) => setForm({ ...form, profit_split: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Rating (0-5)" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Country codes, comma-separated" value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        <input placeholder="Affiliate link (your real referral URL)" value={form.affiliate_link} onChange={(e) => setForm({ ...form, affiliate_link: e.target.value })} className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
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

export default function PropFirmDirectory() {
  const { isAdmin } = useApp();
  const { propFirms, propFirmsLoading, propFirmsError, loadPropFirms, addPropFirm, updatePropFirm, deletePropFirm } = useBrokers();
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const filtered = useMemo(() => {
    if (countryFilter === 'ALL') return propFirms;
    return propFirms.filter((f) => (f.countries || []).includes(countryFilter));
  }, [propFirms, countryFilter]);

  const usedCountries = useMemo(() => [...new Set(propFirms.flatMap((f) => f.countries || []))], [propFirms]);

  function toFormShape(f) {
    return { ...f, countries: (f.countries || []).join(', '), rating: String(f.rating ?? 4) };
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold text-slate-100">Get funded up to $200k+</div>
        <div className="text-sm text-slate-400 mt-1">Compare proprietary trading firms that fund traders who pass their evaluation.</div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100">
          <option value="ALL">All countries</option>
          {COUNTRIES.filter(([code]) => usedCountries.includes(code)).map(([code, name]) => (
            <option key={code} value={code}>{countryFlag(code)} {name}</option>
          ))}
        </select>
        {isAdmin && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-slate-950 text-sm font-semibold hover:bg-brand-400">
            <Plus size={15} /> Add prop firm
          </button>
        )}
      </div>

      {isAdmin && adding && (
        <PropFirmForm initial={blankFirm()} onCancel={() => setAdding(false)} onSave={async (data) => { await addPropFirm(data); setAdding(false); }} />
      )}

      {propFirmsError && <ErrorBanner message={`Couldn't load prop firms: ${propFirmsError}`} onRetry={loadPropFirms} retrying={propFirmsLoading} />}

      {propFirmsLoading && filtered.length === 0 ? (
        <LoadingBlock label="Loading prop firms…" />
      ) : filtered.length === 0 && !propFirmsError ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          {propFirms.length === 0 ? (isAdmin ? 'No prop firms yet — add your first one above.' : 'No prop firms listed yet.') : 'No prop firms match that country.'}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
                <th className="px-3 py-2 font-medium">Firm</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Account size</th>
                <th className="px-3 py-2 font-medium">Profit split</th>
                <th className="px-3 py-2 font-medium">Rating</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                editingId === f.id ? (
                  <tr key={f.id}><td colSpan={6} className="p-3">
                    <PropFirmForm initial={toFormShape(f)} onCancel={() => setEditingId(null)} onSave={async (data) => { await updatePropFirm(f.id, data); setEditingId(null); }} />
                  </td></tr>
                ) : (
                  <tr key={f.id} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-3 py-2.5 font-medium text-slate-200">{f.name}</td>
                    <td className="px-3 py-2.5 font-data text-slate-300">{f.price || '—'}</td>
                    <td className="px-3 py-2.5 font-data text-slate-300">{f.account_sizes || '—'}</td>
                    <td className="px-3 py-2.5 font-data text-slate-300">{f.profit_split || '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={11} fill={i < Math.round(f.rating) ? 'currentColor' : 'none'} />)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        {isAdmin && (
                          <>
                            <button onClick={() => setEditingId(f.id)} className="text-slate-500 hover:text-slate-200"><Pencil size={13} /></button>
                            <button onClick={() => deletePropFirm(f.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={13} /></button>
                          </>
                        )}
                        <a href={`/api/go-propfirm?id=${f.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-500 text-slate-950 text-xs font-semibold hover:bg-brand-400 whitespace-nowrap">
                          Get funded <ExternalLink size={11} />
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-slate-600">Affiliate disclosure: some links on this page are referral links — we may earn a commission if you sign up, at no extra cost to you.</div>
    </div>
  );
}
