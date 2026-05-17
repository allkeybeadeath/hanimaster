# CHANGELOG — v9.8 (2026-05-18)

> **방제학 PWA · CIM Lab · 시험 D-2 학습 강화 묶음**
> v9.7 위에 학습/UX/룰 11개 신규 모듈 + 검수 A-1 시그니처 보너스 핫픽스.

## 요약 한 줄

> **SM-2 SRS · 君臣佐使 드릴+作圖 · 處方 對比 · 한자음 hover · 빈출 오답 가중 · 본초 popup · 印章 共鳴 · 이순재 broadcast · 大廳 알림 · 큐브 첫 출패 룰 · 모달 화살표 알림.**

---

## 1. 신규 모듈 (12 파일)

| 파일 | 기능 | 진입점 |
|---|---|---|
| `bangje-v98-srs.js` | SM-2 lite 간격반복 | `V98SRS.startReviewSession()` 또는 大廳 復 카드 |
| `bangje-v98-drill.js` | 君臣佐使 분류 드릴 | `V98Drill.startSession({chapter, count})` |
| `bangje-v98-canvas.js` | 君臣佐使 드래그&드롭 (作圖) | `V98Canvas.start({chapter, count})` |
| `bangje-v98-diff.js` | 處方 對比 (diff view) | `V98Diff.openPicker(idA)` 또는 `V98Diff.open(idA, idB)` |
| `bangje-v98-weighted.js` | 글로벌 빈출 오답 가중 | `V98Weighted.start({n, topK})` |
| `bangje-v98-hanyin.js` | 한자 hover→한국 한자음 | 자동 활성 (`S.hanyinHover`) |
| `bangje-v98-herbpop.js` | 본초 클릭→연관 처방 popup | 자동 활성 (`S.herbPopMode`) |
| `bangje-v98-dictplus.js` | 처방 사전 확장 + 大廳 알림 + 處方 점프 | 자동 |
| `bangje-v98-resonance.js` | 印章 共鳴 (동 카테고리 3개) | 자동 |
| `bangje-v98-leeline.js` | 이순재 broadcast | 자동 (시그니처 정답 50% 후크) |
| `bangje-v98-cube-rules.js` | 큐브 첫 출패 룰 (initial meld) | 자동 (cube.js hook 통해) |
| `bangje-v98-modal-alert.js` | 게임 모달 출현 시 화살표 nudge | 자동 (게임 컨텍스트 한정) |
| `bangje-v98-home.js` | 大廳 v9.8 學習 진입점 + 토글 | 大廳 tile 자동 inject |
| `bangje-v98-bootstrap.js` | A-1 핫픽스 + V98Resonance 합산 | 자동 |

---

## 2. 검수 A-1 핫픽스 — 시그니처 보너스 산식

`V97Sig.sessionBonus` 의 발동당 보너스가 baseEarned 전체에 비례해 5번 발동만으로도 캡(+50%)에 즉시 도달하던 문제. v9.8 bootstrap 이 monkey-patch:

```js
const evN = max(1, totalChapter + totalYipin);
const perEv = baseEarned / evN;
const ch = round(perEv * 0.10) * totalChapter;
const yp = round(perEv * 0.25) * totalYipin;
const jx = juexueFired ? round(baseEarned * 0.50) : 0;
```

→ 章典 5회·逸品 3회면 ch=0.625·perEv·5 (≈ 정상), yp=0.625·perEv·3, jx=0.

원본 코드 무수정, bootstrap 모듈만 추가하면 자동 적용. 원본 함수가 누락되거나 V97Sig 가 없으면 silent skip.

---

## 3. 큐브 첫 출패 룰 (initial meld)

기존 룰: 사전 정의 set 이면 사이즈 무관 commit 가능 (사역탕 3미·당귀보혈탕 2미 포함).

v9.8 룰:

1. **첫 commit** 에서 만든 새 set 중 적어도 하나가 다음 중 하나를 만족해야 함:
   - 약재 수 ≥ **4**
   - **사전 처방 사이즈 그대로** (사역탕 3미·당귀보혈탕 2미 등 — 이 둘만 시험 범위에서 해당)
2. 첫 통과 후 (`opened = true`) 이후 commit 부터는 사이즈 무관 (3미·2미 set 도 OK).
3. opened 상태는 `bangje.v98.cubeOpened` localStorage 에 `{roomId: {uid: ts}}` 형식. 7일 후 GC.

**`bangje-cube.js` 1줄 hook 패치** (동봉 파일 사용 또는 수동 적용):

