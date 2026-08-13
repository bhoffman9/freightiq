import { getSupabase, getValidToken, qboFetch } from './_qbo-helpers.js';

// Revenue by CUSTOMER from QuickBooks.
//
// Why this exists: Alvys is NOT a usable source for customer history. It ages
// out completed loads — as of 2026-08-12 the whole /api/alvys-loads feed held
// only 7 invoiced loads ($8,475) for April–June, with 580 of 812 loads being
// future-dated Queued. Its `topCustomers` is the forward pipeline, not history.
// QBO keeps every invoice, so ranking customers has to come from here.
//
// Query params:
//   ?company=ce_sf_combined (default) | ce_east
//   ?start_date=YYYY-MM-DD  ?end_date=YYYY-MM-DD   (both required by QBO —
//     passing only one is silently ignored and QBO returns a default macro
//     window. Always check `applied` in the response before trusting a figure.)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const company = req.query.company || 'ce_sf_combined';
    const supabase = getSupabase();
    const tokenData = await getValidToken(supabase, company);
    if (!tokenData) return res.status(401).json({ error: 'QuickBooks not connected.', company });

    const today = new Date().toISOString().split('T')[0];
    const startDate = req.query.start_date || `${today.slice(0, 4)}-01-01`;
    const endDate = req.query.end_date || today;

    const report = await qboFetch(
      tokenData,
      `/reports/CustomerSales?start_date=${startDate}&end_date=${endDate}&summarize_column_by=Total&minorversion=73`
    );

    // CustomerSales rows are {ColData:[{value:name,id},{value:amount}]}, with
    // sub-customers nested under Rows and a Summary row per parent. Walk it and
    // keep only leaf ColData rows; skip the grand TOTAL.
    const out = [];
    const walk = (node) => {
      if (!node) return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (typeof node !== 'object') return;
      if (node.ColData && Array.isArray(node.ColData)) {
        const name = node.ColData[0]?.value ?? '';
        const amt = parseFloat(String(node.ColData[1]?.value ?? '').replace(/[$,]/g, ''));
        if (name && name.toUpperCase() !== 'TOTAL' && Number.isFinite(amt)) {
          out.push({ customer: name, revenue: amt, id: node.ColData[0]?.id ?? null });
        }
      }
      Object.values(node).forEach(walk);
    };
    walk(report?.Rows);

    // A parent customer appears both as its own row and inside a Summary; dedupe
    // by name keeping the largest, then sort.
    const best = new Map();
    for (const r of out) {
      const cur = best.get(r.customer);
      if (!cur || Math.abs(r.revenue) > Math.abs(cur.revenue)) best.set(r.customer, r);
    }
    const customers = [...best.values()].sort((a, b) => b.revenue - a.revenue);
    const total = customers.reduce((s, c) => s + c.revenue, 0);

    const h = report?.Header || {};
    res.json({
      company,
      requested: { start_date: startDate, end_date: endDate },
      applied: { startPeriod: h.StartPeriod, endPeriod: h.EndPeriod, dateMacro: h.DateMacro },
      count: customers.length,
      total,
      customers,
    });
  } catch (e) {
    console.error('qbo-customers error:', e);
    res.status(500).json({ error: e.message });
  }
}
