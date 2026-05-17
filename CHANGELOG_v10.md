# CHANGELOG — v10.0 (2026-05-18)

> **방제학 PWA · CIM Lab · v9.9 위 學習 完成 묶음**
> v9.9 의 큐브 보상 시스템 위에 학습 분석·모의 시험·노트·솔로 챌린지·派生 트리·핫픽스 7개 모듈 추가.

## 요약 한 줄

> **時辰 시계(大廳) · 361穴 인체 + 通明 업적 · 學習 分析 · 模擬 試驗 · 處方 노트 · 솔로 큐브 챌린지 · 派生方 트리 · AI 對局 先手 보장 · v9.8 권장사항 5건 핫픽스.**

---

## 1. 신규 모듈 (10 파일)

| 파일 | 기능 | 진입점 |
|---|---|---|
| `bangje-v99-sichen-clock.js` | 大廳 시진(時辰) 시계 — 자축인묘 + 분단위 | 자동 (hello-card 옆 chip) |
| `bangje-v99-meridian-body.js` | 361혈 인체 시각화 + 通明 업적 | 프로필/메달리온 클릭, `V99Body.open()` |
| `bangje-v99-analytics.js` | 학습 분석 대시보드 (SRS·章별·處方별) | `V99Analytics.open()` 또는 大廳 hub |
| `bangje-v99-exam.js` | 模擬 試驗 모드 (시간제한·결과 history) | `V99Exam.setup()` 또는 大廳 hub |
| `bangje-v99-note.js` | 處方 개인 노트 (오답·메모) | `V99Note.openFor(formulaId)` 또는 hub |
| `bangje-v99-speedcube.js` | 솔로 큐브 챌린지 (손패 비우기 time-trial) | `V99SpeedCube.start()` 또는 hub |
| `bangje-v99-lineage.js` | 派生方·加減方 트리 시각화 | `V99Lineage.openFor(formulaId)` 또는 hub |
| `bangje-v99-hotfix.js` | v9.8 권장사항 5건 monkey-patch | 자동 |
| `bangje-v99-home.js` | v10 大廳 hub (v98 hub 대체) | 大廳 tile 자동 inject |
| `bangje-v99-bootstrap.js` | 통합 (cube history 분석·hotfix 적용 trigger) | 자동 |

기존 v9.8 모듈 (14개) **무수정**. v9.9 의 `bangje-cube.js` 만 v1.1 → v1.2 로 패치 (AI 先手 보장).

---

## 1-A. 大廳 시진 시계 (V99Sichen)

- 大廳 hello-card 옆에 작은 chip 으로 현재 시진 표시
- 형식: `子時(자) · 23:47`
- 매 분 정각 (분 경계 재계산) 자동 갱신 — drift 없음
- 子時 = 23:00–01:00 (자정 통과 케이스 처리)
- chip 클릭 시 12지지 시진표 + 12경맥 子午流注 매핑 popup
- 子午流注 (寅→肺·卯→大腸·辰→胃·巳→脾·午→心·未→小腸·申→膀胱·酉→腎·戌→心包·亥→三焦·子→膽·丑→肝): 현재 시진의 활성 경맥 강조

---

## 1-B. 361혈 인체 시각화 + 通明 업적 (V99Body)

### 데이터 — 14경맥 361혈 (한자명 전체 등재)

| 경맥 | 약어 | 혈수 |
|---|---|---|
| 手太陰肺經 | LU | 11 |
| 手陽明大腸經 | LI | 20 |
| 足陽明胃經 | ST | 45 |
| 足太陰脾經 | SP | 21 |
| 手少陰心經 | HT | 9 |
| 手太陽小腸經 | SI | 19 |
| 足太陽膀胱經 | BL | 67 |
| 足少陰腎經 | KI | 27 |
| 手厥陰心包經 | PC | 9 |
| 手少陽三焦經 | TE | 23 |
| 足少陽膽經 | GB | 44 |
| 足厥陰肝經 | LR | 14 |
| 任脈 | CV | 24 |
| 督脈 | GV | 28 |
| **합계** | | **361** |

### 점등 정책

- **氣 ↔ 혈 환산**: `QI_PER_POINT = 10` (즉 1혈 = 10氣)
- **滿穴**: `TOTAL_QI = 361 × 10 = 3,610氣`
- **점등 순서** (다리부터 → 두면): 足三陰(腎·肝·脾) → 足三陽(胃·膽·膀胱) → 任督 → 手三陰(肺·心·心包) → 手三陽(大腸·三焦·小腸)

