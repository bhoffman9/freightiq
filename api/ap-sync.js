// AP Aging — auto-ingest Gmail-parsed equipment invoices into the AP `invoices`
// table. Reads fdw_equipment_invoice (populated by the Gmail pipeline +
// fdw-extract), maps each vendor to the canonical AP vendor_name spelling, and
// upserts into `invoices` deduped on (vendor_name, invoice_number) — so invoices
// you already entered manually are skipped, only genuinely new ones land.
// Secret-gated (same as the fdw crons): ?secret= / X-FDW-Secret / Bearer CRON_SECRET.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, FDW_INGEST_SECRET, [CRON_SECRET].
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder',
);
const SECRET = process.env.FDW_INGEST_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;

// fdw source -> the EXACT vendor_name spelling used in the AP `invoices` table
// (so dedup on (vendor_name, invoice_number) actually matches existing rows).
const VENDOR_MAP = {
  truck_penske:     'PENSKE TRUCK LEASING',
  truck_ryder:      'Ryder',
  truck_tci:        'Transportation Commodities Inc',
  truck_idealease:  'IDEALEASE OF ATLANTA',
  truck_tec:        'TEC Equipment Leasing',
  trailer_mckinney: 'Mckinney Trailers',
  trailer_utility:  'Utility Trailer',
  trailer_ten:      'TEN Trailer Leasing',
  trailer_premier:  'Premier Trailer Leasing',
  trailer_xtra:     'XTRA Lease LLC',
};

function ctEq(v, s) {
  if (typeof v !== 'string' || typeof s !== 'string' || !s) return false;
  const a = Buffer.from(v), b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function authorized(req) {
  const q = req.query && req.query.secret;
  const qv = Array.isArray(q) ? q[0] : q;
  if (ctEq(qv, SECRET)) return true;
  if (ctEq(req.headers['x-fdw-secret'], SECRET)) return true;
  const bearer = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  return !!(bearer && ctEq(bearer, CRON_SECRET));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET only' }); }
  if (!authorized(req)) return res.status(401).json({ error: 'bad secret' });

  try {
    const { data: rows, error } = await supabase
      .from('fdw_equipment_invoice')
      .select('source, vendor, invoice_no, invoice_date, due_date, amount, unit_ids, category, confidence');
    if (error) throw error;

    // Existing (vendor_name, invoice_number) pairs — dedup client-side so we can
    // report inserted vs skipped (the unique index also protects us).
    const { data: existing } = await supabase.from('invoices').select('vendor_name, invoice_number');
    const seen = new Set((existing || []).map((r) => `${r.vendor_name}|${r.invoice_number}`));

    const toInsert = [];
    let skipped = 0, unmapped = 0;
    for (const r of rows || []) {
      if (!r.invoice_no || r.amount == null) { skipped++; continue; }
      const vendorName = VENDOR_MAP[r.source];
      if (!vendorName) { unmapped++; continue; }               // source we don't map yet
      const key = `${vendorName}|${r.invoice_no}`;
      if (seen.has(key)) { skipped++; continue; }              // already in AP
      seen.add(key);
      const desc = `[auto] ${r.unit_ids ? 'Units ' + r.unit_ids : (r.category || 'equipment')} · Gmail-parsed (${r.confidence || 'med'} confidence)`;
      toInsert.push({
        vendor_name: vendorName,
        invoice_number: String(r.invoice_no),
        invoice_date: r.invoice_date || null,
        due_date: r.due_date || null,
        amount: Number(r.amount) || 0,
        terms: '',
        description: desc.slice(0, 500),
        status: 'open',
        pdf_path: '',
      });
    }

    let inserted = 0;
    if (toInsert.length) {
      // ignore-duplicates in case a manual entry raced in since the SELECT
      const { data, error: insErr } = await supabase
        .from('invoices')
        .upsert(toInsert, { onConflict: 'vendor_name,invoice_number', ignoreDuplicates: true })
        .select('id');
      if (insErr) throw insErr;
      inserted = data ? data.length : 0;
    }

    return res.json({ scanned: (rows || []).length, inserted, skipped_existing: skipped, unmapped_source: unmapped, newInvoices: toInsert.map((t) => `${t.vendor_name} ${t.invoice_number} $${t.amount}`) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
