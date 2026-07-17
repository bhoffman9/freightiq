// POST /api/fdw-heartbeat — the Gmail collector pings this at the end of every
// run (even when it sends 0), giving us a liveness signal independent of whether
// any invoices actually arrived. Gated by the same FDW_INGEST_SECRET.
import { getSupabase } from './_qbo-helpers.js';

const SECRET = process.env.FDW_INGEST_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  const got = req.headers['x-fdw-secret'] || (req.query && req.query.secret);
  if (!SECRET || got !== SECRET) return res.status(401).json({ error: 'bad secret' });
  try {
    const b = req.body || {};
    const now = new Date().toISOString();
    const sb = getSupabase();
    const { error } = await sb.from('fdw_health').upsert(
      { id: 1, last_seen: now, last_sent: Number(b.sent) || 0, last_fails: Number(b.fails) || 0, updated_at: now },
      { onConflict: 'id' });
    if (error) throw new Error(error.message);
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
}
