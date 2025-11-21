// pages/api/otp.js

export default async function handler(req, res) {
  // CORS بسيط
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const APPS_SCRIPT_URL = process.env.OTP_WEBAPP_URL; // ⬅️ ضع URL نشر الـ Web App
  if (!APPS_SCRIPT_URL) {
    return res.status(500).json({ success: false, error: 'Missing OTP_WEBAPP_URL env' });
  }

  try {
    const body = req.body || {};

    const gsRes = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const text = await gsRes.text();
    let data;
    try { data = JSON.parse(text); }
    catch { data = { raw: text }; }

    res.status(gsRes.status).json(data);
  } catch (err) {
    console.error('OTP proxy error:', err);
    res.status(500).json({ success: false, error: 'Proxy error: ' + err.message });
  }
}
