/* bangje-v99-meridian-body.js — v10.0
 * ============================================================================
 * 361穴 인체 시각화 + 通明 업적
 *
 *   • 14경맥(12 정경 + 任督) 361혈 전체 한자명 데이터 임베드
 *   • SVG 정면도 인체 + 각 경맥 path 위 균등 분포 점등
 *   • S.qi 누적에 따라 다리부터 차례로 혈자리 점등
 *   • 1혈 = 10氣, 滿穴 = 3,610氣 → 通明 업적
 *   • 통명 印을 메달리온 옆 / 인장 大廳에 부착 (다른 인장과 시각 명확 차별)
 *   • 혈자리 점 클릭 → 'LU1 中府' toast (학습 보조)
 *
 *   진입점:
 *     • 프로필/메달리온/hello-card 클릭 (자동 후크)
 *     • V99Body.open() 직접 호출
 *
 *   API:
 *     • V99Body.open()                  — 인체 모달 열기
 *     • V99Body.progress()              — {qi, lit, total, totalQi, pct, full}
 *     • V99Body.isUnlocked()            — 통명 업적 여부
 *     • V99Body.getMeridians()          — 14경맥 메타 + points 배열
 *     • V99Body.totalPoints()           — 361 (상수)
 *     • V99Body._debugReset()           — 디버그: 통명 unlock 해제 (콘솔용)
 *     • V99Body._refreshMedallion()     — 메달리온 印 강제 재부착
 *
 *   상수:
 *     • TOTAL_POINTS = 361
 *     • QI_PER_POINT = 10
 *     • TOTAL_QI     = 3,610
 *
 *   외부 의존: openModal (선택), toast (선택), saveState (선택)
 * ============================================================================ */
