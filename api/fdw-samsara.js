// GET /api/fdw-samsara — pulls per-vehicle IFTA jurisdiction mileage from Samsara
// and writes it into the fdw_ warehouse (per-truck per-state + fleet local/regional
// totals). Daily cron; the underlying IFTA data refreshes each month close.
//
// Auth: same shared-secret pattern as fdw-extract (X-FDW-Secret header,
// ?secret= query for cron, or Authorization: Bearer vs CRON_SECRET).
//
// Does NOT touch truck_count (that's the active-fleet count, distinct from the
// 49 trucks that log mileage). Only writes miles / local / regional / per-truck.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, FDW_INGEST_SECRET, SAMSARA_API_TOKEN, [CRON_SECRET]

import crypto from 'node:crypto';
import { pullIftaYtd } from './_fdw-samsara.js';

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const SECRET = process.env.FDW_INGEST_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;
const SAMSARA = process.env.SAMSARA_API_TOKEN;

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

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
  return bearer && ctEq(bearer, CRON_SECRET);
}

async function sb(path, init) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H, ...init });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET only' }); }
  if (!SB || !KEY || !SECRET) return res.status(500).json({ error: 'server not configured' });
  if (!SAMSARA) return res.status(500).json({ error: 'SAMSARA_API_TOKEN not set' });
  if (!authorized(req)) return res.status(401).json({ error: 'bad secret' });

  try {
    const per = (await sb('fdw_v_current_period?select=period_end'))[0];
    if (!per) return res.status(200).json({ ok: false, reason: 'no period loaded' });
    const pe = per.period_end;
    const year = Number(pe.slice(0, 4));

    const data = await pullIftaYtd(SAMSARA, year);
    if (!data.monthsPulled.length) return res.status(200).json({ ok: false, reason: 'no IFTA months available yet' });

    // Upsert trucks + per-truck mileage snapshots for the current period.
    for (const t of data.trucks) {
      await sb('fdw_truck?on_conflict=truck_no', {
        method: 'POST',
        headers: { ...H, Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ truck_no: t.name }),
      });
      await sb('fdw_truck_mileage_snapshot?on_conflict=truck_no,period_end', {
        method: 'POST',
        headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          truck_no: t.name, period_end: pe, miles: t.miles,
          local_mi: t.localMi, regional_mi: t.regionalMi, states: t.states,
        }),
      });
    }

    // Roll fleet totals into fdw_fleet_metrics (miles/local/regional only —
    // NOT truck_count, which stays the active-fleet count).
    await sb(`fdw_fleet_metrics?entity_id=eq.sf&period_end=eq.${pe}`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({
        miles: data.fleetTotal, fleet_local: data.fleetLocal, fleet_regional: data.fleetRegional,
      }),
    });

    return res.status(200).json({
      ok: true, period_end: pe, monthsPulled: data.monthsPulled, trucks: data.trucks.length,
      fleetTotal: data.fleetTotal, fleetLocal: data.fleetLocal, fleetRegional: data.fleetRegional,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
