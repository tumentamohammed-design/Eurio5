// src/lib/rules.js
// Evaluates a trade-in-progress against the user's saved rules.
//
// Rule types:
//   'session_window' -> config.windows = [{ start, end }] in GMT minutes-of-day.
//                        Violated if the trade's entry time falls outside ALL
//                        listed windows.
//   'news_buffer'     -> config.minutes = number. Violated if the trade's
//                        entry time is within that many minutes of a
//                        High-impact calendar event for a currency in the pair.
//   'custom'          -> free-text reminder only, never auto-checked (shown
//                        as a checklist in the trade form instead).

export function pairToCurrencies(pair) {
  if (!pair) return [];
  return pair.split('/').map((c) => c.trim().toUpperCase());
}

function inWindow(minuteOfDay, start, end) {
  return start <= end ? minuteOfDay >= start && minuteOfDay < end : minuteOfDay >= start || minuteOfDay < end;
}

/**
 * @param {{ utcDate: Date, pair: string }} trade  a real JS Date (already
 *        converted to the correct UTC instant by the caller — see
 *        src/lib/timezone.js#doualaWallClockToUTC)
 * @param {Array} rules   rows from the `rules` table
 * @param {Array} calendarEvents  normalized events from /api/calendar
 * @returns {string[]} human-readable violation messages (empty = no violations)
 */
export function evaluateTradeAgainstRules({ utcDate, pair }, rules, calendarEvents) {
  const violations = [];
  if (!utcDate || Number.isNaN(utcDate.getTime())) return violations;

  const gmtMinutes = utcDate.getUTCHours() * 60 + utcDate.getUTCMinutes();

  (rules || [])
    .filter((r) => r.active !== false)
    .forEach((rule) => {
      if (rule.type === 'session_window') {
        const windows = rule.config?.windows || [];
        const ok = windows.length === 0 || windows.some((w) => inWindow(gmtMinutes, w.start, w.end));
        if (!ok) violations.push(rule.rule_text || 'Outside your allowed trading window');
      }

      if (rule.type === 'news_buffer') {
        const bufferMin = rule.config?.minutes ?? 30;
        const currencies = pairToCurrencies(pair);
        const hit = (calendarEvents || []).some((ev) => {
          if (ev.impact !== 'High') return false;
          if (!currencies.includes((ev.country || '').toUpperCase())) return false;
          const evTime = new Date(ev.date).getTime();
          if (Number.isNaN(evTime)) return false;
          const diffMin = Math.abs(utcDate.getTime() - evTime) / 60000;
          return diffMin <= bufferMin;
        });
        if (hit) violations.push(rule.rule_text || `Within ${bufferMin} min of high-impact news`);
      }
      // 'custom' rules are intentionally not auto-checked.
    });

  return violations;
}
