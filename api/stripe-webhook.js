// api/stripe-webhook.js
//
// Vercel's Node runtime auto-parses req.body "for convenience" based on
// Content-Type — but Stripe computes its signature over the exact raw bytes
// of the request body, so if anything parses/re-serializes the body before
// we verify it, the signature check fails. We read the raw stream ourselves
// before touching anything else. Reference:
// https://vercel.com/kb/guide/how-do-i-get-the-raw-body-of-a-serverless-function
//
// This is a plain Vercel Serverless Function (not Next.js), so the
// `export const config = { api: { bodyParser: false } }` convention you'll
// see in Next.js tutorials does NOT apply here — don't add it, it's a no-op
// in this setup and reading the stream directly (below) is the correct fix.
import Stripe from 'stripe';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('Method not allowed');
    return;
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Common causes if you land here: STRIPE_WEBHOOK_SECRET is the test-mode
    // secret while Stripe is sending live-mode events (or vice versa), or
    // the endpoint URL registered in the Stripe dashboard is stale.
    console.error('Stripe webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        if (userId) {
          await supabaseAdmin.from('profiles').update({
            is_pro: true,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          }).eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const isActive = ['active', 'trialing'].includes(sub.status);
        await supabaseAdmin.from('profiles')
          .update({ is_pro: isActive, stripe_subscription_id: sub.id })
          .eq('stripe_customer_id', sub.customer);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabaseAdmin.from('profiles')
          .update({ is_pro: false })
          .eq('stripe_customer_id', sub.customer);
        break;
      }

      default:
        // Unhandled event types are fine to ignore — Stripe sends many
        // more events than we act on.
        break;
    }

    // Acknowledge fast. Stripe retries on anything other than a 2xx.
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook handler error (signature was valid, our processing failed):', err);
    // Return 500 so Stripe retries — a transient DB error here is worse to
    // silently swallow than to get a duplicate retry, since it directly
    // controls whether the user's is_pro flag gets set correctly.
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
