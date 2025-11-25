// pages/api/review.js
// 🌐 Proxy between NahlTime frontend and Google Apps Script Review WebApp

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  const scriptUrl = process.env.GAS_REVIEW_WEBAPP_URL;
  if (!scriptUrl) {
    return res.status(500).json({
      success: false,
      error: 'Missing GAS_REVIEW_WEBAPP_URL env variable on Vercel.'
    });
  }

  try {
    const body = req.body || {};

    // 🔁 Normalize incoming fields (mobile vs customerPhone)
    const customerPhone = body.customerPhone || body.mobile || '';

    const payload = {
      action: 'scheduleReview',
      appId: body.appId,
      bookingId: body.bookingId,
      customerPhone,
      delayMinutes: body.delayMinutes,
      locale: body.locale || 'ar'
    };

    const gasRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await gasRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { success: false, error: 'Invalid JSON from GAS', raw: text };
    }

    // ✅ Normalize success flag for the frontend
    const success =
      gasRes.ok &&
      data.success !== false &&
      data.ok !== false;

    return res
      .status(success ? 200 : gasRes.status || 500)
      .json({ success, ...data });
  } catch (err) {
    console.error('Proxy /api/review error:', err);
    return res.status(500).json({
      success: false,
      error: String(err)
    });
  }
}
