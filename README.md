# Eurio5

A trading discipline journal + liquidity clock + FX news calendar + rules engine + Stripe-billed Pro plan + trader network (country-based profiles, follow/feed) + honest broker & prop-firm directories, built as an installable PWA.

**Stack:** React + Vite + Tailwind + React Router (frontend) · Supabase (Auth + Postgres + Storage) · Stripe (billing) · Vercel (hosting + serverless functions).

**Routes:** `/` marketing landing page (public) · `/login` sign in/up (public) · `/app` the actual product (requires sign-in).

**Deliberately not included** (each needs its own careful design before touching real users or real money): encrypted DMs/chat, identity (KYC) verification, an escrow marketplace, a live trading chart, and a trade-signal engine. See the chat history for why each of these needs more than a quick build.

---

## 1. Run it locally

**Prerequisites:** Node.js 18+, a free [Supabase](https://supabase.com) account, a free [Stripe](https://stripe.com) account (test mode is fine).

```bash
npm install
cp .env.example .env
# edit .env — see sections 2 and 3 below for where each value comes from
npm run dev
```

Open http://localhost:5173. Two tabs need more than plain `vite dev` to work locally:

- **`/api/*` routes** (calendar, checkout, webhook, admin stats) are Vercel serverless functions — they don't run under plain `vite dev`. Use `npx vercel dev` instead to emulate them locally, or test those specific features after deploying (section 5).
- **Stripe webhook** needs the Stripe CLI locally — see section 3.4.

---

## 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste the entire contents of `supabase/schema.sql` → **Run**. This creates `profiles`, `trades`, `rules`, `discipline_logs`, `referral_clicks`, all their RLS policies, the free-plan quota (enforced at the database level, not just the UI), and the `screenshots` Storage bucket.
3. **Authentication → Providers**: Email is on by default. For local testing, turn off "Confirm email" under **Authentication → Settings** so sign-up works instantly.
4. **Project Settings → API**, copy into `.env`:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ treat like a database root password — never expose this to the browser; it's only read by `/api/*` functions)

### Make yourself admin
Sign up in the app once (so your `profiles` row exists), then in the SQL Editor:
```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```
The Admin tab (users, MRR, Pro count) now appears in your sidebar/nav — nowhere else, and gated server-side, not just hidden in the UI.

---

## 3. Set up Stripe

### 3.1 Create the Pro product
**Stripe Dashboard → Product catalog → Add product** — name it "Pro", price **$9.99/month**, recurring. Copy the resulting **Price ID** (`price_...`) into `STRIPE_PRO_PRICE_ID`.

### 3.2 API keys
**Developers → API keys**:
- **Publishable key** (`pk_...`) → `VITE_STRIPE_PUBLISHABLE_KEY`
- **Secret key** (`sk_...`) → `STRIPE_SECRET_KEY`

### 3.3 Webhook endpoint (production)
**Developers → Webhooks → Add endpoint**:
- URL: `https://your-app.vercel.app/api/stripe-webhook`
- Events to send: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- After creating it, copy the **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET` in your Vercel environment variables.

This is what flips `is_pro` on/off in `profiles` — without it, checkout completes on Stripe's side but your app never finds out.

### 3.4 Testing the webhook locally
```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe-webhook
```
(`localhost:3000` because `vercel dev`'s default port — adjust if yours differs.) The CLI prints a `whsec_...` — use *that* in your local `.env` for `STRIPE_WEBHOOK_SECRET` while testing locally; it's different from the production one from step 3.3. Trigger a test event with:
```bash
stripe trigger checkout.session.completed
```

### 3.5 Customer portal
**Settings → Billing → Customer portal** — turn it on (test mode has it on by default). This is what powers the "Manage billing / cancel" button for Pro users.

---

## 4. What I could NOT verify from here

I built and syntax-checked every file, and the full Vite production build compiles with zero errors — but I have no live Supabase project or Stripe account to actually run this against. Specifically unverified:

- A real sign-up → log a trade → hit the 30-entry limit → upgrade → limit lifts round-trip.
- The webhook actually flipping `is_pro` on a real `checkout.session.completed` event.
- The RLS quota policy's exact error surface — I've matched the error-handling code to what a Postgres RLS violation (`42501`) looks like, but haven't watched a real one happen.

Run through that flow yourself first, in Stripe test mode, before pointing real customers at it.

---

## 5. Deploy to Vercel (free)

1. Push to GitHub, then **vercel.com → Add New → Project** → import the repo. Vite is auto-detected.
2. Add **every** variable from the checklist below under **Project Settings → Environment Variables**.
3. Deploy. `/api/*` routes are picked up automatically as serverless functions; `vercel.json` handles client-side routing so `/app` doesn't 404 on refresh.
4. Go back to Stripe (section 3.3) and point the webhook at your real `https://your-app.vercel.app/api/stripe-webhook` URL if you haven't already.
5. On your phone, open the deployed URL and "Add to Home Screen" — it installs as a real PWA (manifest + service worker are generated automatically by `vite-plugin-pwa` at build time).

---

## 6. Environment variable checklist

Copy `.env.example` → `.env` for local dev. Add the same set in Vercel for production. **Vars without `VITE_` are server-only** (read by `/api/*.js`, never bundled into the browser); **vars with `VITE_` are public** — never put a secret behind one.

| Variable | Where it's used | Where to get it |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend + server | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | frontend | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Supabase → Project Settings → API |
| `VITE_STRIPE_PUBLISHABLE_KEY` | frontend | Stripe → Developers → API keys |
| `STRIPE_SECRET_KEY` | server only | Stripe → Developers → API keys |
| `STRIPE_PRO_PRICE_ID` | server only | Stripe → your Pro product → Price ID |
| `STRIPE_WEBHOOK_SECRET` | server only | Stripe → Webhooks → your endpoint (prod) or `stripe listen` (local) |
| `VITE_APP_URL` | server (builds Stripe redirect URLs) | your local/deployed URL |
| `VITE_BROKER_AFFILIATE_URL` | frontend | your actual affiliate link |

---

## 6.5 What's new: the trader network

- **Traders tab** — set up a public profile (country, bio, experience, pairs, photo), browse/filter other traders by country, follow/unfollow.
- **Feed tab** — post text + an optional chart screenshot, like, comment; defaults to your country, toggle to see everyone.
- **Brokers / Get Funded tabs** — honest, filterable comparison directories. Admins (`is_admin = true`) get inline Add/Edit/Delete controls right on these pages. Clicking "Visit broker" / "Get funded" goes through `/api/go-broker` or `/api/go-propfirm`, which counts the click server-side (via a `SECURITY DEFINER` Postgres function, so a user can bump the counter but can't tamper with the listing itself) before redirecting to your real affiliate link.
- New tables: `follows`, `posts`, `post_likes`, `post_comments`, `brokers`, `prop_firms`, plus `country`/`display_name`/`bio`/`experience_level`/`favorite_pairs`/`avatar_path` added to `profiles`.
- **Security note**: `profiles` now needs to be readable by everyone (that's the whole point of a directory), so a new trigger (`protect_billing_fields`) blocks anyone but the Stripe webhook or direct SQL from changing `is_pro`/`is_admin`/`stripe_*` — I ran this against a real Postgres instance and confirmed a user genuinely cannot upgrade themselves, and that the webhook path still works.
- The 30-trades/month free limit is enforced by a single RLS policy on `trades` (`trades_insert_own_under_quota`) rather than a trigger — I tested this directly: 30 inserts succeed, the 31st is blocked, and upgrading to Pro immediately unblocks it.

## 7. Project structure

```
api/calendar.js               FX calendar proxy (unofficial feed — see comments in the file)
api/create-checkout-session.js Creates a Stripe Checkout session for Pro
api/create-portal-session.js   Opens the Stripe billing portal
api/stripe-webhook.js          Verifies Stripe's signature, updates profiles.is_pro
api/admin-stats.js             Admin-only aggregate stats (service role, gated by is_admin)
api/_lib/supabaseAdmin.js      Shared server-side Supabase client + JWT verification
supabase/schema.sql            All tables, RLS policies, storage bucket — run once
src/lib/sessions.js            Session hours + your 3 high-liquidity windows (GMT)
src/lib/rules.js               Rules engine: checks a trade's time/pair against saved rules
src/lib/timezone.js            Africa/Douala (fixed UTC+1) helpers used app-wide
src/lib/csv.js                 Journal → CSV export
src/context/AppContext.jsx     Auth, trades, rules, calendar, billing, referral — all in one place
src/App.jsx                    Routing (/ , /login, /app) + tab navigation inside /app
```

## 8. Known limitations

- **FX calendar** depends on an unofficial ForexFactory mirror — see comments in `api/calendar.js` for paid alternatives if you need production reliability.
- **"High liquidity in 15 min" alerts** only fire while the app/PWA is open (foreground or backgrounded tab). A fully-closed-app push notification needs a server-side push service (Supabase Edge Function + Web Push) — a solid next step, not built here.
- **Screenshots** are stored in a public Storage bucket (readable by anyone with the exact URL, not listable). Switch the bucket to private + `createSignedUrl` in `AppContext.jsx` if you want them fully private.
- **MRR** on the admin dashboard is `Pro users × $9.99` — it doesn't account for discounts, annual plans, or churn mid-cycle.
- No automated tests, no error boundary (an unexpected error in one component could blank that section instead of failing gracefully).
