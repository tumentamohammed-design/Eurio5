import { Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

export default function UpgradeBanner({ message }) {
  const { startCheckout, billingBusy } = useApp();
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
      <Lock size={18} className="text-amber-300 mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="text-sm text-amber-200 font-medium">
          {message || "You've used all 30 free journal entries this month."}
        </div>
        <div className="text-xs text-amber-300/80 mt-1">Upgrade to Pro for unlimited entries — $9.99/month.</div>
      </div>
      <button
        onClick={startCheckout}
        disabled={billingBusy}
        className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-sm font-semibold hover:bg-amber-300 disabled:opacity-50 shrink-0"
      >
        {billingBusy ? 'Loading…' : 'Upgrade to Pro'}
      </button>
    </div>
  );
}
