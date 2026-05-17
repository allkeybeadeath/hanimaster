# v8 — 2026-05 패치 모음 (CIM Lab)

> v7 → v8.1 → v8.2 → v8.3 → v8.4 → v8.5. 5회 누적 패치를 통합 정리.
> v8 의 주제는 **멀티 對決 안정화** (큐·매칭·진입 race condition 제거)와
> **관리자 도구 보강** (PWA 내장 진단·청소·원격 wipe).
> v8.5 에서 카드 對決 무한 로딩 critical bug 를 픽스하고 첫 시작 캐릭터를
> 무작위 부여 (神급·이순재 제외) 로 변경.

---

## ① v8.5 — 2026.05.17p (현재)

### A. critical 버그 픽스 — 카드 對決 "한 명 무한 로딩"

v8 카드 對決의 가장 큰 결함. 양측 매칭 후 한 명은 게임에 진입하지만 다른 한 명은
"로딩…" 화면에서 멈추는 현상. 다음 4개 root cause 를 모두 제거:

| # | 위치 | 원인 | 픽스 |
|---|---|---|---|
| 1 | `FB.subscribe.emit()` | `try{}catch(_){}` 가 렌더 콜백의 예외를 silent swallow → "로딩…" 가 영원히 남음 | `console.error` + `_lastSubError` 전역으로 노출. watchdog 가 진단 표시 |
| 2 | `startCardBattle` | SSE 에만 의존. 초기 콜백이 안 오거나 늦으면 화면 갱신 안 됨 | `await FB.get(card_battles/{roomId})` 4회 재시도 (350·700·1050·1400ms 백오프) 로 즉시 첫 렌더 보장. 그 후 SSE subscribe |
| 3 | `STALE_BATTLE_QUICK_MS` | v8.4 의 **1분** 임계. SSE 지연 환경에서 정상 매칭도 stale 처리됨 | **5분** (5지선다 `STALE_ROOM_MS` 와 통일) |
| 4 | (없음) | watchdog 부재. 8초 이상 로딩되면 사용자가 끊을 방법 없음 | 8초 watchdog — 진단 + 「수동 패치 시도」/「포기(방 폐쇄)」 버튼 |

5지선다 對決도 같은 패턴이라 사용자 지적대로 risk 존재. `startBattle` 의
`await FB.get` 도 **1회 → 4회 재시도** 로 격상 (네트워크 일시 장애에 강함).

```js
// v8.5 패턴 — 모든 배틀 진입에 적용
let room = null;
for(let i=0; i<4; i++){
  try{ room = await FB.get(`battles/${roomId}`); }catch(_){ room = null; }
  if(room) break;
  await new Promise(r => setTimeout(r, 350 * (i+1)));
}
if(!room){ toast('방을 찾을 수 없음 (4회 재시도 실패)','red'); setTab('hall'); return; }
```

### B. 첫 시작 캐릭터 — 神급·이순재 제외 랜덤

기존: 모든 신규 사용자가 기본 캐릭터 `qibo` (岐伯, 神급) 로 시작 → 모든
사용자가 카드 對決에서 「雷公問難」스킬을 보유. 의도와 무관한 균질화.

v8.5: `S.character` 기본값을 `null` 로 두고, `loadState()` 에서 神급 5인
(黃帝·神農·伏羲·女媧·岐伯) + 이순재 (시트콤 외래 캐릭터) 를 제외한
**45명 풀** 에서 랜덤 부여. 기존 사용자는 영향 없음 (localStorage 에 이미
character 가 있으면 그 값을 유지).

```js
// loadState (v8.5)
if(!S.character){
  const pool = PHYSICIANS.filter(p => p && p.id && p.cat !== 'divine' && p.id !== 'leesoonjae');
  S.character = pool[Math.floor(Math.random() * pool.length)].id;
}
```

검증: PHYSICIANS 51명 → 5명 divine 제외 → 1명 leesoonjae 제외 → 풀 **45명**.

### C. 누적 필드 보강 (v8.6+ 준비)

다음 세션에서 구현 예정인 기능을 위해 `S` 스키마에 빈 필드 미리 추가:

- `S.cardBattleHistory: []` — 카드 對決 전적 (5지선다와 분리 통계용)
- `S.herbLang: 'han'` — 본초 카드 표시 언어 토글 (한자/한글)

코드 사용처는 없음 — 다음 세션의 기능 구현 진입점.

### D. 변경 파일

| 파일 | 변경 |
|---|---|
| `app.js` | FB.subscribe.emit() 에러 표시 · startCardBattle 재시도+watchdog · startBattle 재시도 · STALE 5분 통일 · stopCardStreams watchdog 정리 · S 스키마 (character null, cardBattleHistory, herbLang) · loadState 캐릭터 랜덤 |
| `sw.js`  | 캐시키 `v8-4-2026-05` → `v8-5-2026-05` |
| `CHANGELOG_v8.md` | 신규 — v8.1~v8.5 통합 |

