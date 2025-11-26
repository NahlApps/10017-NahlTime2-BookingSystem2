// functions/api/terms.js
// Proxy → Google Apps Script `doGet(e)` with action=terms
//
// Usage from frontend:
//   GET /api/terms?appId=XXXX
//
// This proxy calls:
//   https://script.google.com/macros/s/XXXX/exec?action=terms&appId=XXXX
//
// 🔁 Replace GAS_URL with your deployed Web App URL.

const GAS_URL = 'https://script.google.com/macros/s/XXXXXXXXXXXX/exec'; // ⬅️ put your real Apps Script URL

// Common CORS headers (if you need them)
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const origin = url.origin;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(origin),
      },
    });
  }

  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders(origin),
        },
      }
    );
  }

  // Read appId from query string
  const appId = (url.searchParams.get('appId') || '').trim();

  if (!appId) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Missing appId' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders(origin),
        },
      }
    );
  }

  // Build target URL to Apps Script:
  //  ?action=terms&appId=XXXX
  const target = new URL(GAS_URL);
  target.searchParams.set('action', 'terms');
  target.searchParams.set('appId', appId);

  // Optionally forward extra params (e.g., lang)
  url.searchParams.forEach((value, key) => {
    if (key === 'appId') return;   // already set
    if (key === 'action') return;  // we force action=terms
    target.searchParams.set(key, value);
  });

  try {
    const gasResp = await fetch(target.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const text = await gasResp.text();

    // If GAS already returns JSON (as in jsonResponse_),
    // just pass it through with the same status.
    return new Response(text, {
      status: gasResp.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    console.error('Error calling GAS terms endpoint:', err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Failed to reach terms backend',
        details: String(err),
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders(origin),
        },
      }
    );
  }
}
