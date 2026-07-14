// Shared auth for the browser-facing /api/ap-* routes. Reuses the app password
// (already a Vercel env var) so there's no new secret to manage. The browser
// sends it as the `x-ap-key` header (see the fetch patch in src/App.jsx). This
// is not bank-grade — the password ships in the client bundle — but it closes
// the anonymous-curl hole so a stranger can no longer list/create/delete AP
// financial records or mint invoice-PDF URLs. Fails CLOSED (deny if unset).
import crypto from 'node:crypto';

const KEY = process.env.VITE_APP_PASSWORD || process.env.APP_PASSWORD || '';

function ctEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function apAuthorized(req) {
  if (!KEY) return false;
  const h = req.headers['x-ap-key'];
  const rawq = req.query && req.query.key;
  const q = Array.isArray(rawq) ? rawq[0] : rawq;
  return ctEq(h, KEY) || ctEq(q, KEY);
}

// Returns true if authorized; otherwise writes a 401 and returns false.
export function requireApAuth(req, res) {
  if (apAuthorized(req)) return true;
  res.status(401).json({ error: 'unauthorized' });
  return false;
}
