# v10.0.6 (2026-05)

큐브 出牌 룰 정확화 — 첫 出牌만 base 처방 전체, 둘째 出牌부터 base 부분집합(≥3미) 허용.

## 룰 분리 (사용자 의도)

| 시점 | 허용 조건 |
|------|----------|
| **첫 出牌** | 완성된 base 처방 전체 (사이즈 무관 — 사역탕 3미·당귀보혈탕 2미도 OK). 派生方·加減方 단독·부분집합 모두 거부. |
| **둘째 出牌 이후** | 어떤 base 처방의 composition ⊇ 본 set 이면 OK. 단 distinct 본초 ≥ 3미. 정확 매칭(base·派生·加減) 도 당연히 OK. |

## 구현

### v10.0.4 ~ v10.0.5 의 한계
v10.0.4 에서 `bangje-v98-cube-rules.js` 의 `validateLocal` 이 첫 出牌만 검증하고
opened=true 마킹 후 통과. 둘째 出牌부터는 `cube-rules` 가 즉시 통과시켰지만
`bangje-cube.js` 본체의 `validateBoard` 가 매 commit 마다 `isValidSet` 를 호출 →
`isValidSet` 는 정확 매칭만 valid → **부분집합 거부 → 출패 실패**.

### v10.0.6 패치 — `bangje-cube.js`
`matchSet` 에 partial fallback 추가. 정확 매칭이 0건이면 base 부분집합 검색:

```js
function matchSet(herbs){
  build();
  const exact = _sigIdx[sig(herbs)] || [];
  if(exact.length > 0) return exact;            // 정확 매칭 우선
  const pb = _findPartialBase(herbs);            // ← 신규 fallback
  if(pb) return [{ type:'partial', ... }];
  return [];
}
```

`_findPartialBase(herbs)` — distinct 본초 ≥ 3 이고, 어떤 base 처방의 composition 이
본 set 을 (진정한 의미로) 포함하는지 검색. 매칭되는 base 가 여럿이면 composition 이
가장 작은 (즉 가장 가까운) 처방 우선.

`BC_VER` 도 `'1.2'` → `'1.3'` 으로 갱신.

### 첫 出牌 룰의 무결성 보존
`bangje-v98-cube-rules.js` 의 `_hasBaseMatch` 는 `matchSet` 결과 중 `type==='base'`
만 통과시킴. partial 매칭은 `type='partial'` 이므로 거부 → **첫 出牌는 여전히 완성
처방 강제**. v10.0.4 의 cube-rules.js 는 무변경.

### 라벨링 처리
새 partial 결과는 `{ type:'partial', label:'사군자탕 부분', han:'四君子湯部', ... }`.
`commitTurn` 의 labeled 단계 (`top = ms.find(x=>x.type==='base') || ms[0]`) 가 자연
스럽게 partial 결과를 잡아 보드 set 의 label 로 사용 (예: "사군자탕 부분"). UI 깨짐
없음.

## 실데이터 시뮬레이션 (모두 합리적 결과)

| 본초 set | 결과 | 첫 出牌 | 둘째↑ |
|---|---|:---:|:---:|
| 人蔘·白朮·茯苓·甘草 (사군자탕) | type=base 사군자탕 | ✓ | ✓ |
| 人蔘·白朮·茯苓 (사군자 3미) | type=partial 사군자탕 부분 (base 4미) | ✗ | ✓ |
| 黃耆·當歸 (당귀보혈탕) | type=base 당귀보혈탕 (2미 그대로) | ✓ | ✓ |
| 黃耆 단독 | 매칭 0 | ✗ | ✗ |
| 附子·乾薑·甘草 (사역탕) | type=base 사역탕 | ✓ | ✓ |
| 附子·甘草 (2미) | 매칭 0 (3미 미만) | ✗ | ✗ |
| 人蔘·甘草·生薑 | type=partial 소시호탕 부분 (base 7미) | ✗ | ✓ |
| 麻黃·人蔘·地黃 | 매칭 0 (어떤 base 도 ⊇ 아님) | ✗ | ✗ |
| 六君子湯 5미 subset = 異功散 | type=derive 異功散 정확 매칭 | ✗ | ✓ |

## 게임 진행 의의

- **학습 강화**: 첫 出牌에서 완성 처방을 한 번 머릿속에 정확히 호출해야 함
  (정통 큐브의 "오프닝" 정신).
- **유연성 확보**: 그 이후 손패가 빠지면서 完成 처방을 만들기 어려워질 때, base
  처방의 "구성 일부" 만으로도 보드에 풀어놓을 수 있어 게임 진행이 막히지 않음.
  보드의 partial set 에 본초 추가 → 完成 처방으로 발전 가능 (큐브의 가감 정신).

## 大廳 표시

- `APP_VERSION`: v10.0.5 → **v10.0.6**
- `APP_BUILD`: 2026.05.18.v10.0.6

## 캐시 키

- `bangje-pwa-v10-0-6-2026-05`

## 비변경

- v10.0.4 ~ v10.0.5 의 모든 패치 유지 (신급 스킬·女媧 키·시험범위밖 표시·카드對決
  가로 wrap·드로어 통과 클릭·多本草 同含 검색·첫 出牌 base 강제)
- 派生方·加減方 정확 매칭은 그대로 작동
- 점수·deck·시그니처·기출 무변경
