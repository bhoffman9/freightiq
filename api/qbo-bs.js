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
    const report = await qboFetch(tokenData, `/reports/BalanceSheet?date_macro=&as_of=${asOf}&minorversion=73`);
    const parsed = parseBsReport(report);

    res.json({ company, as_of: asOf, bs: parsed, raw: report });
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
    const header = section.Header?.ColData?.[0]?.value || '';
    const summary = section.Summary?.ColData || [];

    if (header === 'Assets' || header === 'ASSETS') {
      result.totals.totalAssets = parseFloat(summary[1]?.value) || 0;
      extractSection(section.Rows?.Row, result.assets);
    }
    if (header === 'Liabilities' || header === 'LIABILITIES') {
      result.totals.totalLiabilities = parseFloat(summary[1]?.value) || 0;
      extractSection(section.Rows?.Row, result.liabilities);
    }
    if (header === 'Equity' || header === 'EQUITY') {
      result.totals.totalEquity = parseFloat(summary[1]?.value) || 0;
      extractSection(section.Rows?.Row, result.equity);
    }
  }

  return result;
}
