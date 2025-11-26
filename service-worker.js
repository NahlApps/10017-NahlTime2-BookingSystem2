// service-worker.js (نسخة خفيفة بدون ضغط كبير على الكاش)

const CACHE_NAME = 'nahltime-shell-v1';

// نخزن فقط ملفات صغيرة / أساسية من نفس الدومين
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest'
  // لو أضفت ملفات JS/CSS محلية (وليس من CDN) أضفها هنا
];

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(CORE_ASSETS);
        console.log('[SW] Core assets cached');
      } catch (err) {
        // هنا نمسك أي QuotaExceededError أو غيره حتى لا يظهر Uncaught (in promise)
        console.error('[SW] Error while caching core assets:', err);
      }
    })()
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');

  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        );
      } catch (err) {
        console.error('[SW] Error while cleaning old caches:', err);
      }

      await self.clients.claim();
    })()
  );
});

// 🎯 إستراتيجية بسيطة:
// - لو الطلب "navigate" (فتح صفحة)، نحاول الشبكة أولاً
//   وإذا فشل (أوفلاين) نرجع index.html من الكاش.
// - باقي الطلبات نتركها تمر للشبكة بدون تخزين جديد في الكاش
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // فقط طلبات التنقّل (navigation)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // نحاول من الشبكة أولاً
          const networkResp = await fetch(request);
          return networkResp;
        } catch (err) {
          console.warn('[SW] Network failed for navigation, trying cache:', err);
          // لو أوفلاين نرجع index.html
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match('./index.html');
          return cached || Response.error();
        }
      })()
    );
  }
  // باقي الطلبات: لا نعمل caching إضافي حتى لا نستهلك الكوتا
});
