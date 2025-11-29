// /pages/api/gifts.js
// 🌐 Proxy between frontend (NahlTime booking) and Google Apps Script Gift WebApp
//
// Usage (frontend example):
//   const res = await fetch('/api/gifts', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(giftPayload)
//   });
//
// Required env var on Vercel:
//   GAS_GIFT_WEBAPP_URL = https://script.google.com/macros/s/XXXX/exec

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    // For now we only support POST → create gift request
    res.setHeader('Allow', ['POST']);
    return res
      .status(405)
      .json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const scriptUrl = process.env.GAS_GIFT_WEBAPP_URL;
  if (!scriptUrl) {
    return res.status(500).json({
      ok: false,
      error: 'Missing GAS_GIFT_WEBAPP_URL env variable on Vercel.',
    });
  }

  try {
    const body = req.body || {};

    // We add a default action so Apps Script can extend later (approveGift, listGifts, etc.)
    const payload = {
      action: body.action || 'createGiftRequest',
      ...body,
    };

    // 🔁 Proxy request to Apps Script WebApp
    const gasRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await gasRes.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Fallback when GAS returns plain text
      console.warn('[gifts] GAS response is not valid JSON, raw text:', text);
      data = {
        ok: gasRes.ok,
        status: gasRes.status,
        raw: text,
        error: 'Gift GAS response is not valid JSON',
      };
    }

    // Log for debugging on server
    if (!gasRes.ok || data.ok === false || data.success === false) {
      console.error('[gifts] GAS responded with error-like payload:', {
        status: gasRes.status,
        data,
      });
    }

    return res.status(gasRes.status).json(data);
  } catch (err) {
    console.error('[gifts] Proxy error:', err);
    return res.status(502).json({
      ok: false,
      error: 'Error calling Gift GAS WebApp: ' + String(err),
    });
  }
}
