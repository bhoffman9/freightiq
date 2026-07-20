// GET /api/ap-budget-suggestions — bank-feed vs Budget Calendar reconciliation.
// Surfaces four high-confidence suggestion buckets so the calendar reflects what
// actually leaves the bank:
//   1. untrackedRecurring — recurring bank debits not on the calendar (add)
//   2. wrongAmount        — tracked bills whose bank amount != calendar estimate (update)
//   3. largeOneOff        — big non-recurring debits not on the calendar (log one-time)
//   4. trackedNoBankHit   — calendar recurring that never cleared the bank (review/remove)
//
// The "tracked" set is CANONICAL: w_custom_recurring + the ~30 bills HARDCODED in
// BudgetCalendar.jsx getExpensesForDay + recent one-time expenses. Matching only
// w_custom_recurring (as the old Cash Flow panel did) would falsely flag hardcoded
// bills (WEX, RENT, payroll, MBFS…) as untracked.
//
// Read-only (GET); one-click apply goes through /api/ap-recurring-save.
// Plaid sign: amount > 0 = money OUT. Gated by the app password (x-ap-key).
import { getSupabase } from './_qbo-helpers.js';
import { requireApAuth } from './_ap-auth.js';

// KEEP IN SYNC with BudgetCalendar.jsx getExpensesForDay hardcoded block + the
// cash-flow.js copy. Amount-0 reminders omitted (not real bills).
const HARDCODED_RECURRING = [
  // monthly-date (day = day of month)
  { name: 'SWGAS', amount: 100.00, recurType: 'monthly-date', day: 4 },
  { name: 'CENTRAL DISPATCH', amount: 199.95, recurType: 'monthly-date', day: 3 },
  { name: 'BOA RANGE ROVER', amount: 2025.49, recurType: 'monthly-date', day: 12 },
  { name: 'MBFS', amount: 1287.92, recurType: 'monthly-date', day: 14 },
  { name: "NELLY'S PAYROLL", amount: 1000.00, recurType: 'monthly-date', day: 15 },
  { name: 'VINIX', amount: 503.05, recurType: 'monthly-date', day: 15 },
  { name: 'LVVWD', amount: 375.00, recurType: 'monthly-date', day: 17 },
  { name: 'ADOBE', amount: 335.86, recurType: 'monthly-date', day: 17 },
  { name: 'IPFS', amount: 3861.45, recurType: 'monthly-date', day: 19 },
  { name: 'ATLUS TOYOTA', amount: 3000.00, recurType: 'monthly-date', day: 19 },
  { name: 'GLG', amount: 1397.00, recurType: 'monthly-date', day: 20 },
  { name: 'REPUBLIC SERVICES', amount: 1667.10, recurType: 'monthly-date', day: 20, quarterly: true },
  { name: 'SAS', amount: 435.00, recurType: 'monthly-date', day: 21 },
  { name: 'DAT SOLUTIONS', amount: 2280.00, recurType: 'monthly-date', day: 25 },
  { name: 'CLONEOPS', amount: 500.00, recurType: 'monthly-date', day: 27 },
  { name: 'ZOOMINFO', amount: 833.33, recurType: 'monthly-date', day: 29 },
  // weekly-day (dow: 0=Sun..6=Sat)
  { name: 'WEX', amount: 4000.00, recurType: 'weekly-day', dow: 2 },
  { name: 'RENT', amount: 5000.00, recurType: 'weekly-day', dow: 2 },
  { name: 'ALEX NAHAI', amount: 500.00, recurType: 'weekly-day', dow: 2 },
  { name: 'UTILITY TRAILER', amount: 2520.00, recurType: 'weekly-day', dow: 3 },
  { name: 'MUDFLAP', amount: 2000.00, recurType: 'weekly-day', dow: 3 },
  { name: 'COLOMBIA PAYROLL', amount: 1850.00, recurType: 'weekly-day', dow: 3 },
  { name: 'MCKINNEY TRAILERS', amount: 2500.00, recurType: 'weekly-day', dow: 3 },
  { name: 'LENDR', amount: 2658.73, recurType: 'weekly-day', dow: 3 },
  { name: 'CHRIS MORTGAGE', amount: 8150.37, recurType: 'weekly-day', dow: 4, biweekly: true },
  { name: 'DRIVER PAYROLL SUBMISSION', amount: 40000.00, recurType: 'weekly-day', dow: 5 },
  { name: 'OFFICE PAYROLL SUBMISSION', amount: 30000.00, recurType: 'weekly-day', dow: 5 },
];

