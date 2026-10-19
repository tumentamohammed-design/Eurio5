import { CreditCard, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { FREE_MONTHLY_TRADE_LIMIT } from '../../context/AppContext.jsx';
import ErrorBanner from '../Layout/ErrorBanner.jsx';

export default function BillingPanel() {
  const { isPro, monthlyTradeCount, startCheckout, openBillingPortal, billingBusy, billingError } = useApp();

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-brand-400" />
          <div className="text-lg font-semibold text-slate-100">
            You're on the {isPro ? <span className="text-amber-300">Pro</span> : 'Free'} plan
          </div>
        </div>

        {!isPro && (
          <div className="mt-3 text-sm text-slate-400">
            {monthlyTradeCount} / {FREE_MONTHLY_TRADE_LIMIT} journal entries used this month.
            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-brand-400"
                style={{ width: `${Math.min(100, (monthlyTradeCount / FREE_MONTHLY_TRADE_LIMIT) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {isPro && (
          <div className="mt-3 text-sm text-slate-400">Unlimited journal entries, all features unlocked.</div>
        )}

        {billingError && <div className="mt-3"><ErrorBanner message={billingError} /></div>}

        <div className="mt-4">
          {isPro ? (
            <button
              onClick={openBillingPortal}
              disabled={billingBusy}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-200 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {billingBusy ? 'Loading…' : 'Manage billing / cancel'}
            </button>
          ) : (
            <button
              onClick={startCheckout}
              disabled={billingBusy}
              className="px-4 py-2 rounded-lg bg-brand-500 text-slate-950 text-sm font-semibold hover:bg-brand-400 disabled:opacity-50"
            >
              {billingBusy ? 'Loading…' : 'Upgrade to Pro — $9.99/mo'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-sm font-semibold text-slate-200 mb-2">Free</div>
          <div className="text-2xl font-data text-slate-100 mb-3">$0</div>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li className="flex items-center gap-1.5"><Check size={13} className="text-brand-400" /> 30 journal entries / month</li>
            <li className="flex items-center gap-1.5"><Check size={13} className="text-brand-400" /> Full dashboard & analytics</li>
            <li className="flex items-center gap-1.5"><Check size={13} className="text-brand-400" /> Liquidity clock & calendar</li>
            <li className="flex items-center gap-1.5"><Check size={13} className="text-brand-400" /> Rules engine</li>
          </ul>
        </div>
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
          <div className="text-sm font-semibold text-amber-300 mb-2">Pro</div>
          <div className="text-2xl font-data text-slate-100 mb-3">$9.99<span className="text-sm text-slate-500">/mo</span></div>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-300" /> Everything in Free</li>
            <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-300" /> Unlimited journal entries</li>
            <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-300" /> Priority support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
