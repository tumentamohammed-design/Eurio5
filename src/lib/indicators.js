// src/lib/indicators.js — plain technical-indicator math, no interpretation
// layered on top. What a caller does with these numbers is up to it.

export function calculateEMA(closes, period) {
  const k = 2 / (period + 1);
  const out = new Array(closes.length).fill(null);
  let prev = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) {
      // seed with a simple average of the first `period` closes
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      prev = sum / period;
    } else {
      prev = closes[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

export function calculateRSI(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;

  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff; else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

// Convenience: EMA/RSI as {time, value} series aligned to candle times, with
// nulls dropped — ready to hand straight to a lightweight-charts line series.
export function emaSeries(candles, period) {
  const closes = candles.map((c) => c.close);
  const values = calculateEMA(closes, period);
  return candles.map((c, i) => ({ time: c.time, value: values[i] })).filter((p) => p.value !== null);
}

export function rsiSeries(candles, period = 14) {
  const closes = candles.map((c) => c.close);
  const values = calculateRSI(closes, period);
  return candles.map((c, i) => ({ time: c.time, value: values[i] })).filter((p) => p.value !== null);
}
