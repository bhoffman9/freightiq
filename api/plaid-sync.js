// GET /api/plaid-sync — pulls transactions (incremental) + balances for every
// connected Plaid Item into fdw_bank_feed_txn + fdw_cash_snapshot. Secret-gated
// (same as the other fdw crons: X-FDW-Secret header, ?secret= query, or
// Authorization: Bearer vs CRON_SECRET). Safe to run daily.
import crypto from 'node:crypto';
import { plaid, plaidConfigured, sb } from './_plaid.js';

const SECRET = process.env.FDW_INGEST_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;

function ctEq(v, s) {
  if (typeof v !== 'string' || typeof s !== 'string' || !s) return false;
  const a = Buffer.from(v), b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function authorized(req) {
  const q = req.query && req.query.secret;
  const qv = Array.isArray(q) ? q[0] : q;
  if (ctEq(qv, SECRET)) return true;
  if (ctEq(req.headers['x-fdw-secret'], SECRET)) return true;
  const bearer = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  return bearer && ctEq(bearer, CRON_SECRET);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET only' }); }
  if (!plaidConfigured()) return res.status(500).json({ error: 'plaid not configured' });
  if (!authorized(req)) return res.status(401).json({ error: 'bad secret' });

  try {
    const items = await sb('fdw_plaid_item?select=item_id,access_token,institution,sync_cursor,accounts');
    let upserted = 0, removed = 0;
    const balances = [];
    const itemErrors = [];

    // Process each item independently — a single dead item (e.g. a leftover
    // sandbox token that now 401s in production) must NOT abort the run or
    // block the balance snapshot for the healthy items.
    for (const it of items) {
      try {
        const accMap = Object.fromEntries((it.accounts || []).map((a) => [a.account_id, a]));

        // incremental transactions/sync
        let cursor = it.sync_cursor || null, hasMore = true;
        const adds = [], dels = [];
        while (hasMore) {
          const d = await plaid('/transactions/sync', { access_token: it.access_token, cursor: cursor || undefined, count: 500 });
          for (const t of [...(d.added || []), ...(d.modified || [])]) adds.push(t);
          for (const t of d.removed || []) dels.push(t.transaction_id);
          cursor = d.next_cursor; hasMore = d.has_more;
        }

        if (adds.length) {
          const rows = adds.map((t) => ({
            plaid_txn_id: t.transaction_id, account_id: t.account_id,
            account_name: accMap[t.account_id]?.name || null, account_last4: accMap[t.account_id]?.mask || null,
            institution: it.institution, posted_date: t.date, amount: t.amount, raw_desc: t.name,
            category: t.personal_finance_category?.primary || (Array.isArray(t.category) ? t.category[0] : null),
            pending: !!t.pending,
          }));
          await sb('fdw_bank_feed_txn?on_conflict=plaid_txn_id', {
            method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
          });
          upserted += rows.length;
        }
        if (dels.length) {
          const inlist = dels.map(encodeURIComponent).join(',');
          await sb(`fdw_bank_feed_txn?plaid_txn_id=in.(${inlist})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
          removed += dels.length;
        }
        await sb(`fdw_plaid_item?item_id=eq.${encodeURIComponent(it.item_id)}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ sync_cursor: cursor, last_sync_at: new Date().toISOString() }),
        });

        const bal = await plaid('/accounts/balance/get', { access_token: it.access_token });
        for (const a of bal.accounts || []) balances.push({
          name: a.name, last4: a.mask, balance: a.balances?.current, available: a.balances?.available,
          type: a.subtype, institution: it.institution,
        });
      } catch (e) {
        itemErrors.push({ item_id: it.item_id, institution: it.institution, error: String(e.message || e) });
      }
    }

    // Only write a snapshot if we actually collected balances — never overwrite
    // a good snapshot with an empty one.
    const today = new Date().toISOString().slice(0, 10);
    if (balances.length) {
      await sb('fdw_cash_snapshot?on_conflict=snapshot_date', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ snapshot_date: today, accounts: balances }),
      });
    }

    return res.status(200).json({ ok: true, items: items.length, txns_upserted: upserted, txns_removed: removed, accounts: balances.length, snapshotWritten: balances.length > 0, itemErrors });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
