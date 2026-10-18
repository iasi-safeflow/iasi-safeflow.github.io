// SafeFlow service worker: lets the installed web app open without internet.
// scripts/postexport-web.js replaces the two placeholders below at build time.
// - Page loads: network first, falling back to the cached app shell when offline.
// - App files (/_expo/static/*, hashed and immutable): precached and served from cache.
// - Cross-origin requests (API, map tiles): never touched, so reports are never stale and tiles are not bulk-cached.
const BUILD_ID = '__BUILD_ID__';
const PRECACHE = __PRECACHE__;
const CACHE = `safeflow-${BUILD_ID}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['/', ...PRECACHE]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // A new deploy has a new BUILD_ID: drop every older cache.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('safeflow-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.pathname === '/') {
            const copy = res.clone(); // clone now, before the browser consumes the body
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
