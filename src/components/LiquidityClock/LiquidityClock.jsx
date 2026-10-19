import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  HIGH_LIQUIDITY_WINDOWS, SESSIONS,
  getActiveSessions, getActiveHighLiquidityWindows, getNextHighLiquidityWindow,
  gmtMinutesToClock, minutesToLabel,
} from '../../lib/sessions.js';
import { doualaHourOfDay, formatDoualaClock } from '../../lib/timezone.js';
import { liquidityClasses } from '../Layout/Header.jsx';

// Fires a browser notification once per window when a high-liquidity
// window is ~15 minutes away. Only works while this tab/PWA is open and
// running in the foreground/background — a fully-closed-app push
// notification would need a server-side push service (see README).
function useHighLiquidityNotifier(enabled) {
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (!enabled) return undefined;

    const check = () => {
      const now = new Date();
      const next = getNextHighLiquidityWindow(now);
      if (!next) return;
      const key = `${next.name}-${now.toDateString()}`;
      if (next.minutesUntil <= 15 && next.minutesUntil > 13 && !notifiedRef.current.has(key)) {
        notifiedRef.current.add(key);
        if (Notification.permission === 'granted') {
          new Notification('High liquidity in 15 min', {
            body: `${next.name} opens at ${gmtMinutesToClock(next.startGMT)} GMT — get ready.`,
            icon: '/icons/icon-192.png',
          });
        }
      }
    };

    const t = setInterval(check, 60 * 1000);
    check();
    return () => clearInterval(t);
  }, [enabled]);
}

export default function LiquidityClock() {
  const [now, setNow] = useState(new Date());
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useHighLiquidityNotifier(notifPermission === 'granted');

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  }

  const activeSessions = getActiveSessions(now);
  const activeWindows = getActiveHighLiquidityWindows(now);
  const next = getNextHighLiquidityWindow(now);
  const isHigh = activeWindows.length > 0;

  // 24 hourly blocks, indexed by Africa/Douala wall-clock hour (the app's
  // fixed default timezone), each resolved to its GMT liquidity status.
  // Douala is UTC+1 with no DST, so "Douala hour H" always corresponds to
  // GMT hour (H - 1 + 24) % 24 — no timezone-database lookup needed.
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const blocks = hours.map((doualaHour) => {
    const gmtHour = (doualaHour - 1 + 24) % 24;
    const probe = new Date(Date.UTC(2000, 0, 1, gmtHour, 0, 0));
    return {
      hour: doualaHour,
      sessions: getActiveSessions(probe),
      highWindows: getActiveHighLiquidityWindows(probe),
    };
  });
  const currentDoualaHour = doualaHourOfDay(now);

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border p-4 ${liquidityClasses(isHigh)}`}>
        <div className="text-xs uppercase tracking-wide opacity-80">
          Right now — {formatDoualaClock(now)} (Africa/Douala)
        </div>
        <div className="font-data text-2xl mt-1">{isHigh ? 'High liquidity' : 'Standard liquidity'}</div>
        <div className="text-sm mt-1 opacity-90">
          {isHigh ? `Active window: ${activeWindows.map((w) => w.name).join(' + ')}` : 'No high-liquidity window active'}
          {activeSessions.length ? ` · Sessions open: ${activeSessions.join(', ')}` : ''}
        </div>
        {!isHigh && next && (
          <div className="text-xs mt-2 opacity-75">
            Next: {next.name} in {minutesToLabel(next.minutesUntil)} (opens {gmtMinutesToClock(next.startGMT)} GMT)
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium text-slate-300">Today's liquidity, by hour (Africa/Douala)</div>
          <button
            onClick={enableNotifications}
            disabled={notifPermission === 'granted' || notifPermission === 'unsupported'}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-300 disabled:opacity-50"
          >
            {notifPermission === 'granted' ? <Bell size={13} /> : <BellOff size={13} />}
            {notifPermission === 'granted' ? 'Alerts on' : 'Alert me 15 min before'}
          </button>
        </div>

        <div className="flex items-end gap-[3px] h-12 mt-4 mb-2">
          {blocks.map((b) => {
            const isHighBlock = b.highWindows.length > 0;
            return (
              <div key={b.hour} className="flex-1 flex flex-col justify-end items-center relative" style={{ height: '100%' }}>
                {b.hour === currentDoualaHour && <div className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-brand-300" />}
                <div
                  className={`w-full rounded-sm ${isHighBlock ? 'bg-brand-400 h-10' : 'bg-slate-700 h-3'} ${
                    b.hour === currentDoualaHour ? 'ring-1 ring-brand-300' : ''
                  }`}
                  title={`${String(b.hour).padStart(2, '0')}:00 Douala — ${isHighBlock ? b.highWindows.map((w) => w.name).join(', ') : 'standard liquidity'}`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 font-data">
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
        </div>
        <div className="flex gap-4 mt-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-400" /> High liquidity</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-700" /> Standard</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400 space-y-1.5">
        <div className="font-medium text-slate-300 mb-1">High-liquidity windows (GMT)</div>
        {HIGH_LIQUIDITY_WINDOWS.map((w) => (
          <div key={w.name}>{w.name}: {gmtMinutesToClock(w.startGMT)} – {gmtMinutesToClock(w.endGMT)}</div>
        ))}
        <div className="font-medium text-slate-300 mt-3 mb-1">Session hours (GMT)</div>
        {SESSIONS.map((s) => (
          <div key={s.name}>{s.name}: {gmtMinutesToClock(s.startGMT)} – {gmtMinutesToClock(s.endGMT)}</div>
        ))}
        <div className="text-xs text-slate-600 pt-2">
          Notifications only fire while this app is open in your browser/PWA. A fully-closed-app push notification would need a server-side push service — a solid next step, not included here.
        </div>
      </div>
    </div>
  );
}
