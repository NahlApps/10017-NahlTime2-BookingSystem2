// pages/api/offers.js

const GAS_OFFERS_URL =
  'https://script.google.com/macros/s/AKfycbyyyVPuq0F49s3DEIZBQWTE54TdsEkdi3mxsY7ylZy7A0Vlt6389eEiSGaFrBrsYPtG/exec';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res
      .status(405)
      .json({ ok: false, error: 'Method not allowed (GET only)' });
  }

  const { action = 'listOffers', appId, today } = req.query;

  if (!appId) {
    return res
      .status(400)
      .json({ ok: false, error: 'Missing required query param: appId' });
  }

  try {
    const params = new URLSearchParams({ action, appId });
    if (today) params.append('today', today);

    const url = `${GAS_OFFERS_URL}?${params.toString()}`;
    const r = await fetch(url, { method: 'GET' });

    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse JSON from GAS:', text);
      return res.status(500).json({
        ok: false,
        error: 'Invalid JSON from Apps Script',
        raw: text,
      });
    }

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: 'Apps Script returned error',
        details: data,
      });
    }

    // Normalize a bit for frontend (optional)
    const items = data.items || data.offers || data.rows || [];
    return res.status(200).json({
      ok: true,
      appId,
      today: today || null,
      count: items.length,
      items, // keep same shape your frontend already expects
    });
  } catch (err) {
    console.error('api/offers error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
      details: String(err),
    });
  }
}
