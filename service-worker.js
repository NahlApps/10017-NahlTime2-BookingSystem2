// 🔄 غيّر هذا الرقم كل ما حدّثت التصميم / الكود
const CACHE_VERSION = 'nahltime-v3-2025-11-25';
const CACHE_NAME = `nahltime-cache-${CACHE_VERSION}`;

// ملفات مهمة (App Shell)
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './NahlTimeNewLOGO.png',        // لو عندك نسخة محلية
  './favicon.ico',

  // ممكن تضيف مكتبات محلية لو فيه (لو كلها CDN مو ضروري)
];

// 🧱 install → نخزن الملفات الأساسية + skipWaiting
self.addEventListener('install', (event) => {
  console.log('[SW] Install', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // 🔥 فعّل الـ SW الجديد مباشرة
});

// 🧹 activate → نحذف الكاشات القديمة + نسيطر على كل الـ clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('nahltime-cache-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  return self.clients.claim();
});

// 🌐 fetch → Network-first للـ HTML، Cache-first للباقي
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // HTML + navigation → نحاول الشبكة أولًا (لجلب آخر نسخة)
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // باقي الملفات (CSS/JS/صور) → Cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      });
    })
  );
});