### 시각

- SVG 인체 도식 (정면도, viewBox 200×510)
- 각 경맥 path 위에 점 N개 자동 균등 분포 (`getPointAtLength`)
- 점등된 혈: 광원(radialGradient halo) + 황금색 본체
- 미점등: 경맥 색상 흐림 (opacity 0.32)
- 최근 5개 점등 혈: pulse animation (1.6s)
- 滿穴 시: 全身 aura (drop-shadow filter)
- 혈자리 클릭 → `LU1 中府` 같은 toast

### 進入點

- **프로필/메달리온 클릭** (`.v97-medallion`, `#profile-name`, `#hello-card` 후크)
- **메달리온 옆 通 印** (滿穴 후 부착, 평상시 미부착)
- `V99Body.open()` 직접 호출

### 通明 업적

- `S.essenceUnlocked` (bool) + `S.essenceUnlockedAt` (ts) 으로 영속
- 滿穴 도달 시 자동 unlock + toast + 효과음 trigger
- 메달리온 옆 「通」 印 부착 (radial gradient + pulse — 다른 인장과 시각적으로 명확히 구분: 황금-주사 그라데이션 + 백색 inner glow)
- 업적 大廳(인장 리스트)에도 동일 印 표시
- 클릭 시 인체 시각화 모달 재오픈

### 비호환·주의

- `S.qi` 가 음수면 미점등 (방어 코드).
- 큐브 패배로 氣가 줄어드는 일은 v9.9 룰상 없음 (패자=0, 손실 없음). 단, 통명 unlock 은 불가역 — 한 번 달성하면 印 영구 유지.
- 단일 PWA 인스턴스 가정. V97 multi-profile 분리 시 별도 검증 필요.

---

## 2. AI 對局 先手 보장 — v9.9 알려진 한계 #1 해결

### 2-1. 기존 문제

v9.9 `startGame` 의 turnOrder 산정:
```js
const order = uids.sort((a,b) => (ps[a].joinedAt||0) - (ps[b].joinedAt||0));
```
- 호스트(사용자)는 `createRoom` 에서 `joinedAt = nowMs()` 설정 → 통상 가장 빠른 값
- 그러나 시계 drift, 동시 가입, 재접속 시 갱신 등에서 보장 미비
- AI 모드(`AI_CUBE_*`)에서 사용자가 `_orderIdx ≠ 0` 이면 先手 보너스 손실

### 2-2. v10 패치

`startGame` 의 order 산정 직후 AI 모드 보정:
```js
if(rid && rid.startsWith('AI_CUBE_') && room.hostId){
  // AI 對局: 호스트(사용자)를 강제 order[0] 으로 — 先手 보너스 보장
  const idx = order.indexOf(room.hostId);
  if(idx > 0){ order.splice(idx, 1); order.unshift(room.hostId); }
}
```

`BC_VER`: `'1.1'` → `'1.2'`. 멀티 對決에서는 기존 joinedAt 정렬 그대로 — 공평성 유지.

### 2-3. 검증

| 시나리오 | v9.9 | v10 |
|---|---|---|
| AI 對局 2人 (User + AI) — joinedAt 동일 ms | 미정의 (sort stable 가정) | User=order[0] 강제 |
| AI 對局 4人 (User + AI×3) — 정상 | User=order[0] (joinedAt 우선) | 동일 (이미 0) |
| 멀티 4人 — 두 명이 거의 동시 입장 | joinedAt 차이로 결정 | 동일 (정책 변경 없음) |

---

## 3. V99Analytics — 학습 분석 대시보드

데이터 소스 (전부 localStorage 기반, 외부 호출 없음):
- `S.flashRated` (SRS 객체): 카드별 EF·interval·due·reps
- `S.cubeHistory` (큐브 對局 history): 승률·평균 처방 점수·평균 연속·인원수 분포
- `S.quizHistory` (있으면): 章별 정답률
- `S.seenChars` / 인장 / 氣 누적

표시:
1. **SRS 상태**
   - due 카드 분포 (오늘·내일·이번주·이번달)
   - EF 분포 histogram (1.3-3.0)
   - retention curve (마지막 30일 — `last` ts 기반)
2. **章별 정답률** (PAST_EXAMS 기반 — `q.chapter` 매칭)
   - 6章·7章·8章 정답률 + 응시 수
   - 약점 章 강조 + 「이 章 빈출 오답 모드 시작」 버튼
