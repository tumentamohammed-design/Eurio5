// src/lib/marketData.js
//
// NO REAL MARKET DATA YET — by design (per the founder's call: skip a paid
// feed until there's revenue to fund one). This generates a plausible,
// deterministic-per-pair candlestick series so the chart and market
// structure engine have something real to compute against.
//
// TO CONNECT A REAL FEED LATER: replace the body of getCandles() with a
// fetch to your provider, returning the same shape:
//   [{ time: unixSeconds, open, high, low, close, volume }, ...]
// sorted ascending by time. Everything downstream (the chart renderer and
// src/lib/marketStructure.js) only depends on that shape, not on how it was
// produced — no other code needs to change.

function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_PRICES = {
  'EUR/USD': 1.085, 'GBP/USD': 1.27, 'USD/JPY': 151.5, 'USD/CHF': 0.885,
  'AUD/USD': 0.655, 'USD/CAD': 1.365, 'NZD/USD': 0.605, 'EUR/JPY': 164.5,
  'GBP/JPY': 192.5, 'XAU/USD': 2340,
};

const TIMEFRAME_SECONDS = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1D': 86400 };

// Deterministic per (pair, timeframe) so re-rendering doesn't jitter, but
// still looks like a real, noisy price series with trend + mean reversion.
export function getCandles(pair, timeframe, count = 200) {
  const base = BASE_PRICES[pair] || 1;
  const stepSeconds = TIMEFRAME_SECONDS[timeframe] || 3600;
  const rand = mulberry32(seedFromString(`${pair}:${timeframe}`));

  const candles = [];
  let price = base;
  let trend = 0;
  const now = Math.floor(Date.now() / 1000);
  const volatility = base * 0.0025;

  for (let i = count - 1; i >= 0; i--) {
    trend += (rand() - 0.5) * 0.15;
    trend = Math.max(-1, Math.min(1, trend));
    const drift = trend * volatility * 0.4;
    const open = price;
    const close = open + drift + (rand() - 0.5) * volatility;
    const high = Math.max(open, close) + rand() * volatility * 0.6;
    const low = Math.min(open, close) - rand() * volatility * 0.6;
    const volume = Math.round(500 + rand() * 1500);
    const time = now - i * stepSeconds;
    candles.push({ time, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

export const CHART_PAIRS = Object.keys(BASE_PRICES);
export const TIMEFRAMES = Object.keys(TIMEFRAME_SECONDS);
export const IS_DEMO_DATA = true;
