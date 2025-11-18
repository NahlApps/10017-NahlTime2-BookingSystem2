// pages/api/locations.js

export default async function handler(req, res) {
  const { method, query } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const APPS_SCRIPT_URL = process.env.LOCATIONS_APPS_SCRIPT_URL;
  // مثال لقيمة المتغير:
  // LOCATIONS_APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXXX/exec"

  if (!APPS_SCRIPT_URL) {
    return res.status(500).json({
      success: false,
      error: 'Missing LOCATIONS_APPS_SCRIPT_URL environment variable'
    });
  }

  try {
    const base = APPS_SCRIPT_URL.replace(/\/$/, '');
    const url = new URL(base + '/locations');

    // ننسخ كل الـ query params، بما فيها appId
    Object.entries(query || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else if (value != null) {
        url.searchParams.append(key, String(value));
      }
    });

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const text = await upstream.text();
    const status = upstream.status || 500;

    // نمرّر الاستجابة كما هي (JSON من Apps Script)
    res.status(status).setHeader('Content-Type', 'application/json').send(text);
  } catch (err) {
    console.error('Proxy /api/locations error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locations from Apps Script'
    });
  }
}
