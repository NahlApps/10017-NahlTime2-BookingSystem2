// pages/api/additional-services.js
export default async function handler(req, res) {
  const { appId } = req.query;

  const ADDITIONAL_SERVICES_WEBAPP_URL =
    'https://script.google.com/macros/s/AKfycbwXqdR054JlrYb2Q9sUoX9ofYKyhw4fV5gZW5U4TvQwuUb9iq9b4hYNFjr_U8-N4kwMfA/exec';

  const url = `${ADDITIONAL_SERVICES_WEBAPP_URL}?action=getAdditionalServices` +
    `&appId=${encodeURIComponent(appId || '')}`;

  try {
    const r = await fetch(url, { method: 'GET' });
    const text = await r.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: 'INVALID_JSON',
        raw: text,
      });
    }

    return res.status(r.ok ? 200 : 500).json(data);
  } catch (err) {
    console.error('Additional services proxy error:', err);
    return res.status(500).json({
      ok: false,
      error: 'PROXY_ERROR',
      message: 'حدث خطأ أثناء الاتصال بخدمة الخدمات الإضافية من السيرفر',
    });
  }
}