3. **處方별 친숙도** (S.flashRated 의 formula:* 키 분포)
   - 처방 ID 별 평균 EF (높을수록 친숙)
   - bottom-10 처방 강조 — 「이 처방 對比 보기」·「君臣佐使 드릴」 단축 버튼
4. **큐브 對局 통계** (S.cubeHistory 기반)
   - 승률 (전체·인원수 별)
   - 평균 처방 점수 trend (최근 20판 line chart, SVG)
   - 평균 최대 연속(連) + 平均 先手 順
5. **氣 누적 trend** — daily delta 시각화

차트 라이브러리 미사용 — 인라인 SVG (의존성 0).

---

## 4. V99Exam — 模擬 試驗 모드

### 4-1. 동작

- 사용자가 문항 수(15·30·50) 와 시간 제한(15·30·60분) 선택
- PAST_EXAMS 풀에서 무작위 (균등) 샘플링 — 章 분포 가중 옵션
- 시작 시 timer 작동 — 우상단 표시 (조용한 카운트다운)
- 한 문항씩 진행 — 정답·해설은 **종료 후** 한꺼번에 (실제 시험 형식)
- 마지막 문항 제출 후 결과: 점수·등급·章별 정답률·약점 처방 추천
- 결과는 `S.examHistory[]` 에 저장 (max 10건)

### 4-2. 등급 환산 (CIM Lab 내부 기준)

| 점수% | 등급 | 평가 |
|---|---|---|
| ≥90 | 上上 | 卒考 통과 권장 |
| 80–89 | 上中 | 안정권 |
| 70–79 | 中上 | 보강 권장 |
| 60–69 | 中下 | 章별 빈출 오답 필요 |
| <60 | 下 | 全範圍 재학습 |

### 4-3. 보상

- 완료 시 baseEarned 50 + score 比例 (0–100). 시간 내 완료시만.
- 시간 초과 시 자동 제출 (작성한 문항만 채점).
- 시그니처/공명 보너스는 V97/V98 시스템이 자동 합산.

---

## 5. V99Note — 處方 개인 노트

- 처방마다 markdown 노트 작성 가능 (`S.formulaNotes[formulaId] = {text, lastEdit}`)
- 처방 모달에 「📝 노트」 버튼 inject (V97Dict / openFormulaDeep hook)
- 大廳 hub 에서 전체 노트 목록 + 검색
- export: JSON download (백업·여러 디바이스간 수동 동기화용)
- import: JSON paste/upload (병합 또는 덮어쓰기)
- 빠른 시작 템플릿:
  - 「오답 노트 (이 처방을 틀린 이유)」
  - 「혼동 처방 (비슷한 처방 vs. 차이점)」
  - 「君臣佐使 mnemonic」

---

## 6. V99SpeedCube — 솔로 큐브 챌린지

기존 V96CubeAI 와 별도. AI 對局 (Firebase·인간 시뮬레이션) 무관하게:

- 12장 손패 부여 (덱 셔플)
- 보드는 비어 있음. 손패만으로 처방 조립 commit
- 사이즈 무관 — 첫 出牌 룰 적용 (V98CubeRules)
- 모든 손패 commit 시 종료 → 경과 시간 기록
- best time / 평균 / 시도 횟수 `S.speedCubeStats` 에 저장
- 페널티 없음 (학습 모드)
- 옵션:
  - Easy: 손패 8장 + 사전 정의 처방 hint 토글
  - Medium: 손패 10장
  - Hard: 손패 12장 + hint 없음

리더보드는 Firebase `speedcube/leaderboard/{userId}` 에 best time 만 기록 (옵션 — 학습 의도 보호).

---

## 7. V99Lineage — 派生方·加減方 트리

처방 사전의 `derivedFrom` / `parent` / FORMULA_ADDITIONS 데이터를 트리화:

- 입력: 처방 1개
- 출력: SVG 가계도
  - 上으로 base 처방 (예: 사군자탕 ← 이공산 ← 육군자탕)
  - 下으로 派生方
  - 좌우로 加減方 (FORMULA_ADDITIONS 의 symptom 별)
- 노드 클릭 → 해당 처방 모달
- 노드 long-press → 비교 (V98Diff.open(this, original))

빈도 높은 줄기:
- 사군자탕 → 이공산 → 육군자탕 → 향사육군자탕
- 사물탕 → 도홍사물탕 → 桃紅四物加減
- 사군 + 사물 → 팔진탕 → 십전대보탕 → 인삼양영탕

---

