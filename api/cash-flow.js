// Pulls this week's scheduled payments from the budget-calendar app's
// shared Supabase tables (w_* prefix) and shapes them for the FreightIQ
// Cash Flow tab. Replaces the old GitHub raw fetch of current-week.json
// (which fell out of practice).
//
// Returns { week, payments }. Bank account balances are NOT tracked in
// the calendar tables, so we leave `accounts` undefined and the UI falls
// back to its hardcoded CASH_SNAPSHOTS for that side.

import { getSupabase } from './_qbo-helpers.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Slugify vendor name the same way the budget-calendar app does so we can
// look up the w_categories entry.
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Map calendar categories to FreightIQ Cash Flow display categories.
// Falls back to the original label when no mapping exists.
const CAT_MAP = {
  Lease: 'Truck Lease',
  Payroll: 'Payroll',
  Software: 'Software',
  Settlement: 'Insurance',
  Other: 'Other',
};

// Convert calendar account labels to the Cash Flow tab's category buckets
// for color-coding. (Used as a fallback when no w_categories row exists.)
function inferCatFromAccount(acct) {
  const a = (acct || '').toUpperCase();
  if (a.includes('CE EAST')) return 'CE East';
  if (a.includes('AUTO')) return 'Truck Lease';
  return 'Other';
}

