// Extracts EVERY truck/trailer unit that appears on an equipment invoice, from
// both sources: fdw_equipment_invoice.unit_ids (Gmail-parsed, clean) and
// invoices.description (regex). Normalizes unit# vs VIN, classifies truck/trailer
// by vendor, dedupes, and reports coverage per vendor. Read-only validation pass —
// materializes nothing yet. Loads gitignored .env.db (via dbrun's pattern).
import fs from 'fs';
import pg from 'pg';

try { for (const l of fs.readFileSync(new URL('../.env.db', import.meta.url), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/i); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); } } catch {}

const c = new pg.Client({ host: process.env.PGHOST, port: +(process.env.PGPORT||5432), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE||'postgres', ssl: { rejectUnauthorized: false } });

// vendor alias -> canonical + category (trucks vs trailers)
const VENDOR = [
  [/tec /i, 'TEC', 'truck'], [/penske/i, 'Penske', 'truck'], [/idealease/i, 'Idealease', 'truck'],
  [/ryder/i, 'Ryder', 'truck'], [/transportation commodities|^tci\b/i, 'TCI', 'truck'],
  [/mckinney/i, 'McKinney', 'trailer'], [/xtra/i, 'XTRA', 'trailer'], [/premier/i, 'Premier', 'trailer'],
  [/utility trailer|mountain west/i, 'Utility', 'trailer'], [/ten trailer|star leasing|transportation equipment network/i, 'Ten Trailers', 'trailer'],
];
const vmap = (name) => { for (const [re, canon, cat] of VENDOR) if (re.test(name||'')) return { canon, cat }; return null; };

// A unit token is a 5-7 digit fleet number; a VIN is 17 alphanumerics.
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;
const UNIT_RE = /\b(\d{5,7})\b/g;

// tokensFrom(str, anchored): pull unit#s + VINs.
//  - anchored=false (clean unit_ids lists): take everything.
//  - anchored=true (free-text descriptions): ONLY take units that appear in a
//    "unit(s) <list>" phrase or a pure numeric/VIN comma-list, so invoice #s,
//    dollar amounts, tolls, PO#s in prose don't become phantom trucks.
function tokensFrom(str, anchored) {
  if (!str) return { units: [], vins: [] };
  let s = String(str);
  if (anchored) {
    const segs = [];
    // "[auto] Units 9512674, 3HSD… · …"  or  "UNIT 9513488"
    for (const m of s.matchAll(/units?\s+([0-9A-HJ-NPR-Z,\s]+?)(?:·|$|\bGmail|\btoll|\bfor\b|\.)/gi)) segs.push(m[1]);
    // whole description is itself a short numeric/VIN list ("528020, 560376")
    if (/^[\s]*[0-9A-HJ-NPR-Z][0-9A-HJ-NPR-Z,\s]{3,60}$/.test(s) && /\d/.test(s)) segs.push(s);
    s = segs.join(' ');
    if (!s.trim()) return { units: [], vins: [] };
  }
  const vins = [...s.matchAll(VIN_RE)].map(m => m[1].toUpperCase());
  const vinset = new Set(vins);
  let cleaned = s; for (const v of vins) cleaned = cleaned.replace(new RegExp(v, 'ig'), ' ');
  const units = [...cleaned.matchAll(UNIT_RE)].map(m => m[1]).filter(u => !vinset.has(u));
  return { units: [...new Set(units)], vins: [...new Set(vins)] };
}

