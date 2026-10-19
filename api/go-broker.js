// api/go-broker.js
//
// Server-side click tracking: counts the click via a SECURITY DEFINER
// Postgres function (increment_broker_click), then issues a real HTTP
// redirect to the broker's affiliate link. Doing this server-side (rather
// than just counting a click in the browser before navigating away) means
// the count can't be skipped by an ad blocker or a closed tab.
//
// Usage: /api/go-broker?id=<broker uuid>

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const id = req.query?.id;
  if (!id) { res.status(400).send('Missing id'); return; }

  const { data, error } = await supabase.from('brokers').select('affiliate_link, active').eq('id', id).single();
  if (error || !data || !data.active || !data.affiliate_link) {
    res.status(404).send('Broker not found');
    return;
  }

  try {
    await supabase.rpc('increment_broker_click', { broker_id: id });
  } catch (err) {
    console.error('increment_broker_click failed', err); // non-fatal — still redirect
  }

  res.writeHead(302, { Location: data.affiliate_link });
  res.end();
}
