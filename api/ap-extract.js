// AP Aging — PDF invoice extraction, ported from ap-aging/src/app/api/extract.
// Contract CHANGED from Next.js multipart to base64 JSON (cleaner in a Vercel
// function): POST { pdfBase64, filename } -> uploads the PDF to the shared
// `invoices` storage bucket AND runs Claude Haiku document extraction ->
// { vendorName, invoiceNumber, invoiceDate, dueDate, amount, terms, description,
//   units[], vins[], contractNumber, billingPeriod, pdfPath }.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.
import { createClient } from '@supabase/supabase-js';
import { requireApAuth } from './_ap-auth.js';

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder',
);

const EXTRACT_PROMPT = `Extract invoice data from this PDF. Return ONLY a JSON object with these fields:
{"vendorName":"company name","invoiceNumber":"invoice number","invoiceDate":"YYYY-MM-DD","dueDate":"YYYY-MM-DD or null","amount":0.00,"terms":"payment terms","description":"brief description","units":["unit1"],"vins":["vin1"],"contractNumber":"contract or null","billingPeriod":"period text or null"}

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
Return ONLY valid JSON, no markdown, no explanation.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  if (!requireApAuth(req, res)) return;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const { pdfBase64, filename } = req.body || {};
  if (!pdfBase64 || typeof pdfBase64 !== 'string') return res.status(400).json({ error: 'pdfBase64 required' });
  let buf;
  try { buf = Buffer.from(pdfBase64, 'base64'); } catch { return res.status(400).json({ error: 'invalid base64' }); }
  // Validate it's really a PDF, before spending storage or Anthropic tokens.
  if (buf.length < 5 || buf.slice(0, 5).toString('latin1') !== '%PDF-') return res.status(400).json({ error: 'not a PDF' });
  if (buf.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'PDF too large (>10MB)' });

  try {
    // 1. store the PDF in the shared `invoices` bucket
    let pdfPath = '';
    try {
      const safe = String(filename || 'invoice.pdf').replace(/[^A-Za-z0-9._-]/g, '_');
      pdfPath = `${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from('invoices')
        .upload(pdfPath, buf, { contentType: 'application/pdf', upsert: false });
      if (upErr) { pdfPath = ''; } // non-fatal: extraction can still proceed
    } catch { pdfPath = ''; }

    // 2. extract via Claude Haiku document reading
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
    if (!r.ok) return res.status(502).json({ error: `anthropic ${r.status}: ${JSON.stringify(data).slice(0, 200)}`, pdfPath });

    const reply = (data.content || []).map((c) => c.text || '').join('').trim();
    const m = reply.match(/\{[\s\S]*\}/);
    if (!m) return res.status(422).json({ error: 'no JSON in extraction', raw: reply.slice(0, 200), pdfPath });
    const parsed = JSON.parse(m[0]);

    return res.json({ ...parsed, pdfPath });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