## 8. V99Hotfix — v9.8 권장사항 5건 핫픽스

monkey-patch 방식 (원본 파일 무수정):

| 항목 | 처리 |
|---|---|
| **A-3** 子時·寅時 시간대 | `data-achievements.js` 의 `time_yin` 배열 audit 헬퍼 + `getCurrentSichen()` wrap (정확한 子時=23–01, 寅時=03–05 매핑) |
| **A-5** manifest.json 버전 | runtime manifest 읽고 mismatch 경고 (콘솔만) |
| **A-7** hello-card 선택자 | DOM observer 로 `#hello-name-row` id 보강 (이미 있으면 skip) |
| **A-9** V97Dict 검색어 보존 | `V97Dict.open` wrap — 마지막 q 값 sessionStorage 보존 |
| **A-10** recordChat 카운팅 | `recordChat` wrap — 외부 호출자가 push 성공 callback 후 호출하도록 안내. 직접 호출은 silent skip. |

`V99Hotfix.report()` 로 어떤 패치가 적용됐는지 확인 가능 (콘솔).

---

## 9. 데이터 마이그레이션

자동 마이그레이션 — 별도 작업 불필요:

- `S.formulaNotes` : 누락시 `{}`
- `S.examHistory` : 누락시 `[]` (max 10)
- `S.speedCubeStats` : 누락시 `{best: null, count: 0, avg: 0}`
- `S.quizHistory` : 누락시 `[]` (max 50) — V99Exam·V99Analytics 가 합산
- `S.essenceUnlocked` : 누락시 `false` (V99Body 通明 업적)
- `S.essenceUnlockedAt` : 누락시 `0`

V99Body 는 매 mutation 마다 `S.qi` 를 검사 → 3610 도달 시 자동 unlock.

---

## 10. Firebase 영향

신규 RTDB 노드 (옵션):
- **`speedcube/leaderboard/{userId}`** — best time + name (사용자 동의 시만 publish)
  - 권장 보안 룰: `{ ".read": true, ".write": "auth != null && newData.child('userId').val() === auth.uid" }`

기타 노드 변경 없음.

---

## 11. index.html 패치

```html
<!-- v9.8 모듈 (기존 그대로) -->
<script src="bangje-v98-srs.js"></script>
... (기존 14개)
<script src="bangje-v98-bootstrap.js"></script>

<!-- v10 신규 모듈 — v98 이후 로드. 시계·인체는 가벼우니 일찍, hub·bootstrap 은 마지막. -->
<script src="bangje-v99-sichen-clock.js"></script>
<script src="bangje-v99-meridian-body.js"></script>
<script src="bangje-v99-hotfix.js"></script>
<script src="bangje-v99-analytics.js"></script>
<script src="bangje-v99-exam.js"></script>
<script src="bangje-v99-note.js"></script>
<script src="bangje-v99-speedcube.js"></script>
<script src="bangje-v99-lineage.js"></script>
<script src="bangje-v99-home.js"></script>
<script src="bangje-v99-bootstrap.js"></script>      <!-- 마지막 -->
```

---

## 12. sw.js 패치

```js
const CACHE = 'bangje-pwa-v10-0-2026-05';   // bump
const PRECACHE = [
  // ... v9.8 그대로
  './bangje-v99-sichen-clock.js',
  './bangje-v99-meridian-body.js',
  './bangje-v99-hotfix.js',
  './bangje-v99-analytics.js',
  './bangje-v99-exam.js',
  './bangje-v99-note.js',
  './bangje-v99-speedcube.js',
  './bangje-v99-lineage.js',
  './bangje-v99-home.js',
  './bangje-v99-bootstrap.js',
];

// network-first regex
const networkFirst =
  url.pathname.endsWith('index.html') ||
  url.pathname.endsWith('/') ||
  url.pathname.endsWith('app.js') ||
  url.pathname.endsWith('bangje-cube.js') ||
  /bangje-v(9[678]|99)-[\w-]+\.js$/.test(url.pathname);   // ← 9.6~9.9 (v98) + v10 (v99)
```

---

## 13. 인수 체크리스트

### 핵심 통합
- [ ] `bangje-cube.js` 동봉 v1.2 로 교체 (또는 startGame AI 先手 보정 3줄 수동 적용)
- [ ] 10개 신규 `.js` 파일 (`bangje-v99-*.js`) 을 `index.html` 에 위 패치대로 추가
- [ ] `sw.js` 캐시 키 `v9-9` → `v10-0` bump, PRECACHE 10개 추가, regex `v(9[678]|99)` 확장