// Monday-anchored week start for a given JS Date.
function weekRange(d) {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(d.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

// recur_day for "weekly-day" — the calendar uses 1=Mon..7=Sun.
// Convert to JS getDay convention (0=Sun..6=Sat).
function recurDayToJsDay(recurDay) {
  return recurDay === 7 ? 0 : recurDay;
}

// The Budget Calendar (BudgetCalendar.jsx getExpensesForDay) adds a block of
// HARDCODED recurring bills that do NOT live in the w_* tables (legacy defaults:
// payroll submissions, WEX, rent, leases, mortgage, etc.). They're treated as a
// separate additive set from w_custom_recurring (no overlap), so we can sum them
// here for the week-end cash projection without double-counting the DB rows.
// KEEP IN SYNC with getExpensesForDay's hardcoded block. Overrides/deletions of
// these items are NOT applied server-side (the calendar banner is authoritative
// for exactness) — any over-count only makes the projection floor more conservative.
function hardcodedRecurringForDate(d) {
  const day = d.getDate();
  const m = d.getMonth();      // 0-indexed
  const dow = d.getDay();      // 0=Sun..6=Sat
  let sum = 0;
  // day-of-month items
  if (day === 4) sum += 100.00;        // SWGAS - OFFICE
  if (day === 3) sum += 199.95;        // CENTRAL DISPATCH
  if (day === 12) sum += 2025.49;      // BOA RANGE ROVER
  if (day === 14) sum += 1287.92;      // MBFS
  if (day === 15) sum += 1000.00 + 503.05; // NELLY'S PAYROLL + VINIX
  if (day === 17) sum += 375.00 + 335.86;  // LVVWD + ADOBE
  if (day === 19) sum += 3861.45 + 3000.00; // IPFS + ATLUS TOYOTA
  if (day === 20) { sum += 1397.00; if (m === 0 || m === 3 || m === 6 || m === 9) sum += 1667.10; } // GLG (+ REPUBLIC quarterly)
  if (day === 21) sum += 435.00;       // SAS
  if (day === 25) sum += 2280.00;      // DAT SOLUTIONS
  if (day === 27) sum += 500.00;       // CLONEOPS
  if (day === 29) sum += 833.33;       // ZOOMINFO
  // day-of-week items
  if (dow === 2) sum += 4000.00 + 5000.00 + 500.00; // WEX + RENT + ALEX NAHAI
  if (dow === 3) sum += 2520.00 + 2000.00 + 1850.00 + 2500.00 + 2658.73; // UTILITY TRAILER + MUDFLAP + COLOMBIA + MCKINNEY + LENDR
  if (dow === 4) { // CHRIS MORTGAGE — biweekly from 2026-02-12
    const start = new Date(2026, 1, 12);
    const diff = Math.floor((d - start) / 86400000);
    if (diff >= 0 && diff % 14 === 0) sum += 8150.37;
  }
  if (dow === 5) sum += 40000.00 + 30000.00 + 4000.00; // DRIVER PAYROLL + OFFICE PAYROLL + WEX
  return sum;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getSupabase();
    const now = req.query.date ? new Date(req.query.date) : new Date();
    const { start, end } = weekRange(now);
    const startMonth = start.getMonth() + 1; // 1-indexed (for recurring monthly-date Date math below)
    const endMonth   = end.getMonth() + 1;
    // The calendar stores w_* month values 0-INDEXED (0=Jan..11=Dec) — see
    // BudgetCalendar.jsx (oneTimeMonth: currentMonth). Use these for DB matches.
    const startMonth0 = start.getMonth();
    const endMonth0   = end.getMonth();
    const startYear  = start.getFullYear();
    const endYear    = end.getFullYear();

    // Parallel fetches
    const [recurring, oneTime, checked, categories] = await Promise.all([
      supabase.from('w_custom_recurring').select('*'),
      supabase.from('w_one_time_expenses').select('*'),
      supabase.from('w_checked_items').select('*'),
      supabase.from('w_categories').select('*'),
    ]);

    if (recurring.error) throw recurring.error;
    if (oneTime.error)   throw oneTime.error;
    if (checked.error)   throw checked.error;
    if (categories.error) throw categories.error;

    const catByVendor = new Map();
    for (const c of (categories.data || [])) catByVendor.set(c.vendor_key, c.category);

    // Set of "paid" item_keys for any month/year overlapping this week
    const paidKeys = new Set();
    for (const c of (checked.data || [])) {
      const matchesStart = c.year === startYear && c.month === startMonth0;
      const matchesEnd   = c.year === endYear   && c.month === endMonth0;
      if (matchesStart || matchesEnd) paidKeys.add(c.item_key);
    }

    const payments = [];

    // Recurring items
    for (const r of (recurring.data || [])) {
      const recurType = r.recur_type;
      const recurDay  = r.recur_day;
      let payDate = null;

      if (recurType === 'weekly-day') {
        // Always once per week — on the JS-day equivalent of recur_day
        const jsDay = recurDayToJsDay(recurDay);
        payDate = new Date(start);
        // start is Monday (jsDay=1); offset to target day
        const startJsDay = 1; // Monday
        const offset = (jsDay - startJsDay + 7) % 7;
        payDate.setDate(start.getDate() + offset);
      } else if (recurType === 'monthly-date') {
        // Pays on recurDay of each month. Include if that calendar date
        // falls within this week's range (handles month-crossings).
        const candidates = [
          new Date(startYear, startMonth - 1, recurDay),
          new Date(endYear,   endMonth   - 1, recurDay),
        ];
        for (const c of candidates) {
          if (c >= start && c <= end) { payDate = c; break; }
        }
      }

      if (!payDate) continue;
      if (payDate < start || payDate > end) continue;

      const slug = slugify(r.name);
      const rawCat = catByVendor.get(slug) || null;
      const cat = rawCat ? (CAT_MAP[rawCat] || rawCat) : inferCatFromAccount(r.account);
      const dayLabel = `${DAY_LABELS[payDate.getDay()]} ${payDate.getDate()}`;

      payments.push({
        day: dayLabel,
        vendor: r.name,
        amount: Number(r.amount),
        status: paidKeys.has(r.id) ? 'paid' : 'due',
        cat,
        _sort: payDate.getTime(),
      });
    }

    // One-time items
    for (const o of (oneTime.data || [])) {
      // Filter to this week's day range. The table stores year/month/day
      // separately, with month 0-INDEXED (0=Jan) — pass o.month straight to Date.
      const candidate = new Date(o.year, o.month, o.day);
      if (candidate < start || candidate > end) continue;

      const slug = slugify(o.name);
      const rawCat = catByVendor.get(slug) || null;
      const cat = rawCat ? (CAT_MAP[rawCat] || rawCat) : inferCatFromAccount(o.account);
      const dayLabel = `${DAY_LABELS[candidate.getDay()]} ${candidate.getDate()}`;

      payments.push({
        day: dayLabel,
        vendor: o.name,
        amount: Number(o.amount),
        status: paidKeys.has(o.id) ? 'paid' : 'due',
        cat,
        _sort: candidate.getTime(),
      });
    }

    payments.sort((a, b) => a._sort - b._sort);
    for (const p of payments) delete p._sort;

    const weekLabel = `Week of ${MONTH_LABELS[start.getMonth()]} ${start.getDate()}, ${startYear}`;

    // Hardcoded recurring bills for this week (payroll/WEX/rent/leases/mortgage,
    // not in w_*). Summed for the cash projection; NOT added to `payments` so the
    // list stays DB-sourced with correct paid status.
    let recurringBillsTotal = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      recurringBillsTotal += hardcodedRecurringForDate(d);
    }
    recurringBillsTotal = Math.round(recurringBillsTotal * 100) / 100;

    // Total scheduled outflows this week = DB items + hardcoded recurring.
    const dbTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const scheduledOutflows = Math.round((dbTotal + recurringBillsTotal) * 100) / 100;

    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json({
      week: weekLabel,
      windowStart: start.toISOString().slice(0, 10),
      windowEnd:   end.toISOString().slice(0, 10),
      payments,
      recurringBillsTotal,   // hardcoded legacy recurring (not in payments list)
      scheduledOutflows,     // DB payments + hardcoded recurring = full week bills
    });
  } catch (e) {
    console.error('cash-flow error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
}
