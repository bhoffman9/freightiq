// Pulls this week's scheduled payments from the budget-calendar app's
// shared Supabase tables (w_* prefix) and shapes them for the FreightIQ
// Cash Flow tab. Also computes the authoritative week-bill total for the
// cash-flow projection, faithfully replicating BudgetCalendar.jsx
// getExpensesForDay: hardcoded recurring + w_custom_recurring + w_one_time,
// NET of w_recurring_overrides (deleted / amount) and w_deleted_items.
// This makes the Cash Flow week-end projection cross-device correct without a
// per-device stash — it reads the same Supabase w_* data on any machine.
//
// Netting scope: `deleted` + `amount` overrides are applied (the cases that
// change the total). Day-MOVES are not relocated — a move only affects the
// total if it crosses the week boundary (rare); ignoring it keeps every
// non-deleted item counted once. Verified to match the calendar banner.

import { getSupabase } from './_qbo-helpers.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

const CAT_MAP = { Lease: 'Truck Lease', Payroll: 'Payroll', Software: 'Software', Settlement: 'Insurance', Other: 'Other' };

function inferCatFromAccount(acct) {
  const a = (acct || '').toUpperCase();
  if (a.includes('CE EAST')) return 'CE East';
  if (a.includes('AUTO')) return 'Truck Lease';
  return 'Other';
}

