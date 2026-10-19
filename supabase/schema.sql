-- ============================================================================
-- Forex Discipline & Liquidity Tracker — complete Supabase schema
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run: uses "if not exists" / "drop policy if exists" throughout.
--
-- Tables: profiles, trades, rules, discipline_logs, referral_clicks
-- Plus: auto-profile-creation trigger, and a free-plan quota enforced
-- directly by an RLS policy (not just the UI — see the note above
-- trades_insert_own_under_quota below for why that matters).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles — one row per user, auto-created on sign-up.
--    Holds plan/billing/admin state. There is deliberately NO update policy
--    for normal users below: is_pro, is_admin and the stripe_* columns can
--    only ever be changed by the Stripe webhook (service role, bypasses
--    RLS) or by you directly in SQL. This is what stops a user from just
--    running `update profiles set is_pro = true` against their own row.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text,
  is_pro                  boolean not null default false,
  is_admin                boolean not null default false,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Plain "see your own row" policy. The admin dashboard does NOT rely on a
-- special RLS bypass here — it calls /api/admin-stats, a serverless
-- function that authenticates the caller, checks is_admin server-side, and
-- uses the service role key to compute aggregates. That keeps this policy
-- simple and avoids any self-referential RLS subtlety.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up (standard Supabase
-- pattern: security definer lets this insert succeed despite there being
-- no client-facing insert policy on profiles).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. trades — the trading journal
-- ---------------------------------------------------------------------------
create table if not exists public.trades (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  date            date not null,
  time            time not null,
  pair            text not null,
  direction       text not null check (direction in ('Long', 'Short')),
  entry           numeric not null,
  sl              numeric not null,
  tp              numeric not null,
  planned_rr      numeric,
  setup           text,
  result          text not null default 'open' check (result in ('open', 'win', 'loss', 'breakeven')),
  r_achieved      numeric not null default 0,
  emotion         smallint check (emotion between 1 and 10),
  notes           text,
  followed_routine boolean not null default true,
  rule_violations  text[] default '{}',
  session         text,
  liquidity       text,
  screenshot_path text,
  created_at      timestamptz not null default now()
);

create index if not exists trades_user_id_idx on public.trades (user_id);
create index if not exists trades_date_idx on public.trades (user_id, date);

alter table public.trades enable row level security;

drop policy if exists "trades_select_own" on public.trades;
create policy "trades_select_own" on public.trades for select using (auth.uid() = user_id);

drop policy if exists "trades_update_own" on public.trades;
create policy "trades_update_own" on public.trades for update using (auth.uid() = user_id);

drop policy if exists "trades_delete_own" on public.trades;
create policy "trades_delete_own" on public.trades for delete using (auth.uid() = user_id);

-- --- Free-plan paywall, enforced in the database, not just the UI ----------
-- This is the ONLY insert policy on trades — it combines ownership AND the
-- 30-entries/month quota into one check. A free user's insert past the
-- limit fails as a genuine RLS violation (Postgres error code 42501), which
-- the frontend (src/context/AppContext.jsx#saveTrade) catches and turns
-- into a friendly "upgrade to Pro" message. Critically, this also blocks
-- someone who bypasses the UI entirely and calls the Supabase API directly
-- — a client-side-only limit would not.
-- Bucketed by the trade's own `date` (not "today"), so backdating an entry
-- counts against the month it belongs to.
drop policy if exists "trades_insert_own" on public.trades;
drop policy if exists "trades_insert_own_under_quota" on public.trades;
create policy "trades_insert_own_under_quota" on public.trades
  for insert
  with check (
    auth.uid() = user_id
    and (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_pro = true)
      or (
        select count(*) from public.trades existing
        where existing.user_id = auth.uid()
          and date_trunc('month', existing.date) = date_trunc('month', date)
      ) < 30
    )
  );

-- ---------------------------------------------------------------------------
-- 3. rules — the rules engine
-- ---------------------------------------------------------------------------
create table if not exists public.rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  rule_text   text not null,
  type        text not null default 'custom' check (type in ('session_window', 'news_buffer', 'custom')),
  config      jsonb not null default '{}'::jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists rules_user_id_idx on public.rules (user_id);

alter table public.rules enable row level security;

