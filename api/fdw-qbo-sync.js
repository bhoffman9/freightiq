// GET /api/fdw-qbo-sync — pulls QuickBooks P&L (via the existing /api/qbo-pnl,
// which already does the CPM-specific bucket-mapping) and writes it into the
// warehouse: income week/month tables + the fleet cost CATEGORIES that come from
// QBO. Secret-gated (cron pattern). Fully unattended — uses the existing QBO
// OAuth app.
//
// Does NOT touch: LABOR (needs the OTR/office carve-out, not in fiq — stays the
// one-click payroll path) or FUEL_TOT (EFS only). MILES stays Samsara.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, FDW_INGEST_SECRET, [CRON_SECRET]

import crypto from 'node:crypto';

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const SECRET = process.env.FDW_INGEST_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;
const PNL_BASE = 'https://freightiq-nine-two.vercel.app';   // canonical (permanent)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

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
  return bearer && ctEq(bearer, CRON_SECRET);
}

async function sb(path, init = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`sb ${path} ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function pnl(qs) {
  const r = await fetch(`${PNL_BASE}/api/qbo-pnl?company=ce_sf_combined&${qs}`);
  const d = await r.json();
  if (!r.ok || !d.fiq) throw new Error(`qbo-pnl ${qs} ${r.status}: ${d.error || 'no fiq'}`);
  return d;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET only' }); }
  if (!SB || !KEY || !SECRET) return res.status(500).json({ error: 'server not configured' });
  if (!authorized(req)) return res.status(401).json({ error: 'bad secret' });

  try {
    const pe = (await sb('fdw_v_current_period?select=period_end'))[0]?.period_end;
    if (!pe) return res.status(200).json({ ok: false, reason: 'no period loaded' });
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    // 1) YTD categories -> fleet_metrics (NOT labor/fuel/miles)
    const ytd = (await pnl('period=ytd')).fiq;
    await sb(`fdw_fleet_metrics?entity_id=eq.sf&period_end=eq.${pe}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        ins_tot: ytd.ins_tot, truck_tot: ytd.truck_tot, trailer_tot: ytd.trailer_tot,
        truck_maint: ytd.truck_maint, trail_maint: ytd.trail_maint, storage: ytd.storage, uniforms: ytd.uniforms,
      }),
    });

    // 2) last closed week -> income_week
    const wk = await pnl('period=last_week');
    const wf = wk.fiq, wend = wk.period.end_date;
    await sb('fdw_income_week?on_conflict=period_end', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        period_end: wend, ce: wf.revenue_ce, sf: wf.revenue_sf, di: wf.revenue_di,
        revenue: wf.total_revenue, cogs: wf.total_cogs, gross_profit: wf.gross_profit,
        total_exp: wf.total_expenses, net_op_income: wf.net_op_income,
        other_income: round2(wf.net_income - wf.net_op_income), net_income: wf.net_income,
      }),
    });

    // 3) current month-to-date -> income_month (partial)
    const mo = (await pnl(`start_date=${monthStart}&end_date=${today}`)).fiq;
    const mkey = today.slice(0, 7);
    const label = `${MONTHS[Number(mkey.slice(5, 7)) - 1]} ${mkey.slice(2, 4)}`;
    await sb('fdw_income_month?on_conflict=month_key', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        month_key: mkey, label, is_partial: true,
        ce: mo.revenue_ce, sf: mo.revenue_sf, di: mo.revenue_di,
        revenue: mo.total_revenue, gross_profit: mo.gross_profit, net_income: mo.net_income,
      }),
    });

    return res.status(200).json({
      ok: true, period_end: pe,
      categories: { ins_tot: ytd.ins_tot, truck_tot: ytd.truck_tot, trailer_tot: ytd.trailer_tot,
                    truck_maint: ytd.truck_maint, trail_maint: ytd.trail_maint, storage: ytd.storage, uniforms: ytd.uniforms },
      income_week: { period_end: wend, revenue: wf.total_revenue },
      income_month: { month_key: mkey, revenue: mo.total_revenue, partial: true },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
