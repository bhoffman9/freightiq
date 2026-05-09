// Fetches vehicle mileage from Samsara IFTA API for finalized quarters,
// and from /fleet/vehicles/stats/history (gpsOdometerMeters) for the
// in-progress quarter (IFTA only finalizes at quarter end).
//
// Query params: ?year=2026 (default current year)
// Returns data in the same format as TRUCK_MILES constant, with
// `inProgressQuarter` field flagging that the current quarter's miles
// are odometer-derived (no per-state breakdown until IFTA closes).

const SAMSARA_TOKEN = process.env.SAMSARA_API_TOKEN || '';
const METERS_TO_MILES = 1609.344;
const SAMSARA_BASE = 'https://api.samsara.com';

const authHeaders = {
  'Authorization': `Bearer ${SAMSARA_TOKEN}`,
  'Accept': 'application/json',
};

async function fetchIFTA(year, quarter) {
  const url = `${SAMSARA_BASE}/fleet/reports/ifta/vehicle?year=${year}&quarter=${quarter}`;
  const resp = await fetch(url, { headers: authHeaders });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json.data?.vehicleReports || json.vehicleReports || [];
}

// Quarter -> [startISO, endISO] for the given year
function quarterRange(year, quarter) {
  const ranges = {
    Q1: [`${year}-01-01T00:00:00Z`, `${year}-03-31T23:59:59Z`],
    Q2: [`${year}-04-01T00:00:00Z`, `${year}-06-30T23:59:59Z`],
    Q3: [`${year}-07-01T00:00:00Z`, `${year}-09-30T23:59:59Z`],
    Q4: [`${year}-10-01T00:00:00Z`, `${year}-12-31T23:59:59Z`],
  };
  return ranges[quarter];
}

// Pull odometer samples for the date range. Samsara exposes two types:
// obdOdometerMeters (only on vehicles with OBD coverage) and
// gpsOdometerMeters (everywhere, but requires manual baseline). We request
// both, paginate, then per-vehicle prefer OBD where available and fall back
// to GPS. Odometer is monotonically increasing so delta = max - min in window.
async function fetchOdometerDelta(startTime, endTime) {
  const perVehicle = {}; // name -> { obd:{min,max}, gps:{min,max} }
  let cursor = null;
  let pages = 0;

  do {
    const url = new URL(`${SAMSARA_BASE}/fleet/vehicles/stats/history`);
    url.searchParams.set('startTime', startTime);
    url.searchParams.set('endTime', endTime);
    url.searchParams.set('types', 'obdOdometerMeters,gpsOdometerMeters');
    if (cursor) url.searchParams.set('after', cursor);

    const resp = await fetch(url, { headers: authHeaders });
    if (!resp.ok) {
      console.error('odometer history non-OK:', resp.status, await resp.text().catch(() => ''));
      return null;
    }
    const json = await resp.json();

    for (const v of (json.data || [])) {
      const name = v.name || v.vehicle?.name;
      if (!name) continue;
      if (!perVehicle[name]) perVehicle[name] = {
        obd: { min: Infinity, max: -Infinity },
        gps: { min: Infinity, max: -Infinity },
      };
      for (const [key, target] of [['obdOdometerMeters', 'obd'], ['gpsOdometerMeters', 'gps']]) {
        const samples = v[key] || [];
        for (const s of samples) {
          const m = s.value;
          if (typeof m !== 'number') continue;
          if (m < perVehicle[name][target].min) perVehicle[name][target].min = m;
          if (m > perVehicle[name][target].max) perVehicle[name][target].max = m;
        }
      }
    }

    cursor = json.pagination?.endCursor || null;
    pages++;
    if (pages > 30) break;
  } while (cursor);

  // Per-vehicle delta. Prefer OBD; fall back to GPS.
  const result = {};
  for (const [name, { obd, gps }] of Object.entries(perVehicle)) {
    let delta = null;
    let source = null;
    if (obd.min !== Infinity && obd.max !== -Infinity && obd.max > obd.min) {
      delta = obd.max - obd.min;
      source = 'obd';
    } else if (gps.min !== Infinity && gps.max !== -Infinity && gps.max > gps.min) {
      delta = gps.max - gps.min;
      source = 'gps';
    }
    if (delta != null) result[name] = { miles: delta / METERS_TO_MILES, source };
  }
  return result;
}

