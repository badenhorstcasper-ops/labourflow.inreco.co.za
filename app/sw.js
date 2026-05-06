// LabourFlow Service Worker v1.0
// Caches the app shell for full offline capability

const CACHE_NAME = 'labourflow-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/app/',
  '/app/index.html',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap'
];

// ── INSTALL — cache all assets ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.log('SW: Some assets failed to cache — continuing anyway', err);
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE — clean old caches ─────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH — serve from cache, fall back to network ──────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Anthropic API calls — must go to network
  if (url.hostname === 'api.anthropic.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Never intercept PayFast calls
  if (url.hostname.includes('payfast')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For everything else — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // If fetch fails and nothing cached — return offline fallback for HTML
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/app/index.html');
        }
      });
    })
  );
});
