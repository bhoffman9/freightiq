// Shared AP ingestion rules — dedup + auto-approve. Extracted from ap-sync so
// /api/ap-intake (Zapier email path) applies the SAME policy. Two copies would
// drift and one route would start posting payables the other would have held.

// Invoice numbers are STORED as typed (trimmed, inner whitespace removed) but
// COMPARED case- and punctuation-insensitively — "CENTRAL DISPATCH" vs
// "CENTRALDISPATCH" and "INV 123" vs "inv-123" are the same payable. Comparing
// raw strings duplicated invoices in the past.
export const canonInvoiceNo = (v) => String(v ?? '').trim().replace(/\s+/g, '');
export const dedupKey = (vendor, invoiceNo) =>
  `${String(vendor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')}|${String(invoiceNo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

/**
 * Decide whether an extracted invoice may post live or must be held.
 *
 * Auto-approve requires ALL of:
 *   - a usable amount (> 0, finite)          — never auto-post a $0 or NaN payable
 *   - every critical field present            — vendor, invoice number, amount
 *   - model confidence "high"                 — not medium/low
 *   - prior history for this vendor           — a first-ever invoice always gets eyes
 *   - amount within 1.5x that vendor's largest prior invoice
 *
 * Confidence alone is the model grading its own homework, so the field-
 * completeness and amount-vs-history checks are what actually carry the weight.
 *
 * @param {object} inv    extracted fields ({vendorName, invoiceNumber, amount, confidence})
 * @param {number[]} priorAmounts  this vendor's existing invoice amounts
 * @returns {{approve: boolean, reason: string}}
 */
export function autoApproveDecision(inv, priorAmounts) {
  const amount = Number(inv.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { approve: false, reason: 'amount missing or <= 0' };
  if (!String(inv.vendorName || '').trim())     return { approve: false, reason: 'no vendor name' };
  if (!String(inv.invoiceNumber || '').trim())  return { approve: false, reason: 'no invoice number' };

  const conf = String(inv.confidence || '').toLowerCase();
  if (conf !== 'high') return { approve: false, reason: `confidence ${conf || 'unknown'}` };

  const priors = (priorAmounts || []).map(Number).filter(n => Number.isFinite(n) && n > 0);
  if (!priors.length) return { approve: false, reason: 'first invoice from this vendor' };

  const max = Math.max(...priors);
  if (amount > max * 1.5) {
    return { approve: false, reason: `amount ${amount.toFixed(2)} exceeds 1.5x vendor max ${max.toFixed(2)}` };
  }
  return { approve: true, reason: `within 1.5x vendor max ${max.toFixed(2)} (${priors.length} prior)` };
}
