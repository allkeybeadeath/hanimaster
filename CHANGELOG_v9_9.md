# CHANGELOG — v9.9 (2026-05-18)

> **방미큐브 보상 시스템 리워크 — Winner-takes-all + 4-factor 가산**
> v9.8 위에 큐브 對局 종료/보상 룰만 갱신. 카드 對決·SRS·드릴 등 기타 모듈 영향 없음.

## 요약 한 줄

> **2·3·4等 보상 제거. 1人 勝者 단독 氣 획득. 加算: 處方 난이도 + 人員 + 連續 處方 + 先手.**

---

## 1. 보상 공식 변경

### 1-1. 기존 v9.6 (4-tier 등수별 보상)

```
1등: 80 + min(40, score × 0.5)        → 80 ~ 120
2등: 30 + min(30, score × 0.4)        → 30 ~  60
3등: 20 + min(20, score × 0.3)        → 20 ~  40
4등: 10 + min(10, score × 0.2)        → 10 ~  20
```

### 1-2. 신규 v9.9 (winner-takes-all + 4-factor)

```
승자 氣  =  WIN_BASE                              (= 60)
         + min(DIFF_CAP,   formScore × DIFF_RATE) (60~80 typical, max 80)
         + (playerCount − 2) × COUNT_PER          (0·20·40)
         + min(STREAK_CAP, maxStreak × STREAK_PER) (max 50)
         + (playerCount − 1 − orderIdx) × ORDER_PER (max 24)

         WIN_BASE=60, DIFF_RATE=0.7, DIFF_CAP=80,
         COUNT_PER=20, STREAK_PER=10, STREAK_CAP=50, ORDER_PER=8

패자 氣  =  0
```

### 1-3. 시나리오 표 (시뮬레이션)

| 시나리오 | 人 | 順 | 連 | 難 | → 氣 | 내역 |
|---|---|---|---|---|---|---|
| 최소 — 2人, 後手, 連0, 難0 | 2 | 2 | 0 | 0 | **60** | 60+0+0+0+0 |
| 最低 보너스 — 3人, 後手, 連1 | 3 | 3 | 1 | 20 | **104** | 60+14+20+10+0 |
| 표준 — 3人, 中, 連2, 難50 | 3 | 2 | 2 | 50 | **143** | 60+35+20+20+8 |
| 표준 — 4人, 中, 連3, 難60 | 4 | 3 | 3 | 60 | **180** | 60+42+40+30+8 |
| 강한 1승 — 4人, 先手, 連3, 難80 | 4 | 1 | 3 | 80 | **210** | 60+56+40+30+24 |
| 최대 — 4人, 先手, 連5+, 難120 | 4 | 1 | 5 | 120 | **254** | 60+80+40+50+24 |

`順`: 출패 순서 (1=先手). `連`: 최대 연속 commit. `難`: 누적 處方 난이도 점수.

### 1-4. 가산 4-factor 설계 의도

| 가산 | 의도 | 학습 효과 |
|---|---|---|
| **處方 난이도** | 基方 > 派生 > 加減, 본초 수 가산 | 어려운 처방 학습 유도 |
| **人員** | 4人 > 3人 > 2人 (큰 판일수록 ↑) | 멀티 對局 참여 유인 (스터디 그룹 진행) |
| **連續 處方** | draw/penalty 없이 연속 commit | 끊김 없는 깊은 思考 보상 — 무작정 draw 회피 |
| **先手** | turnOrder 빠른 자리일수록 ↑ | 처음부터 적극적 출패 (시간 끄는 戰略 억제) |

---

## 2. 코드 변경 (bangje-cube.js 단일 파일)

```
상수 영역 (line ~16-30)
  - REWARD_WIN=80, REWARD_RUNNER=20 제거
  + REWARD_WIN_BASE=60, REWARD_DIFF_RATE=0.7, REWARD_DIFF_CAP=80
  + REWARD_COUNT_PER=20, REWARD_STREAK_PER=10, REWARD_STREAK_CAP=50
  + REWARD_ORDER_PER=8

BC_VER: '1.0' → '1.1'

startGame() — 각 player에 _orderIdx, _commitCount, _currentStreak, _maxStreak 초기화

commitTurn() — commit 성공마다
  _currentStreak += 1
  _maxStreak = max(_maxStreak, _currentStreak)
  _commitCount += 1

draw() — 정상 draw·페널티 draw 모두 _currentStreak = 0 으로 리셋

renderResult() — winner-takes-all 새 보상 공식 + 상세 내역 표시
  - 表 컬럼 추가: 連(최대 streak), 順(orderIdx+1)
  - 패자에게 「이번 판은 1등만 氣 획득」 안내문
  - 안내 footer 갱신

게임 룰 안내 텍스트 — winner-takes-all 명시 + 4-factor 가산 요약

AI 對局 안내 — "보상 동일" → "勝者 단독 氣 (v9.9 룰 동일)"
```

