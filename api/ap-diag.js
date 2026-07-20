// TEMPORARY diagnostic — inspect w_* budget-calendar tables to investigate the
// "office checks deleted" report. Gated (x-ap-key). Remove after use.
import { getSupabase } from './_qbo-helpers.js';
import { requireApAuth } from './_ap-auth.js';

const NEW_UNITS = [
  ...['685','674','669','686','673','675','488'].map((f) => ({ fleet_number: f, vendor: 'Idealease', vendor_unit: f, category: 'truck', type: 'Tractor', monthly_cost: 3500, mileage_rate: 0.08, status: 'Active', make: 'International', model: '', year: '' })),
  { fleet_number: '869', vendor: 'Ryder', vendor_unit: '438869', category: 'truck', type: 'Sleeper', monthly_cost: 2500, mileage_rate: 0, status: 'Active', make: 'Freightliner', model: '', year: '' },
  { fleet_number: '870', vendor: 'Ryder', vendor_unit: '438870', category: 'truck', type: 'Sleeper', monthly_cost: 2500, mileage_rate: 0, status: 'Active', make: 'Freightliner', model: '', year: '' },
];

export default async function handler(req, res) {
  if (!requireApAuth(req, res)) return;
  try {
    const sb = getSupabase();

    // POST → add the missing Idealease + Ryder roster units (idempotent).
    if (req.method === 'POST') {
      const { data: existing } = await sb.from('equipment').select('vendor,vendor_unit').in('vendor', ['Idealease', 'Ryder']);
      const have = new Set((existing || []).map((e) => `${e.vendor}|${e.vendor_unit}`));
      const toAdd = NEW_UNITS.filter((u) => !have.has(`${u.vendor}|${u.vendor_unit}`));
      if (!toAdd.length) return res.json({ ok: true, added: 0, note: 'all present' });
      const { data, error } = await sb.from('equipment').insert(toAdd).select('id,fleet_number,vendor,vendor_unit');
      if (error) throw new Error(error.message);
      return res.json({ ok: true, added: data.length, rows: data });
    }
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
