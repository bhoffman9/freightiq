// Per-account transaction detail for Fleet Overview tile modals.
// Calls QBO's ProfitAndLossDetail report and extracts line items for the
// requested bucket. Replaces the hardcoded DETAIL[] rows that fell stale
// after each weekly drop.
//
// Query: ?bucket=insurance&company=ce_sf_combined&start=2026-01-01&end=2026-05-16
// Returns: { bucket, account, total, rows: [{date, vendor, memo, amount}] }

import { getSupabase, getValidToken, qboFetch } from './_qbo-helpers.js';

// bucket key → QBO account name(s) to pull line items from.
// "labor" + "fuel" are intentionally NOT in this map — they're rendered
// client-side from existing live data (DRIVERS / FUEL{}).
const BUCKET_ACCOUNTS = {
  insurance:    ['SF Truck Insurance'],
  trucks:       ['Truck Rentals'],
  trailers:     ['Trailer Rentals'],
  truckMaint:   ['Truck Maintenance'],
  trailerMaint: ['Trailer Maintenance'],
  uniforms:     ['Worker Uniforms'],
  storage:      ['Storage/Parking'],
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const bucket = String(req.query.bucket || '').trim();
    const accounts = BUCKET_ACCOUNTS[bucket];
    if (!accounts) {
      return res.status(400).json({ error: `unknown bucket '${bucket}'. Valid: ${Object.keys(BUCKET_ACCOUNTS).join(', ')}` });
    }

    const company  = String(req.query.company || 'ce_sf_combined').trim();
    const startDate = String(req.query.start || `${new Date().getFullYear()}-01-01`);
    const endDate   = String(req.query.end   || isoToday());

    const supabase = getSupabase();
    const tokenData = await getValidToken(supabase, company);
    if (!tokenData) {
      return res.status(401).json({ error: `no valid QBO token for company '${company}'` });
    }

    // ProfitAndLossDetail report — line-item detail for the period
    const report = await qboFetch(
      tokenData,
      `/reports/ProfitAndLossDetail?start_date=${startDate}&end_date=${endDate}`,
    );

    // Resolve column indexes from the report's Columns metadata. QBO returns
    // typical defaults: tx_date, txn_type, doc_num, is_no_post, name, memo,
    // account_name, split_acc, subt_nat_amount (= Amount), rbal_nat_amount
    // (= Balance). We want Amount, NOT Balance — earlier code was pulling
    // the trailing Balance column which gave running totals, not txn amounts.
    const colMeta = report.Columns?.Column || [];
    const idx = (typeId) => colMeta.findIndex(c => c.ColType === typeId);
    const dateIdx   = idx('tx_date') >= 0 ? idx('tx_date') : 0;
    const vendorIdx = idx('vend_name') >= 0 ? idx('vend_name') : (idx('cust_name') >= 0 ? idx('cust_name') : (idx('emp_name') >= 0 ? idx('emp_name') : 4));
    const memoIdx   = idx('memo') >= 0 ? idx('memo') : 5;
    // Amount column = subt_nat_amount (signed transaction amount).
    let amountIdx = colMeta.findIndex(c => /amount/i.test(c.ColTitle || '') && !/balance/i.test(c.ColTitle || ''));
    if (amountIdx < 0) amountIdx = colMeta.findIndex(c => c.ColType === 'subt_nat_amount');
    if (amountIdx < 0) amountIdx = colMeta.length - 2;  // fallback: second-to-last

    const wantedSet = new Set(accounts.map(a => a.toLowerCase()));
    const rows = [];

    // Walk recursively. Each section's Header.ColData[0] is the account name;
    // detail rows under that section get assigned to it.
    function walk(rowList, currentAccount) {
      if (!rowList) return;
      for (const row of rowList) {
        const sectionAccount = row.Header?.ColData?.[0]?.value;
        const nextAccount = sectionAccount || currentAccount;

        if (row.ColData && !row.Summary && !row.Header && wantedSet.has((currentAccount || '').toLowerCase())) {
          const cells = row.ColData;
          const date    = cells[dateIdx]?.value   || '';
          const vendor  = cells[vendorIdx]?.value || cells[1]?.value || '';
          const memo    = cells[memoIdx]?.value   || '';
          const amountStr = cells[amountIdx]?.value || '0';
          const amount  = parseFloat(String(amountStr).replace(/,/g, '')) || 0;
          if (date) rows.push({ date, vendor, memo, amount });
        }

        if (row.Rows?.Row) walk(row.Rows.Row, nextAccount);
      }
    }

    walk(report.Rows?.Row, null);

    const total = rows.reduce((s, r) => s + r.amount, 0);

    res.setHeader('Cache-Control', 'public, max-age=300');  // 5min cache
    res.json({
      bucket,
      account: accounts.join(' + '),
      company,
      start: startDate,
      end:   endDate,
      total: Math.round(total * 100) / 100,
      rows,
    });
  } catch (e) {
    console.error('qbo-detail error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
}
