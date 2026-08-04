// AP invoice extraction core — shared by /api/ap-extract (browser drag-and-drop)
// and /api/ap-intake (Zapier email ingestion). Lives in its own module so the
// prompt and the PDF validation exist ONCE; two copies would drift and the
// email path would quietly start extracting differently from the UI path.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder',
);

export const EXTRACT_PROMPT = `Extract invoice data from this PDF. Return ONLY a JSON object with these fields:
{"vendorName":"company name","invoiceNumber":"invoice number","invoiceDate":"YYYY-MM-DD","dueDate":"YYYY-MM-DD or null","amount":0.00,"terms":"payment terms","description":"brief description","units":["unit1"],"vins":["vin1"],"contractNumber":"contract or null","billingPeriod":"period text or null","confidence":"high|medium|low"}

RULES — follow exactly:
1. vendorName: the COMPANY NAME that issued the invoice (logo/letterhead/business name at top). NEVER a lockbox number, PO box, address, or "remit to" line.
2. amount: the FINAL TOTAL owed — "Total Due"/"Amount Due"/"Balance Due"/"Total Due This Invoice", INCLUDING tax/shipping. NOT a subtotal or line item.
3. description: summarize what was invoiced incl. unit numbers + charge type. Never blank.
4. invoiceDate/dueDate: YYYY-MM-DD.
5. terms: e.g. "Net 10", "Net 30", "Due on Receipt".
6. units: ALL unit/equipment/fleet numbers (e.g. "Unit # 104463", "Unit 26440", "P5181425"). Array of strings; [] if none.
7. vins: ALL 17-char VINs. Array; [] if none.
8. contractNumber: lease/agreement/rental number (e.g. "Agr #875", "Agreement 070R-001058", "Lease 1710"). null if none.
9. billingPeriod: billing date range (e.g. "Mar 1 - Mar 31, 2026"). null if none.
10. confidence: "high" only if this is clearly an invoice AND you read vendorName, invoiceNumber and amount directly off the page without guessing. "medium" if you inferred any of those. "low" if the document is unclear, is not an invoice (statement/receipt/quote/remittance), is a multi-invoice summary, or you could not find a total.
Return ONLY valid JSON, no markdown, no explanation.`;

export class ExtractError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra || {}; }
}

/** Validate a PDF buffer. Throws ExtractError with an HTTP status. */
export function assertPdf(buf) {
  if (!buf || buf.length < 5 || buf.slice(0, 5).toString('latin1') !== '%PDF-') {
    throw new ExtractError(400, 'not a PDF');
  }
  if (buf.length > 10 * 1024 * 1024) throw new ExtractError(413, 'PDF too large (>10MB)');
}

/** Upload to the shared `invoices` bucket. Non-fatal: returns '' on failure. */
export async function storePdf(buf, filename) {
  try {
    const safe = String(filename || 'invoice.pdf').replace(/[^A-Za-z0-9._-]/g, '_');
    const pdfPath = `${Date.now()}_${safe}`;
    const { error } = await supabase.storage
      .from('invoices')
      .upload(pdfPath, buf, { contentType: 'application/pdf', upsert: false });
    return error ? '' : pdfPath;
  } catch { return ''; }
}

/**
 * Run Claude Haiku document extraction over a PDF buffer.
 * Returns the parsed field object (plus `confidence`). Throws ExtractError.
 */
export async function extractFields(buf) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ExtractError(500, 'ANTHROPIC_API_KEY not set');
  const pdfBase64 = buf.toString('base64');

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
        { type: 'text', text: EXTRACT_PROMPT },
      ] }],
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new ExtractError(502, `anthropic ${r.status}: ${JSON.stringify(data).slice(0, 200)}`);

  const reply = (data.content || []).map(c => c.text || '').join('').trim();
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) throw new ExtractError(422, 'no JSON in extraction', { raw: reply.slice(0, 200) });
  return JSON.parse(m[0]);
}
