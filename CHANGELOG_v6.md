# 方劑學 PWA v6 — CHANGELOG

> v5 (2026-05-17d) → v6 (2026-05-17e)

> v6는 **검수 4건 + 드릴 모드** 까지. 카드 對決 게임은 v7 에서.

## ① 처방 드릴 모드 (신규)

사적 약점 분석에서 약점 처방을 선택하면 그 처방을 다각도로 반복 학습. 객관식 5지선다가 아닌 즉답 카드 형식 — 답 선택 → 즉시 정답·해설 공개 → 다음 카드. 점수보다 마스터가 목적.

**자동 카드 생성** — 한 처방당 평균 18장:
- `blank_herb` — 構成의 각 본초마다 1장 (빈칸 채우기, 같은 章 다른 처방 본초가 함정 후보)
- `monarch` — 君臣佐使의 각 본초마다 1장 (役 매칭)
- `action` — 主作用 1장 (다른 처방의 작용이 함정 후보)
- `indication` — 主治 첫 구절 1장
- `addition` — keyPoints의 「+陳皮 → 異功散」 같은 加減 변환 패턴 (정규식 자동 추출)
- `source` — 出典 1장

**26개 처방 × 평균 18장 = 471장 자동 생성** (실측치). 매번 셔플되어 같은 처방을 반복해도 새로운 흐름.

**진입 경로**
- 사적 분석 → 약점 처방 TOP 5 표에 「練」 버튼 (각 행)
- 약점 처방 1위는 큰 액션 카드로 노출 (가장 약한 처방 자동 선정)

**滿點 마스터** — 100% 정답 시 `S.masteredFormulas` 에 추가, 다음 시각화/통계에서 활용 가능.

**기존 5지선다와의 차이**
- 5지선다 (`startQuizSession`): 시험 대비 평가, 시간 압박, 오답 누적
- 드릴 (`startFormulaDrill`): 학습 보조, 시간 X, 오답 누적 X, 즉시 해설

## ② 검수 #1 — 오답 랭킹에서 자동 출제 제외

`renderWrongsRank` 의 `filter(x => !x.qid.startsWith('auto:'))` 추가. 자동 생성 문제는 콘텐츠 해시로 누적되긴 하나 재현 불가하므로 TOP 30 표에서 제거. 기출만 노출되어 「오늘 어떤 문제 틀렸지?」 → 즉시 해당 기출 클릭으로 복원.

## ③ 검수 #2 — 사적 분석 「出」 버튼 처방 데이터 부족 버그

**원인**: `wrongExams` (틀린 기출들) 에서만 章별 처방을 추출 → 章에 대한 오답이 있어도 그 章의 모든 처방이 wrongExams 에 있지는 않으니 자주 매칭 실패.

**수정**: FORMULAS 전체에서 章 시작 일치로 처방 ID 풀 구성 → 그 章의 모든 처방으로 자동 출제. wrongExams 추출은 백업 폴백으로 남김. toast 메시지에 "${ch} 자동 출제 시작 — ${diff} 10문 (${N}개 처방 풀)" 로 풀 크기 명시.

## ④ 검수 #3 — 매칭 안 됨 / 환불 안 됨 / 대기자 안 보임

**원인 가설** (사용자 자가 진단 「중간에 나가서 꼬임」 검증): `/battles` 의 `Object.values(battles).find(r => r.players[S.userId] && r.status !== 'done')` 가 stale 방까지 잡아서 다음 입장 시 잘못된 매칭으로 인식 → 환불도 정상 매칭으로 분류되어 안 됨.

**수정**:
1. `STALE_ROOM_MS = 5 * 60 * 1000` — 5분 이상 된 방은 매칭 인식 안 함
2. `onBattlesSnap` 의 `myRoom` 필터에 `(now - r.createdAt) < STALE_ROOM_MS` 조건 추가
3. **자기의 stale 방을 매칭 진입 직후 1회 명시적 정리** — `battles/{rid}/status = 'done'` 마킹. 이러면 양측 클라이언트가 깨끗한 상태로 다시 큐 진입.

**부수 효과**: 정상 매칭은 영향 없음 (createdAt 은 새 방 생성 시 `Date.now()` 로 박히므로 5분 이내). 환불은 cleanup(true) 가 호출되는 경로가 변경 없으므로 동일.

## ⑤ 검수 #4 — 배틀컷 중국어 별도 설정 필요?

**확인**: 기존 `tts.speak` 는 `SpeechSynthesisUtterance.lang = 'zh-CN'` 만 설정. 시스템에 중국어 voice 가 설치되어 있지 않으면 (Windows·일부 Android·일부 iOS) 시스템 기본 voice (한국어/영어) 가 한자를 발음 → 알 수 없는 소리가 나거나 무음.

**해결 (B안 채택)**:
- zh voice **있으면** → 기존 SpeechSynthesis (오프라인 작동)
- zh voice **없으면** → Google Translate 비공식 TTS endpoint 사용 — `https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=…` 를 `new Audio(url).play()` 로 (CORS 우회). 첫 1회 toast 안내 「인터넷 TTS 사용」.
- **둘 다 실패** → silent (게임 진행 안 막음).

**한계**:
- Google 의 비공식 endpoint 라 언젠가 차단될 수 있음 (재발 시 사전 녹음 MP3 번들로 마이그레이션 필요)
- 100자 제한 (인트로 명언은 보통 12자 내외이므로 OK)
- 모바일 데이터 사용 (한 명언 당 ~30KB)
- 시대별 발음 (上古·中古 中國語) 은 어떤 TTS 도 지원 안 함. 현재 voice 는 표준 만다린(zh-CN).

`tts.cancel()` 도 `speechSynthesis.cancel()` + 활성 Audio 인스턴스 `pause()` 양쪽 처리.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `app.js` | `tts` 객체 v6 개편 (Google fallback) · `generateDrillCards`·`startFormulaDrill` 함수군 신규 · 사적 분석 액션 핸들러에 `formula-drill` 분기 추가 · `renderWrongsRank` auto:* 필터 · `joinBattleQueue` stale 방 필터 + 자기 stale 1회 정리 · 사적 분석 章 자동 출제 FORMULAS 전체 매칭 |
| `sw.js`  | 캐시키 `v5-2026-05` → `v6-2026-05` |
| `CHANGELOG_v6.md` | 신규 |

## 인수 체크리스트

- [ ] Firebase Hosting 배포 후 `/battles` 노드에 stale 데이터가 있다면 Console 에서 한 번 정리 (또는 다음 매칭 시 자동 정리됨)
- [ ] zh voice 없는 환경에서 인트로 진입 시 「인터넷 TTS 사용」 toast 1회 + 발화 정상 확인
- [ ] 사적 분석 → 약점 처방 1위 「練」 버튼 → 18장 드릴 완주 → 滿點 표시 확인
- [ ] 章 자동 출제 가 더 이상 「처방 데이터 부족」 toast 안 띄우는지 확인

## v7 예정 (다음 세션)

- 카드 對決 게임 (양측 25% 베팅, 무작위 증 3 중 1택, 공유 1덱, 神급 5스킬, 본초 SVG 자동 생성)
- `data-syndromes.js` 신규 (처방 26개 → 증 26종 매핑)
- Firebase `/card_battles/{roomId}` 신규 스키마
- 본초 카드 SVG 헬퍼 (성미 색상 + 카테고리 아이콘 + 한자 워터마크)

작성: 2026-05-17 · CIM Lab
