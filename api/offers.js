// pages/api/offers.js

// 🔁 Proxy لعروض الحجز (Offers) من Google Apps Script
// يعتمد على متغير بيئة: NAHL_OFFERS_APPSCRIPT_URL

const APPSCRIPT_OFFERS_URL = process.env.NAHL_OFFERS_APPSCRIPT_URL;

/**
 * Helper: يبني رابط Google Apps Script مع نفس البارامترات
 */
function buildUpstreamUrl({ appId, action, today }) {
  if (!APPSCRIPT_OFFERS_URL) {
    throw new Error('NAHL_OFFERS_APPSCRIPT_URL is not configured');
  }

  // نتأكد ما فيه query قديم في الرابط
  const base = APPSCRIPT_OFFERS_URL.replace(/\?.*$/, '');
  const url = new URL(base);

  if (appId)  url.searchParams.set('appId', appId);
  if (action) url.searchParams.set('action', action);
  if (today)  url.searchParams.set('today', today);

  return url.toString();
}

export default async function handler(req, res) {
  // 🌍 CORS بسيط (اختياري)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      message: 'Method Not Allowed. Use GET.'
    });
  }

  try {
    const { appId, action = 'listOffers', today } = req.query || {};

    // ❗ لازم appId يجي من الفرونت (ما فيه NAHL_DEFAULT_APP_ID)
    if (!appId) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required parameter: appId'
      });
    }

    if (!APPSCRIPT_OFFERS_URL) {
      return res.status(500).json({
        ok: false,
        message: 'Server is not configured: NAHL_OFFERS_APPSCRIPT_URL is missing'
      });
    }

    const upstreamUrl = buildUpstreamUrl({ appId, action, today });

    const upstreamRes = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json,text/plain,*/*'
      }
    });

    const text = await upstreamRes.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      // لو الرجوع مو JSON صافي، نرجّعه كـ raw
      data = { ok: false, raw: text };
    }

    if (!upstreamRes.ok) {
      // نمرّر كود الخطأ من Apps Script قدر الإمكان
      return res.status(upstreamRes.status).json({
        ok: false,
        status: upstreamRes.status,
        message: 'Upstream Apps Script error',
        upstream: data
      });
    }

    // ✅ نرجّع الـ JSON كما هو (index.html متوقع items/offers/rows...)
    return res.status(200).json(data);
  } catch (err) {
    console.error('offers proxy error:', err);
    return res.status(502).json({
      ok: false,
      message: 'Offers proxy failed',
      error: String(err)
    });
  }
}