위치: `actCommit` 시작부 (line ~1199), `if(!LOCAL.isMyTurn)` 다음에 다음 3줄 삽입.

```js
// v9.8: 첫 출패(initial meld) 룰 — 외부 모듈이 있으면 위임
if(window.V98CubeRules){
  const _ck = window.V98CubeRules.validateLocal(LOCAL);
  if(!_ck.ok){ msg(_ck.msg, 'warn'); return; }
}
```

이 hook 외에는 bangje-cube.js 무수정. 모듈이 부재해도 silent skip (기존 동작 그대로).

---

## 4. 모달 알림 화살표 — 채팅 가림 보조

게임 중 (카드 對決·큐브) 모달이 새로 나타나면:
- 화면 4방향 외곽에 큰 한자 화살표 (↑↓←→) 1.4초 펄스 2회
- 화면 상단 중앙에 「急 새 모달 — 화면 중앙 확인 →」 빨간 펄스 pill
- 짧은 chime (Web Audio sine 880→660Hz)
- 사용자가 모달과 인터랙션 (클릭) 시 즉시 정리
- 6초 후 자동 정리

감지 대상 (selector superset):
- `#modal-slot > *` (app.js openModal)
- `[class*="reveal-modal"]`, `[class*="decoct"]`, `[class*="penalty"]` 등
- 80×40 px 이하의 small element 는 false-positive 회피로 skip

게임 컨텍스트가 아닐 때는 자동 비활성 (DOM 마커: `.cb-board, .bc-card, #card-board` 등).

`S.modalAlertEnabled = false` 토글 가능.

---

## 5. 데이터 마이그레이션

자동 마이그레이션 — 별도 작업 불필요:

- `S.flashRated[k]` : string ('easy'/'hard'/'again') → `{rating, ef, interval, due, reps, last}` 객체
- `S.hanyinHover` : 누락 시 true 로 초기화
- `S.herbPopEnabled`, `S.herbPopMode` : 누락 시 true, 'longpress'
- `S.leelineBroadcast` : 누락 시 활성 (true)
- `S.modalAlertEnabled` : 누락 시 활성 (true)
- `S.seenChangelogVersion` : 누락 시 첫 모달 진입에서 v9.8 로 마킹

---

## 6. Firebase 영향

신규 RTDB 노드:
- **`leeline/{userId}`** — 이순재 broadcast (이순재 어록 + 임의 캐릭터 한문)
  - 권장 보안 룰: `{ ".read": true, ".write": true }` (presence 와 동등)

기타 노드 변경 없음. 큐브/카드 對決/멀티 對決 의 기존 RTDB 스키마 보존.

---

## 7. index.html 패치

```html
<!-- 데이터 + 앱 스크립트 (기존) ... -->
<script src="data-ranks.js"></script>
... (기존 그대로)
<script src="bangje-v97-formuladict.js"></script>

<!-- v9.8 신규 모듈 — v97 이후 로드 -->
<script src="bangje-v98-srs.js"></script>
<script src="bangje-v98-drill.js"></script>
<script src="bangje-v98-canvas.js"></script>
<script src="bangje-v98-diff.js"></script>
<script src="bangje-v98-weighted.js"></script>
<script src="bangje-v98-hanyin.js"></script>
<script src="bangje-v98-herbpop.js"></script>
<script src="bangje-v98-dictplus.js"></script>
<script src="bangje-v98-resonance.js"></script>
<script src="bangje-v98-leeline.js"></script>
<script src="bangje-v98-cube-rules.js"></script>
<script src="bangje-v98-modal-alert.js"></script>
<script src="bangje-v98-home.js"></script>
<script src="bangje-v98-bootstrap.js"></script>   <!-- 마지막 — patch 대상 모듈이 모두 로드된 뒤 -->

<!-- 서비스 워커 ... (기존 그대로) -->
```

---

## 8. sw.js 패치

```js
const CACHE = 'bangje-pwa-v9-8-2026-05';   // bump
const PRECACHE = [
  // ... 기존 그대로
  './bangje-v98-srs.js',
  './bangje-v98-drill.js',
  './bangje-v98-canvas.js',
  './bangje-v98-diff.js',
  './bangje-v98-weighted.js',
  './bangje-v98-hanyin.js',
  './bangje-v98-herbpop.js',
  './bangje-v98-dictplus.js',
  './bangje-v98-resonance.js',
  './bangje-v98-leeline.js',
  './bangje-v98-cube-rules.js',
  './bangje-v98-modal-alert.js',
  './bangje-v98-home.js',
  './bangje-v98-bootstrap.js',
];

// network-first regex (개발 편의 — 잦은 변경)
const networkFirst =
  url.pathname.endsWith('index.html') ||
  url.pathname.endsWith('/') ||
  url.pathname.endsWith('app.js') ||
  url.pathname.endsWith('bangje-cube.js') ||
  /bangje-v9[678]-[\w-]+\.js$/.test(url.pathname);   // ← 6,7,8 모두 포함
```

