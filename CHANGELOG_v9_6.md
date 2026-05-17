# CHANGELOG v9.6 (2026-05-18)

CIM Lab 方劑學 PWA — v9.5 → v9.6 업그레이드

## 추가된 6개 기능

### 1. 방미큐브 난이도별·등수별 보상 시스템 재설계

**v9.5 까지**: 승자 80 氣 고정, 3인+ 게임의 차순위(handCount 최소)에게 20 氣.

**v9.6**: 등수별 기본 + 處方 난이도 보너스 가산.

| 등수 | 기본 氣 | 난이도 보너스 비율 | 보너스 上限 | 최대 획득 |
|----|----|----|----|----|
| 1등 | 80 | × 0.5 | +40 | 120 |
| 2등 | 30 | × 0.4 | +30 | 60 |
| 3등 | 20 | × 0.3 | +20 | 40 |
| 4등 | 10 | × 0.2 | +10 | 20 |

**處方 난이도 점수 계산** (`_formulationScore`, `commitTurn` 에서 누적):
- 새 set 생성: `base 10 + size` · `derive 7 + size` · `symptom 5 + size` (size 는 본초 수, 上限 15)
- 기존 set 에 본초 추가 (加減方 변형): 추가 본초당 +2 점

**구현**:
- `bangje-cube.js#commitTurn` 에 점수 누적 로직 (라인 ~330)
- `bangje-cube.js#renderResult` 의 보상 산정 + 화면 표시 전면 재설계
  - 등수 산정: 1등 = 승자, 2~4등 = handCount 오름차순 (동률은 _formulationScore desc)
  - 결과 카드에 등수 표시 + 난이도 보너스 breakdown
  - 「最終 순위 · 處方 난이도 점수」 표 추가 (모든 참가자의 점수 비교)

### 2. 카드 對決 · 방미큐브 공용 채팅

**모듈**: `bangje-v96-part1.js#Chat`

- 양 게임에서 동일한 UI/API. 7개 preset (잘 부탁드립니다, 한 수 배웁니다, …) + 자유 입력 (최대 80자).
- 카드 對決 노드: `card_battles/{rid}/chat/{pushId}` (Firebase RTDB)
- 방미큐브 노드: `cube_rooms/{rid}/chat/{pushId}` (Firebase RTDB)
- SSE 구독 (실패 시 3.5초 폴링), 마지막 30개 메시지 유지.
- AI 룸 (`AI_CARD_*` / `AI_CUBE_*` rid) 은 `isLocal: true` 로 Firebase 없이 로컬 표시.
- 메시지 표시: 내 메시지 황색 강조, AI 메시지 翡翠 강조 + `[AI]` 뱃지, 진영 칩.
- 접기/펴기 토글 (.chat-toggle), 자동 스크롤.

**진입점**:
- `app.js#startCardBattle` — 진입 셸에 `<div id="cb-chat-host"></div>` 추가 + V96Chat.mount
- `bangje-cube.js#renderGame` — `<div id="bc-chat-host"></div>` + mount (AI 룸 자동 감지)
- `bangje-cube.js#renderResult` — 채팅 컨테이너 결과 화면으로 이동 (계속 보임)
- `stopCardStreams` / `exitToLobby` — V96Chat.unmount + window 핸들 청소

### 3. presence chip 클릭 상세 모달

**모듈**: `bangje-v96-part1.js#showPresenceDetail`

대청 「同學 함께 학습 중」 의 presence chip 을 클릭하면 다음 정보가 모달로 표시:
- 캐릭터 메달리온 + 한자명/한글명/시대
- 진영 칩 (太陽/少陽/太陰/少陰) + 패시브 설명
- **현재 활동** (예: "방미큐브 對局" · 2분 전) — v9.6 추가 필드
- 누적 氣 (등급 stamp)
- 對決 전적 (勝·敗·和·勝率) — `fetchAllRecords()` 활용
- 진영 패시브 카드 (지원 진영 색·설명)

**구현**:
- `app.js#loadPresenceList` — chip 에 `data-uid="${uid}"` 추가, activity label 인라인 표기
- `V96BindPresenceClicks('#presence-list')` 자동 호출 → 클릭 핸들러 부여
- `app.js#recordPresence` — `presence/{uid}/activity` 필드 함께 push

**Activity 추적** (`bangje-v96-part1.js#Activity`):
- `V96Activity.set(label, sub)` — S.activity 갱신 + Firebase 즉시 push
- `setTab()` 마다 자동 호출: `home → 大廳`, `cube → 방미큐브 對局`, `warrior2h → 2시간의 전사` 등
- AI 모듈 시작/종료 시도 (`AI 카드 對決`, `AI 방미큐브` 라벨)

