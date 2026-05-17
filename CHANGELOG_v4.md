# 方劑學 v4 — 변경 사항 (2026-05-17c)

> v3.1 → v4. 메이저 +1. 5개 축의 기능 추가.
> 모든 데이터·로컬스토리지·Firebase 키 호환성 유지.

---

## 1. 베팅 단계별 난이도 차등 (BET_LEVELS.diffProfile)

`BET_LEVELS` 의 각 항목에 `diffProfile: [D1, D2, D3, D4]` 비율 추가.
`generateBattleQuestions(n)` → `generateBattleQuestions(n, level)`.
방 생성자가 베팅 레벨을 알고 있으므로 호출부에서 그대로 전달.

| 레벨 | D1 | D2 | D3 | D4 | 정의 |
|---|---:|---:|---:|---:|---|
| 小博 (5%, ≥20氣) | 60% | 30% | 10% | 0% | 빈출/기초 |
| 中博 (15%, ≥50氣) | 20% | 50% | 25% | 5% | 응용 |
| 大博 (30%, ≥150氣) | 5% | 30% | 45% | 20% | 심화 |
| 賭命 (50%, ≥500氣) | 0% | 10% | 40% | 50% | 지옥 |

각 난이도별로 (PAST_EXAMS + BULK_QUESTIONS) 우선 sample, 부족하면
`generateQuizQuestions(need, d)` 로 자동 보충 → 4단계가 항상 정확한 비율
유지됨 (高난이도에서도 풀 부족으로 인한 편향 없음).

**UI 표시** — 베팅 셀 하단에 4분할 strip (D1=松柏綠 / D2=帝王黃 / D3=朱砂紅 /
D4=玄黑). 각 segment 폭은 비율, 안에 % 숫자. hover title 로도 의미 안내.

**비대칭 주의** — 양 플레이어가 동일 문제 세트를 풀므로 등급 낮은 학습자가
大博/賭命에 진입하면 D3·D4 위주를 마주함. 의도된 패널티지만 결과 화면에서
"이번 문항 평균 난이도 X.Y" 노출은 후속 작업으로 남김.

---

## 2. 자동 문제 생성 — 즉석 생성 유지 + 옵션 인자 확장

`generateQuizQuestions(n, diff)` → `generateQuizQuestions(n, diff, opts)`.

- `opts.chapter` (string) — formula.chapter 와 정확 매칭 (예: '8장-補氣-補氣')
- `opts.formulaIds` (string[]) — 특정 처방 id 들로 제한

기존 호출부 모두 호환 (opts 기본 = `{}`). 콘텐츠 해시 qid 와 글로벌 통계
누적은 그대로.

`startQuizSession(mode, diff, count)` → `startQuizSession(mode, diff, count, opts)`.
internal `filterByOpts()` 헬퍼로 chapter/formulaIds 필터 적용 후 풀 구축.
모든 모드(past/new/wrong/auto/mixed)가 일관되게 필터링됨.

---

## 3. 私的 약점 분석 (개인 오답) + 학습 연결

새 `renderPersonalAnalysis(det)` 함수. 통계·분석 탭의 **첫 번째** 타일로 노출
(default sub-tab). 기존 글로벌 오답 랭킹(`renderWrongsRank`) 은 두 번째로 이동.

**데이터**: `S.wrongIds` (개인 누적 오답 id) 와 question metadata 교차.
자동생성 문제(`auto:*`) 는 메타 일관성 부재로 분석 제외.

**4축 분석**:

1. **章별 약점** — `chapter.split('-')[0]` 1차 분류. 章 내 문항 수 대비
   정규화 (단순 카운트가 아닌 비율). 上位 3개 章을 `weak` 강조.
2. **처방별 약점** — formula.han 매칭. 처방 내 문항 수 대비 정규화.
   TOP 12, 上位 5개 표시.
3. **유형별** — type 필드 빈도 TOP 8, 칩으로 표시.
4. **난이도별** — D1·D2·D3·D4 strip (각 색상 = DIFFICULTY_META.color).
   最多 약점 난이도를 **추천 학습 난이도**로 자동 산출.

**액션 버튼** (각 章/처방 행 옆 + 하단 처방안 4-grid):

- `出` **이 章 자동 출제** — 해당 章에 속한 처방들을 `formulaIds` 로 모아
  `startQuizSession('auto', weakestDiff, 10, {formulaIds})` 호출. 약점 章에
  해당하는 자동 문제 10문이 즉시 출제됨.
- `析` **이 처방 심층** — 기존 `openFormulaDeep(formulaName)` 재활용.
  처방 한자명을 키로 lookup (api 호환).
- `問` **학습 탭 (章 필터)** — quiz 탭으로 이동 + toast 안내.
- `錯` **오답함** — `mode='wrong'` + 추천 난이도 prefil 후 quiz 탭.

**正規化의 한계** — 章 내 "노출 횟수" 가 아닌 "章 내 문항 수" 로 나눔.
정확하려면 `S.seenIds` 카운터 도입 필요하나 localStorage 비용 증가로
이번엔 후자로 유지. 한 번도 안 푼 章은 분모만 있고 분자 0 → 비율 0 →
"강한 영역" 으로 잘못 분류될 수 있음에 주의.

---

## 4. 神階 메달리온 발광 효과

