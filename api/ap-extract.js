// AP Aging — PDF invoice extraction, ported from ap-aging/src/app/api/extract.
// Contract CHANGED from Next.js multipart to base64 JSON (cleaner in a Vercel
// function): POST { pdfBase64, filename } -> uploads the PDF to the shared
// `invoices` storage bucket AND runs Claude Haiku document extraction ->
// { vendorName, invoiceNumber, invoiceDate, dueDate, amount, terms, description,
//   units[], vins[], contractNumber, billingPeriod, pdfPath }.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.
// The prompt + PDF validation + storage now live in _ap-extract-core.js, shared
// with /api/ap-intake (Zapier email path) so the two can't drift apart.
import { requireApAuth } from './_ap-auth.js';
import { assertPdf, storePdf, extractFields, ExtractError } from './_ap-extract-core.js';

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  if (!requireApAuth(req, res)) return;

  const { pdfBase64, filename } = req.body || {};
  if (!pdfBase64 || typeof pdfBase64 !== 'string') return res.status(400).json({ error: 'pdfBase64 required' });
  let buf;
  try { buf = Buffer.from(pdfBase64, 'base64'); } catch { return res.status(400).json({ error: 'invalid base64' }); }

  let pdfPath = '';
  try {
    assertPdf(buf);                          // cheap reject before storage/tokens
    pdfPath = await storePdf(buf, filename); // non-fatal if it fails
    const parsed = await extractFields(buf);
    return res.json({ ...parsed, pdfPath });
  } catch (e) {
    const status = e instanceof ExtractError ? e.status : 500;
    return res.status(status).json({ error: e.message, pdfPath, ...(e.extra || {}) });
  }
}
