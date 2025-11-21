// NahlTime2 Booking PWA Service Worker
// Scope: ./ (subfolder)
// Make sure index.html is cached and used for all navigation requests.

const CACHE_NAME = 'nahltime2-cache-v3';
const OFFLINE_URL = './index.html';

// Files we want to cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest'
];

// ---- Install ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })()
  );
});

// ---- Activate ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key.startsWith('nahltime2-cache-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      );
      await self.clients.claim();
    })()
  );
});

// ---- Fetch ----
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET
  if (request.method !== 'GET') return;

  // 1) All navigations (PWA open, address bar, internal links)
  //    → always serve our cached index.html (SPA style)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        // Prefer cached index.html if available
        const cached = await cache.match(OFFLINE_URL);
        if (cached) {
          return cached;
        }

        // First load (or cache missing): try network, then fallback
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            // Store as offline copy for next time
            cache.put(OFFLINE_URL, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // If completely offline and we don't have cache yet
          return new Response(
            'You are offline and the app is not cached yet.',
            { status: 503, statusText: 'Offline' }
          );
        }
      })()
    );
    return;
  }

  // 2) For same-origin assets (CSS, JS, images…): cache-first, then network
  if (request.url.startsWith(self.location.origin)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
          return response;
        } catch (err) {
          // If network fails and no cache, just fail normally
          return new Response('Network error', {
            status: 408,
            statusText: 'Network error'
          });
        }
      })()
    );
  }
});
