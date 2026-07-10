// samsara_pull.mjs — validate the Samsara IFTA per-vehicle jurisdiction pull
// (uses the SAME helper the fdw-samsara endpoint uses) before/after wiring.
//
//   SAMSARA_API_TOKEN=xxx node scripts/samsara_pull.mjs [year]

import { pullIftaYtd } from '../api/_fdw-samsara.js';

const TOKEN = process.env.SAMSARA_API_TOKEN;
if (!TOKEN) { console.error('set SAMSARA_API_TOKEN'); process.exit(1); }
const year = Number(process.argv[2]) || 2026;

const d = await pullIftaYtd(TOKEN, year);
console.log(`\nMonths pulled: ${d.monthsPulled.join(', ') || '(none available)'}`);
console.log(`Trucks with mileage: ${d.trucks.length}`);
console.log(`\nFLEET TOTAL:  ${Math.round(d.fleetTotal).toLocaleString()} mi`);
console.log(`  NV (local): ${Math.round(d.fleetLocal).toLocaleString()} mi (${(100*d.fleetLocal/d.fleetTotal).toFixed(1)}%)`);
console.log(`  regional:   ${Math.round(d.fleetRegional).toLocaleString()} mi`);
console.log(`\nvs dashboard (Jan 1 - Jun 27): MILES 737,887 | local 140,141 | regional 597,746\n`);
for (const t of [...d.trucks].sort((a,b)=>b.miles-a.miles).slice(0, 8)) {
  const top = Object.entries(t.states).sort((a,b)=>b[1]-a[1]).slice(0,4)
    .map(([s,mi]) => `${s}:${Math.round(mi)}`).join(' ');
  console.log(`  ${t.name.padEnd(6)} ${String(Math.round(t.miles)).padStart(7)} mi  [${top}]`);
}
