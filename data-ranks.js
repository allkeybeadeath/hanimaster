/* data-ranks.js — v2.0
 * ============================================================================
 * 명예의 전당 — 9단계 等級 體系
 *
 * 黃帝內經 素問 上古天眞論 의 4단계 위계 (眞人 > 至人 > 聖人 > 賢人) 를
 * 최상위로 두고, 그 아래 5개 단계를 더하여 학습 진행감을 줌.
 *
 * 累計 氣 (= XP 누계) 기준 자동 승격. cost 는 절대값.
 *
 * 등급 구조 (低 → 高):
 *   賓醫  빈의   0          기본 — '客醫'·견습
 *   醫工  의공   200        鍼工·藥工
 *   醫師  의사   500        正式 의원
 *   良醫  양의   1000       良醫는 上工
 *   大醫  대의   2000       孫思邈 의 大醫精誠 에서
 *   賢人  현인   3500       上古天眞論 4단계 — 第4
 *   聖人  성인   5500       上古天眞論 4단계 — 第3
 *   至人  지인   8000       上古天眞論 4단계 — 第2
 *   眞人  진인   12000      上古天眞論 4단계 — 第1 (最高)
 *
 * 黃帝內經 素問 上古天眞論 原文 발췌:
 *   "上古有眞人者，提挈天地，把握陰陽 ..."
 *   "中古之時，有至人者，淳德全道 ..."
 *   "其次有聖人者，處天地之和 ..."
 *   "其次有賢人者，法則天地 ..."
 * ============================================================================ */

const RANKS = [
  { id:'binyi',   han:'賓醫',  ko:'빈의', cost:0,     desc:'견습 의원 — 初心',
    color:'#8C7860', seal:'賓' },
  { id:'yigong',  han:'醫工',  ko:'의공', cost:200,   desc:'藥工·鍼工 — 기예를 닦는 자',
    color:'#A06840', seal:'工' },
  { id:'yishi',   han:'醫師',  ko:'의사', cost:500,   desc:'正式 의원 — 病을 가린다',
    color:'#8C5028', seal:'師' },
  { id:'liangyi', han:'良醫',  ko:'양의', cost:1000,  desc:'上工 — 未病 을 안다',
    color:'#6A8C40', seal:'良' },
  { id:'dayi',    han:'大醫',  ko:'대의', cost:2000,  desc:'大醫精誠 — 仁心仁術',
    color:'#487048', seal:'大' },
  { id:'xianren', han:'賢人',  ko:'현인', cost:3500,  desc:'天地를 法則 으로 삼는 자',
    color:'#3068A0', seal:'賢' },
  { id:'shengren',han:'聖人',  ko:'성인', cost:5500,  desc:'天地의 和 에 처하는 자',
    color:'#6A4C8C', seal:'聖' },
  { id:'zhiren',  han:'至人',  ko:'지인', cost:8000,  desc:'淳德全道 — 中古의 至人',
    color:'#9C3030', seal:'至' },
  { id:'zhenren', han:'眞人',  ko:'진인', cost:12000, desc:'提挈天地·把握陰陽 — 上古의 眞人',
    color:'#C9A227', seal:'眞' }
];

// 누계 氣 → 현재 등급 반환
function getRank(qi){
  qi = Math.max(0, Math.floor(qi || 0));
  let cur = RANKS[0];
  for(let i = 0; i < RANKS.length; i++){
    if(qi >= RANKS[i].cost) cur = RANKS[i];
    else break;
  }
  return cur;
}

// 다음 등급 정보 — UI 진행 표시용
function getNextRank(qi){
  qi = Math.max(0, Math.floor(qi || 0));
  for(let i = 0; i < RANKS.length; i++){
    if(qi < RANKS[i].cost) return RANKS[i];
  }
  return null;  // 이미 최상위
}

// 현재 등급의 진행률 (0~1)
function getRankProgress(qi){
  qi = Math.max(0, Math.floor(qi || 0));
  const cur = getRank(qi);
  const nxt = getNextRank(qi);
  if(!nxt) return 1;
  const span = nxt.cost - cur.cost;
  const done = qi - cur.cost;
  return span > 0 ? Math.min(1, done / span) : 0;
}

if(typeof window !== 'undefined'){
  window.RANKS = RANKS;
  window.getRank = getRank;
  window.getNextRank = getNextRank;
  window.getRankProgress = getRankProgress;
}
