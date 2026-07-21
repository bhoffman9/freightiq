// Build the complete truck/trailer asset registry from invoices + roster, deduped
// per physical asset (VIN + unit#), confidence-scored, reconciled with the manual
// equipment roster. Writes fdw_asset (registry) and fdw_asset_snapshot (daily
// point-in-time counts + cost). Vendor-aware + label-anchored + exclusion-guarded
// per Codex review. Run: node scripts/build_assets.mjs [--write]
import fs from 'fs';
import pg from 'pg';

try { for (const l of fs.readFileSync(new URL('../.env.db', import.meta.url), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/i); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); } } catch {}
const WRITE = process.argv.includes('--write');
const c = new pg.Client({ host: process.env.PGHOST, port: +(process.env.PGPORT||5432), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE||'postgres', ssl: { rejectUnauthorized: false } });

const VENDOR = [
  [/tec /i, 'TEC', 'truck'], [/penske/i, 'Penske', 'truck'], [/idealease/i, 'Idealease', 'truck'],
  [/ryder/i, 'Ryder', 'truck'], [/transportation commodities|^tci\b/i, 'TCI', 'truck'],
  [/mckinney/i, 'McKinney', 'trailer'], [/xtra/i, 'XTRA', 'trailer'], [/premier/i, 'Premier', 'trailer'],
  [/utility trailer|mountain west/i, 'Utility', 'trailer'], [/ten trailer|star leasing|transportation equipment network/i, 'Ten Trailers', 'trailer'],
];
const vmap = (name) => { for (const [re, canon, cat] of VENDOR) if (re.test(name||'')) return { canon, cat }; return null; };
// roster vendor label -> canonical (roster uses its own spellings)
const rosterCanon = (v) => vmap(v)?.canon || ({ 'Mountain West':'Utility', 'Premier Trailer':'Premier', 'Ten Trailer Leasing':'Ten Trailers', 'XTRA Lease':'XTRA' }[v]) || v;

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;
// unit: optional single letter prefix (Premier "P5181425") + 5-7 digits. 5-digit
// floor drops model/registration years ("2026") and other 4-digit refs — no real
// lessor unit in this fleet is <5 digits.
const UNIT_RE = /\b([A-Z]?\d{5,7})\b/gi;
const UNIT_LABEL = /(?:units?|tractors?|trucks?|vehicles?|trailers?|equip(?:ment)?)\s*#?\s*/gi;
// numbers following these are refs, NOT units — don't anchor on them
const STOP = /·|gmail|\btoll|\btag\b|\bin tag\b|\binvoice\b|\bref\b|\breference\b|\bviolation\b|\bcitation\b|\baccount\b|\bacct\b|\bcheck\b|\bpayment\b|\border\b|\bpo\b|\bbol\b|\bfor\b|\(/i;

function extractFromDesc(desc) {
  if (!desc) return { units: [], vins: [] };
  const s = String(desc);
  const segs = [];
  UNIT_LABEL.lastIndex = 0;
  let m;
  while ((m = UNIT_LABEL.exec(s))) {
    const rest = s.slice(m.index + m[0].length);
    const stop = rest.search(STOP);
    segs.push(stop >= 0 ? rest.slice(0, stop) : rest.slice(0, 40));
  }
  // whole description is itself a bare unit list (digits / letter-prefixed / commas / newlines)
  if (/^[\sP0-9,&./-]{4,80}$/i.test(s) && /\d{4,}/.test(s)) segs.push(s);
  return tokenize(segs.join(' \n '));
}
function tokenize(str) {
  const vins = [...str.matchAll(VIN_RE)].map(x => x[1].toUpperCase());
  const vinset = new Set(vins);
  let cleaned = str; for (const v of vins) cleaned = cleaned.replace(new RegExp(v, 'ig'), ' ');
  const units = [...cleaned.matchAll(UNIT_RE)].map(x => x[1].toUpperCase()).filter(u => !vinset.has(u) && /\d{4}/.test(u));
  return { units: [...new Set(units)], vins: [...new Set(vins)] };
}

const run = async () => {
  await c.connect();
  // ---- roster ----
  const roster = (await c.query(`select id, vendor, vendor_unit, fleet_number, vin, category, monthly_cost, status, make, model, year from equipment`)).rows
    .map(r => ({ ...r, canon: rosterCanon(r.vendor), vin: (r.vin||'').toUpperCase().trim() }));
  const byVin = {}, byUnit = {};
  for (const r of roster) { if (r.vin) byVin[r.vin] = r; if (r.vendor_unit) byUnit[`${r.canon}|${String(r.vendor_unit).toUpperCase()}`] = r; }

  // ---- invoice-derived units ----
  const inv = {}; // vendor|unit -> {vendor,cat,unit,vins:Set,invs,billed,first,last,srcs}
  const addU = (canon, cat, unit, vins, amt, date, src) => {
    const k = `${canon}|${unit}`;
    const a = inv[k] || (inv[k] = { vendor: canon, cat, unit, vins: new Set(), invs: 0, billed: 0, first: date, last: date, srcs: new Set() });
    vins.forEach(v => a.vins.add(v)); a.invs++; a.billed += Number(amt||0);
    if (date && (!a.first || date < a.first)) a.first = date; if (date && (!a.last || date > a.last)) a.last = date; a.srcs.add(src);
  };
  const fdw = (await c.query(`select vendor, category, unit_ids, amount, invoice_date from fdw_equipment_invoice where unit_ids is not null and unit_ids<>''`)).rows;
  for (const r of fdw) { const v = vmap(r.vendor); if (!v) continue; const { units, vins } = tokenize(r.unit_ids); const cat = (r.category==='truck'||r.category==='trailer')?r.category:v.cat; const per = units.length?Number(r.amount||0)/units.length:0; for (const u of units) addU(v.canon, cat, u, vins, per, r.invoice_date, 'fdw'); }
  const invRows = (await c.query(`select vendor_name, description, amount, invoice_date from invoices where deleted_at is null`)).rows;
  const vendorBill = {}; // canon -> total billed (for lump-sum coverage)
  for (const r of invRows) { const v = vmap(r.vendor_name); if (!v) continue; vendorBill[v.canon] = (vendorBill[v.canon]||0) + Number(r.amount||0); const { units, vins } = extractFromDesc(r.description); if (!units.length) continue; const per = Number(r.amount||0)/units.length; for (const u of units) addU(v.canon, v.cat, u, vins, per, r.invoice_date, 'inv'); }

  // VIN-merge invoice units (same VIN = one asset); keep aliases
  const vg = {}; for (const a of Object.values(inv)) for (const v of a.vins) (vg[`${a.vendor}|${v}`] ||= []).push(a);
  for (const g of Object.values(vg)) { if (g.length<2) continue; const keep = g[0]; for (const a of g.slice(1)) { if (a===keep) continue; a.vins.forEach(v=>keep.vins.add(v)); keep.invs+=a.invs; keep.billed+=a.billed; (keep.aliases||=[]).push(a.unit); if(a.first<keep.first)keep.first=a.first; if(a.last>keep.last)keep.last=a.last; delete inv[`${a.vendor}|${a.unit}`]; } }

  // ---- reconcile: match invoice units to roster (VIN > exact unit > vendor suffix) ----
  const assets = new Map(); // key = roster id or inv key
  for (const r of roster) assets.set('R'+r.id, { vendor: r.canon, category: r.category, unit: r.vendor_unit||r.fleet_number, fleet: r.fleet_number, vin: r.vin||null, monthly_cost: +r.monthly_cost||0, status: r.status, make: r.make, model: r.model, year: r.year, in_roster: true, on_invoice: false, billed: 0, invs: 0, last_seen: null, match: 'roster', aliases: [] });
  const matchRoster = (a) => {
    for (const v of a.vins) if (byVin[v]) return byVin[v];
    const ex = byUnit[`${a.vendor}|${a.unit}`]; if (ex) return ex;
    // vendor suffix: invoice 9512685 -> roster fleet 685 (unique within vendor+category)
    const suf = a.unit.replace(/^[A-Z]/,'').slice(-3);
    const cand = roster.filter(r => r.canon===a.vendor && r.category===a.cat && (String(r.fleet_number).slice(-3)===suf || String(r.vendor_unit||'').slice(-3)===suf));
    return cand.length===1 ? cand[0] : null;
  };
  for (const a of Object.values(inv)) {
    const r = matchRoster(a);
    if (r) { const t = assets.get('R'+r.id); const vinArr=[...a.vins]; t.on_invoice = true; t.billed += a.billed; t.invs += a.invs; t.last_seen = a.last; t.match = vinArr.some(v=>byVin[v])?'vin':(byUnit[`${a.vendor}|${a.unit}`]?'exact':'suffix'); if(!t.vin && vinArr.length) t.vin=vinArr[0]; t.aliases.push(a.unit, ...(a.aliases||[])); }
    else { assets.set('I'+a.vendor+a.unit, { vendor:a.vendor, category:a.cat, unit:a.unit, fleet:null, vin:[...a.vins][0]||null, monthly_cost:0, status:'invoice-only', make:null,model:null,year:null, in_roster:false, on_invoice:true, billed:a.billed, invs:a.invs, last_seen:a.last, match:'invoice-only', aliases:a.aliases||[] }); }
  }
  const list = [...assets.values()];

  // ---- lump-sum vendor coverage (XTRA/Premier: invoices with no itemizable units) ----
  const itemizedByVendor = {}; for (const a of list) if (a.on_invoice) itemizedByVendor[a.vendor]=(itemizedByVendor[a.vendor]||0)+1;
  const coverage = Object.entries(vendorBill).map(([v,billed]) => ({ vendor:v, billed:Math.round(billed), itemized: itemizedByVendor[v]||0, roster: roster.filter(r=>r.canon===v).length, unitemized: (itemizedByVendor[v]||0)===0 && billed>0 }));

  // ---- report ----
  const cnt = (cat, f=()=>true) => list.filter(a=>a.category===cat && f(a)).length;
  console.log('\n=== ASSET REGISTRY (roster ∪ invoices) ===');
  const byVn = {}; for (const a of list) { const b=byVn[a.vendor]||(byVn[a.vendor]={truck:0,trailer:0,inv:0,roster:0,invonly:0}); b[a.category]++; if(a.on_invoice)b.inv++; if(a.in_roster)b.roster++; if(!a.in_roster)b.invonly++; }
  for (const [v,b] of Object.entries(byVn).sort()) console.log(`  ${v.padEnd(13)} trucks:${cntV(list,v,'truck')}  trailers:${cntV(list,v,'trailer')}  | roster:${b.roster} on-invoice:${b.inv} invoice-only:${b.invonly}`);
  console.log(`  TOTAL  trucks:${cnt('truck')}  trailers:${cnt('trailer')}  units:${list.length}  (on invoice:${list.filter(a=>a.on_invoice).length}, roster-not-billed:${list.filter(a=>a.in_roster&&!a.on_invoice).length})`);
  console.log('\n=== LUMP-SUM / UNITEMIZED VENDORS ===');
  for (const cv of coverage.filter(x=>x.unitemized)) console.log(`  ${cv.vendor}: $${cv.billed.toLocaleString()} billed, NO unit ids on invoices — represented by ${cv.roster} roster units (can't itemize from invoices)`);
  const idl = list.filter(a=>a.vendor==='Idealease' && a.category==='truck');
  console.log(`\n  calibration — Idealease trucks: ${idl.length} (owner says 7) ${idl.length===7?'✓':'✗'}`);

  fs.writeFileSync(new URL('../scripts/_assets_registry.json', import.meta.url), JSON.stringify({ assets:list, coverage }, null, 1));

  if (WRITE) {
    await c.query(`create table if not exists fdw_asset (
      id text primary key, vendor text, category text, unit text, fleet text, vin text,
      monthly_cost numeric, status text, make text, model text, year text,
      in_roster boolean, on_invoice boolean, billed numeric, invoices int, last_seen date,
      match_confidence text, aliases text, updated_at timestamptz not null default now());`);
    await c.query(`create table if not exists fdw_asset_snapshot (
      snapshot_date date primary key, trucks int, trailers int, total_units int,
      on_invoice int, monthly_cost numeric, total_billed numeric,
      by_vendor jsonb, coverage jsonb, created_at timestamptz not null default now());`);
    // upsert registry
    for (const a of list) {
      const id = a.in_roster ? `${a.vendor}|${a.unit}|R` : `${a.vendor}|${a.unit}|I`;
      await c.query(`insert into fdw_asset (id,vendor,category,unit,fleet,vin,monthly_cost,status,make,model,year,in_roster,on_invoice,billed,invoices,last_seen,match_confidence,aliases,updated_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())
        on conflict (id) do update set vendor=$2,category=$3,unit=$4,fleet=$5,vin=$6,monthly_cost=$7,status=$8,make=$9,model=$10,year=$11,in_roster=$12,on_invoice=$13,billed=$14,invoices=$15,last_seen=$16,match_confidence=$17,aliases=$18,updated_at=now()`,
        [id, a.vendor, a.category, String(a.unit), a.fleet, a.vin, a.monthly_cost, a.status, a.make, a.model, a.year, a.in_roster, a.on_invoice, Math.round(a.billed), a.invs, a.last_seen, a.match, [...new Set(a.aliases)].join(',')]);
    }
    const snap = { trucks: cnt('truck'), trailers: cnt('trailer'), total_units: list.length, on_invoice: list.filter(a=>a.on_invoice).length,
      monthly_cost: Math.round(list.filter(a=>a.status!=='invoice-only').reduce((s,a)=>s+a.monthly_cost,0)),
      total_billed: Math.round(list.reduce((s,a)=>s+a.billed,0)),
      by_vendor: Object.fromEntries(Object.entries(byVn).map(([v,b])=>[v,{trucks:cntV(list,v,'truck'),trailers:cntV(list,v,'trailer')}])), coverage };
    await c.query(`insert into fdw_asset_snapshot (snapshot_date,trucks,trailers,total_units,on_invoice,monthly_cost,total_billed,by_vendor,coverage)
      values (current_date,$1,$2,$3,$4,$5,$6,$7,$8) on conflict (snapshot_date) do update set trucks=$1,trailers=$2,total_units=$3,on_invoice=$4,monthly_cost=$5,total_billed=$6,by_vendor=$7,coverage=$8`,
      [snap.trucks, snap.trailers, snap.total_units, snap.on_invoice, snap.monthly_cost, snap.total_billed, JSON.stringify(snap.by_vendor), JSON.stringify(snap.coverage)]);
    console.log(`\n✓ WROTE fdw_asset (${list.length}) + fdw_asset_snapshot (today): ${snap.trucks} trucks / ${snap.trailers} trailers / $${snap.monthly_cost.toLocaleString()}/mo`);
  } else console.log('\n(dry run — pass --write to materialize)');
  await c.end();
};
function cntV(list,v,cat){ return list.filter(a=>a.vendor===v&&a.category===cat).length; }
run().catch(e => { console.error('ERR', e.stack||e.message); process.exit(1); });
