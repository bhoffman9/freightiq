// POST /api/fdw-ingest — receives labeled Gmail messages from the Apps Script
// collector, stages raw attachments + metadata for downstream extraction.
//
// Security: shared-secret header (X-FDW-Secret, constant-time compared) + a
// fixed `source` enum + strict path-segment validation + optional sender
// allowlist. Downstream extraction's tie-out checks are the real trust gate;
// this endpoint just captures raw provenance safely.
//
// Idempotent: fdw_ingestion_run.idempotency_key is UNIQUE and the insert uses
// on_conflict=ignore-duplicates, so it is an ATOMIC gate, not a precheck race.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, FDW_INGEST_SECRET, [FDW_SENDERS]

import crypto from 'node:crypto';

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const SECRET = process.env.FDW_INGEST_SECRET;

// source must be one of these (matches gmail_collector.gs CONFIG.LABELS).
const ALLOWED_SOURCES = new Set([
  'efs_fuel', 'truck_penske', 'truck_ryder', 'truck_tci', 'truck_tec',
  'truck_idealease', 'trailer_mckinney', 'trailer_premier',
  'trailer_ten', 'trailer_utility', 'finance',
]);
const ALLOWED_EXT = new Set(['pdf', 'xls', 'xlsx', 'csv']);

const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 18 * 1024 * 1024;
const MAX_BODY_CHARS = 20000;

const sbHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

function validSecret(v) {
  if (typeof v !== 'string' || typeof SECRET !== 'string') return false;
  const a = Buffer.from(v), b = Buffer.from(SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// strict segment (source, messageId): no separators, no traversal.
function safeSegment(v, name, max = 256) {
  if (typeof v !== 'string') throw new Error(`${name} must be a string`);
  const s = v.trim();
  if (!s || s.length > max || s === '.' || s === '..' || !/^[A-Za-z0-9._-]+$/.test(s))
    throw new Error(`invalid ${name}`);
  return s;
}
// filename: allow spaces/parens/commas (real report names) but strip any path.
function safeFilename(v) {
  if (typeof v !== 'string') throw new Error('invalid filename');
  const base = v.replace(/\\/g, '/').split('/').pop().trim();
  if (!base || base === '.' || base === '..' || base.length > 200) throw new Error('invalid filename');
  const ext = (base.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw new Error('disallowed file type');
  return base;
}
const objectPath = (source, messageId, filename) =>
  [source, messageId, filename].map(encodeURIComponent).join('/');

async function sbInsert(table, row, prefer) {
  const r = await fetch(`${SB}/rest/v1/${table}`, {
    method: 'POST', headers: { ...sbHeaders, Prefer: prefer || 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`insert ${table} ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// Atomic idempotency: ignore-duplicates returns [] when the key already exists.
async function createRun(source, messageId) {
  const r = await fetch(`${SB}/rest/v1/fdw_ingestion_run?on_conflict=idempotency_key`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ source, idempotency_key: messageId, status: 'running' }),
  });
  if (!r.ok) throw new Error(`insert fdw_ingestion_run ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows[0] || null;
}

async function uploadRaw(path, buf, mime) {
  const r = await fetch(`${SB}/storage/v1/object/fdw-raw/${path}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`,
               'Content-Type': mime || 'application/octet-stream', 'x-upsert': 'true' },
    body: buf,
  });
  if (!r.ok) throw new Error(`storage ${r.status}: ${await r.text()}`);
}

async function markRun(runId, patch) {
  await fetch(`${SB}/rest/v1/fdw_ingestion_run?id=eq.${runId}`, {
    method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(patch),
  }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  if (!SB || !KEY || !SECRET) return res.status(500).json({ error: 'server not configured' });
  if (!validSecret(req.headers['x-fdw-secret'])) return res.status(401).json({ error: 'bad secret' });

  const m = req.body || {};
  let source, messageId;
  try {
    source = safeSegment(m.source, 'source', 64);
    if (!ALLOWED_SOURCES.has(source)) throw new Error('unknown source');
    messageId = safeSegment(m.messageId, 'messageId', 256);
  } catch (e) { return res.status(400).json({ error: String(e.message || e) }); }

  const atts = Array.isArray(m.attachments) ? m.attachments : [];
  if (atts.length > MAX_ATTACHMENTS) return res.status(413).json({ error: 'too many attachments' });
  if (m.body && String(m.body).length > MAX_BODY_CHARS) return res.status(413).json({ error: 'body too large' });

  // optional sender allowlist (defense in depth; label gate is client-side)
  const allow = (process.env.FDW_SENDERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.some(a => (m.from || '').toLowerCase().includes(a)))
    return res.status(202).json({ skipped: 'sender not allow-listed', from: m.from });

  let runId = null;
  try {
    const run = await createRun(source, messageId);
    if (!run) return res.status(200).json({ duplicate: true, messageId });   // already ingested
    runId = run.id;

    const staged = [];
    let total = 0;
    for (const a of atts) {
      if (!a || typeof a.dataB64 !== 'string') throw new Error('invalid attachment');
      const filename = safeFilename(a.filename);
      // Supabase Storage keys reject #, ?, spaces, etc. Sanitize the KEY while
      // keeping the true filename in metadata (extracted.filename).
      const storageKey = filename.replace(/[^A-Za-z0-9._-]/g, '_');
      const buf = Buffer.from(a.dataB64, 'base64');
      if (buf.length > MAX_ATTACHMENT_BYTES) throw new Error('attachment too large');
      total += buf.length;
      if (total > MAX_TOTAL_BYTES) throw new Error('attachments too large');
      const path = objectPath(source, messageId, storageKey);
      await uploadRaw(path, buf, a.mimeType);
      await sbInsert('fdw_import_staging', {
        run_id: runId, source, trust: 'high', raw_ref: path,
        extracted: { kind: 'attachment', filename, mimeType: a.mimeType, bytes: buf.length,
                     from: m.from, subject: m.subject, date: m.date },
      }, 'return=minimal');
      staged.push(filename);
    }

    if (m.body) {
      await sbInsert('fdw_import_staging', {
        run_id: runId, source, trust: 'pending_review', raw_ref: null,
        extracted: { kind: 'body', from: m.from, subject: m.subject, date: m.date, text: String(m.body) },
      }, 'return=minimal');
    }

    await markRun(runId, { status: 'success', finished_at: new Date().toISOString(),
                           rows_written: staged.length + (m.body ? 1 : 0) });
    return res.status(200).json({ ok: true, runId, staged, body: !!m.body });
  } catch (e) {
    if (runId) await markRun(runId, { status: 'failed', finished_at: new Date().toISOString(),
                                      failure_reason: String(e.message || e).slice(0, 500) });
    return res.status(500).json({ error: String(e.message || e) });
  }
}
