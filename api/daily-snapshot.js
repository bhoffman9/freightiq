// /api/daily-snapshot — unified point-in-time metrics log (fdw_daily_snapshot).
// ONE row per day: AP / AR / pipeline / cash, so we can always answer "what was
// X as of date D". Scalars drive trends; `payload` holds full detail.
//
//   GET (cron, Authorization: Bearer CRON_SECRET)  → gather all feeds, upsert today
//   GET ?backfill=1  (cron-authed)                 → seed AP history (weekly) from
//                                                     the first invoice to today
//   GET ?list=1                                    → dates + headline scalars
//   GET ?range=N                                   → last N days, full rows
//   GET ?date=YYYY-MM-DD                           → row for date (or nearest earlier)
//
// AP is exact retroactively (we own invoices+payments). AR/pipeline/cash only
// accumulate forward (Alvys/Plaid keep no dated balance history).
import { getSupabase } from './_qbo-helpers.js';

const BASE = process.env.PUBLIC_BASE_URL || 'https://freightiq-nine-two.vercel.app';
const VOID = new Set(['void', 'cancelled', 'canceled', 'deleted']);
// Real production Chase last4s — MUST mirror ACCT in api/ap-balances.js (source of truth).
const REAL = new Set(['3028', '0870', '7173', '1927', '7165', '6053', '4842', '0703', '1508']);
const today = () => new Date().toISOString().slice(0, 10);
const isMissingTable = (msg) => /relation .*fdw_daily_snapshot.* does not exist|could not find the table/i.test(msg || '');

