# 方劑學 PWA v2.2 — HANDOVER

> CIM Lab 본과 2학년 방제학 학습 도구. Greek v60 패턴을 따른 단일-파일 PWA.

## 빠른 시작

```bash
# 1. 로컬 테스트 (Firebase 없이도 동작, 정적 데이터만 사용)
python3 -m http.server 8080
# → http://localhost:8080 에서 접속

# 2. 배포 (기존 Firebase Hosting 프로젝트 hanimaster-245f6 활용)
firebase deploy --only hosting
```

## 파일 구조 (10 파일, 모두 같은 디렉토리)

```
index.html              ← 셸 + 帝王風 CSS (제왕풍 디자인)
app.js                  ← 메인 로직 (state·BGM·라우팅·로비·배틀·통계·…)
data-ranks.js           ← 9 등급 (賓醫→眞人)
data-physicians.js      ← 51 의가 + CHARACTER_IMAGES dict
data-formulas.js        ← 처방·약재·기출 (※ v1 데이터 plug-in 필요)
icon.svg                ← 黃帝 아이콘 (面旒 곤룡포)
icon-192.png            ← PWA 아이콘
icon-512.png            ← PWA 아이콘
apple-touch-icon.png    ← iOS 홈화면 아이콘
manifest.json           ← PWA 매니페스트
sw.js                   ← 서비스 워커 (오프라인 캐시)
leesoonjae.jpeg         ← 원본 (1280×720)
leesoonjae-medallion.jpeg ← 메달리온용 크롭 (480×480)
```

## v1 데이터 이관 (★ 필수)

`data-formulas.js` 의 빈 배열에 v1.0 데이터를 붙여넣으세요:
- `FORMULAS`: 24 처방
- `HERBS`: 68 약재
- `PAST_EXAMS`: 23 기출

스키마는 파일 상단 주석 참고. v1과 거의 동일 (`monarch_minister`, `keyPoints`, `chapter` 등).

## 주요 기능

### 1. 9 등급 명예의 전당 (黃帝內經 上古天眞論 기반)

| 단계 | 한자 | 한글 | 필요 氣 |
|---|---|---|---|
| 1 | 賓醫 | 빈의 | 0 |
| 2 | 醫工 | 의공 | 200 |
| 3 | 醫師 | 의사 | 500 |
| 4 | 良醫 | 양의 | 1,000 |
| 5 | 大醫 | 대의 | 2,000 |
| 6 | 賢人 | 현인 | 3,500 |
| 7 | 聖人 | 성인 | 5,500 |
| 8 | 至人 | 지인 | 8,000 |
| 9 | 眞人 | 진인 | 12,000 |

`data-ranks.js` 에서 임계값·璽印·색상 조정 가능.

### 2. 51 의가 캐릭터

- **神階 (5)**: 黃帝·神農·伏羲·女媧·岐伯 — 氣로 잠금 해제 (900~1,200)
- **古代/唐/宋/金元/明/清/清末民國 (40)**: 카테고리별 팔레트
- **朝鮮 (2)**: 許浚, 李濟馬
- **番外 (1)**: 이순재 (거침없이 하이킥 시트콤 캡쳐, 18개 어록 랜덤 출력)

15인은 실제 사진 (Wellcome Collection CC BY 4.0 + 李時珍 동상 + 이순재 시트콤 스틸). 나머지는 SVG 메달리온 (이름의 한자 1자 + 카테고리 팔레트).

### 3. 멀티 對決 (氣博)

- **4단계 베팅**: 小博(5%, ≥20氣) / 中博(15%, ≥50氣) / 大博(30%, ≥150氣) / 賭命(50%, ≥500氣)
- **매칭**: Firebase `/lobby/{level}/{userId}` 폴링. userId 가 더 작은 쪽이 방 생성 (race 회피).
- **인트로**: "對決開始" 한자가 큰 璽印으로 등장, 양쪽 캐릭터 명언 말풍선. 이순재는 18개 어록 중 랜덤 1개.
- **5문제 객관식**: 작년 기출 + 처방 자동 생성. 60초 제한.
- **정산**: 제로섬. 승자가 패자의 베팅액 전액 획득. 무승부면 환불.

### 4. 大廳 (로비)

