// pages/api/coupons/validate.js
export default async function handler(req, res) {
  const { appId, code, subtotal, customer } = req.query;

  // هنا رابط Web App للكوبونات في Apps Script
  const COUPONS_WEBAPP_URL =
    'https://script.google.com/macros/s/AKfycbyP9aBrv__R__qdiFMH3YDydhJiVVEbqkyLwhNGJ3fprfG3DOWgZM1hj0em22DRQFJj0g/exec';

  const url = `${COUPONS_WEBAPP_URL}?action=validateCoupon` +
    `&appId=${encodeURIComponent(appId || '')}` +
    `&code=${encodeURIComponent(code || '')}` +
    `&subtotal=${encodeURIComponent(subtotal || '')}` +
    `&customer=${encodeURIComponent(customer || '')}`;

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
    console.error('Coupons proxy error:', err);
    return res.status(500).json({
      ok: false,
      error: 'PROXY_ERROR',
      message: 'حدث خطأ أثناء الاتصال بخدمة الكوبونات من السيرفر',
    });
  }
}
