// Vercel serverless — Accounts Receivable from Alvys TMS.
// Paginates all loads, keeps the billable/AR statuses, computes balance + aging.
// NOTE: Alvys's load API does not expose the carrier per load; carrier breakout
// requires a separate source (see FreightIQ A/R tab note).
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const clientId = process.env.ALVYS_CLIENT_ID;
  const clientSecret = process.env.ALVYS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).json({ error: "Alvys credentials not configured" });

  try {
    const authRes = await fetch("https://auth.alvys.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, audience: "https://api.alvys.com/public/", grant_type: "client_credentials" }),
    });
    const authData = JSON.parse(await authRes.text());
    const token = authData.access_token;
    if (!token) return res.status(502).json({ error: "Alvys auth failed" });

    // Everything except Queued / Released / Completed (per Ben). The AR view
    // narrows to In Transit/Delivered/Invoiced with balance; the full set
    // (incl Covered/Open) is returned as allRows for the Excel download.
    const statuses = ["Covered", "Open", "In Transit", "Delivered", "Invoiced"];
    const items = [];
    for (let page = 0; page < 20; page++) {
      const r = await fetch("https://integrations.alvys.com/api/p/v1/loads/search", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ Status: statuses, Page: page, PageSize: 200 }),
      });
      if (!r.ok) break;
      const d = JSON.parse(await r.text());
      const batch = d.Items || [];
      items.push(...batch);
      if (batch.length < 200) break;
    }

    const now = Date.now();
    const amt = o => (o && typeof o.Amount === "number" ? o.Amount : 0);
    const days = d => (d ? Math.max(0, Math.floor((now - new Date(d).getTime()) / 86400000)) : null);

    const allRows = items.map(l => {
      const stops = l.Stops || [];
      const o = stops[0]?.Address || {}, dst = stops[stops.length - 1]?.Address || {};
      const invoice = amt(l.CustomerRate) + amt(l.FuelSurcharge) + amt(l.CustomerAccessorials);
      const paid = amt(l.TotalPaid);
      const refs = (l.References || []).map(x => x?.Value || x).filter(Boolean);
      return {
        loadNumber: l.LoadNumber, orderNumber: l.OrderNumber || "", po: l.PONumber || "",
        ref: refs[0] || "", customer: l.CustomerName || "", status: l.Status,
        invoiceAs: l.InvoiceAs || "",
        origin: `${o.City || "?"}, ${o.State || "?"}`, destination: `${dst.City || "?"}, ${dst.State || "?"}`,
        pickedUpAt: l.PickedUpAt || l.ScheduledPickupAt || "",
        deliveredAt: l.DeliveredAt || "", invoicedAt: l.InvoicedAt || "",
        invoice: +invoice.toFixed(2), paid: +paid.toFixed(2), balance: +(invoice - paid).toFixed(2),
        daysSinceDelivery: days(l.DeliveredAt),
        daysSinceInvoice: days(l.InvoicedAt),
      };
    });
    // AR = delivered/invoiced/in-transit with an outstanding balance
    const rows = allRows.filter(r => ["In Transit", "Delivered", "Invoiced"].includes(r.status) && r.balance > 0.01);

    // aging by days since delivery (unbilled/uncollected)
    const buckets = { "0-3": 0, "4-7": 0, "8-14": 0, "15-30": 0, "31+": 0, "undelivered": 0 };
    rows.forEach(r => {
      const d = r.daysSinceDelivery;
      if (d == null) buckets.undelivered += r.balance;
      else if (d <= 3) buckets["0-3"] += r.balance;
      else if (d <= 7) buckets["4-7"] += r.balance;
      else if (d <= 14) buckets["8-14"] += r.balance;
      else if (d <= 30) buckets["15-30"] += r.balance;
      else buckets["31+"] += r.balance;
    });
    Object.keys(buckets).forEach(k => buckets[k] = +buckets[k].toFixed(2));

    const byCustomerMap = {};
    rows.forEach(r => {
      const c = byCustomerMap[r.customer] || (byCustomerMap[r.customer] = { customer: r.customer, loads: 0, balance: 0, oldest: 0 });
      c.loads++; c.balance += r.balance; c.oldest = Math.max(c.oldest, r.daysSinceDelivery || 0);
    });
    const byCustomer = Object.values(byCustomerMap).map(c => ({ ...c, balance: +c.balance.toFixed(2) })).sort((a, b) => b.balance - a.balance);

    const byStatus = {};
    rows.forEach(r => { (byStatus[r.status] = byStatus[r.status] || { loads: 0, balance: 0 }); byStatus[r.status].loads++; byStatus[r.status].balance += r.balance; });
    Object.values(byStatus).forEach(s => s.balance = +s.balance.toFixed(2));

    const totalAR = +rows.reduce((s, r) => s + r.balance, 0).toFixed(2);
    const avgDays = rows.length ? Math.round(rows.reduce((s, r) => s + (r.daysSinceDelivery || 0), 0) / rows.length) : 0;

    rows.sort((a, b) => (b.daysSinceDelivery || -1) - (a.daysSinceDelivery || -1));

    return res.status(200).json({
      totalAR, count: rows.length, avgDaysSinceDelivery: avgDays,
      aging: buckets, byStatus, byCustomer, rows, allRows,
      note: "Carrier not available from Alvys load API. AR = delivered/invoiced/in-transit loads with outstanding balance (CustomerRate+FSC+accessorials − TotalPaid). Factored invoices move to Flexent once sold.",
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
