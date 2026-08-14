// /api/bank-morning — PINNED 07:00 America/Los_Angeles bank balance snapshot,
// with day-over-day money in / money out.
//
// WHY THIS EXISTS: plaid-sync runs 3x daily and upserts fdw_cash_snapshot on
// snapshot_date, so that row always ends up holding the LAST sync of the day
// (21:00 UTC = 2 PM PDT). There was no way to read "the balance at 7 AM" — the
// morning value was overwritten by lunchtime. This writes one immutable row per
// day, only from the run that lands at local hour 7.
//
// DST: Vercel crons are UTC and do not shift. 14:00 UTC is 7 AM PDT (Mar-Nov)
// but 6 AM PST (Nov-Mar). So BOTH 14:10 and 15:10 UTC are scheduled and this
// endpoint no-ops unless the America/Los_Angeles hour is actually 7 — exactly
// one of the two fires on any given day, year-round.
//
//   GET /api/bank-morning                -> latest row + recent series
//   GET /api/bank-morning?days=30        -> series
//   GET /api/bank-morning?capture=1      -> cron entry point (hour-gated)
//   GET /api/bank-morning?capture=1&force=1&secret=...  -> capture regardless of hour
//
// Plaid sign convention (verified against real rows): amount > 0 = money OUT,
// amount < 0 = money IN. money_in/money_out are stored as positive magnitudes.

const SUPA = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not configured');
  return async (path, opts = {}) => {
    const r = await fetch(`${url}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json', ...(opts.headers || {}),
      },
    });
    if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r.status === 204 ? null : r.json();
  };
};

// The nine real Chase accounts — MUST mirror ACCT in api/ap-balances.js.
// Anything not in here is not ours, so a transfer touching it is EXTERNAL.
const ACCT = {
  '3028': 'Show Freight Inc', '0870': 'Show Freight TN', '7173': 'SF Savings',
  '1927': 'Capacity Express', '7165': 'CE Savings', '6053': 'CE East',
  '4842': 'J&A Management', '0703': 'Payroll', '1508': 'DockIt LLC',
};
const OWN = new Set(Object.keys(ACCT));

const laParts = (d = new Date()) => {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
  return { date: `${f.year}-${f.month}-${f.day}`, hour: parseInt(f.hour, 10) };
};

// An internal book transfer is a Chase "Online Transfer to/from CHK ...NNNN"
// where NNNN is one of OUR nine accounts. Counting these gross would have
// inflated both sides by ~$96K on 2026-08-13 alone.
const INTERNAL_RE = /online transfer (?:to|from) (?:chk|sav)[^0-9]*(\d{4})/i;
function isInternal(desc) {
  const m = INTERNAL_RE.exec(desc || '');
  return !!(m && OWN.has(m[1]));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sb = SUPA();

    if (!req.query.capture) {
      const days = Math.min(parseInt(req.query.days || '30', 10) || 30, 365);
      const rows = await sb(`fdw_bank_morning?select=*&order=snapshot_date.desc&limit=${days}`);
      return res.json({ count: rows.length, latest: rows[0] || null, series: rows });
    }

    // ---- capture path -----------------------------------------------------
    const { date: today, hour } = laParts();
    const force = req.query.force === '1';
    if (hour !== 7 && !force) {
      return res.json({ skipped: true, reason: `local hour ${hour}, not 7`, localDate: today });
    }
    if (force && req.query.secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'force requires the correct secret' });
    }

    const existing = await sb(`fdw_bank_morning?select=snapshot_date&snapshot_date=eq.${today}`);
    if (existing.length && !force) {
      return res.json({ skipped: true, reason: 'already captured today', snapshot_date: today });
    }

    // Balances: freshest plaid-sync write. Never invent one.
    const cash = await sb('fdw_cash_snapshot?select=snapshot_date,accounts&order=snapshot_date.desc&limit=1');
    if (!cash.length) return res.status(503).json({ error: 'no fdw_cash_snapshot rows yet' });
    const accts = (cash[0].accounts || []).filter(a => OWN.has(String(a.last4)));
    if (!accts.length) return res.status(503).json({ error: 'cash snapshot held no recognised accounts' });

    const prevRows = await sb(`fdw_bank_morning?select=*&snapshot_date=lt.${today}&order=snapshot_date.desc&limit=1`);
    const prev = prevRows[0] || null;
    const prevBy = Object.fromEntries(((prev?.accounts) || []).map(a => [a.last4, Number(a.balance) || 0]));

    const accounts = accts.map(a => {
      const bal = Number(a.balance) || 0;
      const p = prevBy[a.last4];
      return {
        last4: a.last4, label: ACCT[a.last4] || a.name || a.last4,
        balance: +bal.toFixed(2),
        prev: p === undefined ? null : +p.toFixed(2),
        delta: p === undefined ? null : +(bal - p).toFixed(2),
      };
    }).sort((x, y) => y.balance - x.balance);

    const total = +accounts.reduce((s, a) => s + a.balance, 0).toFixed(2);
    const prevTotal = prev ? Number(prev.total) : null;

    // Flows since the previous morning (inclusive of that date forward).
    const since = prev ? prev.snapshot_date : today;
    const txns = await sb(
      `fdw_bank_feed_txn?select=posted_date,account_last4,amount,raw_desc,pending&posted_date=gte.${since}&order=posted_date.asc&limit=5000`
    );
    let inn = 0, out = 0, internal = 0, pendingCount = 0;
    const byAccount = {}, ins = [], outs = [];
    for (const t of txns) {
      if (!OWN.has(String(t.account_last4))) continue;
      const amt = Number(t.amount) || 0;
      if (t.pending) pendingCount++;
      if (isInternal(t.raw_desc)) { internal += Math.abs(amt) / 2; continue; }  // /2: both legs are in the feed
      const b = byAccount[t.account_last4] || (byAccount[t.account_last4] = { last4: t.account_last4, label: ACCT[t.account_last4], in: 0, out: 0 });
      if (amt > 0) { out += amt; b.out += amt; outs.push({ d: t.posted_date, last4: t.account_last4, amount: +amt.toFixed(2), desc: (t.raw_desc || '').slice(0, 70) }); }
      else if (amt < 0) { inn += -amt; b.in += -amt; ins.push({ d: t.posted_date, last4: t.account_last4, amount: +(-amt).toFixed(2), desc: (t.raw_desc || '').slice(0, 70) }); }
    }
    const r2 = (n) => +Number(n).toFixed(2);
    const flows = {
      since,
      byAccount: Object.values(byAccount).map(b => ({ ...b, in: r2(b.in), out: r2(b.out), net: r2(b.in - b.out) })),
      topIn: ins.sort((a, b) => b.amount - a.amount).slice(0, 10),
      topOut: outs.sort((a, b) => b.amount - a.amount).slice(0, 10),
    };

    const row = {
      snapshot_date: today,
      captured_at: new Date().toISOString(),
      local_hour: hour,
      total,
      prev_total: prevTotal,
      delta: prevTotal === null ? null : r2(total - prevTotal),
      money_in: r2(inn), money_out: r2(out), internal_transfers: r2(internal),
      txn_count: txns.length, pending_count: pendingCount,
      balance_age_min: null,
      accounts, flows,
    };

    await sb('fdw_bank_morning?on_conflict=snapshot_date', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([row]),
    });

    return res.json({ captured: true, ...row });
  } catch (e) {
    console.error('bank-morning error:', e);
    return res.status(500).json({ error: e.message });
  }
}
