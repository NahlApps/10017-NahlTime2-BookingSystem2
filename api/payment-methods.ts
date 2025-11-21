// api/payment-methods.js (Node on Vercel)
export default async function handler(req, res) {
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxu_R0s5NvAP3xBBDFeMYyYjI7pe_O4Bm_pBB6fQ2upNeYq4pMtoRtMh-tDgZar3POq/exec'; // 👈 your deployed URL

  const { appId } = req.query;

  const url = `${GAS_URL}?action=listPaymentMethods&appId=${encodeURIComponent(appId || '')}`;

  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow' });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {
      data = { ok: false, error: 'Invalid JSON from GAS', raw: text };
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (err) {
    console.error('payment-methods proxy error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ ok: false, error: String(err) });
  }
}
