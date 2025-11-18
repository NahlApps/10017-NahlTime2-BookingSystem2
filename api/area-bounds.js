// pages/api/area-bounds.js
/**
 * Proxy API for area bounds
 * Frontend calls:
 *   /api/area-bounds?appId=...&areaId=...
 * This forwards the request to the Google Apps Script Web App:
 *   AREA_BOUNDS_SCRIPT_URL + "?path=area-bounds&appId=...&areaId=..."
 */

export default async function handler(req, res) {
  // Allow only GET (you can extend later if needed)
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const baseUrl = process.env.AREA_BOUNDS_SCRIPT_URL;
  if (!baseUrl) {
    return res.status(500).json({
      ok: false,
      error: 'AREA_BOUNDS_SCRIPT_URL is not configured on the server.',
    });
  }

  try {
    // Build target URL with original query + path=area-bounds
    const url = new URL(baseUrl);

    // If your Code.gs expects "path=area-bounds", append it:
    url.searchParams.set('path', 'area-bounds');

    // Forward all query params from the client (appId, areaId, etc.)
    for (const [key, value] of Object.entries(req.query)) {
      if (value === undefined || value === null) continue;

      // Next.js can send string or string[]
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, value);
      }
    }

    // Call Apps Script Web App
    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json,text/plain,*/*',
      },
    });

    const text = await upstream.text();

    // Try to parse JSON, but keep raw if not JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    // Mirror status
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('area-bounds proxy error:', err);
    res.status(500).json({
      ok: false,
      error: 'area-bounds proxy failed',
      detail: String(err),
    });
  }
}
