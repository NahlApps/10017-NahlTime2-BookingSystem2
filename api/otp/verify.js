// pages/api/otp/verify.js
// Proxy → Google Apps Script (action=verifyOtp)

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      verified: false,
      error: 'Method Not Allowed. Use POST.',
    });
  }

  const SCRIPT_URL = process.env.NAHLTIME_OTP_SCRIPT_URL || '';

  try {
    if (!SCRIPT_URL) {
      console.error('[OTP VERIFY] Missing NAHLTIME_OTP_SCRIPT_URL env var');
      return res.status(500).json({
        success: false,
        verified: false,
        error: 'NAHLTIME_OTP_SCRIPT_URL is not configured on the server',
      });
    }

    // 🔹 Read appid from query OR body
    const queryAppId = req.query.appid || req.query.appId || '';
    const bodyAppId =
      req.body && (req.body.appid || req.body.appId || req.body.APP_ID);

    const appId = String(queryAppId || bodyAppId || '').trim();

    if (!appId) {
      console.warn('[OTP VERIFY] Missing appId / appid');
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing appId / appid',
      });
    }

    // 🔹 Body from client (mobileNumber, countryCode, otp, etc.)
    const clientBody =
      req.body && typeof req.body === 'object' ? req.body : {};

    const forwardBody = {
      ...clientBody,
      appid: appId,
    };

    // 🔹 Build Apps Script URL: ?action=verifyOtp&appid=...
    const url =
      `${SCRIPT_URL}` +
      `?action=verifyOtp&appid=${encodeURIComponent(appId)}`;

    console.log('[OTP VERIFY] → Apps Script', { url, forwardBody });

    const gsResp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardBody),
    });

    const text = await gsResp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }

    console.log('[OTP VERIFY] ← Apps Script', {
      status: gsResp.status,
      data,
    });

    // ✅ Pass-through status & JSON from Apps Script
    return res.status(gsResp.status || 200).json(data);
  } catch (err) {
    console.error('[OTP VERIFY] Proxy error:', err);
    return res.status(500).json({
      success: false,
      verified: false,
      error: 'OTP verify proxy error',
      details: String(err && err.message ? err.message : err),
    });
  }
}
