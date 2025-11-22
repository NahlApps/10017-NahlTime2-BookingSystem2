// pages/api/offers.js

// 🔗 Backend Apps Script endpoint
// يمكنك تغييرها من env: process.env.OFFERS_BACKEND_URL
const BACKEND_OFFERS_URL =
  process.env.OFFERS_BACKEND_URL ||
  'https://script.google.com/macros/s/AKfycbyyyVPuq0F49s3DEIZBQWTE54TdsEkdi3mxsY7ylZy7A0Vlt6389eEiSGaFrBrsYPtG/exec';

/**
 * Simple helper to build a target URL with all query params forwarded.
 */
function buildBackendUrl(query) {
  const url = new URL(BACKEND_OFFERS_URL);

  // Forward all query params from the frontend to the Apps Script
  Object.entries(query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, String(v)));
    } else if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  // If today is missing, add it (YYYY-MM-DD)
  if (!url.searchParams.has('today')) {
    const todayIso = new Date().toISOString().slice(0, 10);
    url.searchParams.set('today', todayIso);
  }

  // If action is missing, default to listOffers
  if (!url.searchParams.has('action')) {
    url.searchParams.set('action', 'listOffers');
  }

  return url.toString();
}

export default async function handler(req, res) {
  const { method, query } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res
      .status(405)
      .json({ ok: false, error: `Method ${method} not allowed` });
  }

  if (!BACKEND_OFFERS_URL) {
    return res.status(500).json({
      ok: false,
      error: 'OFFERS backend URL is not configured.',
    });
  }

  try {
    const targetUrl = buildBackendUrl(query);
    // Debug (اختياري): يمكنك إزالة هذا في الإنتاج
    console.log('[offers/api] →', targetUrl);

    const fetchRes = await fetch(targetUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    const text = await fetchRes.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[offers/api] JSON parse error:', e, text);
      return res.status(502).json({
        ok: false,
        error: 'Invalid JSON returned from offers backend.',
        raw: text,
      });
    }

    // إذا الـ backend ما يرجّع ok، نضيفها بناءً على status
    if (typeof data.ok === 'undefined') {
      data.ok = fetchRes.ok;
    }

    return res.status(fetchRes.status).json(data);
  } catch (err) {
    console.error('[offers/api] fetch error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch offers from backend.',
      details: String(err),
    });
  }
}
