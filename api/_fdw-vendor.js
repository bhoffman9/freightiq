// _fdw-vendor.js — AI extraction of equipment-lessor invoices for fdw-extract.
// Primary path: pdf-parse pulls the PDF text layer, Claude returns strict JSON.
// Fallback: if the text layer is missing/corrupt (image-only PDF, "bad XRef"),
// send the PDF bytes to Claude directly (native PDF reading) — recovers the
// malformed PDFs Penske/Ryder ship. Six vendor layouts that drift make hand-
// written regex parsers a maintenance sink; format-agnostic AI + a validation
// gate in the caller keeps it honest (quarantine, not guess).
import pdf from 'pdf-parse/lib/pdf-parse.js';

const MODEL = 'claude-sonnet-5';
const MIN_TEXT = 40; // below this, treat the text layer as unusable

const EXTRACT_SYS =
  'You extract structured data from a single equipment-lease invoice (truck or ' +
  'trailer rental/lease). Return ONLY a JSON object, no prose, no code fences, ' +
  'with keys: vendor (string), invoice_no (string|null), invoice_date ' +
  '(YYYY-MM-DD|null), due_date (YYYY-MM-DD|null), unit_ids (array of strings — ' +
  'the truck/trailer/VIN numbers billed on THIS invoice, [] if none), amount ' +
  '(number — the invoice TOTAL / amount due in USD, null if not found), ' +
  'service_period_start (YYYY-MM-DD|null), service_period_end (YYYY-MM-DD|null), ' +
  'confidence ("high"|"medium"|"low"). amount must be the grand total the ' +
  'customer owes on this invoice, NOT a single line item and NOT a running ' +
  'account balance or year-to-date figure. If the document is not an invoice or ' +
  'you cannot find a clear invoice total, set amount null and confidence "low".';

const num = (v) => (v == null || isNaN(Number(v)) ? null : Number(v));

async function pdfText(buf) {
  try { return ((await pdf(buf)).text || '').trim(); }
  catch { return ''; } // corrupt/unsupported → empty triggers the document fallback
}

async function callClaude(userContent) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2048, system: EXTRACT_SYS,
      messages: [{ role: 'user', content: userContent }] }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return (data.content || []).map((c) => c.text || '').join('').trim();
}

function parseJson(reply) {
  let s = reply.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i < 0 || j <= i) throw new Error(`no JSON in AI reply: ${reply.slice(0, 160)}`);
  return JSON.parse(s.slice(i, j + 1));
}

function shape(j) {
  return {
    vendor: j.vendor || null,
    invoiceNo: j.invoice_no ? String(j.invoice_no) : null,
    invoiceDate: j.invoice_date || null,
    dueDate: j.due_date || null,
    unitIds: Array.isArray(j.unit_ids) ? j.unit_ids.filter(Boolean).join(', ') : null,
    amount: num(j.amount),
    servicePeriodStart: j.service_period_start || null,
    servicePeriodEnd: j.service_period_end || null,
    confidence: j.confidence || 'low',
    _raw: j,
  };
}

// Returns parsed invoice fields, or throws. A thrown error with .quarantine=true
// means known-unprocessable (caller quarantines, no retry); any other throw is
// transient (caller records extract_error + retries next run).
export async function parseVendorInvoice(buf, filename, source) {
  const isCsv = /\.csv$/i.test(filename);
  const text = isCsv ? buf.toString('utf8') : await pdfText(buf);

  const fromText = () => callClaude(
    `Source: ${source}\nFilename: ${filename}\n\nInvoice text:\n"""\n${text.slice(0, 14000)}\n"""`);
  // Visual read of the actual PDF — catches invoices whose total lives in an
  // image/table the text layer drops (and recovers image-only / corrupt PDFs).
  const fromDoc = () => callClaude([
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } },
    { type: 'text', text: `Source: ${source}\nFilename: ${filename}\nExtract the invoice fields as specified.` },
  ]);

  let inv;
  if (text && text.length >= MIN_TEXT) {
    inv = shape(parseJson(await fromText()));
    // Escalate: if the text layer didn't yield a usable amount (or low confidence),
    // re-read the PDF visually before giving up. This is what recovers the TEC/etc.
    // invoices whose total isn't in the extracted text layer.
    if (!isCsv && (inv.amount == null || String(inv.confidence).toLowerCase() === 'low')) {
      try {
        const d = shape(parseJson(await fromDoc()));
        if (d.amount != null) inv = d;   // prefer the visual read when it found a total
      } catch { /* keep the text-path result */ }
    }
  } else if (!isCsv) {
    inv = shape(parseJson(await fromDoc()));
  } else {
    const e = new Error(`empty CSV (${text.length} chars)`); e.quarantine = true; throw e;
  }
  return inv;
}
