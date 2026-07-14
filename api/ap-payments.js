// AP Aging — payments, ported from ap-aging/src/app/api/payments/route.js.
// Vercel serverless (single handler, branch on req.method). Shared Supabase project.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
//   GET ?invoiceId=UUID   → payment history for one invoice
//   GET ?all=1            → all payments + joined invoice context (remittance grouping)
//   GET ?recent=N         → N most-recent payments + joined invoice context
//   POST { invoiceId, amount, paymentDate, paymentMethod, note }
//                         → record payment; auto-updates amount_paid + status (±$0.05)
//   DELETE ?id=UUID       → undo a payment; reverts amount_paid + status (±$0.05)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder',
);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const invoiceId = req.query.invoiceId;
      const recent = req.query.recent;
      const all = req.query.all;

      // All payments mode — for remittance grouping. Joins with invoices for context.
      if (all) {
        const { data, error } = await supabase
          .from('payments')
          .select('*, invoices(vendor_name, invoice_number, amount, amount_paid, status)')
          .order('payment_date', { ascending: false });
        if (error) throw error;
        return res.json(data.map((p) => ({
          id: p.id,
          invoiceId: p.invoice_id,
          amount: parseFloat(p.amount) || 0,
          paymentDate: p.payment_date,
          paymentMethod: p.payment_method || 'ACH',
          note: p.note || '',
          createdAt: p.created_at,
          vendorName: p.invoices?.vendor_name || '',
          invoiceNumber: p.invoices?.invoice_number || '',
          invoiceAmount: parseFloat(p.invoices?.amount) || 0,
          invoiceAmountPaid: parseFloat(p.invoices?.amount_paid) || 0,
          invoiceStatus: p.invoices?.status || '',
        })));
      }

      // Recent payments mode — joins with invoices for context
      if (recent) {
        const limit = Math.min(parseInt(recent, 10) || 20, 100);
        const { data, error } = await supabase
          .from('payments')
          .select('*, invoices(vendor_name, invoice_number, amount, amount_paid)')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return res.json(data.map((p) => ({
          id: p.id,
          invoiceId: p.invoice_id,
          amount: parseFloat(p.amount) || 0,
          paymentDate: p.payment_date,
          paymentMethod: p.payment_method || 'ACH',
          note: p.note || '',
          createdAt: p.created_at,
          vendorName: p.invoices?.vendor_name || '',
          invoiceNumber: p.invoices?.invoice_number || '',
          invoiceAmount: parseFloat(p.invoices?.amount) || 0,
          invoiceAmountPaid: parseFloat(p.invoices?.amount_paid) || 0,
        })));
      }

      if (!invoiceId) return res.status(400).json({ error: 'invoiceId required' });

      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return res.json(data.map((p) => ({
        id: p.id,
        invoiceId: p.invoice_id,
        amount: parseFloat(p.amount) || 0,
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method || 'ACH',
        note: p.note || '',
        createdAt: p.created_at,
      })));
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { invoiceId, amount, paymentDate, note, paymentMethod } = body;
      if (!invoiceId || !amount) {
        return res.status(400).json({ error: 'invoiceId and amount required' });
      }

      // Insert payment record
      const { error: pErr } = await supabase
        .from('payments')
        .insert({
          invoice_id: invoiceId,
          amount: parseFloat(amount),
          payment_date: paymentDate || new Date().toISOString().slice(0, 10),
          note: note || '',
          payment_method: paymentMethod || 'ACH',
        });
      if (pErr) throw pErr;

      // Update invoice totals
      const { data: inv, error: iErr } = await supabase
        .from('invoices')
        .select('amount, amount_paid')
        .eq('id', invoiceId)
        .single();
      if (iErr) throw iErr;

      const newPaid = parseFloat(inv.amount_paid) + parseFloat(amount);
      // ±$0.05 tolerance to absorb float rounding so a "full" payment isn't stuck as partial
      const status = newPaid >= parseFloat(inv.amount) - 0.05 ? 'paid' : 'partial';

      const { error: uErr } = await supabase
        .from('invoices')
        .update({ amount_paid: newPaid, status })
        .eq('id', invoiceId);
      if (uErr) throw uErr;

      return res.json({ ok: true, newPaid, status });
    }

    if (req.method === 'DELETE') {
      const paymentId = req.query.id;
      if (!paymentId) return res.status(400).json({ error: 'payment id required' });

      // Get the payment first
      const { data: pmt, error: pErr } = await supabase
        .from('payments')
        .select('invoice_id, amount')
        .eq('id', paymentId)
        .single();
      if (pErr) throw pErr;
      if (!pmt) return res.status(404).json({ error: 'payment not found' });

      // Get the invoice
      const { data: inv, error: iErr } = await supabase
        .from('invoices')
        .select('amount, amount_paid')
        .eq('id', pmt.invoice_id)
        .single();
      if (iErr) throw iErr;

      // Delete the payment record
      const { error: dErr } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);
      if (dErr) throw dErr;

      // Recalculate invoice paid + status (±$0.05 tolerance for float rounding)
      const newPaid = Math.max(0, parseFloat(inv.amount_paid) - parseFloat(pmt.amount));
      let status;
      if (newPaid <= 0.05) status = 'open';
      else if (newPaid >= parseFloat(inv.amount) - 0.05) status = 'paid';
      else status = 'partial';

      const { error: uErr } = await supabase
        .from('invoices')
        .update({ amount_paid: newPaid, status })
        .eq('id', pmt.invoice_id);
      if (uErr) throw uErr;

      return res.json({ ok: true, newPaid, status });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
