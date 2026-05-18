/* data-jingxue-poker.js — 經穴 포커 v12.0
 * ============================================================================
 * 카드 덱 124장 + 14단계 족보 + 평가기 + 확률표.
 * 외부 노출: window.JINGXUE_POKER = { DECK, HANDS, evaluateHand, dealHand, ... }
 *
 * 출처: 韓醫科大學 經穴學 표준 (대한경혈학회) · WHO 2008 STandard · 黃帝內經
 * ============================================================================ */
(function(){
'use strict';

// ─── 메타 ─────────────────────────────────────────────────────────────────
const YIN  = ['LU','SP','HT','KI','PC','LR'];
const YANG = ['LI','ST','SI','BL','TE','GB'];
const MERIDIAN_HAN = {
  LU:'肺', LI:'大腸', ST:'胃', SP:'脾', HT:'心', SI:'小腸',
  BL:'膀胱', KI:'腎', PC:'心包', TE:'三焦', GB:'膽', LR:'肝',
  CV:'任脈', GV:'督脈',
};
const MERIDIAN_KO = {
  LU:'폐', LI:'대장', ST:'위', SP:'비', HT:'심', SI:'소장',
  BL:'방광', KI:'신', PC:'심포', TE:'삼초', GB:'담', LR:'간',
  CV:'임맥', GV:'독맥',
};
const MERIDIAN_COLOR = {
  LU:'#D1B080', LI:'#D17A30', ST:'#9C3030', SP:'#C9A227',
  HT:'#882020', SI:'#7A1F1F', BL:'#214966', KI:'#1B3A55',
  PC:'#5C3060', TE:'#4A4A4A', GB:'#6B4FA8', LR:'#2E5E3D',
  CV:'#C8923A', GV:'#3A2D14',
};

// 표리경 짝 (原-絡 매칭용)
const EI_PAIR = {
  LU:'LI', LI:'LU', SP:'ST', ST:'SP', HT:'SI', SI:'HT',
  KI:'BL', BL:'KI', PC:'TE', TE:'PC', LR:'GB', GB:'LR',
};

// ─── 五輸穴 / 特定要穴 raw (data-acupoints.js 와 일치) ───────────────────
const SHU_RAW = {
  LU:['少商','魚際','太淵','經渠','尺澤'],
  LI:['商陽','二間','三間','陽谿','曲池'],
  ST:['厲兌','內庭','陷谷','解谿','足三里'],
  SP:['隱白','大都','太白','商丘','陰陵泉'],
  HT:['少衝','少府','神門','靈道','少海'],
  SI:['少澤','前谷','後谿','陽谷','小海'],
  BL:['至陰','足通谷','束骨','崑崙','委中'],
  KI:['湧泉','然谷','太谿','復溜','陰谷'],
  PC:['中衝','勞宮','大陵','間使','曲澤'],
  TE:['關衝','液門','中渚','支溝','天井'],
  GB:['足竅陰','俠谿','足臨泣','陽輔','陽陵泉'],
  LR:['大敦','行間','太衝','中封','曲泉'],
};
const SPECIAL_RAW = {
  // [원, 락, 극, 모, 배수]
  LU:['太淵','列缺','孔最','中府','肺兪'],
  LI:['合谷','偏歷','溫溜','天樞','大腸兪'],
  ST:['衝陽','豐隆','梁丘','中脘','胃兪'],
  SP:['太白','公孫','地機','章門','脾兪'],
  HT:['神門','通里','陰郄','巨闕','心兪'],
  SI:['腕骨','支正','養老','關元','小腸兪'],
  BL:['京骨','飛揚','金門','中極','膀胱兪'],
  KI:['太谿','大鍾','水泉','京門','腎兪'],
  PC:['大陵','內關','郄門','膻中','厥陰兪'],
  TE:['陽池','外關','會宗','石門','三焦兪'],
  GB:['丘墟','光明','外丘','日月','膽兪'],
  LR:['太衝','蠡溝','中都','期門','肝兪'],
};
const VESSEL_RAW = {
  CV: ['關元','氣海','神闕','中脘','膻中'],
  GV: ['長強','命門','大椎','百會','水溝'],
};

const KO_HINT = {
  '少商':'소상','魚際':'어제','太淵':'태연','經渠':'경거','尺澤':'척택',
  '商陽':'상양','二間':'이간','三間':'삼간','陽谿':'양계','曲池':'곡지',
  '厲兌':'여태','內庭':'내정','陷谷':'함곡','解谿':'해계','足三里':'족삼리',
  '隱白':'은백','大都':'대도','太白':'태백','商丘':'상구','陰陵泉':'음릉천',
  '少衝':'소충','少府':'소부','神門':'신문','靈道':'영도','少海':'소해',
  '少澤':'소택','前谷':'전곡','後谿':'후계','陽谷':'양곡','小海':'소해',
  '至陰':'지음','足通谷':'족통곡','束骨':'속골','崑崙':'곤륜','委中':'위중',
  '湧泉':'용천','然谷':'연곡','太谿':'태계','復溜':'부류','陰谷':'음곡',
  '中衝':'중충','勞宮':'노궁','大陵':'대릉','間使':'간사','曲澤':'곡택',
  '關衝':'관충','液門':'액문','中渚':'중저','支溝':'지구','天井':'천정',
  '足竅陰':'족규음','俠谿':'협계','足臨泣':'족임읍','陽輔':'양보','陽陵泉':'양릉천',
  '大敦':'대돈','行間':'행간','太衝':'태충','中封':'중봉','曲泉':'곡천',
  '列缺':'열결','孔最':'공최','中府':'중부','肺兪':'폐수',
  '合谷':'합곡','偏歷':'편력','溫溜':'온류','天樞':'천추','大腸兪':'대장수',
  '衝陽':'충양','豐隆':'풍륭','梁丘':'양구','中脘':'중완','胃兪':'위수',
  '公孫':'공손','地機':'지기','章門':'장문','脾兪':'비수',
  '通里':'통리','陰郄':'음극','巨闕':'거궐','心兪':'심수',
  '腕骨':'완골','支正':'지정','養老':'양로','關元':'관원','小腸兪':'소장수',
  '京骨':'경골','飛揚':'비양','金門':'금문','中極':'중극','膀胱兪':'방광수',
  '大鍾':'대종','水泉':'수천','京門':'경문','腎兪':'신수',
  '內關':'내관','郄門':'극문','膻中':'전중','厥陰兪':'궐음수',
  '陽池':'양지','外關':'외관','會宗':'회종','石門':'석문','三焦兪':'삼초수',
  '丘墟':'구허','光明':'광명','外丘':'외구','日月':'일월','膽兪':'담수',
  '蠡溝':'여구','中都':'중도','期門':'기문','肝兪':'간수',
  '氣海':'기해','神闕':'신궐','長強':'장강','命門':'명문',
  '大椎':'대추','百會':'백회','水溝':'수구',
};

// 五輸穴 役割 (역할명만 — 음경/양경의 五行 차이는 카드 메타로만 보관)
const SHU_ROLES = ['井','滎','輸','經','合'];
const SHU_ROLE_KO = {'井':'정','滎':'형','輸':'수','經':'경','合':'합'};
// 음경/양경 五行
const SHU_ELEMENT_YIN  = ['木','火','土','金','水'];  // 井=木 (음경)
const SHU_ELEMENT_YANG = ['金','水','木','火','土'];  // 井=金 (양경)
const SPEC_ROLES = ['原','絡','郄','募','背輸'];
const SPEC_ROLE_KO = {'原':'원','絡':'락','郄':'극','募':'모','背輸':'배수'};

// ─── 카드 덱 빌드 ─────────────────────────────────────────────────────────
const DECK = [];

// 1) 12 정경 × 五輸穴 5장
for(const m of [...YIN, ...YANG]){
  const elems = YIN.includes(m) ? SHU_ELEMENT_YIN : SHU_ELEMENT_YANG;
  SHU_RAW[m].forEach((han, i) => {
    DECK.push({
      id: `${m}-${SHU_ROLES[i]}`,
      han, ko: KO_HINT[han] || '',
      mer: m, mer_han: MERIDIAN_HAN[m], mer_ko: MERIDIAN_KO[m],
      mer_color: MERIDIAN_COLOR[m],
      role: SHU_ROLES[i], role_ko: SHU_ROLE_KO[SHU_ROLES[i]],
      role_kind: 'shu',
      element: elems[i],
      yin_yang: YIN.includes(m) ? 'yin' : 'yang',
      organ_pair: m,
      ei_pair: EI_PAIR[m],
    });
  });
}

// 2) 양경 6 × 原穴 (음경의 原 = 輸 동일 — 별도 발행 X)
for(const m of YANG){
  const han = SPECIAL_RAW[m][0];   // [0] = 原
  DECK.push({
    id: `${m}-原`,
    han, ko: KO_HINT[han] || '',
    mer: m, mer_han: MERIDIAN_HAN[m], mer_ko: MERIDIAN_KO[m],
    mer_color: MERIDIAN_COLOR[m],
    role: '原', role_ko: '원', role_kind: 'spec',
    element: '-', yin_yang: 'yang',
    organ_pair: m, ei_pair: EI_PAIR[m],
  });
}

// 3) 12 정경 × 絡·郄·募·背輸 (4종) = 48장
const SPEC_4 = [
  {idx:1, role:'絡'}, {idx:2, role:'郄'},
  {idx:3, role:'募'}, {idx:4, role:'背輸'}
];
for(const m of [...YIN, ...YANG]){
  for(const s of SPEC_4){
    const han = SPECIAL_RAW[m][s.idx];
    DECK.push({
      id: `${m}-${s.role}`,
      han, ko: KO_HINT[han] || '',
      mer: m, mer_han: MERIDIAN_HAN[m], mer_ko: MERIDIAN_KO[m],
      mer_color: MERIDIAN_COLOR[m],
      role: s.role, role_ko: SPEC_ROLE_KO[s.role], role_kind: 'spec',
      element: '-', yin_yang: YIN.includes(m) ? 'yin' : 'yang',
      organ_pair: m, ei_pair: EI_PAIR[m],
    });
  }
}

// 4) 任·督脈 각 5장
for(const m of ['CV','GV']){
  const role_tag = m === 'CV' ? '任' : '督';
  const role_ko_tag = m === 'CV' ? '임' : '독';
  VESSEL_RAW[m].forEach((han, i) => {
    DECK.push({
      id: `${m}-${i+1}`,
      han, ko: KO_HINT[han] || '',
      mer: m, mer_han: MERIDIAN_HAN[m], mer_ko: MERIDIAN_KO[m],
      mer_color: MERIDIAN_COLOR[m],
      role: role_tag, role_ko: role_ko_tag, role_kind: 'vessel',
      element: '-', yin_yang: 'mid',
      organ_pair: m, ei_pair: null,
    });
  });
}

// ─── 족보 정의 ─────────────────────────────────────────────────────────────
// 우선순위 (낮을수록 약함, 14가 최강)
const HANDS = [
  { rank:1,  key:'high',           ko:'하이카드',   han:'高位',     prob:0.3698, oneIn:'2.7',     desc:'조합 없음' },
  { rank:2,  key:'pair',           ko:'원페어',     han:'一對',     prob:0.4634, oneIn:'2.2',     desc:'같은 役割 2장' },
  { rank:3,  key:'two_pair',       ko:'투페어',     han:'兩對',     prob:0.0772, oneIn:'13',      desc:'다른 役割의 페어 2개' },
  { rank:4,  key:'three',          ko:'쓰리카드',   han:'三同',     prob:0.0499, oneIn:'20',      desc:'같은 役割 3장' },
  { rank:5,  key:'ei_origin_link', ko:'표리원락',   han:'表裏原絡', prob:0.0154, oneIn:'65',      desc:'★ 표리경 짝의 原+絡 — 經絡 配伍의 古典' },
  { rank:6,  key:'mu_shu',         ko:'모수대응',   han:'募兪相應', prob:0.0157, oneIn:'64',      desc:'★ 같은 장부의 募穴+背輸穴 — 募兪相應法' },
  { rank:7,  key:'fullhouse',      ko:'풀하우스',   han:'三二',     prob:0.0050, oneIn:'199',     desc:'트리플 + 페어' },
  { rank:8,  key:'four',           ko:'포카드',     han:'四同',     prob:0.0023, oneIn:'438',     desc:'같은 役割 4장' },
  { rank:9,  key:'straight',       ko:'스트레이트', han:'五輸序',   prob:0.0011, oneIn:'898',     desc:'井·滎·輸·經·合 5장 (경락 무관)' },
  { rank:10, key:'five',           ko:'파이브카드', han:'五同',     prob:0.000043,oneIn:'23,256',  desc:'같은 役割 5장' },
  { rank:11, key:'six_fu_he',      ko:'육부하합',   han:'六腑下合', prob:0.000026,oneIn:'38,462',  desc:'★ ST合·GB合·BL合 모두 포함 — 六腑下合穴' },
  { rank:12, key:'flush',          ko:'플러시',     han:'一經',     prob:0.000009,oneIn:'111,111', desc:'같은 經 5장' },
  { rank:13, key:'straight_flush', ko:'스트플러시', han:'一經五輸', prob:5.9e-7,  oneIn:'1.7M',    desc:'★ 같은 經의 井滎輸經合 5장' },
  { rank:14, key:'royal',          ko:'성수침경',   han:'聖手鍼經', prob:4.4e-9,  oneIn:'225M',    desc:'★★ 폐경 五輸 5장 — 천하 제일' },
];
const HAND_RANK_BY_KEY = {};
HANDS.forEach(h => { HAND_RANK_BY_KEY[h.key] = h; });

// ─── 핸드 평가 ────────────────────────────────────────────────────────────
function _roleCount(hand){
  const c = {};
  for(const card of hand) c[card.role] = (c[card.role]||0)+1;
  return c;
}
function _merCount(hand){
  const c = {};
  for(const card of hand) c[card.mer] = (c[card.mer]||0)+1;
  return c;
}
const SHU_ROLE_SET = new Set(['井','滎','輸','經','合']);
function _hasAllShuRoles(h){
  if(h.length !== 5) return false;
  const roles = new Set(h.map(c => c.role));
  if(roles.size !== 5) return false;
  for(const r of SHU_ROLE_SET) if(!roles.has(r)) return false;
  return true;
}
function _isRoyal(h){
  if(h.length !== 5) return false;
  if(h.some(c => c.mer !== 'LU')) return false;
  return _hasAllShuRoles(h);
}
function _isStraightFlush(h){
  if(h.length !== 5) return false;
  const ms = new Set(h.map(c => c.mer));
  if(ms.size !== 1) return false;
  const m = h[0].mer;
  if(!YIN.includes(m) && !YANG.includes(m)) return false;
  return _hasAllShuRoles(h);
}
function _isFlush(h){
  if(h.length !== 5) return false;
  const ms = new Set(h.map(c => c.mer));
  return ms.size === 1;
}
function _isSixFuHe(h){
  // ST合·GB合·BL合 모두 포함
  const need = new Set();
  for(const c of h){
    if(c.role === '合' && (c.mer === 'ST' || c.mer === 'GB' || c.mer === 'BL'))
      need.add(c.mer);
  }
  return need.size >= 3;
}
function _isMuShu(h){
  const muOrg = new Set(), shuOrg = new Set();
  for(const c of h){
    if(c.role === '募')   muOrg.add(c.organ_pair);
    if(c.role === '背輸') shuOrg.add(c.organ_pair);
  }
  for(const o of muOrg) if(shuOrg.has(o)) return true;
  return false;
}
function _isEiOriginLink(h){
  // 한 경락 原(또는 음경 輸=原) + 그 표리경 絡
  const yuanMers = new Set(), luoMers = new Set();
  for(const c of h){
    if(c.role === '原') yuanMers.add(c.mer);
    if(c.role === '輸' && YIN.includes(c.mer)) yuanMers.add(c.mer);  // 음경 輸 = 原
    if(c.role === '絡') luoMers.add(c.mer);
  }
  for(const ym of yuanMers){
    if(luoMers.has(EI_PAIR[ym])) return true;
  }
  return false;
}
function _isStraight(h){
  if(h.length !== 5) return false;
  return _hasAllShuRoles(h);
}

function evaluateHand(hand){
  if(!hand || hand.length === 0) return HAND_RANK_BY_KEY.high;
  // 7장이면 5장 best 선택 — 조합 C(7,5)=21 모두 시도
  if(hand.length > 5){
    const combos = _combinations(hand, 5);
    let best = HAND_RANK_BY_KEY.high;
    for(const c of combos){
      const r = _evaluate5(c);
      if(r.rank > best.rank) best = r;
    }
    return best;
  }
  return _evaluate5(hand);
}
function _evaluate5(h){
  if(_isRoyal(h))          return HAND_RANK_BY_KEY.royal;
  if(_isStraightFlush(h))  return HAND_RANK_BY_KEY.straight_flush;
  if(_isFlush(h))          return HAND_RANK_BY_KEY.flush;
  if(_isSixFuHe(h))        return HAND_RANK_BY_KEY.six_fu_he;
  const rc = _roleCount(h);
  const counts = Object.values(rc).sort((a,b)=>b-a);
  if(counts[0] >= 5)       return HAND_RANK_BY_KEY.five;
  if(_isStraight(h))       return HAND_RANK_BY_KEY.straight;
  if(counts[0] === 4)      return HAND_RANK_BY_KEY.four;
  if(counts[0] === 3 && counts[1] === 2) return HAND_RANK_BY_KEY.fullhouse;
  if(_isMuShu(h))          return HAND_RANK_BY_KEY.mu_shu;
  if(_isEiOriginLink(h))   return HAND_RANK_BY_KEY.ei_origin_link;
  if(counts[0] === 3)      return HAND_RANK_BY_KEY.three;
  const pairs = counts.filter(c => c === 2).length;
  if(pairs >= 2)           return HAND_RANK_BY_KEY.two_pair;
  if(counts[0] === 2)      return HAND_RANK_BY_KEY.pair;
  return HAND_RANK_BY_KEY.high;
}

function _combinations(arr, k){
  const out = [];
  const n = arr.length;
  const idx = Array.from({length:k}, (_,i) => i);
  while(true){
    out.push(idx.map(i => arr[i]));
    let i = k - 1;
    while(i >= 0 && idx[i] === n - k + i) i--;
    if(i < 0) break;
    idx[i]++;
    for(let j = i+1; j < k; j++) idx[j] = idx[j-1] + 1;
  }
  return out;
}

// ─── 덱 셔플 & 분배 ───────────────────────────────────────────────────────
function shuffleDeck(seed){
  const d = DECK.slice();
  // Fisher–Yates
  for(let i = d.length-1; i > 0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function dealHand(deck, n){
  return deck.splice(0, n);
}

// ─── 비교 — 동일 족보 내 tiebreaker ───────────────────────────────────────
// 간단히: 經絡 우선순위 (LU=가장 강) + 役割 우선순위 (合 > 經 > 輸 > 滎 > 井)
const MER_PRIORITY  = ['LU','LI','SP','ST','HT','SI','KI','BL','PC','TE','LR','GB','CV','GV'];
const ROLE_PRIORITY = ['合','經','輸','滎','井','原','絡','郄','募','背輸','任','督'];

function compareHand(handA, handB){
  const ra = evaluateHand(handA), rb = evaluateHand(handB);
  if(ra.rank !== rb.rank) return ra.rank - rb.rank;
  // 동일 족보 — high card 기준
  const sortKey = (h) => h.map(c => {
    const mp = MER_PRIORITY.indexOf(c.mer);
    const rp = ROLE_PRIORITY.indexOf(c.role);
    return [mp, rp];
  }).sort((a,b) => a[0]-b[0] || a[1]-b[1])[0];
  const ka = sortKey(handA), kb = sortKey(handB);
  if(ka[0] !== kb[0]) return kb[0] - ka[0];   // LU가 우선
  return kb[1] - ka[1];                         // 合이 우선
}

// ─── AI 봇 의사결정 (단순 휴리스틱) ──────────────────────────────────────
function botDecideBet(myHand, potChips, myChips, minRaise){
  const rank = evaluateHand(myHand).rank;
  // 14단계 핸드 강도 → 베팅 확률
  if(rank >= 11) return { action:'raise', amount: Math.min(myChips, potChips) };       // 육부하합 이상 — all in
  if(rank >= 8)  return { action:'raise', amount: Math.min(myChips, Math.max(minRaise, Math.floor(potChips/2))) };
  if(rank >= 5)  return { action:'call',  amount: minRaise };
  if(rank >= 3)  return Math.random() < 0.6 ? { action:'call', amount: minRaise } : { action:'check', amount: 0 };
  return Math.random() < 0.3 ? { action:'call', amount: minRaise } : { action:'fold', amount: 0 };
}

// AI 봇 카드 교체 (파이브카드 드로우 — 1회 교체)
function botSwapCards(hand){
  // 페어/트리플 이상이 있으면 그 외 카드만 교체
  const rc = _roleCount(hand);
  const dominant = Object.entries(rc).sort((a,b) => b[1]-a[1])[0];
  if(dominant[1] >= 2){
    // dominant role 외 카드 교체
    return hand.map((c,i) => c.role === dominant[0] ? null : i).filter(x => x !== null);
  }
  // 페어 없음 — 가장 약한 3장 교체
  return [0, 1, 2];
}

// ─── 노출 ─────────────────────────────────────────────────────────────────
// HAND_KO map (key → {ko, han, prob, oneIn, desc})
const HAND_KO = {};
HANDS.forEach(h => { HAND_KO[h.key] = h; });

// cardLabel — UI 표시용 통일 함수
function cardLabel(c){
  if(!c) return '';
  // 五輸/特定要혈/任督 — 한자+한글+경락
  return `<div style="display:flex;flex-direction:column;align-items:center;line-height:1.1">
    <span style="font-family:'ZCOOL XiaoWei',serif;font-size:18px;color:${c.mer_color}">${c.han}</span>
    <span style="font-size:10px;color:#888">${c.mer_ko}·${c.role_ko}</span>
  </div>`;
}

// PROBABILITY_TABLE — 확률 강→약 순 (rulebook UI 용)
const PROBABILITY_TABLE = [...HANDS].sort((a,b) => a.prob - b.prob).map(h => ({
  key: h.key, prob_pct: h.prob * 100, one_in: h.oneIn,
}));

// HAND_RANKS — key → rank 번호
const HAND_RANKS = {};
HANDS.forEach(h => { HAND_RANKS[h.key] = h.rank; });

window.JINGXUE_POKER = {
  VERSION: '12.0',
  DECK,
  HANDS, HAND_RANK_BY_KEY, HAND_KO, HAND_RANKS,
  PROBABILITY_TABLE,
  MERIDIAN_HAN, MERIDIAN_KO, MERIDIAN_COLOR,
  evaluateHand,
  evaluate: evaluateHand,
  compareHand,
  shuffleDeck, dealHand,
  botDecideBet, botSwapCards,
  cardLabel,
};

console.log(`[經穴포커 v12.0] 덱 ${DECK.length}장 · 족보 ${HANDS.length}단계`);

})();
