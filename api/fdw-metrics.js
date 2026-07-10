// GET /api/fdw-metrics — current-period fleet numbers from the fdw_ warehouse,
// shaped for App.jsx runtime hydration. Public read (same sensitivity as the
// already-public metrics.json). Reads via service key server-side; returns only
// current-period aggregates.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function sb(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path} -> ${r.status}: ${await r.text()}`);
  return r.json();
}

export default async function handler(req, res) {
  if (!SB || !KEY) return res.status(500).json({ error: 'server not configured' });
  try {
    const per = (await sb('fdw_v_current_period?select=period_end,label'))[0];
    if (!per) return res.status(200).json({ ok: false, reason: 'no period loaded' });
    const pe = per.period_end;

    const fleet = (await sb(
      `fdw_fleet_metrics?entity_id=eq.sf&period_end=eq.${pe}&select=*`
    ))[0] || null;

    const payRows = await sb(
      `fdw_payroll_snapshot?period_end=eq.${pe}&select=hours,total_cost,active,fdw_driver(name)`
    );
    const payroll = payRows
      .filter(p => p.fdw_driver)
      .map(p => ({ name: p.fdw_driver.name, hours: Number(p.hours),
                   totalCost: Number(p.total_cost), active: p.active }));

    // FUEL map: per-driver sum of fuel txns up to the period end.
    const fuelRows = await sb(
      `fdw_fuel_txn?kind=eq.fuel&txn_date=lte.${pe}&select=amount,gallons,fdw_driver(name)`
    );
    const fuel = {};
    for (const t of fuelRows) {
      if (!t.fdw_driver) continue;
      const n = t.fdw_driver.name;
      if (!fuel[n]) fuel[n] = { fuel: 0, gallons: 0 };
      fuel[n].fuel += Number(t.amount) || 0;
      fuel[n].gallons += Number(t.gallons) || 0;
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      ok: true,
      period: { end: pe, label: per.label },
      fleet: fleet && {
        labor: num(fleet.labor), fuel_tot: num(fleet.fuel_tot), gallons: num(fleet.gallons),
        miles: num(fleet.miles), fleet_local: num(fleet.fleet_local),
        fleet_regional: num(fleet.fleet_regional), truck_count: fleet.truck_count,
        total_hrs: num(fleet.total_hrs), ins_tot: num(fleet.ins_tot),
        truck_tot: num(fleet.truck_tot), trailer_tot: num(fleet.trailer_tot),
        truck_maint: num(fleet.truck_maint), trail_maint: num(fleet.trail_maint),
        storage: num(fleet.storage), uniforms: num(fleet.uniforms),
      },
      payroll, fuel,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}

const num = v => (v === null || v === undefined ? null : Number(v));
