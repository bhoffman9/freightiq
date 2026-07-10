// EFS fuel PDF parser for the FDW extraction pipeline.
//
// Reference format: scripts/parse_weekly_drop.py (summarize_efs) — the proven
// Python logic that has parsed these EFS Transaction Reports for months.
//
// The EFS report has two kinds of relevant lines:
//   1. TRANSACTION lines — one per fuel purchase, e.g.
//        27406 2026-06-05 <invoice> <driver> <MERCHANT> <ST> ULSD 3.499 45.231 158.30 ...
//      Start with a 5-digit CARD number, then an ISO date, then merchant/driver
//      text, a fuel product code, unit price, quantity (gallons) and amount.
//      The unit-of-measure column reads "USD/Gallons" for fuel lines — that is
//      the tell that separates fuel from DEF/parking/cash-advance/fee lines.
//   2. GROUP summary blocks — per-card subtotals (product code + amount + qty).
//      Python uses these for the authoritative per-card totals, but they carry
//      NO transaction date, and fdw_fuel_txn.txn_date is NOT NULL, so we must
//      parse the transaction lines to get dated rows.
//
// This parser therefore extracts dated transaction lines, classifies each by
// kind (fuel | def | parking | other), and derives statement totals. The
// statement grand total is the tie-out target checked by the caller.
//
// IMPORTANT: if nothing usable is extracted we THROW, so the staging row lands
// in fdw_quarantine rather than writing a statement of zeros. No calibrated
// sample was available at authoring time — the regexes mirror the Python parser
// and the documented "USD/Gallons" format; re-verify against a real EFS export.

// Import the library file directly (NOT the package index). pdf-parse's index.js
// runs a debug block that reads a bundled test PDF when there is no module.parent
// (always true under ESM), which throws ENOENT. The lib entry skips that.
import pdf from 'pdf-parse/lib/pdf-parse.js';

// Fuel product codes seen on EFS reports (from parse_weekly_drop.py + common EFS
// codes). Anything matching these on a transaction line is treated as fuel.
const FUEL_CODES = /\b(ULSD|BDSL|CDSL|UNPR|UNRG|DSL2?|DYED|B20|B11|B05|B5|RUL|MIDG|PREM|PLUS|GAS)\b/;
const DEF_RE = /\bDEF\b/i;
const PARK_RE = /\b(PARK(?:ING)?|SCALE|SHOWER|CADV|CASH\s*ADV|ADVANCE|TIRE|OIL|WASH|DISCOUNT|FEE|OS&D)\b/i;

const num = (s) => (s == null ? null : parseFloat(String(s).replace(/,/g, '')));

// Normalize a date token (ISO 2026-06-05 or US 06/05/2026) to ISO yyyy-mm-dd.
function normDate(tok) {
  if (!tok) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tok);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(tok);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  return null;
}

function classify(rest) {
  if (DEF_RE.test(rest)) return 'def';
  if (FUEL_CODES.test(rest)) return 'fuel';
  if (PARK_RE.test(rest)) return 'parking';
  return 'other';
}

// Pull (gallons, amount) from the trailing part of a transaction line.
// Preferred: unit-tagged values ("... 158.30 USD ... 45.231 Gallons"). Fallback:
// positional — on a fuel line the columns are unit-price, quantity, amount, so
// amount is the last money-like token and gallons the quantity before it (the
// small ~2-5 unit price is skipped).
function extractQtyAmount(rest, kind) {
  let gallons = null;
  let amount = null;

  let m = /([\d,]+\.\d{1,3})\s*USD/i.exec(rest);
  if (m) amount = num(m[1]);
  m = /([\d,]+\.\d{1,3})\s*(?:Gallons|GAL)\b/i.exec(rest);
  if (m) gallons = num(m[1]);

  if (amount == null || (kind === 'fuel' && gallons == null)) {
    const toks = (rest.match(/[\d,]+\.\d{1,3}/g) || []).map(num).filter((n) => n != null);
    if (amount == null && toks.length) amount = toks[toks.length - 1];
    if (kind === 'fuel' && gallons == null && toks.length >= 2) {
      // candidates excluding the amount and any tiny unit-price (< 1 is a price/tax)
      const cands = toks.slice(0, -1).filter((n) => n >= 1);
      // gallons is the largest remaining quantity that isn't itself the amount
      if (cands.length) gallons = cands.reduce((a, b) => (b > a ? b : a), cands[0]);
    }
  }
  return { gallons, amount };
}

export async function parseEfs(buffer) {
  const data = await pdf(buffer);
  const text = (data && data.text) || '';
  const lines = text.split(/\r?\n/);

  const txns = [];
  const TXN_RE = /^\s*(\d{5})\s+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b(.*)$/;

  for (const raw of lines) {
    const m = TXN_RE.exec(raw);
    if (!m) continue;
    const cardNo = m[1];
    const txnDate = normDate(m[2]);
    if (!txnDate) continue;
    const rest = (m[3] || '').trim();
    const kind = classify(rest);
    const { gallons, amount } = extractQtyAmount(rest, kind);
    if (amount == null) continue; // unparseable money — skip rather than land a zero
    txns.push({
      cardNo,
      txnDate,
      kind,
      gallons: kind === 'fuel' ? gallons : null,
      amount,
      rawDesc: rest.slice(0, 300),
    });
  }

  if (!txns.length) {
    throw new Error('parseEfs: no transaction lines matched — not an EFS report or unreadable PDF text layer');
  }

  // Statement grand total (tie-out target). EFS prints "Grand Totals" with the
  // summed amount and gallons. Fall back to summed txns if not present.
  let totalAmount = null;
  let totalGallons = null;
  for (const raw of lines) {
    if (!/grand\s*total/i.test(raw)) continue;
    const toks = (raw.match(/[\d,]+\.\d{1,3}/g) || []).map(num).filter((n) => n != null);
    if (toks.length) {
      totalAmount = toks[toks.length - 1];
      if (toks.length >= 2) totalGallons = toks[toks.length - 2];
    }
    break;
  }
  const sumAmount = round2(txns.reduce((a, t) => a + (t.amount || 0), 0));
  const sumGallons = round2(txns.reduce((a, t) => a + (t.gallons || 0), 0));
  if (totalAmount == null) totalAmount = sumAmount;
  if (totalGallons == null) totalGallons = sumGallons;

  // Period: min/max transaction date (an explicit billing-period line varies by
  // template; txn-date bounds are always correct for what we actually ingested).
  const dates = txns.map((t) => t.txnDate).sort();
  const periodStart = dates[0];
  const periodEnd = dates[dates.length - 1];

  // Statement id: prefer an explicit statement/account/invoice number; else a
  // stable synthetic key from the period so re-ingesting the same file upserts.
  let statementId = null;
  for (const raw of lines) {
    const m = /(?:Statement|Account|Invoice)\s*(?:No\.?|Number|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,})/i.exec(raw);
    if (m) { statementId = m[1]; break; }
  }
  if (!statementId) statementId = `EFS-${periodStart}_${periodEnd}`;

  return { statementId, periodStart, periodEnd, totalAmount, totalGallons, txns };
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
