import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorBanner({ message, onRetry, retrying }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm p-3 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="flex items-center gap-1 text-xs text-red-200 hover:text-white shrink-0">
          <RefreshCw size={13} className={retrying ? 'animate-spin' : ''} /> Retry
        </button>
      )}
    </div>
  );
}
