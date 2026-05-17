# CHANGELOG v9.5 — 方劑Cube (방미큐브) 출시

**날짜:** 2026-05-17
**핵심:** 2~4人 멀티 對局 게임 모드 추가 (루미큐브 룰 + 方劑學)

## 신규 파일

- `bangje-cube.js` (1448 lines) — 게임 모듈 (매칭 엔진 · Firebase 동기화 · UI · 액션)
- `data-formulas-extra.js` (~400 lines) — 시험 범위 외 명방 33개 + 본초 13종 + 가감 9건

## 변경 파일

- `index.html` — 스크립트 로드 2건 추가 (data-formulas-extra.js · bangje-cube.js)
- `app.js`
  - `ROUTES.cube = renderCube` 등록
  - `renderHome()` 의 tile-grid 첫 자리에 wide 「方劑Cube · 4人 對局 NEW」 타일 추가
- 하단 네비게이션은 건드리지 않음 — 사용자 요구대로 「대청 진입 시 즉시 노출」 (멀티 탭 안에 묻지 않음)

## 게임 룰

- **인원:** 2~4人
- **손패 초기:** 4인 10장 / 2~3인 12장
- **유효 set:** ① 완성 정방 ② 派生方(derive) ③ 증상별 加減(symptom)
- **출패 조작:**
  - 손패에서 카드 선택 → 「창(創)」 새 set 만들기
  - 손패 + 보드 set 선택 → 「가(加)」 set 에 추가 (가감방 변형)
  - 보드 set 의 카드 선택 → 「취(取)」 손패로 회수 (split — 정통 루미큐브 조작)
- **턴 종료(終):** 보드 모든 set 유효 + 손패에서 1장 이상 출패 → 인정
  - 위반 시 페널티 3장 드로우
- **패 뽑기(摸):** 변경 없을 때만 — 덱 1장 + 턴 종료
- **승리:** 손패 0장 먼저 비우면 승리, 氣 +80 획득 (3·4인은 2등 +20 위로)
- **타임아웃:** 턴당 90초, 초과 시 자동 드로우

## 매칭 엔진 통계

```
sets = 150 (base 58 · derive 36 · symptom 56)
   ├ base 핵심 26 (시험 범위 — 사군자탕, 보중익기탕 등)
   └ base 확장 32 (시험 범위 외 — 마황탕·계지탕·황련해독탕·백호탕·소시호탕 등)
deck = 236 카드 (4人 10장 분배 시 잔덱 196)
herbs = 131 종 (기존 122 + 신규 13 — 杏仁·粳米·竹葉·蘆根 등)
```

## 사용자 발화 매칭

- 「황련해독탕은 기본방으로」 → `黃連解毒湯` base set 인정
- 「다른 본초를 더 넣으면 석고탕이 되고」 → `黃連解毒湯 + 石膏` 가감 인정
- 「계지탕에 가감해서 계지인삼탕」 → `桂枝人蔘湯` (이미 기존 base, 데이터 그대로)
- 「루미큐브의 룰과 재미를 충실히」 → split/manipulation 포함, 정방·派生·加減 3종 set 모두 출패 가능
- 「입장법은 들어가면 바로 화면에 떠서」 → 홈(대청)의 wide 타일로 노출, 하단 멀티 탭에는 추가 안 함

## Firebase 노드 신설

```
cube_rooms/{roomId}
  ├ status: 'waiting' | 'playing' | 'done'
  ├ hostId, createdAt, maxPlayers, name, isPublic
  ├ players/{uid}: {name, character, faction, handCount, isHost, isReady, joinedAt}
  ├ hands/{uid}: [herbHan, ...]                  (private 손패 — best-effort)
  ├ deck: [herbHan, ...]
  ├ board: [{id, herbs, label, han, type, by, modBy, modAt}]
  ├ turnOrder, turnIdx, turnUserId, turnStartedAt
  ├ deckCount
  ├ lastAction: {by, type, at}
  └ result: {winnerId, finishedAt, by}
```

**보안 룰 추가 필요:** Firebase Console 에서 `cube_rooms` 에 대해 lobby/battles 와 동일한 권한 부여 (또는 기존 룰이 root 권한이면 자동 적용).

## 디버깅

- `BC.diag()` — 매칭 엔진 진단
- `BC.sets()` — 전체 유효 set 배열
- `BC.proto()` — 덱 프로토타입
- `BC.matchSet([herbs])` — 본초 배열 → 매칭 set 들 반환
- 콘솔에 `[方劑Cube v1.0] sets=...` 자동 로그 (앱 로드 시)

## 향후 (v9.6+)

- 통계 탭에 `cubeHistory` 시각화 (승률, 좋아한 처방 등)
- 보드 set 클릭 시 처방 상세 모달 (composition·action·monarch_minister)
- 사운드 효과 (WebAudio — 카드 두는 소리, 승리 팡파레)
- 시간제 모드 옵션 (블리츠)
- 관전자 모드
- 더 많은 확장 처방 (현재 33개 → 60+ 목표)
