import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DEFAULT_THEME, FONT_SCALE_OPTIONS, getThemePrefs, setThemePrefs } from '../../lib/themePrefs.js';
import { DEFAULT_COLORS as DEFAULT_CHART_COLORS, getColorPrefs, setColorPrefs } from '../../lib/colorPrefs.js';

export default function SettingsPage() {
  const [theme, setTheme] = useState(getThemePrefs());
  const [chartColors, setChartColorsState] = useState(getColorPrefs());

  function updateTheme(patch) {
    setTheme(setThemePrefs(patch));
  }

  function updateChartColor(key, value) {
    setChartColorsState(setColorPrefs({ [key]: value }));
  }

  function resetAll() {
    setTheme(setThemePrefs(DEFAULT_THEME));
    setChartColorsState(setColorPrefs(DEFAULT_CHART_COLORS));
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <div className="text-lg font-semibold text-slate-100">Settings</div>
        <div className="text-sm text-slate-400 mt-1">
          These apply instantly and are saved on this device — no save button needed.
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
        <div className="text-sm font-medium text-slate-300">App colors</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-200">Brand color</div>
            <div className="text-xs text-slate-500">Buttons, links, active states throughout the app.</div>
          </div>
          <input type="color" value={theme.brandColor} onChange={(e) => updateTheme({ brandColor: e.target.value })} className="w-10 h-10 rounded border-0 bg-transparent cursor-pointer" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-200">Accent color</div>
            <div className="text-xs text-slate-500">Highlights, badges, the logo's accent bar.</div>
          </div>
          <input type="color" value={theme.accentColor} onChange={(e) => updateTheme({ accentColor: e.target.value })} className="w-10 h-10 rounded border-0 bg-transparent cursor-pointer" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="text-sm font-medium text-slate-300">Text size</div>
        <div className="flex gap-2">
          {FONT_SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateTheme({ fontScale: opt.value })}
              className={`flex-1 py-2 rounded-lg text-sm border ${
                theme.fontScale === opt.value ? 'bg-brand-400/15 border-brand-400/40 text-brand-200' : 'border-slate-800 text-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="text-sm font-medium text-slate-300">Chart candle colors</div>
        <div className="text-xs text-slate-500 -mt-2">Separate from the app's brand colors — these control the Chart and Backtest candlesticks specifically.</div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Bullish <input type="color" value={chartColors.bullish} onChange={(e) => updateChartColor('bullish', e.target.value)} className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer" />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Bearish <input type="color" value={chartColors.bearish} onChange={(e) => updateChartColor('bearish', e.target.value)} className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer" />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Chart accent <input type="color" value={chartColors.accent} onChange={(e) => updateChartColor('accent', e.target.value)} className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer" />
          </label>
        </div>
      </div>

      <button onClick={resetAll} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
        <RotateCcw size={13} /> Reset everything to defaults
      </button>
    </div>
  );
}
