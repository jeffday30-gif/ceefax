const VERSION = 'v12';
const SHELL_CACHE = `ceefax-shell-${VERSION}`;
const API_CACHE = `ceefax-api-${VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/fonts/bedstead.otf',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

const API_CACHE_LIMIT = 50;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== SHELL_CACHE && k !== API_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
    // Tell any open windows the worker just rotated so they can offer a
    // reload. Without this the user has to manually quit + reopen the
    // PWA to see the new shell.
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) client.postMessage({ type: 'sw-updated' });
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(req));
  } else if (url.pathname === '/healthz') {
    // Don't cache health checks.
    return;
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    return new Response('offline', { status: 503, statusText: 'offline' });
  }
}

async function networkFirst(req) {
  const cache = await caches.open(API_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) {
      cache.put(req, res.clone());
      trimCache(API_CACHE, API_CACHE_LIMIT);
    }
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'offline', message: 'No cached copy of this page' }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    );
  }
}

async function trimCache(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  for (let i = 0; i < keys.length - limit; i++) {
    await cache.delete(keys[i]);
  }
}
