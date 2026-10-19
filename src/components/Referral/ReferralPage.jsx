import { ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

export default function ReferralPage() {
  const { trackReferralClick } = useApp();
  const affiliateUrl = import.meta.env.VITE_BROKER_AFFILIATE_URL;

  async function handleClick() {
    await trackReferralClick();
    if (affiliateUrl) window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="text-lg font-semibold text-slate-100">Trade with a broker built for discipline</div>
      <p className="text-sm text-slate-400">
        I personally use and recommend this broker — tight spreads, fast execution during the London/NY overlap, and a
        clean mobile app that pairs well with keeping your entries inside your rules.
      </p>

      {!affiliateUrl ? (
        <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          Set <code className="font-data">VITE_BROKER_AFFILIATE_URL</code> in your environment to activate this button.
        </div>
      ) : (
        <button
          onClick={handleClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 text-slate-950 text-sm font-semibold hover:bg-brand-400"
        >
          Open an account <ExternalLink size={15} />
        </button>
      )}

      <div className="text-xs text-slate-600">
        This is an affiliate link — I may earn a commission at no extra cost to you. Clicks are counted anonymously to
        help me understand what's useful.
      </div>
    </div>
  );
}
