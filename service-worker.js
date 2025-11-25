// 🔄 غير هذا الرقم كل ما تسوي تحديث جديد
const CACHE_VERSION = 'nahltime-v4-2025-11-26';
const CACHE_NAME    = `nahltime-cache-${CACHE_VERSION}`;

// ملفات أساسية فقط (تأكد أن المسارات صحيحة)
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest'
];

// 🧱 install – نخزن الـ App Shell لكن كل ملف لوحده مع try/catch
self.addEventListener('install', (event) => {
  console.log('[SW] Install:', CACHE_NAME);

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
          console.log('[SW] Cached:', asset);
        } catch (err) {
          console.warn('[SW] Failed to cache asset:', asset, err);
          // ما نرمي error عشان ما نفشل الـ install كله
        }
      }
    })()
  );

  self.skipWaiting();
});

// 🧹 activate – حذف الكاشات القديمة
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

// 🌐 fetch – Network-first للـ HTML، Cache-first لباقي GET فقط
self.addEventListener('fetch', (event) => {
  const req    = event.request;
  const method = req.method || 'GET';
  const accept = req.headers.get('accept') || '';

  // ❌ مهم: تجاهل أي طلب غير GET (POST, PUT, DELETE...)
  if (method !== 'GET') {
    // مثلاً /reserveAppointment أو /api/... تظل تروح مباشرة للسيرفر
    event.respondWith(fetch(req));
    return;
  }

  // صفحات HTML / تنقل
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(req);
          const cache      = await caches.open(CACHE_NAME);
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

  // باقي ملفات GET (CSS/JS/صور…)
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const networkRes = await fetch(req);
        const cache      = await caches.open(CACHE_NAME);
        cache.put(req, networkRes.clone());
        return networkRes;
      } catch (err) {
        console.warn('[SW] Asset fetch failed:', req.url, err);
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      }
    })()
  );
});
