// api/create-checkout-session.js
// Creates a Stripe Checkout Session for the $9.99/mo Pro plan and returns
// its id/url. Called by the frontend with the user's Supabase access token
// in the Authorization header (see src/context/AppContext.jsx#startCheckout).
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

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    if (profileErr) throw profileErr;

    // Reuse the existing Stripe customer if we already created one for this
    // user (e.g. they cancelled a previous checkout attempt), otherwise
    // create a fresh one and save it immediately.
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const appUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      success_url: `${appUrl}/app?upgraded=1`,
      cancel_url: `${appUrl}/app?upgrade_cancelled=1`,
      // Belt-and-suspenders: metadata on both the session and the resulting
      // subscription, so the webhook can find the Supabase user either way.
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
    });

    res.status(200).json({ sessionId: checkoutSession.id, url: checkoutSession.url });
  } catch (err) {
    console.error('create-checkout-session error', err);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