const run = async () => {
  await c.connect();
  const assets = {}; // key vendor|unit -> {vendor,cat,unit,vins:Set,invs,billed,first,last,srcs:Set}
  const add = (canon, cat, unit, vins, amt, date, src) => {
    const k = `${canon}|${unit}`;
    const a = assets[k] || (assets[k] = { vendor: canon, cat, unit, vins: new Set(), invs: 0, billed: 0, first: date, last: date, srcs: new Set() });
    vins.forEach(v => a.vins.add(v)); a.invs++; a.billed += Number(amt||0);
    if (date && (!a.first || date < a.first)) a.first = date;
    if (date && (!a.last || date > a.last)) a.last = date;
    a.srcs.add(src);
  };

  // Source 1: fdw_equipment_invoice.unit_ids (clean parsed)
  const fdw = (await c.query(`select vendor, category, unit_ids, amount, invoice_date from fdw_equipment_invoice where unit_ids is not null and unit_ids<>''`)).rows;
  for (const r of fdw) {
    const v = vmap(r.vendor); if (!v) continue;
    const { units, vins } = tokensFrom(r.unit_ids);
    const cat = r.category === 'truck' || r.category === 'trailer' ? r.category : v.cat;
    // amount split across units so vendor billed isn't multi-counted
    const per = units.length ? Number(r.amount||0)/units.length : 0;
    for (const u of units) add(v.canon, cat, u, vins, per, r.invoice_date, 'fdw');
  }

  // Source 2: invoices.description (AP table — the fuller history)
  const inv = (await c.query(`select vendor_name, description, invoice_number, amount, invoice_date from invoices where deleted_at is null`)).rows;
  for (const r of inv) {
    const v = vmap(r.vendor_name); if (!v) continue;
    const { units, vins } = tokensFrom(r.description || '', true); // desc only; invoice_number is never a unit id
    if (!units.length) continue;
    const per = Number(r.amount||0)/units.length;
    for (const u of units) add(v.canon, v.cat, u, vins, per, r.invoice_date, 'inv');
  }

  // ── VIN-merge: two unit#s that share a VIN are the SAME physical asset. Union
  // them (keep the numeric fleet unit, absorb the other). Per Ben — dedupe on
  // unit# AND VIN so a truck referenced both ways counts once.
  const byVin = {};
  for (const a of Object.values(assets)) for (const v of a.vins) (byVin[`${a.vendor}|${v}`] ||= []).push(a);
  for (const group of Object.values(byVin)) {
    if (group.length < 2) continue;
    const keep = group[0];
    for (const a of group.slice(1)) {
      if (a === keep) continue;
      a.vins.forEach(v => keep.vins.add(v)); keep.invs += a.invs; keep.billed += a.billed;
      keep.alsoUnits = (keep.alsoUnits || []); keep.alsoUnits.push(a.unit);
      if (a.first < keep.first) keep.first = a.first; if (a.last > keep.last) keep.last = a.last;
      delete assets[`${a.vendor}|${a.unit}`];
    }
  }

  const list = Object.values(assets).map(a => ({ ...a, vins: [...a.vins], srcs: [...a.srcs] }));

  // diagnostic: dump one vendor's units to calibrate (Idealease should be ~7)
  const dbg = list.filter(a => a.vendor === (process.env.DBGV||"Idealease")).map(a => `${a.unit}${a.vins.length?` [VIN ${a.vins.join('/')}]`:''}${a.alsoUnits?` (+${a.alsoUnits.join(',')})`:''}`);
  console.log('\n=== Idealease units (should match known count) ===\n  ', dbg.join('\n   '));
  // per-vendor coverage
  const byV = {};
  for (const a of list) { const b = byV[a.vendor] || (byV[a.vendor] = { truck: new Set(), trailer: new Set(), billed: 0 }); b[a.cat].add(a.unit); b.billed += a.billed; }
  console.log('\n=== DISTINCT UNITS INGESTED FROM INVOICES (per vendor) ===');
  let tT = 0, tR = 0;
  for (const [v, b] of Object.entries(byV).sort((x,y)=>y[1].billed-x[1].billed)) {
    tT += b.truck.size; tR += b.trailer.size;
    console.log(`  ${v.padEnd(14)} trucks:${String(b.truck.size).padStart(3)}  trailers:${String(b.trailer.size).padStart(3)}  billed:$${Math.round(b.billed).toLocaleString()}`);
  }
  console.log(`  ${'TOTAL'.padEnd(14)} trucks:${String(tT).padStart(3)}  trailers:${String(tR).padStart(3)}  (${list.length} units)`);

  // reconcile vs roster
  const roster = (await c.query(`select vendor, vendor_unit, fleet_number, category, status from equipment`)).rows;
  const rosterUnits = new Set(roster.map(r => `${r.vendor_unit}`).filter(Boolean));
  const invoiceOnly = list.filter(a => !rosterUnits.has(a.unit) && !a.vins.some(v => rosterUnits.has(v)));
  console.log(`\n=== RECONCILE ===`);
  console.log(`  roster units: ${roster.length} | invoice-derived units: ${list.length} | invoice-only (NOT in roster): ${invoiceOnly.length}`);
  console.log(`  invoice-only sample:`, invoiceOnly.slice(0,12).map(a=>`${a.vendor}#${a.unit}`).join(', '));

  fs.writeFileSync(new URL('../scripts/_assets_extract.json', import.meta.url), JSON.stringify(list, null, 1));
  console.log(`\nwrote scripts/_assets_extract.json (${list.length} units)`);
  await c.end();
};
run().catch(e => { console.error('ERR', e.message); process.exit(1); });