`.cmedal.cat-divine` (黃帝·神農·伏羲·女媧·岐伯) 에 황금빛 오로라.

- **box-shadow 펄스** — `divine-aura` 2.6초 keyframes, 안→밖 빛 강도 변화
- **::before conic-gradient** — 7초 회전, blur 7px, 외곽에 4-spoke 후광
- **picker grid 위상차** — 5인이 한 줄에 보일 때 `nth-child(N)` 마다 0.52초
  delay → 도미노 파동 효과
- **`prefers-reduced-motion` 존중** — 모션 민감 사용자에겐 정적 glow 만

`overflow:hidden` 부모에선 자연스럽게 잘림 (작은 칩에선 미미, 큰 표시에선
완전 발현). 의도적 단계화.

---

## 5. 배틀 인트로 — 양측 동시 한문 낭독 (A안: zh-CN TTS)

`BATTLE_INTRO_MS` 5000 → **9000ms**. 양측 무음일 때(이순재끼리 매칭) 한해서만 5000ms로 단축.

**TTS 시스템** — 새 `tts` 객체:

- `tts.init()` — `speechSynthesis.getVoices()` prefetch. `voiceschanged`
  이벤트 + 1.5초 폴백. `zhVoices` 캐시 (zh-CN 우선 → zh-TW → zh-HK).
- `tts.speak(text, opts)` — `SpeechSynthesisUtterance` 생성. lang='zh-CN',
  rate=0.85, pitch=opts.pitch.
- `tts.speakIntroPair(meId, meText, oppId, oppText)` — 양측 거의 동시
  `speak()` 호출. 이순재(`leesoonjae`) 측은 무음. pitch 0.92/1.08 로
  남녀 톤 분리 → 동시 재생 시 청각적 구별. voice 두 개 잡히면 voice
  자체도 다르게 (Firefox 등은 진짜 병렬, Chrome 은 순차 재생이지만
  끊김 없이 이어지므로 9초 안에 양측 모두 들림).
- `tts.cancel()` — skip/timeout 시 즉시 정지.

**user-gesture prime** — 첫 클릭/키 입력 시 `tts.init()` 호출하여 voice
목록을 사전 로딩 (iOS Safari의 첫 호출 voice empty 회피).

**시각적 동시 펄스** — `.intro-bubble` 에 `intro-speaking` 클래스 부여,
0.6초 펄스 (gold glow + scale 1.025) 4.5초간. 양측 동시 동일 timing →
시각으로도 함께 말하는 효과.

**자막** — 기존 한문 / 한글 해석 / 출처 3행 유지. modern Mandarin pinyin
별도 자막은 시간 절약 위해 생략 (data-physicians.js 의 `py` 필드는 인물
이름 한정이라 quote 별 pinyin 은 별도 작업 필요).

**브라우저 호환**:
- iOS Safari: 음소거 모드에선 무음 (정상 동작). voice 로드 비동기 →
  `markGesture` 후 init 으로 prime.
- Chrome/Edge: speak() 직렬화 — 약 1.5초 간격으로 양측 발화. 시각적으로는
  동시 펄스로 보임.
- Firefox: 부분 병렬 — 실제 동시 발화 가능.
- `speechSynthesis` 미지원 환경: 무음 + 시각 펄스만 작동.

---

## 6. 사진 시스템 — 32인 모두 로컬 파일 보유

v3.1 의 `photos/README.md` 가이드대로 사용자가 직접 다운로드한 사진
**32장** 모두 `photos/{id}.jpg` (또는 `.png`) 로 정렬 완료.

검증된 fallback 19인 + 사용자 다운로드 32인 + 이순재(별도) = **52장** 의
사진 데이터. SVG init 메달리온 폴백은 사실상 비활성화 (모든 인물이
로컬 또는 fallback 으로 사진 표시).

`zhanglu` (張璐) · `chenziming` (陳自明) — 이전 동명이인 충돌로 SVG
폴백 처리됐던 두 인물도 이제 사용자 제공 사진으로 정상 표시.
`CHARACTER_IMAGES` 의 caption 도 정상화 (`'사진 필요'` → `'사용자 제공'`).

---

## 기타

- 버전 표기: v3.1 → **v4** (`APP_BUILD: 2026.05.17c`)
- 헤더 코멘트 일괄 통일: 모든 파일 `vN` 라벨을 v4로
- `sw.js` 캐시 키 bump: `bangje-pwa-v3-2026-05` → `bangje-pwa-v4-2026-05`
- syntax 점검 통과 (Node Function() parse — app.js / data-*.js 全)
- localStorage 키 변경 없음 — `quiz.sel.v1`, `S.*` 그대로 호환

---

## 인수 체크리스트

- [ ] 매칭 2인 동시 테스트에서 베팅별 난이도 분포 차이 체감 확인
- [ ] 神階 메달리온 picker grid 도미노 파동 확인 (5인 한 줄)
- [ ] 인트로 9초 동안 양측 TTS 발화 (이순재 매칭 시 5초로 단축)
- [ ] iOS Safari에서 첫 클릭 후 TTS voice 정상 로드
- [ ] 私的 약점 분석에 본인 오답 데이터가 채워지면 章별 비율·액션 버튼 동작
- [ ] 자동 출제로 진입 시 약점 章 처방 위주로 문제 생성되는지

---

작성: 2026-05-17 · CIM Lab
