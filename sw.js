/* sw.js — v14.4 本草 學習 모듈 추가 서비스 워커 (2026-05-19 herbs build)
 *
 *  v14.4 변경 (이번 빌드):
 *   • 「本草 學習」 모듈 신규 — 시험범위 7장·8장 등장 약재 42종의 메타 카드
 *     (性味·歸經·功效·시험 핵심 포인트) + HG_FORMULAS 역인덱스로 약재→처방 자동 매핑.
 *     의서궁에 「本草學習」 진입 버튼, 方鑑 헤더에 미니 버튼.
 *     데이터: data-v14-herbs.js, UI: bangje-v14-herbs.js.
 *   • 헬게이트 약식표기 범위 확대 — HERB_ALIASES 196→141(중복 63 union),
 *     HERB_COMPOUNDS 35→86 (사군자탕·이진탕·사물탕·황련해독탕·평위산·소시호탕·
 *     소승기탕·계지탕·마황탕·백호탕·이중탕·교애탕 등 12개 처방군 약식 추가).
 *     채점 정규화: tokenize에 한문/유니코드 구두점 추가, matchKeyword에 한글
 *     처방명 접미사(湯·散·丸·音·고·단) 동치 처리. 시뮬레이션 22/22 통과.
 *   • 原文 드릴 +8문 (37문) — 족보 PDF 인용 신규 추가:
 *     pyori: 대시호탕(동의보감 작약·대황·지실 配伍)·방풍통성산(三邪同治)·
 *            갈근芩連湯(상한론 35조)·석고탕(深師方 立方 의도)
 *     boik:  사군자탕(命名 의의)·삼령백출산(국방 久服)·보중익기탕(東垣 立方 본의)·
 *            생맥산(의학입문 一補一淸一斂).
 *
 *  v14.3 변경 (이전 빌드, 누적):
 *   • 原文 드릴 실시간 채점 + 첫 구절 도입부(始) + 같은 글자 인터체인저블.
 *   • 오우거 이스터에그 사진 로컬화 (ogre-egg.webp).
 *   • 의서궁 8房 카드 캐릭터 명언 말풍선 (staggered 등장 애니메이션).
 *   • 關係圖 해상도 향상 — 컨테이너 1100px · 78vh · 초기 1.3× 줌.
 *   • 처방 탭에 옥병풍산·생맥산·도홍사물탕 3개 추가 (8장 補益劑 완비).
 *
 *  v14.2 변경 (이전 빌드):
 *   • 「原文 配列 드릴」 패치 — 족보 인용 한문 원문 토막 배열.
 *     데이터: data-v14-drill.js — 처방별 원문 토막 + 한글 해석 + 출전.
 *
 *  v14.1 변경 (이전 빌드):
 *   • 「關係圖」 패치 — 處方 Network 시각화 추가.
 *
 *  v14 변경 (이전 빌드):
 *   • 「方鑑」 패치 — 표리쌍해제(7장) + 보익제(8장) 시각적 매핑 화면 추가.
 *
 *  v11.6.2 변경 (이전 빌드):
 *   • 방미큐브 orphan 본초 15종 제거. HERBS 79 → 64.
 *   • 진단학 MCQ 에서 변증(pattern) 축 제거.
 *   • 서술형 기출 플래시카드 모드 추가.
 *
 *  v11.6.1 변경 (이전 빌드, 누적):
 *   • 하단 nav 과목별 분리. 경혈학 라우팅 경합 픽스.
 *
 *  ★ 캐시 키 build timestamp bump → SW 강제 재install + PRECACHE 재다운로드
 */
const CACHE = 'bangje-pwa-v14-4-herbs-' + (new Date().toISOString().slice(0,10).replace(/-/g,''));
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
  // v14.3: 오우거 이스터에그 이미지
  './ogre-egg.webp',
  // v14.4: 本草 學習 — 시험범위 약재 42종 메타 + 자동 인덱스
  './data-v14-herbs.js',
  './bangje-v14-herbs.js',
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
