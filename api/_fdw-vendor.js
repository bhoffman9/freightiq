// _fdw-vendor.js — AI extraction of equipment-lessor invoices for fdw-extract.
// pdf-parse pulls the PDF text layer; Claude returns strict JSON. Six vendor
// layouts that drift make hand-written regex parsers a maintenance sink, so this
// is format-agnostic AI extraction gated by a validation check in the caller
// (quarantine on missing amount / low confidence rather than guess).
import pdf from 'pdf-parse/lib/pdf-parse.js';

const MODEL = 'claude-sonnet-5';
const MIN_TEXT = 40; // below this, treat as an image-only PDF (no text layer)

const EXTRACT_SYS =
  'You extract structured data from a single equipment-lease invoice (truck or ' +
  'trailer rental/lease). Return ONLY a JSON object, no prose, with keys: ' +
  'vendor (string), invoice_no (string|null), invoice_date (YYYY-MM-DD|null), ' +
  'due_date (YYYY-MM-DD|null), unit_ids (array of strings — truck/trailer/VIN ' +
  'numbers billed on this invoice, [] if none), amount (number — the invoice ' +
  'TOTAL / amount due in USD, null if not found), service_period_start ' +
  '(YYYY-MM-DD|null), service_period_end (YYYY-MM-DD|null), confidence ' +
  '("high"|"medium"|"low"). amount must be the grand total the customer owes, ' +
  'NOT a single line item. If the document is not an invoice or you cannot find ' +
  'a total, set amount null and confidence "low".';

async function toText(buf, filename) {
  if (/\.csv$/i.test(filename)) return buf.toString('utf8');
  try {
    const d = await pdf(buf);
    return (d.text || '').trim();
  } catch (err) {
    // Corrupt/unsupported PDF (e.g. "bad XRef entry") — not retryable.
    const e = new Error(`pdf parse failed: ${String(err.message || err).slice(0, 120)}`);
    e.quarantine = true; throw e;
  }
}

// Returns parsed invoice fields, or throws. A thrown error with .quarantine=true
// means "known-unprocessable" (caller quarantines, no retry); any other throw is
// treated as transient (caller records extract_error + retries next run).
export async function parseVendorInvoice(buf, filename, source) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const text = await toText(buf, filename);
  if (!text || text.length < MIN_TEXT) {
    const e = new Error(`no text layer (image-only PDF, ${text.length} chars)`);
    e.quarantine = true; throw e;
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1024, system: EXTRACT_SYS,
      messages: [{ role: 'user', content:
        `Source: ${source}\nFilename: ${filename}\n\nInvoice text:\n"""\n${text.slice(0, 12000)}\n"""` }],
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${JSON.stringify(data).slice(0, 200)}`);

  const reply = (data.content || []).map((c) => c.text || '').join('').trim();
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`no JSON in AI reply: ${reply.slice(0, 160)}`);
  const j = JSON.parse(m[0]);

  return {
    vendor: j.vendor || null,
    invoiceNo: j.invoice_no || null,
    invoiceDate: j.invoice_date || null,
    dueDate: j.due_date || null,
    unitIds: Array.isArray(j.unit_ids) ? j.unit_ids.filter(Boolean).join(', ') : null,
    amount: (j.amount == null || isNaN(Number(j.amount))) ? null : Number(j.amount),
    servicePeriodStart: j.service_period_start || null,
    servicePeriodEnd: j.service_period_end || null,
    confidence: j.confidence || 'low',
    _raw: j,
  };
}
