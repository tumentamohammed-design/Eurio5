// src/lib/marketStructure.js
//
// Deliberately does NOT produce a "Buy/Sell/Wait" call or a confidence
// percentage — see the founder conversation in chat for why. Everything
// here is a plain, checkable observation about the price series that's
// already happened: where swing highs/lows sit, which side of its moving
// averages price is trading on, whether recent swings are rising or
// falling. None of it tells you what to do about that.

function sma(values, period, index) {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) sum += values[i];
  return sum / period;
}

// A swing high/low needs `wing` candles on both sides with a strictly
// lower/higher extreme — a standard, mechanical definition, not a judgment call.
function findSwings(candles, wing = 3) {
  const swingHighs = [];
  const swingLows = [];
  for (let i = wing; i < candles.length - wing; i++) {
    const isHigh = candles.slice(i - wing, i).every((c) => c.high < candles[i].high)
      && candles.slice(i + 1, i + 1 + wing).every((c) => c.high < candles[i].high);
    const isLow = candles.slice(i - wing, i).every((c) => c.low > candles[i].low)
      && candles.slice(i + 1, i + 1 + wing).every((c) => c.low > candles[i].low);
    if (isHigh) swingHighs.push({ index: i, time: candles[i].time, price: candles[i].high });
    if (isLow) swingLows.push({ index: i, time: candles[i].time, price: candles[i].low });
  }
  return { swingHighs, swingLows };
}

function isRising(points) {
  if (points.length < 2) return null;
  const recent = points.slice(-3);
  return recent.every((p, i) => i === 0 || p.price >= recent[i - 1].price);
}
function isFalling(points) {
  if (points.length < 2) return null;
  const recent = points.slice(-3);
  return recent.every((p, i) => i === 0 || p.price <= recent[i - 1].price);
}

export function analyzeStructure(candles, pair) {
  if (!candles || candles.length < 30) return null;

  const closes = candles.map((c) => c.close);
  const lastIndex = candles.length - 1;
  const lastClose = closes[lastIndex];
  const ma20 = sma(closes, 20, lastIndex);
  const ma50 = sma(closes, 50, lastIndex);

  const { swingHighs, swingLows } = findSwings(candles, 3);
  const highsRising = isRising(swingHighs);
  const highsFalling = isFalling(swingHighs);
  const lowsRising = isRising(swingLows);
  const lowsFalling = isFalling(swingLows);

  const aboveMA20 = ma20 !== null ? lastClose > ma20 : null;
  const aboveMA50 = ma50 !== null ? lastClose > ma50 : null;

  let state = 'Ranging';
  if (highsRising && lowsRising && aboveMA50) state = 'Bullish';
  else if (highsFalling && lowsFalling && aboveMA50 === false) state = 'Bearish';

  const nearestResistance = [...swingHighs].reverse().find((s) => s.price > lastClose) || null;
  const nearestSupport = [...swingLows].reverse().find((s) => s.price < lastClose) || null;

  const reasonParts = [];
  if (state === 'Bullish') {
    reasonParts.push('Recent swing highs and swing lows are both rising (higher highs, higher lows).');
  } else if (state === 'Bearish') {
    reasonParts.push('Recent swing highs and swing lows are both falling (lower highs, lower lows).');
  } else {
    reasonParts.push('Swing highs and lows are not showing a consistent directional sequence.');
  }
  if (aboveMA50 !== null) {
    reasonParts.push(`Price is trading ${aboveMA50 ? 'above' : 'below'} its 50-period moving average.`);
  }
  if (aboveMA20 !== null) {
    reasonParts.push(`It is ${aboveMA20 ? 'above' : 'below'} the 20-period moving average.`);
  }

  return {
    pair,
    state, // 'Bullish' | 'Bearish' | 'Ranging' — a structural classification, not a recommendation
    lastClose,
    ma20, ma50,
    support: nearestSupport ? nearestSupport.price : null,
    resistance: nearestResistance ? nearestResistance.price : null,
    reasoning: reasonParts.join(' '),
    swingHighs: swingHighs.slice(-5),
    swingLows: swingLows.slice(-5),
  };
}
