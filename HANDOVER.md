# 方劑學 学習帳 — 인수인계 (CIM Lab)

본 문서는 CIM Lab 의 방제학 2차 수시 대비 PWA 인수인계 자료다. 신규 합류 구성원이 별도 컨텍스트 없이 코드를 이해·확장할 수 있도록 작성. 최종 갱신 **v1.0 (2026-05-17)**.

## 0. 현재 상태 스냅샷 (v1.0)

- **빌드 일자**: 2026-05-17 (D-3, 시험 5/20)
- **CIM Lab Greek PWA (paideia v59)** 의 구조·UI 원칙을 차용하여 방제학 용도로 재작성. 단, Greek 의 형태분석·전집·BGM·캐릭터·멀티 배틀 모듈은 *방제학 시험 4일 학습 목적상 불필요*하므로 제외하고 핵심 학습 모듈(어휘카드↔처방카드, 객관식, 검색, SRS, 4일 계획)에 집중.
- **사용자 정책 준수**:
  - i18n 영구 제외 (Greek v49 세션 사용자 지시)
  - HANDOVER 매 라운드 동봉 (Greek v53 세션 지시)
  - 한자 표기는 번체 유지 (시험 표기와 일치)

**산출물 (7 파일)**:
- `index.html` (~12 KB) — 셸 + CSS + nav + view
- `data-formulas.js` (~50 KB) — 24 처방·68 약재·23 기출·4일 계획 데이터
- `app.js` (~50 KB, 통합) — 상태·라우팅·홈·함정·처방·암기카드·객관식·기출·비교·약재·SRS 의 모든 렌더러
- `sw.js` — 서비스 워커 (network-first index.html, cache-first 나머지)
- `manifest.json` — PWA 매니페스트 (PNG 192·512, SVG, apple-touch)
- `icon.svg` + `icon-192.png` + `icon-512.png` + `apple-touch-icon.png` — 아이콘
- `README.md` — 배포·사용 안내
- `HANDOVER.md` (이 문서)
- `NEXT_TASKS.md` — v2 작업 계획

**구조 변경 노트 (v1.0 빌드 막바지)**:
- 초기 분할안(`modules-1.js`, `modules-2.js`) 대신 **단일 `app.js`** 채택. 4 일짜리 단일 목적 PWA 라서 분할의 이득이 거의 없고, 통합본이 디버깅·검색·인수인계가 쉬움. v2 에서 기능 추가 시 분할 고려.
- `manifest.json` · `icon.svg`

**총 ~113 KB** (Greek v59 의 920 KB 대비 매우 가볍게 — 시험 4일 단기 학습 용도라 군더더기 제거).

**기능 카탈로그**:
- 4일 단계별 학습 계획 (D-3 ~ D-day, 자동으로 오늘 단계 강조)
- 시험까지 D-N 카운트다운 (분 단위 갱신)
- 처방 24 (8장 보익제 16 + 6장 온리제 2 + 7장 표리쌍해제 6) 카드
- 처방 상세: 작용·적응증·구성·군신좌사·기본방·핵심 포인트·가감법·파생방·관련 기출
- 암기카드 3 모드: 작용 / 구성약물 / 적응증
- 객관식 3 범위: 전체(자동생성 + 기출 80+ 문제) / 작년기출만(23문) / 오답함만
- 객관식 자동 생성 3 유형: 작용 매칭 / 적응증→처방 / 구성에 들지 않는 것
- 작년 기출 23문 처방별 묶음 + 해설
- 처방 비교 10표 (사군자↔향사육군자, 보중↔귀비, 백호↔당귀보혈, 자감초↔생맥산, 시호제 3종 등)
- 약재 68 효능 + 사용 처방 역인덱스
- 오답함 (플래시 모름 + 기출 오답 + 자동 객관식 오답) 통합 SRS
- D-day 함정 카드 19 항목

## 1. 데이터 출처 및 추출 과정

**시험 범위 PDF**:
- `-59.pdf` (128p, Hwp 2020 변환) → 1~59 페이지가 시험 범위. 8장 보익제.
- `127-.pdf` (174p, Hwp 2020 변환) → 127~174 페이지가 시험 범위. 6장 온경산한제 + 7장 표리쌍해제.

**작년 기출 HWP**:
- `22학번_본과2학년_2학기_1차수시_방제학.hwp` — 보익제~고삽제 (올해 범위 일치 ↑)
- `22학번_본과2학년_1학기_기말고사_방제학.hwp` — 4장 5절~7장 (올해 범위는 6·7장만)

**추출**: `pdftotext -layout` + 한글 발음첨자 줄 제거 + 정규식 마커 매칭 ([구성][작용][적응증][배오][가감법] 등).

23/23 처방의 자동 추출 검증 통과. 23 핵심 + 1 부속(황기계지오물탕) = 24 처방.

