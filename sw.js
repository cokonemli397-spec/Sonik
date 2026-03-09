const CACHE_VER = 'sonik-v4';
const SHELL_CACHE = CACHE_VER + '-shell';
const FONT_CACHE  = CACHE_VER + '-fonts';
const SHELL_ASSETS = ['./', './index.html'];

// Install — cache app shell immediately
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL_ASSETS))
      .catch(() => {}) // don't block install on network errors
  );
});

// Activate — delete old caches from previous versions
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('sonik-') && k !== SHELL_CACHE && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Google Fonts — Cache First (fonts rarely change)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // App shell (same origin) — Stale-While-Revalidate
  // Serves from cache instantly, updates in background
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(SHELL_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(res => {
            if (res && res.status === 200 && res.type === 'basic') {
              cache.put(e.request, res.clone());
            }
            return res;
          }).catch(() => null);
          // Return cached immediately, fetch runs in background
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // External (lyrics APIs etc.) — Network First, fallback to cache
  e.respondWith(
    fetch(e.request)
      .then(res => res)
      .catch(() => caches.match(e.request))
  );
});
