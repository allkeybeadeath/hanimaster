/* data-factions.js — v5
 * ============================================================================
 * 四象 體質 — 4 진영 (faction)
 *
 * 李濟馬 (東武, 1837–1900) 「東醫壽世保元」 의 사상의학 체질 4분류 를
 * 게임 내 진영 (faction) 으로 차용. 진영별 패시브 스킬 + 領土 (territory)
 * 시스템 부여.
 *
 * 데이터 모델:
 *   • id     : 영문 슬러그 (S.faction 에 저장)
 *   • han    : 정식 한자 명칭 (3자, 太陽人 등)
 *   • han2   : 컴팩트 2자 (太陽) — 프로필 칩 표시용
 *   • han1   : 단자 인장 — 색상으로 太/少 구분
 *   • ko     : 한글 명칭
 *   • color  : 진영 대표색 (HEX) — 빨강·노랑·초록·파랑
 *   • passive: 패시브 스킬 설명 (사용자 노출용)
 *   • desc   : 사상의학 전통 해석 (참고용)
 *
 * 패시브 스킬 (app.js 에서 처리):
 *   太陽人  — 배틀 승리시 베팅액의 10% 추가 보너스
 *   少陽人  — 배틀 패배시 베팅액의 10% 복구 (loss-cushion)
 *   太陰人  — 문제풀이 보상 氣 +10% (상시)
 *   少陰人  — 문제풀이 全 정답시 N(문제수) × 5 × 난이도배수 보너스 氣
 *
 * 밸런스 설계 메모:
 *   • 太陰 (상시 +10%) vs 少陰 (전정답 한정 다발 보너스) 의 期待値가
 *     ~정답률 0.85 부근에서 교차하도록 설정.
 *     예) 10문항 D2(×1.5) 전부 정답:
 *         太陰: 100×1.5×0.10 = +15 氣
 *         少陰: 10×5×1.5     = +75 氣  (전정답 한정)
 *   • 太陽 (win-bonus +10%) vs 少陽 (lose-cushion +10%) 는
 *     승률 0.5 가정 기대값 0. 승률 < 0.5 인 학습자는 少陽, > 0.5 는 太陽 유리.
 *
 * 五行 체계 참고 (배경 컬러 결정 근거):
 *   太陽 — 火 — 朱(빨강)
 *   少陽 — 土 — 黃(노랑)
 *   太陰 — 木 — 靑/綠(초록)
 *   少陰 — 水 — 玄/藍(파랑)
 * ============================================================================ */

const FACTIONS = [
  {
    id: 'taeyang',
    han: '太陽人',
    han2: '太陽',
    han1: '陽',
    ko: '태양인',
    color: '#C13838',         // 朱砂紅 계열 (빨강)
    colorDim: '#7A2222',
    colorBg: 'rgba(193,56,56,0.10)',
    passive: '對決 勝利 시 베팅액의 10% 추가 획득',
    passiveShort: '勝 +10%',
    desc: '폐대간소 (肺大肝小) · 외향·강건. 도전적·승부형.'
  },
  {
    id: 'soyang',
    han: '少陽人',
    han2: '少陽',
    han1: '陽',
    ko: '소양인',
    color: '#D9A813',         // 帝王黃 계열 (노랑)
    colorDim: '#8C6A0A',
    colorBg: 'rgba(217,168,19,0.10)',
    passive: '對決 敗北 시 베팅액의 10% 복구',
    passiveShort: '敗 緩衝 10%',
    desc: '비대신소 (脾大腎小) · 명민·활동. 회복·완충형.'
  },
  {
    id: 'taeum',
    han: '太陰人',
    han2: '太陰',
    han1: '陰',
    ko: '태음인',
    color: '#2A7060',         // 翡翠綠 계열 (초록)
    colorDim: '#174538',
    colorBg: 'rgba(42,112,96,0.10)',
    passive: '문제풀이 보상 氣 상시 +10%',
    passiveShort: '問 +10%',
    desc: '간대폐소 (肝大肺小) · 후중·인내. 꾸준한 축적형.'
  },
  {
    id: 'soeum',
    han: '少陰人',
    han2: '少陰',
    han1: '陰',
    ko: '소음인',
    color: '#2C5AA0',         // 玄 계열 (파랑)
    colorDim: '#1A3866',
    colorBg: 'rgba(44,90,160,0.10)',
    passive: '문제풀이 全 정답시 (문제수 × 5 × 난이도배수) 氣',
    passiveShort: '完答 N×5',
    desc: '신대비소 (腎大脾小) · 섬세·집중. 완벽주의 폭발형.'
  }
];

const FACTION_BY_ID = Object.fromEntries(FACTIONS.map(f => [f.id, f]));

// 진영 id 반환 (잘못된 id면 'taeyang' fallback)
function getFaction(id){
  return FACTION_BY_ID[id] || FACTIONS[0];
}

// 랜덤 진영 id — 신규 사용자 초기 부여용
function randomFactionId(){
  return FACTIONS[Math.floor(Math.random() * FACTIONS.length)].id;
}

// presence 데이터로부터 진영별 누적 氣 집계
//   입력: presenceMap = { uid: {qi, faction, ...} }
//   출력: [{faction, totalQi, count, share, ...meta}, ...] (totalQi 순)
function aggregateFactions(presenceMap){
  const buckets = Object.fromEntries(FACTIONS.map(f => [f.id, {
    ...f, totalQi: 0, count: 0, leaderQi: 0, leaderName: ''
  }]));
  if(presenceMap){
    Object.entries(presenceMap).forEach(([uid, p]) => {
      const fid = p && p.faction;
      if(!fid || !buckets[fid]) return;          // 진영 미설정자는 집계 제외
      const qi = Math.max(0, Math.floor(p.qi||0));
      buckets[fid].totalQi += qi;
      buckets[fid].count   += 1;
      if(qi > buckets[fid].leaderQi){
        buckets[fid].leaderQi  = qi;
        buckets[fid].leaderName = p.name || '익명';
      }
    });
  }
  const total = Object.values(buckets).reduce((s, b) => s + b.totalQi, 0) || 1;
  return FACTIONS.map(f => {
    const b = buckets[f.id];
    return { ...b, share: b.totalQi / total };
  }).sort((a, b) => b.totalQi - a.totalQi);
}

if(typeof window !== 'undefined'){
  window.FACTIONS       = FACTIONS;
  window.FACTION_BY_ID  = FACTION_BY_ID;
  window.getFaction     = getFaction;
  window.randomFactionId = randomFactionId;
  window.aggregateFactions = aggregateFactions;
}
