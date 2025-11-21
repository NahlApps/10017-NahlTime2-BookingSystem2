const CACHE_NAME = 'nahltime-cache-v1';

// ✅ مسارات نسبية لأن الـ SW داخل مجلد /10017-NahlTime2-BookingSystem2/
const PRE_CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  // أضف ملفاتك المحلية (إن وجدت):
  // './styles.css',
  // './main.js',
];

// Install: cache basic shell
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRE_CACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch((err) => {
          console.error('[SW] Fetch failed:', err);
          // ممكن مستقبلاً تضيف صفحة offline.html
          return new Response(
            '⚠ غير متصل بالإنترنت حاليًا. الرجاء المحاولة لاحقًا.',
            {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            }
          );
        });
    })
  );
});
