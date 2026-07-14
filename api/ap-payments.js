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
import { requireApAuth } from './_ap-auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder',
);

export default async function handler(req, res) {
  if (!requireApAuth(req, res)) return;
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
      if (!invoiceId || amount == null) return res.status(400).json({ error: 'invoiceId and amount required' });
      const amt = parseFloat(amount);
      if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'amount must be positive' });

      // Atomic: locks the invoice row, inserts the payment, recomputes
      // amount_paid + status in one transaction (see ap_payment_rpc.sql).
      const { data, error } = await supabase.rpc('ap_record_payment', {
        p_invoice_id: invoiceId,
        p_amount: amt,
        p_date: paymentDate || null,
        p_method: paymentMethod || 'ACH',
        p_note: note || '',
      });
      if (error) throw error;
      return res.json(data);
    }

    if (req.method === 'DELETE') {
      const paymentId = req.query.id;
      if (!paymentId) return res.status(400).json({ error: 'payment id required' });

      // Atomic undo: deletes the payment + reverts amount_paid/status together.
      const { data, error } = await supabase.rpc('ap_undo_payment', { p_payment_id: paymentId });
      if (error) throw error;
      return res.json(data);
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
