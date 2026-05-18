# CHANGELOG v11.6.0 patched — 2026-05-18

## 4가지 사용자 보고 픽스 (시험 D-2)

### 1) 경혈학 (舍巖之房) 정식 통합

**증상**: 의서궁 타일 클릭 → "준비 중" 모달만 떴음. 새 패치 모듈은 ZIP 에는 있었으나 `index.html` 에 `<script>` 태그 누락.

**원인 (3중 누락)**:
- `bangje-v11-6-acupoints.js` 가 `sw.js` PRECACHE 에는 등록됐으나 `index.html` 에서 로드되지 않음
- `bangje-v11-clinic-hub.js` 의 `SUBJECTS` 에서 saamdoin 이 `status:'placeholder', route:null` 로 잠겨 있음 → 타일 클릭이 `_openPlaceholder()` 로 분기
- 신규 모듈 `V11Saam` 이 `window.ROUTES.saamdoin` 을 자체 등록하지 않음 (구버전 `V11Jingxue` 만 등록)

**픽스 (`index.html`, `bangje-v11-clinic-hub.js`, `bangje-v11-6-acupoints.js`)**:
- `index.html`: `bangje-v11-6-acupoints.js` + `data-acupoints.js` script 태그 추가 (구 `jingxue-race` 는 호환을 위해 먼저 로드 유지)
- `bangje-v11-clinic-hub.js`: SUBJECTS saamdoin → `status:'active', route:'saamdoin'`
- `bangje-v11-6-acupoints.js`: 파일 끝에 `window.ROUTES.saamdoin = openHome` + `ROUTES.jingxue` 백워드 호환 등록. `openHome()` 에 `setHeaderContext('saamdoin')` 추가
- 로딩 순서가 `jingxue-race → acupoints` 이므로 신규 V11Saam 라우트가 구버전을 덮어쓰며 우선권 확보

### 2) 五輸穴 레이스 표시

**증상**: 위 ①번이 해결되며 자동 해결. saamdoin 라우트가 진입 가능해지면서 `openHome()` 의 五輸穴 레이스 카드 (싱글·멀티) 가 렌더됨.

**추가 보강**: 신규 V11Saam 의 멀티는 `saam_rooms/{rid}` Firebase 노드를 사용 — 구버전 placeholder 가 아닌 정식 구현. 룸 lifecycle (`lobby → racing → finished`) 정상 동작.

### 3) 과목별 하단 nav 분리

**증상**: 진단학·경혈학 房 진입 시에도 하단 nav 가 `處方·약재·암기·기출·통계·명예` 그대로 표시 — 방제학 전용 탭이 모든 過目에 그대로 떠 있던 버그.

**원인**: `index.html` 의 `<nav class="bottom-nav">` 가 정적 마크업. `setHeaderContext()` 는 상단 헤더만 갱신, 하단을 건드리지 않았음.

**픽스 (`app.js`)**:
- `HEADER_CTX` 의 각 컨텍스트 객체에 `bottomNav` 배열 추가 — `{ic, lb, tab?, call?}` 구조
- 신규 `_rebuildBottomNav(items)` 함수: 컨텍스트 진입 시 `.bottom-nav-inner` innerHTML 을 동적으로 재구성. `data-tab` 은 `setTab()` 호출, `data-call` 은 `'V11Jindan.openGallery'` 같은 점-구분 경로를 `window` 에서 lookup 후 실행 (`:` 뒤 인자 지원, 예: `V11Saam.openSingle:shu`)
- `setHeaderContext()` 가 `c.bottomNav` 발견 시 자동 호출
- `setTab()` 에 `CTX_BY_TAB` 매핑 추가 — 방제학 탭(home/formula/...)으로 돌아갈 때 컨텍스트 자동 복원

**컨텍스트별 탭 구성**:
| 컨텍스트 | 탭 구성 |
|---|---|
| `shennong` (방제학) | 家 대청 · 方 처방 · 藥 약재 · 卡 암기 · 問 기출 · 析 통계 · 譽 명예 |
| `hub` (의서궁) | 宮 의서궁 (실제로는 `.on-hub` 가 nav 숨김) |
| `dongmu` (진단학) | 宮 醫書宮 · 武 동무 · 圖 圖鑑 · 對 對位 · 問 問答 · 速 速習 · 析 析究 |
| `saamdoin` (경혈학) | 宮 醫書宮 · 舍 사암 · 獨 싱글 · 群 멀티 |

### 4) 對位 매트릭스 사진 클릭 확대 (라이트박스)

