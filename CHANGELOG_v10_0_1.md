# v10.0.1 핫픽스 (2026-05)

## 긴급 수정

**증상**: v10.0 배포 후 사이트 먹통 — 아무 클릭도 안 됨.

**원인**: `bangje-v99-sichen-clock.js` 와 `bangje-v99-meridian-body.js` 의 `MutationObserver` 가 자기 자신이 inject한 DOM 변경을 감지하고 다시 inject 를 트리거 → 무한 루프 → CPU 100% 점유 → UI 응답 불가.

  - sichen-clock: `chip.innerHTML` 매 mutation 마다 재설정 → 자기 자신 mutation → 무한 호출
  - meridian-body: `_injectMedallion()` 이 badge 부착 → mutation → observer → 재호출

**수정**:

  1. **자기 자신 mutation 무시** — observer 콜백에서 records 검사, 우리 element (`#v99-sichen-chip`, `.v99-medal-essence`, `#v99-body-wrap`) 안의 변경만 있으면 skip
  2. **300–500 ms throttle** — 짧은 시간 안의 연속 mutation 은 한 번만 처리
  3. **idempotent inject** — sichen-clock 의 `chip.innerHTML` 은 직전과 동일하면 DOM 갱신 안 함 (자기 트리거 차단의 마지막 방어선)
  4. **캐시 키 bump** — `v10-0` → `v10-0-1` 로 갱신, 사용자 브라우저가 옛 망가진 v10.0 캐시를 무시하고 새 파일 강제 다운로드

## 적용
SW 가 자동 갱신. 강제 새로고침 (`Ctrl/Cmd + Shift + R`) 권장. 캐시가 계속 잡혀있으면 DevTools → Application → Service Workers → Unregister + Cache Storage 삭제.
