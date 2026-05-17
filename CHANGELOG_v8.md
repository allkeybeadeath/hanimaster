# v8 — 2026-05 패치 모음 (CIM Lab)

> v7 → v8.1 → v8.2 → v8.3 → v8.4 → v8.5 → v8.6 → v8.7. 7회 누적.
> 상세 v8.5 까지는 별도 commit 메시지. 본 문서는 v8.6 + v8.7 중심.

## v8.7 — 2026.05.17t (현재)

이번 세션 작업: **inactivity watchdog + 4개 기능 일괄**.

### A. 카드 對決 inactivity watchdog (60초)

이전 세션에서 시도하다 함수 정의 미완으로 v8.6 회귀를 유발했던 항목. 완전 구현:

- `lastActionAt` 이 갱신 안 된 채 60초 경과 시 자동 정산
- **책임 클라이언트** = "현재 턴이 자기가 아닌 쪽" — 즉 상대가 응답 없는 상태에서 자기가 forfeit 트리거. 자기 턴이면서 무액션은 자기 의도이므로 트리거 안 함 (게임이론적 격합)
- 멱등성: `status='done'` transition 직전 fresh GET 으로 다른 클라이언트가 먼저 처리했는지 확인
- 결과 화면에서 `by:'inactivity'` 로 표시. 통계 카드에서 "상대 잠수" 로 ko 라벨링

### B. F4 — 본초 한자↔한글 토글

- `S.herbLang` (`'han'` | `'ko'`) 필드 활용
- `renderHerbCardHTML` 에서 주 표시·보조 표시 자리 바꿈
- 카드 對決 보드 헤더에 작은 토글 버튼 (`漢→韓` ↔ `韓→漢`)
- 클릭 시 `toggleHerbLang()` 호출 → 상태 저장 + 즉시 리렌더

### C. F5 — 카드 對決 별도 전적 통계

- 정산 시 `S.cardBattleHistory` 에 1 항목 추가 (`ts`, `win`, `draw`, `forfeit`, `bet`, `deltaQi`, `opponentName`, `opponentSyn`, `mySyn`, `by`, `attackedFormula`)
- 명예의 전당 (hall) 에 별도 카드 — "최근 카드 對決" 섹션
- 종료 사유 ko 라벨: 전탕 一致 · 부전승 · 상대 잠수 · 무승부
- 하단 요약: `W勝 L敗 D和 · forfeit N회`
- W/L/D 기존 `stats/records` 는 카드+5지선다 통합 유지

### D. F1 — 神農 召草 자동완성

- `<input list="cb-summon-list">` + `<datalist>` 로 덱 본초 한자명 자동완성
- datalist 항목 표기: `人蔘 (인삼)` 형식 — 한글 검색으로 한자 자동 선택 가능
- 핸들러: 한글 입력도 `HERBS.ko` 매핑으로 한자 변환 (`v` 가 한자 미포함이면 ko 검색)

### E. F2 — 神급 스킬 5종 시각 효과

- 풀스크린 1.5초 오버레이 — 한자 1글자 (스케일·회전 cubic-bezier) + 24 입자 방사형 발사 + 색 별 발광
- 캐릭터별 색 톤:
  - 黃帝 欺 → `#F8C547` (황금)
  - 神農 草 → `#7CA85F` (청록·본초)
  - 伏羲 卦 → `#6B7FB8` (청남·卦象)
  - 女媧 化 → `#D88BB0` (연홍·補天)
  - 岐伯 問 → `#9C3030` (朱砂)
- 모바일 `(<480px)` 한자 크기 자동 축소 (`140px → 96px`)
- 5개 스킬 핸들러 모두에 `playSkillFX(char, han)` 후크

### 변경 파일

| 파일 | 변경 |
|---|---|
| `app.js` | inactivity watchdog 구현 · `renderHerbCardHTML` 토글 · `toggleHerbLang` · `cardBattleHistory` 정산·hall 카드 · 召草 datalist + 한글→한자 매핑 · `playSkillFX` 함수 + 5개 스킬 후크 |
| `index.html` | 神급 스킬 시각 효과 CSS (`@keyframes skill-fx-*`, `.skill-fx`, `.skill-fx-han`, `.skill-fx-particles`) |
| `sw.js` | 캐시키 `v8-6-2026-05` → `v8-7-2026-05` |
| `CHANGELOG_v8.md` | v8.7 섹션 추가 |

---

## v8.6 — 2026.05.17s

### 회귀 픽스 + 결과 대기 안정화

- **`FB.get/put/putRetry`** 에 AbortController 5초 timeout. `fetch` 무한 hang 차단 — v8.5 의 재시도/watchdog 가 작동하려면 fetch 자체가 끝나야 함.
- **5지선다 결과 대기** 1.5s × 50회 (75초) → 0.8s × 31회 (25초) + SSE 콜백으로 양측 done 즉시 감지.
- **5지선다 forfeit 정산 무결성** — 양측 모두 미응답 timeout 시 양쪽 화면이 각자 상대를 forfeit 처리하여 양쪽 다 win 처리되던 氣 부풀림 버그. 이제 score 비교로 outcome 결정.
- 카드 對決 watchdog 8s → 4s 단축 (빠른 진단).
- **회귀 픽스**: `armCardInactivityWatchdog` 호출만 들어가 있고 정의가 없어 `ReferenceError` 로 양측 진입 안 되던 버그. 호출 제거 (v8.7 에서 정의 포함 재구현).

---

## v8.5 — 2026.05.17p

- `FB.subscribe.emit()` silent error swallow 제거 (console.error + `_lastSubError`)
- `startCardBattle` FB.get 4회 재시도 + 8초 watchdog (수동 패치/포기 버튼)
- `startBattle` FB.get 1회 → 4회 재시도
- `STALE_BATTLE_QUICK_MS` 1분 → 5분 (1분 stale 버그 회복)
- 첫 시작 캐릭터 神급 + 이순재 제외 45명 풀 랜덤
- `S.character` 기본값 `null` (기존 사용자 보존)
- `S.cardBattleHistory`, `S.herbLang` 스키마 추가 (v8.7 에서 사용)

---

## v8.1~v8.4

- v8.4: 카드 큐 10s keep-alive · 5지선다 15s keep-alive · 자기 stale entry 정리 · 큐 카운트 UI · 수동 재등록
- v8.3: 원격 wipe (`/system/wipeAt` → 단말 1회 자동 청소)
- v8.2: PWA 내장 관리자 패널 (`#admin` hash 또는 헤더 5회 연타)
- v8.1: Firebase 응답 본문 노출 (Permission denied 등 식별)

---

## 검증

- `node --check app.js` 통과
- `playSkillFX` 호출 5회 (5개 神급 스킬 모두 후크 적용)
- `armCardInactivityWatchdog` 정의 + 호출 1쌍 매칭
- v8.7 직접 코드 grep:

```
playSkillFX( 6회 (정의 1 + 호출 5)
armCardInactivityWatchdog 2회 (정의 + 호출)
toggleHerbLang 2회 (정의 + 버튼 inline)
cardBattleHistory 4회 (init + push + slice + hall 렌더)
```

---

## 다음 세션 후보

- F3: 카드 對決 전용 BGM/SFX (戰鼓 + 본초 그라인딩) — `scheduleCardDuel` 미구현, 현재 `bgm.startBattle` 폴백
- F6: 旁観 모드 (관전자 진행 중 게임 보기) — 신규 구조
- F7: 카드 對決 친선전 (방 코드 공유) — `friend_card_battles` 노드

작성: 2026-05-17 · CIM Lab
