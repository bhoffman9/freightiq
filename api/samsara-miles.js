// Fetches vehicle mileage from Samsara IFTA API
// Aggregates all available quarters for the given year
// Query params: ?year=2026 (default current year)
// Returns data in the same format as TRUCK_MILES constant

const SAMSARA_TOKEN = process.env.SAMSARA_API_TOKEN || '';
const METERS_TO_MILES = 1609.344;

async function fetchIFTA(year, quarter) {
  const url = `https://api.samsara.com/fleet/reports/ifta/vehicle?year=${year}&quarter=${quarter}`;
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${SAMSARA_TOKEN}`, 'Accept': 'application/json' },
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json.data?.vehicleReports || json.vehicleReports || [];
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

    // Fetch all quarters in parallel
    const results = await Promise.all(
      activeQuarters.map(q => fetchIFTA(year, q).then(data => ({ quarter: q, data })))
    );

    // Aggregate per-truck, per-state across all quarters
    const trucks = {};
    for (const { quarter, data } of results) {
      if (!data) continue;
      for (const report of data) {
        const name = report.vehicle?.name;
        if (!name) continue;
        if (!trucks[name]) trucks[name] = { states: {} };
        for (const j of (report.jurisdictions || [])) {
          const state = j.jurisdiction;
          const miles = (j.totalMeters || 0) / METERS_TO_MILES;
          trucks[name].states[state] = (trucks[name].states[state] || 0) + miles;
        }
      }
    }

    // Build TRUCK_MILES format
    const truckMiles = [];
    let fleetLocal = 0;
    let fleetRegional = 0;
    let fleetTotal = 0;

    for (const [truck, data] of Object.entries(trucks)) {
      const states = {};
      let local = 0;
      let regional = 0;
      let total = 0;

      for (const [state, miles] of Object.entries(data.states)) {
        const rounded = Math.round(miles * 10) / 10;
        if (rounded === 0) continue;
        states[state] = rounded;
        if (state === 'NV') local += rounded;
        else regional += rounded;
        total += rounded;
      }

      if (total === 0) continue;

      truckMiles.push({
        truck,
        local: Math.round(local * 10) / 10,
        regional: Math.round(regional * 10) / 10,
        miles: Math.round(total * 10) / 10,
        states,
      });

      fleetLocal += local;
      fleetRegional += regional;
      fleetTotal += total;
    }

    // Sort by miles desc
    truckMiles.sort((a, b) => b.miles - a.miles);

    res.json({
      year,
      quarters: activeQuarters,
      quartersLoaded: results.filter(r => r.data && r.data.length > 0).map(r => r.quarter),
      truckCount: truckMiles.length,
      fleetLocal: Math.round(fleetLocal * 10) / 10,
      fleetRegional: Math.round(fleetRegional * 10) / 10,
      fleetTotal: Math.round(fleetTotal * 10) / 10,
      trucks: truckMiles,
    });
  } catch (e) {
    console.error('samsara-miles error:', e);
    res.status(500).json({ error: e.message });
  }
}
