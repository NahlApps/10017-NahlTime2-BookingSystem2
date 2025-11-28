// pages/api/terms.js
// 🌐 Proxy between NahlTime frontend and Google Apps Script Terms WebApp
//
// Usage from frontend (example):
//   GET /api/terms?appId=21eddbf5-efe5-4a5d-9134-b581717b17ff&lang=ar
//
// Expected GAS URL env:
//   GAS_TERMS_WEBAPP_URL = 'https://script.google.com/macros/s/XXXX/exec'
// and GAS will handle: action=getTerms&appId=...&lang=...

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res
      .status(405)
      .json({ ok: false, error: 'Method not allowed. Use GET.' });
  }

  const scriptUrl = process.env.GAS_TERMS_WEBAPP_URL;
  if (!scriptUrl) {
    return res.status(500).json({
      ok: false,
      error: 'Missing GAS_TERMS_WEBAPP_URL env variable on Vercel.'
    });
  }

  const { appId, lang } = req.query || {};

  if (!appId || typeof appId !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'Missing or invalid "appId" query parameter.'
    });
  }

  try {
    // Build query for GAS (Apps Script)
    const params = new URLSearchParams({
      action: 'getTerms',
      appId: appId
    });

    if (lang && typeof lang === 'string') {
      params.set('lang', lang.toLowerCase());
    }

    // Support both "…exec" and "…exec?foo=bar" in env
    const joinChar = scriptUrl.includes('?') ? '&' : '?';
    const url = `${scriptUrl}${joinChar}${params.toString()}`;

    console.log('[terms] Calling GAS terms endpoint:', url);

    const upstreamRes = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      cache: 'no-store'
    });

    const text = await upstreamRes.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.warn('[terms] GAS response is not valid JSON, returning raw text.');
      data = { raw: text };
    }

    if (!upstreamRes.ok) {
      console.error('[terms] GAS returned non-200 status:', upstreamRes.status, data);
      return res.status(upstreamRes.status).json({
        ok: false,
        error: 'Upstream GAS returned error status for terms.',
        status: upstreamRes.status,
        data
      });
    }

    // Normalize "ok" flag if GAS didn't set it
    if (data && typeof data === 'object' && !Object.prototype.hasOwnProperty.call(data, 'ok')) {
      data.ok = true;
    }

    // You can also normalize structure here if you want, e.g.:
    // {
    //   ok: true,
    //   terms: {
    //     titleAr, titleEn, bodyAr, bodyEn, updatedAt, appId
    //   }
    // }

    return res.status(200).json(data);
  } catch (err) {
    console.error('[terms] Error calling GAS_TERMS_WEBAPP_URL:', err);
    return res.status(502).json({
      ok: false,
      error: 'Failed to contact Google Apps Script Terms WebApp.'
    });
  }
}
