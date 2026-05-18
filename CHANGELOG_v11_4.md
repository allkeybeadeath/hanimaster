# CHANGELOG — v11.4 (2026-05-18)

> **(A) 진입 라우팅 정상화 + (B) 對位 설색×설태 매트릭스 학습세트**
> 5/19 設體 시험 D-1, 5/26 設質 시험 D-8.

## 요약 한 줄

> **醫書宮 hub 첫 진입 정상화 (ROUTES 노출 + setTab 방어 래퍼) + 5×5 설색·설태 매트릭스에 사진을 끌어다 놓는 對位 학습 모드.**

---

## A. 라우팅 버그 픽스

### 증상
앱 첫 진입 시 醫書宮(과목 hub)이 안 뜨고 곧장 神農之房(방제학 home)이 표시. 「宮」 chip 만 헤더에 보임.

### 원인
`app.js` 의 `const ROUTES = {...}` 가 top-level binding 이므로 `window.ROUTES` 로 노출되지 않음.
→ `bangje-v11-clinic-hub.js` 의 `_registerRoutes()` 가 `typeof window.ROUTES === 'undefined'` 검사에서 영원히 setTimeout polling.
→ `ROUTES.hub`·`ROUTES.dongmu` 가 절대 등록 안 됨.
→ `setTab('hub')` → `ROUTES[name] || ROUTES.home` 의 fallback 으로 `renderHome()` 실행 → 방제학 home 이 뜸.

`_injectGungChip` 은 `.head-chips` selector 만 의존하므로 작동 (헤더 「宮」 chip 만 보이고 본문은 방제학) — 이게 버그의 정확한 증거였음.

### 픽스 (2겹)
1. **`app.js`** — `ROUTES` 선언 직후 `window.ROUTES = ROUTES` 1줄 추가.
2. **`bangje-v11-clinic-hub.js`** — `setTab` 래퍼 (`_wrapSetTabForNavToggle`) 를 강화:
   - 원본 `setTab` 호출 후 `name === 'hub'` / `'dongmu'` 면 view 를 비우고 `window.renderClinicHub` / `window.renderDongmuHome` 을 직접 호출.
   - 즉 ROUTES 등록이 실패해도 시각 결과는 정상.
   - 래퍼는 가능한 빨리 (`document.readyState === 'loading'` 이라도) 설치.
3. **`_registerRoutes`** — `window.ROUTES` 부재 시 무한 polling 대신 즉시 skip (래퍼가 대체 작동).
4. **`_forceHubOnFreshSession`** — `window.ROUTES` 의존 제거. `setTab` 만 있으면 강제 hub 진입.

이중 안전망: app.js v11.4 신버전이면 (1) 만으로 충분, 구버전 캐싱 시 (2) 가 커버.

## B. 對位 (대위) — 설색×설태 매트릭스 학습세트

### 컨셉
> 사용자가 설진 사진을 (가로축 舌色 · 세로축 舌苔) 좌표로 끌어다 놓아 학습세트를 능동 구성.

### 軸 정의

| | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| **舌色 (X)** | 淡白 | 淡紅 | 紅 | 絳 | 紫·暗 |
| **舌苔 (Y)** | 無·剝 | 薄白 | 白厚膩 | 黃苔 | 黑苔 |

### 학습 ENTRIES — 24장

| | 淡白 | 淡紅 | 紅 | 絳 | 紫·暗 |
|---|---|---|---|---|---|
| **無·剝** | 1 | · | 3 | 2 | · |
| **薄白** | 1 | 4 | · | · | 1 |
| **白厚膩** | 1 | 1 | 1 | · | 2 |
| **黃苔** | · | 1 | 3 | 2 | 1 |
| **黑苔** | · | · | · | · | · |

- **explicit** 7장 — 교재 라벨에 색·태 둘 다 명시 (t01, t06, t07, t10, t11, t13, t14)
- **inferred** 17장 — 한쪽 명시 + 변증/notes 로 표준 진단학 합리 추정 (사진 우상단 `?` 뱃지)

> 黑苔 행 비움은 의도적 — t45·t46(黑苔)이 색을 명시하지 않고 「燥黑=熱極傷陰 / 滑黑=陽虛寒盛」 어느 쪽인지 사진만으로 결정 불가하므로 학습세트에 미포함. 시험 직전 추가 라벨이 확정되면 ENTRIES 에 주입.

### 동선

```
東武之房 → 對位 버튼 (강조 그라데이션, 1행 전체)
  ↓
  ┌─ TRAY ─────────────────────────────────────┐
  │ [t01][t06][t07][t10]... 24장              │
  └────────────────────────────────────────────┘
       ↓ pointer-drag
  ┌─ 5×5 GRID ─────────────────────────────────┐
  │       淡白  淡紅  紅   絳   紫·暗            │
  │ 無·剝 [ ] [ ] [ ] [ ] [ ]                  │
  │ 薄白  [ ] [ ] [ ] [ ] [ ]                  │
  │ 白厚膩[ ] [ ] [ ] [ ] [ ]                  │
  │ 黃苔  [ ] [ ] [ ] [ ] [ ]                  │
  │ 黑苔  [ ] [ ] [ ] [ ] [ ]                  │
  └────────────────────────────────────────────┘
```