- **D-N 카운트다운** (`EXAM_DATE_ISO = '2026-05-20T00:00:00+09:00'`)
- **닉네임 시스템**: `S.name` 영구 저장, 헤더 + 홈 카드에 표시, 모달로 편집
- **온라인 학습자**: Firebase RTDB `/presence/{userId}` 30초마다 갱신, 90초 이내 활성자만 표시. 메달리온 + 이름 칩 (최대 24명).
- **건의사항 폼**: Firebase `/feedback` push, 최근 12개 표시
- **학습 진행**: 마스터/북마크/오답 카운터

### 5. 통계·분석

- **전체 오답 랭킹**: 모든 사용자 누적 오답 (Firebase `/stats/wrongs/{qid}`)
- **기출 분석**: 유형별 + 처방별 출제 빈도 (PAST_EXAMS 데이터 필요)
- **약재 분석**: 빈출 약재 TOP 20 → 클릭 시 君臣佐使 위치 + 사용 처방 (FORMULAS 데이터 필요)

### 6. BGM (五聲音階 古琴)

Web Audio API 로 五聲音階 (宫商角徵羽 = C-D-E-G-A) 古琴 시뮬레이션. sine + triangle 옥타브 합성, soft attack-decay, delay reverb. 70 BPM, 4마디 무작위 패턴 반복.

헤더 ♪/♫ 버튼으로 토글.

## Firebase RTDB 데이터 구조

```
hanimaster-245f6-default-rtdb.asia-southeast1/
├── presence/
│   └── {userId}: {name, character, qi, ts}
├── feedback/
│   └── {pushId}: {name, msg, ts, userId}
├── lobby/
│   └── {level}/
│       └── {userId}: {userId, name, character, bet, ts}
├── battles/
│   └── {roomId}: {level, bet, players, questions, status}
└── stats/
    └── wrongs/
        └── {qid}: <count>
```

### 보안 규칙 권장

```json
{
  "rules": {
    "presence":  { ".read": true, ".write": true },
    "feedback":  { ".read": true, ".write": true },
    "lobby":     { ".read": true, ".write": true },
    "battles":   { ".read": true, ".write": true },
    "stats":     { ".read": true, ".write": true }
  }
}
```

> ⚠️ 운영 환경에선 `.write` 에 검증 룰 추가 권장 (예: `newData.child('userId').val() === auth.uid`).

## 디자인 시스템 (帝王風)

