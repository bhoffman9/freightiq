// GET /api/fdw-extract — drains fdw_import_staging: downloads each staged raw
// file from the fdw-raw bucket, routes by `source`, and either lands facts
// (EFS) or quarantines (everything else, until a calibrated parser exists).
//
// Security: shared-secret, constant-time compared. Same secret as fdw-ingest
// (FDW_INGEST_SECRET). Accepted three ways so both humans and cron can call:
//   1. X-FDW-Secret header            (matches fdw-ingest; manual/service calls)
//   2. ?secret=<val> query param      (Vercel cron path can't set headers)
//   3. Authorization: Bearer <val>    (Vercel's native cron auth vs CRON_SECRET)
// The query-param path lets a plain cron URL authenticate; keep the real secret
// in the CRON_SECRET / FDW_INGEST_SECRET env, NOT hardcoded in vercel.json.
//
// Trust model: this endpoint only ever LANDS facts that pass a tie-out. EFS
// statement total must reconcile to the sum of its transaction rows or the whole
// statement is quarantined instead. Vendor invoice formats (truck_*/trailer_*/
// finance/rent) have no calibrated parser yet, so they are quarantined honestly
// with reason 'needs parser: <source>' rather than guessed at.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, FDW_INGEST_SECRET, [CRON_SECRET]

import crypto from 'node:crypto';
import { parseEfs } from './_fdw-efs.js';
import { parseVendorInvoice } from './_fdw-vendor.js';

export const config = { api: { bodyParser: false } };

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const SECRET = process.env.FDW_INGEST_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;

const BATCH_LIMIT = 50;
const TIEOUT_TOLERANCE = 1.0; // dollars: EFS statement total vs sum of txns

const sbHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

