// _fdw-samsara.js — Samsara IFTA per-vehicle jurisdiction pull (shared by the
// fdw-samsara endpoint and the samsara_pull validation script).
//
// The IFTA vehicle report is monthly and only serves COMPLETED months (the API
// refuses the current/in-progress month). We sum every completed month of the
// year into per-truck per-state miles. Refreshed automatically each month close.

const BASE = 'https://api.samsara.com';
const M2MI = 1 / 1609.344;
export const MONTHS = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

async function iftaVehicleMonth(token, year, month) {
  const rows = [];
  let after = null;
  do {
    const u = new URL(`${BASE}/fleet/reports/ifta/vehicle`);
    u.searchParams.set('year', year);
    u.searchParams.set('month', month);
    if (after) u.searchParams.set('after', after);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 400) return null;                    // current/processing month
    if (!r.ok) throw new Error(`ifta ${month} ${r.status}: ${await r.text()}`);
    const d = await r.json();
    rows.push(...(d.data?.vehicleReports || []));
    after = d.pagination?.hasNextPage ? d.pagination.endCursor : null;
  } while (after);
  return rows;
}

// Returns { monthsPulled, trucks: [{name, miles, localMi, regionalMi, states}],
//           fleetTotal, fleetLocal, fleetRegional }.
export async function pullIftaYtd(token, year) {
  const perTruck = {};                                    // name -> { state -> miles }
  const monthsPulled = [];
  for (let m = 0; m < 12; m++) {
    const rows = await iftaVehicleMonth(token, year, MONTHS[m]);
    if (!rows) continue;                                  // month not available yet
    monthsPulled.push(MONTHS[m]);
    for (const vr of rows) {
      const name = vr.vehicle?.name || vr.vehicle?.id;
      if (!name) continue;
      perTruck[name] ??= {};
      for (const j of vr.jurisdictions || []) {
        perTruck[name][j.jurisdiction] =
          (perTruck[name][j.jurisdiction] || 0) + (j.totalMeters || 0) * M2MI;
      }
    }
  }
  let fleetTotal = 0, fleetLocal = 0;
  const trucks = Object.entries(perTruck).map(([name, states]) => {
    const rounded = {};
    let total = 0;
    for (const [s, mi] of Object.entries(states)) { rounded[s] = Math.round(mi * 100) / 100; total += mi; }
    const localMi = rounded.NV || 0;                      // NV = local, everything else regional
    fleetTotal += total; fleetLocal += localMi;
    return { name: String(name), miles: Math.round(total * 100) / 100,
             localMi, regionalMi: Math.round((total - localMi) * 100) / 100, states: rounded };
  });
  return {
    monthsPulled, trucks,
    fleetTotal: Math.round(fleetTotal * 100) / 100,
    fleetLocal: Math.round(fleetLocal * 100) / 100,
    fleetRegional: Math.round((fleetTotal - fleetLocal) * 100) / 100,
  };
}
