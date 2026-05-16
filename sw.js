// 방제학 PWA — Service Worker
const CACHE_VERSION = 'bangje-v1';
const CACHE_FILES = [
  './',
  './index.html',
  './data-formulas.js',
  './modules-1.js',
  './modules-2.js',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(c => c.addAll(CACHE_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Network-first for index.html (so updates propagate fast)
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-first for the rest
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      // cache same-origin GETs
      if (e.request.method === 'GET' && url.origin === self.location.origin) {
        const clone = resp.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
      }
      return resp;
    }))
  );
});
