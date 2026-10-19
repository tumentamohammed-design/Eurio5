// api/calendar.js
//
// Serverless proxy for the FX high-impact news calendar.
//
// IMPORTANT — read before relying on this in production:
// Neither ForexFactory nor Investing.com publish an official public API.
// This route calls a community-maintained JSON mirror of ForexFactory's
// weekly calendar (widely used by hobby trading tools, undocumented,
// unofficial, and can change or go offline without notice). Scraping /
// mirroring ForexFactory's data may also fall outside their terms of use —
// treat this as a fast way to get a working prototype, not a production
// guarantee.
//
// Verified data shape: each event is
// { title, country, date, impact, forecast, previous, actual } where
// `country` is a currency code ("USD", "EUR", ...) and `impact` is one of
// "High" | "Medium" | "Low" | "Holiday".
//
// Known failure mode: ForexFactory rate-limits this feed to roughly 2
// requests / 5 minutes per source. Past that limit it returns an HTML
// "Request Denied" page instead of JSON — handled below instead of
// throwing. Our Cache-Control header (15 min) keeps normal usage well
// under that limit once deployed (Vercel's edge caches the response), but
// expect occasional rate-limit responses during rapid local testing
// without a CDN in front of it.
//
// For anything you actually depend on, swap the fetch below for a real,
// licensed provider such as:
//   - TradingEconomics API (https://tradingeconomics.com/api)
//   - Finnhub economic calendar (https://finnhub.io/docs/api/economic-calendar)
//   - FCS API economic calendar (https://fcsapi.com/document/economy-calendar-api)
// All three need a paid/API-key plan for reliable high-impact-news coverage
// — put the key in a server-side env var (no VITE_ prefix) here, never in
// the frontend.

const FEED_URLS = [
  'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json', // CDN-fronted mirror — try first
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json',     // fallback
];

export default async function handler(req, res) {
  let lastError = null;

  for (const url of FEED_URLS) {
    try {
      const upstream = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FxDisciplineTracker/1.0)' },
      });

      const text = await upstream.text();

      let raw;
      try {
        raw = JSON.parse(text);
      } catch {
        lastError = new Error(`Non-JSON response from ${url} (likely rate-limited)`);
        continue;
      }

      if (!Array.isArray(raw)) {
        lastError = new Error(`Unexpected response shape from ${url}`);
        continue;
      }

      const events = raw.map((e) => ({
        title: e.title || 'Untitled event',
        country: e.country || '',
        date: e.date,
        impact: e.impact || 'Low',
        forecast: e.forecast || null,
        previous: e.previous || null,
        actual: e.actual || null,
      }));

      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
      res.status(200).json(events);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  res.status(502).json({
    error: 'Calendar feed unavailable — likely rate-limited upstream or temporarily down. Try again in a few minutes.',
    detail: String(lastError),
  });
}
