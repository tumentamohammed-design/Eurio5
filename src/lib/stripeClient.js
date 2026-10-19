import { loadStripe } from '@stripe/stripe-js';

let stripePromise;
export function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!key) console.error('Missing VITE_STRIPE_PUBLISHABLE_KEY — Stripe Checkout will not work.');
    stripePromise = loadStripe(key || '');
  }
  return stripePromise;
}