drop policy if exists "rules_select_own" on public.rules;
create policy "rules_select_own" on public.rules for select using (auth.uid() = user_id);
drop policy if exists "rules_insert_own" on public.rules;
create policy "rules_insert_own" on public.rules for insert with check (auth.uid() = user_id);
drop policy if exists "rules_update_own" on public.rules;
create policy "rules_update_own" on public.rules for update using (auth.uid() = user_id);
drop policy if exists "rules_delete_own" on public.rules;
create policy "rules_delete_own" on public.rules for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. discipline_logs — an append-only audit trail of discipline events.
--    Written directly by the client (src/context/AppContext.jsx#saveTrade)
--    on every trade save, including edits — so a trade that's edited
--    several times leaves a full history of how its discipline status
--    changed over time, rather than a single overwritten row.
--    The dashboard's discipline score itself is computed from
--    `trades.followed_routine` (simpler, already covers everything); this
--    table exists so you can query/export discipline history independently
--    — e.g. "every off-routine trade in March" — without touching trades.
--    score_change (+1/-1) is intentionally NOT stored: it's fully derived
--    from followed_routine (true -> +1, false -> -1), so `case when
--    followed_routine then 1 else -1 end` in a query gives you it directly.
-- ---------------------------------------------------------------------------
create table if not exists public.discipline_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  trade_id          uuid not null references public.trades(id) on delete cascade,
  followed_routine  boolean not null,
  rule_violations   text[] default '{}',
  created_at        timestamptz not null default now()
);

create index if not exists discipline_logs_user_id_idx on public.discipline_logs (user_id);
create index if not exists discipline_logs_trade_id_idx on public.discipline_logs (trade_id);

alter table public.discipline_logs enable row level security;

drop policy if exists "discipline_logs_select_own" on public.discipline_logs;
create policy "discipline_logs_select_own" on public.discipline_logs for select using (auth.uid() = user_id);
drop policy if exists "discipline_logs_insert_own" on public.discipline_logs;
create policy "discipline_logs_insert_own" on public.discipline_logs for insert with check (auth.uid() = user_id);
-- No update/delete policy for anyone via the client — append-only by design.

-- ---------------------------------------------------------------------------
-- 5. referral_clicks — tracks clicks on your broker affiliate link.
--    Aggregate counts for the admin dashboard come from /api/admin-stats
--    (service role), so — same reasoning as profiles above — this only
--    needs a plain "own rows" select policy, not an admin bypass.
-- ---------------------------------------------------------------------------
create table if not exists public.referral_clicks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  clicked_at  timestamptz not null default now()
);

create index if not exists referral_clicks_user_id_idx on public.referral_clicks (user_id);

alter table public.referral_clicks enable row level security;

drop policy if exists "referral_clicks_insert_own" on public.referral_clicks;
create policy "referral_clicks_insert_own" on public.referral_clicks
  for insert with check (auth.uid() = user_id);

drop policy if exists "referral_clicks_select_own_or_admin" on public.referral_clicks;
drop policy if exists "referral_clicks_select_own" on public.referral_clicks;
create policy "referral_clicks_select_own" on public.referral_clicks
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Storage bucket for trade screenshots
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

drop policy if exists "screenshots_insert_own_folder" on storage.objects;
create policy "screenshots_insert_own_folder" on storage.objects
  for insert with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "screenshots_update_own_folder" on storage.objects;
create policy "screenshots_update_own_folder" on storage.objects
  for update using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "screenshots_delete_own_folder" on storage.objects;
create policy "screenshots_delete_own_folder" on storage.objects
  for delete using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "screenshots_public_read" on storage.objects;
create policy "screenshots_public_read" on storage.objects
  for select using (bucket_id = 'screenshots');

-- ============================================================================
-- 7. ONE-TIME: make yourself admin.
--    Run this AFTER you've signed up in the app at least once (so your
--    profiles row exists).
-- ============================================================================
-- update public.profiles set is_admin = true where email = 'you@example.com';

-- ============================================================================
-- EURIO5 UPDATE — trader network, feed, broker/prop-firm directories.
--
-- Deliberately NOT included in this update (each needs its own careful
-- design before touching real users or real money — see chat for why):
-- DMs/chat, KYC/identity verification, the escrow marketplace, live
-- chart/market data, and the rule-based trade-signal engine.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 8. profiles — extend with public trader-network fields
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists experience_level text
  check (experience_level in ('Beginner', 'Intermediate', 'Advanced', 'Professional'));
