// AP Aging — signed URL for a stored invoice PDF. The `invoices` storage bucket
// is private, so the browser can't hit it directly (and FreightIQ has no browser
// Supabase client). GET ?path=<pdf_path> -> { url } (short-lived signed URL);
// add &redirect=1 to 302 straight to the file (so a plain <a href> works).
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder',
);

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET only' }); }
  const path = Array.isArray(req.query.path) ? req.query.path[0] : req.query.path;
  if (!path) return res.status(400).json({ error: 'path required' });
  try {
    const { data, error } = await supabase.storage.from('invoices').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return res.status(404).json({ error: error?.message || 'not found' });
    if (req.query.redirect) return res.redirect(302, data.signedUrl);
    return res.json({ url: data.signedUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
