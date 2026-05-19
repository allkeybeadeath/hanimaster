/* sw.js — v14.2 原文 配列 드릴 추가 서비스 워커 (2026-05-19 drill build)
 *
 *  v14.2 변경 (이번 빌드):
 *   • 「原文 配列 드릴」 패치 — 족보에 인용된 한문 원문을 토막내어 무작위 순서로 섞은 뒤
 *     사용자가 정답 순서대로 배열하는 암기 드릴. 표리쌍해제 13문 + 보익제 13문.
 *     예: 대시호탕 의종금감 평 "斯方也, 柴胡得生薑之倍, 解半表之功捷; 枳·芍得大黃之少..."
 *     인터랙션: 풀에서 토막 클릭 → 슬롯 채움 / 슬롯 클릭 → 되돌리기 / 채점 → 색상 표시.
 *     의서궁·홈에 銅色 「原文 드릴 NEW」 배너, 方鑑 헤더에 미니 버튼.
 *     데이터: data-v14-drill.js — 처방별 원문 토막 + 한글 해석 + 출전.
 *
 *  v14.1 변경 (이전 빌드):
 *   • 「關係圖」 패치 — 處方 Network 시각화 추가.
 *
 *  v14 변경 (이전 빌드):
 *   • 「方鑑」 패치 — 표리쌍해제(7장) + 보익제(8장) 시각적 매핑 화면 추가.
 *     의서궁·방제학 home의 헬게이트 배너 바로 아래에 「方鑑 NEW」 黃금 배너 삽입.
 *     화면 구성: 분류표 / 13 主要方 카드 / 派生 系譜 (理中→四君→八方) /
 *     용량 비교표 (大柴胡 vs 小承氣 등) / 處方×本草 매트릭스 / 五積 분해 /
 *     비교 카드 (백호 vs 당귀보혈) / 22 함정 카드 9종.
 *     데이터: data-v14-relations.js (계보·용량·五積·함정 메타) — FORMULAS는 기존 그대로 활용.
 *
 *  v11.6.2 변경 (이전 빌드):
 *   • 방미큐브 orphan 본초 15종 제거 — 처방 어디에도 없는 飴糖·龍眼肉·山茱萸·龜板·鱉甲·
 *     石斛·沙蔘·肉蓯蓉·巴戟天·蜀椒·茯神·通草·石菖蒲·豬脊髓·麝香 (v11.5.4 syllabus 축소
 *     이후 HERBS dict 에 잔존). HERBS 79 → 64. 본초 팝오버·카드 對決 distractor 정화.
 *   • 진단학 MCQ 에서 변증(pattern) 축 제거 — 시험은 설체·설태(라벨)만.
 *   • 서술형 기출 플래시카드 모드 추가 — 22~18학번 4년치 서술형 문제 (보혈제까지).
 *
 *  v11.6.1 변경 (이전 빌드, 누적):
 *   • 하단 nav 과목별 분리 — body.on-dongmu / on-saam CSS 추가 + body class 중앙 관리.
 *     setHeaderContext 가 _rebuildBottomNav 와 함께 body class 까지 토글하므로
 *     어느 경로로 진입해도 색상·표시 일관성 보장.
 *   • 경혈학 라우팅 경합 픽스 — 구 jingxue-race 의 setTimeout(300) 재등록이
 *     신 V11Saam 의 즉시 등록을 덮어쓰던 버그 제거. V11Saam 이 0/100/500/1500ms
 *     4단계 잠금으로 어떤 타이밍에도 신모듈이 최종 등록 보장.
 *
 *  ★ 캐시 키 build timestamp bump → SW 강제 재install + PRECACHE 재다운로드
 */
const CACHE = 'bangje-pwa-v14-3-realtime-' + (new Date().toISOString().slice(0,10).replace(/-/g,''));
const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './bangje-v12-mahjong.js',
  './bangje-v12-multi-intro.js',
  './bangje-v12-jingxue-poker.js',
  './bangje-v96-part1.js',
  './bangje-v96-part2.js',
  './bangje-v96-part3.js',
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
  // v11.6.1 — 서술형 기출 플래시 (4년치 22~18학번, 보혈제까지)
  './data-essay-exams.js',
  './bangje-v11-6-1-essay-flash.js',
  // v13: 헬게이트 (獄門) — 논스톱 주관식 100+문제
  './data-hellgate.js',
  './bangje-v13-hellgate.js',
  './bangje-v13-integration.js',
  // v14: 方鑑(방감) — 표리쌍해제 + 보익제 시각적 매핑
  './data-v14-relations.js',
  './bangje-v14-pyori-bo-map.js',
  // v14: 關係圖(관계도) — 處方 Network · pan/zoom 인터랙티브 SVG
  './data-v14-graph.js',
  './bangje-v14-graph.js',
  // v14.2: 原文 配列 드릴 — 한문 원문을 토막내어 순서대로 배열
  './data-v14-drill.js',
  './bangje-v14-drill.js',
  // v11 신규 캐릭터 사진
  './saamdoin.jpeg',
  './lindaoren.jpeg',
  // v14.3: 오우거 이스터에그 이미지
  './ogre-egg.webp',
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
  // network-first: index.html, app.js, 모든 v9x/v1x 모듈, data-*.js, v12 모듈
  const networkFirst =
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('app.js') ||
    url.pathname.endsWith('sw.js') ||
    /bangje-v(9[6789]|1[012])(?:[-.\d]+)?[-\w]*\.js$/.test(url.pathname) ||
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
