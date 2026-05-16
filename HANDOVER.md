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
