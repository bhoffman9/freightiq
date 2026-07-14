// AP Aging — invoices CRUD, ported from ap-aging/src/app/api/invoices/route.js.
// Vercel serverless (single handler, branch on req.method). Same shared Supabase
// project as the AP Aging app. Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
//   GET                                  → list all (open/partial first, then due date)
//   GET  ?vendor=&invoiceNumber=         → duplicate check { exists: bool }
//   POST { vendorName, invoiceNumber, ...} → create (409 on dup)
//   PUT  { id, ...fields }               → update
//   DELETE ?id=UUID                      → remove (+ delete PDF from storage)
import { createClient } from '@supabase/supabase-js';
import { requireApAuth } from './_ap-auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder',
);

function toFrontend(row) {
  return {
    id: row.id,
    vendorName: row.vendor_name,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    amount: parseFloat(row.amount) || 0,
    amountPaid: parseFloat(row.amount_paid) || 0,
    terms: row.terms || '',
    description: row.description || '',
    status: row.status,
    pdfPath: row.pdf_path || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req, res) {
  if (!requireApAuth(req, res)) return;
  try {
    if (req.method === 'GET') {
      const vendor = req.query.vendor;
      const invNum = req.query.invoiceNumber;

      // Duplicate check
      if (vendor && invNum) {
        const { data } = await supabase
          .from('invoices')
          .select('id')
          .eq('vendor_name', vendor)
          .eq('invoice_number', invNum)
          .limit(1);
        return res.json({ exists: (data?.length || 0) > 0 });
      }

      // List all (open/partial first, then by due date)
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('status', { ascending: true })
        .order('due_date', { ascending: true });

      if (error) throw error;
      return res.json(data.map(toFrontend));
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { vendorName, invoiceNumber, invoiceDate, dueDate, amount, terms, description, pdfPath } = body;

      if (!vendorName || !invoiceNumber) {
        return res.status(400).json({ error: 'vendorName and invoiceNumber are required' });
      }

      // Duplicate check
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('vendor_name', vendorName)
        .eq('invoice_number', invoiceNumber)
        .limit(1);

      if (existing?.length > 0) {
        return res.status(409).json({ error: 'Duplicate invoice' });
      }

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          vendor_name: vendorName,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate || null,
          due_date: dueDate || null,
          amount: parseFloat(amount) || 0,
          terms: terms || '',
          description: description || '',
          pdf_path: pdfPath || '',
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(toFrontend(data));
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const { id, ...fields } = body;
      if (!id) return res.status(400).json({ error: 'id required' });

      const updates = {};
      if (fields.vendorName !== undefined) updates.vendor_name = fields.vendorName;
      if (fields.invoiceNumber !== undefined) updates.invoice_number = fields.invoiceNumber;
      if (fields.invoiceDate !== undefined) updates.invoice_date = fields.invoiceDate || null;
      if (fields.dueDate !== undefined) updates.due_date = fields.dueDate || null;
      if (fields.amount !== undefined) updates.amount = parseFloat(fields.amount) || 0;
      if (fields.amountPaid !== undefined) updates.amount_paid = parseFloat(fields.amountPaid) || 0;
      if (fields.terms !== undefined) updates.terms = fields.terms;
      if (fields.description !== undefined) updates.description = fields.description;
      if (fields.status !== undefined) updates.status = fields.status;
      if (fields.pdfPath !== undefined) updates.pdf_path = fields.pdfPath;

      const { data, error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json(toFrontend(data));
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id required' });

      // Get pdf_path to clean up storage
      const { data: inv } = await supabase
        .from('invoices')
        .select('pdf_path')
        .eq('id', id)
        .single();

      if (inv?.pdf_path) {
        await supabase.storage.from('invoices').remove([inv.pdf_path]);
      }

      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      return res.json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
