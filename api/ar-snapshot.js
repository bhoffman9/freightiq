// /api/ar-snapshot — daily A/R snapshot writer + as-of reader.
//  - GET (cron, Authorization: Bearer CRON_SECRET) → fetch live AR, upsert today's snapshot
//  - GET ?list=1        → list available snapshot dates (newest first)
//  - GET ?date=YYYY-MM-DD → the snapshot for that date (or nearest earlier)
// The Alvys load API has no payment dates so past AR can't be reconstructed;
// this accumulates history from the day the cron starts.
import { getSupabase } from './_qbo-helpers.js';

const BASE = process.env.PUBLIC_BASE_URL || 'https://freightiq-nine-two.vercel.app';
const isCE = s => /capacity express/i.test(s || '');
const isSF = s => /show freight/i.test(s || '');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const sb = getSupabase();

  try {
    // ---- reads ----
    if (req.query.list) {
      const { data, error } = await sb.from('fdw_ar_snapshot')
        .select('snapshot_date, total_ar, load_count').order('snapshot_date', { ascending: false }).limit(400);
      if (error) throw new Error(error.message);
      return res.status(200).json({ dates: data || [] });
    }
    if (req.query.date) {
      const { data, error } = await sb.from('fdw_ar_snapshot')
        .select('*').lte('snapshot_date', req.query.date).order('snapshot_date', { ascending: false }).limit(1);
      if (error) throw new Error(error.message);
      if (!data || !data.length) return res.status(404).json({ error: 'no snapshot on/before that date', requested: req.query.date });
      return res.status(200).json({ snapshot: data[0], exact: data[0].snapshot_date === req.query.date });
    }

    // ---- cron write ----
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!process.env.CRON_SECRET || bearer !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'unauthorized (cron only); use ?date= or ?list= to read' });
    }
    const ar = await fetch(`${BASE}/api/alvys-ar`).then(r => r.json());
    if (!ar || ar.error) throw new Error('alvys-ar fetch failed: ' + (ar && ar.error));
    const rows = ar.rows || [];
    const sum = f => +rows.filter(f).reduce((s, r) => s + (r.balance || 0), 0).toFixed(2);
    const snapshot_date = new Date().toISOString().slice(0, 10);
    const row = {
      snapshot_date,
      total_ar: ar.totalAR, load_count: ar.count,
      ce_ar: sum(r => isCE(r.invoiceAs)), sf_ar: sum(r => isSF(r.invoiceAs)),
      aging: ar.aging, by_status: ar.byStatus, by_customer: ar.byCustomer, rows,
    };
    const { error } = await sb.from('fdw_ar_snapshot').upsert(row, { onConflict: 'snapshot_date' });
    if (error) throw new Error(error.message);
    return res.status(200).json({ ok: true, snapshot_date, total_ar: ar.totalAR, load_count: ar.count });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