---

## 9. 검수 결과 후속 (v9.7 미해결 항목 — 권고)

A-1 은 핫픽스됨. 나머지 검수 결과 중 추가 권장 처리:

- **A-3 子時·寅時 시간대** — `data-achievements.js` 의 `time_yin: [3,4]` → `[3,5]` 수정 권장
- **A-5 manifest.json** — `"... (v8)"` → `"... (v9.8)"` 갱신
- **A-7 hello-card 선택자 취약성** — app.js 의 hello-card 이름 줄에 `id="hello-name-row"` 부여 (v9.9 권장)
- **A-9 V97Dict 검색어 보존** — `bangje-v97-formuladict.js:171` 의 input 에 `value="${esc(_state.q)}"` 추가
- **A-10 recordChat 전송 실패 시 카운트** — `bangje-v96-part1.js:155` 의 `recordChat()` 호출을 `await f.push` 성공 후로 이동
- **A-4 PRECACHE 캐릭터 이미지 누락** — `images/characters/*.{jpg,jpeg,png}` 전체를 sw.js PRECACHE 에 추가

---

## 10. 인수 체크리스트

- [ ] 14개 신규 `.js` 파일을 `index.html` 에 위 패치대로 추가
- [ ] `bangje-cube.js` 를 동봉 파일 (`v98/bangje-cube.js`) 로 교체 (또는 1군데 hook 수동 추가)
- [ ] `sw.js` 캐시 키 `v9-7` → `v9-8` bump, PRECACHE 14개 추가, regex `v9[678]` 로 확장
- [ ] Firebase 룰에 `leeline` 노드 추가 (없으면 broadcast 무력화 + 게임은 정상)
- [ ] 大廳 진입 → 「v9.8 學習 强化」 wide 타일 표시 확인
- [ ] 「오늘 복습 N개」 SRS 배너 표시 확인 (S.flashRated 가 비었으면 미표시)
- [ ] 큐브 첫 출패 시 3미 미만 set 만 만들면 「初手 룰」 토스트 + commit 차단
- [ ] 사역탕(3미)·당귀보혈탕(2미) 만들면 첫 출패 통과
- [ ] 둘째 commit 부터는 3미·2미 set 도 자유 출패
- [ ] 카드 對決 reveal modal 등장 시 외곽 ↑↓←→ 화살표 + 急 pill 출현, chime 재생
- [ ] 사용자가 모달 클릭 시 알림 즉시 정리
- [ ] 한자 hover (데스크) / long-press (모바일) → 한국 한자음 tooltip
- [ ] 본초 카드 long-press → 연관 처방 popup (對決·큐브 모두)
- [ ] 印章 3개 동 카테고리 장착 시 메달리온 옆 「共」 도장 + 보너스 라인
- [ ] 大廳 우하단 「업데이트 N건」 알림 pill (한 번 보면 사라짐)

---

## 11. 알려진 한계

- **V98SRS 자체 미니 세션** — 기존 `startFlashSession` 이 없는 환경에선 fallback UI 가 매우 단순. v9.9 에서 통합 권장.
- **V98HerbPop longpress** — 큐브 보드의 본초 카드 일반 클릭(선택)과 충돌 회피로 longpress 700ms. 카드 선택 인터랙션이 살짝 느리게 느껴질 수 있음 (capture phase 라 동작에는 영향 없음).
- **V98ModalAlert 감지 false-positive** — selector 가 superset 이므로 일반 openModal 도 알림이 뜰 수 있음. 게임 컨텍스트가 아니면 자동 비활성으로 완화.
- **V98Leeline throttle 60초** — 본인 publish 는 60초당 1회로 제한. 학습 강도가 높은 사용자도 어록은 분당 최대 1회.

---

## 12. v9.8 build

- `APP_VERSION = 'v9.8'`
- `APP_BUILD = '2026.05.18f'` (제안 — app.js 상단 수정 권장, 미수정 시 v9.7 e 로 표기됨)

작성: 2026-05-18 · CIM Lab
