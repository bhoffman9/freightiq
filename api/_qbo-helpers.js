import { createClient } from '@supabase/supabase-js';

export function getSupabase() {
  return createClient(
    (process.env.SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_KEY || '').trim()
  );
}

export async function getValidToken(supabase, companyId) {
  const { data, error } = await supabase
    .from('qbo_tokens')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error || !data) return null;

  if (new Date(data.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return data;
  }

  // Refresh the token
  const clientId = (process.env.QBO_CLIENT_ID || '').trim();
  const clientSecret = (process.env.QBO_CLIENT_SECRET || '').trim();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const resp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(data.refresh_token)}`,
  });

  if (!resp.ok) {
    console.error('Token refresh failed:', await resp.text());
    return null;
  }

  const tokens = await resp.json();

  await supabase
    .from('qbo_tokens')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      refresh_expires_at: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);

  return { ...data, access_token: tokens.access_token, realm_id: data.realm_id };
}

export async function qboFetch(tokenData, path) {
  const baseUrl = (process.env.QBO_BASE_URL || 'https://quickbooks.api.intuit.com').trim();
  const url = `${baseUrl}/v3/company/${tokenData.realm_id}${path}`;

  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/json',
    },
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`QBO API error ${resp.status}: ${err}`);
  }

  return resp.json();
}

// Parse QuickBooks P&L report into structured data with deep sub-account extraction
export function parsePnlReport(report) {
  const result = { income: {}, cogs: {}, expenses: {}, truckTrailer: {}, totals: {} };
  if (!report.Rows || !report.Rows.Row) return result;

  // Recursively extract all leaf-level amounts from a section
  function extractRows(rows, target, prefix) {
    if (!rows) return;
    for (const row of rows) {
      if (row.ColData) {
        const name = row.ColData[0]?.value;
        const val = parseFloat(row.ColData[1]?.value) || 0;
        if (name && !name.startsWith('Total') && val !== 0) {
          target[prefix ? `${prefix} > ${name}` : name] = val;
        }
      }
      if (row.Rows?.Row) {
        const subHeader = row.Header?.ColData?.[0]?.value || '';
        extractRows(row.Rows.Row, target, subHeader || prefix);
      }
      if (row.Summary?.ColData) {
        const name = row.Summary.ColData[0]?.value;
        const val = parseFloat(row.Summary.ColData[1]?.value) || 0;
        if (name && name.startsWith('Total') && val !== 0) {
          target[name] = val;
        }
      }
    }
  }

  for (const section of report.Rows.Row) {
    const header = section.Header?.ColData?.[0]?.value || '';
    const summary = section.Summary?.ColData || [];

    if (header === 'Income') {
      result.totals.totalIncome = parseFloat(summary[1]?.value) || 0;
      extractRows(section.Rows?.Row, result.income, '');
    }

    if (header === 'Cost of Goods Sold') {
      result.totals.totalCOGS = parseFloat(summary[1]?.value) || 0;
      extractRows(section.Rows?.Row, result.cogs, '');
    }

    if (header === 'Expenses') {
      result.totals.totalExpenses = parseFloat(summary[1]?.value) || 0;
      if (section.Rows?.Row) {
        for (const row of section.Rows.Row) {
          const subHeader = row.Header?.ColData?.[0]?.value || '';
          const subSummary = row.Summary?.ColData || [];
          // Pull out Truck/Trailer sub-section specifically
          if (subHeader === 'Truck/Trailer') {
            const ttTotal = parseFloat(subSummary[1]?.value) || 0;
            result.truckTrailer._total = ttTotal;
            extractRows(row.Rows?.Row, result.truckTrailer, '');
          } else {
            // Regular expense
            if (row.ColData) {
              const name = row.ColData[0]?.value;
              const val = parseFloat(row.ColData[1]?.value) || 0;
              if (name && !name.startsWith('Total') && val !== 0) result.expenses[name] = val;
            }
            if (subHeader && subSummary[1]) {
              result.expenses[`Total for ${subHeader}`] = parseFloat(subSummary[1]?.value) || 0;
            }
            extractRows(row.Rows?.Row, result.expenses, subHeader);
          }
        }
      }
    }

    if (header === 'Other Income') {
      result.totals.totalOtherIncome = parseFloat(summary[1]?.value) || 0;
    }

    if (section.type === 'Section' && section.group === 'NetIncome') {
      result.totals.netIncome = parseFloat(summary[1]?.value) || 0;
    }
  }

  if (result.totals.netIncome === undefined) {
    const lastRow = report.Rows.Row[report.Rows.Row.length - 1];
    if (lastRow?.Summary?.ColData) {
      result.totals.netIncome = parseFloat(lastRow.Summary.ColData[1]?.value) || 0;
    }
  }

  result.totals.grossProfit = (result.totals.totalIncome || 0) - (result.totals.totalCOGS || 0);
  result.totals.netOpIncome = result.totals.grossProfit - (result.totals.totalExpenses || 0);
  return result;
}