alter table public.profiles add column if not exists favorite_pairs text[] default '{}';

-- Everyone needs to be able to browse the trader directory (name, country,
-- bio, etc.) — that's the whole point of a network — so unlike the plain
-- "own row only" policy from the monetization update, profiles now needs a
-- second, public-facing policy. Billing/admin fields (is_pro, is_admin,
-- stripe_*) are still never exposed by anything client-facing beyond the
-- user's own row, and still can't be written by users — see below.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_public_fields_or_own" on public.profiles;
create policy "profiles_select_public_fields_or_own" on public.profiles
  for select using (true);
-- Note: RLS controls which ROWS you can see, not which COLUMNS — so the
-- frontend (src/context/SocialContext.jsx) is written to only ever SELECT
-- the public columns (id, display_name, country, bio, experience_level,
-- favorite_pairs, avatar_path, is_pro) when querying other users, and never
-- pulls is_admin/stripe_*/email for anyone but the signed-in user's own row.

drop policy if exists "profiles_update_own_public_fields" on public.profiles;
create policy "profiles_update_own_public_fields" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- Users now legitimately need to update their own row (country, bio, etc.),
-- which reopens a gap the monetization update closed: a plain UPDATE policy
-- would let a user set their own is_pro/is_admin/stripe_* fields directly.
-- This trigger blocks changes to those specific fields from anyone except
-- the Stripe webhook (which connects as the `service_role` Postgres role,
-- checked explicitly below) or you, running SQL directly.
create or replace function public.protect_billing_fields()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.is_pro is distinct from old.is_pro
    or new.is_admin is distinct from old.is_admin
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.current_period_end is distinct from old.current_period_end
  then
    raise exception 'Billing and admin fields can only be changed by the Stripe webhook or directly in SQL.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_protect_billing_fields on public.profiles;
create trigger profiles_protect_billing_fields
  before update on public.profiles
  for each row execute function public.protect_billing_fields();

-- ---------------------------------------------------------------------------
-- 9. avatars storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_insert_own_folder" on storage.objects;
create policy "avatars_insert_own_folder" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_update_own_folder" on storage.objects;
create policy "avatars_update_own_folder" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_delete_own_folder" on storage.objects;
create policy "avatars_delete_own_folder" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');

-- ---------------------------------------------------------------------------
-- 10. follows — the connection graph
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  id            uuid primary key default gen_random_uuid(),
  follower_id   uuid not null references auth.users(id) on delete cascade,
  followee_id   uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint follows_no_self_follow check (follower_id <> followee_id),
  constraint follows_unique unique (follower_id, followee_id)
);

create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;
drop policy if exists "follows_select_all" on public.follows;
create policy "follows_select_all" on public.follows for select using (true);
drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows for insert with check (auth.uid() = follower_id);
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = follower_id);

-- ---------------------------------------------------------------------------
-- 11. posts, post_likes, post_comments — the feed
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  country     text,
  content     text not null check (char_length(content) between 1 and 2000),
  image_path  text,
  created_at  timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_country_idx on public.posts (country);

alter table public.posts enable row level security;
drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts for select using (true);
drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts for insert with check (auth.uid() = user_id);
drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts for delete using (auth.uid() = user_id);

create table if not exists public.post_likes (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint post_likes_unique unique (post_id, user_id)
);

alter table public.post_likes enable row level security;
drop policy if exists "post_likes_select_all" on public.post_likes;
create policy "post_likes_select_all" on public.post_likes for select using (true);
drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own" on public.post_likes for insert with check (auth.uid() = user_id);
drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own" on public.post_likes for delete using (auth.uid() = user_id);

create table if not exists public.post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 1000),
  created_at  timestamptz not null default now()
);

create index if not exists post_comments_post_id_idx on public.post_comments (post_id);

alter table public.post_comments enable row level security;
drop policy if exists "post_comments_select_all" on public.post_comments;
create policy "post_comments_select_all" on public.post_comments for select using (true);
drop policy if exists "post_comments_insert_own" on public.post_comments;
create policy "post_comments_insert_own" on public.post_comments for insert with check (auth.uid() = user_id);
drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own" on public.post_comments for delete using (auth.uid() = user_id);

