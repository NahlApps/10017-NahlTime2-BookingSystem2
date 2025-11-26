// app/api/terms/route.ts
import { NextResponse } from 'next/server';

const GAS_BASE_URL = process.env.GAS_BASE_URL; 
// مثال: https://script.google.com/macros/s/XXXX/exec

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get('appId');

  if (!appId) {
    return NextResponse.json({ ok: false, error: 'Missing appId' }, { status: 400 });
  }

  const url = `${GAS_BASE_URL}?action=terms&appId=${encodeURIComponent(appId)}`;

  try {
    const res  = await fetch(url, { method: 'GET', cache: 'no-store' });
    const text = await res.text();

    // نمرر الـ JSON كما هو
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Proxy /api/terms error:', err);
    return NextResponse.json(
      { ok: false, error: 'Proxy error' },
      { status: 500 }
    );
  }
}
