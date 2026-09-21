// Service Worker Configuration for PWA
// Optimized for iOS and better caching

const CACHE_NAME = 'legacy-app-shell-v2';
const RUNTIME_CACHE = 'legacy-static-runtime-v2';
const RETIRED_CACHE_NAMES = ['cosmiq-v1', 'runtime-cache-v1'];

// Cache critical assets immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => RETIRED_CACHE_NAMES.includes(name))
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fall back to cache for API calls
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Never cache API responses. Cache matching does not isolate entries by
  // account authorization, so an offline fallback could expose a previous
  // session's data after sign-out or an app/account switch.
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/functions/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets - cache first strategy
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        return cached;
      }
      
      return fetch(request).then(response => {
        // Cache new static assets
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
