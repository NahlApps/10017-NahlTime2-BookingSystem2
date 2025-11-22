// pages/api/offers.js
//
// Proxy between your frontend (PWA) and Apps Script Web App.
//
// REQUIRED ENV:
//   OFFERS_WEBAPP_URL = full published Apps Script Web App URL
//     e.g. "https://script.google.com/macros/s/XXXX/exec"
//
// Frontend calls:
//   GET /api/offers?action=listOffers&appId=...&today=YYYY-MM-DD
//
// This handler forwards all query params to Apps Script and passes JSON back.

export default async function handler(req, res) {
  // Basic CORS (optional, safe default)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ ok: false, error: 'Method not allowed' });
  }

  const webappBase = process.env.OFFERS_WEBAPP_URL;
  if (!webappBase) {
    return res.status(500).json({
      ok: false,
      error: 'OFFERS_WEBAPP_URL env is not configured',
    });
  }

  try {
    // Build Apps Script URL with all query params forwarded
    const url = new URL(webappBase);

    // Forward all query parameters (action, appId, today, etc.)
    const query = req.query || {};
    Object.keys(query).forEach((key) => {
      const val = query[key];
      if (Array.isArray(val)) {
        val.forEach((v) => url.searchParams.append(key, v));
      } else if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
      }
    });

    // Default action if not provided
    if (!url.searchParams.get('action')) {
      url.searchParams.set('action', 'listOffers');
    }

    const fetchOptions = {
      method: 'GET',
      // No cache to always get fresh offers
      cache: 'no-store',
    };

    const resp = await fetch(url.toString(), fetchOptions);
    const text = await resp.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Invalid JSON from Apps Script', e, text);
      return res.status(500).json({
        ok: false,
        error: 'Invalid JSON from Apps Script',
        raw: text,
      });
    }

    const statusCode = resp.ok ? 200 : resp.status || 500;
    // Make sure we set cache headers for dynamic content
    res.setHeader('Cache-Control', 'no-store');

    return res.status(statusCode).json(data);
  } catch (err) {
    console.error('Error in /api/offers:', err);
    return res.status(500).json({
      ok: false,
      error: 'Unexpected error in offers proxy',
      details: String(err),
    });
  }
}
