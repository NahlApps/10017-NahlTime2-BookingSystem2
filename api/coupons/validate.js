// pages/api/coupons/validate.js
//
// ✅ What this does:
// - Receives GET /api/coupons/validate?appId=&code=&subtotal=&customer=
// - Proxies the request to your Google Apps Script Coupons Web App
// - Returns the JSON result as-is to the frontend
//
// 🔧 Required ENV variables (Vercel / .env.local):
//   COUPONS_GAS_URL   = https://script.google.com/macros/s/AKfycb.../exec
//   DEFAULT_APP_ID    = 21eddbf5-efe5-4a5d-9134-b581717b17ff
//
// (COUPONS_GAS_URL should be the *exec* URL of the Coupons GAS web app)

export default async function handler(req, res) {
  // Basic CORS (optional, since same origin, but harmless)
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET,OPTIONS');
    return res.status(405).json({
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'Only GET is allowed for this endpoint.'
    });
  }

  const COUPONS_GAS_URL = process.env.COUPONS_GAS_URL;
  const DEFAULT_APP_ID = process.env.DEFAULT_APP_ID || '';

  if (!COUPONS_GAS_URL) {
    return res.status(500).json({
      ok: false,
      error: 'MISSING_CONFIG',
      message: 'COUPONS_GAS_URL is not configured on the server.'
    });
  }

  const { appId, code, subtotal, customer } = req.query;

  const targetAppId = (appId || DEFAULT_APP_ID || '').trim();
  const couponCode = (code || '').trim();
  const subTotalNum = subtotal != null ? String(subtotal) : '0';
  const customerId = (customer || '').trim();

  if (!couponCode) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_CODE',
      message: 'Coupon code is required.'
    });
  }

  if (!targetAppId) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_APP_ID',
      message: 'App ID is required.'
    });
  }

  try {
    // Build GAS URL with query params
    const url =
      `${COUPONS_GAS_URL}` +
      `?action=validateCoupon` +
      `&appId=${encodeURIComponent(targetAppId)}` +
      `&code=${encodeURIComponent(couponCode)}` +
      `&subtotal=${encodeURIComponent(subTotalNum)}` +
      `&customer=${encodeURIComponent(customerId)}`;

    const gasRes = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    const text = await gasRes.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Coupons API: failed to parse GAS response as JSON:', e, text);
      return res.status(502).json({
        ok: false,
        error: 'INVALID_GAS_RESPONSE',
        message: 'Invalid response from coupons service.'
      });
    }

    // If GAS returns some HTTP error but still responded JSON, we still pass 200 to frontend
    // because frontend only cares about data.ok / data.error / data.message
    return res.status(200).json(data);
  } catch (err) {
    console.error('Coupons API proxy error:', err);
    return res.status(500).json({
      ok: false,
      error: 'PROXY_ERROR',
      message: 'حدث خطأ أثناء الاتصال بخدمة الكوبونات'
    });
  }
}