(function(){
'use strict';

// ─── 361혈 데이터 (한자명) ──────────────────────────────────────────────
// 경맥별 혈명을 '|' 로 구분한 단일 문자열. parse 시 분할.
const POINT_NAMES = {
  LU: '中府|雲門|天府|俠白|尺澤|孔最|列缺|經渠|太淵|魚際|少商',
  LI: '商陽|二間|三間|合谷|陽谿|偏歷|溫溜|下廉|上廉|手三里|曲池|肘髎|手五里|臂臑|肩髃|巨骨|天鼎|扶突|禾髎|迎香',
  ST: '承泣|四白|巨髎|地倉|大迎|頰車|下關|頭維|人迎|水突|氣舍|缺盆|氣戸|庫房|屋翳|膺窓|乳中|乳根|不容|承滿|梁門|關門|太乙|滑肉門|天樞|外陵|大巨|水道|歸來|氣衝|髀關|伏兎|陰市|梁丘|犢鼻|足三里|上巨虛|條口|下巨虛|豐隆|解谿|衝陽|陷谷|内庭|厲兌',
  SP: '隱白|大都|太白|公孫|商丘|三陰交|漏谷|地機|陰陵泉|血海|箕門|衝門|府舍|腹結|大横|腹哀|食竇|天谿|胸鄉|周榮|大包',
  HT: '極泉|青靈|少海|靈道|通里|陰郄|神門|少府|少衝',
  SI: '少澤|前谷|後谿|腕骨|陽谷|養老|支正|小海|肩貞|臑兪|天宗|秉風|曲垣|肩外兪|肩中兪|天窓|天容|顴髎|聽宮',
  BL: '睛明|攢竹|眉衝|曲差|五處|承光|通天|絡却|玉枕|天柱|大杼|風門|肺兪|厥陰兪|心兪|督兪|膈兪|肝兪|膽兪|脾兪|胃兪|三焦兪|腎兪|氣海兪|大腸兪|關元兪|小腸兪|膀胱兪|中膂兪|白環兪|上髎|次髎|中髎|下髎|會陽|承扶|殷門|浮郄|委陽|委中|附分|魄戸|膏肓|神堂|譩譆|膈關|魂門|陽綱|意舎|胃倉|肓門|志室|胞肓|秩邊|合陽|承筋|承山|飛揚|跗陽|崑崙|僕參|申脈|金門|京骨|束骨|足通谷|至陰',
  KI: '湧泉|然谷|太谿|大鍾|水泉|照海|復溜|交信|築賓|陰谷|横骨|大赫|氣穴|四滿|中注|肓兪|商曲|石關|陰都|腹通谷|幽門|歩廊|神封|靈墟|神蔵|彧中|兪府',
  PC: '天池|天泉|曲澤|郄門|間使|内關|大陵|勞宮|中衝',
  TE: '關衝|液門|中渚|陽池|外關|支溝|會宗|三陽絡|四瀆|天井|清冷淵|消濼|臑會|肩髎|天髎|天牖|翳風|瘈脈|顱息|角孫|耳門|和髎|絲竹空',
  GB: '瞳子髎|聽會|上關|頷厭|懸顱|懸釐|曲鬢|率谷|天衝|浮白|頭竅陰|完骨|本神|陽白|頭臨泣|目窓|正營|承靈|腦空|風池|肩井|淵腋|輒筋|日月|京門|帶脈|五枢|維道|居髎|環跳|風市|中瀆|膝陽關|陽陵泉|陽交|外丘|光明|陽輔|懸鍾|丘墟|足臨泣|地五會|俠谿|足竅陰',
  LR: '大敦|行間|太衝|中封|蠡溝|中都|膝關|曲泉|陰包|足五里|陰廉|急脈|章門|期門',
  CV: '會陰|曲骨|中極|關元|石門|氣海|陰交|神闕|水分|下脘|建里|中脘|上脘|巨闕|鳩尾|中庭|膻中|玉堂|紫宮|華蓋|璇璣|天突|廉泉|承漿',
  GV: '長強|腰兪|腰陽關|命門|懸樞|脊中|中樞|筋縮|至陽|靈台|神道|身柱|陶道|大椎|啞門|風府|腦戸|強間|後頂|百會|前頂|顖會|上星|神庭|素髎|水溝|兌端|齦交',
};

// 한국 한자음 (간이 매핑 — V98Hanyin 도 있지만 자체 fallback 보유)
// 매우 빈번한 혈자리만. 그 외는 V98Hanyin.lookup() 시도.
const POINT_KO_HINT = {
  '湧泉':'용천','太谿':'태계','三陰交':'삼음교','陰陵泉':'음릉천','血海':'혈해',
  '足三里':'족삼리','合谷':'합곡','曲池':'곡지','太淵':'태연','列缺':'열결',
  '神門':'신문','内關':'내관','勞宮':'노궁','百會':'백회','風池':'풍지',
  '中脘':'중완','氣海':'기해','關元':'관원','膻中':'전중','大椎':'대추',
  '命門':'명문','腎兪':'신유','肺兪':'폐유','脾兪':'비유','肝兪':'간유',
  '心兪':'심유','胃兪':'위유','膈兪':'격유','大腸兪':'대장유','至陰':'지음',
  '崑崙':'곤륜','申脈':'신맥','照海':'조해','陽陵泉':'양릉천','懸鍾':'현종',
  '中府':'중부','少商':'소상','商陽':'상양','迎香':'영향','睛明':'정명',
  '攢竹':'찬죽','承泣':'승읍','地倉':'지창','大敦':'대돈','太衝':'태충',
  '期門':'기문','章門':'장문','天池':'천지','中衝':'중충','絲竹空':'사죽공',
  '長強':'장강','風府':'풍부','人中':'인중','水溝':'수구','素髎':'소료',
  '至陽':'지양','身柱':'신주','陶道':'도도','少澤':'소택','聽宮':'청궁',
  '極泉':'극천','少衝':'소충','關衝':'관충','陽池':'양지','瞳子髎':'동자료',
  '環跳':'환도','風市':'풍시','丘墟':'구허','大杼':'대저','腰陽關':'요양관',
};

// ─── 14경맥 메타 (id, han, ko, 색상, SVG path, 점등 순서) ──────────────
// path 는 정면도 viewBox 200×510 기준. 시각화 의도이므로 학술 정확도 아닌
// 자연스러운 흐름을 우선.
//   order: 1=다리부터 채우는 순서 (낮을수록 먼저 점등)
// 다리(足三陰 → 足三陽) → 中軸(任督) → 팔(手三陰 → 手三陽) 순.
const MERIDIANS_RAW = [
  { id:'KI', han:'足少陰腎經',   ko:'족소음신경',   order:1,  color:'#1B3A55',
    path:'M 90 482 Q 88 460 89 440 Q 88 400 88 350 Q 88 300 90 260 Q 92 210 93 160 Q 92 120 95 110' },
  { id:'LR', han:'足厥陰肝經',   ko:'족궐음간경',   order:2,  color:'#2E5E3D',
    path:'M 86 480 Q 84 460 85 440 Q 83 400 82 350 Q 84 300 88 260 Q 92 220 97 190 Q 100 175 102 165' },
  { id:'SP', han:'足太陰脾經',   ko:'족태음비경',   order:3,  color:'#C9A227',
    path:'M 84 480 Q 82 450 79 410 Q 78 360 79 320 Q 80 280 82 250 Q 80 220 78 200 Q 75 180 72 165 Q 68 155 65 145' },
  { id:'ST', han:'足陽明胃經',   ko:'족양명위경',   order:4,  color:'#9C3030',
    path:'M 78 478 Q 78 450 80 410 Q 82 370 85 330 Q 88 280 90 240 Q 92 200 93 160 Q 94 130 94 105 Q 94 85 93 72' },
  { id:'GB', han:'足少陽膽經',   ko:'족소양담경',   order:5,  color:'#6B4FA8',
    path:'M 82 480 Q 74 460 70 420 Q 68 380 68 340 Q 66 300 65 260 Q 64 220 66 180 Q 68 150 72 120 Q 78 90 85 70 Q 88 65 92 63' },
  { id:'BL', han:'足太陽膀胱經', ko:'족태양방광경', order:6,  color:'#214966',
    path:'M 88 482 Q 88 460 90 420 Q 92 380 95 340 Q 98 300 100 260 Q 102 220 103 180 Q 104 140 104 100 Q 102 80 99 70 Q 97 68 95 66' },
  { id:'GV', han:'督脈',         ko:'독맥',         order:7,  color:'#3A2D14',
    path:'M 100 295 Q 100 240 100 180 Q 100 140 100 110 Q 100 90 100 78' },
  { id:'CV', han:'任脈',         ko:'임맥',         order:8,  color:'#C8923A',
    path:'M 100 290 Q 100 260 100 220 Q 100 180 100 150 Q 100 110 100 88' },
  { id:'LU', han:'手太陰肺經',   ko:'수태음폐경',   order:9,  color:'#D1B080',
    path:'M 70 115 Q 60 130 55 150 Q 48 175 42 195 Q 36 215 30 230 Q 25 240 22 245' },
  { id:'HT', han:'手少陰心經',   ko:'수소음심경',   order:10, color:'#882020',
    path:'M 65 118 Q 55 140 48 165 Q 40 185 33 205 Q 26 225 20 238' },
  { id:'PC', han:'手厥陰心包經', ko:'수궐음심포경', order:11, color:'#5C3060',
    path:'M 70 132 Q 60 155 52 180 Q 44 200 36 220 Q 28 232 22 240' },
  { id:'LI', han:'手陽明大腸經', ko:'수양명대장경', order:12, color:'#D17A30',
    path:'M 26 235 Q 32 218 40 195 Q 48 170 56 145 Q 64 122 72 100 Q 80 85 88 76 Q 94 72 96 70' },
  { id:'TE', han:'手少陽三焦經', ko:'수소양삼초경', order:13, color:'#4A4A4A',
    path:'M 22 238 Q 28 218 36 195 Q 44 170 52 145 Q 62 120 72 95 Q 82 78 90 66' },
  { id:'SI', han:'手太陽小腸經', ko:'수태양소장경', order:14, color:'#7A1F1F',
    path:'M 18 232 Q 24 210 32 185 Q 40 160 50 135 Q 60 110 72 88 Q 84 72 100 62' },
];

// ─── 파싱: 경맥 메타 + 혈명 배열 + globalOrder ─────────────────────────
let _M = null;
function _parse(){
  if(_M) return _M;
  const out = [];
  // order 순으로 정렬해서 globalOrder 부여
  const sorted = MERIDIANS_RAW.slice().sort((a,b) => a.order - b.order);
  let g = 0;
  for(const m of sorted){
    const names = (POINT_NAMES[m.id] || '').split('|').filter(x => x);
    const points = names.map((han, i) => ({
      id: `${m.id}${i+1}`,
      han,
      ko: POINT_KO_HINT[han] || _tryV98Lookup(han),
      meridian: m.id,
      meridianHan: m.han,
      idx: i,
      globalOrder: g++,
    }));
    out.push({ ...m, points, count: points.length });
  }
  _M = out;
  return out;
}

function _tryV98Lookup(han){
  try{
    if(window.V98Hanyin && window.V98Hanyin.lookup){
      const v = window.V98Hanyin.lookup(han);
      if(v && v !== han) return v;
    }
  }catch(_){}
  return '';
}

function getMeridians(){ return _parse(); }

// ─── 상수 ──────────────────────────────────────────────────────────────
const TOTAL_POINTS = 361;
const QI_PER_POINT = 10;
const TOTAL_QI     = TOTAL_POINTS * QI_PER_POINT;  // 3610

function totalPoints(){
  // 데이터 검증용 — 합이 361 인지
  return getMeridians().reduce((s, m) => s + m.count, 0);
}

// ─── 진척 ──────────────────────────────────────────────────────────────
function progress(){
  const s = window.S || {};
  const qi = Math.max(0, s.qi || 0);
  const lit = Math.min(TOTAL_POINTS, Math.floor(qi / QI_PER_POINT));
  return {
    qi,
    lit,
    total: TOTAL_POINTS,
    totalQi: TOTAL_QI,
    pct: lit / TOTAL_POINTS,
    full: lit >= TOTAL_POINTS,
    next: Math.max(0, QI_PER_POINT - (qi % QI_PER_POINT)) || (lit >= TOTAL_POINTS ? 0 : QI_PER_POINT),
  };
}

// ─── SVG 인체 outline ──────────────────────────────────────────────────
const VB_W = 200, VB_H = 510;
const BODY_OUTLINE_SVG = `
  <!-- 머리 -->
  <circle cx="100" cy="50" r="33" fill="none" stroke="#876A36" stroke-width="1.1" opacity="0.55"/>
  <!-- 목 -->
  <path d="M 90 80 L 88 100 L 112 100 L 110 80" fill="none" stroke="#876A36" stroke-width="1.1" opacity="0.55"/>
  <!-- 몸통 -->
  <path d="M 70 100 Q 65 110 65 130 L 65 260 Q 65 275 70 290 L 130 290 Q 135 275 135 260 L 135 130 Q 135 110 130 100"
        fill="none" stroke="#876A36" stroke-width="1.1" opacity="0.55"/>
  <!-- 좌 팔 -->
  <path d="M 65 110 Q 50 130 40 165 Q 28 200 20 240"
        fill="none" stroke="#876A36" stroke-width="1.1" opacity="0.55"/>
  <!-- 우 팔 (대칭) -->
  <path d="M 135 110 Q 150 130 160 165 Q 172 200 180 240"
        fill="none" stroke="#876A36" stroke-width="1.1" opacity="0.55"/>
  <!-- 좌 다리 -->
  <path d="M 80 290 Q 78 350 80 410 Q 82 450 82 482"
        fill="none" stroke="#876A36" stroke-width="1.1" opacity="0.55"/>
  <!-- 우 다리 -->
  <path d="M 120 290 Q 122 350 120 410 Q 118 450 118 482"
        fill="none" stroke="#876A36" stroke-width="1.1" opacity="0.55"/>
  <!-- 좌 손 -->
  <circle cx="20" cy="246" r="4" fill="none" stroke="#876A36" stroke-width="1.1" opacity="0.55"/>
  <!-- 우 손 -->
  <circle cx="180" cy="246" r="4" fill="none" stroke="#876A36" stroke-width="1.1" opacity="0.55"/>
  <!-- 좌 발 -->
  <ellipse cx="82" cy="488" rx="9" ry="4" fill="none" stroke="#876A36" stroke-width="1.1" opacity="0.55"/>
  <!-- 우 발 -->
  <ellipse cx="118" cy="488" rx="9" ry="4" fill="none" stroke="#876A36" stroke-width="1.1" opacity="0.55"/>
`;

// SVG defs (gradient + filter)
const SVG_DEFS = `
  <defs>
    <radialGradient id="v99-pt-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#FFE08A" stop-opacity="1"/>
      <stop offset="40%" stop-color="#FFB44A" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#9C3030" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="v99-pt-full" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="30%" stop-color="#FFE08A" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#C9A227" stop-opacity="0"/>
    </radialGradient>
    <filter id="v99-glow-soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.6"/>
    </filter>
  </defs>
`;

// ─── 점 좌표 계산 — SVG getPointAtLength 활용 ──────────────────────────
function _layoutPoints(svgEl){
  // 임시 path 를 SVG 안에 attach → getTotalLength → t 별로 getPointAtLength
  const ns = 'http://www.w3.org/2000/svg';
  const merids = getMeridians();
  const all = [];
  for(const m of merids){
    const tmp = document.createElementNS(ns, 'path');
    tmp.setAttribute('d', m.path);
    tmp.style.visibility = 'hidden';
    svgEl.appendChild(tmp);
    let len;
    try{ len = tmp.getTotalLength(); }catch(_){ len = 0; }
    if(!len){
      // fallback: skip 좌표 (drag-to-canvas 오류시 0 반환)
      svgEl.removeChild(tmp);
      for(const pt of m.points) all.push({ ...pt, color: m.color, x: 100, y: 250 });
      continue;
    }
    for(let i = 0; i < m.count; i++){
      const t = m.count === 1 ? 0.5 : i / (m.count - 1);
      const p = tmp.getPointAtLength(t * len);
      all.push({ ...m.points[i], color: m.color, x: p.x, y: p.y });
    }
    svgEl.removeChild(tmp);
  }
  // globalOrder 로 sort (이미 그 순서지만 보장)
  all.sort((a, b) => a.globalOrder - b.globalOrder);
  return all;
}

// ─── 메인 SVG 빌더 ────────────────────────────────────────────────────
function _buildSVG(prog){
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.maxHeight = '64vh';
  svg.style.display = 'block';
  svg.style.margin = '0 auto';

  // defs
  const defs = document.createElementNS(ns, 'g');
  defs.innerHTML = SVG_DEFS;
  svg.appendChild(defs);

  // 인체 outline
  const outline = document.createElementNS(ns, 'g');
  outline.setAttribute('class', 'v99-body-outline');
  outline.innerHTML = BODY_OUTLINE_SVG;
  svg.appendChild(outline);

  // 경맥 path (faint background)
  for(const m of getMeridians()){
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', m.path);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', m.color);
    p.setAttribute('stroke-width', '0.6');
    p.setAttribute('opacity', '0.18');
    p.setAttribute('stroke-linecap', 'round');
    svg.appendChild(p);
  }

  // 점 배치
  const all = _layoutPoints(svg);

  // halos (점등된 것만) — 별도 group 으로 한 번에
  const haloG = document.createElementNS(ns, 'g');
  haloG.setAttribute('class', 'v99-halos');
  svg.appendChild(haloG);

  // 점 본체
  const ptG = document.createElementNS(ns, 'g');
  ptG.setAttribute('class', 'v99-points');
  svg.appendChild(ptG);

  all.forEach((pt, i) => {
    const isLit = i < prog.lit;
    const isRecent = isLit && (i >= prog.lit - 5);
    // halo
    if(isLit){
      const halo = document.createElementNS(ns, 'circle');
      halo.setAttribute('cx', pt.x.toFixed(2));
      halo.setAttribute('cy', pt.y.toFixed(2));
      halo.setAttribute('r', prog.full ? '4.5' : '3.5');
      halo.setAttribute('fill', prog.full ? 'url(#v99-pt-full)' : 'url(#v99-pt-glow)');
      halo.setAttribute('opacity', '0.85');
      if(isRecent) halo.setAttribute('class', 'v99-pt-recent');
      haloG.appendChild(halo);
    }
    // point body
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', pt.x.toFixed(2));
    c.setAttribute('cy', pt.y.toFixed(2));
    c.setAttribute('r', isLit ? '1.4' : '0.9');
    c.setAttribute('fill', isLit ? '#FFE08A' : pt.color);
    c.setAttribute('opacity', isLit ? '1' : '0.32');
    c.setAttribute('data-id', pt.id);
    c.setAttribute('data-han', pt.han);
    c.setAttribute('data-ko', pt.ko || '');
    c.setAttribute('data-mer', pt.meridianHan || '');
    c.style.cursor = 'pointer';
    ptG.appendChild(c);
  });

  if(prog.full) svg.setAttribute('class', 'v99-body-svg v99-body-full');
  else svg.setAttribute('class', 'v99-body-svg');

  return svg;
}

// ─── CSS ───────────────────────────────────────────────────────────────
function _injectCSS(){
  if(document.getElementById('v99-meridian-css')) return;
  const st = document.createElement('style');
  st.id = 'v99-meridian-css';
  st.textContent = `
    @keyframes v99PtRecent {
      0%, 100% { opacity: 0.55; transform: scale(0.85); }
      50%      { opacity: 1;    transform: scale(1.18); }
    }
    .v99-pt-recent {
      transform-box: fill-box;
      transform-origin: center;
      animation: v99PtRecent 1.6s ease-in-out infinite;
    }
    @keyframes v99FullAura {
      0%, 100% { filter: drop-shadow(0 0 6px #FFE08A) drop-shadow(0 0 14px #C9A227); }
      50%      { filter: drop-shadow(0 0 16px #FFFFFF) drop-shadow(0 0 32px #FFE08A); }
    }
    .v99-body-full {
      animation: v99FullAura 2.6s ease-in-out infinite;
    }
    .v99-body-wrap {
      background: radial-gradient(ellipse at center, #1A1208 0%, #0A0703 100%);
      border-radius: 8px;
      padding: 6px;
      position: relative;
      overflow: hidden;
    }
    .v99-body-wrap.full {
      box-shadow: 0 0 20px #FFE08A66, inset 0 0 18px #C9A22755;
      background: radial-gradient(ellipse at center, #281A0A 0%, #0E0905 100%);
    }
    @keyframes v99EssencePulse {
      0%, 100% {
        box-shadow: 0 0 6px #FFE08A, 0 0 14px #C9A22788, inset 0 0 4px #FFFFFF99;
      }
      50% {
        box-shadow: 0 0 14px #FFFFFF, 0 0 30px #FFE08AAA, inset 0 0 7px #FFFFFFCC;
      }
    }
    @keyframes v99EssenceShine {
      0%   { background-position: -100% 0; }
      100% { background-position:  200% 0; }
    }
    .v99-medal-essence {
      position: relative;
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; flex-shrink: 0;
      background:
        linear-gradient(120deg, transparent 30%, #FFFFFF99 50%, transparent 70%) 0 0 / 200% 100%,
        radial-gradient(circle at 35% 30%, #FFFFFFCC 0%, transparent 40%),
        radial-gradient(circle, #FFE08A 0%, #C9A227 55%, #9C3030 100%);
      background-blend-mode: overlay, normal, normal;
      border-radius: 50%;
      font-family: 'ZCOOL XiaoWei', serif;
      font-size: 14px; font-weight: 700; color: #1C140A;
      cursor: pointer;
      border: 1.5px solid #FFE08A;
      vertical-align: middle;
      animation:
        v99EssencePulse 2.4s ease-in-out infinite,
        v99EssenceShine 3.6s linear infinite;
      text-shadow: 0 0 3px #FFFFFFAA;
      z-index: 2;
    }
    .v99-medal-essence:hover {
      transform: scale(1.1);
      transition: transform 0.15s ease;
    }
    .v99-medal-essence.in-sealist {
      width: 32px; height: 32px; font-size: 16px;
      margin: 2px 4px;
    }
  `;
  document.head.appendChild(st);
}

// ─── 모달 ──────────────────────────────────────────────────────────────
function open(){
  _injectCSS();
  const prog = progress();
  const meridians = getMeridians();

  // 진척 단계 텍스트
  const stage = (() => {
    if(prog.full) return '<b style="color:var(--zhusha-d)">通明 達成</b> — 361혈 모두 밝힘';
    if(prog.lit < 62)  return '<b class="han">足三陰</b> — 다리 안쪽 (腎·肝·脾)';
    if(prog.lit < 218) return '<b class="han">足三陽</b> — 다리 바깥·뒤 (胃·膽·膀胱)';
    if(prog.lit < 270) return '<b class="han">任督</b> — 몸통 중축 (任脈·督脈)';
    if(prog.lit < 299) return '<b class="han">手三陰</b> — 팔 안쪽 (肺·心·心包)';
    return '<b class="han">手三陽</b> — 팔 바깥 (大腸·三焦·小腸)';
  })();

  // 경맥별 lit 카운트
  const merCounts = [];
  let g = 0;
  for(const m of meridians){
    const litInM = Math.max(0, Math.min(m.count, prog.lit - g));
    merCounts.push({ ...m, litInM });
    g += m.count;
  }

  const meridianGrid = merCounts.map(m => {
    const isDone = m.litInM === m.count;
    const pctM = m.litInM / m.count;
    return `
      <div style="padding:5px 6px;border-radius:5px;border:1px solid ${m.color}55;background:${m.color}${isDone ? '22' : '0A'};font-size:10.5px;display:flex;align-items:center;gap:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:${m.color};flex-shrink:0;box-shadow:${isDone ? `0 0 6px ${m.color}` : 'none'}"></span>
        <span class="han" style="font-weight:700;color:var(--mo);font-size:11px">${m.han}</span>
        <span style="margin-left:auto;color:var(--gutong);font-variant-numeric:tabular-nums">${m.litInM}/${m.count}</span>
      </div>
    `;
  }).join('');

  const html = `
    <h3 style="margin:0;font-family:'ZCOOL XiaoWei',serif;color:var(--zhusha-d);font-size:18px">
      <span class="han">經絡 ・ 361穴</span>
      ${prog.full ? '<span class="han" style="margin-left:8px;color:#C9A227;font-size:13px;text-shadow:0 0 6px #FFE08A">通明</span>' : ''}
    </h3>
    <div style="font-size:11px;color:var(--gutong);margin-top:2px">
      ${prog.lit}/${prog.total}혈 점등 · 氣 ${prog.qi}/${prog.totalQi}
      ${prog.full ? '' : ` · 다음 혈까지 <b style="color:var(--zhusha-d)">${prog.next}氣</b>`}
    </div>

    <div id="v99-body-wrap" class="v99-body-wrap${prog.full ? ' full' : ''}" style="margin-top:8px"></div>

    <!-- 진척 바 -->
    <div style="margin-top:8px;background:rgba(135,106,54,0.08);border-radius:6px;height:8px;overflow:hidden;border:1px solid rgba(135,106,54,0.3)">
      <div style="height:100%;width:${(prog.pct*100).toFixed(1)}%;background:linear-gradient(90deg, #C9A227 0%, #FFE08A 100%);transition:width 0.6s ease"></div>
    </div>

    <div style="margin-top:6px;font-size:11px;color:var(--mo-l);text-align:center">
      현재 단계: ${stage}
    </div>

    <!-- 14경맥 진척 grid -->
    <details style="margin-top:10px">
      <summary style="font-size:11px;color:var(--gutong);cursor:pointer;font-weight:600">14經脈 點燈 內譯</summary>
      <div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:3px">
        ${meridianGrid}
      </div>
    </details>

    <div style="margin-top:8px;font-size:10px;color:var(--gutong);line-height:1.55;text-align:center">
      <span class="han">足三陰 → 足三陽 → 任督 → 手三陰 → 手三陽</span>
      <br/>혈자리를 클릭하면 이름이 표시됩니다
    </div>

    ${prog.full ? `
      <div style="margin-top:10px;padding:8px;background:linear-gradient(135deg,#1C140A,#2A1E10);border-radius:6px;border:1px solid #FFE08A;text-align:center">
        <div class="han" style="font-size:16px;color:#FFE08A;font-weight:700;text-shadow:0 0 6px #C9A227">通明</div>
        <div style="font-size:10.5px;color:#C9A227;margin-top:2px">메달리온 옆에 通 印이 부착되었습니다</div>
      </div>
    ` : `
      <div style="margin-top:10px;font-size:10.5px;color:var(--mo-l);line-height:1.5">
        3,610氣를 모두 모으면 <b class="han" style="color:var(--zhusha-d)">通明</b> 업적 — 메달리온 옆 通 印 영구 부착.
      </div>
    `}
  `;

  if(window.openModal) window.openModal(html);

  // SVG 렌더 (DOM attach 후에야 getPointAtLength 작동)
  setTimeout(() => {
    const wrap = document.getElementById('v99-body-wrap');
    if(!wrap) return;
    const svg = _buildSVG(prog);
    wrap.appendChild(svg);
    // 혈자리 클릭 → toast
    svg.addEventListener('click', e => {
      const t = e.target;
      if(!t || !t.dataset || !t.dataset.id) return;
      const id  = t.dataset.id;
      const han = t.dataset.han || '';
      const ko  = t.dataset.ko || '';
      const mer = t.dataset.mer || '';
      const msg = `${id} ${han}${ko ? ' (' + ko + ')' : ''}${mer ? ' · ' + mer : ''}`;
      try{ window.toast && window.toast(msg, 'gold'); }catch(_){}
    });
  }, 50);
}

// ─── 通明 업적 unlock 검사 ────────────────────────────────────────────
function isUnlocked(){
  const s = window.S; if(!s) return false;
  return !!s.essenceUnlocked;
}

function _checkAndUnlock(){
  const s = window.S; if(!s) return;
  // 마이그레이션
  if(typeof s.essenceUnlocked === 'undefined') s.essenceUnlocked = false;
  if(typeof s.essenceUnlockedAt === 'undefined') s.essenceUnlockedAt = 0;
  const prog = progress();
  if(prog.full && !s.essenceUnlocked){
    s.essenceUnlocked = true;
    s.essenceUnlockedAt = Date.now();
    try{ window.saveState && window.saveState(); }catch(_){}
    try{ window.toast && window.toast('通明 業績 達成 — 361穴 모두 밝힘', 'gold'); }catch(_){}
    // 가능하면 효과음
    try{
      if(window.bgm){
        if(window.bgm.sfxAchievement) window.bgm.sfxAchievement();
        else if(window.bgm.sfxCorrect) window.bgm.sfxCorrect();
      }
    }catch(_){}
    // 메달리온 즉시 갱신
    setTimeout(_injectMedallion, 100);
  }
}

// ─── 메달리온 印 부착 ──────────────────────────────────────────────────
// V97 메달리온 영역(.v97-medallion, .medallion-frame, [data-medallion]),
// 인장 大廳(.v97-seals, .seal-list, [data-seals="list"]),
// 그리고 hello-card 의 도장 영역에 「通」 印 부착.
function _injectMedallion(){
  if(!isUnlocked()) return;
  _injectCSS();

  // 1) 메달리온 컨테이너
  const medSel = '.v97-medallion, .medallion-frame, [data-medallion="user"]';
  document.querySelectorAll(medSel).forEach(el => {
    if(el.querySelector('.v99-medal-essence')) return;
    const badge = _makeBadge();
    // 절대 위치로 우상단 부착 — 기존 메달 시각 방해 최소화
    badge.style.position = 'absolute';
    badge.style.top = '-6px';
    badge.style.right = '-6px';
    // 컨테이너가 static 이면 relative 로
    const cs = getComputedStyle(el);
    if(cs.position === 'static') el.style.position = 'relative';
    el.appendChild(badge);
  });

  // 2) 인장 大廳 리스트
  const seSel = '.v97-seals, .seal-list, [data-seals="list"]';
  document.querySelectorAll(seSel).forEach(el => {
    if(el.querySelector('.v99-medal-essence')) return;
    const badge = _makeBadge();
    badge.classList.add('in-sealist');
    // 인장 리스트는 inline-flex 가정 — 맨 앞에 자랑 위치
    if(el.firstChild) el.insertBefore(badge, el.firstChild);
    else el.appendChild(badge);
  });
}

function _makeBadge(){
  const badge = document.createElement('span');
  badge.className = 'v99-medal-essence han';
  badge.textContent = '通';
  badge.title = '通明 — 361혈 모두 밝힘 (3,610氣)';
  badge.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    open();
  });
  return badge;
}

