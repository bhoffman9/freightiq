// GET /api/ap-bank-flow — live bank cash-flow for the Cash Flow tab, built from
// the Plaid Chase feed (fdw_bank_feed_txn) via the fdw_v_bank_* views.
// Returns weekly inflow/outflow, per-account totals (labeled by entity), and
// detected recurring-bill candidates (same payee+amount on a cadence) that
// aren't already in the Budget Calendar's w_custom_recurring.
//
// Plaid sign convention (already normalized in the views): inflow = money in,
// outflow = money out, net = inflow - outflow.
//
// Gated by the app password (x-ap-key), same as the other /api/ap-* routes.
import { getSupabase } from './_qbo-helpers.js';
import { requireApAuth } from './_ap-auth.js';

// account last4 -> display label + entity (Ben-confirmed mapping)
const ACCT = {
  '3028': { label: 'Show Freight Inc', entity: 'SF' },
  '0870': { label: 'Show Freight TN', entity: 'SF' },
  '7173': { label: 'SF Savings', entity: 'SF' },
  '1927': { label: 'Capacity Express', entity: 'CE' },
  '7165': { label: 'CE Savings', entity: 'CE' },
  '6053': { label: 'CE East', entity: 'CE East' },
  '4842': { label: 'J&A Management', entity: 'J&A' },
  '0703': { label: 'Payroll', entity: 'Payroll' },
  '1508': { label: 'DockIt LLC', entity: 'DockIt' },
};

function cadence(gap) {
  if (gap == null || !isFinite(gap)) return 'irregular';
  if (gap <= 9) return 'weekly';
  if (gap <= 18) return 'biweekly';
  if (gap <= 45) return 'monthly';
  return 'irregular';
}

// rough monthly run-rate from amount + avg gap between hits
function monthlyEst(amount, gap) {
  if (!gap || gap <= 0) return amount;
  return Math.round(amount * (30 / gap) * 100) / 100;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// entity -> default Budget Calendar account label (best-effort; user edits in the calendar)
const ACCT_BUDGET = { SF: 'AUTO SF', CE: 'AUTO CE', 'CE East': 'CE EAST', 'J&A': 'AUTO J&A', DockIt: 'CE', Payroll: 'SF', Other: 'SF' };

// Title-case a normalized merchant string for a clean calendar name.
function titleCase(s) {
  return String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET only' }); }
  if (!requireApAuth(req, res)) return;

  try {
    const sb = getSupabase();
    const [wk, acc, rec, known] = await Promise.all([
      sb.from('fdw_v_bank_weekly').select('*').order('week_start', { ascending: true }),
      sb.from('fdw_v_bank_account').select('*'),
      sb.from('fdw_v_bank_recurring').select('*'),
      sb.from('w_custom_recurring').select('id,name,amount,account,recur_type,recur_day'),
    ]);
    for (const r of [wk, acc, rec, known]) if (r.error) throw new Error(r.error.message);

    const num = (v) => Number(v) || 0;

    const weekly = (wk.data || []).map((w) => ({
      weekStart: w.week_start,
      inflow: num(w.inflow), outflow: num(w.outflow), net: num(w.net), txns: w.txns,
    }));

    const accounts = (acc.data || [])
      .map((a) => {
        const meta = ACCT[a.account_last4] || { label: a.account_name || a.account_last4, entity: 'Other' };
        return {
          last4: a.account_last4, label: meta.label, entity: meta.entity,
          inflow: num(a.inflow), outflow: num(a.outflow), net: num(a.net),
          txns: a.txns, lastTxn: a.last_txn,
        };
      })
      .sort((x, y) => y.txns - x.txns);

    const totals = weekly.reduce(
      (t, w) => ({ inflow: t.inflow + w.inflow, outflow: t.outflow + w.outflow, net: t.net + w.net }),
      { inflow: 0, outflow: 0, net: 0 },
    );
    totals.weeks = weekly.length;

    // Budget Calendar recurring rows (to flag already-tracked + detect amount drift)
    const knownRows = (known.data || []).map((k) => ({ ...k, _n: norm(k.name), _amt: num(k.amount) }));

    // account options for the "Add to calendar" dropdown = existing calendar
    // accounts ∪ a base set (so the list is always usable even if the table is thin)
    const BASE_ACCTS = ['SF', 'CE', 'CE EAST', 'J&A', 'AUTO SF', 'AUTO CE', 'AUTO CE EAST', 'AUTO J&A', 'ZELLE SF'];
    const recurAccounts = [...new Set([...(known.data || []).map((k) => k.account).filter(Boolean), ...BASE_ACCTS])].sort();

    const recurring = (rec.data || [])
      .map((r) => {
        const gap = r.n > 1 ? Math.round(Number(r.span_days) / (r.n - 1)) : null;
        const cad = cadence(gap);
        const merchant = String(r.merchant || '').trim();
        const mnorm = norm(merchant);
        const cat = r.category || '';
        const kind =
          /PAYROLL/i.test(merchant) ? 'payroll' :
          /\bWIRE\b|DOMESTIC WIRE|WIRE TRANS|ONLINE TRANSFER/i.test(merchant) ? 'transfer' :
          cat === 'LOAN_PAYMENTS' ? 'loan' :
          /^(ONLINE ACH PAYMENT|ONLINE REALTIME VENDOR|ONLINE REALTIME PAYROLL|ONLINE PAYMENT|BASIC ONLINE)\b/i.test(merchant) ? 'generic' :
          'bill';
        const amount = num(r.amount);

        // match to a Budget Calendar recurring row (loose name containment)
        const match = knownRows.find((k) =>
          k._n.length >= 4 && (mnorm.includes(k._n) || (k._n.length >= 5 && k._n.includes(mnorm))));

        // fields for a one-click "add to Budget Calendar"
        const recurType = (cad === 'weekly' || cad === 'biweekly') ? 'weekly-day' : 'monthly-date';
        const recurDay = recurType === 'weekly-day' ? (Number(r.dow) || 1) : (Number(r.dom) || 1);
        const entity = (ACCT[r.acct_last4] || {}).entity || 'Other';

        return {
          merchant, amount, count: r.n, gapDays: gap, cadence: cad,
          monthlyEst: monthlyEst(amount, gap), firstSeen: r.first_seen, lastSeen: r.last_seen,
          acctLast4: r.acct_last4, acctLabel: (ACCT[r.acct_last4] || {}).label || r.acct_name,
          category: cat, kind, known: !!match,
          // add-to-calendar payload
          suggestName: titleCase(merchant), suggestAccount: ACCT_BUDGET[entity] || 'SF',
          recurType, recurDay,
          // drift vs the matched calendar row (null if not tracked)
          calId: match ? match.id : null,
          calAmount: match ? match._amt : null,
          calName: match ? match.name : null,
          drift: match ? Math.round((amount - match._amt) * 100) / 100 : null,
        };
      })
      .sort((a, b) => b.monthlyEst - a.monthlyEst);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ weekly, accounts, totals, recurring, recurAccounts, generatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
