import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { TAB_GROUPS } from './NavTabs.jsx';

export default function CommandPalette({ open, onClose, onNavigate, isAdmin }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const allTabs = useMemo(
    () => TAB_GROUPS.flatMap((g) => g.tabs.map((t) => ({ ...t, group: g.label }))).filter((t) => !t.adminOnly || isAdmin),
    [isAdmin]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTabs;
    return allTabs.filter((t) => t.label.toLowerCase().includes(q) || t.group.toLowerCase().includes(q));
  }, [allTabs, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  function select(tabId) {
    onNavigate(tabId);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800">
          <Search size={16} className="text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search features — Journal, Chart, Brokers…"
            className="flex-1 bg-transparent text-sm text-slate-100 outline-none"
          />
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 shrink-0"><X size={16} /></button>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">No features match "{query}"</div>
          ) : (
            results.map((t) => (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-800/60"
              >
                <t.icon size={15} className="text-slate-500 shrink-0" />
                <span className="text-sm text-slate-200">{t.label}</span>
                <span className="text-[10px] text-slate-600 ml-auto">{t.group}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