### 인터랙션

| 동작 | 결과 |
|---|---|
| TRAY 사진 pointerdown | ghost 생성, 손가락 따라 이동, 원본 32% 투명 |
| cell hover | 노란 점선 강조 + scale(1.04) |
| 정답 cell 에 drop | 綠 flash (`mx-correct` 애니메이션) + 진동 15ms + 안착 |
| 오답 cell 에 drop | 朱 flash + 진동 패턴 [30,50,30] + 0.82초 후 정답 cell 잠시 깜빡 (hint) + tray 로 복귀 |
| 셀의 안착 사진 tap | 詳細 modal — 사진·라벨·변증·notes·교재 페이지 |
| 모든 사진 안착 | `滿陣` 카드 (정답·시도·정확도·소요시간) |

### 모드 토글

- **配位 (배치)** — default. tray + 빈 그리드.
- **學習 (학습)** — 정답 매트릭스 펼침. 사진 tap 으로 상세.

### 통제

- 정답률 진행바 + 시도 횟수 상시 표시
- 「↻ 초기화」 — 모든 안착 해제 (확인 dialog)
- 「學/配 토글」 — 모드 전환
- 「정답 펼치기」 — 즉시 모든 안착 채워서 결과 보기

## C. 변경 파일 요약

| 파일 | 변경 |
|---|---|
| `app.js` | `window.ROUTES = ROUTES` 노출, APP_VERSION v11.3→v11.4 |
| `bangje-v11-clinic-hub.js` | `_wrapSetTabForNavToggle` 강화 (hub/dongmu fallback 렌더), `_registerRoutes` polling 제거, `_forceHubOnFreshSession` ROUTES 의존 제거 |
| `bangje-v11-jindan.js` | 「對位」 5번째 모드 버튼 (그리드 전폭, 그라데이션) + 「圖鑑」 도 전폭으로 |
| `bangje-v11-tongue-matrix.js` | 신규 (~530 lines) — 24 ENTRIES + 5×5 매트릭스 + pointer-drag + 동선 |
| `index.html` | tongue-matrix script tag 추가 |
| `sw.js` | 캐시 키 `v11-3` → `v11-4`, 신규 모듈 PRECACHE 추가 |

## D. 기술 노트

### Pointer Events (mobile + desktop 통합)
- `pointerdown` / `pointermove` / `pointerup` 만 사용 — 마우스·터치 동시 지원.
- ghost element 는 `position:fixed`, `pointer-events:none` — drop target detection 이 ghost 자체에 가로채이지 않음.
- `document.elementFromPoint` 로 hover cell 추적.
- `touch-action:none` (CSS) — iOS Safari pan 인터럽트 방지.

### 정답 cell hint (오답 시)
- 오답 drop → 朱 flash (820ms) → 정답 cell 에 잠시 綠 flash → tray 자동 복귀.
- 압박 없이 위치 학습.

### 학습세트 점진 형성
- 정답만 cell 에 누적 안착. 오답은 카운트만 누적.
- 모두 안착 = 「滿陣」 = 완성된 학습세트. 그 뒤 「學習」 모드로 토글하면 한 번에 全 라벨 공개.

## E. 알려진 한계

1. **추정(inferred) 17장** — 표준 진단학 매핑이지만 교재 라벨로 단정 불가. `?` 뱃지로 표시. 시험 직전 강의노트로 검증 필요.
2. **黑苔 行 공란** — 사진만으로 燥黑·滑黑 판별 불가. 사용자 강의 라벨이 들어오면 (t45→燥黑·色 or 滑黑·色) 즉시 ENTRIES 에 추가.
3. **5×5 외 미세 분류** — 「尖紅」「邊紅」 같은 부위 색은 「淡紅」base 로 통일. 「腐苔 vs 膩苔」도 「白厚膩」로 통합. 시험은 거시 분류 위주라 큰 문제 없을 것.
4. **드래그 도중 스크롤 충돌** — `touch-action:none` 으로 tray·grid 영역에서는 스크롤 보류. tray 자체는 가로 스크롤 유지 (드래그 시작 시점에 손가락이 tile 위면 드래그 우선).

## F. v11.5+ 향후

1. 黑苔 라벨 확정 시 ENTRIES 보강
2. 「틀린 ENTRY 만 다시 풀기」 모드 (오답 누적 추적)
3. 4축 매트릭스 (色 × 苔 × 形 × 神) 입체 학습 — 현재 5×5 를 그대로 두고 별도 모드로
4. 어휘 카드 (각 한자 색·태 발음·뜻 fold-out) 매트릭스 cell 내 통합

---

작성: 2026-05-18 · CIM Lab · 設體 시험 D-1
