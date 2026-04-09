// Vercel serverless — fetches live load data from Alvys TMS
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const clientId = process.env.ALVYS_CLIENT_ID;
  const clientSecret = process.env.ALVYS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Alvys credentials not configured" });
  }

  try {
    // Auth
    const authRes = await fetch("https://auth.alvys.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: "https://api.alvys.com/public/",
        grant_type: "client_credentials",
      }),
    });
    const authText = await authRes.text();
    if (!authRes.ok) {
      return res.status(502).json({ error: "Alvys auth failed", status: authRes.status, detail: authText });
    }
    const authData = JSON.parse(authText);
    const access_token = authData.access_token;
    if (!access_token) {
      return res.status(502).json({ error: "No access_token in auth response", detail: authText.slice(0, 200) });
    }

    // Fetch all loads across statuses
    const statuses = ["Queued", "Covered", "Open", "In Transit", "Delivered", "Invoiced"];
    const loadRes = await fetch("https://integrations.alvys.com/api/p/v1/loads/search", {
      method: "POST",
      headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json" },
      body: JSON.stringify({ Status: statuses, pageSize: 500 }),
    });
    const loadText = await loadRes.text();
    if (!loadRes.ok) {
      return res.status(502).json({ error: "Alvys loads fetch failed", status: loadRes.status, detail: loadText.slice(0, 500) });
    }
    const loadData = JSON.parse(loadText);

    const loads = (loadData.Items || []).map(l => {
      const stops = l.Stops || [];
      const orig = stops[0]?.Address || {};
      const dest = stops[stops.length - 1]?.Address || {};
      const miles = l.CustomerMileage?.Distance?.Value || 0;
      const revenue = l.CustomerRate?.Amount || l.Linehaul?.Amount || 0;
      const fsc = l.FuelSurcharge?.Amount || 0;
      const acc = l.CustomerAccessorials?.Amount || 0;
      const totalRev = revenue + fsc + acc;
      return {
        loadNumber: l.LoadNumber,
        customer: l.CustomerName,
        status: l.Status,
        origin: { city: orig.City || "", state: orig.State || "" },
        destination: { city: dest.City || "", state: dest.State || "" },
        miles,
        revenue: totalRev,
        linehaul: revenue,
        fsc,
        accessorials: acc,
        rpm: miles > 0 ? +(totalRev / miles).toFixed(2) : 0,
        invoiceAs: l.InvoiceAs || "",
        pickupDate: l.ScheduledPickupAt || l.PickedUpAt || "",
        deliveryDate: l.ScheduledDeliveryAt || l.DeliveredAt || "",
        equipment: l.RequiredEquipment || [],
      };
    });

    // Summary stats
    const byStatus = {};
    statuses.forEach(s => { byStatus[s] = { loads: 0, revenue: 0, miles: 0 }; });
    loads.forEach(l => {
      if (byStatus[l.status]) {
        byStatus[l.status].loads++;
        byStatus[l.status].revenue += l.revenue;
        byStatus[l.status].miles += l.miles;
      }
    });

    const withMiles = loads.filter(l => l.miles > 0 && l.revenue > 0);
    const totalRev = loads.reduce((s, l) => s + l.revenue, 0);
    const totalMiles = withMiles.reduce((s, l) => s + l.miles, 0);
    const avgRPM = totalMiles > 0 ? +(totalRev / totalMiles).toFixed(2) : 0;
    const avgRevPerLoad = loads.length > 0 ? Math.round(totalRev / loads.length) : 0;

    // Top customers
    const custMap = {};
    loads.forEach(l => {
      if (!custMap[l.customer]) custMap[l.customer] = { loads: 0, revenue: 0 };
      custMap[l.customer].loads++;
      custMap[l.customer].revenue += l.revenue;
    });
    const topCustomers = Object.entries(custMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return res.status(200).json({
      total: loadData.Total || loads.length,
      loads,
      summary: { totalRevenue: totalRev, totalMiles, avgRPM, avgRevPerLoad },
      byStatus,
      topCustomers,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
