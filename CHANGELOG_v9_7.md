# CHANGELOG — v9.7 (2026-05-18)

> **방제학 PWA · CIM Lab**
> 시험일 D-2 · build `2026.05.18d`

## 요약 한 줄

> **業績·印章 시스템 + 캐릭터 시그니처 三段 효과(章典/逸品/絕學) 솔로 학습 전용으로 추가. 멀티 對決 균형 무영향.**

---

## 1. 새 기능

### 1-1. 캐릭터 시그니처 三段 효과 (솔로 학습 전용)

각 캐릭터(歷代醫家)는 자신과 연관된 處方·章 문제에서 추가 효과를 발동합니다. **솔로 학습 모드에서만** 작동하며 멀티 對決·카드 對決·큐브 對局에서는 점수·시각 모두 비활성.

| 단계 | 트리거 | 보너스 | 시각 효과 |
|------|--------|--------|-----------|
| **章典** | 캐릭터의 章에 속한 문제 정답 | +10% 氣 | 우상단 코너 메달리온 + 도장 (0.8초) |
| **逸品** | 캐릭터의 시그니처 처방 문제 정답 | +25% 氣 | 풀화면 한문 인용 + 캐릭터 색 광채 (1.6초) |
| **絕學** | 한 퀴즈 내 逸品 5연속 | 추가 +50% 1회 | 大印 "絕學" + 메달리온 회전 (2초) |

- **보너스 상한**: 한 퀴즈 합산 시그니처 보너스는 base 점수의 **+50% 캡**. 폭주 방지.
- **사운드**: Web Audio Oscillator 직접 합성. 五聲音階 기반 — gold(鐘)·silver(磬)·jade(5음 분산)·wood(魚)·silk(三和音)
- **絕學 발동 조건**: chapter 매칭은 streak를 끊지 않지만, 오답은 끊음

#### 주요 매핑 (`data-signatures.js`)

| 캐릭터 | chapter | 시그니처 처방 |
|--------|---------|---------------|
| **李東垣**(ligao) | 補氣·補血·補益 | 補中益氣湯, 當歸補血湯 |
| **張仲景**(zhongjing) | 溫裏·溫經·回陽·表裏雙解·陰陽兼補 | 12 처방 (傷寒論·金匱要略 全) |
| **錢乙**(qianyi) | — | 六味地黃丸 |
| **朱震亨**(zhuzhenheng) | 補陰·補血 | 大補陰丸 |
| **薛己**(xueji) | 氣血雙補 | 八珍湯, 歸脾湯 |
| **嚴用和**(yanyonghe) | 氣血雙補 | 歸脾湯 (濟生方 원방) |
| **劉河間**(liuwansu) | 表裏雙解·陰陽幷補 | 防風通聖散, 地黃飮子 |

> 시그니처가 정의되지 않은 캐릭터는 평범한 학습 흐름. **이순재**는 별도로 정답 시 10% 확률로 어록만 출력 (보너스 0).

### 1-2. 業績·印章 시스템

- **46개 업적**(8 카테고리: 학습/문답/章典/氣博/流派/時辰/同學/特技)
- 해제 시 **印章**(seal) 보상 — 한자 1자 도장 + tier별 광채 (銅/銀/金/翠)
- **印章 장착** 최대 3개 → 메달리온 옆에 작은 도장으로 표시 (프로필 꾸미기)
- 홈에 `業績·印章` 타일 자동 inject → 갤러리 모달 (해제 진행도 + 장착 토글)

#### 카테고리별 주요 업적

- **학습**: 첫걸음, 學徒(10문), 醫工(50), 醫師(100), 良醫(300), 大醫(1000)
- **문답**: 連中(5연속), 十連(10), 廿連(20), 完璧(全정답), 十全(全정답 10회), 知過(오답함 비움)
- **章典**: 補益章/溫經章/雙解章 通(章별 정답 누적), 三章 貫通 (6·7·8장 각 20문)
- **氣博**: 初戰, 五勝, 廿勝, 三連勝, 不敗(10연승), 大博 승리, 賭命 승리
- **流派**: 8 流派 涉獵, 神階 1인/全 해금, 行家(한 캐릭터 100문), 番外(이순재 사용)
- **時辰**: 子時/寅時/午時 학습, 試驗前夜, 臨試(D-Day)
- **同學**: 첫 채팅(發言), 큐브 對局(方剋), 同學 5인 동석
- **特技**: 첫 章典/逸品, 家門(逸品 25회), 絕學, 雜談(이순재 어록), 印章 收藏家(15개 해제)

