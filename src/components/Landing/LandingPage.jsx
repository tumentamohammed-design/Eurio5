import { Link } from 'react-router-dom';
import { Check, ShieldAlert, Waves, Newspaper, BookOpen, BarChart3, Users, Building2 } from 'lucide-react';

const FEATURES = [
  { icon: BookOpen, title: 'Trading journal', desc: 'Log every trade — pair, entry, SL, TP, RR, setup, screenshot, emotion 1–10 — in under a minute.' },
  { icon: BarChart3, title: 'Real dashboard', desc: 'Win rate, avg R, profit factor, best and worst setup, and an equity curve that updates as you log.' },
  { icon: ShieldAlert, title: 'Rules engine', desc: '"No trades 30 min before news." "London/NY overlap only." Break a rule, get warned before you log it.' },
  { icon: Waves, title: 'Liquidity clock', desc: 'A live 24h view of London/NY overlap and every high-liquidity window, with a 15-minute-before alert.' },
  { icon: Users, title: 'Trader network', desc: 'Find and follow traders from your country, share setups on the feed, build real trading relationships.' },
  { icon: Building2, title: 'Broker & prop firm directory', desc: 'Honest, filterable comparisons — regulation, spreads, profit splits — not just whoever pays the most.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <Logo size={26} />
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-400 hover:text-slate-200">Sign in</Link>
            <Link to="/login" className="text-sm px-3 py-1.5 rounded-lg bg-brand-500 text-slate-950 font-semibold hover:bg-brand-400">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 md:px-8 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-50">
          Stop revenge trading.
        </h1>
        <p className="mt-4 text-lg text-slate-400">
          A discipline journal, a liquidity clock, and a rules engine that stops you from entering the trade you know you shouldn't take — plus a trading network to keep you accountable.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/login" className="px-5 py-3 rounded-lg bg-brand-500 text-slate-950 font-semibold hover:bg-brand-400">
            Start free — 30 trades/month
          </Link>
        </div>
        <div className="mt-3 text-xs text-slate-600">No credit card required.</div>
      </section>

      <section className="max-w-5xl mx-auto px-4 md:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <Icon size={20} className="text-brand-400 mb-3" />
              <div className="font-medium text-slate-100">{title}</div>
              <div className="text-sm text-slate-400 mt-1">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 md:px-8 py-16">
        <h2 className="text-2xl font-semibold text-center text-slate-100 mb-8">Simple pricing</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="text-sm font-semibold text-slate-200 mb-1">Free</div>
            <div className="text-3xl font-data text-slate-100 mb-4">$0</div>
            <ul className="text-sm text-slate-400 space-y-2 mb-6">
              <li className="flex items-center gap-2"><Check size={14} className="text-brand-400" /> 30 journal entries / month</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-brand-400" /> Full dashboard & analytics</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-brand-400" /> Liquidity clock & FX calendar</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-brand-400" /> Rules engine</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-brand-400" /> Trader network & feed</li>
            </ul>
            <Link to="/login" className="block text-center py-2 rounded-lg border border-slate-700 text-slate-200 text-sm hover:bg-slate-800">
              Get started
            </Link>
          </div>
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-6">
            <div className="text-sm font-semibold text-amber-300 mb-1">Pro</div>
            <div className="text-3xl font-data text-slate-100 mb-4">$9.99<span className="text-sm text-slate-500">/mo</span></div>
            <ul className="text-sm text-slate-400 space-y-2 mb-6">
              <li className="flex items-center gap-2"><Check size={14} className="text-amber-300" /> Everything in Free</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-amber-300" /> Unlimited journal entries</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-amber-300" /> Priority support</li>
            </ul>
            <Link to="/login" className="block text-center py-2 rounded-lg bg-amber-400 text-slate-950 text-sm font-semibold hover:bg-amber-300">
              Go Pro
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-600">
        Eurio5 — Trading Discipline & Trader Network
      </footer>
    </div>
  );
}