기존 v9.8 모듈 (cube-rules, srs, drill, …) **무수정**. 카드 對決 및 멀티 對決 시스템 무영향.

---

## 3. Firebase 영향

`cube_rooms/{roomId}/players/{uid}/` 아래 신규 필드:

| 필드 | 타입 | 의미 |
|---|---|---|
| `_orderIdx` | int | turnOrder 내 인덱스 (0=先手) |
| `_commitCount` | int | 누적 commit 횟수 |
| `_currentStreak` | int | 현재 진행 중 연속 commit (draw·penalty시 0) |
| `_maxStreak` | int | 게임 내 최대 연속 commit |

기존 `_formulationScore` 는 그대로. 결과 정산 시 모두 함께 참조.

스키마 호환: v9.6 이전 게임 데이터 (이 필드들 없음) 도 `|| 0` fallback 으로 안전.

---

## 4. cubeHistory 변경

`S.cubeHistory[]` 항목에 신규 필드:

```js
{
  ts, roomId, win, place, deltaQi, formulationScore,    // 기존
  playerCount: 4,            // 신규 — 인원수
  maxStreak: 3,              // 신규 — 본인 최대 연속 commit
  orderIdx: 0,               // 신규 — 본인 turnOrder index (0=先手)
  opponents, boardSets,      // 기존
}
```

기존 `runner` 필드 제거 (2등 개념이 보상에서 의미 없음).
이전 history 항목은 그대로 보존 — 표시 시 fallback.

---

## 5. 플레이 시간 추정 (몬테카를로 n=2000)

가정:
- 인간 턴: triangular(15, 50, mode=25)초
- AI 턴: gauss(2.5, 0.6)초
- 매 턴 commit 시도 55% / draw 45%
- commit 당 1~6장 출패 (mode 3장)
- 페널티 8% 빈도, +8초 +3장 드로우

| 시나리오 | median | IQR | p90 | avg turns |
|---|---|---|---|---|
| 2人 vs 사람 | 9.4분 | 6.4~13.2분 | 18.7분 | 21.0 |
| 3人 vs 사람 | 11.4분 | 8.2~15.9분 | 21.4분 | 25.1 |
| 4人 vs 사람 | 10.5분 | 7.4~14.5분 | 19.3분 | 22.8 |
| 사용자 1 + AI 1 | 4.5분 | 3.3~6.3분 | 8.5분 | 18.2 |
| 사용자 1 + AI 2 | 4.0분 | 3.1~5.4분 | 6.8분 | 21.6 |
| 사용자 1 + AI 3 | 3.0분 | 2.3~4.0분 | 5.1분 | 19.8 |

> **권장 학습 세션 시간**:
> · AI 對局 — 3~5분/판 (시험 D-2 빠른 반복 학습에 적합)
> · 멀티 對局 — 10~15분/판 (스터디 그룹 합동 학습용)

---

## 6. 인수 체크리스트

- [ ] `bangje-cube.js` 를 동봉 파일로 교체
- [ ] 새 對局 시작 시 결과 화면에 「勝者 단독」 카드 + 4가지 가산 내역 표시 확인
- [ ] 패자(2·3·4等)에게 「+0」 표시 (보상 카드 미출현)
- [ ] 순위표에 連(streak) · 順(orderIdx) 컬럼 표시 확인
- [ ] 4人 對局 vs 2人 對局 가산 차이 (20·40氣) 확인
- [ ] 연속 commit 3회 후 draw 시 streak 리셋 확인
- [ ] AI 對局에서도 동일 공식 적용 확인
- [ ] localStorage `S.cubeHistory` 에 playerCount/maxStreak/orderIdx 기록 확인

---

## 7. 알려진 한계

- **AI 對局의 先手 보너스** — AI 對局에서 사용자가 항상 turnOrder 0 (호스트)인지 코드 흐름상 보장되지 않을 수 있음. 사용자가 후순위면 先手 보너스 不획득. 향후 AI 對局 전용 보너스 정책 검토 가능.
- **시뮬레이션 가정의 한계** — turn time 분포는 CIM Lab 내부 관찰값이 아닌 가정. 실측 데이터 누적 후 v9.10 에서 보정 권장.
- **연속 commit cap** — STREAK_CAP=50 은 5회 연속에서 도달 (10×5). 손패 2~3회 commit으로 끝나는 짧은 판에서는 max 30 정도가 현실. 큰 판일수록 cap에 닿음.

---

## 8. v9.9 build

- `APP_VERSION = 'v9.9'`
- `APP_BUILD = '2026.05.18g'`
- `BC_VER = '1.1'` (bangje-cube.js 내부)

작성: 2026-05-18 · CIM Lab
