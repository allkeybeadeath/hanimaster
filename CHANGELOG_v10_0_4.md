# v10.0.4 (2026-05)

다섯 가지 패치 — 신급 스킬·큐브 룰·본초 popup·카드對決 레이아웃·드로어 통과 클릭.

## 1. 카드對決 신급 5인 스킬 복구

두 개의 독립 버그 동시 수정 (`app.js`).

### Bug A — 모든 신급 (5인) 공통
`app.js:7693` 의 `myChar.category === 'divine'` 분기가 항상 false. 실제 필드명은
`data-physicians.js` 의 `cat` 으로, 전 코드베이스에서 `.category` 를 쓰는 곳은 이 한
줄뿐이었음. 결과: `isDivineMe = false` → `skillMeta = null` → 스킬 버튼 렌더링 X.

수정: `.category` → `.cat`. 신급 5인 (黃帝·神農·伏羲·女媧·岐伯) 전원 스킬 사용 복구.

### Bug B — 女媧 단독 추가 버그
`CARD_SKILLS` (L7148-54) 의 키가 `nuwa:` 인데 캐릭터 id 는 `nvwa`
(data-physicians.js L78, Pinyin Nǚwā). FX 호출부 L8236 과 주석 L8448 도 `'nvwa'`
사용 → `app.js:7152` 한 줄만 오타였음. Bug A 만 고치면 女媧 스킬만 `undefined`.

수정: `nvwa` 키 추가. legacy `nuwa` 키도 호환 차원에서 유지.

## 2. 방미큐브 첫 出牌 룰 — 完成 處方(base) 만 허용

`bangje-v98-cube-rules.js` 재작성.

기존 (v9.8): (a) ≥4미 또는 (b) 사전 정의 set (base/derive/symptom 무관) → 派生方·
加減方 단독으로도 첫 출패 가능.

신규 (v10.0.4): 새/변형 set 중 최소 1개가 `BC.matchSet` 의 type==='base' 매칭이어야
함. 사이즈는 무관 (사역탕 3미·당귀보혈탕 2미 그대로 OK). 派生·加減 단독은 거부.

거부 메시지도 구체적으로 — "派生方·加減方 만으로는 첫 出牌 불가" 또는 "완성 처방이
포함되어야 합니다" 식으로 사용자에게 의도 전달.

opened 상태는 룸×uid 별 localStorage 영속 (기존과 동일).

## 3. 본초 popup — 시험범위밖 처방 표시 + 派生方·加減方 노출

`bangje-v99-herbtap.js` (드로어, 활성 UI) + `bangje-v98-herbpop.js` (overlay, 비활성)
평행 패치.

`_formulasContaining(han)`:
- FORMULAS (시험범위 안) + FORMULAS_EXTRA (시험범위 밖) 둘 다 검색
- 각 매치에 `outOfScope` 플래그 부착 (FORMULAS_EXTRA 일 때 true)

신규 `_additionsContaining(han)`:
- FORMULA_ADDITIONS (시험범위 안 처방의 加減) + EXTRA_ADDITIONS (확장 처방의 加減)
  검색
- `herbs` 배열에 본 본초가 등장하는 items 만 추출
- parent 처방·target 처방명·mod 텍스트·kind (derive/symptom) 반환

칩 렌더링:
- 시험범위밖 칩: `(시험범위밖)` 라벨 부착, opacity 약간 낮춤
- 派生方·加減方: 별도 섹션 (자색 `#6B5A8A`), `派生 ${target} · ${parent}` 형식으로
  표시, 클릭 시 parent 처방 deep view 로 이동

저담즙 예시:
- 시험범위 안 처방 0건
- 시험범위 밖 처방 0건
- 派生方·加減方 1건: `派生 白通加猪膽汁湯 · 四逆湯 사역탕 (시험범위밖)`

빈 상태 메시지: "이 본초를 쓰는 처방이 시험범위·확장사전·派生方 모두에서 발견되지
않음" — 검색 출처가 늘었으니 메시지도 명시적으로 갱신.

## 4. 카드對決 본초 가로 wrap 복원

`bangje-v96-part5.js` L20 의 `.cb-board, .bc-board, ... { display:flex;
flex-direction:column; }` 셀렉터에서 `.cb-board` 제거.

원인: v10.0.3 채팅 z-order 패치가 `.cb-board` 까지 flex-column 으로 강제 → 본초
카드가 세로로만 쌓임. 그런데 카드對決의 `.chat-card` 는 `.cb-board` 자식이 아닌
`#cb-chat-host` (형제) 에 mount 되므로, `.cb-board` flex-column 은 부수효과 없이
부작용만 있었음 (`.cb-board > .chat-card` 셀렉터는 매칭 0건).

수정 후: `index.html:1077-1080` 의 native `.cb-board{display:flex;flex-wrap:wrap}`
복원 → 가로 흐름 + 자동 줄바꿈.

## 5. 본초 학습 드로어 — 통과 클릭

`bangje-v99-herbtap.js` 의 `_onClickCapture` 에서 `e.stopPropagation()` +
`e.preventDefault()` 제거.

원인: capture-phase 에서 클릭을 통째로 삼켜, 큐브 `.bc-card` 의 카드별 click 리스너
(onHandCardClick) 가 발동하지 못함 → 손패 선택 불가 → 게임 진행 불가.

수정 후: capture 에서 드로어만 열고 클릭은 bubble 시킴. 게임 카드 선택 ∥ 드로어 표시
동시 실행. (모듈 헤더 주석에도 "(게임 클릭 가능)" 으로 명시되어 있던 본래 의도 회복.)

## 大廳 표시

- `APP_VERSION`: v10.0.3 → **v10.0.4**
- `APP_BUILD`: 2026.05.18.v10.0.4

## 캐시 키

- `bangje-pwa-v10-0-4-2026-05` — 자동 무효화로 사용자 단말 재캐시 유도

## 영향 받지 않는 영역 (참고)

- 데이터 파일 (FORMULAS·FORMULA_ADDITIONS·HERBS·PHYSICIANS) 무변경
- 큐브 deck 분포 (v10.0.3 의 선형 비례 0.4) 유지
- 시그니처·업적·기출 점수 시스템 무변경
- 캐릭터 이미지 누락 16건 (huangdi·fuxi·nvwa·qibo·leigong·bianque·canggong·zhongjing·
  huatuo·wangshuhe·huangfumi·gehong·sunsimiao·lishizhen·yetianshi·tangzonghai) — 본
  버전에서 보강하지 않음. Wellcome L0039312-L0039324 등 출처 명시되어 있으므로 별도
  자산 추가 필요.
