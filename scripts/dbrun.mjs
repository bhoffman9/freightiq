// dbrun.mjs — run a .sql file (or -c "SQL") against the FDW Supabase warehouse via the
// IPv4 session pooler. Credentials come from env (PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT)
// so nothing secret lives in the repo. Usage:
//   node scripts/dbrun.mjs path/to/file.sql
//   node scripts/dbrun.mjs -c "select 1"
import fs from 'fs';
import pg from 'pg';

// Auto-load gitignored .env.db (PGHOST/PGUSER/PGPASSWORD/…) if present, so runs
// need no inline secrets. Existing process.env wins (explicit overrides file).
try {
  const envPath = new URL('../.env.db', import.meta.url);
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env.db — rely on process.env */ }

const arg = process.argv[2];
if (!arg) { console.error('usage: dbrun.mjs <file.sql | -c "SQL">'); process.exit(1); }
const sql = arg === '-c' ? process.argv[3] : fs.readFileSync(arg, 'utf8');

const c = new pg.Client({
  host: process.env.PGHOST,
  port: +(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false },
});

const t0 = Date.now();
try {
  await c.connect();
  const r = await c.query(sql);
  const results = Array.isArray(r) ? r : [r];
  for (const res of results) {
    if (res.rows && res.rows.length) console.table(res.rows);
    else if (res.command) console.log(`${res.command} ${res.rowCount ?? ''}`.trim());
  }
  console.log(`OK (${Date.now() - t0}ms)`);
  await c.end();
} catch (e) {
  console.error('ERR:', e.message);
  process.exit(2);
}
