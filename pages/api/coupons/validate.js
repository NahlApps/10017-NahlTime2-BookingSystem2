// pages/api/coupons/validate.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const GAS_BASE_URL = process.env.COUPONS_GAS_URL;
  if (!GAS_BASE_URL) {
    return res.status(500).json({ ok: false, error: 'MISSING_CONFIG', message: 'COUPONS_GAS_URL is not set' });
  }

  const appId    = typeof req.query.appId === 'string' ? req.query.appId : '';
  const code     = typeof req.query.code === 'string' ? req.query.code : '';
  const subtotal = typeof req.query.subtotal === 'string' ? req.query.subtotal : '0';
  const customer = typeof req.query.customer === 'string' ? req.query.customer : '';

  const url = `${GAS_BASE_URL}?action=validateCoupon&appId=${encodeURIComponent(appId)}&code=${encodeURIComponent(code)}&subtotal=${encodeURIComponent(subtotal)}&customer=${encodeURIComponent(customer)}`;

  try {
    const upstream = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'follow' });
    const text = await upstream.text();

    let data;
    try { data = JSON.parse(text); } catch (_e) {
      return res.status(500).json({ ok: false, error: 'PARSE_ERROR', raw: text });
    }

    return res.status(upstream.ok ? 200 : 500).json(data);
  } catch (err) {
    console.error('coupons/validate proxy error:', err);
    return res.status(500).json({ ok: false, error: 'PROXY_ERROR', message: String(err) });
  }
}
