// POST /api/plaid-exchange — exchanges a Link public_token for an access_token,
// stores the Item + its accounts in fdw_plaid_item. Gated by the app password.
import { plaid, plaidConfigured, appPasswordOk, sb } from './_plaid.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  if (!plaidConfigured()) return res.status(500).json({ error: 'plaid not configured' });
  const body = req.body || {};
  if (!appPasswordOk(body.password)) return res.status(401).json({ error: 'bad password' });
  if (!body.public_token) return res.status(400).json({ error: 'missing public_token' });
  try {
    const ex = await plaid('/item/public_token/exchange', { public_token: body.public_token });
    const acc = await plaid('/accounts/get', { access_token: ex.access_token });
    const institution = body.institution || acc.item?.institution_id || null;
    const accounts = (acc.accounts || []).map((a) => ({
      account_id: a.account_id, name: a.name, mask: a.mask, type: a.type, subtype: a.subtype,
    }));
    await sb('fdw_plaid_item?on_conflict=item_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ item_id: ex.item_id, access_token: ex.access_token, institution, accounts }),
    });
    return res.status(200).json({ ok: true, item_id: ex.item_id, accounts: accounts.length });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
