// 🔄 غير هذا الرقم كل ما تسوي تحديث جديد
const CACHE_VERSION = 'nahltime-v3-2025-11-25';
const CACHE_NAME    = `nahltime-cache-${CACHE_VERSION}`;

// ❗ خلك بسيط في البداية: فقط ملفات نعرف إنها موجودة فعلاً
// لو التطبيق داخل فولدر، تأكد من المسارات (مثلاً "./sub/index.html")
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest'
  // لو لاحقًا حفظت لوجو محلي: أضفه هنا مثل:
  // './NahlTimeNewLOGO.png',
];

// 🧱 install – نخزن الـ App Shell لكن "كل ملف لوحده" مع try/catch
self.addEventListener('install', (event) => {
  console.log('[SW] Install:', CACHE_NAME);

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      for (const asset of ASSETS) {
        try {
          // cache.add = fetch + put
          await cache.add(asset);
          console.log('[SW] Cached:', asset);
        } catch (err) {
          // 👈 هنا أصل المشكلة اللي كانت تطلع لك
          console.warn('[SW] Failed to cache asset:', asset, err);
          // ما نرمي error عشان ما يفشل install كله
        }
      }
    })()
  );

  self.skipWaiting(); // فعّل الـ SW الجديد مباشرة
});

// 🧹 activate – حذف الكاش القديم
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate:', CACHE_NAME);

  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('nahltime-cache-') && key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
      await self.clients.claim();
    })()
  );
});

// 🌐 fetch – Network-first للـ HTML، Cache-first للباقي
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const accept = req.headers.get('accept') || '';

  // صفحات HTML / تنقل
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, networkRes.clone());
          return networkRes;
        } catch (err) {
          console.warn('[SW] HTML fetch failed, fallback to cache.', err);
          const cached = await caches.match(req);
          return cached || caches.match('./index.html');
        }
      })()
    );
    return;
  }

  // باقي الملفات (CSS/JS/صور…)
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const networkRes = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, networkRes.clone());
        return networkRes;
      } catch (err) {
        console.warn('[SW] Asset fetch failed:', req.url, err);
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      }
    })()
  );
});
