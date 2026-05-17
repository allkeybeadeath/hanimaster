/* sw.js — v2.2 서비스 워커
 * network-first index.html / app.js (개발 편의),
 * cache-first 나머지 정적 파일 (data, icons, manifest).
 *
 * v2.2: icon.svg 제거 (SVG 전면 폐기), 신농 아이콘으로 변경.
 */
const CACHE = 'bangje-pwa-v3-2026-05';
const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './data-physicians.js',
  './data-ranks.js',
  './data-formulas.js',
  './data-questions-bulk.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './shennong.webp',
  './shennong.png',
  './leesoonjae-medallion.jpeg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(()=>{})).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  // network-first: index.html, app.js (변경이 잦음)
  const networkFirst = url.pathname.endsWith('index.html') || url.pathname.endsWith('/') || url.pathname.endsWith('app.js');
  if(networkFirst){
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return r;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // cache-first: 나머지
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(r => {
      const copy = r.clone();
      if(r.status === 200) caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return r;
    }))
  );
});
