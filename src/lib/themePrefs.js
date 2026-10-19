// src/lib/themePrefs.js
//
// Powers the Settings tab's "implement your own styles" controls. Because
// Tailwind classes are normally compiled to fixed CSS at BUILD time, a
// runtime color picker can't change them directly — so the brand/accent
// colors are defined as CSS variables instead (see src/index.css and
// tailwind.config.js), and this file is what rewrites those variables on
// the fly. This is real, live theming, not a cosmetic toggle.

const STORAGE_KEY = 'eurio5.themePrefs';

export const DEFAULT_THEME = {
  brandColor: '#0f7a3d',
  accentColor: '#ffcc00',
  fontScale: 112, // percent; 112 = the new "a little bigger" default, matches --app-font-scale in index.css
};

export const FONT_SCALE_OPTIONS = [
  { label: 'Small', value: 100 },
  { label: 'Default', value: 112 },
  { label: 'Large', value: 125 },
];

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function triplet({ r, g, b }) { return `${r} ${g} ${b}`; }

// Generates a full 200–600 scale from one anchor hex color, by shifting
// lightness in HSL space. `anchorLevel` says which shade the input hex
// itself becomes (brand's anchor is 500; accent's is 400, matching how
// each scale was originally hand-picked in index.css's defaults). Offsets
// are computed relative to whichever level is the anchor, so a level
// "above" the anchor (e.g. 500 when the anchor is 400) correctly comes out
// darker rather than duplicating the anchor.
const LEVELS = [200, 300, 400, 500, 600];
const LIGHTNESS_STEP_PER_100 = 0.14;

function generateScale(hex, anchorLevel = 500) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const at = (lightness) => triplet(hslToRgb(h, s, Math.max(0.04, Math.min(0.95, lightness))));
  const anchor = triplet({ r, g, b });
  const scale = {};
  LEVELS.forEach((level) => {
    if (level === anchorLevel) { scale[level] = anchor; return; }
    const stepsLighter = (anchorLevel - level) / 100; // positive => lighter (lower numbers are lighter shades)
    scale[level] = at(l + stepsLighter * LIGHTNESS_STEP_PER_100);
  });
  return scale;
}

export function getThemePrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME };
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function applyThemeToDOM(prefs) {
  const root = document.documentElement;
  const brand = generateScale(prefs.brandColor, 500);
  const accent = generateScale(prefs.accentColor, 400);
  root.style.setProperty('--brand-200', brand[200]);
  root.style.setProperty('--brand-300', brand[300]);
  root.style.setProperty('--brand-400', brand[400]);
  root.style.setProperty('--brand-500', brand[500]);
  root.style.setProperty('--brand-600', brand[600]);
  root.style.setProperty('--accent-300', accent[300]);
  root.style.setProperty('--accent-400', accent[400]);
  root.style.setProperty('--accent-500', accent[600]);
  root.style.setProperty('--app-font-scale', `${prefs.fontScale}%`);
}

export function setThemePrefs(patch) {
  const next = { ...getThemePrefs(), ...patch };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* non-fatal */ }
  applyThemeToDOM(next);
  return next;
}

// Call once on app boot so a returning visitor's saved theme applies
// immediately, before anything renders with the default colors.
export function initThemeOnLoad() {
  applyThemeToDOM(getThemePrefs());
}