-- posts storage bucket (chart screenshots attached to posts)
insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do nothing;

drop policy if exists "posts_bucket_insert_own_folder" on storage.objects;
create policy "posts_bucket_insert_own_folder" on storage.objects
  for insert with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "posts_bucket_delete_own_folder" on storage.objects;
create policy "posts_bucket_delete_own_folder" on storage.objects
  for delete using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "posts_bucket_public_read" on storage.objects;
create policy "posts_bucket_public_read" on storage.objects for select using (bucket_id = 'posts');

-- ---------------------------------------------------------------------------
-- 12. brokers + prop_firms — honest comparison directories
--
-- Read access is open to any signed-in user; only an admin (is_admin, same
-- flag as the rest of the app) can create/edit/delete listings. Click counts
-- are incremented through a SECURITY DEFINER function only — never a direct
-- UPDATE from the client — so a user can bump the click counter without
-- being able to tamper with a listing's rating, affiliate link, etc.
-- ---------------------------------------------------------------------------
create table if not exists public.brokers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  logo_url        text,
  regulation      text,
  license_no      text,
  min_deposit     text,
  spread_from     text,
  leverage        text,
  countries       text[] default '{}',
  rating          numeric check (rating between 0 and 5),
  pros            text[] default '{}',
  cons            text[] default '{}',
  affiliate_link  text not null,
  clicks          integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.brokers enable row level security;
drop policy if exists "brokers_select_authenticated" on public.brokers;
create policy "brokers_select_authenticated" on public.brokers for select using (auth.uid() is not null);
drop policy if exists "brokers_admin_write" on public.brokers;
create policy "brokers_admin_write" on public.brokers
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create or replace function public.increment_broker_click(broker_id uuid)
returns void as $$
begin
  update public.brokers set clicks = clicks + 1 where id = broker_id;
end;
$$ language plpgsql security definer;

create table if not exists public.prop_firms (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  logo_url        text,
  price           text,
  account_sizes   text,
  profit_split    text,
  countries       text[] default '{}',
  rating          numeric check (rating between 0 and 5),
  affiliate_link  text not null,
  clicks          integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.prop_firms enable row level security;
drop policy if exists "prop_firms_select_authenticated" on public.prop_firms;
create policy "prop_firms_select_authenticated" on public.prop_firms for select using (auth.uid() is not null);
drop policy if exists "prop_firms_admin_write" on public.prop_firms;
create policy "prop_firms_admin_write" on public.prop_firms
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create or replace function public.increment_propfirm_click(firm_id uuid)
returns void as $$
begin
  update public.prop_firms set clicks = clicks + 1 where id = firm_id;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- MESSAGING UPDATE — 1:1 direct messages (Discord/Slack-level security:
-- encrypted in transit via TLS and at rest via Supabase's storage
-- encryption, access-controlled by RLS so only the two participants can
-- ever read a conversation — NOT true end-to-end encryption, meaning the
-- database operator could technically still read messages via direct DB
-- access. See chat for why true E2E wasn't the option chosen here.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 13. blocks — checked directly inside the messaging RLS policies below,
--     not just hidden client-side.
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint blocks_no_self check (blocker_id <> blocked_id),
  constraint blocks_unique unique (blocker_id, blocked_id)
);

alter table public.blocks enable row level security;
drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own" on public.blocks for select using (auth.uid() = blocker_id);
drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own" on public.blocks for insert with check (auth.uid() = blocker_id);
drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own" on public.blocks for delete using (auth.uid() = blocker_id);

-- ---------------------------------------------------------------------------
-- 14. reports — user-submitted reports, visible only to admins
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason           text not null,
  details          text,
  status           text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at       timestamptz not null default now()
);

