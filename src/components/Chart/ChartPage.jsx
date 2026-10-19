import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { AlertTriangle, Palette } from 'lucide-react';
import { getCandles, TIMEFRAMES } from '../../lib/marketData.js';
import { analyzeStructure } from '../../lib/marketStructure.js';
import { emaSeries } from '../../lib/indicators.js';
import { PATTERN_DEFINITIONS, findPattern } from '../../lib/candlePatterns.js';
import { subscribeBinanceCandles } from '../../lib/binanceLive.js';
import { getColorPrefs, setColorPrefs } from '../../lib/colorPrefs.js';

const PAIRS = [
  { id: 'EUR/USD', live: false, precision: 4 },
  { id: 'XAU/USD', live: false, precision: 2 },
  { id: 'BTC/USD', live: true, precision: 1 },
];

const LIVE_UPDATE_THROTTLE_MS = 2000; // avoid recreating the chart on every single websocket tick

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

export default function ChartPage() {
  const containerRef = useRef(null);
  const [pair, setPair] = useState(PAIRS[0].id);
  const [timeframe, setTimeframe] = useState('1h');
  const [colors, setColors] = useState(getColorPrefs());
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activePattern, setActivePattern] = useState(null);
  const [liveCandles, setLiveCandles] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [hoverCandle, setHoverCandle] = useState(null);
  const lastLiveUpdateRef = useRef(0);

  const pairConfig = PAIRS.find((p) => p.id === pair);
  const isLivePair = pairConfig?.live;

  const demoCandles = useMemo(() => getCandles(pair, timeframe, 200), [pair, timeframe]);
  const candles = isLivePair ? (liveCandles || []) : demoCandles;

  // Live subscription — only active for BTC/USD, throttled so the chart
  // doesn't fully rebuild on every single websocket message.
  useEffect(() => {
    if (!isLivePair) { setLiveCandles(null); setLiveError(null); return undefined; }
    setLiveCandles(null);
    setLiveError(null);
    const unsubscribe = subscribeBinanceCandles(
      timeframe,
      (allCandles) => {
        const now = Date.now();
        if (now - lastLiveUpdateRef.current < LIVE_UPDATE_THROTTLE_MS && liveCandles) return;
        lastLiveUpdateRef.current = now;
        setLiveCandles(allCandles);
      },
      (err) => setLiveError(err.message || 'Live feed error')
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLivePair, pair, timeframe]);

  const structure = useMemo(() => (candles.length >= 30 ? analyzeStructure(candles, pair) : null), [candles, pair]);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return undefined;
    const precision = pairConfig?.precision ?? 4;
    const minMove = 1 / 10 ** precision;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      width: containerRef.current.clientWidth,
      height: 460,
      timeScale: { timeVisible: true, borderColor: '#1e293b' },
      rightPriceScale: { borderColor: '#1e293b' },
      crosshair: { vertLine: { color: '#475569', labelBackgroundColor: '#1e293b' }, horzLine: { color: '#475569', labelBackgroundColor: '#1e293b' } },
    });

    // Price pane takes the top ~75%, volume squeezed into the bottom ~20% —
    // the same layout convention TradingView uses.
    const candleSeries = chart.addCandlestickSeries({
      upColor: colors.bullish, downColor: colors.bearish, borderVisible: false,
      wickUpColor: colors.bullish, wickDownColor: colors.bearish,
      priceFormat: { type: 'price', precision, minMove },
    });
    candleSeries.setData(candles);
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeries.setData(candles.map((c) => ({
      time: c.time, value: c.volume || 0,
      color: c.close >= c.open ? hexToRgba(colors.bullish, 0.5) : hexToRgba(colors.bearish, 0.5),
    })));

    const ma20 = chart.addLineSeries({ color: '#38bdf8', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    ma20.setData(emaSeries(candles, 20));
    const ma50 = chart.addLineSeries({ color: colors.accent, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    ma50.setData(emaSeries(candles, 50));

    if (structure?.support) candleSeries.createPriceLine({ price: structure.support, color: colors.bullish, lineWidth: 1, lineStyle: 2, title: 'Support' });
    if (structure?.resistance) candleSeries.createPriceLine({ price: structure.resistance, color: colors.bearish, lineWidth: 1, lineStyle: 2, title: 'Resistance' });

    if (activePattern) {
      const hits = findPattern(candles, activePattern);
      candleSeries.setMarkers(hits.map((h) => ({ time: h.time, position: 'aboveBar', color: colors.accent, shape: 'circle', text: '' })));
    }

    // Live OHLCV legend, updated as the crosshair moves — defaults to the
    // most recent candle when nothing is hovered.
    setHoverCandle(candles[candles.length - 1]);
    chart.subscribeCrosshairMove((param) => {
      if (!param.time) { setHoverCandle(candles[candles.length - 1]); return; }
      const match = candles.find((c) => c.time === param.time);
      if (match) setHoverCandle(match);
    });

    chart.timeScale().fitContent();

    const handleResize = () => { if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth }); };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, structure, colors, activePattern, pairConfig]);

  function handleColorChange(key, value) {
    const next = setColorPrefs({ [key]: value });
    setColors(next);
  }

  const patternHitCount = activePattern ? findPattern(candles, activePattern).length : 0;
  const precision = pairConfig?.precision ?? 4;
  const changeColor = hoverCandle && hoverCandle.close >= hoverCandle.open ? colors.bullish : colors.bearish;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <select value={pair} onChange={(e) => { setPair(e.target.value); setActivePattern(null); }} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-data">
            {PAIRS.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
          </select>
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-data border ${timeframe === tf ? 'text-slate-950 border-transparent' : 'border-slate-800 text-slate-400'}`}
                style={timeframe === tf ? { backgroundColor: colors.accent } : undefined}>
                {tf}
              </button>
            ))}
          </div>
          {isLivePair && (
            <span className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1.5 ${liveError ? 'text-red-300 border-red-500/40' : 'text-brand-300 border-brand-400/40'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${liveError ? 'bg-red-400' : 'bg-brand-400 animate-pulse'}`} />
              {liveError ? 'Live feed error' : 'LIVE (Binance)'}
            </span>
          )}
        </div>
        <button onClick={() => setShowColorPicker((s) => !s)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
          <Palette size={14} /> Candle colors
        </button>
      </div>

      {showColorPicker && (
        <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
          <label className="flex items-center gap-2 text-slate-400">
            Bullish <input type="color" value={colors.bullish} onChange={(e) => handleColorChange('bullish', e.target.value)} className="w-7 h-7 rounded border-0 bg-transparent" />
          </label>
          <label className="flex items-center gap-2 text-slate-400">
            Bearish <input type="color" value={colors.bearish} onChange={(e) => handleColorChange('bearish', e.target.value)} className="w-7 h-7 rounded border-0 bg-transparent" />
          </label>
          <label className="flex items-center gap-2 text-slate-400">
            Accent <input type="color" value={colors.accent} onChange={(e) => handleColorChange('accent', e.target.value)} className="w-7 h-7 rounded border-0 bg-transparent" />
          </label>
        </div>
      )}

      {!isLivePair && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-200 text-xs p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div><strong>Demo price data</strong> for {pair} until a forex data provider is connected — see <code className="font-data">src/lib/marketData.js</code>. BTC/USD above is real live data from Binance.</div>
        </div>
      )}
      {liveError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs p-3">Live feed error: {liveError}</div>
      )}

      <div className="grid md:grid-cols-[140px_1fr] gap-3">
        <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
          {Object.entries(PATTERN_DEFINITIONS).map(([key, def]) => (
            <button
              key={key}
              onClick={() => setActivePattern(activePattern === key ? null : key)}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium border text-left ${
                activePattern === key ? 'text-slate-950 border-transparent' : 'border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
              style={activePattern === key ? { backgroundColor: colors.accent } : undefined}
            >
              {def.label}
            </button>
          ))}
          {activePattern && <div className="text-[11px] text-slate-500 px-1 pt-1">{patternHitCount} found</div>}
        </div>

        <div className="relative rounded-xl border border-slate-800 bg-slate-900/60 p-2 overflow-hidden">
          {/* Watermark — faint pair name behind the chart, TradingView-style */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
            <span className="font-data text-5xl md:text-7xl font-bold text-slate-100/[0.04] tracking-wider">{pair}</span>
          </div>

          {/* OHLCV legend — updates live with the crosshair */}
          {hoverCandle && (
            <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 px-1.5 pb-1.5 text-[11px] font-data">
              <span className="text-slate-300 font-semibold">{pair}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-500">O</span><span style={{ color: changeColor }}>{hoverCandle.open.toFixed(precision)}</span>
              <span className="text-slate-500">H</span><span style={{ color: changeColor }}>{hoverCandle.high.toFixed(precision)}</span>
              <span className="text-slate-500">L</span><span style={{ color: changeColor }}>{hoverCandle.low.toFixed(precision)}</span>
              <span className="text-slate-500">C</span><span style={{ color: changeColor }}>{hoverCandle.close.toFixed(precision)}</span>
              {hoverCandle.volume ? <><span className="text-slate-500">Vol</span><span className="text-slate-400">{Math.round(hoverCandle.volume).toLocaleString()}</span></> : null}
            </div>
          )}

          <div ref={containerRef} className="relative z-10" />
        </div>
      </div>

      {structure && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-medium text-slate-300">Market structure — {pair}</div>
            <span className={`text-xs px-2 py-1 rounded-full border ${
              structure.state === 'Bullish' ? 'text-brand-300 bg-brand-400/10 border-brand-400/40' :
              structure.state === 'Bearish' ? 'text-red-300 bg-red-400/10 border-red-400/40' :
              'text-slate-400 bg-slate-500/10 border-slate-500/30'
            }`}>
              {structure.state}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><div className="text-slate-500 uppercase tracking-wide">Nearest support</div><div className="font-data text-sm mt-0.5" style={{ color: colors.bullish }}>{structure.support ? structure.support.toFixed(precision) : '—'}</div></div>
            <div><div className="text-slate-500 uppercase tracking-wide">Nearest resistance</div><div className="font-data text-sm mt-0.5" style={{ color: colors.bearish }}>{structure.resistance ? structure.resistance.toFixed(precision) : '—'}</div></div>
          </div>
          <div className="text-sm text-slate-300">{structure.reasoning}</div>
          <div className="text-xs text-slate-600 pt-2 border-t border-slate-800">
            This describes current price structure only — not a buy/sell recommendation, no confidence score. Trading carries risk of loss.
          </div>
        </div>
      )}
    </div>
  );
}
