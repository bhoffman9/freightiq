// One-off debug endpoint: inspects what's actually classed with ATL in QBO.
// Probes a few angles to understand why /reports/ProfitAndLoss?classid=ATL
// returns the full unfiltered P&L on the ce_sf_combined company.
//
// Returns counts + sample rows for each probe so we can see which transactions
// (if any) actually carry the ATL class tag.

import { getSupabase, getValidToken, qboFetch } from './_qbo-helpers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const company = req.query.company || 'ce_sf_combined';
    const className = req.query.class || 'ATL';
    const supabase = getSupabase();
    const tokenData = await getValidToken(supabase, company);
    if (!tokenData) return res.status(401).json({ error: 'no token' });

    // 1. Class record
    const classResp = await qboFetch(
      tokenData,
      `/query?query=${encodeURIComponent(`SELECT * FROM Class WHERE Name = '${className}'`)}&minorversion=73`,
    );
    const cls = classResp.QueryResponse?.Class?.[0];

    // 2. ProfitAndLoss WITH classid filter
    const today = new Date().toISOString().slice(0, 10);
    const pnlWithClass = cls
      ? await qboFetch(tokenData, `/reports/ProfitAndLoss?start_date=2026-01-01&end_date=${today}&classid=${cls.Id}&minorversion=73`)
      : null;
    const pnlNoClass = await qboFetch(tokenData, `/reports/ProfitAndLoss?start_date=2026-01-01&end_date=${today}&minorversion=73`);

    // 3. Count transactions with ATL class via Purchase query
    let purchaseClassed = null;
    if (cls) {
      try {
        const q = await qboFetch(
          tokenData,
          `/query?query=${encodeURIComponent(`SELECT COUNT(*) FROM Purchase WHERE Line.AccountBasedExpenseLineDetail.ClassRef.value = '${cls.Id}'`)}&minorversion=73`,
        );
        purchaseClassed = q;
      } catch (e) { purchaseClassed = { error: e.message }; }
    }

    // 4. Sample 5 Purchase records to see what class values exist
    const purchaseSample = await qboFetch(
      tokenData,
      `/query?query=${encodeURIComponent("SELECT * FROM Purchase WHERE TxnDate >= '2026-05-11' ORDER BY TxnDate DESC MAXRESULTS 5")}&minorversion=73`,
    );

    // 5. All Classes
    const allClasses = await qboFetch(
      tokenData,
      `/query?query=${encodeURIComponent("SELECT * FROM Class MAXRESULTS 50")}&minorversion=73`,
    );

    // 6. ProfitAndLossDetail with classid
    let pnlDetail = null;
    if (cls) {
      try {
        pnlDetail = await qboFetch(
          tokenData,
          `/reports/ProfitAndLossDetail?start_date=2026-05-11&end_date=${today}&classid=${cls.Id}&minorversion=73`,
        );
      } catch (e) { pnlDetail = { error: e.message }; }
    }

    res.json({
      company,
      classFound: cls || null,
      allClasses: allClasses.QueryResponse?.Class?.map(c => ({ Id: c.Id, Name: c.Name, Active: c.Active })) || [],
      pnlTotals: {
        withClass: pnlWithClass?.Rows?.Row?.find(r => r.Summary)?.Summary?.ColData?.[1]?.value || null,
        noClass:   pnlNoClass?.Rows?.Row?.find(r => r.Summary)?.Summary?.ColData?.[1]?.value || null,
      },
      pnlWithClassReport: cls ? {
        Header: pnlWithClass.Header,
        firstRow: pnlWithClass.Rows?.Row?.[0],
      } : null,
      purchaseClassedQuery: purchaseClassed,
      recentPurchaseSample: (purchaseSample.QueryResponse?.Purchase || []).slice(0, 5).map(p => ({
        Id: p.Id, TxnDate: p.TxnDate, EntityRef: p.EntityRef,
        lines: (p.Line || []).map(l => ({
          amount: l.Amount,
          accountRef: l.AccountBasedExpenseLineDetail?.AccountRef,
          classRef: l.AccountBasedExpenseLineDetail?.ClassRef,
        })),
      })),
      pnlDetailFirstSection: pnlDetail?.Rows?.Row?.[0] || pnlDetail?.error || null,
    });
  } catch (e) {
    console.error('qbo-class-debug error:', e);
    res.status(500).json({ error: e.message });
  }
}
