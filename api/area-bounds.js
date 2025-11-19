// api/area-bounds.js

/**
 * AREA BOUNDS PROXY (Vercel / Next.js API Route)
 *
 * Query params:
 *   appId  (required)
 *   areaId (optional)
 *
 * Env variables required:
 *   GAS_AREA_BOUNDS_URL    -> published Apps Script web app URL (ending with /exec)
 *   GAS_AREA_BOUNDS_SECRET -> shared secret, must match AREA_BOUNDS_SECRET in Code.gs
 */

export default async function handler(req, res) {
  // Basic CORS handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ ok: false, error: 'Method not allowed. Use GET.' });
  }

  const { appId, areaId } = req.query || {};

  if (!appId) {
    return res
      .status(400)
      .json({ ok: false, error: 'Missing required query param: appId' });
  }

  const GAS_URL = process.env.GAS_AREA_BOUNDS_URL;
  const SECRET = process.env.GAS_AREA_BOUNDS_SECRET;

  if (!GAS_URL) {
    return res.status(500).json({
      ok: false,
      error: 'Server misconfigured: GAS_AREA_BOUNDS_URL not set'
    });
  }

  try {
    // Build full URL to Apps Script
    const url = new URL(GAS_URL);

    url.searchParams.set('appId', String(appId));
    if (areaId) {
      url.searchParams.set('areaId', String(areaId));
    }
    if (SECRET) {
      url.searchParams.set('secret', SECRET);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      // If Apps Script returned non-JSON, wrap it
      return res.status(500).json({
        ok: false,
        error: 'Invalid JSON from Apps Script',
        raw: text
      });
    }

    // Forward whatever Apps Script responded
    // (Apps Script encodes ok/error in the body)
    return res.status(200).json(data);
  } catch (err) {
    console.error('area-bounds proxy error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch area bounds from backend',
      details: String(err)
    });
  }
}
