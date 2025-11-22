// pages/api/offers.js
//
// Proxy API لعروض "Offers" يربط بين الـ Frontend (index.html)
// وبين Google Apps Script (Code.gs API).
//
// ✅ المتصفح يطلب: /api/offers?appId=...&action=listOffers&today=2025-11-22
// ✅ هذا الملف يعيد توجيه الطلب إلى WebApp في Apps Script
// ✅ ويرجع النتيجة كـ JSON للـ Frontend.
//
// ملاحظات مهمة:
// - لازم تضيف متغيّر البيئة NAHL_TIME_GAS_URL في Vercel
//   مثل: https://script.google.com/macros/s/AKfycbXXXXXXXXXXXX/exec
// - ما في NAHL_DEFAULT_APP_ID: لازم يجي appId من الـ query.

export default async function handler(req, res) {
  // 👈 نسمح فقط بـ GET (نفس اللي يستخدمه index.html)
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      ok: false,
      message: 'Method not allowed. Use GET only.',
    });
  }

  const GAS_BASE_URL = process.env.NAHL_TIME_GAS_URL;

  if (!GAS_BASE_URL) {
    return res.status(500).json({
      ok: false,
      message:
        'NAHL_TIME_GAS_URL is not configured. Please set it in your environment variables.',
    });
  }

  try {
    const { appId, action = 'listOffers', today } = req.query || {};

    // 🔐 ما في NAHL_DEFAULT_APP_ID → appId مطلوب من الواجهة
    if (!appId || typeof appId !== 'string') {
      return res.status(400).json({
        ok: false,
        message: 'Missing or invalid appId in query string.',
      });
    }

    // 🧭 نبني URL الاستدعاء لـ Code.gs WebApp
    //
    // في Code.gs كنا عاملين:
    //   - doGet(e)
    //   - endpoint = e.parameter.endpoint
    //   - لو endpoint === 'offers' نروح لدوال العروض
    //
    // لذلك نرسل:
    //   endpoint=offers
    //   appId=...
    //   action=listOffers (افتراضي)
    //   today=YYYY-MM-DD (اختياري)
    //
    const url = new URL(GAS_BASE_URL);

    // ثابت لتوجيه Code.gs على "العروض"
    url.searchParams.set('endpoint', 'offers');

    // قِيَم أساسية
    url.searchParams.set('appId', appId);
    if (action) url.searchParams.set('action', String(action));

    // اليوم (اختياري لكن مفيد لتصفية العروض في Code.gs)
    if (today) {
      url.searchParams.set('today', String(today));
    }

    // لو حاب تمرر باراميترات إضافية للـ Code.gs،
    // نمرّ عليهم كلهم ونضيفهم ماعدا الأشياء اللي عيّناها فوق.
    const skipKeys = new Set(['endpoint', 'appId', 'action', 'today']);
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (skipKeys.has(key)) return;
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, String(v)));
      } else if (value != null) {
        url.searchParams.set(key, String(value));
      }
    });

    // 🛰️ نرسل الطلب إلى Apps Script
    const upstreamRes = await fetch(url.toString(), {
      method: 'GET',
      // Apps Script غالبًا لا يحتاج هيدر خاص، لكن عدم التخزين مفيد
      headers: {
        'Accept': 'application/json',
      },
    });

    const text = await upstreamRes.text();
    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      console.error('Offers proxy: JSON parse error from GAS:', parseErr);
      console.error('Raw response was:', text);
      return res.status(502).json({
        ok: false,
        message: 'Invalid JSON received from Apps Script for offers.',
        raw: text,
      });
    }

    // لو Apps Script رجّع خطأ خاص فيه (مثلاً ok: false)،
    // نمرره كما هو مع Status مناسب.
    if (!upstreamRes.ok) {
      console.error('Offers proxy: GAS returned error status', upstreamRes.status, data);
      return res.status(upstreamRes.status).json({
        ok: false,
        message:
          data && data.message
            ? data.message
            : `Apps Script returned HTTP ${upstreamRes.status}`,
        data,
      });
    }

    // ✅ نجاح: نرجع البيانات كما هي مع no-store
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Offers proxy: unexpected error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Unexpected error in /api/offers proxy.',
      error: String(err),
    });
  }
}
