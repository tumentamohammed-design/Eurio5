// api/go-propfirm.js — same pattern as api/go-broker.js, for prop firms.
// Usage: /api/go-propfirm?id=<prop firm uuid>

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const id = req.query?.id;
  if (!id) { res.status(400).send('Missing id'); return; }

  const { data, error } = await supabase.from('prop_firms').select('affiliate_link, active').eq('id', id).single();
  if (error || !data || !data.active || !data.affiliate_link) {
    res.status(404).send('Prop firm not found');
    return;
  }

  try {
    await supabase.rpc('increment_propfirm_click', { firm_id: id });
  } catch (err) {
    console.error('increment_propfirm_click failed', err);
  }

  res.writeHead(302, { Location: data.affiliate_link });
  res.end();
}
