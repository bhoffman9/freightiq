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

// Current-month-to-date total miles per truck (no jurisdiction) from the Stats
// gpsDistanceMeters feed. IFTA can't serve the in-progress month, so this keeps
// the TOTAL (and CPM) daily-fresh; the state split for these miles is estimated
// until the month closes. Returns { name -> miles }.
//
// stats/history PAGINATES A VEHICLE'S TIME SERIES across pages, so we track each
// vehicle's earliest- and latest-timestamped cumulative value across ALL pages
// and take the delta (naively using s[0]/s[last] per page double-counts).
export async function pullCurrentMonthMiles(token, startISO, endISO) {
  const veh = {};                                   // name -> {firstT,firstV,lastT,lastV}
  let after = null;
  do {
    const u = new URL(`${BASE}/fleet/vehicles/stats/history`);
    u.searchParams.set('types', 'gpsDistanceMeters');
    u.searchParams.set('startTime', startISO);
    u.searchParams.set('endTime', endISO);
    if (after) u.searchParams.set('after', after);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`stats/history ${r.status}: ${await r.text()}`);
    const d = await r.json();
    for (const v of d.data || []) {
      const name = v.name || v.id;
      if (!name) continue;
      for (const pt of v.gpsDistanceMeters || []) {
        const t = new Date(pt.time).getTime();
        const e = veh[name] ??= { firstT: Infinity, lastT: -Infinity };
        if (t < e.firstT) { e.firstT = t; e.firstV = pt.value; }
        if (t > e.lastT) { e.lastT = t; e.lastV = pt.value; }
      }
    }
    after = d.pagination?.hasNextPage ? d.pagination.endCursor : null;
  } while (after);
  const perTruck = {};
  for (const [name, e] of Object.entries(veh)) {
    const mi = (e.lastV - e.firstV) * M2MI;
    if (mi > 0.1 && mi < 30000) perTruck[name] = mi;  // ignore noise / bad readings
  }
  return perTruck;
}

// IFTA (per-state, completed months) + current-month total overlay, merged.
// Overlay miles get the truck's own NV ratio (or the fleet ratio) for the
// estimated local/regional split; the TOTAL is exact. Tie-out (local+regional
// == miles) holds by construction.
export async function pullMileage(token, year, nowISO) {
  const ifta = await pullIftaYtd(token, year);
  const overlay = await pullCurrentMonthMiles(
    token, overlayStartISO(year, ifta.monthsPulled.length), nowISO);
  const fleetRatio = ifta.fleetTotal > 0 ? ifta.fleetLocal / ifta.fleetTotal : 0;
  const byName = Object.fromEntries(ifta.trucks.map(t => [t.name, t]));

  for (const [name, addMi] of Object.entries(overlay)) {
    const t = byName[name];
    if (t) {
      const ratio = t.miles > 0 ? t.localMi / t.miles : fleetRatio;
      t.miles = Math.round((t.miles + addMi) * 100) / 100;
      t.localMi = Math.round((t.localMi + addMi * ratio) * 100) / 100;
      t.regionalMi = Math.round((t.miles - t.localMi) * 100) / 100;
    } else {
      const localMi = Math.round(addMi * fleetRatio * 100) / 100;
      const miles = Math.round(addMi * 100) / 100;
      byName[name] = { name, miles, localMi, regionalMi: Math.round((miles - localMi) * 100) / 100, states: {} };
    }
  }
  const trucks = Object.values(byName);
  let fleetTotal = 0, fleetLocal = 0;
  for (const t of trucks) { fleetTotal += t.miles; fleetLocal += t.localMi; }
  return {
    monthsPulled: ifta.monthsPulled, overlayThrough: nowISO,
    overlayMiles: Math.round(Object.values(overlay).reduce((a, b) => a + b, 0)),
    trucks,
    fleetTotal: Math.round(fleetTotal * 100) / 100,
    fleetLocal: Math.round(fleetLocal * 100) / 100,
    fleetRegional: Math.round((fleetTotal - fleetLocal) * 100) / 100,
  };
}

// First day (ISO) of the month AFTER the last completed IFTA month, so the
// overlay covers exactly the gap between IFTA and now (robust to any lag).
export function overlayStartISO(year, monthsPulledCount) {
  const mm = String(monthsPulledCount + 1).padStart(2, '0');
  return `${year}-${mm}-01T00:00:00Z`;
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
