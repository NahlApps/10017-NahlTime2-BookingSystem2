// pages/api/offers.js
export default async function handler(req, res) {
  const { appId, action = 'listOffers', today } = req.query;

  const SCRIPT_WEBAPP_URL =
    'https://script.google.com/macros/s/AKfycbyyyVPuq0F49s3DEIZBQWTE54TdsEkdi3mxsY7ylZy7A0Vlt6389eEiSGaFrBrsYPtG/exec';

  const qs = new URLSearchParams();
  qs.set('action', action || 'listOffers');
  if (appId) qs.set('appId', appId);
  if (today) qs.set('today', today);

  const url = `${SCRIPT_WEBAPP_URL}?${qs.toString()}`;

  console.log('🛰️ [api/offers] Forwarding to GAS URL:', url);

  try {
    const r = await fetch(url, { method: 'GET' });
    const text = await r.text();

    console.log('🛰️ [api/offers] GAS status:', r.status);
    console.log('🛰️ [api/offers] GAS raw body:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('🛑 [api/offers] JSON parse error:', e);
      return res.status(500).json({
        ok: false,
        error: 'invalid_json_from_gas',
        details: String(e),
        raw: text,
      });
    }

    if (!data.ok) {
      console.warn('⚠️ [api/offers] GAS returned error:', data);
      return res.status(200).json({
        ok: false,
        error: data.error || 'backend_error',
        details: data.details || null,
      });
    }

    const items = Array.isArray(data.items) ? data.items : [];

    console.log('🎁 [api/offers] items.length =', items.length);

    return res.status(200).json({
      ok: true,
      appId: data.appId || appId || null,
      today: data.today || today || null,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error('🛑 [api/offers] fetch to GAS failed:', err);
    return res.status(500).json({
      ok: false,
      error: 'fetch_failed',
      details: String(err),
    });
  }
}
