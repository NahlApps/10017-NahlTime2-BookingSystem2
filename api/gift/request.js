// pages/api/gift/request.js
// 🌐 Proxy between NahlTime frontend and Google Apps Script Gift WebApp
//
// Frontend → POST /api/gift/request  (same domain, no CORS issues)
// This API → POST to GAS WebApp (GAS_GIFT_WEBAPP_URL) with action = 'gift.request'

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res
      .status(405)
      .json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const scriptUrl = process.env.GAS_GIFT_WEBAPP_URL;
  if (!scriptUrl) {
    return res.status(500).json({
      ok: false,
      error:
        'Missing GAS_GIFT_WEBAPP_URL env variable on Vercel. Please set it to your Apps Script WebApp URL.'
    });
  }

  try {
    const body = req.body || {};

    // Ensure action is set for GAS side
    const payload = {
      ...body,
      action: body.action || 'gift.request'
    };

    // Call GAS WebApp
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
      // If GAS returned non-JSON (e.g., error/HTML), wrap it
      data = {
        ok: false,
        error: 'Invalid JSON from GAS Gift WebApp',
        raw: text
      };
    }

    // Forward status + payload back to frontend
    if (!gasRes.ok || data.ok === false) {
      return res.status(500).json({
        ok: false,
        error: data.error || 'Gift workflow failed on GAS',
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('[gift] Proxy error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Gift API proxy error',
      details: String(err)
    });
  }
}
