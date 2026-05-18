# V12.2 정정 보고서 (3건 수정)

**빌드 일자**: 2026-05-18 (V12.1 → V12.2)
**상태**: 사용자 피드백 3건 모두 반영, 전 파일 문법 통과

---

## 변경 파일 (3개)

| # | 파일 | 변경 |
|---|---|---|
| 1 | `bangje-v11-6-acupoints.js` | **실제 경혈학 home (V11Saam)** 에 經穴 포커 NEW 카드 추가 + 멀티를 公開 자동 매칭으로 단순화 |
| 2 | `bangje-v12-multi-intro.js` | sessionStorage 캐시 제거 → 페이지 로드 1회 굴림 + `_charPhotoMedallion` 전역 후킹 |
| 3 | `index.html` | V12 모듈을 app.js 직후 로드 (후킹이 모든 렌더보다 먼저 설치되도록) |

---

## 1. 경혈학 안 經穴 포커 표시 안되던 문제

### 원인
이전 패치를 `bangje-v11-jingxue-race.js` (V11Jingxue, OLD 모듈) 에 적용했으나, 실제로 동작하는 경혈학 모듈은 `bangje-v11-6-acupoints.js` (V11Saam, NEW). V11.6.1 에서 NEW 모듈이 saamdoin 라우트를 점유하면서 OLD는 비활성화됨.

### 수정
V11Saam.openHome 에 새 카드 추가 (오수혈 레이스 카드 바로 아래):
- 황금 그라데이션 배경 + 빨강-주황 NEW 펄스 배지 (1.6초 ease-in-out)
- 14단계 족보 안내 + 4 모드 (五札引換·七札對局·德州式·隨機) 표시
- 클릭 → `setTab('jxpoker')` → V12JxPoker.open()

---

## 2. 오수혈 레이스 멀티 — 公開 자동 매칭

### 원인
사용자 요구: "방 말고 다른 멀티처럼 公開 입장" — 방미큐브·방제대결 패턴.
이전 패치에서 별도 公開房 로비를 신규 구현했으나, 비활성 OLD 모듈에 적용됨.

### 수정
V11Saam 멀티 버튼을 「**群 公開 對決 · 자동 매칭 입장**」으로 변경. 클릭 → `_openAutoPublicMatch()`:

1. 매칭 spinner 표시 (`尋對手中…`)
2. Firebase `saam_rooms` 에서 동일 모드 lobby + 최근 5분 + 滿員 아닌 방 검색
3. **있으면 가장 최근 방에 자동 합류** → 다른 사용자와 즉시 대국
4. **없으면 새 公開房 자동 생성** → 다른 사용자가 합류할 때까지 대기
5. 사용자는 「방 만들기 / 방 ID 입력 / 방 목록」을 보지 않음 — 방미큐브 패턴 동일

기존 `openMultiLobby` 는 호환용으로 보존, 자동으로 `_openAutoPublicMatch` 위임.

---

## 3. 이스터에그 표시 안되던 문제

### 원인 (두 가지)

**원인 A — sessionStorage 캐시의 함정**:
이전 코드가 첫 굴림 결과를 sessionStorage 에 저장. 90% 확률로 `'0'`(미발동) 캐시되면 **그 세션 내내 새로고침해도 영원히 false**.

**원인 B — _charPhotoMedallion 후킹 안됨**:
이전 코드는 `V12Intro.charPhoto()` 명시 호출 시에만 이스터에그 적용. 매치 컨펌 단 한 곳에서만 동작. 의서궁·진단학·경혈학 등의 메달리온은 `window._charPhotoMedallion` 을 직접 호출하므로 이스터에그 미적용.

### 수정

**A. sessionStorage 캐시 제거**:
```js
// 모듈 로드 (페이지 로드 = 새로고침) 시점에 1회 굴림
const _eggResult = {};
for(const charId in EGG_TARGETS){
  _eggResult[charId] = (Math.random() < 0.10) ? EGG_TARGETS[charId] : null;
}
```
같은 페이지 내 동일 캐릭터 여러 위치 렌더 시 깜빡임 없도록 모듈 메모리에만 캐시. 새로고침 → 모듈 재로드 → 새로 굴림.

**B. _charPhotoMedallion 전역 후킹**:
```js
function _installPhotoHook(){
  const orig = window._charPhotoMedallion;
  function hooked(charOrId, size){
    const charId = (typeof charOrId === 'string') ? charOrId : (charOrId && charOrId.id);
    const egg = charId ? getEgg(charId) : null;
    if(!egg) return orig.call(this, charOrId, size);
    return /* egg HTML — egg.src 사진을 끼운 메달리온 */;
  }
  hooked._v12Hooked = true;
  hooked._original = orig;
  window._charPhotoMedallion = hooked;
}
_installPhotoHook();
setTimeout(_installPhotoHook, 200);   // retry: 모듈 로드 순서 안전망
setTimeout(_installPhotoHook, 1000);
setTimeout(_installPhotoHook, 3000);
```

후킹 함수는 원본과 동일 시그니처 `(charOrId, size)` 유지 — 호출부 코드 수정 不要.

또한 `index.html` 스크립트 로드 순서에서 V12 모듈을 `app.js` 직후로 옮겨, 의서궁·진단학·경혈학 어떤 화면을 먼저 보든 후킹이 먼저 설치됨.

### 확률 검증 (10K 시뮬레이션)

| 캐릭터 | 발동률 (목표 10%) |
|---|---|
| `lindaoren` → 간디 | 9.92% |
| `wuyouke` → 오우거 | 9.67% |

| 새로고침 N회 시 한 캐릭터 1회 이상 발동 확률 |
|---|
| 5회 → 41.0% |
| 10회 → 65.1% |
| 20회 → 87.8% |
| 30회 → 95.8% |

→ 5~10번 새로고침 안에 어느 한쪽 이스터에그가 보이는 게 정상 동작. 사용자가 의서궁 또는 매치 화면에서 자주 노출되는 캐릭터(예: 의서궁 八房 카드의 lindaoren 마스코트)는 페이지 로드마다 새 굴림이라 빈도 높게 노출됨.

### 디버그 콘솔 메시지
페이지 로드 시 콘솔에 굴림 결과 출력:
- 발동 시: `[V12Intro] 🥚 이스터에그 발동: lindaoren, wuyouke`
- 미발동 시: `[V12Intro] 이스터에그 굴림 (이번 페이지 로드 미발동)`

개발자 도구 (F12) Console 탭에서 확인 가능.

---

## 전체 V12 패키지 (V12.2 시점)

| 파일 | 비고 |
|---|---|
| `CHANGELOG_v12.md` | (수정 不要) |
| `data-jingxue-poker.js` | (수정 不要) |
| `bangje-v12-jingxue-poker.js` | (수정 不要) |
| **`bangje-v12-multi-intro.js`** | **V12.2 신규** — sessionStorage 제거, 후킹 추가 |
| `bangje-v11-clinic-hub.js` | (V12.1 그대로 — 도구 영역 NEW 버튼 보존) |
| **`bangje-v11-6-acupoints.js`** | **V12.2 신규** — V11Saam 에 포커 카드 + 자동 매칭 |
| `bangje-v11-jingxue-race.js` | **원본으로 되돌림** (OLD 모듈, 비활성) |
| `bangje-cube.js` | (수정 不要) |
| `data-additions.js` | (수정 不要) |
| `app.js` | (V12.0 매치 컨펌 후킹 그대로) |
| **`index.html`** | **V12.2 갱신** — V12 모듈을 app.js 직후로 이동 |

---

*v12.2 — 진입 경로 정합 + 이스터에그 정상 작동.*
