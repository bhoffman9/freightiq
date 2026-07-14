// AP Aging — suggested payments from the Plaid bank feed. Matches outflow
// transactions in fdw_bank_feed_txn to OPEN/PARTIAL invoices by (vendor name in
// the bank description) + (amount ~= invoice balance), so the AP tab can offer
// one-click "record this payment" with a human confirm. Read-only (GET); the
// actual payment is recorded via /api/ap-payments after the user confirms.
// Returns [] until production Plaid is connected (fdw_bank_feed_txn empty).
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
import { createClient } from '@supabase/supabase-js';
import { requireApAuth } from './_ap-auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder',
);

const LOOKBACK_DAYS = 45;
const norm = (s) => (s || '').toLowerCase().replace(/\b(inc|llc|ltd|co|corp|the|of|truck|trailer|leasing|lease|rental|rentals|services|equipment)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// does the bank description reference this vendor? (a distinctive vendor token appears in the desc)
function vendorMatches(vendorName, desc) {
  const vTokens = norm(vendorName).split(' ').filter((t) => t.length >= 4);
  const d = norm(desc);
  return vTokens.some((t) => d.includes(t));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET only' }); }
  if (!requireApAuth(req, res)) return;
  try {
    const { data: invoices, error: iErr } = await supabase
      .from('invoices').select('id, vendor_name, invoice_number, amount, amount_paid, status')
      .in('status', ['open', 'partial']);
    if (iErr) throw iErr;

    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
    const { data: txns, error: tErr } = await supabase
      .from('fdw_bank_feed_txn')
      .select('id, posted_date, amount, raw_desc, account_name, institution, pending')
      .gte('posted_date', since);
    if (tErr) throw tErr;

    // outflows only (Plaid: positive amount = money leaving a depository account), not pending, not already suggested-consumed
    const outflows = (txns || []).filter((t) => Number(t.amount) > 0 && !t.pending);

    const suggestions = [];
    const usedTxn = new Set();
    // oldest invoices first (pay down oldest); exact-amount matches win
    const open = (invoices || [])
      .map((i) => ({ ...i, balance: Math.round((Number(i.amount) - Number(i.amount_paid)) * 100) / 100 }))
      .filter((i) => i.balance > 0.05);

    for (const inv of open) {
      let best = null;
      for (const t of outflows) {
        if (usedTxn.has(t.id)) continue;
        if (!vendorMatches(inv.vendor_name, t.raw_desc)) continue;
        const diff = Math.abs(Number(t.amount) - inv.balance);
        const tol = Math.max(1, inv.balance * 0.01);
        if (diff > tol) continue;
        const score = diff; // smaller is better (exact = 0)
        if (!best || score < best.score) best = { t, score, diff };
      }
      if (best) {
        usedTxn.add(best.t.id);
        suggestions.push({
          invoiceId: inv.id, invoiceNumber: inv.invoice_number, vendorName: inv.vendor_name,
          balance: inv.balance,
          txnId: best.t.id, txnDate: best.t.posted_date, txnAmount: Number(best.t.amount),
          txnDesc: best.t.raw_desc, account: best.t.account_name || best.t.institution || '',
          confidence: best.diff < 0.01 ? 'high' : 'medium',
        });
      }
    }

    return res.json({ count: suggestions.length, suggestions });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