**픽스 (`bangje-v11-tongue-matrix.js`)**:
- 신규 `_openLightbox(src, caption)` 함수: 풀스크린 오버레이 (`.mx-lightbox-bg`, z-index 10000). 사진을 `max-height:92vh, object-fit:contain` 으로 표시
- 닫기 트리거: 오버레이 클릭 / 사진 클릭 (cursor: zoom-out) / 우상단 × 버튼 / ESC 키
- **모달의 `.pho` 클릭**: `_openDetailModal()` 에서 `.pho` 에 click 핸들러 추가 → 캡션 `"01. 淡白舌·薄白苔 — 정상설"` 형태로 라이트박스 호출
- **tray 타일 ⤢ 버튼**: `_trayHTML()` 에 우하단 `<div class="mx-tile-zoom">⤢</div>` 추가. drag 와 충돌 안 나게 `_attachDragSources()` 에서 `pointerdown` 가드 + `mx-tile-zoom` 의 `pointerdown.stopPropagation` 으로 분리
- 셀에 안착된 thumb 클릭 → 기존 detail modal 경유 → 모달의 `.pho` 클릭 → 라이트박스

### 5) 「對位 · 전부다」 분리

**픽스 (`bangje-v11-jindan.js`, `bangje-v11-tongue-matrix.js`)**:
- 동무의 방 home 의 단일 `對位` 버튼 → **「對位 · 기존」 + 「對位 · 전부다」 2개 버튼**
- `V11Matrix.openStudy()` 신설: `_state.mode = 'study'` 로 초기화 후 즉시 `_renderStudy()` 진입 — drag-drop 없이 정답 5×5 가 일괄 표시
- `openStudy` 를 `window.V11Matrix` API 에 export
- `duiwei-all` 모드의 fallback: 구 버전 module 로딩 시 `open()` 후 `#mx-toggle` 시뮬 클릭

---

## 변경 파일

```
index.html                       (+5  -2)   scripts 추가
bangje-v11-clinic-hub.js         (+7  -1)   SUBJECTS · CHANGELOG
bangje-v11-jindan.js             (+18 -4)   對位 2버튼 + 컨텍스트
bangje-v11-tongue-matrix.js      (+92 -10)  라이트박스 + openStudy + ⤢
bangje-v11-6-acupoints.js        (+14 -0)   ROUTES + 헤더 컨텍스트
app.js                           (+56 -10)  HEADER_CTX.bottomNav 시스템
sw.js                            (+9  -10)  캐시 키 bump + 헤더 갱신
```

---

## 검증

```
$ python3 validate.py
═══ ① JS 문법 (node -c) ═══
  ✓ app.js / clinic-hub / jindan / tongue-matrix / acupoints / jingxue-race / sw.js
═══ ② index.html — 모듈 등록 ═══       (3/3)
═══ ③ clinic-hub — saamdoin 활성화 ═══ (4/4)
═══ ④ acupoints — 라우트 + 헤더 ═══    (4/4)
═══ ⑤ app.js — bottomNav 컨텍스트 ═══  (6/6)
═══ ⑥ tongue-matrix — 라이트박스 ═══   (7/7)
═══ ⑦ jindan — 對位 두 버튼 분리 ═══   (6/6)
═══ ⑧ sw.js — 캐시 버전 bump ═══       (3/3)

━━━ ALL PASS: 40/40 ━━━
```

---

## 인수 체크리스트 (배포 후 단말 확인)

- [ ] PWA 재로드 시 `caches.keys()` 에 `bangje-pwa-v11-6-0-build-20260518-2000` 만 남음 (이전 캐시 자동 폐기)
- [ ] 의서궁 진입 → 舍巖之房 타일 status 가 "運營" (緑) 으로 표시
- [ ] 舍巖之房 클릭 → `openHome()` 진입 → 五輸穴 레이스 카드 + 모드 선택 카드 표시
- [ ] 싱글 레이스 → AI bot 들과 race 정상 진행
- [ ] 멀티 對決 → 룸 생성/입장 → 동기화 정상 (FB `saam_rooms` 노드 확인)
- [ ] 진단학 진입 시 하단 nav 가 `宮·武·圖·對·問·速·析` 로 교체
- [ ] 경혈학 진입 시 하단 nav 가 `宮·舍·獨·群` 로 교체
- [ ] 방제학 home 으로 돌아가면 하단 nav 원복 (`家·方·藥·卡·問·析·譽`)
- [ ] 동무의 방 → 「對位 · 기존」 → drag-drop 정상
- [ ] 동무의 방 → 「對位 · 전부다」 → 정답 5×5 일괄 표시
- [ ] 對位 매트릭스 cell 클릭 → 상세 모달 → 사진 클릭 → 풀스크린 확대 → ESC/× 로 닫기
- [ ] tray 타일 ⤢ 버튼 클릭 → drag 시작 안 됨, 라이트박스만 뜸

---

## 후속 작업 (v11.7 후보)

- 경혈학 五輸穴 데이터: 현재 `bangje-v11-6-acupoints.js` 내부 코드 정의 의존 → `data-acupoints.js` 로 외화 가능 여부 점검
- 라이트박스 swipe (좌/우 스와이프로 인접 사진 이동)
- 「對位 · 전부다」 모드 위에 카테고리 필터 (舌質/舌苔/兼) — 24/20/4 장 그룹별 펼침
- 진단학 하단 nav 의 對 버튼 — 현재 `V11Matrix.open()` 호출, 전부다 진입 메뉴 추가 검토
- 시험일 (2026-05-20) 후 v12 로 hub 전체 리팩토링
