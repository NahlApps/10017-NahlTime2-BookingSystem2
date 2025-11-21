import type { NextApiRequest, NextApiResponse } from 'next';

const APPSCRIPT_BASE = process.env.APPSCRIPT_BASE_URL; 
// e.g. "https://script.google.com/macros/s/XXXX/exec"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId } = req.query;
  if (!appId || typeof appId !== 'string') {
    return res.status(400).json({ ok: false, message: 'Missing appId' });
  }

  try {
    const url = `${APPSCRIPT_BASE}?path=payment-methods&appId=${encodeURIComponent(appId)}`;
    const r = await fetch(url, { method: 'GET' });
    const text = await r.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, raw: text };
    }
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: String(err) });
  }
}
