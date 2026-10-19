// api/admin-stats.js
// Aggregate stats for the admin dashboard — total users, Pro users, MRR.
// Gated to accounts with profiles.is_admin = true (set that manually via
// SQL for your own account — see supabase/schema.sql). Uses the service
// role key to read across all users, which is exactly why this must stay
// server-side and admin-gated rather than ever being a client-side query.
import { getSupabaseAdmin, getUserFromRequest } from './_lib/supabaseAdmin.js';

const PRO_PRICE_USD = 9.99;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const user = await getUserFromRequest(req, supabaseAdmin);
    if (!user) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles').select('is_admin').eq('id', user.id).single();
    if (profileErr) throw profileErr;
    if (!profile?.is_admin) {
      res.status(403).json({ error: 'Admin access only' });
      return;
    }

    const [{ count: totalUsers, error: usersErr }, { count: proUsers, error: proErr },
      { count: totalTrades, error: tradesErr }, { count: referralClicks, error: refErr }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true),
      supabaseAdmin.from('trades').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('referral_clicks').select('*', { count: 'exact', head: true }),
    ]);
    if (usersErr) throw usersErr;
    if (proErr) throw proErr;
    if (tradesErr) throw tradesErr;
    if (refErr) throw refErr;

    res.status(200).json({
      totalUsers: totalUsers || 0,
      proUsers: proUsers || 0,
      freeUsers: (totalUsers || 0) - (proUsers || 0),
      mrr: Number(((proUsers || 0) * PRO_PRICE_USD).toFixed(2)),
      totalTrades: totalTrades || 0,
      referralClicks: referralClicks || 0,
    });
  } catch (err) {
    console.error('admin-stats error', err);
    res.status(500).json({ error: err.message || 'Failed to load admin stats' });
  }
}
