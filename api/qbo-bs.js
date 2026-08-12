import { getSupabase, getValidToken, qboFetch } from './_qbo-helpers.js';

// Fetches Balance Sheet from QuickBooks
// Query params: ?company=ce_east (default) | ce_sf_combined
//               ?as_of=YYYY-MM-DD (defaults to today)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const company = req.query.company || 'ce_east';
    const supabase = getSupabase();

    const tokenData = await getValidToken(supabase, company);
    if (!tokenData) {
      return res.status(401).json({ error: 'QuickBooks not connected.', company });
    }

    const asOf = req.query.as_of || new Date().toISOString().split('T')[0];
    // ⚠ `as_of` is NOT a QBO BalanceSheet parameter, and `end_date` ALONE is not
    // enough either — both were silently ignored and QBO fell back to DateMacro
    // "this calendar year-to-date", returning TODAY's balance sheet for every
    // date asked (identical numbers for 2024-01-31, 2025-06-30 and 2026-07-31).
    // QBO only honours the window when start_date AND end_date are BOTH present
    // — the same pairing qbo-pnl.js has always used, which is why P&L date
    // filtering worked and this never did. A balance sheet is cumulative, so
    // start_date only scopes the equity Net Income row; Jan 1 of the as-of year
    // reproduces QBO's own calendar-YTD convention.
    // ALWAYS check `applied` below before trusting a historical figure.
    const startDate = `${asOf.slice(0, 4)}-01-01`;
    const report = await qboFetch(tokenData, `/reports/BalanceSheet?start_date=${startDate}&end_date=${asOf}&minorversion=73`);
    const parsed = parseBsReport(report);

    // Echo what QBO actually honoured so a caller can never again assume a
    // requested date was applied.
    const h = report?.Header || {};
    res.json({
      company, as_of: asOf,
      applied: { startPeriod: h.StartPeriod, endPeriod: h.EndPeriod, dateMacro: h.DateMacro },
      bs: parsed, raw: report,
    });
  } catch (e) {
    console.error('qbo-bs error:', e);
    res.status(500).json({ error: e.message });
  }
}

function parseBsReport(report) {
  const result = { assets: {}, liabilities: {}, equity: {}, totals: {} };
  if (!report.Rows || !report.Rows.Row) return result;

  function extractSection(rows, target) {
    if (!rows) return;
    for (const row of rows) {
      if (row.ColData) {
        const name = row.ColData[0]?.value;
        const val = parseFloat(row.ColData[1]?.value) || 0;
        if (name && val !== 0) target[name] = val;
      }
      if (row.Rows?.Row) {
        const header = row.Header?.ColData?.[0]?.value || '';
        extractSection(row.Rows.Row, target);
        if (row.Summary?.ColData) {
          const sumName = row.Summary.ColData[0]?.value;
          const sumVal = parseFloat(row.Summary.ColData[1]?.value) || 0;
          if (sumName && sumVal !== 0) target[sumName] = sumVal;
        }
      }
    }
  }

  for (const section of report.Rows.Row) {
    const header = (section.Header?.ColData?.[0]?.value || '').toUpperCase();
    const summary = section.Summary?.ColData || [];

    if (header === 'ASSETS') {
      result.totals.totalAssets = parseFloat(summary[1]?.value) || 0;
      extractSection(section.Rows?.Row, result.assets);
    }

    // QB uses either separate "Liabilities" + "Equity" or combined "LIABILITIES AND EQUITY"
    if (header === 'LIABILITIES') {
      result.totals.totalLiabilities = parseFloat(summary[1]?.value) || 0;
      extractSection(section.Rows?.Row, result.liabilities);
    }
    if (header === 'EQUITY') {
      result.totals.totalEquity = parseFloat(summary[1]?.value) || 0;
      extractSection(section.Rows?.Row, result.equity);
    }
    if (header.includes('LIABILITIES AND EQUITY') || header.includes('LIABILITIES & EQUITY')) {
      if (section.Rows?.Row) {
        for (const sub of section.Rows.Row) {
          const sh = (sub.Header?.ColData?.[0]?.value || sub.ColData?.[0]?.value || '').toUpperCase();
          const ss = sub.Summary?.ColData || [];
          if (sh.includes('LIABILIT') && !sh.includes('EQUITY')) {
            result.totals.totalLiabilities = parseFloat(ss[1]?.value) || parseFloat(sub.ColData?.[1]?.value) || 0;
            extractSection(sub.Rows?.Row, result.liabilities);
          }
          if (sh === 'EQUITY') {
            result.totals.totalEquity = parseFloat(ss[1]?.value) || 0;
            extractSection(sub.Rows?.Row, result.equity);
          }
        }
      }
    }
  }

  return result;
}