`index.html` 의 `:root` CSS 변수:
- `--zhusha` (朱砂紅 #9C3030): 주 색상
- `--huang` (帝王黃 #C9A227): 강조
- `--mo` (墨黑 #1C140A): 텍스트
- `--mi` (米色 #F5E6D3): 배경
- `--feicui` (翡翠綠 #2A7060), `--gutong` (古銅 #876A36), `--xuan` (玄 #2C2E48): 보조

폰트:
- 디스플레이: ZCOOL XiaoWei, Ma Shan Zheng
- 한문: Noto Serif SC
- 한글: Noto Serif KR

## 알려진 한계

- **Firebase 의존**: 멀티 배틀, presence, 글로벌 통계는 Firebase 가 있어야 동작. 없을 때 로컬-only 모드로 fallback.
- **사진 라이선스**: Wellcome 시리즈 CC BY 4.0, 李時珍 PD-self. 이순재 시트콤 스틸은 fair-use (개인 학습용). 상업 배포 시 재검토 필요.
- **BGM 무작위성**: 패턴 반복이라 길게 들으면 단조로울 수 있음. 사용자 토글 가능.

## 인수자 체크리스트

- [ ] v1.0 `data-formulas.js` 내용 복사해 채워넣기 (FORMULAS·HERBS·PAST_EXAMS)
- [ ] `EXAM_DATE_ISO` 시험일 변경 (`app.js` 상단)
- [ ] `EXAM_META.rangeKR`, `rangeHan` 시험 범위 변경
- [ ] Firebase Hosting 에 배포 (`firebase deploy --only hosting`)
- [ ] 모바일 PWA 설치 테스트 (홈화면 추가)
- [ ] 멀티 배틀 2인 동시 테스트

---

## v2.2.1 — 2026-05-17 패치 (CIM Lab)

1. **멀티 큐 등록 실패 오류 수정** — `FB.put` → `FB.putRetry` (3회 재시도, exponential backoff 300/800/2000ms). 401·403(보안 룰 거부)은 즉시 중단하고 사용자에게 명시적 에러 카드 + "다시 시도" 버튼. 배틀 룸 생성도 동일 재시도 적용.
2. **캐릭터 사진 51인 완비** — 미등록 20인(巢元方·王燾·陳自明·嚴用和·陳師文·王好古·薛己·龔廷賢·趙獻可·李梴·喻嘉言·張璐·薛雪·王孟英·唐宗海·程國彭·張錫純·鄭欽安·黃元御·費伯雄) 추가. Wikimedia FilePath 패턴 등록. URL 로드 실패 시 기존 SVG 메달리온이 onerror로 자동 폴백.
3. **기출 문제 109개로 확장** — 기존 34 + ex_001~ex_075 신규 75. 0문제 처방 9방(지황음자·이중환·오수유탕·대건중탕·황기계지오물탕·방풍통성산·갈근황금황련탕·석고탕·계지인삼탕) 모두 3~5문항씩 신규 충원. 난이도 1~4 분포 균형, 12개 chapter 모두 4문항 이상 보장.
4. **`sw.js` 캐시 키 bump** — `bangje-pwa-v2-2-2026-05` → `bangje-pwa-v2-2-1-2026-05` (사용자 단말 자동 갱신).

작성: 2026-05-17 · CIM Lab

---

## v2.2.2 — 2026-05-17 패치 (CIM Lab)

### 멀티 매칭 실시간성 개선 (핵심)

**문제**: `lobby/{level}/{userId}`에 `入場` 누른 사용자만 등록되는 닭/달걀 구조 + 4s × 4 level 순차 REST 폴링 + 1.2s 초기 매칭 폴링. 두 사람이 동시에 로비를 봐도 서로의 존재를 모름 → 아무도 먼저 안 누름 → 매칭 0건.

**수정**:

1. **Firebase RTDB SSE 스트리밍** — `FB.subscribe(path, onUpdate)` 신설. EventSource 기반, `put`·`patch`·`keep-alive`·`cancel`·`auth_revoked` 처리. EventSource 미지원/실패 시 폴링(3s)으로 자동 폴백. 변경 ≤1초 반영.
2. **둘러보는 중(idle) 프레전스 분리** — `lobby_idle/{userId}`에 로비 체류자 broadcast (12s keep-alive, fresh 30s). 로비 카드 상단에 "N명이 둘러보는 중" 배너 표시 → 두 사람이 서로의 존재를 인지하고 入場 진입.
3. **cell 별 큐/관심 배지 분리** — `대기 N`(queue, 비취색)과 `관심 N`(idle 같은 level 선호, 古銅색) 두 줄 배지. 사용자가 선택 level 변경 시 idle entry의 `level` 필드 즉시 갱신.
4. **`joinBattleQueue`도 SSE로** — `/lobby/{level}` + `/battles` 동시 구독. 상대 발견 즉시 매칭 (사전 순 작은 쪽이 방 생성). 상대가 생성자일 때도 `/battles` SSE가 ≤1초 안에 잡아냄. 75s 타임아웃 환불 유지.
5. **`pagehide`/`beforeunload` 클린업** — `fetch(... , {keepalive:true})` DELETE로 idle·queue 잔여 정리. 비정상 종료해도 다른 사용자에게 stale entry 60s 노출되던 문제 해소.
6. **상수 조정** — `LOBBY_FRESH_MS` 60s → 45s, idle은 30s. self keep-alive 25s → 15s.

### 오답 빈도 분석 + 클릭으로 문제 복원

1. **`qidOf(q)` 콘텐츠 해시** — 기존 `q.id || 'auto:'+curQ`는 자동 문제마다 `curQ=0,1,2…`가 세션 간 충돌해서 `/stats/wrongs/auto:0` 카운터가 의미 없었음. 이제 PAST_EXAMS은 `past_001` 그대로, auto는 `auto:<djb2(q+옵션정렬+type)>`로 콘텐츠 해시 → 같은 내용의 자동 문제는 항상 같은 qid에 누적.
2. **`renderWrongsRank` 전면 개편** — qid → PAST_EXAMS lookup. TOP 30 row 클릭 → `openWrongDetailModal`(문제·옵션·정답·해설·글로벌 오답 회수 + "이 처방 심층 분석" 버튼). auto:* qid는 "재현 불가" 명시 (즉석 생성이므로 원본 복원 불가).
3. **자동 문제 생성 방식 명시** — 처방 모달에 "자동 생성 = 매번 즉석 stochastic 생성" 안내. 같은 콘텐츠는 콘텐츠 해시로 통계 누적되지만 1:1 복원은 불가.

### 처방별 심층 분석 (시각화)

새 stats 타일 **처방별 심층** + 기존 `byFormula` 막대에 클릭 기능. 5종 시각화 sub-tab:
- **① 効能 클러스터**: EFFICACY_CATS(補氣·補血·補陰·補陽·解表·淸熱·溫裏·瀉下·化痰·行氣·活血·安神·利水·固澁·開竅·升陽·和裏) 17 카테고리 그리드. 처방의 `action` 키워드 매칭. 한 처방이 여러 효능에 동시 매칭 허용 (예: 보중익기탕 = 補氣 + 升陽).
- **② 章·分類**: chapter sub-category(補氣·補血·氣血雙補·補陰·補陽·陰陽幷補·溫中祛寒·回陽救逆·溫經散寒·解表攻裏·解表淸裡·解表溫裏) 그룹.
- **③ 補瀉×寒熱 scatter**: `action` 키워드로 좌표 산출 (補=−x, 瀉/解=+x, 寒=−y, 熱=+y). chapter 가중치 추가. 章별 색상 (補益劑=黃, 溫裏劑=朱砂, 表裏雙解=翡翠).
- **④ 구성 약재 수 분포**: ≤3·4–5·6–7·8–10·≥11味 bin 히스토그램 + 大方 TOP 10.
- **⑤ 君藥 빈도 TOP 12**: 全 처방의 君藥. 막대 클릭 → 해당 君藥을 쓰는 처방 펼치기.

처방 칩 클릭 → **`openFormulaDeep` 모달** (구성·작용·적응증·君臣佐使 pill·핵심 포인트 + 자주 묻는 유형·출제 시험 mini-bar + 글로벌 오답순 기출 리스트). 기출 행 클릭 → 문제 상세 모달 재귀.

칩 배경 농도가 글로벌 오답 회수에 비례(`--heat`) → 빈출 오답 처방이 시각적으로 두드러짐.

`EFFICACY_CATS`를 약재 분석과 공용(module scope hoist) → 단일 사전.

### 사진 오류 정정 (진자명·장로)

`chenziming`(陳自明 1190–1270), `zhanglu`(張璐 1617–1700) — Wikimedia Commons의 `Chen_Ziming.jpg`·`Zhang_Lu.jpg`가 동명 현대인을 가리켜 잘못된 사진이 표시되던 문제. 두 entry를 CHARACTER_IMAGES에서 제거 → SVG 메달리온이 자동 폴백.

### 사진 보완 진행 상황

v2.2.1에서 추가한 20인의 Wikimedia FilePath 패턴은 추정값. Commons에 실제 존재하는 파일은 약 절반. 나머지는 onerror → SVG 폴백 동작. 다음 인물들은 SVG 메달리온 상태이며 검증된 도상 URL이 있으면 추가 가능:

> 巢元方·王燾·嚴用和·陳師文·王好古·薛己·龔廷賢·趙獻可·李梴·薛雪·王孟英·唐宗海·程國彭·鄭欽安·黃元御·費伯雄·王清任·徐大椿·吳鞠通·吳又可·張景岳

陳自明·張璐는 의도적으로 SVG 폴백 (동명인 충돌). 검증된 URL 발견 시 `data-physicians.js`의 `CHARACTER_IMAGES` 에 entry 추가만 하면 됨 (스키마 동일).

### Firebase 보안 룰 (추가 필요)

```json
{ "rules": {
    "lobby_idle": { ".read": true, ".write": true }
}}
```

기존 룰에 `lobby_idle` 항목 추가. 누락 시 SSE 폴백·SVG 폴백 둘 다 작동하므로 fatal은 아니지만 둘러보는 중 기능이 무력화됨.

### 캐시 키

`bangje-pwa-v2-2-1-2026-05` → `bangje-pwa-v2-2-2-2026-05`.

작성: 2026-05-17 · CIM Lab

---

## v3 — 2026-05-17 패치 (CIM Lab)

> v2.2.x 누적 패치를 종합하여 단일 메이저 릴리즈로 승격. 표면적으로는 (a) 大量 문제(356), (b) WebAudio 합성 BGM·SFX, (c) 배틀 정산 데드락 해소, (d) 결과 UI 재디자인, (e) 전역 사용자 W-L 전적 시스템 5개 축이 핵심.

### 1. 大量 객관식 문제 모듈 — `data-questions-bulk.js` (356문항)

7장 표리쌍해제 + 8장 보익제 1~3절 25 처방 전체 커버. 4-band 난이도 분포로 학습자 수준별 점진 노출.

| Band | 정의 | 문항수 | 핵심 |
|---|---|---:|---|
| D1 | 기본 — 구성·작용·君藥 단순 매칭 | 100 | 23 처방 균등 |
| D2 | 응용 — 적응증·가감·체질방·君臣 | 100 | 28 처방 + 보익제 서론 |
| D3 | 심화 — 出典 비교·原方 대비·君臣佐使 분석 | 103 | 26 처방 |
| D4 | 지옥 — 용량비, 원문 출처, 마이너 분파(조동지·최선무·유정서), 5-HMF 등 현대 의약학 | 53 | 25 처방 |

22학번 직접 기출 14건은 `src:'기출-22학번'`, explanation에 `★` 강조. 함정 선지 비중 30%↑ — 백호탕증(脈洪大有力) vs 당귀보혈탕증(重按無力), 삼령백출산 적응증의 心悸不眠(→귀비탕), 도홍사물탕 적응증의 白帶證多 등.

**와이어업**:
- `index.html`: `<script src="data-questions-bulk.js"></script>` (data-formulas.js 뒤)
- `app.js`: 7개 지점 `[...PAST_EXAMS, ...BULK_QUESTIONS]` 조건부 spread (BULK 부재 시 PAST_EXAMS 단독)
- `sw.js` PRECACHE: `'./data-questions-bulk.js'` 추가
- 기존 통계 화면(전체 오답 랭킹·기출 분석·처방별 심층) 자동으로 표본 +247문항 흡수 (109 → 356)

### 2. WebAudio 합성 BGM/SFX (외부 파일 0)

`bgm` 객체에 4-mode 음악 + 2-종 SFX 추가. **invariant: 동시에 한 모드만 살아 있다** — `_stopSchedulers()`로 모든 schedule 호출 직전 timer를 정리.

| 모드 / SFX | 음악적 정의 |
|---|---|
| `ambient` | 五聲音階(C-D-E-G-A) 古琴, 70 BPM, 4마디 무작위 패턴 (기존 유지) |
| `battle` | D minor pentatonic, 140 BPM, 戰鼓 1·3박 강박 + 16분음 (기존 유지) |
| `victory` | C major arpeggio (C-E-G-C-E-G), 110 BPM, bell-like (sine + 1옥타브 triangle), 마지막 마디 C5 sustain |
| `defeat` | A minor 저속 드론 (A2·C3·E3), 4초 bar, 한숨 같은 A4→F4 하강 음 (마디 짝수마다) |
| `sfxCorrect` | C5→E5→G5 상승 3음, 각 65ms, 정답 클릭 즉시 |
| `sfxWrong` | G4→Eb4 하강 2음, 각 160ms, 묵직한 tone |

**SFX는 `master`를 거치지 않고 `ctx.destination` 직결** → BGM이 꺼져 있어도 항상 들림. BGM의 `userDisabled` flag와 독립.

**모드 전환 자동 라우팅**:
- 배틀 인트로 진입: `startBattle()`
- 정산 완료 후 결과 화면: outcome에 따라 `startVictory()` / `startDefeat()` / `stopBattle()` (무승부는 ambient로 복귀)
- 大廳 진입 시: `autoStartAmbient()` — **첫 user-gesture 이후·`userDisabled=false`** 두 조건 만족 시에만 발동 (브라우저 autoplay 정책 준수)

### 3. 배틀 정산 데드락 해소 (`finalizeBattle`)

기존: 30s 타임아웃 + 단순 폴링, 네트워크 jitter 시 무한 로딩 가능.

| 항목 | v2 | v3 |
|---|---|---|
| 최대 대기 | 30s (MAX_TRIES=20 × 1500ms) | **75s** (50 × 1500ms) |
| 점수 업로드 | `FB.put` 1회 | `FB.putRetry` 우선, 없으면 `FB.put` fallback. 실패 시 로컬 환불 + Hall로 |
| 폴링 중 FB 실패 | 즉시 toast로 종료 가능성 | **3회 연속 실패 + 5초 경과** 시에만 환불 처리 |
| UX | "상대 결과 대기… (N초)" | "상대 결과 대기… (N/75초)" + "M초 후 자동 부전승" sub-text |

부전승 정산 조건은 기존과 동일 — 75초 경과 시 `forfeit=true`로 `showResult` 진입.

### 4. 결과 UI 재디자인

세로 카드 → **가로 [메달리온 · 한자 · 메달리온]** 레이아웃. 가운데 한자(勝/敗/和) 색상·glow가 outcome을 한눈에 전달.

- `勝` — `#FFD700`, gold glow (drop-shadow 20px), 80px display font
- `敗` — `#444`, 무광 dim shadow, 같은 크기
- `和` — `var(--gutong)`, 그림자 없음

승자측 메달리온은 `var(--huang)` 2px ring + outer glow, 패자측은 `var(--mi-d)` 평범한 ring. 각 메달리온 아래 이름·점수·(상대 미응답 시 `(미응답)` 표기). 베팅액은 가운데 한자 아래 `${bet} 氣` 캡션. 정산 차이(`+200 氣` / `-50 氣`)는 카드 하단 — 翡翠/朱砂/古銅 색상으로.

### 5. 전역 사용자 W-L 전적 시스템

**데이터 모델**: Firebase `/stats/records/{userId}: {w, l, d, lastTs}`. `showResult` 종료 시 본인 record를 fetch-then-put으로 atomically increment (winner: w++, loser: l++, draw: d++). 상대 record는 상대 클라이언트가 자기 결과 화면에서 갱신 — race 회피.

**표시 4곳**:
1. **大廳 본인 카드** — qi 진행 바 우측, "5勝 2敗 1和 (62%)" 큰 칩
2. **등급 사다리 사용자 칩** — 이름 옆 tiny `5·2·1` (翡翠·朱砂·古銅 굵은 숫자, title에 풀텍스트)
3. **글로벌 학습자 氣 랭킹** — 등급 칩과 氣 사이에 small 칩
4. **배틀 시작컷** — 양측 캐릭터 이름 아래 large 칩, 5초 인트로 동안 비동기 fetch 후 페이드인 (인트로 차단 X)

**캐싱**: `_recordsCache` 5초 TTL, `fetchAllRecords()`가 1회 Hall 진입 당 1 FB.get만 호출 + 3 표시점에 분배 (race 없이 인라인 결합).

**Firebase 보안 룰 추가**:
```json
{ "rules": {
    "stats": {
      "records": { ".read": true, ".write": true },
      "wrongs":  { ".read": true, ".write": true }
    }
}}
```

### 6. 大廳 진입 자동 BGM

`document`에 capture-phase `pointerdown`·`keydown` 1회 리스너 → `bgm.userGestureSeen=true` 마킹 후 자기 제거. 이후 `setTab('hall')` 진입 시 `autoStartAmbient()`가 `userGestureSeen && !userDisabled && !on` 3조건 검증 후 ambient 시작. 사용자가 ♪ 칩으로 명시적 OFF 시 `userDisabled=true`로 자동 시작 영구 차단 (의도 존중).

### 7. 캐시 키

`bangje-pwa-v2-2-3-2026-05` → `bangje-pwa-v3-2026-05`. 서비스 워커가 단말에서 자동 갱신.

### 8. 알려진 제한 / 인수 체크리스트

- [ ] Firebase `stats/records` 보안 룰 추가 (없을 시 W-L 기록 silent fail, 게임은 정상)
- [ ] 새 BGM 4-mode 청취 테스트 (특히 victory→ambient 복귀 leak 여부)
- [ ] 모바일 PWA에서 첫 클릭 후 BGM auto-start 작동 확인 (iOS Safari 17+ AudioContext 정책 검증)
- [ ] 양측 동시 disconnect 시 두 클라이언트 모두 환불되는지 확인 (정산 race-free)
- [ ] 인트로 5초 안에 W-L fetch 못 들어와도 인트로가 정상 종료되는지 확인 (fetchUserRecord catch-all)

작성: 2026-05-17 · CIM Lab

---

## v4 — 2026-05-17 패치 (CIM Lab)

> v3.1 → v4. 5개 축 (베팅별 난이도, 자동출제 옵션 확장, 私的 약점 분석,
> 神階 메달리온 발광, 인트로 양측 동시 한문 낭독). 사진 32인 보강.
> 상세는 `CHANGELOG_v4.md` 참고.

### 1. 베팅별 난이도 차등

`BET_LEVELS` 의 `diffProfile: [D1,D2,D3,D4]` 비율. `generateBattleQuestions(n, level)`
시그니처. 베팅 셀에 D1~D4 색상 strip UI.

### 2. 자동 문제 옵션 인자

`generateQuizQuestions(n, diff, opts)` — `opts.chapter`·`opts.formulaIds`
필터. `startQuizSession(mode, diff, count, opts)` 도 동일.

### 3. 私的 약점 분석 (개인 오답)

새 stats sub-tab `personal` — default. `renderPersonalAnalysis()`.
章·처방·유형·난이도 4축. 章/처방 모두 자체 문항 수로 정규화.
액션 버튼: 이 章 자동 출제 (formulaIds 옵션) / 이 처방 심층
(openFormulaDeep 한자명) / 학습 탭 (chapter hint) / 오답함.

### 4. 神階 메달리온 발광

`.cmedal.cat-divine` — divine-aura 펄스 (2.6s) + ::before conic-gradient
회전 (7s). picker grid 위상차 0.52s × 5. `prefers-reduced-motion` 존중.

### 5. 인트로 양측 동시 한문 낭독 (A안)

`BATTLE_INTRO_MS` 9000ms. 새 `tts` 객체:
- `tts.init()` — voice prefetch (voiceschanged + 1.5s 폴백)
- `tts.speakIntroPair()` — 양측 거의 동시 speak() 호출. 이순재 무음.
  pitch 0.92/1.08 분리.
- `tts.cancel()` — skip/timeout 즉시 정지

말풍선 `intro-speaking` 펄스 4.5초. user-gesture 시 `tts.init()` prime.

### 6. 사진 시스템 — 32인 보강

`photos/README.md` 가이드대로 사용자가 다운받은 32장 모두 `photos/{id}.jpg`
배치. zhanglu·chenziming caption 정상화.

### Firebase 보안 룰

추가 변경 없음. v3.1 의 룰 그대로 사용 가능.

### 캐시 키

`bangje-pwa-v3-2026-05` → `bangje-pwa-v4-2026-05`. 서비스 워커 자동 갱신.

작성: 2026-05-17 · CIM Lab

## v5 — 2026-05-17 패치 (CIM Lab)

> v4 → v5. 四象 진영(소양·태양·소음·태음) 시스템. 상세는 `CHANGELOG_v5.md` 참고.

`data-factions.js` 신규. `S.faction` 유저 상태에 추가. 캐릭터별 사상 매핑은
`data-physicians.js` 의 `faction` 필드. 로비/배틀 UI 에 진영 표시.

### 캐시 키

`bangje-pwa-v4-2026-05` → `bangje-pwa-v5-2026-05`.

## v6 — 2026-05-17 패치 (CIM Lab)

> v5 → v6. 검수 4건 + 처방 드릴 모드. 상세는 `CHANGELOG_v6.md` 참고.

### 1. 처방 드릴 (`startFormulaDrill`)

26 처방 × 평균 18장 = 471장 자동 카드 (`blank_herb`·`monarch`·`action`·
`indication`·`addition`·`source` 6 타입). 滿點 시 `S.masteredFormulas` 에 추가.
사적 약점 분석 → 「練」 버튼 진입.

### 2. 검수 #1·#2·#3·#4

- 오답 랭킹 `auto:*` 필터 (재현 불가 문제 제거)
- 章 자동 출제 → FORMULAS 전체 章 매칭 (wrongExams 폴백)
- 매칭 stale 방 정리 — `STALE_ROOM_MS = 5min` + 자기 stale 1회 명시 정리
- 인트로 TTS Google Translate fallback (zh voice 없는 환경)

### 캐시 키

`bangje-pwa-v5-2026-05` → `bangje-pwa-v6-2026-05`.

## v7 — 2026-05-17 패치 (CIM Lab)

> v6 → v7. **카드 對決 게임** 신규. 상세는 `CHANGELOG_v7.md` 참고.

### 1. `data-syndromes.js` 신규

26 처방 1:1 매핑된 證 26종. 각 證 4~5개 핵심 증상 (出典의 indication 에서
단축·정련). `SYNDROME_BY_FORMULA`·`SYNDROME_BY_ID` 인덱스 export.

### 2. 카드 對決 게임 (`battle` 탭 → 새 모드 토글)

기존 5지선다 對決 옆에 「카드 對決」 토글. 룰:

- 양측 자동 25% 베팅 (`CARD_GAME_BET_PCT`)
- 매칭 큐 `lobby_card/{userId}` (5지선다 큐와 분리)
- 시작 후 10초 안에 무작위 3 證 후보 중 1택 (`CARD_CHOOSE_MS`)
- 공유 1덱 — 양측 정답 처방 composition 합집합 + 같은 章 노이즈 10장
  (`CARD_NOISE_HERBS`) → 셔플 (실측 평균 38.8장)
- 초기 보드 3장. 매 턴 종료 시 덱→보드 1장
- 전탕 판정: 26 처방 중 1개 선택 → 모든 composition 본초가 보드에 있고 +
  상대 證의 정답 처방이면 승리. 50턴 도달 = 무승부 (양측 환불).
- 신급 5캐릭터 스킬 (게임당 1회): **欺症**(黃帝, 거짓 증상 노출) /
  **召草**(神農, 본초 타이핑 召喚) / **卦知**(伏羲, 덱 상위 3장 미리보기) /
  **造化**(女媧, 보드 1장 교체) / **問難**(岐伯, 자기 처방 君藥 1개 召喚)

### Firebase 신규 스키마 (보안 룰 추가 필요)

```json
{ "rules": {
    "lobby_card":   { ".read": true, ".write": true },
    "card_battles": { ".read": true, ".write": true }
}}
```

### 캐시 키

`bangje-pwa-v6-2026-05` → `bangje-pwa-v7-2026-05`.

### 알려진 제한

- 神農 召草 — 한자 IME 환경에서만 자연스럽게 입력 가능. v8 후보: 자동완성.
- 岐伯 問難 — 君藥 노출이 자기 본방의 君藥이라 추정에 활용될 수 있음 (위약).
  스킬 자체는 「본방의 君藥 1장을 보드로」 — 위약 효과 명시.
- 모바일 작은 화면(<480px)에서 본초 카드 자동 축소되지만 액션 버튼이 빽빽함.

작성: 2026-05-17 · CIM Lab

## v8 — 2026-05-17 패치 모음 (CIM Lab)

> v7 → v8.1 → v8.2 → v8.3 → v8.4 → v8.5. 5회 누적. 상세는 `CHANGELOG_v8.md`.

### 주요 변경

- **v8.5 critical**: 카드 對決 "한 명 무한 로딩" 픽스. 4개 root cause 제거 (silent emit error / SSE-only 초기 패치 / STALE 1분 / watchdog 부재). `startCardBattle` 과 `startBattle` 모두 `FB.get` 4회 재시도 + 8초 watchdog 진단.
- **v8.5 정책**: 첫 시작 캐릭터를 **神급 5인 + 이순재 제외 45명 풀**에서 랜덤 부여. 기존 사용자 영향 없음 (localStorage 의 character 보존).
- **v8.4**: 카드 큐 10초 keep-alive · 5지선다 15초 keep-alive · 자기 stale entry 강제 정리 · 큐 카운트 UI · 수동 재등록 버튼.
- **v8.3**: 원격 wipe (`/system/wipeAt` → 각 단말 1회 자동 청소).
- **v8.2**: PWA 내장 관리자 패널 (`#admin` hash 또는 헤더 5회 연타).
- **v8.1**: Firebase 에러 응답 본문 노출 (Permission denied 등 식별).

### S 스키마 추가 필드 (v8.5)

```js
// 다음 세션의 기능을 위한 진입점 (현재 사용처 없음)
cardBattleHistory: [],   // 카드 對決 전적 (5지선다 별도)
herbLang: 'han',         // 본초 카드 표시 언어 ('han' | 'ko')
character: null,         // ← 'qibo' 기본값 제거 → loadState 에서 랜덤
```

### 캐시 키

`bangje-pwa-v8-4-2026-05` → `bangje-pwa-v8-5-2026-05`. 서비스 워커 자동 갱신.

### 다음 세션 후보 (사용자 명시 요청)

1. 카드 對決 무한로딩 검증 — 실 환경 2인 동시 테스트
2. 神農 召草 자동완성 (`HERBS` 검색 datalist)
3. 神급 스킬 5종 시각 효과 (펄스·파티클)
4. 카드 對決 전용 BGM (戰鼓 + 본초 그라인딩 SFX)
5. 본초 카드 한자↔한글 토글 (`S.herbLang` 적용)
6. 카드 對決 W/L 별도 통계 (`S.cardBattleHistory` 적용)
7. 旁観 모드 (관전자 진행 중 게임 보기)
8. 카드 對決 친선전 (방 코드 공유)

작성: 2026-05-17 · CIM Lab
