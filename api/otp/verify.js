// pages/api/otp/verify.ts
// Proxy → Google Apps Script (action=verifyOtp)

import type { NextApiRequest, NextApiResponse } from 'next';

const SCRIPT_URL = process.env.NAHLTIME_OTP_SCRIPT_URL || '';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow only POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Use POST.',
    });
  }

  try {
    if (!SCRIPT_URL) {
      return res.status(500).json({
        success: false,
        error: 'Missing NAHLTIME_OTP_SCRIPT_URL env variable',
      });
    }

    // appid from query or body
    const queryAppId = (req.query.appid || req.query.appId || '') as string;
    const bodyAppId =
      (req.body && (req.body.appid || req.body.appId || req.body.APP_ID)) || '';

    const appId = String(queryAppId || bodyAppId || '').trim();

    if (!appId) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Missing appId / appid',
      });
    }

    // Body from client (mobileNumber, countryCode, otp, etc.)
    const clientBody = (req.body && typeof req.body === 'object')
      ? req.body
      : {};

    const forwardBody = {
      ...clientBody,
      appid: appId,
    };

    // Build target URL → Apps Script doPost?action=verifyOtp&appid=...
    const url =
      `${SCRIPT_URL}` +
      `?action=verifyOtp&appid=${encodeURIComponent(appId)}`;

    console.log('[OTP VERIFY] Forwarding to Apps Script:', {
      url,
      body: forwardBody,
    });

    const gsResp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardBody),
    });

    const text = await gsResp.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log('[OTP VERIFY] Apps Script response:', {
      status: gsResp.status,
      data,
    });

    // Pass-through status & body from Apps Script
    return res.status(gsResp.status).json(data);
  } catch (err: any) {
    console.error('[OTP VERIFY] Proxy error:', err);
    return res.status(500).json({
      success: false,
      verified: false,
      error: 'OTP verify proxy error',
      details: String(err?.message || err),
    });
  }
}

export default handler;
