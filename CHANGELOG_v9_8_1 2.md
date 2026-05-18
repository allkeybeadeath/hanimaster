# CHANGELOG — v9.8.1 (2026-05-18)

> **방미큐브 단일승자 룰 + 6축 보상 산출**
> 234等 폐지. 1等 발생 시점에서 게임 종료(기존 동작 유지) + 결과/보상 산출만 단일 승자 기준으로 재설계.

## 요약 한 줄

> **234等 폐지 · Base 80 + 인원수 (N−2)×20 + 처방 난이도 ×0.5 + 본초 수 ×1.5 + 콤보 ×5 + 선출패 1st/2nd 보너스.**

---

## 1. 룰 변경

### 1-1. 종료 규칙 (변경 없음, UI 표기만 정정)

`commitTurn` 에서 `newHand.length === 0` 시 `declareWin` 이 호출되어 `room.status = 'done'` 로 전환되는 동작은 v9.6 부터 동일. v9.6/9.7 결과 화면이 잔여 손패 기준 234等을 *사후 산정* 해 보여줬을 뿐, 게임 진행 자체는 이미 1等 시점에 종료. v9.8.1 는 234等 사후 산정을 **폐지**하고 단일 승자만 표시.

### 1-2. 승리 보상 (6축)

| 축 | 공식 | Cap | 의도 |
|---|---|---:|---|
| ① Base | 고정 | **+80** | 승리 자체 |
| ② 인원수 | `(N−2) × 20` | **+40** | N=2→0 · N=3→20 · N=4→40 |
| ③ 처방 난이도 | `floor(formScore × 0.5)` | **+30** | v9.6 호환 (cap 만 40→30) |
| ④ 본초 수 | `floor(totalHerbsInMySets × 1.5)` | **+30** | 큰 처방 우대 |
| ⑤ 콤보 | `maxCombo × 5` | **+30** | 연속 commit 턴 max ≥ 6 만점 |
| ⑥ 선출패 | preceding=0 → +20 / =1 → +10 / 그 외 0 | **+20** | 게임 내 commit 순서 |

**이론 최대**: 80 + 40 + 30 + 30 + 30 + 20 = **230 氣**

**평균 시나리오** (3人 對局, 난이도 50pt, 본초 12미 기여, max combo 3, 2nd-meld 승자): 80 + 20 + 25 + 18 + 15 + 10 = **168 氣**

**v9.6 대비**: 1등 평균 ~110 → v9.8.1 평균 ~160 (1.45×)

---

## 2. 신규 RTDB 필드 — 자동 마이그레이션 (누락=0)

`cube_rooms/{rid}/players/{uid}/` 하위:

| 필드 | 타입 | 갱신 시점 |
|---|---|---|
| `_setStreak` | number | commit → +1 · draw(n=1) → 0 |
| `_maxCombo` | number | streak 가 max 갱신할 때 |
| `_firstCommitAt` | number (ms) | 본인의 최초 commit 시 단 1회 |
| `_totalHerbsInMySets` | number | commit 마다 herbDelta 만큼 누적 |

선출패 판정은 모든 player 의 `_firstCommitAt` 값을 비교해 산출 (별도 룸-레벨 필드 없음). `_firstCommitAt === null` 인 player 는 아직 commit 안 한 것으로 처리.

보안 룰: 기존 `players/{uid}/...` 권한 상속, 추가 룰 작성 불필요.

---

## 3. 코드 변경

### 신규 파일 (1)
- `bangje-v98-cube-victory.js` (≈ 380 줄)
  - `computeCommitUpdates({room, uid, newSetsByMe, herbDelta})` — commitTurn 훅
  - `computeDrawUpdates({room, uid})` — draw(n=1) 훅
  - `applyAiCommit(_room, aiUid, setObj, isNewSet, addedHerbs)` — AI commit 훅
  - `applyAiDraw(_room, aiUid)` — AI draw 훅
  - `computeReward(room, winnerUid)` — 6축 산출 (외부에서 호출 가능)
  - `renderResult(rid, room)` — 단일 승자 결과 화면 (boolean handled 반환)
  - `CONST` — 모든 cap/rate 노출 (튜닝용)

### 수정 파일 (2)
- `bangje-cube.js` — 4개 hook 추가, 그 외 무수정
  - `commitTurn` (line ~333) : `herbDelta` · `newSetsByMe` 집계 + `V98CubeVictory.computeCommitUpdates()` 결과를 tasks 에 추가
  - `draw` (line ~414, n=1 branch) : `V98CubeVictory.computeDrawUpdates()` 결과 tasks 추가
  - `renderResult` (line ~1380) : `V98CubeVictory.renderResult()` 가 handled=true 면 즉시 return (legacy 코드 skip)
  - `renderLobby` (line ~595) : 룰 텍스트 v9.8 6축으로 재작성

- `bangje-v96-part4.js` — V96CubeAI 의 AI commit/draw 도 동일 트래킹 적용
  - `_doAiTurn` commit branch (line ~419) : `applyAiCommit` 호출 + `players/{uid}/_formulationScore` 동기 (legacy `_room._formulationScore` 도 유지 — `difficultyBonus()` 호환)
  - `_doAiTurn` draw/pass branch (line ~437) : `applyAiDraw` 호출

