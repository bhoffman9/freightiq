import { getSupabase, getValidToken, qboFetch, parsePnlReport } from './_qbo-helpers.js';

// Fetches P&L from QuickBooks for FreightIQ dashboard
// Query params:
//   ?company=ce_sf_combined (default) | ce_east
//   ?period=ytd | this_week | last_week | jan | feb | mar | apr | may | ...
//   ?start_date=YYYY-MM-DD  ?end_date=YYYY-MM-DD  (override)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const company = req.query.company || 'ce_sf_combined';
    const supabase = getSupabase();

    const tokenData = await getValidToken(supabase, company);
    if (!tokenData) {
      return res.status(401).json({
        error: 'QuickBooks not connected. Authorize via CFO Dashboard first.',
        company,
      });
    }

    // Compute date range from period parameter
    const now = new Date();
    const year = now.getFullYear();
    let startDate = req.query.start_date;
    let endDate = req.query.end_date;

    if (!startDate || !endDate) {
      const period = (req.query.period || 'ytd').toLowerCase();
      const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

      if (months[period]) {
        const m = months[period];
        startDate = `${year}-${String(m).padStart(2, '0')}-01`;
        // Last day of month
        const lastDay = new Date(year, m, 0).getDate();
        const endCandidate = new Date(`${year}-${String(m).padStart(2, '0')}-${lastDay}`);
        endDate = endCandidate > now ? now.toISOString().split('T')[0] : `${year}-${String(m).padStart(2, '0')}-${lastDay}`;
      } else if (period === 'this_week') {
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        startDate = monday.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      } else if (period === 'last_week') {
        const day = now.getDay();
        const lastMon = new Date(now);
        lastMon.setDate(now.getDate() - (day === 0 ? 13 : day + 6));
        const lastSun = new Date(lastMon);
        lastSun.setDate(lastMon.getDate() + 6);
        startDate = lastMon.toISOString().split('T')[0];
        endDate = lastSun.toISOString().split('T')[0];
      } else {
        // YTD
        startDate = `${year}-01-01`;
        endDate = now.toISOString().split('T')[0];
      }
    }

    const report = await qboFetch(tokenData, `/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&minorversion=73`);
    const parsed = parsePnlReport(report);

    // Extract FreightIQ-specific fields from parsed data
    const fiq = {
      // Revenue by entity
      revenue_ce: parsed.income['CE Revenue'] || 0,
      revenue_sf: parsed.income['SF Revenue'] || 0,
      revenue_di: parsed.income['DI Revenue'] || 0,
      revenue_ce_east: parsed.income['CE East Revenue'] || 0,
      total_revenue: parsed.totals.totalIncome || 0,
      // COGS
      carrier_pay: parsed.cogs['Carrier Pay'] || 0,
      flexent_fees: parsed.cogs['Flexent Funding Fees'] || 0,
      merchant_fees: parsed.cogs['Triumph Merchant Fees'] || 0,
      total_cogs: parsed.totals.totalCOGS || 0,
      // Gross / Net
      gross_profit: parsed.totals.grossProfit || 0,
      total_expenses: parsed.totals.totalExpenses || 0,
      net_op_income: parsed.totals.netOpIncome || 0,
      net_income: parsed.totals.netIncome || 0,
      // Truck/Trailer CPM components
      ins_tot: parsed.truckTrailer['SF Truck Insurance'] || 0,
      truck_tot: parsed.truckTrailer['Truck Rentals'] || 0,
      trailer_tot: parsed.truckTrailer['Trailer Rentals'] || 0,
      truck_maint: parsed.truckTrailer['Truck Maintenance'] || 0,
      trail_maint: parsed.truckTrailer['Trailer Maintenance'] || 0,
      storage: parsed.truckTrailer['Storage/Parking'] || 0,
      uniforms: parsed.truckTrailer['Worker Uniforms'] || 0,
      fuel_qb: parsed.truckTrailer['Fuel'] || 0,
    };

    res.json({
      company,
      period: { start_date: startDate, end_date: endDate, label: req.query.period || 'ytd' },
      fiq,
      parsed,
    });
  } catch (e) {
    console.error('qbo-pnl error:', e);
    res.status(500).json({ error: e.message });
  }
}