function ctEq(v, secret) {
  if (typeof v !== 'string' || typeof secret !== 'string' || !secret) return false;
  const a = Buffer.from(v), b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function authorized(req) {
  const q = req.query && req.query.secret;
  const qv = Array.isArray(q) ? q[0] : q;
  if (ctEq(qv, SECRET)) return true;
  if (ctEq(req.headers['x-fdw-secret'], SECRET)) return true;
  const bearer = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (bearer && ctEq(bearer, CRON_SECRET)) return true;
  return false;
}

async function sbGet(pathAndQuery) {
  const r = await fetch(`${SB}/rest/v1/${pathAndQuery}`, { headers: sbHeaders });
  if (!r.ok) throw new Error(`select ${r.status}: ${await r.text()}`);
  return r.json();
}
async function sbInsert(table, row, prefer) {
  const r = await fetch(`${SB}/rest/v1/${table}`, {
    method: 'POST', headers: { ...sbHeaders, Prefer: prefer || 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`insert ${table} ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function sbUpsert(table, row, onConflict) {
  const r = await fetch(`${SB}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`upsert ${table} ${r.status}: ${await r.text()}`);
}
async function sbDelete(table, filter) {
  const r = await fetch(`${SB}/rest/v1/${table}?${filter}`, {
    method: 'DELETE', headers: { ...sbHeaders, Prefer: 'return=minimal' },
  });
  if (!r.ok) throw new Error(`delete ${table} ${r.status}: ${await r.text()}`);
}
async function sbPatch(table, filter, patch) {
  const r = await fetch(`${SB}/rest/v1/${table}?${filter}`, {
    method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`patch ${table} ${r.status}: ${await r.text()}`);
}

async function downloadRaw(rawRef) {
  // raw_ref is stored already path-encoded (see fdw-ingest objectPath) — use as-is.
  const r = await fetch(`${SB}/storage/v1/object/fdw-raw/${rawRef}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`storage GET ${r.status}: ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}

async function quarantine(row, reason, payload) {
  await sbInsert('fdw_quarantine', {
    run_id: row.run_id, source: row.source,
    reason: String(reason).slice(0, 500), payload: payload || {},
  });
}
const markProcessed = (id) =>
  sbPatch('fdw_import_staging', `id=eq.${id}`, {
    processed: true, processed_at: new Date().toISOString(), extract_error: null,
  });
const markError = (id, err) =>
  sbPatch('fdw_import_staging', `id=eq.${id}`, {
    extract_error: String(err).slice(0, 500),
  }); // leave processed=false so the next run retries

// Land an EFS statement + its transactions, gated by a tie-out. Returns
// 'processed' or 'quarantined'.
async function handleEfs(row) {
  const buf = await downloadRaw(row.raw_ref);
  const parsed = await parseEfs(buf); // throws -> caller records extract_error + retries

  const sum = parsed.txns.reduce((a, t) => a + (Number(t.amount) || 0), 0);
  if (Math.abs(sum - Number(parsed.totalAmount)) > TIEOUT_TOLERANCE) {
    await quarantine(row, 'efs tie-out failed: statement total != sum of txns', {
      statementId: parsed.statementId, statementTotal: parsed.totalAmount,
      txnSum: Math.round(sum * 100) / 100, txnCount: parsed.txns.length,
      periodStart: parsed.periodStart, periodEnd: parsed.periodEnd,
    });
    return 'quarantined';
  }

  await sbUpsert('fdw_efs_statement', {
    statement_id: parsed.statementId, period_start: parsed.periodStart,
    period_end: parsed.periodEnd, total_amount: parsed.totalAmount,
    total_gallons: parsed.totalGallons, run_id: row.run_id,
  }, 'statement_id');

  // Idempotent re-land: clear any prior rows for this statement first.
  await sbDelete('fdw_fuel_txn', `statement_id=eq.${encodeURIComponent(parsed.statementId)}`);
  if (parsed.txns.length) {
    await sbInsert('fdw_fuel_txn', parsed.txns.map((t) => ({
      statement_id: parsed.statementId, card_no: t.cardNo, txn_date: t.txnDate,
      kind: t.kind, gallons: t.gallons, amount: t.amount, raw_desc: t.rawDesc,
    })));
  }
  return 'processed';
}

// Land an equipment-lessor invoice (truck_*/trailer_*) via the AI parser.
// Returns 'processed' | 'quarantined' | 'skipped'. Penske (and others) email a
// PDF invoice + a tiny CSV index for the SAME invoice — parse only the PDF and
// skip the CSV so the amount isn't counted twice.
async function handleVendor(row) {
  const fn = (row.extracted && row.extracted.filename) || row.raw_ref;
  if (!/\.pdf$/i.test(fn)) return 'skipped'; // CSV/index companion — not the invoice

  const buf = await downloadRaw(row.raw_ref);
  let inv;
  try {
    inv = await parseVendorInvoice(buf, fn, row.source);
  } catch (e) {
    if (e.quarantine) { await quarantine(row, e.message, row.extracted || {}); return 'quarantined'; }
    throw e; // transient (AI/network) — leave unprocessed for retry
  }
  // Honest gate: need a positive total + a date, else quarantine (don't guess).
  if (inv.amount == null || inv.amount <= 0 || !inv.invoiceDate) {
    await quarantine(row, `ai extract incomplete (amount=${inv.amount}, date=${inv.invoiceDate}, conf=${inv.confidence})`, inv._raw);
    return 'quarantined';
  }
  await sbUpsert('fdw_equipment_invoice', {
    source: row.source,
    category: row.source.startsWith('trailer_') ? 'trailer' : (row.source.startsWith('truck_') ? 'truck' : null),
    vendor: inv.vendor, invoice_no: inv.invoiceNo, invoice_date: inv.invoiceDate,
    due_date: inv.dueDate, unit_ids: inv.unitIds, amount: inv.amount,
    service_period_start: inv.servicePeriodStart, service_period_end: inv.servicePeriodEnd,
    confidence: inv.confidence, raw_ref: row.raw_ref, run_id: row.run_id, extracted: inv._raw,
  }, 'raw_ref');
  return 'processed';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET only' }); }
  if (!SB || !KEY || !SECRET) return res.status(500).json({ error: 'server not configured' });
  if (!authorized(req)) return res.status(401).json({ error: 'bad secret' });

  let rows;
  try {
    rows = await sbGet(
      'fdw_import_staging?processed=eq.false&raw_ref=not.is.null' +
      `&select=id,run_id,source,trust,raw_ref,extracted&order=created_at.asc&limit=${BATCH_LIMIT}`
    );
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }

  let processed = 0, quarantined = 0, skipped = 0, errors = 0;
  const detail = [];

  for (const row of rows) {
    try {
      let outcome;
      if (row.source === 'efs_fuel') {
        outcome = await handleEfs(row);
      } else if (row.source.startsWith('truck_') || row.source.startsWith('trailer_')) {
        outcome = await handleVendor(row);
      } else {
        // Unknown source with no parser — quarantine honestly.
        await quarantine(row, `needs parser: ${row.source}`, row.extracted || {});
        outcome = 'quarantined';
      }
      await markProcessed(row.id);
      if (outcome === 'quarantined') quarantined++;
      else if (outcome === 'skipped') skipped++;
      else processed++;
      detail.push({ id: row.id, source: row.source, outcome });
    } catch (e) {
      errors++;
      const msg = String(e && e.message ? e.message : e);
      await markError(row.id, msg).catch(() => {});
      detail.push({ id: row.id, source: row.source, outcome: 'error', error: msg });
    }
  }

  return res.status(200).json({ scanned: rows.length, processed, quarantined, skipped, errors, detail });
}