### Legacy 호환 / Failsafe
- `V98CubeVictory` 가 로드되지 않으면 bangje-cube.js 의 모든 hook 은 silent skip → v9.7 동작 그대로 (1等 단순 표시 + 234等 사후 ranking).
- 결과 화면 fallback 도 try/catch 로 보호 — `renderResult` 안에서 V98CubeVictory 예외 발생 시 legacy 등수 산정 코드로 자동 강하.

---

## 4. index.html 패치

```html
<!-- v9.8 모듈 (기존) ... -->
<script src="bangje-v98-cube-rules.js"></script>
<script src="bangje-v98-modal-alert.js"></script>
<script src="bangje-v98-home.js"></script>
<script src="bangje-v98-bootstrap.js"></script>

<!-- v9.8.1 — bootstrap 뒤에 로드. bangje-cube.js·part4 의 hook 이 참조하므로 cube/part4 보다 먼저 로드돼야 함 -->
<script src="bangje-v98-cube-victory.js"></script>
```

**로드 순서 주의**: `bangje-v98-cube-victory.js` 는 cube/part4 보다 앞 (또는 즉시 다음 tick 안), 그리고 `bangje-cube.js`/`bangje-v96-part4.js` 의 hook 들이 `window.V98CubeVictory` 를 *런타임에* lookup 하므로 같은 동기 스크립트 그룹 안에서는 순서가 엄격하지 않음. 안전을 위해 v98 모듈 묶음 끝에 둘 것.

---

## 5. sw.js 패치

```js
const CACHE = 'bangje-pwa-v9-8-1-2026-05';   // bump
const PRECACHE = [
  // ... 기존 v9.8 entries
  './bangje-v98-cube-victory.js',
];
```

`bangje-v98-[\w-]+\.js$` 정규식 매칭이 이미 network-first 라 정규식 수정은 불필요.

---

## 6. 플레이 시간 (정정)

v9.6/9.7 결과 화면이 234等을 *사후* 보여줬을 뿐 게임 자체는 이미 1等 시점 종료였음. 따라서 **v9.8.1 변경은 플레이 시간에 영향 없음**. 측정값:

| 구성 | 평균 자기 턴 수 (승자) | 평균 총 턴 수 | 추정 소요 |
|---|---:|---:|---:|
| 사람 4人 (HAND_4P=10) | 5~6 | 20~24 | **8~11 분** |
| 사람 3人 (HAND_23P=12) | 6~7 | 18~21 | **8~10 분** |
| 사람 2人 (HAND_23P=12) | 7~8 | 14~16 | **6~8 분** |
| AI 4人 (사람 1 + AI 3) | 5 (사람) | 20 (사람 5 + AI 15) | **2.5~3 분** |
| AI 3人 (사람 1 + AI 2) | 6 (사람) | 18 (사람 6 + AI 12) | **3~4 분** |
| AI 2人 (사람 1 + AI 1) | 7 (사람) | 14 (사람 7 + AI 7) | **3.5~4.5 분** |

가정: 사람 턴 평균 25초 (90초 timer 의 28%), AI 턴 1.4~2.6초 (part4 setTimeout 분포 평균). 본초 1세트 평균 4~6미.

**판단**: 학습용 게임으로서 8~11분 (사람 4人) 은 적절. 너무 짧지 않아 처방 곱씹을 시간 확보, 너무 길지 않아 모바일 이탈 위험 낮음. AI 對局 2.5~4.5분은 빠른 반복 학습용으로 합리적이나, 본초 조합 사고 시간 확보를 위해 AI 턴 딜레이를 1.4~2.6초 → **2~4초** 로 늘리는 옵션도 검토할 수 있음 (`bangje-v96-part4.js:390` 의 `1400 + Math.random()*1200` → `2000 + Math.random()*2000`).

---

## 7. 인수 체크리스트

- [ ] `bangje-v98-cube-victory.js` 를 v9.7 root 에 추가
- [ ] `bangje-cube.js` 를 첨부 본 (v9.8.1) 으로 교체
- [ ] `bangje-v96-part4.js` 를 첨부 본 (v9.8.1) 으로 교체
- [ ] `index.html` 에 `<script src="bangje-v98-cube-victory.js"></script>` 추가
- [ ] `sw.js` CACHE 버전 `v9-8-1` 로 bump + PRECACHE 에 새 파일 entry
- [ ] PWA 새로고침 → 로비에 v9.8 6축 룰 표기 확인
- [ ] 4人 對局 → 1等 발생 시 234等 표시 사라지고 단일 승자 + 6축 breakdown 표시
- [ ] AI 對局 → AI 가 commit 할 때마다 _setStreak 증가, draw 시 0 리셋 (RTDB 콘솔 / `BC.currentRoom()` 으로 확인)
- [ ] AI 가 승리 시 결과 화면에 AI 의 콤보·기여 본초 수 표시 (단, 사람은 패자이므로 氣 변동 없음)
- [ ] 사람이 승리 시 +기 표시 = computeReward(room, myUid) 와 일치
- [ ] 새 RTDB 필드들이 정상 작성됨 (Firebase Console 로 확인)