function weekRange(d) {
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(d.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function recurDayToJsDay(recurDay) { return recurDay === 7 ? 0 : recurDay; }

// HARDCODED recurring bills from getExpensesForDay, returned WITH the exact ids
// the calendar uses (id + `-${day}` suffix) so deletion/override keys line up.
// KEEP IN SYNC with BudgetCalendar.jsx getExpensesForDay. Amount-0 reminders omitted.
function hardcodedItemsForDate(d) {
  const day = d.getDate(), m = d.getMonth(), dow = d.getDay();
  const items = [];
  const add = (id, amt) => items.push({ id: `${id}-${day}`, amount: amt });
  if (day === 4) add('rec-4th-swgas', 100.00);
  if (day === 3) add('rec-3rd-centraldispatch', 199.95);
  if (day === 12) add('rec-12th-boa', 2025.49);
  if (day === 14) add('rec-14th-mbfs', 1287.92);
  if (day === 15) { add('rec-15th-nelly', 1000.00); add('rec-15th-vinix', 503.05); }
  if (day === 17) { add('rec-17th-lvvwd', 375.00); add('rec-17th-adobe', 335.86); }
  if (day === 19) { add('rec-19th-ipfs', 3861.45); add('rec-19th-atlus', 3000.00); }
  if (day === 20) { add('rec-20th-glg', 1397.00); if (m === 0 || m === 3 || m === 6 || m === 9) add('rec-20th-republic', 1667.10); }
  if (day === 21) add('rec-21st-sas', 435.00);
  if (day === 25) add('rec-25th-dat', 2280.00);
  if (day === 27) add('rec-27th-cloneops', 500.00);
  if (day === 29) add('rec-29th-zoominfo', 833.33);
  if (dow === 2) { add('rec-tue-wex', 4000.00); add('rec-tue-rent', 5000.00); add('rec-tue-alex', 500.00); }
  if (dow === 3) { add('rec-wed-trailer', 2520.00); add('rec-wed-mud', 2000.00); add('rec-wed-colombia', 1850.00); add('rec-wed-mckinney', 2500.00); add('rec-wed-lendr', 2658.73); }
  if (dow === 4) { const s = new Date(2026, 1, 12); const diff = Math.floor((d - s) / 86400000); if (diff >= 0 && diff % 14 === 0) add('rec-thu-mortgage', 8150.37); }
  if (dow === 5) { add('rec-fri-driver', 40000.00); add('rec-fri-office', 30000.00); items.push({ id: `rec-fri-${day}`, amount: 4000.00 }); } // WEX id has no name segment
  return items;
}

// The calendar seeds `expenses` with a hardcoded set of default monthly-by-date
// bills (BudgetCalendar.jsx initialExpenses) that are NOT in w_one_time_expenses.
// They show every month on their `day` and are subject to w_recurring_overrides
// (move/amount/delete) + w_deleted_items, exactly like DB one-time rows.
// KEEP IN SYNC with BudgetCalendar.jsx initialExpenses.
const INITIAL_EXPENSES = [
  { id: 'exp-1', name: 'PARKING LOT', amount: 3100.00, day: 10 },
  { id: 'exp-2', name: 'TCI', amount: 4000.00, day: 10 },
  { id: 'exp-3', name: 'ASCEND', amount: 1902.63, day: 12 },
  { id: 'exp-5', name: 'LVWD', amount: 375.00, day: 14 },
  { id: 'exp-7', name: 'STORAGE ON WHEELS', amount: 271.00, day: 14 },
  { id: 'exp-8', name: 'PENSKE', amount: 7500.00, day: 10 },
  { id: 'exp-9', name: 'SYLECTUS', amount: 450.00, day: 15 },
  { id: 'exp-10', name: 'TEC', amount: 37000.00, day: 15 },
  { id: 'exp-11', name: 'WELLS FARGO FORKLIFT', amount: 1228.83, day: 15 },
  { id: 'exp-12', name: '2025 CADILLAC', amount: 2100.00, day: 18 },
  { id: 'exp-13', name: 'COX', amount: 844.69, day: 18 },
  { id: 'exp-14', name: 'DAT', amount: 1480.00, day: 18 },
  { id: 'exp-15', name: 'MANHATTAN LIFE', amount: 1400.00, day: 18 },
  { id: 'exp-16', name: 'VERIZON', amount: 508.30, day: 18 },
  { id: 'exp-17', name: 'NV ENERGY', amount: 1000.00, day: 22 },
  { id: 'exp-19', name: 'GOOGLE ADS', amount: 220.00, day: 1 },
  { id: 'exp-20', name: 'GOOGLE GSUITE', amount: 230.42, day: 1 },
  { id: 'exp-21', name: 'GREEN VALLEY STORAGE', amount: 290.00, day: 1 },
  { id: 'exp-22', name: 'SAMSARA', amount: 1533.88, day: 1 },
  { id: 'exp-23', name: 'UNIFIRST', amount: 900.00, day: 1 },
  { id: 'exp-24', name: 'XTRA', amount: 3000.00, day: 20 },
  { id: 'exp-25', name: 'IFAX', amount: 19.99, day: 21 },
  { id: 'exp-26', name: 'SWGAS - RUBY SKY', amount: 100.00, day: 28 },
  { id: 'exp-27', name: 'SWGAS - MANDALAY', amount: 1200.00, day: 28 },
  { id: 'exp-28', name: 'ASCEND', amount: 1085.00, day: 23 },
  { id: 'exp-29', name: 'NV ENERGY - RUBY SKY', amount: 800.00, day: 20 },
  { id: 'exp-30', name: 'NV ENERGY - MANDALAY', amount: 800.00, day: 20 },
  { id: 'exp-31', name: 'STARLINK', amount: 232.00, day: 23 },
  { id: 'exp-32', name: 'DESCARTES', amount: 570.00, day: 25 },
  { id: 'exp-33', name: 'TEC', amount: 4000.00, day: 25 },
  { id: 'exp-34', name: 'WORKERS COMP - SF', amount: 5000.00, day: 25 },
  { id: 'exp-46', name: 'RYDER TRUCKS', amount: 2500.00, day: 25 },
  { id: 'exp-35', name: 'NIS GENERAL LIABILITY', amount: 427.00, day: 28 },
  { id: 'exp-36', name: 'CARRIER RISK SOLUTIONS', amount: 1000.00, day: 28 },
  { id: 'exp-37', name: 'MOTOROLA', amount: 2199.50, day: 28 },
  { id: 'exp-38', name: 'MCKINNEY', amount: 6000.00, day: 31 },
  { id: 'exp-39', name: 'MYCARRIER PORTAL', amount: 655.00, day: 3 },
  { id: 'exp-40', name: 'PROGRESSIVE', amount: 599.46, day: 4 },
  { id: 'exp-41', name: 'ANTHEM', amount: 4494.97, day: 9 },
  { id: 'exp-42', name: 'CAPITAL GROUP BENEFITS', amount: 1300.00, day: 9 },
  { id: 'exp-44', name: 'SETTLEMENT', amount: 6500.00, day: 1 },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getSupabase();
    const now = req.query.date ? new Date(req.query.date) : new Date();
    const { start, end } = weekRange(now);
    const startMonth = start.getMonth() + 1; // 1-indexed (recurring monthly-date Date math)
    const endMonth   = end.getMonth() + 1;
    const startMonth0 = start.getMonth();     // 0-indexed (w_* DB months)
    const endMonth0   = end.getMonth();
    const startYear  = start.getFullYear();
    const endYear    = end.getFullYear();

    const [recurring, oneTime, checked, categories, deleted, overrides] = await Promise.all([
      supabase.from('w_custom_recurring').select('*'),
      supabase.from('w_one_time_expenses').select('*'),
      supabase.from('w_checked_items').select('*'),
      supabase.from('w_categories').select('*'),
      supabase.from('w_deleted_items').select('item_key'),
      supabase.from('w_recurring_overrides').select('*'),
    ]);
    for (const q of [recurring, oneTime, checked, categories, deleted, overrides]) if (q.error) throw q.error;

    const catByVendor = new Map();
    for (const c of (categories.data || [])) catByVendor.set(c.vendor_key, c.category);

    const paidKeys = new Set();
    for (const c of (checked.data || [])) {
      const matchesStart = c.year === startYear && c.month === startMonth0;
      const matchesEnd   = c.year === endYear   && c.month === endMonth0;
      if (matchesStart || matchesEnd) paidKeys.add(c.item_key);
    }

    // Netting inputs (mirror getExpensesForDay)
    const deletedSet = new Set((deleted.data || []).map((d) => d.item_key));
    const overrideMap = {};
    for (const ov of (overrides.data || [])) overrideMap[ov.original_id] = ov;

    // Apply override (deleted/amount, by full id or base id) + w_deleted_items to
    // a generated item. Returns the netted amount, or null if it's removed.
    const netAmount = (id, baseAmount, y, m0, day) => {
      const baseId = id ? id.replace(/-\d+$/, '') : null;
      const ov = overrideMap[id] || (baseId ? overrideMap[baseId] : null);
      if (ov && ov.deleted) return null;
      if (deletedSet.has(`${y}-${m0}-${day}-${id}`)) return null;
      let amt = baseAmount;
      if (ov && ov.amount !== null && ov.amount !== undefined) amt = parseFloat(ov.amount);
      return amt;
    };

    const payments = [];
    let hardcodedTotal = 0;

    // 1. Hardcoded recurring (netted) — summed for the projection, not listed
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear(), m0 = d.getMonth(), day = d.getDate();
      for (const it of hardcodedItemsForDate(d)) {
        const amt = netAmount(it.id, it.amount, y, m0, day);
        if (amt != null) hardcodedTotal += amt;
      }
    }

    // 2. w_custom_recurring (netted) — listed + summed
    for (const r of (recurring.data || [])) {
      const recurType = r.recur_type, recurDay = r.recur_day;
      let payDate = null;
      if (recurType === 'weekly-day') {
        const jsDay = recurDayToJsDay(recurDay);
        payDate = new Date(start);
        const offset = (jsDay - 1 + 7) % 7; // start is Monday (jsDay 1)
        payDate.setDate(start.getDate() + offset);
      } else if (recurType === 'monthly-date') {
        const candidates = [new Date(startYear, startMonth - 1, recurDay), new Date(endYear, endMonth - 1, recurDay)];
        for (const c of candidates) { if (c >= start && c <= end) { payDate = c; break; } }
      }
      if (!payDate || payDate < start || payDate > end) continue;

      const day = payDate.getDate(), m0 = payDate.getMonth(), y = payDate.getFullYear();
      const id = `custom-${r.id}-${day}`;
      const amt = netAmount(id, Number(r.amount), y, m0, day);
      if (amt == null) continue;

      const slug = slugify(r.name);
      const rawCat = catByVendor.get(slug) || null;
      const cat = rawCat ? (CAT_MAP[rawCat] || rawCat) : inferCatFromAccount(r.account);
      payments.push({ day: `${DAY_LABELS[payDate.getDay()]} ${day}`, vendor: r.name, amount: amt, status: paidKeys.has(r.id) ? 'paid' : 'due', cat, _sort: payDate.getTime() });
    }

    // 3. w_one_time_expenses (netted) — listed + summed. month is 0-indexed.
    // A w_recurring_overrides row can MOVE a one-time to a different day and/or
    // change its amount (the calendar renders it at the override day). So the
    // effective day/amount — not the stored ones — decide week membership.
    for (const o of (oneTime.data || [])) {
      const ov = overrideMap[o.id];
      if (ov && ov.deleted) continue;
      const effDay = (ov && ov.day != null) ? ov.day : o.day;
      const effAmt = (ov && ov.amount != null) ? parseFloat(ov.amount) : Number(o.amount);
      const candidate = new Date(o.year, o.month, effDay);
      if (candidate < start || candidate > end) continue;
      if (deletedSet.has(`${o.year}-${o.month}-${effDay}-${o.id}`)) continue;

      const slug = slugify(o.name);
      const rawCat = catByVendor.get(slug) || null;
      const cat = rawCat ? (CAT_MAP[rawCat] || rawCat) : inferCatFromAccount(o.account);
      const ik = `${o.year}-${o.month}-${effDay}-${o.id}`;
      payments.push({ day: `${DAY_LABELS[candidate.getDay()]} ${effDay}`, vendor: o.name, amount: effAmt, status: paidKeys.has(ik) ? 'paid' : 'due', cat, _sort: candidate.getTime() });
    }

    // 4. initialExpenses — hardcoded monthly-by-date defaults (ids exp-N), netted.
    // Shown every month on their `day`; subject to overrides + deletions.
    for (const ie of INITIAL_EXPENSES) {
      const ov = overrideMap[ie.id];
      if (ov && ov.deleted) continue;
      const effDay = (ov && ov.day != null) ? ov.day : ie.day;
      const effAmt = (ov && ov.amount != null) ? parseFloat(ov.amount) : ie.amount;
      let hit = null;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDate() === effDay) { hit = new Date(d); break; }
      }
      if (!hit) continue;
      const y = hit.getFullYear(), m0 = hit.getMonth();
      if (deletedSet.has(`${y}-${m0}-${effDay}-${ie.id}`)) continue;
      const slug = slugify(ie.name);
      const rawCat = catByVendor.get(slug) || null;
      const cat = rawCat ? (CAT_MAP[rawCat] || rawCat) : 'Other';
      payments.push({ day: `${DAY_LABELS[hit.getDay()]} ${effDay}`, vendor: ie.name, amount: effAmt, status: paidKeys.has(`${y}-${m0}-${effDay}-${ie.id}`) ? 'paid' : 'due', cat, _sort: hit.getTime() });
    }

    payments.sort((a, b) => a._sort - b._sort);
    for (const p of payments) delete p._sort;

    const weekLabel = `Week of ${MONTH_LABELS[start.getMonth()]} ${start.getDate()}, ${startYear}`;
    const recurringBillsTotal = Math.round(hardcodedTotal * 100) / 100;
    const dbTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const scheduledOutflows = Math.round((dbTotal + hardcodedTotal) * 100) / 100;

    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({
      week: weekLabel,
      windowStart: start.toISOString().slice(0, 10),
      windowEnd:   end.toISOString().slice(0, 10),
      payments,
      recurringBillsTotal,   // hardcoded legacy recurring (netted; not in payments list)
      scheduledOutflows,     // full week bills = DB payments + hardcoded, net of deletions/overrides
    });
  } catch (e) {
    console.error('cash-flow error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
}
