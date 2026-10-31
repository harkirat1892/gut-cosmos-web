// Offline cache for the web/PWA build. Page loads are network-first (so new deploys show up),
// everything else same-origin is cache-first (Vite asset names are content-hashed).
const CACHE = 'gut-cosmos-v2';

// Precache the page plus the hashed JS/CSS it references, so the first visit already works offline.
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('./', { cache: 'no-cache' });
      const html = await res.clone().text();
      await cache.put('./', res);
      const assets = [...html.matchAll(/(?:src|href)="(\.?\/[^"]+)"/g)].map((m) => m[1]);
      await cache.addAll([...assets, './icon-192.png', './icon-512.png']);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit ?? caches.match('./'))),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
