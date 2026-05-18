# CHANGELOG v11.5.4 — 2026-05-18

## 시험범위 확정 (補血劑까지)

CIM Lab 본과 2학년 방제학 II 2차 수시 범위가 **표리쌍해제(7장) + 보익제(8장) 補氣劑·補血劑까지**로 확정됨에 따라 범위 밖 처방·문항 정리.

### 데이터 (`data-formulas.js`)

- **FORMULAS 19 → 11 처방**
  - 제거: 八珍湯·十全大補湯·歸脾湯·炙甘草湯·六味地黃丸·大補陰丸·腎氣丸·地黃飮子
  - 유지: 사군자탕·보중익기탕·삼령백출산·사물탕·당귀보혈탕 + 7장 6 처방
- **PAST_EXAMS 83 → 45**: 위 8 처방 + 인삼양영탕·지백지황환·기국지황환·제생신기환·우귀환 참조 문항 자동 제거

### 데이터 (`data-questions-bulk.js`)

- **BULK_QUESTIONS 356 → 330**: 팔진탕(11) + 십전대보탕(8) + 인삼양영탕(7) = 26문 제거
- 유지: 옥병풍산·생맥산·인삼합개산·승양익위탕·익기총명탕·승함탕·거원전·보원탕 (PDF상 補氣劑 절 내 부방으로 다뤄짐)

### UI (`app.js`)

#### 新 — 章·小分類 體系 (`CHAPTER_TAXONOMY`)

`FORMULAS.chapter`(`'8장 補益劑·補氣'`) ↔ 기출 코드(`'8-1'`)를 잇는 단일 출처. 헬퍼 함수 `getChapterByCode(code)` / `getChapterByFormula(fchapter)` 공개.

#### `renderFormulas()` 재작성

- 평면 리스트 → **大分類(7장·8장) → 小分類(解表攻裏·解表淸裡·解表溫裏 / 補氣·補血)** 접이식 트리
- 헤더 클릭 토글, 펼침 상태 localStorage 캐시(`formula.groups.open.v1`)
- 빈 소분류 자동 숨김

#### `renderQuiz()` 章 선택 카드 추가

- 난이도 카드 위에 신규 카드: 전체 / 7장 / 8장 / 解表攻裏 / 解表淸裡 / 解表溫裏 / 보익제·서론 / 補氣 / 補血 칩
- 각 칩에 해당 章의 문항 수 표시
- 선택값 `sel.chapterCode` localStorage(`quiz.sel.v1`)에 저장

#### `startQuizSession()` 필터 확장

- `filterByOpts`에 `opts.chapterCode` 처리 추가
  - `'8'` 등 大分類: `chapter` 가 `'8-'`로 시작하는 문항만 통과
  - `'8-1'` 등 小分類: 정확 매칭
- `generateQuizQuestions()`도 `opts.chapterCode` 지원 — `getChapterByCode`로 taxonomy 조회 후 `FORMULAS.chapter` prefix 매칭으로 처방 풀 필터링

### 캐시

- `sw.js`: `CACHE = 'bangje-pwa-v11-5-4-2026-05'` (사용자 단말 자동 갱신)

---

## 검증

```
$ node validate.js
FORMULAS: 11
PAST_EXAMS: 45
BULK_QUESTIONS: 330
OOS refs in PAST_EXAMS: 0
OOS refs in BULK: 0
app.js: syntax OK

Formula grouping:
  사군자탕    → 보익제 / 보기제
  보중익기탕  → 보익제 / 보기제
  삼령백출산  → 보익제 / 보기제
  사물탕      → 보익제 / 보혈제
  당귀보혈탕  → 보익제 / 보혈제
  대시호탕    → 표리쌍해제 / 해표공리
  방풍통성산  → 표리쌍해제 / 해표공리
  갈근황금황련탕 → 표리쌍해제 / 해표청리
  석고탕      → 표리쌍해제 / 해표청리
  오적산      → 표리쌍해제 / 해표온리
  계지인삼탕  → 표리쌍해제 / 해표온리
```
