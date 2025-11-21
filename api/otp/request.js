// pages/api/otp/request.js

/**
 * Proxy endpoint for requesting an OTP.
 *
 * Frontend calls:
 *   POST /api/otp/request?appid=YOUR_APP_ID
 *   body: { mobileNumber: "5XXXXXXXX", locale: "ar" | "en", ... }
 *
 * This route forwards the request to Google Apps Script Web App:
 *   GAS_WEBAPP_URL?action=requestOtp&appid=...
 */

export default async function handler(req, res) {
  // CORS – allow browser preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  const GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL;
  if (!GAS_WEBAPP_URL) {
    return res.status(500).json({
      success: false,
      error: 'GAS_WEBAPP_URL is not configured on the server',
    });
  }

  // Support both ?appid= and ?appId=
  const { appid, appId } = req.query;
  const resolvedAppId =
    (Array.isArray(appid) ? appid[0] : appid) ||
    (Array.isArray(appId) ? appId[0] : appId) ||
    '';

  if (!resolvedAppId) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res
      .status(400)
      .json({ success: false, error: 'Missing appid in query string' });
  }

  try {
    // Forward to Apps Script with action=requestOtp
    const forwardUrl =
      GAS_WEBAPP_URL +
      `?action=requestOtp&appid=${encodeURIComponent(resolvedAppId)}`;

    const gsResponse = await fetch(forwardUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify(req.body || {}),
    });

    const rawText = await gsResponse.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (err) {
      // If Apps Script returned non-JSON, wrap it
      data = { success: gsResponse.ok, raw: rawText };
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(gsResponse.status).json(data);
  } catch (err) {
    console.error('OTP request proxy error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({
      success: false,
      error: 'Failed to contact OTP backend',
      details: String(err),
    });
  }
}