// entity (by account last4) -> default Budget Calendar account label
const ACCT_ENTITY = {
  '3028': 'SF', '0870': 'SF', '7173': 'SF', '1927': 'CE', '7165': 'CE',
  '6053': 'CE EAST', '4842': 'J&A', '0703': 'SF', '1508': 'CE',
};

const num = (v) => Number(v) || 0;
const STOP = /\b(inc|llc|ltd|co|corp|the|of|payment|ach|online|realtime|vendor|pmt|bill|autopay|auto|pay|debit|purchase|des|id|ppd|ccd|web|trans|transfer|llc\.)\b/g;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(STOP, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((t) => t.length >= 4);

// Does a tracked name match a bank merchant string? (distinctive token overlap or substring)
function nameMatch(trackedName, bankMerchant) {
  const tn = norm(trackedName), bm = norm(bankMerchant);
  if (!tn || !bm) return false;
  if (bm.includes(tn) || tn.includes(bm)) return true;
  const tt = tokens(trackedName), bt = new Set(tokens(bankMerchant));
  return tt.some((t) => bt.has(t));
}

function cadence(gap) {
  if (gap == null || !isFinite(gap)) return 'monthly';
  if (gap <= 9) return 'weekly';
  if (gap <= 18) return 'biweekly';
  return 'monthly';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET only' }); }
  if (!requireApAuth(req, res)) return;

  const LARGE_ONEOFF_MIN = 2000;   // $ threshold for "large one-off"
  const ONEOFF_DAYS = 30;
  const NOHIT_DAYS = 45;           // window to expect a weekly/monthly bill to have cleared
  const WRONG_PCT = 0.10, WRONG_MIN = 25; // amount drift must exceed both to flag

  try {
    const sb = getSupabase();
    const sinceOneoff = new Date(Date.now() - ONEOFF_DAYS * 86400000).toISOString().slice(0, 10);
    const sinceNohit = new Date(Date.now() - NOHIT_DAYS * 86400000).toISOString().slice(0, 10);

    const [recQ, custQ, oneQ, txnQ] = await Promise.all([
      sb.from('fdw_v_bank_recurring').select('*'),
      sb.from('w_custom_recurring').select('id,name,amount,account,recur_type,recur_day'),
      sb.from('w_one_time_expenses').select('name,amount,day,month,year'),
      sb.from('fdw_bank_feed_txn').select('id,posted_date,amount,raw_desc,account_last4,pending,category').gte('posted_date', sinceNohit),
    ]);
    for (const q of [recQ, custQ, oneQ, txnQ]) if (q.error) throw new Error(q.error.message);

    const bankRecurring = (recQ.data || []);
    const custom = (custQ.data || []).map((c) => ({ ...c, amount: num(c.amount) }));
    const oneTimes = (oneQ.data || []).map((o) => ({ ...o, amount: num(o.amount) }));
    const txns = (txnQ.data || []).filter((t) => !t.pending && num(t.amount) > 0); // outflows only

    // canonical tracked set (for matching)
    const tracked = [
      ...HARDCODED_RECURRING.map((h) => ({ name: h.name, amount: h.amount, source: 'hardcoded', recurType: h.recurType, day: h.day, dow: h.dow })),
      ...custom.map((c) => ({ name: c.name, amount: c.amount, source: 'custom', id: c.id, recurType: c.recur_type, recurDay: c.recur_day })),
    ];
    const trackedMatch = (merchant) => tracked.find((t) => nameMatch(t.name, merchant));

    // 1 + 2: walk bank recurring, classify as untracked (add) or amount-drift (update)
    const untrackedRecurring = [], wrongAmount = [];
    for (const r of bankRecurring) {
      const merchant = String(r.merchant || '').trim();
      const amt = Math.round(num(r.amount) * 100) / 100;
      // skip internal transfers / payroll wires (not calendar bills)
      if (/\b(WIRE|ZELLE|ONLINE TRANSFER|BOOK TRANSFER)\b/i.test(merchant)) continue;
      const gap = r.n > 1 ? Math.round(num(r.span_days) / (r.n - 1)) : null;
      const cad = cadence(gap);
      const entity = ACCT_ENTITY[r.acct_last4] || 'SF';
      const recurType = cad === 'monthly' ? 'monthly-date' : 'weekly-day';
      const recurDay = recurType === 'weekly-day' ? (Number.isFinite(r.dow) ? (r.dow === 0 ? 7 : r.dow) : 1) : (Number(r.dom) || 1);
      const m = trackedMatch(merchant);
      if (!m) {
        untrackedRecurring.push({
          key: `ur:${r.acct_last4}:${merchant}:${amt}`,
          merchant, amount: amt, cadence: cad, count: r.n,
          lastSeen: r.last_seen, acctLast4: r.acct_last4,
          suggestName: merchant.replace(/\s+/g, ' ').slice(0, 40).toUpperCase(),
          suggestAccount: entity, recurType, recurDay,
        });
      } else {
        const diff = Math.round((amt - m.amount) * 100) / 100;
        if (Math.abs(diff) > WRONG_MIN && Math.abs(diff) / Math.max(1, m.amount) > WRONG_PCT) {
          wrongAmount.push({
            key: `wa:${m.source}:${m.id || m.name}`,
            trackedName: m.name, trackedAmount: m.amount, source: m.source,
            customId: m.source === 'custom' ? m.id : null,
            bankMerchant: merchant, bankAmount: amt, diff,
            lastSeen: r.last_seen, acctLast4: r.acct_last4,
          });
        }
      }
    }

    // 3: large one-offs — big recent debits not in any recurring group and not
    // matching a tracked bill or an existing one-time near that date
    const recurringMerchantNorms = bankRecurring.map((r) => norm(r.merchant));
    const isInRecurringGroup = (desc) => {
      const d = norm(desc);
      return recurringMerchantNorms.some((rm) => rm && (d.includes(rm) || rm.includes(d)));
    };
    const largeOneOff = [];
    for (const t of txns) {
      const amt = Math.round(num(t.amount) * 100) / 100;
      if (amt < LARGE_ONEOFF_MIN) continue;
      if (t.posted_date < sinceOneoff) continue;
      if (isInRecurringGroup(t.raw_desc)) continue;      // it's recurring, handled above
      if (trackedMatch(t.raw_desc)) continue;            // already a tracked bill
      const near = oneTimes.some((o) => nameMatch(o.name, t.raw_desc) && Math.abs(o.amount - amt) < Math.max(1, amt * 0.02));
      if (near) continue;                                // already logged as one-time
      const d = new Date(t.posted_date + 'T00:00:00');
      largeOneOff.push({
        key: `oo:${t.id}`,
        txnId: t.id, date: t.posted_date, amount: amt, desc: t.raw_desc, acctLast4: t.account_last4,
        suggestName: String(t.raw_desc || '').replace(/\s+/g, ' ').slice(0, 40).toUpperCase(),
        suggestAccount: ACCT_ENTITY[t.account_last4] || 'SF',
        day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(), // 1-indexed month for /api/ap-recurring-save
      });
    }
    largeOneOff.sort((a, b) => b.amount - a.amount);

    // 4: tracked recurring with no bank hit in the window (weekly/monthly only —
    // quarterly/biweekly items may legitimately not appear in NOHIT_DAYS)
    const trackedNoBankHit = [];
    const merchantsInWindow = txns.map((t) => t.raw_desc);
    const hasBankHit = (name) => merchantsInWindow.some((desc) => nameMatch(name, desc));
    const nohitCandidates = [
      ...HARDCODED_RECURRING.filter((h) => !h.quarterly && !h.biweekly)
        .map((h) => ({ name: h.name, amount: h.amount, source: 'hardcoded' })),
      ...custom.map((c) => ({ name: c.name, amount: c.amount, source: 'custom', id: c.id })),
    ];
    for (const c of nohitCandidates) {
      if (hasBankHit(c.name)) continue;
      trackedNoBankHit.push({
        key: `nb:${c.source}:${c.id || c.name}`,
        name: c.name, amount: c.amount, source: c.source,
        customId: c.source === 'custom' ? c.id : null,
        removable: c.source === 'custom', // hardcoded items can't be removed via w_custom_recurring
      });
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      untrackedRecurring, wrongAmount, largeOneOff, trackedNoBankHit,
      counts: {
        untrackedRecurring: untrackedRecurring.length,
        wrongAmount: wrongAmount.length,
        largeOneOff: largeOneOff.length,
        trackedNoBankHit: trackedNoBankHit.length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