### 1-3. 디렉토리 정리

- 캐릭터 사진 36개 → `images/characters/` 폴더로 이동
- 루트에는 PWA 아이콘 3개(`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`)만 잔존
- `data-physicians.js` 의 `_LOCAL` 헬퍼 경로 갱신 — 사용자 추가 캐릭터도 이 폴더에 저장

---

## 2. 변경된 파일

### 신규
- `data-achievements.js` — 업적 정의 (46개 + 카테고리·tier 메타)
- `data-signatures.js` — 캐릭터 시그니처 정의 (48 캐릭터)
- `bangje-v97-signatures.js` — 시그니처 런타임 (평가·시각·사운드)
- `bangje-v97-achievements.js` — 업적 추적 런타임 (카운터·조건·해제 토스트)
- `bangje-v97-profile.js` — 印章 + 業績 갤러리 UI
- `CHANGELOG_v9_7.md` — 이 문서

### 수정
- `app.js`
  - `APP_VERSION`/`APP_BUILD` → v9.7 / `2026.05.18d`
  - `startQuizSession`: V97Sig 세션 초기화 + streak 트래킹
  - 퀴즈 결과 view: 시그니처 보너스 라인 추가
  - 정답 클릭 핸들러: V97Sig.evaluate → fireEffect → tickSession + V97Ach 누적
  - `startBattle`/`renderBattleIntro` 직후: V97Sig.setMode('multi')
  - `showResult` 진입 시: V97Sig.setMode('solo') 복원 + V97Ach.recordBattle
  - 카드 對決 `renderCardResult`: 동일 처리
  - `loadPresenceList`: V97Ach.recordPresencePeak
- `data-physicians.js` — `_LOCAL` 헬퍼 경로 → `images/characters/`
- `bangje-v96-part1.js` `sendMsg`: V97Ach.recordChat
- `bangje-cube.js` `joinRoom`/`createRoom`: V97Ach.recordCubeJoin
- `index.html` — 스크립트 5개 추가 (data-achievements/signatures · v97 3개)
- `sw.js` — 캐시 키 `bangje-pwa-v9-7-2026-05`, PRECACHE 갱신, network-first regex `v9{6,7}` 으로 확장

---

## 3. 데이터 마이그레이션

추가되는 `S.*` 필드 (자동 초기화):
- `S.achievements: string[]` — 해제 업적 id 배열
- `S.equippedSeals: string[]` — 장착 印章 id (최대 3개)
- `S.achStats: { [counter]: number }` — 누적 카운터
- `S.battleStats: { wins, losses, draws, bigWins, fateWins, curStreak, bestStreak, attended }`
- `S.signatureStats: { chapterFired, yipinFired, juexueFired, leelineFired }`

`V97Ach._ensureFields()` 가 부팅 시 누락 필드를 안전하게 채움. 기존 v9.6 사용자도 첫 액션 시 자동 마이그레이션.

---

## 4. Firebase 영향

**없음.** 모든 업적·시그니처는 로컬 저장. 기존 10개 룰(`presence`/`feedback`/`lobby`/`lobby_idle`/`battles`/`lobby_card`/`card_battles`/`cube_rooms`/`stats`/`system`) 그대로 사용.

---

## 5. 멀티 균형 보호 메커니즘

**3중 안전장치**로 멀티 對決 균형에 영향을 주지 않음:

1. **모드 게이트**: `V97Sig.setMode('multi')` → `evaluate()` 후 `fireEffect()` no-op, `sessionBonus()` 0 반환
2. **시각 격리**: 코너/풀화면 효과 모두 `_mode === 'multi'` 시 DOM 생성 자체 skip — 상대에게 노출 0
3. **로비/배틀 진입점에서 명시 설정**: `startBattle`/`startCardBattle`/`renderBattleIntro` 직후 multi, `showResult`/`renderCardResult` 진입 시 solo 복원

큐브 對局은 별도 흐름이라 시그니처가 점수에 영향을 줄 수 없는 구조(점수 합산이 자기 처방 평가에서 옴). 안전.

---

## 6. 알려진 사소한 동작