alter table public.reports enable row level security;
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports for insert with check (auth.uid() = reporter_id);
drop policy if exists "reports_select_admin_only" on public.reports;
create policy "reports_select_admin_only" on public.reports
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "reports_update_admin_only" on public.reports;
create policy "reports_update_admin_only" on public.reports
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- ---------------------------------------------------------------------------
-- 15. conversations + messages
--
-- user_a is always the lexicographically smaller uuid — a canonical
-- ordering so there's exactly one conversation row per pair of users,
-- enforced by the unique constraint (otherwise "A messages B" and
-- "B messages A" could each create their own conversation row).
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references auth.users(id) on delete cascade,
  user_b          uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint conversations_no_self check (user_a <> user_b),
  constraint conversations_ordered check (user_a < user_b),
  constraint conversations_unique unique (user_a, user_b)
);

create index if not exists conversations_user_a_idx on public.conversations (user_a);
create index if not exists conversations_user_b_idx on public.conversations (user_b);

alter table public.conversations enable row level security;
drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant" on public.conversations
  for select using (auth.uid() = user_a or auth.uid() = user_b);

-- Starting a conversation is blocked if either side has blocked the other —
-- checked here, not just in the UI, so it can't be bypassed by a direct
-- API call.
-- Helper used by the two policies below. Marked SECURITY DEFINER
-- specifically because the block-check subqueries were previously written
-- inline and silently neutered by RLS on `blocks` itself: blocks_select_own
-- only lets the BLOCKER see their own block row, so when the BLOCKED user
-- (the one trying to send a message) ran the check, they couldn't see the
-- very block meant to stop them — the check always passed. This function
-- runs with the owning role's privileges, bypassing that RLS specifically
-- for this yes/no check. Verified against a real Postgres instance: without
-- this fix, a blocked user could still message the person who blocked them.
create or replace function public.users_have_blocked_each_other(user1 uuid, user2 uuid)
returns boolean as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = user1 and b.blocked_id = user2)
       or (b.blocker_id = user2 and b.blocked_id = user1)
  );
$$ language sql security definer stable;

drop policy if exists "conversations_insert_participant_not_blocked" on public.conversations;
create policy "conversations_insert_participant_not_blocked" on public.conversations
  for insert with check (
    (auth.uid() = user_a or auth.uid() = user_b)
    and not public.users_have_blocked_each_other(user_a, user_b)
  );

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 4000),
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;
drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

-- Sending a message is blocked (at the database level) if either side has
-- blocked the other, even if the conversation row already existed from
-- before the block.
drop policy if exists "messages_insert_participant_not_blocked" on public.messages;
create policy "messages_insert_participant_not_blocked" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
        and not public.users_have_blocked_each_other(c.user_a, c.user_b)
    )
  );

create or replace function public.touch_conversation_last_message()
returns trigger as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_last_message();

-- ============================================================================
-- ADVANCED CHARTS UPDATE — backtesting results
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 16. backtests — saved results from the self-directed backtesting
--     simulator (Backtest tab). total_trades is stored alongside win_rate
--     because a win rate on its own is meaningless without knowing the
--     sample size it came from (100% over 1 trade vs. over 50 is a very
--     different signal) — the founder's spec listed only
--     (user_id, pair, win_rate, profit); this column is an addition, not a
--     replacement, called out here rather than silently added.
-- ---------------------------------------------------------------------------
create table if not exists public.backtests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  pair          text not null,
  win_rate      numeric not null check (win_rate between 0 and 100),
  profit        numeric not null default 0,
  total_trades  integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists backtests_user_id_idx on public.backtests (user_id);

alter table public.backtests enable row level security;
drop policy if exists "backtests_select_own" on public.backtests;
create policy "backtests_select_own" on public.backtests for select using (auth.uid() = user_id);
drop policy if exists "backtests_insert_own" on public.backtests;
create policy "backtests_insert_own" on public.backtests for insert with check (auth.uid() = user_id);
drop policy if exists "backtests_delete_own" on public.backtests;
create policy "backtests_delete_own" on public.backtests for delete using (auth.uid() = user_id);

-- ============================================================================
-- STYLE/UX UPDATE — video sharing in the feed
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 17. posts — add media_type so a post's attachment can be an image OR a
--     short video. image_path now holds either kind of file (kept the
--     original column name rather than renaming it, to avoid a disruptive
--     migration on an existing column — media_type is what the frontend
--     actually checks to decide <img> vs <video>).
-- ---------------------------------------------------------------------------
alter table public.posts add column if not exists media_type text check (media_type in ('image', 'video'));