// ─── 프로필 클릭 후크 ──────────────────────────────────────────────────
// 자기 클릭으로 모달 열기.
function _attachClicks(){
  // 한 번만 attach
  if(document.body.dataset.v99BodyClick === '1') return;
  document.body.dataset.v99BodyClick = '1';

  document.body.addEventListener('click', e => {
    const t = e.target;
    if(!t || !t.closest) return;
    // 메달리온 自체
    if(t.closest('.v97-medallion, .medallion-frame, [data-medallion="user"]')){
      // 이미 V97 메달리온 클릭 핸들러가 있을 수 있음 — 작동 차이 보호
      // 단, 通 印 자체 클릭은 별도 핸들러로 이미 처리됨
      if(t.classList.contains('v99-medal-essence')) return;
      // V97 가 자체 모달 띄우는 경우 회피 — modal 이 이미 열려있으면 skip
      if(document.querySelector('#modal-slot > *:not(#v99-body-wrap):not(.v99-medal-essence)')) return;
      // hello-card 또는 메달리온 단순 클릭 → 통명 모달
      open();
      return;
    }
    // 사용자 이름(프로필) 영역
    if(t.closest('#profile-name, .profile-name, [data-action="profile"], #hello-name-row')){
      if(document.querySelector('#modal-slot > *')) return;
      open();
    }
  }, false);
}