- 시그니처 평가에서 자동생성 문제는 `q.formula`/`q.formula_id` 가 정확해야 매칭 → 자동생성 처방의 chapter 정보가 부정확하면 章典만 트리거되거나 미발동. 기출(`PAST_EXAMS`)·신규 자작(`BULK_QUESTIONS`)은 정확.
- 시간대 업적은 `Date.getHours()` (사용자 로컬 timezone). KST 가정.
- D-Day 업적은 `EXAM_DATE_ISO` (2026-05-20) 기준. 시험 변경 시 상수 수정 필요.

---

## 9. v9.7e 추가 (2026-05-18, build `2026.05.18e`)

### 카드 對決 — 증상 공개 흐름 재정비

**버그 픽스**: v9.6.x 까지 `openInitialRevealModal`·`openDeckEmptyRevealModal` 함수가 호출만 되고 정의 안 됨. 그래서:
- 일부 경로(과거 `autoRevealOneSymptom({kind:'initial'})` 직접 호출)에선 SSE re-render 가 `me.initialRevealed` flag 의 FB 동기화보다 빨라 **선공 측이 2개 공개되는 race condition** 발생
- 새 호출 경로에선 함수 미정의로 `.catch(_=>{})` 가 ReferenceError 흡수 → 아예 안 공개

**v9.7e 픽스**: 두 모달 정식 구현. 사용자 선택식, 클라이언트 가드 `_cardInitialPickerShown`·`_cardDeckPickerTurnIdx` 로 race 차단.

| 트리거 | 모달 | 타임아웃 | 폴백 |
|--------|------|---------|-----|
| 게임 시작 (자기 첫 진입) | `openInitialRevealModal` | 30초 | 첫 번째 증상 자동 |
| 덱 소진 + 자기 턴 | `openDeckEmptyRevealModal` | 15초 | 첫 번째 증상 자동 |
| 전탕 빗나감 (페널티) | `openPenaltyRevealModal` (기존) | 6초 | 무작위 |

### 큐브 對局 — 본초 덱 분포 재조정

방제학 실제 출현 빈도 측정 후 비례 강화. 기존: f≥10 일률 4장 (平坦화). 신규: 5단계 세분화.

| 빈도 (회) | 구 덱 | 신 덱 | 해당 본초 |
|-----------|-------|-------|----------|
| ≥25 | 4 | **7** | 甘草 (34회) |
| ≥15 | 4 | **5** | 生薑·白芍·茯苓·大棗 |
| 10-14 | 4 | 4 | 當歸·桂枝·人蔘·白朮·川芎 |
| 5-9 | 3 | 3 | 黃耆·半夏·黃芩·大黃·麻黃·… |
| 2-4 | 2 | 2 | — |
| 1 | 1 | 1 | — |

총 덱 장수: 236 → **243** (+7장, 게임 시간 거의 영향 없음). 甘草 비율 1.7% → **2.9%**.

### 방제 사전 (`bangje-v97-formuladict.js`)

게임 중 막힐 때 참고 가능한 처방 사전 모달.

- 카드 對決 보드 헤더 + 큐브 보드 헤더에 `方劑 사전` 버튼 추가
- 章별 필터 (6/7/8) + 실시간 텍스트 검색 (처방명·작용·약재)
- 항목 클릭 → 펼침 (構成·作用·適應·源·要點·訣)
- `V97Dict.open()` / `V97Dict.close()` API

### 변경된 파일 (v9.7e)
- `app.js` — 모달 2개 정의(+165 lines), 카드 對決 규칙 문구, 보드 사전 버튼, 빌드 → `2026.05.18e`
- `bangje-cube.js` — 분포 공식, 보드 사전 버튼
- `bangje-v97-formuladict.js` — 신규
- `index.html` — 스크립트 추가
- `sw.js` — 캐시 키 `bangje-pwa-v9-7-2026-05b`, PRECACHE 갱신

---

## 7. 다음 단계 (v9.8 잠재 아이디어)

- 매칭 시 印章 chip 으로 상대 학습 진도 한눈에 (필요 시 `presence` 에 `seals: string[]` 추가, 룰은 그대로)
- 캐릭터별 누적 학습 통계 화면 (현재 `_rightByChar` 카운터는 있음, UI 없음)
- 업적 추천 — 가까운 해제 가능 업적 3개를 홈에 표시
- 시그니처 효과 사용자 토글 (애니메이션·소리 끄기 옵션)
