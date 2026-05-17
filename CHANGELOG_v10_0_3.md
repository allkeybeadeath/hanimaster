# v10.0.3 (2026-05)

다섯 가지 사용자 요청 통합.

## 1. 본초 popup → 하단 드로어
- `bangje-v99-herbtap.js` 재작성 — 화면 전체 overlay 폐기, 하단 드로어 (최대 38vh).
- 위쪽 62vh 는 게임 화면 그대로 — 본초 popup 열어둔 채로 게임 진행 가능.
- 드로어 grab bar 클릭 / ESC / 「×」 / 외부 클릭으로 닫기.
- 처방 chip 아래 「+ 나머지 본초」 또는 「單方」 그대로 유지.

## 2. 모달 알림 「한 번 클릭하면 영구 해제」
- `bangje-v98-modal-alert.js` 패치 — alert pill 클릭 시 `S.modalAlertDisabled=true` 영속 저장.
- 이후 MutationObserver 콜백 첫 줄에서 disabled 체크 → 발동 안 함.
- 화살표 펄스·chime 등도 한꺼번에 정리.
- 다시 켜려면 콘솔에서 `S.modalAlertDisabled=false; saveState()`.

## 3. 채팅창 z-order 최저
- `bangje-v96-part5.js` CSS 패치 — `.chat-card` 에 `position:relative; z-index:0; order:9999;`.
- 부모 영역이 flex 면 채팅은 항상 맨 아래.
- 모든 모달·드로어·alert (z-index 9000+) 가 채팅 위에.

## 4. cube deck 분포 — 빈도 선형 비례
- `bangje-cube.js` BC_VER → '1.2'.
- 기존 5단계 if-else (감초·생강이 cap 에 막혀 비례 안 맞음) → 선형식 `n = round(freq × 0.4)` (1–15 clamp).

| 본초 | freq | 기존 | 신규 |
|---|---|---|---|
| 甘草 | 34.5 | 7 | **14** |
| 生薑 | 18.5 | 5 | 7 |
| 白芍 | 17.5 | 5 | 7 |
| 桂枝 | 16 | 5 | 6 |
| 茯苓 | 15.5 | 5 | 6 |
| 大棗 | 15 | 5 | 6 |
| 人蔘 | 14.5 | 4 | 6 |
| 當歸 | 14.5 | 4 | 6 |
| 白朮 | 13 | 4 | 5 |
| 黃耆 | 9.5 | 3 | 4 |
| 麻黃 | 8 | 3 | 3 |
| (freq=1) | 1 | 1 | 1 |

- 총 deck 246 → 약 280 장. 손패에 감초 0 장일 확률 75% → **52%**.
- 한 본초 최대 15장 (deck 점유 과다 방지).

## 5. 큐브 손패 「方劑順」 정렬 토글
- `bangje-v99-cubesort.js` 신규.
- 손패 헤더 옆 chip 「方劑順 [ON/OFF]」.
- ON 시 손패 카드를 「처방 완성 가능성」순으로 재배치 (DOM appendChild — 데이터는 안 건드림).
- 알고리즘: 각 본초 X 가 들어가는 처방 P 에 대해 손패 중 P 본초 비율 max → score.
  - 손패만으로 완성 가능 → 황금 ★ badge
  - 60% 이상 완성도 → 「N%」 badge
- 영속: `S.cubeSortByFormula` (default false — 기본 가나다순 유지)
- cube renderHand 후 MutationObserver 로 자동 재정렬 (self-mutation 무시 + 250ms throttle + idempotent)

## 6. 캐릭터 사진 — 폴더 없이 루트로
- `data-physicians.js` 의 `_LOCAL` 헬퍼: `'images/characters/'+id+'.'+ext` → `id+'.'+ext`
- 36 캐릭터 이미지 파일을 zip 루트로 이동 (호스팅 호환성 — 폴더 지원 안 하는 환경에서도 작동)
- `sw.js` PRECACHE 도 `./shennong.png`, `./leesoonjae-medallion.jpeg` 로 갱신

## 大廳 표시
- `APP_VERSION`: v10.0.2 → **v10.0.3**

## 캐시 키
- `bangje-pwa-v10-0-3-2026-05` — 자동 갱신