### 4. 황제내경 명언을 명예의 전당 → 대청 (renderHome) 으로 이동

- `_neijingCardHTML()` 호출을 `renderHall` (line 1833) 에서 제거.
- `renderHome` 의 D-N 배너 바로 아래 (캐릭터 카드 위) 에 삽입.
- `pickDailyAphorism()` 은 KST 자정 자동 변경, 추가 갱신 로직 불필요.
- 사용자가 매일 대청 진입 시 첫눈에 명언을 봄 (학습 동기 부여).

### 5. 2시간의 전사 (Two-Hour Warrior) — 점수 없는 기출 반복 학습

**모듈**: `bangje-v96-part2.js#Warrior2H`  
**라우트**: `ROUTES.warrior2h` (대청 tile-grid 의 「勇者」 타일)

**철학**: `精神內守，病安從來` — 점수·경쟁 자극을 제거하고 잊어버린 기출만 묵묵히 반복.

**문제 풀** (BULK + PAST 만, 자동생성 제외):
- `PAST_EXAMS` (~34 문) + `BULK_QUESTIONS` (109 문) = 143 문

**동적 가중치 (다음 문제 선택)**:

```
w = 1.0
× 3.0 if 개인 wrongIds 포함 (S.wrongIds)
× 2.0 if 글로벌 빈출 오답 (stats/wrongs/{qid} ≥ 5)
× 1.5 if 글로벌 ≥ 2
× 4.0 if 이번 세션에서 직전 결과가 오답
× 0.3 if 이번 세션에서 직전 결과가 정답
× 0.5 if 이번 세션에서 4회 이상 본 문제
× 0.05 직전 출제된 문제 (즉시 재출현 강하게 억제)
```

**UI**:
- Sticky 상단 패널 (남은 시간 · 풀이 · 정답 · 이 문제 회차)
- 최근 12문 trail (○○✕○ … 시각화)
- 매 답안 후 해설 카드 + 「다음 문제 →」 버튼 (focus)
- 옵션 선택지 셔플 (정답 인덱스 추적)
- 출처 뱃지: `舊 기출` (PAST) / `新 자작` (BULK) · 난이도 D1~D4

**보상**:
- 2시간 완주 (timeout) + 20문 이상 풀이 → 氣 +30 (작은 자긍심)
- 그 외 (중단·문제풀 비어있음) → 보상 없음
- 학습 자체가 보상이라는 메시지 강조

**효과음·BGM**: 기존 `bgm.sfxCorrect/sfxWrong` 재활용.

### 6. AI 對決 — 카드 對決 + 방미큐브 (5지선다 제외)

**5지선다는 AI 미적용** (학습 효과 약함 + 단순 객관식 풀이는 진짜 대결감 안 살림).

#### 6-A. 카드 對決 AI (`bangje-v96-part3.js#CardAI`)

**진입점**: 멀티 對決 lobby → 카드 對決 모드 → "AI 의가와 對決" 체크박스 → 入場 (라벨 「AI 對決 시작」으로 변경)

**아키텍처**: Firebase 어댑터 패턴
- `setupBridge()` 가 `window.FB` 를 임시 교체 → `card_battles/AI_CARD_*` 경로 IO 를 in-memory `_roomRef` 로 우회.
- 기존 `startCardBattle / renderCardBattle / attemptDecoct / endCardTurn` 등 모든 함수가 무수정으로 동작.
- 종료 시 `teardownBridge()` 로 원래 FB 복구.

**휴리스틱**:
1. 證 선택: 처방 본초 수 ≥ 4 개 證 우선 (대국 길게 가져갈 수 있음).
2. 게임 시작: 양측 초기 증상 1개 자동 공개 (게임 규칙).
3. 매 턴:
   - 보드의 본초 + 상대 공개 증상 → `scoreFormulasForOpp()` 로 후보 처방 점수 계산
   - 점수 = (indication 텍스트에 포함된 상대 증상 단어 수) / (상대 공개 증상 수)
   - 점수 ≥ 0.62 (`DECOCT_CONFIDENCE`) 이면 전탕 시도
   - 정답이면 즉시 승리 / 빗나가면 자기 증상 1개 강제 공개 + 턴 종료
   - 그 외에는 그냥 턴 종료 (보드에 1장 추가)
4. 50턴 무승부.

**채팅 멘트**: AI 가 자기 행동을 채팅으로 알림 — `"전탕 시도 — 桂枝湯"`, `"음… 한 장 더 보겠습니다"` 등.

