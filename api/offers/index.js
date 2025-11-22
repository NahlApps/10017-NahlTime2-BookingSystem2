// pages/api/offers/index.js
//
// Proxy API لعروض NahlTime:
// - يستقبل الطلب من الـ PWA (نفس الدومين / origin)
// - يقرأ appid من query أو body (إلزامي)
// - يرسل الطلب إلى Google Apps Script Web App (GAS_OFFERS_URL)
// - يرجع نفس الـ JSON للـ Frontend
//
// يعتمد على Code.gs (offers) اللي فيه:
// listOffers, getOffer, createOffer, updateOffer, deleteOffer

const GAS_OFFERS_URL = process.env.GAS_OFFERS_URL;

// 🔹 قراءة appId من الطلب (مطلوب)
function getAppIdFromRequest(req) {
  const q = req.query || {};
  const body = (typeof req.body === 'object' && req.body) ? req.body : {};

  const fromQuery = q.appid || q.appId;
  const fromBody  = body.appid || body.appId;

  const appid = (typeof fromQuery === 'string' && fromQuery.trim()) ||
                (typeof fromBody === 'string'  && fromBody.trim())  ||
                '';

  return appid.trim() || null;
}

// 🔹 بناء Query String لإرسالها لـ Apps Script
function buildGasQuery(query, appId, action) {
  const params = new URLSearchParams();

  // action
  if (action) {
    params.set('action', action);
  } else if (query.action) {
    params.set('action', String(query.action));
  } else {
    // افتراضي: listOffers
    params.set('action', 'listOffers');
  }

  // appId
  if (appId) {
    params.set('appId', appId);
  }

  // مرّر باقي الباراميترات كما هي (بدون تكرار action/appId/appid)
  Object.entries(query).forEach(([key, value]) => {
    if (value == null) return;
    const lower = key.toLowerCase();
    if (lower === 'action' || lower === 'appid' || lower === 'appid' || lower === 'appid' || lower === 'appId'.toLowerCase()) return;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, String(v)));
    } else {
      params.append(key, String(value));
    }
  });

  return params.toString();
}

function sendCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export default async function handler(req, res) {
  sendCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    // Preflight
    return res.status(204).end();
  }

  if (!GAS_OFFERS_URL) {
    return res.status(500).json({
      success: false,
      error: 'Missing GAS_OFFERS_URL env var',
      code: 'MISSING_CONFIG',
    });
  }

  // 🔒 appId إجباري
  const appId = getAppIdFromRequest(req);
  if (!appId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required appid/appId parameter',
      code: 'MISSING_APP_ID',
    });
  }

  const method = req.method || 'GET';

  try {
    const query = req.query || {};
    const body  = (typeof req.body === 'object' && req.body) ? { ...req.body } : {};

    // تحديد action (مع افتراضي listOffers)
    const action = body.action || query.action || 'listOffers';

    // نبني Query String للإرسال لـ Apps Script
    const qs = buildGasQuery(query, appId, action);
    const targetUrl = `${GAS_OFFERS_URL}?${qs}`;

    // نضمن أن الـ body فيه appId و action لو هنرسل body
    if (!body.appId && !body.appid) {
      body.appId = appId;
    }
    if (!body.action) {
      body.action = action;
    }

    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json,text/plain,*/*',
      },
    };

    if (method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(targetUrl, fetchOptions);

    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = {
        success: response.ok,
        raw: text,
        status: response.status,
      };
    }

    res.status(response.status || 200).json(data);
  } catch (error) {
    console.error('[/api/offers] Proxy error:', error);
    res.status(500).json({
      success: false,
      error: 'Proxy error while calling Offers API',
      code: 'PROXY_ERROR',
    });
  }
}
