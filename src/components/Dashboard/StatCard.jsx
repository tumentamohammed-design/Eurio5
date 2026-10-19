export default function StatCard({ label, value, sub, tone = 'slate' }) {
  const toneClasses = {
    slate: 'text-slate-100',
    brand: 'text-brand-400',
    red: 'text-red-400',
    amber: 'text-amber-300',
  }[tone];
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className={`font-data text-2xl mt-1 ${toneClasses}`}>{value}</div>
      {sub ? <div className="text-xs text-slate-500 mt-1">{sub}</div> : null}
    </div>
  );
}