// ─── 디버그 ────────────────────────────────────────────────────────────
function _debugReset(){
  const s = window.S; if(!s) return;
  s.essenceUnlocked = false;
  s.essenceUnlockedAt = 0;
  try{ window.saveState && window.saveState(); }catch(_){}
  document.querySelectorAll('.v99-medal-essence').forEach(b => b.remove());
  try{ console.log('[V99Body] essence unlock RESET'); }catch(_){}
}

// ─── 부팅 ──────────────────────────────────────────────────────────────
function _observe(){
  const v = document.getElementById('view');
  if(!v){ setTimeout(_observe, 400); return; }
  _injectCSS();
  // 데이터 검증 (console only)
  try{
    const tot = totalPoints();
    if(tot !== TOTAL_POINTS){
      console.warn(`[V99Body] 데이터 검증: ${tot}혈 (예상 ${TOTAL_POINTS}). POINT_NAMES 누락/오타.`);
    }
  }catch(_){}
  // 뷰 변경 시 메달리온 재부착·unlock 검사 — 자기 자신 mutation 무시 + throttle
  let _t = null;
  const obs = new MutationObserver(records => {
    // 우리가 추가한 v99-medal-essence 변경만 있으면 skip
    let external = false;
    for(const r of records){
      const tgt = r.target;
      if(!tgt) continue;
      if(tgt.classList && tgt.classList.contains('v99-medal-essence')) continue;
      if(tgt.closest && tgt.closest('.v99-medal-essence')) continue;
      // 자기 모달 내부 변경도 skip
      if(tgt.closest && tgt.closest('#v99-body-wrap')) continue;
      external = true; break;
    }
    if(!external) return;
    if(_t) return;
    _t = setTimeout(() => {
      _t = null;
      try{ _checkAndUnlock(); _injectMedallion(); }catch(_){}
    }, 500);
  });
  obs.observe(document.body, { childList: true, subtree: true });
  // 초기 시도
  setTimeout(() => {
    _checkAndUnlock();
    _injectMedallion();
    _attachClicks();
  }, 700);
}

if(document.readyState !== 'loading') setTimeout(_observe, 500);
else document.addEventListener('DOMContentLoaded', () => setTimeout(_observe, 500));

// ─── 외부 노출 ─────────────────────────────────────────────────────────
window.V99Body = {
  open,
  progress,
  isUnlocked,
  getMeridians,
  totalPoints,
  TOTAL_POINTS,
  QI_PER_POINT,
  TOTAL_QI,
  _refreshMedallion: _injectMedallion,
  _checkAndUnlock,
  _debugReset,
};
})();
