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

    const wantedSet = new Set(accounts.map(a => a.toLowerCase()));
    const rows = [];

    // The report's Rows[].Rows[] structure groups transactions under
    // section headers. Each section's Header.ColData[0] is the account name.
    // Walk recursively and harvest detail rows under matching account headers.
    function walk(rowList, currentAccount) {
      if (!rowList) return;
      for (const row of rowList) {
        // Account section header
        const sectionAccount = row.Header?.ColData?.[0]?.value;
        const nextAccount = sectionAccount || currentAccount;

        // Detail row: ColData = [date, txn_type, doc_num, posting, name, memo, account, split_acc, amount]
        // Field order varies by QBO; the report header defines columns. Defaults often:
        // 0=Date, 1=Transaction Type, 2=No., 3=Posting, 4=Name, 5=Memo/Description, 6=Account, 7=Split, 8=Amount
        if (row.ColData && !row.Summary && !row.Header && wantedSet.has((currentAccount || '').toLowerCase())) {
          const cells = row.ColData;
          const date  = cells[0]?.value || '';
          const vendor = cells[4]?.value || cells[1]?.value || '';
          const memo  = cells[5]?.value || '';
          const amountStr = cells[cells.length - 1]?.value || '0';
          const amount = parseFloat(String(amountStr).replace(/,/g, '')) || 0;
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
