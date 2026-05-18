# v10.0.5 (2026-05)

본초 popup 다중 선택 (同含) intersection 검색 모드 추가.

## 1. 多本草 同含 검색 — 핵심

`bangje-v99-herbtap.js` 의 드로어가 두 모드를 자동 분기.

### 모드 결정 규칙
사용자가 큐브 손패 카드를 클릭하면 capture-phase 에서 `setTimeout(0)` 으로
bubble 이후의 갱신된 DOM 을 읽어, `.bc-card.bc-card-sel` 클래스가 부착된 카드들의
`data-han` 을 모음. 그 집합 크기에 따라:

- **2장 이상** → `openForMulti(hans)` — 同含 검색 (intersection)
- **1장** → `openFor(sel[0])` — 단일 본초 (현재 선택된 그 본초)
- **0장** → `openFor(clickedHan)` — 단일 본초 (방금 클릭한 본초, 비선택 viewing)

### 同含 검색 결과 — 세 카테고리
1. 시험범위 안 處方 — FORMULAS 의 base composition 이 선택된 모든 본초를 포함
2. 시험범위 밖 處方 — FORMULAS_EXTRA 의 base composition 이 포함
3. 派生方·加減方 — 최종 composition (`base − remove + add`) 이 포함.
   parent 처방의 시험범위 여부와 무관하게 일괄 시험범위밖 라벨

매칭 0건이면 "선택한 本草 (X·Y·Z)를 모두 포함하는 處方이 발견되지 않음. 선택을
줄여 보세요." 안내.

### 헤더 표시
선택된 본초들을 `·` 로 join 해서 노출 + 자색 「同含 검색」 배지 + 결과 갯수.
예: `人蔘 · 白朮 · 茯苓  [同含 검색]  17개`

### 실데이터 검증 시나리오 (구현 시 모두 합리적 결과 확인)
- `人蔘+白朮+茯苓` → 사군자탕 패밀리 4건 + 派生 13건 (異功散·六君子湯 등)
- `麻黃+桂枝` → 解表劑 4건 (모두 시험범위밖 — 마황탕·갈근탕·소청룡탕·대청룡탕)
- `附子+乾薑+甘草` → 사역탕 단독 + 派生 6건
- `人蔘+陳皮` → 보중익기탕 + 派生 10건 (사군자 가감 패밀리 모두 包含)
- `麻黃+人蔘` → 0건 (解表 vs 補益 — 한 처방에 共存 안 함)

## 2. 內部 變更 (구현 디테일)

### `_adjuncts(f, currentHan)` 일반화
`currentHan` 가 문자열 또는 배열 둘 다 받게 변경. 배열인 경우 그 모두를 제외한
나머지 composition 을 반환.

### 신규 함수
- `_getCubeSelectedHerbs()` — DOM `.bc-card.bc-card-sel` 에서 unique 한자 모음.
  `LOCAL.selHand` 가 외부 노출 안 되므로 DOM 기반.
- `_formulasContainingAll(hans)` — base composition intersection.
- `_additionsContainingAll(hans)` — 派生方·加減方 최종 composition intersection.
  최종 composition = `base − remove + add` 정확 계산.
- `openForMulti(hans)` — 同含 모드 렌더러.

### 모드 분기 — `_onClickCapture` 갱신
v10.0.4 의 stopPropagation 제거를 유지한 채, `setTimeout(0)` 으로 deferred 호출로
교체. capture 가 즉시 발화하면 bubble (큐브 toggle) 이전이라 selection 상태가
stale. setTimeout(0) 으로 다음 tick (bubble 완료 후) 에 읽으면 정확.

### CSS
- `.v99hd-mode` — 자색 「同含 검색」 배지
- `.v99hd-head .v99hd-han` — `word-break:keep-all; line-height:1.25; max-width:62%`
  로 다본초 표시 시 wrap 안정화

## 3. 영향 없음 / 비변경

- v10.0.4 의 다른 패치 (신급 스킬 복구·女媧 키·큐브 첫출패 base·시험범위밖 표시·
  카드對決 가로 wrap) 모두 유지
- 카드對決 (.cb-herb-card) 은 다중 선택 mechanism 자체가 없으므로 영향 X — 항상
  단일 본초 모드
- 단일 본초 모드 (`openFor`) 의 기존 표시·派生方 섹션은 그대로
- 큐브 게임 로직·deck·룰·점수 무변경

## 大廳 표시

- `APP_VERSION`: v10.0.4 → **v10.0.5**
- `APP_BUILD`: 2026.05.18.v10.0.5

## 캐시 키

- `bangje-pwa-v10-0-5-2026-05`
