import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { Play, Pause, RotateCcw, Save } from 'lucide-react';
import { getCandles, TIMEFRAMES } from '../../lib/marketData.js';
import { getColorPrefs } from '../../lib/colorPrefs.js';
import { useApp } from '../../context/AppContext.jsx';
import { supabase } from '../../lib/supabaseClient.js';

const PAIRS = ['EUR/USD', 'XAU/USD', 'BTC/USD'];
const SPEEDS = { '1x': 700, '2x': 350, '5x': 130 };
const HISTORY_CANDLES = 400; // a full year at 1D isn't meaningfully "replayable" one bar per tick without waiting forever, so this is a substantial-but-practical window rather than literally 365 daily bars

export default function BacktestPage() {
  const { user } = useApp();
  const containerRef = useRef(null);
  const [pair, setPair] = useState(PAIRS[0]);
  const [timeframe, setTimeframe] = useState('1h');
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('1x');
  const [revealedCount, setRevealedCount] = useState(50);
  const [position, setPosition] = useState(null); // {direction, entryPrice, entryIndex}
  const [trades, setTrades] = useState([]); // completed: {direction, entryPrice, exitPrice, pnl}
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const colors = useMemo(() => getColorPrefs(), []);

  const fullHistory = useMemo(() => getCandles(pair, timeframe, HISTORY_CANDLES), [pair, timeframe]);
  const visibleCandles = started ? fullHistory.slice(0, revealedCount) : [];
  const lastCandle = visibleCandles[visibleCandles.length - 1];

  useEffect(() => {
    if (!playing) return undefined;
    const t = setInterval(() => {
      setRevealedCount((n) => {
        if (n >= fullHistory.length) { setPlaying(false); return n; }
        return n + 1;
      });
    }, SPEEDS[speed]);
    return () => clearInterval(t);
  }, [playing, speed, fullHistory.length]);

  useEffect(() => {
    if (!containerRef.current || visibleCandles.length === 0) return undefined;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      width: containerRef.current.clientWidth,
      height: 380,
      timeScale: { timeVisible: true, borderColor: '#1e293b' },
      rightPriceScale: { borderColor: '#1e293b' },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: colors.bullish, downColor: colors.bearish, borderVisible: false,
      wickUpColor: colors.bullish, wickDownColor: colors.bearish,
    });
    candleSeries.setData(visibleCandles);

    const markers = [];
    trades.forEach((t) => {
      markers.push({ time: t.entryTime, position: t.direction === 'Long' ? 'belowBar' : 'aboveBar', color: colors.accent, shape: t.direction === 'Long' ? 'arrowUp' : 'arrowDown', text: 'Entry' });
      markers.push({ time: t.exitTime, position: t.direction === 'Long' ? 'aboveBar' : 'belowBar', color: t.pnl >= 0 ? colors.bullish : colors.bearish, shape: 'circle', text: `${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(4)}` });
    });
    if (position && lastCandle) {
      markers.push({ time: position.entryTime, position: position.direction === 'Long' ? 'belowBar' : 'aboveBar', color: colors.accent, shape: position.direction === 'Long' ? 'arrowUp' : 'arrowDown', text: 'Open' });
    }
    candleSeries.setMarkers(markers.sort((a, b) => a.time - b.time));

    chart.timeScale().fitContent();

    const handleResize = () => { if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth }); };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [visibleCandles, trades, position, colors, lastCandle]);

  function handleStart() {
    setStarted(true);
    setRevealedCount(50);
    setPosition(null);
    setTrades([]);
    setPlaying(true);
    setSaveState('idle');
  }

  function handleReset() {
    setStarted(false);
    setPlaying(false);
    setPosition(null);
    setTrades([]);
    setSaveState('idle');
  }

  function openPosition(direction) {
    if (!lastCandle || position) return;
    setPosition({ direction, entryPrice: lastCandle.close, entryTime: lastCandle.time });
  }

  function closePosition() {
    if (!position || !lastCandle) return;
    const pnl = position.direction === 'Long' ? lastCandle.close - position.entryPrice : position.entryPrice - lastCandle.close;
    setTrades((prev) => [...prev, { ...position, exitPrice: lastCandle.close, exitTime: lastCandle.time, pnl }]);
    setPosition(null);
  }

  const stats = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter((t) => t.pnl > 0).length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const profit = trades.reduce((s, t) => s + t.pnl, 0);
    return { total, wins, winRate, profit };
  }, [trades]);

  async function handleSave() {
    if (!user || stats.total === 0) return;
    setSaveState('saving');
    try {
      const { error } = await supabase.from('backtests').insert({
        user_id: user.id,
        pair,
        win_rate: Number(stats.winRate.toFixed(2)),
        profit: Number(stats.profit.toFixed(6)),
        total_trades: stats.total,
      });
      if (error) throw error;
      setSaveState('saved');
    } catch (err) {
      console.error('save backtest failed', err);
      setSaveState('error');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold text-slate-100">Backtest</div>
        <div className="text-sm text-slate-400 mt-1">
          Practice against historical price action. Candles reveal one at a time — place your own Buy/Sell, and see how you'd have actually done. Runs on the same demo dataset as the Chart tab until live/historical data is connected.
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={pair} onChange={(e) => { setPair(e.target.value); handleReset(); }} disabled={started} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-data disabled:opacity-50">
          {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={timeframe} onChange={(e) => { setTimeframe(e.target.value); handleReset(); }} disabled={started} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-data disabled:opacity-50">
          {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
        </select>

        {!started ? (
          <button onClick={handleStart} className="px-4 py-2 rounded-lg bg-brand-500 text-slate-950 text-sm font-semibold hover:bg-brand-400">
            Start Backtest
          </button>
        ) : (
          <>
            <button onClick={() => setPlaying((p) => !p)} disabled={revealedCount >= fullHistory.length} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500 text-slate-950 text-sm font-semibold hover:bg-brand-400 disabled:opacity-50">
              {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? 'Pause' : 'Play'}
            </button>
            <div className="flex gap-1">
              {Object.keys(SPEEDS).map((s) => (
                <button key={s} onClick={() => setSpeed(s)} className={`px-2.5 py-2 rounded-lg text-xs font-data border ${speed === s ? 'bg-brand-400/15 border-brand-400/40 text-brand-200' : 'border-slate-800 text-slate-400'}`}>
                  {s}
                </button>
              ))}
            </div>
            <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 text-slate-400 text-sm hover:text-slate-200">
              <RotateCcw size={15} /> Reset
            </button>
          </>
        )}
      </div>

      {started && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          Candle {revealedCount} / {fullHistory.length}
          {revealedCount >= fullHistory.length && <span className="text-brand-400">— end of data</span>}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_260px] gap-4">
        <div ref={containerRef} className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 min-h-[380px]" />

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Your position</div>
            {!started ? (
              <div className="text-sm text-slate-500">Start the backtest to trade.</div>
            ) : position ? (
              <div>
                <div className="text-sm text-slate-200">{position.direction} @ {position.entryPrice.toFixed(4)}</div>
                <button onClick={closePosition} className="mt-2 w-full py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300">
                  Close position
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => openPosition('Long')} disabled={!lastCandle} className="flex-1 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: colors.bullish, color: '#020617' }}>
                  Buy
                </button>
                <button onClick={() => openPosition('Short')} disabled={!lastCandle} className="flex-1 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: colors.bearish, color: '#020617' }}>
                  Sell
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Results</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><div className="text-slate-500 text-xs">Win rate</div><div className="font-data text-slate-100">{stats.total ? `${stats.winRate.toFixed(0)}%` : '—'}</div></div>
              <div><div className="text-slate-500 text-xs">Trades</div><div className="font-data text-slate-100">{stats.total}</div></div>
              <div className="col-span-2"><div className="text-slate-500 text-xs">Total P&L (price units)</div>
                <div className={`font-data ${stats.profit >= 0 ? 'text-brand-400' : 'text-red-400'}`}>{stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(4)}</div>
              </div>
            </div>
            <button onClick={handleSave} disabled={stats.total === 0 || saveState === 'saving'} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:border-brand-400/40 hover:text-brand-300 disabled:opacity-50">
              <Save size={13} /> {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save results'}
            </button>
            {saveState === 'error' && <div className="text-xs text-red-400">Failed to save — try again.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
