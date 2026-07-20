// GET /api/ap-balances — aggregate bank balances from the Plaid daily snapshots
// (fdw_cash_snapshot, written by the plaid-sync cron). Powers the live-balance
// display + week-end cash projection on the Cash Flow tab and Budget Calendar.
//
// Returns the latest snapshot (all 9 accounts + aggregate total) plus this
// week's anchor snapshot (Monday if we have it, else the earliest snapshot in
// the week, else the latest before Monday) so the client can project a
// week-end floor = anchorBalance - scheduled outflows from the anchor day on.
//
// Gated by the app password (x-ap-key), same as the other /api/ap-* routes —
// bank balances are sensitive, so this is NOT on the public /api/cash-flow.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
import { getSupabase } from './_qbo-helpers.js';
import { requireApAuth } from './_ap-auth.js';

const num = (v) => Number(v) || 0;
const aggTotal = (accts) => (accts || []).reduce((s, a) => s + num(a.balance), 0);

// account last4 -> display label + group (Ben-confirmed mapping, mirrors ap-bank-flow)
const ACCT = {
  '3028': { label: 'Show Freight Inc', group: 'Operating' },
  '0870': { label: 'Show Freight TN', group: 'Operating' },
  '7173': { label: 'SF Savings', group: 'Savings' },
  '1927': { label: 'Capacity Express', group: 'Operating' },
  '7165': { label: 'CE Savings', group: 'Savings' },
  '6053': { label: 'CE East', group: 'CE East' },
  '4842': { label: 'J&A Management', group: 'Admin' },
  '0703': { label: 'Payroll', group: 'Payroll' },
  '1508': { label: 'DockIt LLC', group: 'Other' },
};

// Monday (UTC) of the week containing d, as YYYY-MM-DD.
function mondayOf(d) {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setUTCDate(d.getUTCDate() + diff);
  return m.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET only' }); }
  if (!requireApAuth(req, res)) return;

  try {
    const sb = getSupabase();

    // latest snapshot (current balances)
    const latestQ = await sb
      .from('fdw_cash_snapshot').select('snapshot_date,accounts')
      .order('snapshot_date', { ascending: false }).limit(1);
    if (latestQ.error) throw latestQ.error;
    const latest = (latestQ.data || [])[0] || null;

    const today = req.query.date ? new Date(req.query.date) : new Date();
    const monday = mondayOf(today);

    // week anchor: earliest snapshot on/after Monday (closest to true week-start we have)
    const wsQ = await sb
      .from('fdw_cash_snapshot').select('snapshot_date,accounts')
      .gte('snapshot_date', monday).order('snapshot_date', { ascending: true }).limit(1);
    if (wsQ.error) throw wsQ.error;
    let weekStart = (wsQ.data || [])[0] || null;

    // fallback: no snapshot yet this week -> latest available before Monday
    if (!weekStart) {
      const preQ = await sb
        .from('fdw_cash_snapshot').select('snapshot_date,accounts')
        .lt('snapshot_date', monday).order('snapshot_date', { ascending: false }).limit(1);
      if (preQ.error) throw preQ.error;
      weekStart = (preQ.data || [])[0] || null;
    }

    // Only trust the real production Chase accounts. Leftover Plaid *sandbox*
    // snapshots (test accounts like "Plaid Checking 0000") must never render as
    // real money — filter to the known last4s. If a snapshot has none, it's
    // stale/sandbox: report real:false so the UI falls back instead of lying.
    const REAL = new Set(Object.keys(ACCT));
    const realAccts = (snap) => (snap?.accounts || []).filter((a) => REAL.has(a.last4));
    const latestReal = realAccts(latest);
    const wsReal = realAccts(weekStart);
    const isReal = latestReal.length > 0;

    const accounts = latestReal.map((a) => {
      const meta = ACCT[a.last4] || {};
      return {
        name: meta.label || a.name || a.last4,
        last4: a.last4 || null,
        balance: num(a.balance),
        available: a.available != null ? num(a.available) : null,
        group: meta.group || 'Other',
      };
    }).sort((x, y) => y.balance - x.balance);

    // Short shared cache so cross-device loads are fast (balances refresh daily
    // via the plaid-sync cron). Same key/data for everyone, so CDN-cacheable.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      monday,
      real: isReal,
      note: isReal ? null : 'no real Chase snapshot yet — latest fdw_cash_snapshot is stale/sandbox',
      currentDate: isReal ? (latest?.snapshot_date || null) : null,
      currentBalance: isReal ? aggTotal(latestReal) : null,
      weekStartDate: isReal && wsReal.length ? (weekStart?.snapshot_date || null) : null,
      weekStartBalance: isReal && wsReal.length ? aggTotal(wsReal) : null,
      weekStartExact: !!(isReal && wsReal.length && weekStart && weekStart.snapshot_date === monday),
      accounts,
      count: accounts.length,
      latestSnapshotDate: latest?.snapshot_date || null, // diagnostic even when stale
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