function currentQuarter() {
  const m = new Date().getMonth();
  if (m < 3) return 'Q1';
  if (m < 6) return 'Q2';
  if (m < 9) return 'Q3';
  return 'Q4';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const cq = currentQuarter();
    const activeQuarters = quarters.slice(0, quarters.indexOf(cq) + 1);
    const finalizedQuarters = activeQuarters.slice(0, -1); // all but the in-progress one

    // Fetch finalized IFTA quarters in parallel
    const iftaResults = await Promise.all(
      finalizedQuarters.map(q => fetchIFTA(year, q).then(data => ({ quarter: q, data })))
    );

    // Aggregate IFTA: per-truck per-state
    const trucks = {};
    for (const { data } of iftaResults) {
      if (!data) continue;
      for (const report of data) {
        const name = report.vehicle?.name;
        if (!name) continue;
        if (!trucks[name]) trucks[name] = { states: {}, iftaMiles: 0 };
        for (const j of (report.jurisdictions || [])) {
          const state = j.jurisdiction;
          const miles = (j.totalMeters || 0) / METERS_TO_MILES;
          trucks[name].states[state] = (trucks[name].states[state] || 0) + miles;
          trucks[name].iftaMiles += miles;
        }
      }
    }

    // Fetch in-progress quarter via odometer delta
    let inProgressMiles = null;
    let inProgressError = null;
    const [iqStart, iqEndDef] = quarterRange(year, cq) || [];
    const nowIso = new Date().toISOString();
    // Cap endTime to 'now' if quarter end is in the future
    const iqEnd = (iqEndDef && new Date(iqEndDef) > new Date()) ? nowIso : iqEndDef;
    if (iqStart && iqEnd) {
      try {
        inProgressMiles = await fetchOdometerDelta(iqStart, iqEnd);
      } catch (e) {
        inProgressError = e.message;
      }
    }

    // Merge in-progress miles into trucks. State breakdown stays IFTA-only.
    // Local/regional apportioned by IFTA ratio when available; default to
    // 30%/70% for trucks with no IFTA history.
    let obdCount = 0;
    let gpsCount = 0;
    if (inProgressMiles) {
      for (const [name, { miles, source }] of Object.entries(inProgressMiles)) {
        if (!trucks[name]) trucks[name] = { states: {}, iftaMiles: 0 };
        trucks[name].inProgressMiles = miles;
        trucks[name].inProgressSource = source;
        if (source === 'obd') obdCount++;
        else if (source === 'gps') gpsCount++;
      }
    }

    // Build TRUCK_MILES-shaped response
    const truckMiles = [];
    let fleetLocal = 0;
    let fleetRegional = 0;
    let fleetTotal = 0;
    let fleetInProgress = 0;

    for (const [truck, data] of Object.entries(trucks)) {
      const states = {};
      let iftaLocal = 0;
      let iftaRegional = 0;

      for (const [state, miles] of Object.entries(data.states)) {
        const rounded = Math.round(miles * 10) / 10;
        if (rounded === 0) continue;
        states[state] = rounded;
        if (state === 'NV') iftaLocal += rounded;
        else iftaRegional += rounded;
      }

      const iftaTotal = iftaLocal + iftaRegional;
      const ipMiles = data.inProgressMiles || 0;
      const localRatio = iftaTotal > 0 ? iftaLocal / iftaTotal : 0.30;
      const ipLocal = ipMiles * localRatio;
      const ipRegional = ipMiles - ipLocal;

      const local = Math.round((iftaLocal + ipLocal) * 10) / 10;
      const regional = Math.round((iftaRegional + ipRegional) * 10) / 10;
      const total = Math.round((iftaTotal + ipMiles) * 10) / 10;

      if (total === 0) continue;

      truckMiles.push({
        truck,
        local,
        regional,
        miles: total,
        iftaMiles: Math.round(iftaTotal * 10) / 10,
        inProgressMiles: Math.round(ipMiles * 10) / 10,
        inProgressSource: data.inProgressSource || null,
        states,
      });

      fleetLocal += local;
      fleetRegional += regional;
      fleetTotal += total;
      fleetInProgress += ipMiles;
    }

    truckMiles.sort((a, b) => b.miles - a.miles);

    res.json({
      year,
      quarters: activeQuarters,
      quartersLoaded: iftaResults.filter(r => r.data && r.data.length > 0).map(r => r.quarter),
      inProgressQuarter: cq,
      inProgressSource: inProgressMiles ? `obd:${obdCount} + gps:${gpsCount}` : null,
      inProgressError,
      truckCount: truckMiles.length,
      fleetLocal: Math.round(fleetLocal * 10) / 10,
      fleetRegional: Math.round(fleetRegional * 10) / 10,
      fleetTotal: Math.round(fleetTotal * 10) / 10,
      fleetInProgress: Math.round(fleetInProgress * 10) / 10,
      trucks: truckMiles,
    });
  } catch (e) {
    console.error('samsara-miles error:', e);
    res.status(500).json({ error: e.message });
  }
}
