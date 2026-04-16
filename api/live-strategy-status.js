import { getLiveStatus } from './strategy-live-engine.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const status = getLiveStatus(req.query || {});
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json(status);
}
