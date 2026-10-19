export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="rgb(var(--brand-500))" />
      <rect x="7" y="18" width="4" height="8" rx="1" fill="#0b1220" opacity="0.85" />
      <rect x="14" y="12" width="4" height="14" rx="1" fill="#0b1220" opacity="0.85" />
      <rect x="21" y="7" width="4" height="19" rx="1" fill="rgb(var(--accent-400))" />
    </svg>
  );
}

export default function Logo({ size = 28, showWordmark = true, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="font-data tracking-widest text-slate-100" style={{ fontSize: size * 0.5 }}>
          EURIO<span className="text-brand-400">5</span>
        </span>
      )}
    </div>
  );
}
