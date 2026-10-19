import { useEffect, useState } from 'react';
import { LogOut, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getActiveHighLiquidityWindows } from '../../lib/sessions.js';
import Logo from './Logo.jsx';

export function liquidityClasses(isHigh) {
  return isHigh
    ? 'text-brand-300 bg-brand-400/10 border-brand-400/40'
    : 'text-slate-400 bg-slate-500/10 border-slate-500/30';
}

export default function Header({ onOpenSearch }) {
  const { user, signOut, isPro } = useApp();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const activeWindows = getActiveHighLiquidityWindows(now);
  const isHigh = activeWindows.length > 0;

  return (
    <header className="border-b border-slate-800 sticky top-0 bg-slate-950/90 backdrop-blur z-10">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={26} />
          {isPro && <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-400/40 text-amber-300 uppercase tracking-wide">Pro</span>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onOpenSearch} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded-lg border border-slate-800" aria-label="Search features">
            <Search size={13} /> <span className="hidden sm:inline">Search</span>
          </button>
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${liquidityClasses(isHigh)}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-brand-400' : 'bg-slate-600'}`} />
            {isHigh ? activeWindows.map((w) => w.name).join(' + ') : 'Low liquidity'}
          </div>
          {user && (
            <button onClick={signOut} className="text-slate-500 hover:text-slate-300" aria-label="Sign out">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
