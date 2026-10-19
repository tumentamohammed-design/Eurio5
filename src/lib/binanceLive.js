// src/lib/binanceLive.js
//
// Binance's public kline (candlestick) WebSocket stream — genuinely free,
// no API key or signup required, works directly from the browser. This is
// the ONLY pair in this app backed by real live data right now; EUR/USD and
// XAU/USD stay on demo data (see marketData.js) until a forex data
// provider is connected.
//
// Docs: https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams

const INTERVAL_MAP = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1D': '1d' };

function klineToCandle(k) {
  return {
    time: Math.floor(k.t / 1000),
    open: Number(k.o), high: Number(k.h), low: Number(k.l), close: Number(k.c),
    volume: Number(k.v),
  };
}

// Fetches recent history via Binance's plain REST endpoint (also free, no
// key), then keeps it updated live via WebSocket. Returns an unsubscribe
// function. onUpdate is called with the FULL candle array each time.
export function subscribeBinanceCandles(timeframe, onUpdate, onError) {
  const interval = INTERVAL_MAP[timeframe] || '1h';
  let candles = [];
  let ws;
  let cancelled = false;

  async function loadHistory() {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=200`);
      if (!res.ok) throw new Error(`Binance REST error ${res.status}`);
      const raw = await res.json();
      candles = raw.map((k) => ({
        time: Math.floor(k[0] / 1000),
        open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]),
        volume: Number(k[5]),
      }));
      if (!cancelled) onUpdate([...candles]);
    } catch (err) {
      onError?.(err);
    }
  }

  function connectSocket() {
    ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${interval}`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const candle = klineToCandle(msg.k);
        const last = candles[candles.length - 1];
        if (last && last.time === candle.time) {
          candles = [...candles.slice(0, -1), candle];
        } else {
          candles = [...candles, candle].slice(-200);
        }
        if (!cancelled) onUpdate([...candles]);
      } catch (err) {
        onError?.(err);
      }
    };
    ws.onerror = () => onError?.(new Error('Binance WebSocket connection error'));
  }

  loadHistory().then(() => { if (!cancelled) connectSocket(); });

  return function unsubscribe() {
    cancelled = true;
    if (ws) ws.close();
  };
}
