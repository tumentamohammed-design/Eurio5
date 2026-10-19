// src/lib/colorPrefs.js
//
// This is a real, independently-deployed web app (not a Claude artifact),
// so plain localStorage is the normal, appropriate tool for a small client
// preference like "what color do you want bullish candles" — no backend
// round-trip needed for something this low-stakes and device-local.

const STORAGE_KEY = 'eurio5.chartColors';

export const DEFAULT_COLORS = {
  bullish: '#0f7a3d',
  bearish: '#f87171',
  accent: '#ffcc00',
};

export function getColorPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COLORS };
    return { ...DEFAULT_COLORS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_COLORS };
  }
}

export function setColorPrefs(patch) {
  const next = { ...getColorPrefs(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage can throw in rare cases (private browsing quota, etc.) —
    // not worth failing the UI over a cosmetic preference.
  }
  return next;
}
