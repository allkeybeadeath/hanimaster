/* sw.js — v11.6 서비스 워커 (2026-05-18 update fix)
 *
 *  v11.6 변경:
 *   • 의서궁 同學 활동상태 통합 픽스 — [object Object] 렌더 버그 수정
 *   • 진단학·경혈학·설진 진입 시 V96Activity 자동 갱신
 *   • 對位 매트릭스 48장 全 매핑
 *   • 진단학 참고서적 패널
 *
 *  ★ 캐시 키에 빌드 timestamp 박음 (`-build-20260518-...`) →
 *    이전 SW 와 byte-level 차이 발생 → 브라우저가 새 SW install + activate →
 *    기존 캐시 (v11.5 / v11.6 초기 빌드) 자동 폐기 + PRECACHE 전체 재다운로드.
 *
 *  network-first: index.html / app.js / 모든 bangje-v*-*.js / data-*.js  (변경 잦음)
 *  cache-first:   icons / manifest / 사진 (변경 적음)
 */
const CACHE = 'bangje-pwa-v11-6-build-20260518-1830';
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
  // v9.9 / v10 모듈
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
  // v11.4 — 對位 매트릭스
  './bangje-v11-tongue-matrix.js',
  // v11.6 — 경혈학 (舍巖之房) 五輸穴 레이스
  './bangje-v11-jingxue-race.js',
  // v11.6 — 경혈 도표 (acupoints) — 누락 → 추가
  './bangje-v11-6-acupoints.js',
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
  './data-acupoints.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE).catch(()=>{}))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

// v11.6: 페이지에서 SW 에게 강제 update 요청 가능 (postMessage 'SKIP_WAITING')
self.addEventListener('message', e => {
  if(e && e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  // network-first: index.html, app.js, bangje-cube.js, 모든 v9x/v1x 모듈, data-*.js
  const networkFirst =
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('app.js') ||
    url.pathname.endsWith('bangje-cube.js') ||
    url.pathname.endsWith('sw.js') ||
    /bangje-v(9[6789]|1[01])(?:[-.\d]+)?[-\w]*\.js$/.test(url.pathname) ||
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