**큐레이션 원칙**:
- 한자(번체) 우선 표기 — 시험 표기와 일치
- 작용은 짧은 어구로 (益氣健脾, 補血和血)
- 적응증은 핵심 증상 위주
- 군신좌사는 본문에 명시된 경우만
- 기본방 합방 관계는 명시적으로 (사군자+사물=팔진 등)
- 작년 기출은 *올해 시험 범위 처방*에 한정해서 매핑

## 2. 코드 구조

**상태 관리** (`S` 객체, `bangje.state.v1` localStorage 키):
```js
{
  bookmarks: [],      // (예약, 미사용)
  wrongIds: [],       // 'past:N', 'auto-act:id', 'auto-ind:id', 'auto-comp:id', 'fc:id'
  lastFcIdx: 0,       // 플래시카드 마지막 위치
  fcMode: 'action',   // 'action' | 'composition' | 'indication'
  quizScope: 'all',   // 'all' | 'past' | 'wrong'
  lastTab: 'home',
  knownIds: []        // 플래시카드에서 '안다' 표시한 처방
}
```

**라우팅**: `setTab(name)` 단일 함수. View `<main id="view">` 의 innerHTML 교체.

**데이터 모델** (data-formulas.js):
- `FORMULAS` 배열 (24) — 각 entry: `{id, ko, han, alias, chapter, section, order, composition[], action, indication, monarch_minister{}, baseFormula, keyPoints[], addRules[], derived{}, past[]}`
- `HERBS` 배열 (68) — `{ko, han, meaning}`
- `PAST_EXAMS` 배열 (23) — `{src, formula, type, q, options[], answer, explanation}`
- `STUDY_PLAN` 배열 (4 일) — `{day, label, goals[], tasks[]}`
- `EXAM_META` 객체

**모듈 분담**:
- `app.js` — STATE, util, countdown, routing, renderHome, renderPitfalls, init
- `modules-1.js` — renderFormulas, showFormulaDetail, renderCompare
- `modules-2.js` — renderFlashcard, buildQuestionPool, renderQuiz, renderPast, renderHerbs, renderSRS

## 3. 향후 작업 (v1.1+)

### 즉시 후보 (시험 전 D-2~D-1 안에 추가하면 학습 도움)
- **가감법 표** 더 완전한 추출 — 현재 사군자탕·당귀사역탕 등 일부만 큐레이션. 나머지 처방의 가감법은 본문 표가 깨져서 누락.
- **서술형 가이드** — 22학번 기출에 서술형이 많음(십전대보탕 합방 이유, 황기계지오물탕 효능 등). 서술 모범 답안 카드 추가.
- **약재 빈도 시각화** — 어떤 약재가 어떤 처방군에 많이 쓰이는지 (예: 황기 = 황기계지오물탕·옥병풍산·당귀보혈탕·보중익기탕·십전대보탕 등 보기제군).

### 장기 (시험 후, 다른 시험에 재활용 시)
- 다른 범위(고삽제·청열제·해표제 등) 데이터 추가하여 본과 2학년 전 범위 커버
- Greek v59 의 캐릭터·BGM·멀티 배틀 모듈 이식 (학습 동기 부여, 그룹 스터디 용도)
- Anthropic API 통합 — 임의 처방의 서술형 모범답안 생성 (큐레이션 한계 보완)
- AGDT 같은 본문 분석 데이터 — 한방 의서(상한론·금궤요략·온병조변·동의보감) 원문 lemma 인덱스

## 4. 라이선스·출처

- 데이터: 강의 PDF + 작년 기출 (교내 CIM Lab 내부 학습 자료)
- 코드: 자유 사용 (CIM Lab 내부)
- 폰트: Google Fonts (Noto Serif KR, Noto Serif SC)
- 외부 의존성 없음 (오프라인 동작)

## 5. 알려진 한계

1. **자동 큐레이션의 데이터 정확도**: 처방의 [구성][작용][적응증] 같은 명시적 마커가 있는 필드는 정확하지만, [가감법] 표·[배오 분석] 본문은 줄바꿈·발음첨자 잔재로 일부 가독성 저하. 24 처방 모두 작용·구성·적응증·군신좌사는 수동 검증되었다.

2. **객관식 자동 생성의 distractor 품질**: 작용을 묻는 자동 문제에서 distractor 가 같은 처방군에서 추출되므로, 한방 임상 경험이 부족한 학습자는 모든 선지가 비슷해 보일 수 있다. 작년 기출 23문은 실제 시험 패턴이라 신뢰도 ↑.

3. **시험 출제 예측 불가**: 본 PWA 는 작년 기출과 강의 PDF 명시 빈출 표시를 토대로 함정·핵심 포인트를 정리했다. 그러나 출제는 매년 변동 가능. 학습자는 PDF 원문 자체도 한 번은 통독할 것 권장.

4. **시험 당일 모바일 사용**: 한의대 시험장은 보통 휴대 디바이스 반입 금지. 본 PWA 는 시험 *전* 학습 도구.

— *finis*
