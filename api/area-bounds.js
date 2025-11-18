// pages/api/area-bounds.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const SCRIPT_URL = process.env.AREA_BOUNDS_SCRIPT_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!SCRIPT_URL) {
    return res.status(500).json({ ok: false, error: 'AREA_BOUNDS_SCRIPT_URL is not set' });
  }

  try {
    // Forward all query params (appId, areaId, etc.) to Apps Script
    const url = new URL(SCRIPT_URL);
    Object.entries(req.query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // If your Apps Script is public "Anyone", no auth needed
    });

    const text = await upstream.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // If not JSON, just pass raw text
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        ok: false,
        status: upstream.status,
        upstreamBody: data ?? text,
      });
    }

    return res.status(200).json(data ?? { ok: true, raw: text });
  } catch (err: any) {
    console.error('area-bounds proxy error:', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
