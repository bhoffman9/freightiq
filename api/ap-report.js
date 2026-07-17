// GET /api/ap-report?asOf=YYYY-MM-DD — A/P as of a date (or today), reconstructed
// from invoice + payment history. Unlike AR (Alvys has no payment dates), we OWN
// the AP data, so historical as-of is exact retroactively: an invoice is an open
// payable as of date D if invoice_date <= D and (amount − payments on/before D) > 0.
// Returns rows + total + aging + by-vendor. Gated by the app password (x-ap-key).
import { getSupabase } from './_qbo-helpers.js';
import { requireApAuth } from './_ap-auth.js';

const VOID = new Set(['void', 'cancelled', 'canceled', 'deleted']);

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET only' }); }
  if (!requireApAuth(req, res)) return;

  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(req.query.asOf || '') ? req.query.asOf : new Date().toISOString().slice(0, 10);

  try {
    const sb = getSupabase();
    const [invRes, payRes] = await Promise.all([
      sb.from('invoices').select('id,vendor_name,invoice_number,invoice_date,due_date,amount,status')
        .is('deleted_at', null).lte('invoice_date', asOf),
      sb.from('payments').select('invoice_id,amount,payment_date').lte('payment_date', asOf),
    ]);
    if (invRes.error) throw new Error(invRes.error.message);
    if (payRes.error) throw new Error(payRes.error.message);

    // paid on/before asOf, per invoice
    const paidBy = {};
    for (const p of payRes.data || []) paidBy[p.invoice_id] = (paidBy[p.invoice_id] || 0) + Number(p.amount || 0);

    const daysBetween = (a, b) => Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
    const rows = [];
    for (const inv of invRes.data || []) {
      if (inv.needs_review === true) continue;
      if (VOID.has(String(inv.status || '').toLowerCase())) continue;
      const amount = Number(inv.amount || 0);
      const paid = +(paidBy[inv.id] || 0).toFixed(2);
      const balance = +(amount - paid).toFixed(2);
      if (balance <= 0.01) continue;
      const overdue = inv.due_date ? Math.max(0, daysBetween(asOf, inv.due_date)) : null;
      rows.push({
        vendor: inv.vendor_name || '', invoiceNumber: inv.invoice_number || '',
        invoiceDate: inv.invoice_date || '', dueDate: inv.due_date || '',
        amount: +amount.toFixed(2), paid, balance, daysOverdue: overdue,
      });
    }
    rows.sort((a, b) => b.balance - a.balance);

    // aging by days past due (as of asOf)
    const aging = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, 'no due date': 0 };
    for (const r of rows) {
      const d = r.daysOverdue;
      if (d == null) aging['no due date'] += r.balance;
      else if (d <= 0) aging.current += r.balance;
      else if (d <= 30) aging['1-30'] += r.balance;
      else if (d <= 60) aging['31-60'] += r.balance;
      else if (d <= 90) aging['61-90'] += r.balance;
      else aging['90+'] += r.balance;
    }
    Object.keys(aging).forEach(k => aging[k] = +aging[k].toFixed(2));

    const vMap = {};
    for (const r of rows) {
      const v = vMap[r.vendor] || (vMap[r.vendor] = { vendor: r.vendor, invoices: 0, balance: 0 });
      v.invoices++; v.balance += r.balance;
    }
    const byVendor = Object.values(vMap).map(v => ({ ...v, balance: +v.balance.toFixed(2) })).sort((a, b) => b.balance - a.balance);

    const total = +rows.reduce((s, r) => s + r.balance, 0).toFixed(2);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ asOf, total, count: rows.length, aging, byVendor, rows, generatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
