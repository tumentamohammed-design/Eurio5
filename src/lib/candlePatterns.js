// src/lib/candlePatterns.js
//
// Mechanical, geometry-only pattern detection — a Hammer is a Hammer
// because of its shape (small body, long lower wick), full stop. No pattern
// here implies what to do about it; that's left entirely to the trader.

function body(c) { return Math.abs(c.close - c.open); }
function range(c) { return c.high - c.low; }
function upperWick(c) { return c.high - Math.max(c.open, c.close); }
function lowerWick(c) { return Math.min(c.open, c.close) - c.low; }
function isBullish(c) { return c.close > c.open; }

export function isDoji(c) {
  const r = range(c);
  if (r === 0) return false;
  return body(c) / r < 0.1;
}

export function isHammer(c) {
  const r = range(c);
  if (r === 0) return false;
  const b = body(c);
  return lowerWick(c) >= b * 2 && upperWick(c) <= b * 0.5 && b / r < 0.4;
}

// A Pin Bar can point either direction — a long lower wick (bullish pin) or
// a long upper wick (bearish pin), with a small body near one end.
export function isPinBar(c) {
  const r = range(c);
  if (r === 0) return false;
  const b = body(c);
  if (b / r > 0.3) return false;
  return lowerWick(c) >= r * 0.66 || upperWick(c) >= r * 0.66;
}

export function isEngulfing(prev, curr) {
  if (!prev || !curr) return false;
  const prevBull = isBullish(prev);
  const currBull = isBullish(curr);
  if (prevBull === currBull) return false; // needs to be an opposite-color pair
  const prevTop = Math.max(prev.open, prev.close);
  const prevBottom = Math.min(prev.open, prev.close);
  const currTop = Math.max(curr.open, curr.close);
  const currBottom = Math.min(curr.open, curr.close);
  return currTop >= prevTop && currBottom <= prevBottom;
}

export function isInsideBar(prev, curr) {
  if (!prev || !curr) return false;
  return curr.high <= prev.high && curr.low >= prev.low;
}

export const PATTERN_DEFINITIONS = {
  hammer: { label: 'Hammer', test: (candles, i) => isHammer(candles[i]) },
  doji: { label: 'Doji', test: (candles, i) => isDoji(candles[i]) },
  engulfing: { label: 'Engulfing', test: (candles, i) => isEngulfing(candles[i - 1], candles[i]) },
  pinbar: { label: 'Pin Bar', test: (candles, i) => isPinBar(candles[i]) },
  insidebar: { label: 'Inside Bar', test: (candles, i) => isInsideBar(candles[i - 1], candles[i]) },
};

// Returns the candle indices (and times) where the named pattern occurs.
export function findPattern(candles, patternKey) {
  const def = PATTERN_DEFINITIONS[patternKey];
  if (!def) return [];
  const hits = [];
  for (let i = 1; i < candles.length; i++) {
    if (def.test(candles, i)) hits.push({ index: i, time: candles[i].time });
  }
  return hits;
}
