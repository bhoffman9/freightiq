// _plaid.js — shared Plaid + Supabase helpers for the bank-feed endpoints.
// Dependency-free (raw fetch). Env: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV
// (sandbox|production, default production), SUPABASE_URL, SUPABASE_SERVICE_KEY,
// VITE_APP_PASSWORD (gates the connect endpoints).

const ENV = process.env.PLAID_ENV || 'production';
const PLAID_BASE = `https://${ENV}.plaid.com`;
const CID = process.env.PLAID_CLIENT_ID;
const SEC = process.env.PLAID_SECRET;

export const plaidConfigured = () => !!(CID && SEC);

export async function plaid(path, body) {
  const r = await fetch(`${PLAID_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CID, secret: SEC, ...body }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`plaid ${path} ${r.status}: ${d.error_code || ''} ${d.error_message || JSON.stringify(d)}`);
  return d;
}

// Gate for the browser-facing connect endpoints: the app password.
export function appPasswordOk(pw) {
  const expected = process.env.VITE_APP_PASSWORD || process.env.FDW_INGEST_SECRET;
  return typeof pw === 'string' && !!expected && pw === expected;
}

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

export async function sb(path, init = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`sb ${path} ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
