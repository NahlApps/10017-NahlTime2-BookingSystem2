// pages/api/additional-services.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const GAS_BASE_URL = process.env.ADDITIONAL_SERVICES_GAS_URL;
  if (!GAS_BASE_URL) {
    return res.status(500).json({ success: false, error: 'MISSING_CONFIG', message: 'ADDITIONAL_SERVICES_GAS_URL is not set' });
  }

  const appId = typeof req.query.appId === 'string' ? req.query.appId : '';
  const url = `${GAS_BASE_URL}?action=getAdditionalServices&appId=${encodeURIComponent(appId)}`;

  try {
    const upstream = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'follow' });
    const text = await upstream.text();

    let data;
    try { data = JSON.parse(text); } catch (_e) {
      return res.status(500).json({ success: false, error: 'PARSE_ERROR', raw: text });
    }

    return res.status(upstream.ok ? 200 : 500).json(data);
  } catch (err) {
    console.error('additional-services proxy error:', err);
    return res.status(500).json({ success: false, error: 'PROXY_ERROR', message: String(err) });
  }
}
