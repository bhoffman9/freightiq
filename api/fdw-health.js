// GET /api/fdw-health — ingestion liveness for the dashboard banner.
// collectorStale = the Gmail collector hasn't pinged in >60min (it runs every
// 10min, so 6 missed runs). Distinct from "no new invoices" (fresh heartbeat, sent=0).
import { getSupabase } from './_qbo-helpers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const sb = getSupabase();
    const [h, run] = await Promise.all([
      sb.from('fdw_health').select('last_seen,last_sent,last_fails').eq('id', 1).maybeSingle(),
      sb.from('fdw_ingestion_run').select('started_at').order('started_at', { ascending: false }).limit(1),
    ]);
    const now = Date.now();
    const lastSeenIso = h.data && h.data.last_seen ? h.data.last_seen : null;
    const lastSeen = lastSeenIso ? new Date(lastSeenIso).getTime() : null;
    const minutesSince = lastSeen ? Math.round((now - lastSeen) / 60000) : null;
    const lastIngest = run.data && run.data[0] ? run.data[0].started_at : null;
    const ingestHoursSince = lastIngest ? Math.round((now - new Date(lastIngest).getTime()) / 3600000) : null;
    // Prefer the heartbeat (precise: runs every 10min). Until it's live (collector
    // not yet pinging), fall back to ingestion recency so we don't false-alarm.
    const collectorStale = lastSeen != null
      ? minutesSince > 60
      : (ingestHoursSince == null || ingestHoursSince > 26);
    return res.status(200).json({
      collectorStale, minutesSince, lastSeen: lastSeenIso,
      lastSent: h.data ? h.data.last_sent : null, lastFails: h.data ? h.data.last_fails : null,
      lastIngestAt: lastIngest, ingestHoursSince,
    });
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
}