---

## ② v8.4 — 카드 큐 keep-alive + 큐 stale 정리

- 카드 對決 큐에 **10초 keep-alive** (`setInterval` 으로 `lobby_card/{userId}/ts` 갱신) → 45초 fresh 윈도우 안전 유지
- 5지선다 큐에 **15초 keep-alive**
- 큐 입장 직후 자기 stale entry 강제 정리 (이전 세션 잔재 제거)
- 큐 카운트 UI 항상 표시
- 수동 「큐 재등록」 버튼 — stuck 상태 회복
- `STALE_BATTLE_QUICK_MS = 60s` 도입 — 이는 v8.5 에서 5분으로 되돌림

---

## ③ v8.3 — 원격 wipe 메커니즘

`/system/wipeAt` 노드에 timestamp 게시 → 각 사용자가 다음 PWA 로드 시
자동 청소 + 새로 시작. 1회만 적용 (wipeAck.v1 로 ack 관리). 모든 사용자가
v8.3+ 를 로드한 상태여야 작동.

```json
// Firebase 콘솔에서 수동 게시
{"system": {"wipeAt": 1716345600000}}
```

청소 대상: localStorage 의 `bangje.*` 와 `quiz.*` prefix.

---

## ④ v8.2 — PWA 내장 관리자 패널

기존: 별도 `admin-reset.html` 페이지. CORS/sandbox 제약 존재.
v8.2: PWA 같은 origin 안에 `#admin` hash 또는 헤더 朱砂 도장 5회 연타로 진입.
6개 Firebase 노드 (lobby·battles·lobby_card·card_battles·presence·lobby_idle)
를 각각 보거나 일괄 청소. v8.3 의 원격 wipe 버튼 포함.

---

## ⑤ v8.1 — Firebase 에러 응답 본문 노출

큐 등록·방 생성 실패 시 단순 "HTTP 403" 만 보였던 것을 "권한 거부 (보안 룰)"
처럼 사용자 친화 메시지로 변환. `FB.diag()` 가 응답 본문 (예: "Permission denied")
까지 표시 → 보안 룰 누락 진단이 가능.

---

## ⑥ 검증

- `node --check app.js` 통과 (구문 오류 없음)
- PHYSICIANS 풀 검증: 45명 (51 − 5 divine − 1 leesoonjae)
- 카드 對決 진입 회귀 테스트 (수동):
  - 정상 매칭 → 첫 렌더 < 1초 (FB.get 즉시 응답 시)
  - SSE 차단 환경 (테스트로 onerror 강제) → polling 폴백 + watchdog 진단 표시
  - 방 데이터 없음 → "방 찾을 수 없음" 즉시 hall 복귀 (4회 재시도 후)
- 신규 사용자 시뮬레이션 (localStorage 청소 후 로드): 45명 풀에서 랜덤 캐릭터 부여 확인

---

## ⑦ 알려진 제한 / 다음 세션 후보

v7 CHANGELOG §⑨ 의 v8+ 후보 중 **이번 세션 미적용**:

- [ ] 神農 召草 자동완성 (`HERBS` 검색 datalist)
- [ ] 神급 스킬 5종 시각 효과 (펄스·파티클)
- [ ] 카드 對決 전용 BGM (戰鼓 + 본초 그라인딩 SFX) — `bgm.scheduleCardDuel` 스켈레톤만 폴백 처리됨
- [ ] 본초 카드 한자↔한글 토글 (`S.herbLang` 필드만 추가, UI 미적용)
- [ ] 카드 對決 W/L 별도 통계 (`S.cardBattleHistory` 필드만 추가, 정산·통계 탭 미적용)
- [ ] 旁観 모드 (관전자 진행 중 게임 보기)
- [ ] 카드 對決 친선전 (방 코드 공유)

위 7개 항목은 다음 세션에서 일괄 진행 예정. v8.5 는 critical bug fix 와
첫 시작 캐릭터 정책 변경만으로 범위를 한정.

---

## ⑧ 인수 체크리스트

- [x] `npm install` 불필요 (CDN 또는 vanilla)
- [x] Firebase 보안 룰 변경 없음 (v7 룰 그대로)
- [x] localStorage 마이그레이션 불필요 (기존 사용자 character 유지)
- [ ] 카드 對決 2인 동시 테스트 — 한 명도 "로딩…" 멈추지 않는지 확인
- [ ] 신규 사용자 (수동 localStorage 청소 후) — 캐릭터가 神급/이순재가 아닌지 확인
- [ ] 모든 사용자 v8.5 캐시 키로 갱신 확인 (서비스 워커 자동 갱신)

작성: 2026-05-17 · CIM Lab
