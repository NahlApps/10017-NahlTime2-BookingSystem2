// pages/api/gift/request.js
// 🌐 Proxy بين فورم NahlTime Gift و Google Apps Script (Code.gs)
//
// المتغير البيئي المطلوب في Vercel:
//   GAS_GIFT_WEBAPP_URL = https://script.google.com/macros/s/XXXX/exec
//
// Frontend:
//   fetch('/api/gift/request', { method: 'POST', body: JSON.stringify(payload) })

export default async function handler(req, res) {
  // نسمح فقط بالـ POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res
      .status(405)
      .json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const gasUrl = process.env.GAS_GIFT_WEBAPP_URL;
  if (!gasUrl) {
    return res.status(500).json({
      ok: false,
      error: 'Missing GAS_GIFT_WEBAPP_URL env variable on Vercel.'
    });
  }

  try {
    const body = req.body || {};
    const {
      appId,
      senderName,
      senderPhone,
      receiverName,
      receiverPhone
    } = body;

    // ✅ تحقق بسيط من الحقول الأساسية (نفس المطلوبة في Code.gs)
    if (!appId || !senderName || !senderPhone || !receiverName || !receiverPhone) {
      return res.status(400).json({
        ok: false,
        error: 'الرجاء ادخال البيانات بالشكل الصحيح'
      });
    }

    // نتأكد أن action = 'gift.request' كما يتوقع doPost في Code.gs
    const payloadToGas = {
      action: 'gift.request',
      ...body
    };

    console.log('[gift][proxy] Forwarding payload to GAS:', {
      url: gasUrl,
      payload: payloadToGas
    });

    const gasRes = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payloadToGas)
    });

    const text = await gasRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[gift][proxy] GAS response is not valid JSON:', text);
      data = { ok: false, error: 'Invalid JSON from GAS', raw: text };
    }

    console.log('[gift][proxy] GAS response:', {
      status: gasRes.status,
      ok: gasRes.ok,
      data
    });

    // لو GAS رجّع حالة خطأ HTTP
    if (!gasRes.ok) {
      const status = gasRes.status || 500;
      return res.status(status).json({
        ok: false,
        error:
          data.error ||
          `GAS returned HTTP ${status}`,
        raw: data
      });
    }

    // ✅ نجاح – نرجّع نفس ردّ Code.gs للواجهة
    return res.status(200).json(data);
  } catch (err) {
    console.error('[gift][proxy] Internal error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal proxy error',
      details: String(err)
    });
  }
}
