// api/offers.js على Vercel (Serverless Function)

const GAS_BASE_URL =
  'https://script.google.com/macros/s/AKfycbyyyVPuq0F49s3DEIZBQWTE54TdsEkdi3mxsY7ylZy7A0Vlt6389eEiSGaFrBrsYPtG/exec';

export default async function handler(req, res) {
  try {
    console.log('🔔 [offers] Incoming request query:', req.query);

    const { appId, today, action } = req.query;

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
    console.log('🌐 [offers] Calling GAS URL:', url);

    const r = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const status = r.status;
    console.log('📡 [offers] GAS response status:', status);

    const text = await r.text();
    console.log('🧾 [offers] GAS raw text length:', text.length);

    let data;
    try {
      data = JSON.parse(text);
      console.log('✅ [offers] Parsed JSON from GAS:', {
        ok: data.ok,
        appId: data.appId,
        today: data.today,
        count: data.count,
        itemsLength: Array.isArray(data.items) ? data.items.length : undefined,
      });
    } catch (e) {
      console.error('❌ [offers] Invalid JSON from GAS. Raw text:', text);
      return res
        .status(500)
        .json({ ok: false, message: 'Invalid JSON from backend', raw: text });
    }

    // نرجع نفس البيانات للفرونت
    return res.status(200).json(data);
  } catch (err) {
    console.error('💥 [offers] Handler error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Offers backend error',
      error: String(err),
    });
  }
}
