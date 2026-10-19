// Shared helper for /api routes. Files under an underscore-prefixed folder
// are not turned into routes by Vercel, so this stays a plain module.
import { createClient } from '@supabase/supabase-js';

// A Supabase client authenticated as the service role — bypasses Row Level
// Security entirely. Only ever use this after you've verified who's asking
// (see getUserFromRequest below) or inside the Stripe webhook (which is
// itself verified via its signature). NEVER send this client's key to the
// browser.
export function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server environment.');
  }
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Verifies the "Authorization: Bearer <access_token>" header against
// Supabase Auth and returns the authenticated user, or null.
export async function getUserFromRequest(req, supabaseAdmin) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}
