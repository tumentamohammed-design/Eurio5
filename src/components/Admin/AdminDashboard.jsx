import { useEffect, useState } from 'react';
import { Users, CreditCard, TrendingUp, BookOpen, MousePointerClick, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient.js';
import ErrorBanner from '../Layout/ErrorBanner.jsx';
import LoadingBlock from '../Layout/LoadingBlock.jsx';

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={14} />
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="font-data text-2xl mt-1 text-slate-100">{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin-stats', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load admin stats');
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-100">Admin dashboard</div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-300">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <ErrorBanner message={error} onRetry={load} retrying={loading} />

      {loading && !stats ? (
        <LoadingBlock label="Loading admin stats…" />
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatTile icon={Users} label="Total users" value={stats.totalUsers} />
          <StatTile icon={CreditCard} label="Pro users" value={stats.proUsers} />
          <StatTile icon={Users} label="Free users" value={stats.freeUsers} />
          <StatTile icon={TrendingUp} label="MRR" value={`$${stats.mrr.toFixed(2)}`} />
          <StatTile icon={BookOpen} label="Total trades logged" value={stats.totalTrades} />
          <StatTile icon={MousePointerClick} label="Referral clicks" value={stats.referralClicks} />
        </div>
      ) : null}

      <div className="text-xs text-slate-600">
        Visible only to accounts with <code className="font-data">profiles.is_admin = true</code>. MRR is estimated as Pro users × $9.99 — it doesn't account for discounts, annual plans, or churn mid-cycle.
      </div>

      <div className="text-xs text-slate-600">
        Manage broker and prop firm listings directly on the <span className="text-slate-400">Brokers</span> and <span className="text-slate-400">Get Funded</span> pages — the "Add" / edit / delete controls appear there automatically for admin accounts.
      </div>
    </div>
  );
}
