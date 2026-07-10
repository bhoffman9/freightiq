// EFS Statement parser for the FDW extraction pipeline.
//
// EFS emails a biweekly STATEMENT (remittance advice) — a fleet-level summary,
// NOT the per-transaction report. Calibrated against a real export
// (EFS_Statement_2026-07-08.pdf, Statement #99140138, SHOW FREIGHT INC).
//
// The "Statement Activity" block lists product categories with concatenated
// amounts (pdf-parse strips the column gap), e.g.:
//     Cash Adv401.25
//     Money Code1,398.86
//     OTHER59.16
//     Diesel14,305.24
//     Unleaded99.82
//     DEF594.80
//   Statement Total
//     16,859.13
// These sum exactly to the Statement Total (tie-out target). Fuel = Diesel +
// Unleaded (+ other fuel products); DEF / Cash Adv / Money Code / OTHER excluded
// from fuel but emitted as rows so the sum reconciles to the grand total.
//
// Gallons aren't in the summary; we derive them from the product-detail table
// (net amount / net price per gallon) when present, else null.
//
// One aggregate fdw_fuel_txn row is emitted per product category (card_no
// 'STATEMENT'), dated the statement period end. Per-driver/per-card attribution
// lives in the separate TransactionReport (not this doc) — future enhancement.
//
// Throws if the statement can't be parsed, so the staging row quarantines rather
// than landing zeros.

import pdf from 'pdf-parse/lib/pdf-parse.js';

// product label -> txn kind. Order/keys drive extraction.
const PRODUCTS = [
  ['Diesel', 'fuel'], ['Unleaded', 'fuel'], ['Reefer', 'fuel'],
  ['CNG', 'fuel'], ['LNG', 'fuel'], ['Propane', 'fuel'],
  ['DEF', 'def'], ['Cash Adv', 'parking'], ['Money Code', 'other'], ['OTHER', 'other'],
];
const FUEL_PRODUCTS = new Set(['Diesel', 'Unleaded', 'Reefer', 'CNG', 'LNG', 'Propane']);

const num = (s) => (s == null ? null : parseFloat(String(s).replace(/,/g, '')));
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function normDate(tok) {
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(tok);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tok);
  return m ? tok : null;
}

// Derive gallons for a fuel product from the detail-table line, which ends with
// <netPrice 3-decimals><netAmount 2-decimals>, e.g. "...5.23014,305.24".
function deriveGallons(lines, prod, netAmount) {
  const head = new RegExp(`^${prod}\\d`);
  for (const l of lines) {
    if (!head.test(l)) continue;
    const t = /(\d+\.\d{3})([\d,]+\.\d{2})$/.exec(l);
    if (t && Math.abs(num(t[2]) - netAmount) < 0.02) {
      const price = num(t[1]);
      if (price > 0) return round2(netAmount / price);
    }
  }
  return null;
}

export async function parseEfs(buffer) {
  const data = await pdf(buffer);
  const lines = ((data && data.text) || '').split(/\r?\n/).map((l) => l.trim());

  // period
  let periodStart = null, periodEnd = null;
  for (const l of lines) {
    const m = /Statement Period\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/.exec(l);
    if (m) { periodStart = normDate(m[1]); periodEnd = normDate(m[2]); break; }
  }

  // statement number (label on its own line, value on the next; or concatenated)
  let statementId = null;
  const si = lines.findIndex((l) => /^Statement Number/i.test(l));
  if (si >= 0) {
    const inline = /^Statement Number(\d{5,})$/i.exec(lines[si]);
    if (inline) statementId = inline[1];
    else if (/^\d{5,}$/.test(lines[si + 1] || '')) statementId = lines[si + 1];
  }

  // product amounts from Statement Activity (label immediately followed by amount)
  const amt = {};
  for (const [prod] of PRODUCTS) {
    const re = new RegExp(`^${prod.replace(/ /g, '\\s*')}(-?[\\d,]+\\.\\d{2})$`, 'i');
    for (const l of lines) { const m = re.exec(l); if (m) { amt[prod] = num(m[1]); break; } }
  }

  // statement grand total (tie-out target)
  let totalAmount = null;
  const ti = lines.findIndex((l) => /^Statement Total$/i.test(l));
  if (ti >= 0) { const m = /^(-?[\d,]+\.\d{2})$/.exec(lines[ti + 1] || ''); if (m) totalAmount = num(m[1]); }

  // build one aggregate txn per product present
  const txns = [];
  let fuelGallons = 0;
  for (const [prod, kind] of PRODUCTS) {
    const a = amt[prod];
    if (a == null || a === 0) continue;
    let gallons = null;
    if (FUEL_PRODUCTS.has(prod)) { gallons = deriveGallons(lines, prod, a); if (gallons) fuelGallons += gallons; }
    txns.push({ cardNo: 'STATEMENT', txnDate: periodEnd, kind, gallons, amount: a,
                rawDesc: `${prod} (statement ${statementId || ''} ${periodStart}..${periodEnd})`.trim() });
  }

  if (!txns.length || !periodEnd) {
    throw new Error('parseEfs: no Statement Activity products parsed — not an EFS statement or unreadable PDF');
  }

  const sum = round2(txns.reduce((a, t) => a + (t.amount || 0), 0));
  if (totalAmount == null) totalAmount = sum;
  if (!statementId) statementId = `EFS-${periodStart}_${periodEnd}`;

  return { statementId, periodStart, periodEnd, totalAmount,
           totalGallons: round2(fuelGallons) || null, txns };
}
