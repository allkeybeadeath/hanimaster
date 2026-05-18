# CHANGELOG v11.6.1 — 2026-05-18 (fix build, 2회차)

## 사용자 보고 4건 + 원래 요청 3건 = 7건 일괄 처리

### 1) 하단 nav 과목별 분리 (재발 픽스)

**증상**: v11.6.0 patched 에서 「과목별 분리」 했다고 했으나 사용자 보고 — 여전히 분리 안 됨.

**근본 원인 (이번에 발견)**:
- `_rebuildBottomNav` 자체는 호출되지만 body class(`on-hub` / `on-dongmu` / `on-saam`) 가 분산 관리.
- `bangje-v11-clinic-hub.js` 의 `_wrapSetTab` 은 `on-hub` 만 토글, `on-dongmu`·`on-saam` 은 손도 안 댐.
- `bangje-v11-6-acupoints.js` 의 `openHome` 만 `on-saam` 토글 — 하지만 ROUTES 경합으로 (#2 참조) 실제로는 OLD 가 호출되어 `on-saam` 안 붙음.
- CSS 에 `body.on-dongmu`·`body.on-saam` 규칙이 아예 없어서 진단학·경혈학 진입 시 시각적 분리가 안 보이는 게 정상.

**픽스 (`app.js`, `index.html`, `bangje-v11-clinic-hub.js`)**:
- `_rebuildBottomNav(items, ctxId)` 시그니처 변경 — `ctxId` 인자 추가.
- body class 토글을 `_rebuildBottomNav` 내부로 통합 (단일 진실 출처): `on-hub` / `on-dongmu` / `on-saam` 동시 토글.
- active 클래스도 rebuild 안에서 같이 set — 호출자 코드가 별도로 set 안 해도 됨.
- `index.html` 에 `body.on-dongmu`·`body.on-saam` 용 CSS 추가 (`display:block !important` + 색상 토큰 zhusha/feicui).
- `_wrapSetTab` 의 중복 `on-hub` 토글 제거 — 위임.

### 2) 경혈학 (舍巖之房) 정식 활성화 (재발 픽스)

**증상**: v11.6.0 patched 에서 「신모듈 정식 통합」 했다고 했으나 사용자 보고 — 여전히 경혈학 새 모듈 아닌 OLD placeholder 가 뜸.

**근본 원인 (이번에 발견 — v11.6.0 changelog 가 놓침)**:
- `bangje-v11-jingxue-race.js` (OLD) 의 `setTimeout(_registerRoute, 300)` 이 페이지 로드 ~300ms 후 발화.
- `bangje-v11-6-acupoints.js` (NEW) 는 모듈 로드 직후 (T+0~30ms) `ROUTES.saamdoin = openHome` 등록.
- T+300ms 시점에 OLD 의 setTimeout 이 다시 발화하여 `ROUTES.saamdoin = renderSaamdoinHome` 로 덮어씀.
- 결과: 사용자가 클릭하면 OLD 의 placeholder multi 가 뜸 — v11.6.0 의 「정식 통합」 fix 가 무력화됨.

**픽스 (`bangje-v11-jingxue-race.js`, `bangje-v11-6-acupoints.js`)**:
- OLD 의 `setTimeout(_registerRoute, 300)` 제거. `_registerRouteIfMissing` 로 교체 — `window.V11Saam.openHome` 가 정의되어 있으면 절대 덮어쓰지 않음. 신모듈 미로드 시에만 5초 후 fallback.
- NEW 의 라우트 등록을 0/100/500/1500ms 4단계 다중 잠금으로 강화 — 어떤 타이밍 경합도 신모듈이 최종 등록 보장.
- `bangje-v11-clinic-hub.js` `_registerRoutes` 도 100/500/1500ms 재호출 — jindan 모듈이 늦게 로드되어도 `ROUTES.dongmu = renderDongmuHome` 가 정확히 잡힘.

### 3) 진단학 MCQ — 변증(辨證) 축 제거

**사용자 요청**: 「설진 문제는 변증 말고 설체 설태만 맞추는 선지로」

**픽스 (`bangje-v11-jindan.js`)**:
- `_buildMcqQ`: axes 에서 `pattern` 제거. 이제 `han`(한자 라벨) / `body`(형태) / `quality`(색태) 3축만.
- `_renderSubjQ`: 입력 안내문에서 「辨證」 문구 제거 — 「形態·色苔」 로 교체.
- `_handleSubjAnswer`: 정답 후보(cand)에서 `pattern_han` / `pattern` 제외.
- 단, 답변 후 피드백/상세 모달에는 변증 정보 그대로 표시 — 학습 목적 (시험은 안 보지만 알아두면 좋음).

### 4) 서술형 기출 플래시카드 (4년치, 보혈제까지)

**사용자 요청**: 「방제 서술형 기출 참조해서 서술형만 모은 플래시카드, 문제(시험범위만, 보혈제까지인거 유념)」

**신규 모듈 (`data-essay-exams.js` + `bangje-v11-6-1-essay-flash.js`)**:
- 15문항 수록. 22·21·20·19·18학번 5년치 + 강의 PDF 명시 기출.
- 챕터 분포: 7-1 解表攻裡 3문항 · 7-2 解表淸裡 2문항 · 7-3 解表溫裡 2문항 · 8-1 補氣 4문항 · 8-2 補血 4문항.
- 시험범위 외 (氣血雙補 이후) 처방은 제외 — 단, 십전대보탕은 19학번 빈출이라 학습용으로 1문항 수록 (해설에 「시험범위 외」 명시).
- UX: 문제 → 머리로 답안 구성 → 「답안 보기」 → 채점 핵심 키워드 + 모범 답안 → 자가 평가(익숙/보통/다시).
- 진행도 saveState 자동. 「다시 보기」 범위 필터 지원.
- 플래시 허브 (renderFlashHub) 에 새 타일 추가 — gold 강조, NEW 배지.

### 5) 설진 참고자료 보강

**사용자 요청**: 「설진 자료 찾기」

**픽스 (`data-jindan-tongue.js` `TONGUE_REFERENCES`)**:
- 7종 → 12종으로 확장. 부정확했던 출판사 정보 (대성출판사 → 군자출판사) 정정.
- 추가: 한의진단학 진찰편/진단편 (2019 군자), 한의진단학 실습 (2020 군자), 중의진단학 한역 (홍순석/군자), 설진 임상증례집 컬러 아틀라스 (2008), NCKM 국가한의임상정보포털.
- 업데이트: Maciocia 1995판 (사진 200+) → 2021 3rd ed. (사진 175, 그중 100+ 신규).
- web_search 로 출판 정보 fact-check 완료.

### 7) 방미큐브 — 처방에 없는 본초 정리 (추가 사용자 요청)

**사용자 요청**: 「방미큐브에서 처방에 없는 본초가 있음 그것들 삭제」

**원인**: v11.5.4 에서 시험범위 보혈제까지로 축소하며 氣血雙補劑·補陰劑·補陽劑·陰陽幷補劑 처방 8개를 syllabus 에서 제외했으나, 그 처방들에만 등장하던 본초가 `HERBS` 사전에 잔존. 큐브 본초 팝오버·카드 對決 distractor pool 에서 시험과 무관한 본초가 노출됨.

**픽스 (`data-formulas.js`)**:
15개 orphan 본초 삭제 — `飴糖·龍眼肉·山茱萸·龜板·鱉甲·石斛·沙蔘·肉蓯蓉·巴戟天·蜀椒·茯神·通草·石菖蒲·豬脊髓·麝香`. 각 본초가 어느 (시험범위 외) 처방에 쓰였는지 주석으로 기록.

**검증**: HERBS dict 79 → **64**. "처방 어디에도 없는 본초" = 15건 → **0건**.

**영향 범위** (시험범위 외 본초가 더이상 노출 안 됨):
- 방미큐브 본초 팝오버 (`bangje-cube.js`)
- 카드 對決 distractor pool (`app.js` 5848 — pool 부족 시 HERBS 전체에서 보충하던 코드)
- 약재탭 사이드 정보 (`renderHerbs`)
- 본초 SRS 카드 (`bangje-v98-srs.js`)
- 한자→한글 변환 사전 (`bangje-v98-hanyin.js`)

### 8) SW 캐시 키 bump

`bangje-pwa-v11-6-0-build-20260518-2000` → `bangje-pwa-v11-6-1-build-20260518-2100`
PRECACHE 에 `data-essay-exams.js` + `bangje-v11-6-1-essay-flash.js` 추가.

## 변경 파일 (10개)

| 파일 | +/- 라인 | 변경 요지 |
|---|---|---|
| `sw.js` | +14 / -7 | 캐시 키 bump, PRECACHE 보강, 변경내역 헤더 |
| `index.html` | +12 / -0 | script 태그 추가, body.on-dongmu·on-saam CSS |
| `app.js` | +32 / -19 | `_rebuildBottomNav(items, ctxId)` 시그니처, body class 중앙 관리, 서술형 플래시 타일 |
| `bangje-v11-clinic-hub.js` | +9 / -3 | `_registerRoutes` 다중 시점 재호출, 중복 on-hub 토글 제거 |
| `bangje-v11-jindan.js` | +14 / -10 | MCQ 변증 axis 제거, 주관식 입력 안내 수정, 정답 후보에서 pattern 제외 |
| `bangje-v11-6-acupoints.js` | +19 / -10 | 라우트 잠금 4단계 (0/100/500/1500ms) |
| `bangje-v11-jingxue-race.js` | +13 / -11 | OLD setTimeout(300) 제거, V11Saam 존재 시 등록 차단 |
| `data-jindan-tongue.js` | +60 / -35 | TONGUE_REFERENCES 12종으로 확장, 출판 정보 fact-check |
| `data-essay-exams.js` | NEW (300) | 4년치 서술형 기출 15문항 + 모범 답안 + 채점 키포인트 |
| `bangje-v11-6-1-essay-flash.js` | NEW (240) | 서술형 플래시카드 렌더러 + 자가 평가 + 진행도 saveState |

## 사용자 검증 체크리스트

설치 후 (PWA reload 1회 권장):

- [ ] 의서궁에서 진단학 타일 클릭 → 하단 nav 가 `醫書宮 / 武 / 圖 / 對 / 問 / 速 / 析` 7개로 변경 + 朱砂색 강조선
- [ ] 의서궁에서 경혈학 타일 클릭 → 하단 nav 가 `醫書宮 / 舍 / 獨 / 群` 4개로 변경 + 翡翠색 강조선 + 페이지가 V11Saam (五輸穴 레이스 카드 + 모드 선택) 으로 표시 (placeholder 가 아님)
- [ ] 경혈학에서 「멀티 對決」 클릭 → 룸 로비 (lobby) 화면 (NEW). 「v1.0 (v11.6) — 멀티는 다음 빌드에서 정식 출시 예정」 같은 placeholder 가 아님.
- [ ] 동무의 방에서 「問答」 (MCQ) → 변증(辨證) 묻는 문제 안 나옴. 「形態」 / 「色苔」 / 「舌象 한자 라벨」 만.
- [ ] 동무의 방에서 「主觀」 (주관식) → placeholder 가 「예: 紅舌 / 胖大 / 黃膩苔」 로 변경됨 (이전: 「예: 紅舌 / 열증 / 陰虛」).
- [ ] 방제학 → 「卡 암기」 → 「論·試 서술형 기출 (4년치)」 NEW 타일 등장 → 클릭 시 22학번 1차수시 서술 첫 카드 (대시호탕). 「답안 보기」 → 핵심 키워드 + 모범 답안 → 익숙/보통/다시 평가.
- [ ] 동무의 방 메인에서 참고서적 패널 → 「한의진단학 진찰편 (군자출판사, 2019)」 가 첫번째에 標準 배지로 표시 (이전: 「한방진단학 (대성출판사)」).
