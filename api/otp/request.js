// pages/api/otp/request.js

/**
 * Proxy endpoint for requesting an OTP.
 *
 * Frontend call example:
 *   POST /api/otp/request?appid=21eddbf5-efe5-4a5d-9134-b581717b17ff
 *   body: { mobileNumber: "5XXXXXXXX", locale: "ar" | "en" }
 *
 * This route forwards the request to Google Apps Script Web App:
 *   GAS_WEBAPP_URL?action=requestOtp&appid=...
 */

// IMPORTANT:
// 1) Prefer setting GAS_WEBAPP_URL as an environment variable in Vercel
// 2) For quick testing, you can hard-code it in the fallback below

export default async function handler(req, res) {
  // --- CORS preflight ---
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  // --- Method guard ---
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  // --- Resolve GAS_WEBAPP_URL (env var → hard-coded fallback) ---
  let GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL;

  // 🔁 Optional: hard-coded fallback for quick testing
  // TODO: replace with your real Apps Script Web App URL and then (later) remove this line.
  if (!GAS_WEBAPP_URL) {
    GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyhycgEtgQrAc6Bhq5UIAJwGoaJ0RKwjbmN51Q1tnAnpTPp6BkjFkK15fxwkKu-j7M/exec';
  }

  if (!GAS_WEBAPP_URL) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({
      success: false,
      error: 'OTP backend URL (GAS_WEBAPP_URL) is not configured',
    });
  }

  // --- Resolve appId / appid from query ---
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
    // --- Forward request to Apps Script (requestOtp) ---
    const forwardUrl =
      GAS_WEBAPP_URL +
      `?action=requestOtp&appid=${encodeURIComponent(resolvedAppId)}`;

    const gsResponse = await fetch(forwardUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      // Next.js already parsed JSON body into req.body
      body: JSON.stringify(req.body || {}),
    });

    const rawText = await gsResponse.text();
    let data;

    // Try to parse JSON; if fails, wrap raw text
    try {
      data = JSON.parse(rawText);
    } catch (_err) {
      data = {
        success: gsResponse.ok,
        raw: rawText,
      };
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
