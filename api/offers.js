// pages/api/offers.js

/**
 * NahlHub – Offers Proxy API (Next.js / Vercel)
 *
 * Example:
 *   GET /api/offers?appid=APP_ID&page=welcome
 *
 * It forwards the request to your Apps Script web app:
 *   https://script.google.com/macros/s/XXXX/exec?mode=offers&appid=...&page=...
 *
 * Configure the upstream URL in env:
 *   GAS_OFFERS_URL="https://script.google.com/macros/s/XXXX/exec"
 */

const GAS_OFFERS_URL =
  process.env.GAS_OFFERS_URL ||
  'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res
      .status(405)
      .json({ ok: false, message: 'Method Not Allowed. Use GET.' });
  }

  const { appid, page, includeInactive } = req.query || {};

  if (!appid) {
    return res
      .status(400)
      .json({ ok: false, message: 'Missing required query parameter: appid' });
  }

  try {
    // Build Apps Script URL with query params
    const url = new URL(GAS_OFFERS_URL);
    url.searchParams.set('mode', 'offers');
    url.searchParams.set('appid', String(appid));

    if (page) {
      url.searchParams.set('page', String(page));
    }
    if (includeInactive !== undefined) {
      url.searchParams.set('includeInactive', String(includeInactive));
    }

    const upstreamRes = await fetch(url.toString(), {
      method: 'GET',
      // No CORS problem because this is server-side
    });

    const text = await upstreamRes.text();

    if (!upstreamRes.ok) {
      // Apps Script error → bubble up
      return res.status(502).json({
        ok: false,
        message: 'Upstream (Apps Script) error',
        upstreamStatus: upstreamRes.status,
        upstreamBody: text.slice(0, 2000)
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      return res.status(502).json({
        ok: false,
        message: 'Invalid JSON returned from Apps Script',
        upstreamBody: text.slice(0, 500)
      });
    }

    // Optional: extra safety filter by appid again (in case)
    if (data && Array.isArray(data.offers)) {
      data.offers = data.offers.filter((o) => {
        const appFromRow = String(
          o['App ID'] || o['AppID'] || o.appId || ''
        ).trim();
        return !appFromRow || appFromRow.toLowerCase() === String(appid).toLowerCase();
      });
      data.count = data.offers.length;
    }

    // Cache on edge for 60s
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');

    return res.status(200).json(data);
  } catch (err) {
    console.error('Offers API error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Internal server error in /api/offers',
      error: err && err.message ? err.message : String(err)
    });
  }
}
