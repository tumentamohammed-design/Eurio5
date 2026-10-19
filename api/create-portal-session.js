// api/create-portal-session.js
// Opens the Stripe-hosted billing portal so a Pro user can update their
// card or cancel — without you having to build any billing UI yourself.
import Stripe from 'stripe';
import { getSupabaseAdmin, getUserFromRequest } from './_lib/supabaseAdmin.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const { data: profile, error } = await supabaseAdmin
      .from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    if (error) throw error;
    if (!profile?.stripe_customer_id) {
      res.status(400).json({ error: 'No billing account yet — upgrade to Pro first.' });
      return;
    }

    const appUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/app`,
    });

    res.status(200).json({ url: portalSession.url });
  } catch (err) {
    console.error('create-portal-session error', err);
    res.status(500).json({ error: err.message || 'Failed to open billing portal' });
  }
}
