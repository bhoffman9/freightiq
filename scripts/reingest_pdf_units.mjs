// Re-extract unit numbers + VINs from the STORED invoice PDFs (the source of
// truth) for every equipment invoice, and write them to invoices.unit_ids /
// vin_ids. The `description` field was often ingested empty or without units
// (XTRA/Premier especially), so the asset registry missed real units. This reads
// the PDF table directly. Line-anchored (unit id followed by an agreement#/PO or
// a VIN) so zips, odometers, dates, amounts don't leak as phantom units.
//
// Run: node scripts/reingest_pdf_units.mjs [--vendor XTRA] [--limit N]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import pg from 'pg';

try { for (const l of fs.readFileSync(new URL('../.env.db', import.meta.url), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/i); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); } } catch {}
const BASE = 'https://freightiq-nine-two.vercel.app';
const KEY = process.env.AP_KEY || 'ShowFreight2026!';
const only = (() => { const i = process.argv.indexOf('--vendor'); return i > 0 ? process.argv[i + 1] : null; })();
const limit = (() => { const i = process.argv.indexOf('--limit'); return i > 0 ? +process.argv[i + 1] : 0; })();

const EQUIP = /tec |penske|idealease|ryder|transportation commodities|tci|mckinney|xtra|premier|utility trailer|mountain west|ten trailer|star leasing|transportation equipment network/i;

const c = new pg.Client({ host: process.env.PGHOST, port: +(process.env.PGPORT||5432), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE||'postgres', ssl: { rejectUnauthorized: false } });

const tmp = path.join(os.tmpdir(), 'reingest_pdf.pdf');
const PY = `import sys,pdfplumber\nt=''\ntry:\n  with pdfplumber.open(sys.argv[1]) as p:\n    for pg in p.pages: t+=(pg.extract_text() or '')+'\\n'\nexcept Exception as e: sys.stderr.write(str(e))\nsys.stdout.write(t)`;

function pdfText(buf) { fs.writeFileSync(tmp, buf); try { return execFileSync('python', ['-c', PY, tmp], { encoding: 'utf8', maxBuffer: 20e6 }); } catch { return ''; } }

// Line-based: a unit id leads the line, and the SAME line carries a VIN or a 6+
// digit serial/agreement (the equipment-row signature). Handles the XTRA table
// ("F10777 151050228 ROAD VAN"), Premier ("P5181425 Van-Plate LG VIN # 1GRAP...")
// and TEC ("104417 ..."). Unit = [A-Z]{0,2} + 4-8 digits (Premier units are 7).
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/g;
const isVin = (t) => /^[A-HJ-NPR-Z0-9]{17}$/.test(t) && /[A-Z]/.test(t) && /\d/.test(t);
function parse(text, invoiceNo) {
  const units = new Set(), vins = new Set();
  for (const line of text.split(/\r?\n/)) {
    const lineVins = [...line.matchAll(VIN_RE)].map(m => m[1].toUpperCase()).filter(isVin);
    lineVins.forEach(v => vins.add(v));
    const lead = line.match(/^\s*([A-Z]{0,2}\d{4,8})\b/);
    if (!lead) continue;
    const u = lead[1].toUpperCase();
    if (isVin(u) || u === String(invoiceNo).toUpperCase()) continue;
    const rest = line.slice(lead[0].length);
    if (lineVins.length || /\d{6,}/.test(rest)) units.add(u);   // equipment-row context
  }
  // also label-anchored anywhere ("Unit # 104417" TEC, "Tractor 438869" Ryder)
  for (const m of text.matchAll(/(?:unit|tractor|truck|vehicle|trailer|equip(?:ment)?)\s*#?\s*([A-Z]{0,2}\d{4,8})\b/gi)) {
    const u = m[1].toUpperCase();
    if (!isVin(u) && u !== String(invoiceNo).toUpperCase()) units.add(u);
  }
  return { units: [...units], vins: [...vins] };
}

const run = async () => {
  await c.connect();
  let q = `select id, vendor_name, invoice_number, pdf_path from invoices where deleted_at is null and pdf_path is not null and pdf_path<>'' order by invoice_date desc`;
  let rows = (await c.query(q)).rows.filter(r => EQUIP.test(r.vendor_name || ''));
  if (only) rows = rows.filter(r => new RegExp(only, 'i').test(r.vendor_name));
  if (limit) rows = rows.slice(0, limit);
  console.log(`re-extracting ${rows.length} equipment PDFs...`);
  const byV = {};
  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      const j = await fetch(`${BASE}/api/ap-pdf?path=${encodeURIComponent(r.pdf_path)}`, { headers: { 'x-ap-key': KEY } }).then(x => x.json());
      if (!j.url) { fail++; continue; }
      const buf = Buffer.from(await fetch(j.url).then(x => x.arrayBuffer()));
      const text = pdfText(buf);
      if (!text || text.length < 30) { fail++; continue; }
      const { units, vins } = parse(text, r.invoice_number);
      await c.query(`update invoices set unit_ids=$1, vin_ids=$2 where id=$3`, [units.join(', ') || null, vins.join(', ') || null, r.id]);
      const v = (r.vendor_name || '').replace(/\s+llc.*/i, '').trim();
      (byV[v] ||= new Set()); units.forEach(u => byV[v].add(u));
      ok++;
      if (units.length) console.log(`  ${r.invoice_number} ${v}: ${units.length} units${vins.length ? ` + ${vins.length} VINs` : ''}`);
    } catch (e) { fail++; }
  }
  console.log(`\ndone: ${ok} parsed, ${fail} failed/empty`);
  console.log('distinct units per vendor:');
  for (const [v, s] of Object.entries(byV).sort((a, b) => b[1].size - a[1].size)) console.log(`  ${v.padEnd(28)} ${s.size}`);
  await c.end();
};
run().catch(e => { console.error('ERR', e.stack || e.message); process.exit(1); });
