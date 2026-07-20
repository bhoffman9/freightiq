// TEMPORARY diagnostic — inspect w_* budget-calendar tables to investigate the
// "office checks deleted" report. Gated (x-ap-key). Remove after use.
import { getSupabase } from './_qbo-helpers.js';
import { requireApAuth } from './_ap-auth.js';

export default async function handler(req, res) {
  if (!requireApAuth(req, res)) return;
  try {
    const sb = getSupabase();
    const [ot, ci, di, cr] = await Promise.all([
      sb.from('w_one_time_expenses').select('name,month,year,amount'),
      sb.from('w_checked_items').select('item_key,month,year'),
      sb.from('w_deleted_items').select('*'),
      sb.from('w_custom_recurring').select('name,amount,account'),
    ]);
    for (const r of [ot, ci, di, cr]) if (r.error) throw new Error(r.error.message);

    const byMo = (rows) => {
      const m = {};
      for (const r of rows) { const k = `${r.year}-${String((r.month ?? -1) + 1).padStart(2, '0')}`; m[k] = (m[k] || 0) + 1; }
      return m;
    };
    const isOffice = (s) => /payroll|office|check|transfer/i.test(s || '');
    const officeOT = (ot.data || []).filter((o) => isOffice(o.name))
      .map((o) => ({ y: o.year, m: o.month, name: o.name, amt: o.amount }))
      .sort((a, b) => (a.y - b.y) || (a.m - b.m));
    const delOffice = (di.data || []).filter((d) => isOffice(d.item_key));

    // Idealease/Ryder invoice amounts (to set roster monthly_cost accurately)
    const [inv] = await Promise.all([
      sb.from('invoices').select('vendor_name,amount,invoice_date,description').is('deleted_at', null)
        .or('vendor_name.ilike.*idealease*,vendor_name.ilike.*ryder*'),
    ]);
    const irStats = {};
    for (const i of (inv.data || [])) {
      const v = /ideal/i.test(i.vendor_name) ? 'Idealease' : 'Ryder';
      const s = irStats[v] || (irStats[v] = { count: 0, total: 0, recent: 0, recentTotal: 0, sample: [] });
      const amt = parseFloat(i.amount) || 0;
      s.count++; s.total += amt;
      if ((i.invoice_date || '') >= '2026-06') { s.recent++; s.recentTotal += amt; }
      if (s.sample.length < 4) s.sample.push({ d: i.invoice_date, amt, desc: (i.description || '').slice(0, 50) });
    }

    return res.json({
      idealeaseRyder: irStats,
      oneTime: { total: (ot.data || []).length, byMonth: byMo(ot.data || []), officeCount: officeOT.length, officeSample: officeOT.slice(0, 40) },
      checked: { total: (ci.data || []).length, byMonth: byMo(ci.data || []) },
      deleted: { total: (di.data || []).length, sampleKeys: (di.data || []).slice(0, 10), officeDeletedCount: delOffice.length, officeDeletedSample: delOffice.slice(0, 40), columns: di.data && di.data[0] ? Object.keys(di.data[0]) : [] },
      customRecurring: { total: (cr.data || []).length, office: (cr.data || []).filter((c) => isOffice(c.name)) },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
