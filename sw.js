/* sw.js — v9.7 서비스 워커
 * network-first index.html / app.js / bangje-cube.js / bangje-v9{6,7}-*.js (개발 편의),
 * cache-first 나머지 정적 파일 (data, icons, manifest).
 *
 * v9.7: 業績/시그니처 시스템 추가
 *   • data-achievements.js, data-signatures.js (정의)
 *   • bangje-v97-achievements.js (업적 추적)
 *   • bangje-v97-signatures.js (캐릭터 시그니처 효과)
 *   • bangje-v97-profile.js (印章 프로필 + 업적 갤러리)
 *   • 캐릭터 사진 → images/characters/ 폴더로 이동
 *   • 캐시 키 갱신
 */
const CACHE = 'bangje-pwa-v11-3-2026-05';
const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './bangje-cube.js',
  './bangje-v96-part1.js',
  './bangje-v96-part2.js',
  './bangje-v96-part3.js',
  './bangje-v96-part4.js',
  './bangje-v96-part5.js',
  './bangje-v97-achievements.js',
  './bangje-v97-signatures.js',
  './bangje-v97-profile.js',
  './bangje-v97-formuladict.js',
  // v9.8 모듈
  './bangje-v98-srs.js',
  './bangje-v98-drill.js',
  './bangje-v98-canvas.js',
  './bangje-v98-diff.js',
  './bangje-v98-weighted.js',
  './bangje-v98-hanyin.js',
  './bangje-v98-herbpop.js',
  './bangje-v98-dictplus.js',
  './bangje-v98-resonance.js',
  './bangje-v98-leeline.js',
  './bangje-v98-cube-rules.js',
  './bangje-v98-modal-alert.js',
  './bangje-v98-home.js',
  './bangje-v98-bootstrap.js',
  // v10 모듈
  './bangje-v99-sichen-clock.js',
  './bangje-v99-meridian-body.js',
  './bangje-v99-hotfix.js',
  './bangje-v99-herbtap.js',
  './bangje-v99-cubesort.js',
  // v11 모듈 — 醫書宮 hub
  './bangje-v11-clinic-hub.js',
  // v11 진단학 — 동무의 방
  './bangje-v11-jindan.js',
  './data-jindan-tongue.js',
  // v11 신규 캐릭터 사진
  './saamdoin.jpeg',
  './lindaoren.jpeg',
  './data-physicians.js',
  './data-ranks.js',
  './data-factions.js',
  './data-formulas.js',
  './data-formulas-extra.js',
  './data-additions.js',
  './data-questions-bulk.js',
  './data-syndromes.js',
  './data-neijing.js',
  './data-achievements.js',
  './data-signatures.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
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
  // network-first: index.html, app.js, bangje-cube.js, v9x/v1x 모듈, data-*.js (변경이 잦은 코드+데이터)
  const networkFirst =
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('app.js') ||
    url.pathname.endsWith('bangje-cube.js') ||
    url.pathname.endsWith('sw.js') ||
    /bangje-v(9[6789]|1[01])-[\w-]+\.js$/.test(url.pathname) ||
    /\/data-[\w-]+\.js$/.test(url.pathname);
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
