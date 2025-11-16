// pages/api/additional-services.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const GAS_BASE_URL =
  process.env.ADDITIONAL_SERVICES_GAS_URL ||
  'https://script.google.com/macros/s/AKfycbwXqdR054JlrYb2Q9sUoX9ofYKyhw4fV5gZW5U4TvQwuUb9iq9b4hYNFjr_U8-N4kwMfA/exec';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      success: false,
      error: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    // appId من الكويري نفس ما يرسله الفرونت
    const appIdParam = req.query.appId;
    const appId = Array.isArray(appIdParam)
      ? appIdParam[0]
      : appIdParam || '';

    const url = `${GAS_BASE_URL}?action=getAdditionalServices&appId=${encodeURIComponent(
      appId
    )}`;

    const upstream = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    });

    const text = await upstream.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch (e) {
      // لو Google Apps Script رجع نص غير JSON
      data = {
        success: false,
        error: 'INVALID_JSON_FROM_GAS',
        raw: text,
      };
    }

    // خليه يرجع 200 لو success، وإلا 500
    const status = upstream.ok && data?.success ? 200 : 500;
    return res.status(status).json(data);
  } catch (err: any) {
    console.error('API /additional-services proxy error:', err);
    return res.status(500).json({
      success: false,
      error: 'PROXY_ERROR',
      message: String(err),
    });
  }
}