### 기능 검증 - 신규
- [ ] 大廳 진입 → hello-card 옆 시진 chip 표시 (`子時(자) · 23:47` 형식)
- [ ] 시진 chip 클릭 → 12지지 × 12경맥 子午流注 popup
- [ ] 프로필/메달리온 클릭 → 인체 시각화 모달 → 다리부터 점등 확인
- [ ] 혈자리 점 클릭 → `LU1 中府` 토스트
- [ ] 3610氣 도달 시 通明 업적 자동 unlock + 메달리온 옆 「通」 印 출현 + 펄스 빛
- [ ] 업적 大廳에 「通」 印 동일 표시 확인
- [ ] 大廳 → 「v10 學習 完成」 hub 타일 표시
- [ ] hub 모달에서 6개 신규 도구 표시
- [ ] V99Analytics: 章별 정답률·處方 친숙도·큐브 統計 4개 섹션 렌더
- [ ] V99Exam: 15/30/50 문항 + 15/30/60분 옵션 → 시작 → 시간 내 완료 → 등급 표시
- [ ] V99Note: 處方 모달에서 「📝 노트」 버튼 → 작성 → 저장 → 재진입시 보존
- [ ] V99SpeedCube: 12장 손패 → 모두 commit → 시간 기록 → best time 갱신
- [ ] V99Lineage: 사군자탕 입력 시 子孫 트리 (이공산·육군자탕·향사육군자탕) 표시

### 기능 검증 - 핫픽스 (V99Hotfix)
- [ ] 콘솔에 `V99Hotfix.report()` 호출 → A-3·A-7·A-9·A-10 각 적용 상태 표시
- [ ] hello-card 에 `#hello-name-row` id 부여 확인
- [ ] V97Dict 검색어 입력 후 닫고 재진입 시 sessionStorage 에서 복원
- [ ] 寅時(03:00–05:00) 진입 시 寅時 시그니처 정상 활성

### 기능 검증 - AI 先手
- [ ] AI 對局 2人/3人/4人 시작 후 `cube_rooms/AI_CUBE_*/turnOrder[0] === userId` 확인
- [ ] 사용자 승리시 `_orderIdx = 0` → 先手 보너스 (n−1)×8 최대치 획득

---

## 14. 알려진 한계 (v10)

- **V99Sichen 분 정확도** — `setTimeout` 분 경계 재계산이지만 tab background 시 갱신 drift 가능. 사용자 visibilitychange 시 즉시 갱신으로 보정.
- **V99Body 점 좌표 정확도** — 학술적 위치(예: 三陰交=내과 위 3촌)와 100% 일치하지 않음. 시각화 의도 — 학습 도구로 정확한 혈위치 학습이 목적이면 별도 모듈 권장.
- **V99Body BL 67혈 배치** — BL은 등 양쪽 두 줄(背一行·背二行)이지만 정면도라 단일 path 로 압축. 향후 후면도 토글 권장.
- **V99Body 通明 unlock 불가역** — 한 번 달성 시 印 영구 부착. 의도된 동작 (성취 보존). 디버그용 reset 함수는 콘솔에서만 호출 가능 (`V99Body._debugReset()`).
- **V99Analytics 외부 데이터 의존** — PAST_EXAMS·BULK_QUESTIONS 의 `q.chapter` 필드 일관 필요.
- **V99Exam 시간 정확도** — `setInterval(1000)` 기반. tab background·throttling 시 drift 가능. 향후 `performance.now()` + visibilitychange 보정 권장.
- **V99SpeedCube 단독 모드 deck 의존** — `BC._proto` 가 build 후에만 사용 가능. 모듈 startup 시 BC.build() 보장.
- **V99Note import 충돌** — JSON 병합 시 같은 formulaId 양쪽 존재시 lastEdit 우선. 사용자가 「병합 vs 덮어쓰기」 선택.
- **V99Lineage 데이터 sparse** — `derivedFrom` 필드가 일부 처방에만 있음. 향후 데이터셋 보강 권장.
- **AI 先手 보장의 사이드이펙트** — 멀티 對決은 정책 무변경 (joinedAt 우선). AI 룸만 강제 정렬.

---

## 15. v10 build

- `APP_VERSION = 'v10.0'`
- `APP_BUILD = '2026.05.18h'`
- `BC_VER = '1.2'` (bangje-cube.js 내부)

작성: 2026-05-18 · CIM Lab