// AP open payables as-of a set of dates, from one invoice+payment fetch.
function apAsOf(invoices, payments, asOf) {
  const paidBy = {};
  for (const p of payments) if (p.payment_date <= asOf) paidBy[p.invoice_id] = (paidBy[p.invoice_id] || 0) + Number(p.amount || 0);
  const daysBetween = (a, b) => Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
  const aging = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, 'no due date': 0 };
  const vMap = {}; let total = 0, count = 0;
  for (const inv of invoices) {
    if (inv.invoice_date > asOf) continue;
    if (inv.needs_review === true) continue;
    if (VOID.has(String(inv.status || '').toLowerCase())) continue;
    const bal = +(Number(inv.amount || 0) - (paidBy[inv.id] || 0)).toFixed(2);
    if (bal <= 0.01) continue;
    total += bal; count++;
    const d = inv.due_date ? Math.max(0, daysBetween(asOf, inv.due_date)) : null;
    if (d == null) aging['no due date'] += bal;
    else if (d <= 0) aging.current += bal;
    else if (d <= 30) aging['1-30'] += bal;
    else if (d <= 60) aging['31-60'] += bal;
    else if (d <= 90) aging['61-90'] += bal;
    else aging['90+'] += bal;
    const v = vMap[inv.vendor_name || ''] || (vMap[inv.vendor_name || ''] = { vendor: inv.vendor_name || '', invoices: 0, balance: 0 });
    v.invoices++; v.balance += bal;
  }
  Object.keys(aging).forEach(k => aging[k] = +aging[k].toFixed(2));
  const past_due = +(aging['1-30'] + aging['31-60'] + aging['61-90'] + aging['90+']).toFixed(2);
  const byVendor = Object.values(vMap).map(v => ({ ...v, balance: +v.balance.toFixed(2) })).sort((a, b) => b.balance - a.balance).slice(0, 25);
  return { total: +total.toFixed(2), count, aging, past_due, byVendor };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const sb = getSupabase();

  try {
    // ---------- reads (public) ----------
    if (req.query.list) {
      const { data, error } = await sb.from('fdw_daily_snapshot')
        .select('snapshot_date, ap_total, ap_past_due, ar_total, ar_past_due, pipeline_total, pipeline_loads, cash_total')
        .order('snapshot_date', { ascending: false }).limit(800);
      if (error) { if (isMissingTable(error.message)) return res.status(503).json({ error: 'table-not-found', migration: 'supabase/migrations/fdw_daily_snapshot.sql' }); throw new Error(error.message); }
      return res.status(200).json({ rows: data || [] });
    }
    if (req.query.range) {
      const n = Math.min(800, Math.max(1, parseInt(req.query.range, 10) || 90));
      const since = new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
      const { data, error } = await sb.from('fdw_daily_snapshot').select('*').gte('snapshot_date', since).order('snapshot_date', { ascending: true });
      if (error) { if (isMissingTable(error.message)) return res.status(503).json({ error: 'table-not-found', migration: 'supabase/migrations/fdw_daily_snapshot.sql' }); throw new Error(error.message); }
      return res.status(200).json({ rows: data || [] });
    }
    if (req.query.date) {
      const { data, error } = await sb.from('fdw_daily_snapshot').select('*').lte('snapshot_date', req.query.date).order('snapshot_date', { ascending: false }).limit(1);
      if (error) { if (isMissingTable(error.message)) return res.status(503).json({ error: 'table-not-found' }); throw new Error(error.message); }
      if (!data || !data.length) return res.status(404).json({ error: 'no snapshot on/before that date', requested: req.query.date });
      return res.status(200).json({ snapshot: data[0], exact: data[0].snapshot_date === req.query.date });
    }

    // ---------- writes (cron only) ----------
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!process.env.CRON_SECRET || bearer !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'unauthorized (cron only); use ?list=/?range=/?date= to read' });
    }

    // Pull invoices+payments once (used by both write and backfill).
    const [invRes, payRes] = await Promise.all([
      sb.from('invoices').select('id,vendor_name,invoice_date,due_date,amount,status,needs_review').is('deleted_at', null),
      sb.from('payments').select('invoice_id,amount,payment_date'),
    ]);
    if (invRes.error) throw new Error('invoices: ' + invRes.error.message);
    if (payRes.error) throw new Error('payments: ' + payRes.error.message);
    const invoices = invRes.data || [], payments = payRes.data || [];

    // ----- backfill: weekly AP points from first invoice → today -----
    if (req.query.backfill) {
      const first = invoices.reduce((m, i) => (i.invoice_date && (!m || i.invoice_date < m) ? i.invoice_date : m), null);
      if (!first) return res.status(200).json({ ok: true, backfilled: 0, note: 'no invoices' });
      const dates = [];
      let d = new Date(first + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); // next Monday
      const end = today();
      while (d.toISOString().slice(0, 10) <= end) { dates.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 7); }
      if (dates[dates.length - 1] !== end) dates.push(end);
      // existing rows so we merge AP without nulling forward-only fields
      const { data: existing, error: exErr } = await sb.from('fdw_daily_snapshot').select('*').in('snapshot_date', dates);
      if (exErr) { if (isMissingTable(exErr.message)) return res.status(503).json({ error: 'table-not-found', migration: 'supabase/migrations/fdw_daily_snapshot.sql' }); throw new Error(exErr.message); }
      const byDate = Object.fromEntries((existing || []).map(r => [r.snapshot_date, r]));
      const upserts = dates.map(dt => {
        const ap = apAsOf(invoices, payments, dt);
        const prev = byDate[dt] || {};
        return {
          ...prev, snapshot_date: dt,
          ap_total: ap.total, ap_past_due: ap.past_due,
          payload: { ...(prev.payload || {}), ap: { aging: ap.aging, byVendor: ap.byVendor, count: ap.count } },
          sources: { ...(prev.sources || {}), ap: true, ap_backfilled: true },
        };
      });
      const { error } = await sb.from('fdw_daily_snapshot').upsert(upserts, { onConflict: 'snapshot_date' });
      if (error) { if (isMissingTable(error.message)) return res.status(503).json({ error: 'table-not-found', migration: 'supabase/migrations/fdw_daily_snapshot.sql' }); throw new Error(error.message); }
      return res.status(200).json({ ok: true, backfilled: upserts.length, from: dates[0], to: end });
    }

    // ----- daily write: AP (inline) + AR + pipeline + cash -----
    const snapshot_date = today();
    const sources = {};
    const ap = apAsOf(invoices, payments, snapshot_date); sources.ap = true;

    let ar = null; try { ar = await fetch(`${BASE}/api/alvys-ar`).then(r => r.json()); if (ar && !ar.error) sources.ar = true; else ar = null; } catch { /* forward-only */ }
    let pipe = null; try { pipe = await fetch(`${BASE}/api/alvys-loads`).then(r => r.json()); if (pipe && !pipe.error) sources.pipeline = true; else pipe = null; } catch { /* */ }
    let cashRow = null; try {
      const { data } = await sb.from('fdw_cash_snapshot').select('snapshot_date,accounts').order('snapshot_date', { ascending: false }).limit(1);
      cashRow = data && data[0]; if (cashRow) sources.cash = true;
    } catch { /* */ }

    const arAging = ar?.aging || {};
    const ar_past_due = +((arAging['15-30'] || 0) + (arAging['31+'] || 0)).toFixed(2);
    const pipeLoads = pipe?.loads || [];
    const pipeline_total = pipe ? +pipeLoads.reduce((s, l) => s + (l.revenue || 0), 0).toFixed(2) : null;
    const realAccts = (cashRow?.accounts || []).filter(a => REAL.has(a.last4));
    const cash_total = realAccts.length ? +realAccts.reduce((s, a) => s + Number(a.balance || 0), 0).toFixed(2) : null;

    const row = {
      snapshot_date,
      ap_total: ap.total, ap_past_due: ap.past_due,
      ar_total: ar ? ar.totalAR : null, ar_past_due: ar ? ar_past_due : null,
      pipeline_total, pipeline_loads: pipe ? pipeLoads.length : null,
      cash_total,
      payload: {
        ap: { aging: ap.aging, byVendor: ap.byVendor, count: ap.count },
        ar: ar ? { aging: ar.aging, byStatus: ar.byStatus, count: ar.count } : null,
        pipeline: pipe ? { byStatus: pipe.byStatus } : null,
        cash: cash_total != null ? { accounts: realAccts.map(a => ({ last4: a.last4, name: a.name, balance: a.balance })) } : null,
      },
      sources,
    };
    const { error } = await sb.from('fdw_daily_snapshot').upsert(row, { onConflict: 'snapshot_date' });
    if (error) { if (isMissingTable(error.message)) return res.status(503).json({ error: 'table-not-found', migration: 'supabase/migrations/fdw_daily_snapshot.sql' }); throw new Error(error.message); }
    return res.status(200).json({ ok: true, snapshot_date, ap_total: ap.total, ar_total: row.ar_total, pipeline_total, cash_total, sources });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
