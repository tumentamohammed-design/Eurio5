import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getStripe } from '../lib/stripeClient';
import { doualaNowParts } from '../lib/timezone';

const AppContext = createContext(null);
export const FREE_MONTHLY_TRADE_LIMIT = 30;

export function AppProvider({ children }) {
  /* ---------------------------- auth ---------------------------- */
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const user = session?.user || null;

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  /* ---------------------------- profile (billing + admin status) ---------------------------- */
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const loadProfile = useCallback(async () => {
    if (!user) { setProfile(null); return; }
    setProfileLoading(true);
    setProfileError(null);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (error) {
      console.error('loadProfile error', error);
      setProfileError(error.message);
    }
    setProfile(data || null);
    setProfileLoading(false);
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  /* ---------------------------- trades ---------------------------- */
  const [trades, setTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesError, setTradesError] = useState(null);

  const loadTrades = useCallback(async () => {
    if (!user) { setTrades([]); return; }
    setTradesLoading(true);
    setTradesError(null);
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (error) {
      console.error('loadTrades error', error);
      setTradesError(error.message);
    }
    setTrades(data || []);
    setTradesLoading(false);
  }, [user]);

  useEffect(() => { loadTrades(); }, [loadTrades]);

  const monthlyTradeCount = useMemo(() => {
    // Bucketed by Africa/Douala's current month, matching the app's default
    // timezone everywhere else. The actual security boundary is the RLS
    // policy in schema.sql (bucketed by each trade's own date, not "now"),
    // so this is a display approximation, not the enforcement itself.
    const key = doualaNowParts().dateStr.slice(0, 7); // "YYYY-MM"
    return trades.filter((t) => typeof t.date === 'string' && t.date.startsWith(key)).length;
  }, [trades]);

  const isPro = !!profile?.is_pro;
  const isAdmin = !!profile?.is_admin;
  const atFreeLimit = !isPro && monthlyTradeCount >= FREE_MONTHLY_TRADE_LIMIT;

  const uploadScreenshot = useCallback(async (tradeId, blob) => {
    const path = `${user.id}/${tradeId}.jpg`;
    const { error } = await supabase.storage.from('screenshots').upload(path, blob, {
      upsert: true,
      contentType: 'image/jpeg',
    });
    if (error) throw error;
    return path;
  }, [user]);

  const getScreenshotUrl = useCallback((path) => {
    if (!path) return null;
    const { data } = supabase.storage.from('screenshots').getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const saveTrade = useCallback(async (trade, screenshotBlob, removeScreenshot) => {
    const isEdit = !!trade.id;

    // Belt-and-suspenders: the real enforcement is the Postgres RLS policy
    // (trades_insert_own_under_quota in schema.sql), which blocks this even
    // if someone bypasses the UI entirely. This check just gives a fast,
    // friendly error instead of a raw Postgres error message.
    if (!isEdit && atFreeLimit) {
      throw new Error('FREE_LIMIT_REACHED');
    }

    const payload = { ...trade, user_id: user.id };
    delete payload.id;

    let row;
    if (isEdit) {
      const { data, error } = await supabase.from('trades').update(payload).eq('id', trade.id).select().single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await supabase.from('trades').insert(payload).select().single();
      if (error) {
        if (error.message?.includes('row-level security') || error.code === '42501') {
          throw new Error('FREE_LIMIT_REACHED');
        }
        throw error;
      }
      row = data;
    }

    if (removeScreenshot && row.screenshot_path) {
      await supabase.storage.from('screenshots').remove([row.screenshot_path]);
      const { data } = await supabase.from('trades').update({ screenshot_path: null }).eq('id', row.id).select().single();
      row = data;
    } else if (screenshotBlob) {
      const path = await uploadScreenshot(row.id, screenshotBlob);
      const { data } = await supabase.from('trades').update({ screenshot_path: path }).eq('id', row.id).select().single();
      row = data;
    }

    // Immutable discipline audit trail — one row per save, never edited.
    try {
      await supabase.from('discipline_logs').insert({
        user_id: user.id,
        trade_id: row.id,
        followed_routine: trade.followed_routine,
        rule_violations: trade.rule_violations || [],
      });
    } catch (err) {
      console.error('discipline_logs insert failed (non-fatal)', err);
    }

    await loadTrades();
    return row;
  }, [user, uploadScreenshot, loadTrades, atFreeLimit]);

  const deleteTrade = useCallback(async (id, screenshotPath) => {
    await supabase.from('trades').delete().eq('id', id);
    if (screenshotPath) {
      await supabase.storage.from('screenshots').remove([screenshotPath]);
    }
    await loadTrades();
  }, [loadTrades]);

  /* ---------------------------- rules ---------------------------- */
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState(null);

  const loadRules = useCallback(async () => {
    if (!user) { setRules([]); return; }
    setRulesLoading(true);
    setRulesError(null);
    const { data, error } = await supabase
      .from('rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('loadRules error', error);
      setRulesError(error.message);
    }
    setRules(data || []);
    setRulesLoading(false);
  }, [user]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const addRule = useCallback(async (rule) => {
    const { error } = await supabase.from('rules').insert({ ...rule, user_id: user.id });
    if (error) throw error;
    await loadRules();
  }, [user, loadRules]);

  const updateRule = useCallback(async (id, patch) => {
    const { error } = await supabase.from('rules').update(patch).eq('id', id);
    if (error) throw error;
    await loadRules();
  }, [loadRules]);

  const deleteRule = useCallback(async (id) => {
    const { error } = await supabase.from('rules').delete().eq('id', id);
    if (error) throw error;
    await loadRules();
  }, [loadRules]);

  /* ---------------------------- fx calendar ---------------------------- */
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState(null);

  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const res = await fetch('/api/calendar');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Calendar request failed (${res.status})`);
      setCalendarEvents(data);
    } catch (err) {
      console.error('loadCalendar error', err);
      setCalendarError(err.message || 'Failed to load calendar');
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendar();
    const t = setInterval(loadCalendar, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [loadCalendar]);

  /* ---------------------------- billing (Stripe) ---------------------------- */
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState(null);

  async function authedFetch(url) {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession) throw new Error('You need to be signed in.');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    return data;
  }

  const startCheckout = useCallback(async () => {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const data = await authedFetch('/api/create-checkout-session');
      const stripe = await getStripe();
      const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (error) throw error;
    } catch (err) {
      setBillingError(err.message || 'Could not start checkout');
    } finally {
      setBillingBusy(false);
    }
  }, []);

  const openBillingPortal = useCallback(async () => {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const data = await authedFetch('/api/create-portal-session');
      window.location.href = data.url;
    } catch (err) {
      setBillingError(err.message || 'Could not open billing portal');
      setBillingBusy(false);
    }
  }, []);

  /* ---------------------------- referral tracking ---------------------------- */
  const trackReferralClick = useCallback(async () => {
    try {
      await supabase.from('referral_clicks').insert({ user_id: user?.id || null });
    } catch (err) {
      console.error('referral click tracking failed (non-fatal)', err);
    }
  }, [user]);

  const value = useMemo(() => ({
    session, user, authLoading, signIn, signUp, signOut,
    profile, profileLoading, profileError, loadProfile, isPro, isAdmin,
    trades, tradesLoading, tradesError, saveTrade, deleteTrade, getScreenshotUrl, loadTrades,
    monthlyTradeCount, atFreeLimit,
    rules, rulesLoading, rulesError, addRule, updateRule, deleteRule, loadRules,
    calendarEvents, calendarLoading, calendarError, loadCalendar,
    billingBusy, billingError, startCheckout, openBillingPortal,
    trackReferralClick,
  }), [
    session, user, authLoading, signIn, signUp, signOut,
    profile, profileLoading, profileError, loadProfile, isPro, isAdmin,
    trades, tradesLoading, tradesError, saveTrade, deleteTrade, getScreenshotUrl, loadTrades,
    monthlyTradeCount, atFreeLimit,
    rules, rulesLoading, rulesError, addRule, updateRule, deleteRule, loadRules,
    calendarEvents, calendarLoading, calendarError, loadCalendar,
    billingBusy, billingError, startCheckout, openBillingPortal,
    trackReferralClick,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
