// Vercel serverless function — proxies Google Maps Distance Matrix API
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { origin, destination } = req.query;
  if (!origin || !destination) {
    return res.status(400).json({ error: "origin and destination required" });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "GOOGLE_MAPS_API_KEY not configured" });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${key}`;
    const r = await fetch(url);
    const data = await r.json();

    if (data.status !== "OK") {
      return res.status(400).json({ error: data.status, detail: data.error_message });
    }

    const element = data.rows[0]?.elements[0];
    if (!element || element.status !== "OK") {
      return res.status(400).json({ error: element?.status || "No route found" });
    }

    // distance.value is meters, duration.value is seconds
    const miles = Math.round(element.distance.value * 0.000621371);
    const hours = (element.duration.value / 3600).toFixed(1);

    return res.status(200).json({
      miles,
      hours,
      origin: data.origin_addresses[0],
      destination: data.destination_addresses[0],
      distance_text: element.distance.text,
      duration_text: element.duration.text,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
