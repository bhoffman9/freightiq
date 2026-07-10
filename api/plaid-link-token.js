// POST /api/plaid-link-token — creates a Plaid Link token for the connect page.
// Gated by the app password (body { password }).
import { plaid, plaidConfigured, appPasswordOk } from './_plaid.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  if (!plaidConfigured()) return res.status(500).json({ error: 'PLAID_CLIENT_ID / PLAID_SECRET not set' });
  if (!appPasswordOk(req.body && req.body.password)) return res.status(401).json({ error: 'bad password' });
  try {
    const d = await plaid('/link/token/create', {
      user: { client_user_id: 'freightiq-owner' },
      client_name: 'FreightIQ',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    return res.status(200).json({ link_token: d.link_token });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
