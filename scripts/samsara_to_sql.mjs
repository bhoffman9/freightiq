// samsara_to_sql.mjs — pull the latest Samsara IFTA per-vehicle jurisdiction
// mileage and emit an idempotent SQL update for the fdw_ warehouse, so the
// dashboard shows the freshest accurate mileage without waiting on Vercel env.
//
//   SAMSARA_API_TOKEN=xxx node scripts/samsara_to_sql.mjs [period_end]
//   -> supabase/migrations/fdw_samsara_update.sql

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pullIftaYtd } from '../api/_fdw-samsara.js';

const TOKEN = process.env.SAMSARA_API_TOKEN;
if (!TOKEN) { console.error('set SAMSARA_API_TOKEN'); process.exit(1); }
const PE = process.argv[2] || '2026-07-05';           // current warehouse period_end
const YEAR = Number(PE.slice(0, 4));
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations', 'fdw_samsara_update.sql');

const d = await pullIftaYtd(TOKEN, YEAR);
if (!d.trucks.length) { console.error('no IFTA months available'); process.exit(1); }

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const L = [
  `-- fdw_samsara_update.sql — Samsara IFTA per-vehicle jurisdiction mileage`,
  `-- Months: ${d.monthsPulled.join(', ')} | ${d.trucks.length} trucks | period_end ${PE}`,
  `-- Fleet ${Math.round(d.fleetTotal).toLocaleString()} mi (NV/local ${Math.round(d.fleetLocal).toLocaleString()}, regional ${Math.round(d.fleetRegional).toLocaleString()})`,
  `begin;`,
];
for (const t of d.trucks) {
  L.push(`insert into fdw_truck(truck_no) values(${q(t.name)}) on conflict(truck_no) do nothing;`);
  L.push(`insert into fdw_truck_mileage_snapshot(truck_no,period_end,miles,local_mi,regional_mi,states) values(${q(t.name)},${q(PE)},${t.miles},${t.localMi},${t.regionalMi},${q(JSON.stringify(t.states))}::jsonb) on conflict(truck_no,period_end) do update set miles=excluded.miles,local_mi=excluded.local_mi,regional_mi=excluded.regional_mi,states=excluded.states;`);
}
L.push(`update fdw_fleet_metrics set miles=${d.fleetTotal},fleet_local=${d.fleetLocal},fleet_regional=${d.fleetRegional} where entity_id='sf' and period_end=${q(PE)};`);
L.push(`commit;`);
L.push(`-- tie-out: local+regional should equal miles`);
L.push(`-- select miles, fleet_local+fleet_regional as lr from fdw_fleet_metrics where entity_id='sf' and period_end=${q(PE)};`);

writeFileSync(OUT, L.join('\n') + '\n');
console.log(`Wrote ${OUT}`);
console.log(`  ${d.monthsPulled.length} months, ${d.trucks.length} trucks`);
console.log(`  MILES ${Math.round(d.fleetTotal).toLocaleString()} | local ${Math.round(d.fleetLocal).toLocaleString()} | regional ${Math.round(d.fleetRegional).toLocaleString()}`);
