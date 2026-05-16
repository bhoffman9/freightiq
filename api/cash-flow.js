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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getSupabase();
    const now = req.query.date ? new Date(req.query.date) : new Date();
    const { start, end } = weekRange(now);
    const startMonth = start.getMonth() + 1; // 1-indexed
    const endMonth   = end.getMonth() + 1;
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
      const matchesStart = c.year === startYear && c.month === startMonth;
      const matchesEnd   = c.year === endYear   && c.month === endMonth;
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
      // Filter to this week's day range. The table stores year/month/day separately.
      const candidate = new Date(o.year, o.month - 1, o.day);
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

    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json({
      week: weekLabel,
      windowStart: start.toISOString().slice(0, 10),
      windowEnd:   end.toISOString().slice(0, 10),
      payments,
    });
  } catch (e) {
    console.error('cash-flow error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
}
