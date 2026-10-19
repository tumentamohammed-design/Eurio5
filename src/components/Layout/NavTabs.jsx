import {
  BarChart3, BookOpen, Plus, Waves, Newspaper, ListChecks, CalendarDays,
  Users, Rss, Building2, Award, CreditCard, Gift, ShieldCheck, LineChart, MessageSquare, FlaskConical, Settings,
} from 'lucide-react';

// Grouped for the desktop sidebar. The mobile bottom bar (below) shows a
// smaller "primary" set — 16 tabs in a bottom bar isn't usable, so anything
// not in PRIMARY_MOBILE_TABS is reachable from the sidebar only on mobile
// too (sidebar becomes the full list; a proper "more" menu for mobile is a
// reasonable next polish once this many sections are in real use).
export const TAB_GROUPS = [
  {
    label: 'Trading Tools',
    tabs: [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      { id: 'journal', label: 'Journal', icon: BookOpen },
      { id: 'add', label: 'Log Trade', icon: Plus },
      { id: 'chart', label: 'Chart', icon: LineChart },
      { id: 'backtest', label: 'Backtest', icon: FlaskConical },
      { id: 'clock', label: 'Liquidity', icon: Waves },
      { id: 'calendar', label: 'Calendar', icon: Newspaper },
      { id: 'rules', label: 'Rules', icon: ListChecks },
      { id: 'weekly', label: 'Weekly', icon: CalendarDays },
    ],
  },
  {
    label: 'Network',
    tabs: [
      { id: 'traders', label: 'Traders', icon: Users },
      { id: 'messages', label: 'Messages', icon: MessageSquare },
      { id: 'feed', label: 'Feed', icon: Rss },
    ],
  },
  {
    label: 'Resources',
    tabs: [
      { id: 'brokers', label: 'Brokers', icon: Building2 },
      { id: 'funded', label: 'Get Funded', icon: Award },
    ],
  },
  {
    label: 'Account',
    tabs: [
      { id: 'billing', label: 'Billing', icon: CreditCard },
      { id: 'referral', label: 'Referral', icon: Gift },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
    ],
  },
];

export const PRIMARY_MOBILE_TABS = ['dashboard', 'journal', 'add', 'feed', 'messages', 'traders'];

function TabButton({ id, label, icon: Icon, activeTab, onSelect, small }) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
        activeTab === id ? 'bg-brand-400/10 text-brand-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
      } ${small ? 'text-xs py-1.5' : ''}`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

export function Sidebar({ activeTab, onSelect, isAdmin }) {
  return (
    <nav className="hidden md:flex flex-col gap-4 w-56 shrink-0 p-4 border-r border-slate-800 min-h-[calc(100vh-57px)] overflow-y-auto">
      {TAB_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold px-3 mb-1">{group.label}</div>
          <div className="flex flex-col gap-1">
            {group.tabs.filter((t) => !t.adminOnly || isAdmin).map((t) => (
              <TabButton key={t.id} {...t} activeTab={activeTab} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function BottomNav({ activeTab, onSelect, isAdmin }) {
  const allTabs = TAB_GROUPS.flatMap((g) => g.tabs).filter((t) => !t.adminOnly || isAdmin);
  const primary = PRIMARY_MOBILE_TABS.map((id) => allTabs.find((t) => t.id === id)).filter(Boolean);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur border-t border-slate-800 flex justify-around py-2 z-10 overflow-x-auto">
      {primary.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[9px] shrink-0 ${activeTab === id ? 'text-brand-300' : 'text-slate-500'}`}
        >
          <Icon size={17} /> {label}
        </button>
      ))}
    </nav>
  );
}
