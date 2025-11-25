// pages/api/review.js
// 🌐 Proxy between NahlTime frontend and Google Apps Script Review WebApp

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const scriptUrl = process.env.GAS_REVIEW_WEBAPP_URL;
  if (!scriptUrl) {
    return res.status(500).json({
      ok: false,
      error: 'Missing GAS_REVIEW_WEBAPP_URL env variable on Vercel.'
    });
  }

  try {
    const body = req.body || {};
    const payload = {
      action: 'scheduleReview',
      appId: body.appId,
      bookingId: body.bookingId,
      customerPhone: body.customerPhone,
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
      data = { ok: false, error: 'Invalid JSON from GAS', raw: text };
    }

    return res.status(gasRes.status).json(data);
  } catch (err) {
    console.error('Proxy /api/review error:', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