**AI 페르소나**: 神급/이순재/사용자 본인 캐릭터 제외 풀에서 무작위. 진영도 무작위 4 사상 중 1.

#### 6-B. 방미큐브 AI (`bangje-v96-part4.js#CubeAI`)

**진입점**: 큐브 로비 → 「AI 對局」 카드 → 상대 AI 수 (1~3人) 선택 → 「AI 對局 시작」

**아키텍처**: 동일하게 Firebase 어댑터 (`cube_rooms/AI_CUBE_*`). BC 모듈의 모든 IO 가 in-memory 룸으로 향함.

**휴리스틱** (`_findBestPlay`):
1. 손패에서 가능한 모든 유효 set 후보 추출 (`BC.sets()` 활용).
2. 정렬 우선순위: 타입 (base=300, derive=200, symptom=100) + 본초 수.
3. Top 1 set 을 출패. 못 만들면 덱에서 1장 드로우.
4. 손패 0장 시 즉시 승리 선언.

**보드 set 변형 (가감방)** 은 현재 단계에서 미구현. 추후 v9.7+ 에서 1-step lookahead 로 확장 예정.

**난이도 점수 누적**: AI 도 사람과 동일하게 `players/{uid}/_formulationScore` 에 가산. 결과 화면에서 사람·AI 모두 동일 룰로 등수·보상 산정.

**리스트 비공개**: `listRooms()` 에서 `AI_CUBE_*` rid 자동 필터. 다른 사용자 큐브 로비에 노출 안 됨.

---

## 코드 변경 요약

### 신규 파일 (5)
- `bangje-v96-part1.js` (565 lines) — utils, Chat, Activity, presence detail modal
- `bangje-v96-part2.js` (385 lines) — Warrior2H module
- `bangje-v96-part3.js` (340 lines) — CardAI (FB bridge + 휴리스틱)
- `bangje-v96-part4.js` (345 lines) — CubeAI (FB bridge + 그리디 set 출패)
- `bangje-v96-part5.js` (175 lines) — CSS 주입 + beforeunload cleanup

### 수정 파일
- `app.js` (S schema · loadState · setTab · ROUTES · renderHome · renderHall · recordPresence · loadPresenceList · openBattleLobby · startCardBattle · stopCardStreams)
- `bangje-cube.js` (commitTurn 점수 누적 · renderResult 등수·보너스 · renderLobby AI 카드 · renderGame 채팅 · exitToLobby cleanup · listRooms AI 필터)
- `index.html` (script tag 5개 추가)
- `sw.js` (CACHE bump → `bangje-pwa-v9-6-2026-05` · PRECACHE 갱신 · network-first 확장)

### Firebase 노드 추가
- `card_battles/{rid}/chat/{pushId}` — 카드 對決 채팅
- `cube_rooms/{rid}/chat/{pushId}` — 방미큐브 채팅
- `cube_rooms/{rid}/players/{uid}/_formulationScore` — 處方 난이도 누적
- `presence/{uid}/activity` — `{label, sub, ts}` 형태

### Firebase Security Rules
신규 sub-노드 (`chat`, `_formulationScore`, `activity`) 는 기존 부모 노드의 권한을 그대로 상속. 추가 룰 작성 불필요.

---

## 테스트 체크리스트

- [ ] 새 단말에서 PWA 첫 로드 시 v9.6 캐시 활성화 (sw 갱신 확인)
- [ ] 대청 진입 → 황제내경 명언이 D-N 배너 아래 표시
- [ ] 명예의 전당 진입 → 황제내경 카드 없음
- [ ] 대청 tile-grid 에 「勇者 · 2시간의 전사」 (어두운 톤) 표시
- [ ] 2시간의 전사 시작 → 첫 문제 출제 · 풀이 후 trail 갱신 · 「중단」 정상
- [ ] presence chip 클릭 → 상세 모달 (캐릭터·진영·전적·현재 활동)
- [ ] 다른 사용자에게서 내 activity label 이 「방미큐브 對局」 등으로 표시
- [ ] 멀티 對決 → 카드 對決 모드 → 채팅 박스 노출 · 메시지 전송
- [ ] 카드 對決 → AI 체크 → 入場 → AI 와 게임 진행 (證 선택 → 게임 진입 → AI 가 행동) · 채팅 AI 멘트
- [ ] 방미큐브 → 「AI 對局 시작」 → AI 1~3人 게임 · AI 가 사람 차례마다 자동 진행
- [ ] 방미큐브 종료 화면 → 등수 표시 + 처방 점수 표 + 난이도 보너스 breakdown
- [ ] AI 큐브 룸이 다른 사용자 룸 목록에 안 보임
