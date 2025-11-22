// api/offers.js على Vercel (Node Serverless Function)

const GAS_BASE_URL =
  'https://script.google.com/macros/s/AKfycbyyyVPuq0F49s3DEIZBQWTE54TdsEkdi3mxsY7ylZy7A0Vlt6389eEiSGaFrBrsYPtG/exec';

export default async function handler(req, res) {
  try {
    // نقرأ البارامترات القادمة من الفرونت
    const { appId, today, action } = req.query;

    // نبني نفس الـ query string ونرسلها لـ Google Apps Script
    const params = new URLSearchParams();

    // لو ما أرسلت من الفرونت، نخليها listOffers كـ افتراضي
    params.set('action', action || 'listOffers');

    if (appId) {
      params.set('appId', appId);
    }

    if (today) {
      params.set('today', today);
    }

    const url = `${GAS_BASE_URL}?${params.toString()}`;
    console.log('[offers] -> calling GAS:', url);

    const r = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[offers] invalid JSON from GAS:', text);
      return res
        .status(500)
        .json({ ok: false, message: 'Invalid JSON from backend', raw: text });
    }

    // لو كل شيء تمام نرجع نفس البيانات للفرونت
    return res.status(200).json(data);
  } catch (err) {
    console.error('[offers] error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Offers backend error',
      error: String(err),
    });
  }
}
