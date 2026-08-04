// AP Aging — Zapier email intake. ONE call does the whole chain so the Zap has
// a single step that either works or doesn't: fetch/decode the PDF -> Claude
// extraction -> dedup -> auto-approve policy -> insert.
//
// Replaces the dead Gmail -> fdw_equipment_invoice -> ap-sync pipeline.
//
// POST /api/ap-intake
//   headers: x-ap-key: <VITE_APP_PASSWORD>
//   body (JSON), ONE of:
//     { pdfUrl: "https://...", filename?, from?, subject?, receivedAt? }
//     { pdfBase64: "JVBERi0...", filename?, from?, subject?, receivedAt? }
//   Zapier's Gmail trigger exposes attachments as URLs, so pdfUrl is the normal
//   path; pdfBase64 is there for anything that hands over raw bytes.
//
// 200 { ok:true, action:"created"|"duplicate", needsReview, invoiceId, vendor,
//       invoiceNumber, amount, reason, pdfPath }
// 422 { ok:false, action:"rejected", reason }   — not an invoice / unreadable
// Always returns a body Zapier can branch on. `action` is the field to filter.
import { createClient } from '@supabase/supabase-js';
import { requireApAuth } from './_ap-auth.js';
import { assertPdf, storePdf, extractFields, ExtractError } from './_ap-extract-core.js';
import { canonInvoiceNo, dedupKey, autoApproveDecision } from './_ap-ingest.js';

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder',
);

// Cap the remote fetch so a bad URL can't stream forever into the function.
async function fetchPdf(url) {
  let u;
  try { u = new URL(String(url)); } catch { throw new ExtractError(400, 'pdfUrl is not a valid URL'); }
  if (!/^https?:$/.test(u.protocol)) throw new ExtractError(400, 'pdfUrl must be http(s)');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(u, { signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) throw new ExtractError(502, `pdfUrl fetch failed: HTTP ${r.status}`);
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    if (e instanceof ExtractError) throw e;
    throw new ExtractError(502, `pdfUrl fetch failed: ${e.name === 'AbortError' ? 'timeout after 25s' : e.message}`);
  } finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'POST only' }); }
  if (!requireApAuth(req, res)) return;

  const { pdfUrl, pdfBase64, filename, from, subject, receivedAt } = req.body || {};
  const src = { from: from || null, subject: subject || null, receivedAt: receivedAt || null };

  try {
    // ---- 1. get the bytes -------------------------------------------------
    let buf;
    if (pdfBase64) {
      try { buf = Buffer.from(String(pdfBase64), 'base64'); }
      catch { throw new ExtractError(400, 'invalid base64'); }
    } else if (pdfUrl) {
      buf = await fetchPdf(pdfUrl);
    } else {
      throw new ExtractError(400, 'pdfUrl or pdfBase64 required');
    }
    // Non-PDF attachments are the common case in an inbox (images, signatures,
    // .ics). Reject cheaply BEFORE spending storage or Anthropic tokens.
    assertPdf(buf);

    // ---- 2. store + extract ----------------------------------------------
    const pdfPath = await storePdf(buf, filename);
    const inv = await extractFields(buf);

    const vendorName  = String(inv.vendorName || '').trim();
    const invoiceNumber = canonInvoiceNo(inv.invoiceNumber);
    const amount = Number(inv.amount);

    if (!vendorName || !invoiceNumber) {
      return res.status(422).json({
        ok: false, action: 'rejected', pdfPath, source: src,
        reason: `extraction produced no ${!vendorName ? 'vendor name' : 'invoice number'} — likely not an invoice`,
        extracted: inv,
      });
    }

    // ---- 3. dedup against existing invoices -------------------------------
    // Compare on the canonical key, not raw strings — see _ap-ingest.js.
    const { data: existing, error: exErr } = await supabase
      .from('invoices')
      .select('id, vendor_name, invoice_number, amount, deleted_at');
    if (exErr) throw new ExtractError(500, `invoice lookup failed: ${exErr.message}`);

    const live = (existing || []).filter(r => !r.deleted_at);
    const key = dedupKey(vendorName, invoiceNumber);
    const dupe = live.find(r => dedupKey(r.vendor_name, r.invoice_number) === key);
    if (dupe) {
      return res.json({
        ok: true, action: 'duplicate', invoiceId: dupe.id, vendor: vendorName,
        invoiceNumber, amount, pdfPath, source: src,
        reason: `already on file as invoice ${dupe.id}`,
      });
    }

    // ---- 4. auto-approve policy (same rule as the old ap-sync) ------------
    const vKey = dedupKey(vendorName, '').split('|')[0];
    const priors = live
      .filter(r => dedupKey(r.vendor_name, '').split('|')[0] === vKey)
      .map(r => Number(r.amount));
    const { approve, reason } = autoApproveDecision({ ...inv, vendorName, invoiceNumber }, priors);

    // ---- 5. insert --------------------------------------------------------
    // There is no `source` column — provenance goes in `description`, matching
    // the convention ap-sync used ("[auto] ... · Gmail-parsed (high conf)").
    const list = (v) => (Array.isArray(v) ? v.join(', ') : String(v || '')).trim() || null;
    const conf = String(inv.confidence || 'unknown').toLowerCase();
    const desc = `[email] ${inv.description || 'invoice'} · via Zapier${src.from ? ' from ' + src.from : ''} (${conf} conf)${approve ? '' : ' · NEEDS REVIEW'}`;

    const { data: ins, error: insErr } = await supabase
      .from('invoices')
      .insert({
        vendor_name: vendorName,
        invoice_number: invoiceNumber,
        invoice_date: inv.invoiceDate || null,
        due_date: inv.dueDate || null,
        amount: Number.isFinite(amount) ? amount : 0,
        terms: inv.terms || '',
        description: desc,
        pdf_path: pdfPath || '',
        unit_ids: list(inv.units),
        vin_ids: list(inv.vins),
        needs_review: !approve,
      })
      .select('id')
      .single();
    if (insErr) {
      // A unique index on (vendor_name, invoice_number) also guards this. If the
      // canonical dedup above missed it (exact-string match differing only in a
      // way dedupKey normalises), report it as a duplicate — not a 500. Zapier
      // should see a benign outcome, not an error it will retry forever.
      if (/duplicate key|unique constraint/i.test(insErr.message || '')) {
        return res.json({
          ok: true, action: 'duplicate', vendor: vendorName, invoiceNumber, amount,
          pdfPath, source: src, reason: 'already on file (unique index)',
        });
      }
      throw new ExtractError(500, `insert failed: ${insErr.message}`);
    }

    return res.json({
      ok: true, action: 'created', invoiceId: ins.id, needsReview: !approve,
      vendor: vendorName, invoiceNumber, amount, pdfPath, source: src,
      reason: approve ? `auto-approved: ${reason}` : `held for review: ${reason}`,
    });
  } catch (e) {
    const status = e instanceof ExtractError ? e.status : 500;
    return res.status(status).json({
      ok: false, action: status === 500 ? 'error' : 'rejected',
      reason: e.message, source: src, ...(e.extra || {}),
    });
  }
}
