# v10.0.2 (2026-05)

## 추가

### 본초 학습 (V99HerbTap)
- 본초 카드 (방미큐브 `.bc-card` / 카드 對決 `.cb-herb-card`) **단탭** 시 즉시 처방 popup
  - v9.8 의 long-press (700ms) 대신 즉시 발동 — 학습용
  - 게임 진행 클릭은 popup 발동 시 차단 (capture phase + stopPropagation)
- 大廳 hello-card 옆에 토글 chip 「本草學習 ON/OFF」 부착
  - ON (기본): 단탭 → popup
  - OFF: 본초 카드 클릭은 게임 기본 동작
  - 영속: `S.herbTapEnabled` (default true)
- 처방 chip 아래에 「+ 나머지 본초」 표시 — 클릭한 본초 외 어떤 본초를 더하면 그 처방이 되는지
  - 한자 본초만 추출 (용량 제거), 중복 제거, 가독성 위해 「·」 구분
  - 본초가 하나뿐인 단방은 「單方」으로 표시
- `bangje-v98-herbpop.js` 의 long-press 모드는 자동 `setMode('off')` 호출로 비활성

### 大廳 버전 표시 갱신
- `APP_VERSION`: v9.7 → **v10.0.2** (`app.js` 하드코딩)
- 이전 v9.8 / v9.9 patch 가 `APP_VERSION` 을 안 건드려서 大廳에 계속 v9.7 로 표시되던 버그 수정

## 변경된 파일

| 파일 | 변경 |
|---|---|
| `app.js` | `APP_VERSION` / `APP_BUILD` 두 줄만 갱신 |
| `bangje-v99-herbtap.js` | 신규 |
| `index.html` | `<script src="bangje-v99-herbtap.js">` 한 줄 추가 |
| `sw.js` | PRECACHE 한 줄 추가 + cache key bump (`v10-0-2-2026-05`) |

## API

```js
V99HerbTap.isOn()      // 현재 학습 토글 상태
V99HerbTap.toggle()    // ON ↔ OFF
V99HerbTap.on()        // 강제 ON
V99HerbTap.off()       // 강제 OFF
```

## 사용

1. 大廳 좌상단 「本草學習」 chip 으로 토글
2. 큐브·카드 對決 중 본초 카드 한 번 탭 → 처방 popup
3. popup 에서 각 처방 옆의 chip 클릭 → 처방 상세

게임 진행에 방해되면 chip 클릭으로 OFF.
