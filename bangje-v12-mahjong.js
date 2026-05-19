/* bangje-v12-mahjong.js — 方劑麻雀 (방제마작) v12.5
 * ============================================================================
 * 마작 규칙을 한의학 방제학에 매핑한 카드 게임.
 *
 *  화료(和了) 조건:
 *   - 손패 안에 1개 처방의 본초 모두 포함
 *   - 그 본초 중 1개를 2장 보유 (君藥 雀頭) 또는 손패 안 본초 중 1개 2장
 *   - 손패 크기 = 7-8장 (시작 7, 뽑은 직후 8)
 *
 *  役 (점수):
 *   - 小方 (size 2-3): 1번
 *   - 中方 (size 4-5): 2-4번
 *   - 大方 (size 6-7): 8-16번 (役満)
 *
 *  진행:
 *   - 시작 7장 손패
 *   - 1턴: 1장 뽑기 → 화료 체크 → 화료면 종료, 아니면 1장 버리기
 *   - 30턴 안에 화료 못하면 무승부
 *
 *  외부 API: window.V12Mahjong = { open, createRoom, joinRoom, ... }
 *  의서궁 도구 영역에서 방미큐브 옆에 NEW 버튼으로 진입.
 *  Firebase: bangje_mahjong_rooms/{rid}
 *
 *  ※ 본 모듈은 방미큐브를 영구 대체하는 신규 게임 (v12.5에서 cube 영구 삭제).
 *     게임 형식: 마작 룰을 한의학 처방 학습에 매핑.
 * ============================================================================ */
(function(){
'use strict';

// v12.5.1: Firebase 보안 룰에 'bangje_mahjong_rooms' 노드 권한 추가 必要.
//   Console → Realtime Database → Rules 에서 아래 추가 (CHANGELOG_v12.5.1.md 참고):
//     "bangje_mahjong_rooms": { ".read": true, ".write": true }
const FB_NODE = 'bangje_mahjong_rooms';
const POLL_MS = 1500;
const TURN_SEC = 25;
const MIN_QI = 30;
const MAX_PLAYERS = 4;
const HAND_INIT = 7;
const HAND_MAX = 8;
const MAX_TURNS = 60;  // 무승부 한계

const $ = (q,r)=>(r||document).querySelector(q);
const $$ = (q,r)=>Array.from((r||document).querySelectorAll(q));
const esc = s => String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const toast = (m,k)=>{ try{ window.toast && window.toast(m,k); }catch(_){}};
const view = ()=>document.getElementById('view');
const fb = ()=>(typeof FB!=='undefined'&&FB)||null;
const S_ = ()=>(typeof S!=='undefined'&&S)||null;
const myUid = ()=>{const s=S_();return s&&s.userId||null;};
const myName = ()=>{const s=S_();return s&&s.name||'醫家';};
const myQi = ()=>{const s=S_();return s&&s.qi||1000;};
const nowMs = ()=>Date.now();
const roomCode = ()=>Math.random().toString(36).slice(2,6).toUpperCase();

// ─── 1) 처방 데이터 (size 2-7 핵심 33개) ──────────────────────────────────
const FORMULAS = [
  {id:'danggwi-boheol-tang', han:'當歸補血湯', ko:'당귀보혈탕', comp:['黃耆','當歸']},
  {id:'sosungki-tang', han:'小承氣湯', ko:'소승기탕', comp:['大黃','厚朴','枳實']},
  {id:'jowi-sungki-tang', han:'調胃承氣湯', ko:'조위승기탕', comp:['大黃','芒硝','甘草']},
  {id:'okbyeong-pung-san', han:'玉屛風散', ko:'옥병풍산', comp:['黃耆','白朮','防風']},
  {id:'injinho-tang', han:'茵蔯蒿湯', ko:'인진호탕', comp:['茵蔯','梔子','大黃']},
  {id:'daesungki-tang', han:'大承氣湯', ko:'대승기탕', comp:['大黃','厚朴','枳實','芒硝']},
  {id:'sagunja-tang', han:'四君子湯', ko:'사군자탕', comp:['人蔘','白朮','茯苓','甘草']},
  {id:'simul-tang', han:'四物湯', ko:'사물탕', comp:['熟地黃','當歸','白芍','川芎']},
  {id:'mahuang-tang', han:'麻黃湯', ko:'마황탕', comp:['麻黃','桂枝','杏仁','甘草']},
  {id:'mahaeng-gamseok-tang', han:'麻杏甘石湯', ko:'마행감석탕', comp:['麻黃','杏仁','甘草','石膏']},
  {id:'galgeun-hwanggeum-hwangryeon-tang', han:'葛根黃芩黃連湯', ko:'갈근황금황련탕', comp:['葛根','黃芩','黃連','甘草']},
  {id:'baekho-tang', han:'白虎湯', ko:'백호탕', comp:['石膏','知母','甘草','粳米']},
  {id:'hwangryeon-haedok-tang', han:'黃連解毒湯', ko:'황련해독탕', comp:['黃連','黃芩','黃柏','梔子']},
  {id:'pyeongwi-san', han:'平胃散', ko:'평위산', comp:['蒼朮','厚朴','陳皮','甘草']},
  {id:'sayeok-san', han:'四逆散', ko:'사역산', comp:['柴胡','白芍','枳實','甘草']},
  {id:'moryeo-san', han:'牡蠣散', ko:'모려산', comp:['麻黃根','黃耆','浮小麥','牡蠣']},
  {id:'yeonggye-chulgam-tang', han:'苓桂朮甘湯', ko:'영계출감탕', comp:['茯苓','桂枝','白朮','甘草']},
  {id:'gyeji-tang', han:'桂枝湯', ko:'계지탕', comp:['桂枝','白芍','甘草','生薑','大棗']},
  {id:'gyeji-insam-tang', han:'桂枝人蔘湯', ko:'계지인삼탕', comp:['桂枝','甘草','白朮','人蔘','乾薑']},
  {id:'oryeong-san', han:'五苓散', ko:'오령산', comp:['茯苓','豬苓','澤瀉','白朮','桂枝']},
  {id:'jeoryeong-tang', han:'豬苓湯', ko:'저령탕', comp:['豬苓','茯苓','澤瀉','阿膠','滑石']},
  {id:'banhabakpil-tang', han:'半夏厚朴湯', ko:'반하후박탕', comp:['半夏','厚朴','茯苓','生薑','蘇葉']},
  {id:'sanjoin-tang', han:'酸棗仁湯', ko:'산조인탕', comp:['酸棗仁','甘草','知母','茯苓','川芎']},
  {id:'jusa-anshin-hwan', han:'朱砂安神丸', ko:'주사안신환', comp:['朱砂','黃連','甘草','生地黃','當歸']},
  {id:'wolgug-hwan', han:'越鞠丸', ko:'월국환', comp:['香附','川芎','蒼朮','神麯','梔子']},
  {id:'ijin-tang', han:'二陳湯', ko:'이진탕', comp:['半夏','陳皮','茯苓','甘草','生薑','烏梅']},
  {id:'galgeun-tang', han:'葛根湯', ko:'갈근탕', comp:['葛根','麻黃','桂枝','白芍','甘草','生薑','大棗']},
  {id:'sosiho-tang', han:'小柴胡湯', ko:'소시호탕', comp:['柴胡','黃芩','人蔘','半夏','甘草','生薑','大棗']},
  {id:'daechungryong-tang', han:'大靑龍湯', ko:'대청룡탕', comp:['麻黃','桂枝','杏仁','甘草','石膏','生薑','大棗']},
  {id:'jugyeop-seokgo-tang', han:'竹葉石膏湯', ko:'죽엽석고탕', comp:['竹葉','石膏','人蔘','麥門冬','半夏','甘草','粳米']},
  {id:'majain-hwan', han:'麻子仁丸', ko:'마자인환', comp:['麻仁','杏仁','白芍','大黃','厚朴','枳實','蜂蜜']},
  {id:'seokgo-tang', han:'石膏湯', ko:'석고탕', comp:['石膏','黃連','黃柏','黃芩','香豉','梔子','麻黃']},
  {id:'boyang-hwano-tang', han:'補陽還五湯', ko:'보양환오탕', comp:['黃耆','當歸','赤芍','地龍','川芎','紅花','桃仁']},
];

const FORMULAS_BY_ID = {};
for(const F of FORMULAS) FORMULAS_BY_ID[F.id] = F;
const FORMULAS_BY_SIZE = FORMULAS.slice().sort((a,b) => a.comp.length - b.comp.length);

// 본초 → 등장 처방 목록
const HERB_TO_F = {};
for(const F of FORMULAS) for(const h of F.comp){
  if(!HERB_TO_F[h]) HERB_TO_F[h] = [];
  HERB_TO_F[h].push(F.han);
}

// ─── 본초 분류 (本草學 효능별 8 카테고리) — 카드 색상/디자인 차별화용 ─────
//   解表(해표): 풍한·풍열 발산. 麻黃·桂枝·葛根·柴胡·防風·蘇葉·生薑
//   淸熱(청열): 열을 식힘. 石膏·知母·黃連·黃芩·黃柏·梔子·茵蔯·竹葉·香豉·滑石
//   瀉下(사하): 대변 통하게. 大黃·芒硝·麻仁·蜂蜜
//   祛濕(거습): 습 제거. 茯苓·豬苓·澤瀉·蒼朮·白朮·厚朴·陳皮·半夏
//   溫裏(온리): 속을 데움. 乾薑·桂枝(겸)·朱砂
//   理氣(이기): 기 운행. 枳實·香附·神麯·烏梅·蘇葉(겸)
//   補益(보익): 기·혈·음·양 보충. 人蔘·黃耆·甘草·當歸·熟地黃·白芍·麥門冬·阿膠·酸棗仁·大棗·粳米·浮小麥
//   活血(활혈): 혈 활성. 川芎·桃仁·紅花·赤芍·地龍·生地黃·杏仁·麻黃根·牡蠣
const HERB_CAT = {
  // 解表
  '麻黃':'jie','桂枝':'jie','葛根':'jie','柴胡':'jie','防風':'jie','蘇葉':'jie','生薑':'jie',
  // 淸熱
  '石膏':'qing','知母':'qing','黃連':'qing','黃芩':'qing','黃柏':'qing','梔子':'qing','茵蔯':'qing','竹葉':'qing','香豉':'qing','滑石':'qing',
  // 瀉下
  '大黃':'xia','芒硝':'xia','麻仁':'xia','蜂蜜':'xia',
  // 祛濕
  '茯苓':'shi','豬苓':'shi','澤瀉':'shi','蒼朮':'shi','白朮':'shi','厚朴':'shi','陳皮':'shi','半夏':'shi',
  // 溫裏
  '乾薑':'wen','朱砂':'wen',
  // 理氣
  '枳實':'qi','香附':'qi','神麯':'qi','烏梅':'qi',
  // 補益
  '人蔘':'bu','黃耆':'bu','甘草':'bu','當歸':'bu','熟地黃':'bu','白芍':'bu','麥門冬':'bu','阿膠':'bu','酸棗仁':'bu','大棗':'bu','粳米':'bu','浮小麥':'bu',
  // 活血(겸 일부 化痰·止血)
  '川芎':'huo','桃仁':'huo','紅花':'huo','赤芍':'huo','地龍':'huo','生地黃':'huo','杏仁':'huo','麻黃根':'huo','牡蠣':'huo',
};
const HERB_CAT_META = {
  jie:  { name:'解表', color:'#5BA889', bg:'#E8F5EE', text:'#1F5A3F' },  // 풀빛 (發散)
  qing: { name:'淸熱', color:'#3A7BB7', bg:'#E4EEFA', text:'#1F4267' },  // 청옥 (冷)
  xia:  { name:'瀉下', color:'#7B4A8A', bg:'#F0E5F5', text:'#4A2A5A' },  // 자줏빛 (下)
  shi:  { name:'祛濕', color:'#A88B4A', bg:'#F8F0DA', text:'#5C4520' },  // 토색 (土)
  wen:  { name:'溫裏', color:'#C4502A', bg:'#FAE3D8', text:'#7A2F15' },  // 화염 (火)
  qi:   { name:'理氣', color:'#C9941F', bg:'#FBF1D8', text:'#7C5810' },  // 황금 (氣)
  bu:   { name:'補益', color:'#B8395C', bg:'#FAE0E8', text:'#6A1A2F' },  // 단심 (心血)
  huo:  { name:'活血', color:'#8A2A2A', bg:'#F5D8D8', text:'#5A1414' },  // 핏빛
  default: { name:'本草', color:'#888',  bg:'#FAF6EC', text:'#444' },
};
function herbMeta(h){ return HERB_CAT_META[HERB_CAT[h]] || HERB_CAT_META.default; }

// 카드 매수 (시뮬에서 검증한 분포)
function cardCount(n){
  if(n >= 7) return 10;
  if(n >= 5) return 8;
  if(n >= 3) return 7;
  if(n >= 2) return 6;
  return 5;
}

const DECK_TEMPLATE = [];
for(const [h, fs] of Object.entries(HERB_TO_F)){
  for(let i = 0; i < cardCount(fs.length); i++) DECK_TEMPLATE.push(h);
}

console.log(`[方劑麻雀 v12.5] 처방 ${FORMULAS.length}개 / 본초 ${Object.keys(HERB_TO_F).length}종 / 덱 ${DECK_TEMPLATE.length}장`);

// ─── 2) 役 점수 ──────────────────────────────────────────────────────────
function handScore(size){
  if(size <= 3) return { score:1, label:'小方', name:'小方役' };
  if(size <= 5) return { score:2, label:'中方', name:'中方役' };
  if(size <= 6) return { score:8, label:'大方', name:'大方役' };
  return { score:16, label:'役満', name:'方役満' };
}

// ─── 3) 화료 판정 ────────────────────────────────────────────────────────
// hand: { 본초: 개수 }
function countHand(handArr){
  const c = {};
  for(const h of handArr) c[h] = (c[h]||0)+1;
  return c;
}
function totalHand(handCounter){
  let t = 0; for(const v of Object.values(handCounter)) t += v; return t;
}

function checkWinning(handArr){
  const hand = countHand(handArr);
  const total = handArr.length;
  if(total > HAND_MAX) return null;
  let best = null;
  let bestScore = 0;
  for(const F of FORMULAS){
    // 모든 본초 보유
    let ok = true;
    for(const h of F.comp){ if((hand[h]||0) < 1){ ok = false; break; } }
    if(!ok) continue;
    // 雀頭 후보
    let jaktou = null;
    for(const h of F.comp){
      if((hand[h]||0) >= 2){ jaktou = h; break; }
    }
    if(!jaktou){
      // 雀頭이 처방 밖 본초여도 OK
      for(const [h, c] of Object.entries(hand)){
        if(F.comp.indexOf(h) >= 0) continue;
        if(c >= 2){ jaktou = h; break; }
      }
    }
    if(!jaktou) continue;
    const s = handScore(F.comp.length).score;
    if(s > bestScore){
      bestScore = s;
      best = { formula: F, jaktou, score: s };
    }
  }
  return best;
}

// ─── 4) AI 봇 ───────────────────────────────────────────────────────────
function getTargetFormula(handArr){
  const hand = countHand(handArr);
  let best = null, bestEv = -Infinity;
  for(const F of FORMULAS){
    let overlap = 0;
    for(const h of F.comp) if((hand[h]||0) >= 1) overlap++;
    const need = F.comp.length - overlap;
    if(need > 4) continue;
    const sc = handScore(F.comp.length).score;
    const ev = overlap * 10 - need * 8 + sc;
    if(ev > bestEv){ bestEv = ev; best = F; }
  }
  return best;
}

function botDiscard(handArr){
  const hand = countHand(handArr);
  const target = getTargetFormula(handArr);
  const targetHerbs = target ? new Set(target.comp) : new Set();
  let worstHerb = null, worstScore = Infinity;
  for(const [h, c] of Object.entries(hand)){
    let s = 0;
    if(targetHerbs.has(h)){
      s += 200;
      if(c >= 2) s += 50;
      if(c > 2) s -= (c-2)*30;
    } else {
      s -= 100;
      if(c >= 2) s += 30;
    }
    s += (HERB_TO_F[h]||[]).length * 3;
    if(s < worstScore){ worstScore = s; worstHerb = h; }
  }
  return worstHerb;
}

// ─── 4.5) 사운드 (Web Audio — 경쾌한 마작 효과음) ─────────────────────────
let _ac = null;
function _audioCtx(){
  if(_ac) return _ac;
  try{ _ac = new (window.AudioContext || window.webkitAudioContext)(); }catch(_){ _ac = null; }
  return _ac;
}
function _tone(ctx, gainNode, t0, freq, dur, type, peak){
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq;
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0, now + t0);
  g.gain.linearRampToValueAtTime(peak || 0.16, now + t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
  o.connect(g); g.connect(gainNode);
  o.start(now + t0); o.stop(now + t0 + dur + 0.03);
}
function sfx(kind){
  try{
    const ctx = _audioCtx(); if(!ctx) return;
    if(ctx.state === 'suspended'){ try{ ctx.resume(); }catch(_){} }
    const G = ctx.createGain(); G.gain.value = 0.85; G.connect(ctx.destination);
    const C5=523.25, D5=587.33, E5=659.25, G5=783.99, A5=880, C6=1046.5, E6=1318.5, G6=1568;
    switch(kind){
      case 'discard':
        // 마작 패가 탁자에 떨어지는 듯 — 짧은 우드 톡톡
        _tone(ctx, G, 0,    220, 0.05, 'square',   0.10);
        _tone(ctx, G, 0.005,440, 0.08, 'triangle', 0.14);
        _tone(ctx, G, 0.01, 880, 0.05, 'sine',     0.08);
        break;
      case 'draw':
        // 패를 뽑는 짧은 상승음
        _tone(ctx, G, 0,    G5, 0.08, 'sine', 0.10);
        _tone(ctx, G, 0.04, C6, 0.10, 'sine', 0.10);
        break;
      case 'select':
        // 카드 호버/선택
        _tone(ctx, G, 0, E6, 0.05, 'triangle', 0.08);
        break;
      case 'win':
        // 화료! 화려한 5도+옥타브
        _tone(ctx, G, 0,    C5, 0.5, 'sine',     0.14);
        _tone(ctx, G, 0.06, E5, 0.5, 'sine',     0.12);
        _tone(ctx, G, 0.12, G5, 0.5, 'sine',     0.12);
        _tone(ctx, G, 0.18, C6, 0.6, 'triangle', 0.14);
        _tone(ctx, G, 0.30, E6, 0.7, 'triangle', 0.12);
        _tone(ctx, G, 0.42, G6, 0.8, 'sine',     0.14);
        break;
      case 'lose':
      case 'timeout':
        _tone(ctx, G, 0,    330, 0.4, 'triangle', 0.10);
        _tone(ctx, G, 0.10, 220, 0.5, 'triangle', 0.10);
        break;
      case 'turn':
        // 내 턴 시작
        _tone(ctx, G, 0,    G5, 0.10, 'sine',     0.10);
        _tone(ctx, G, 0.08, C6, 0.14, 'triangle', 0.10);
        break;
      case 'shuffle':
        // 게임 시작 — 셔플 느낌
        for(let i = 0; i < 6; i++){
          _tone(ctx, G, i*0.04, 600 + Math.random()*400, 0.06, 'square', 0.06);
        }
        break;
      default:
        _tone(ctx, G, 0, 440, 0.1, 'sine', 0.10);
    }
  }catch(_){}
}

// ─── 4.6) 캐릭터 이미지 헬퍼 ──────────────────────────────────────────────
function charImgUrl(charId){
  if(!charId) return null;
  try{
    const dict = window.CHARACTER_IMAGES;
    if(dict && dict[charId]){
      return dict[charId].url || dict[charId].fallback || null;
    }
  }catch(_){}
  // fallback: 직접 파일명 추측
  return charId + '.jpg';
}
function charInitial(name){
  if(!name) return '?';
  // 한자 1글자 또는 한글 1글자
  return String(name).trim().charAt(0) || '?';
}

// ─── 5) 덱 셔플 ──────────────────────────────────────────────────────────
function shuffleDeck(){
  const d = DECK_TEMPLATE.slice();
  for(let i = d.length-1; i > 0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── 6) 방 만들기 / 입장 ────────────────────────────────────────────────
async function createRoom(opts){
  const f = fb();
  const uid = myUid();
  if(!f){
    console.error('[方劑麻雀] createRoom 실패: FB 객체 없음', { FB_exists: typeof window.FB });
    toast('Firebase 미연결','warn'); return null;
  }
  if(!uid){
    console.error('[方劑麻雀] createRoom 실패: 사용자 ID 없음 — 새로고침 必要');
    toast('사용자 ID 없음 — 새로고침 후 재시도','warn'); return null;
  }
  opts = Object.assign({maxPlayers:4, isPublic:true, name:''}, opts);
  const maxP = Math.min(MAX_PLAYERS, opts.maxPlayers || 4);
  const rid = roomCode();
  const room = {
    roomId: rid, status:'waiting', hostId: uid,
    name: opts.name || `${myName()}의 方劑麻雀房`,
    maxPlayers: maxP,
    isPublic: !!opts.isPublic, createdAt: nowMs(),
    gameType: 'mahjong',   // v12.5: 큐브와 마작 노드 구분용 (cube_rooms 재사용 시 충돌 방지)
    players: { [uid]: {
      name: myName(), character: (S_()||{}).character||null,
      qi: myQi(), isHost:true, isReady:true, isBot:false,
      seat:0, joinedAt: nowMs(), hand:[], pickedUp:[], discards:[],
    }},
    pot:0, deck:[], turnIdx:0, turnUserId:'', turnStartedAt:0,
    phase:'lobby', lastAction:null, turn:0,
  };
  console.log('[方劑麻雀] createRoom 시도', { rid, FB_NODE, maxP });
  let ok = false;
  try{
    ok = await f.put(`${FB_NODE}/${rid}`, room);
  }catch(e){
    console.error('[方劑麻雀] f.put 예외 발생', e);
    toast('서버 통신 오류: ' + (e && e.message || '?'), 'warn');
    return null;
  }
  if(!ok){
    console.error('[方劑麻雀] f.put returned false — Firebase 룰 또는 네트워크 문제', {
      rid, path: `${FB_NODE}/${rid}`,
      hint: 'Firebase Console → Realtime Database → Rules 에 "' + FB_NODE + '" 노드 .read/.write 권한 확인 必要'
    });
    toast('서버 쓰기 실패 (보안 룰 또는 네트워크)','warn');
    return null;
  }
  console.log('[方劑麻雀] createRoom 성공:', rid);
  return rid;
}

async function joinRoom(rid){
  const f = fb();
  if(!f || !myUid()) return {ok:false, msg:'네트워크 없음'};
  rid = String(rid||'').toUpperCase().trim();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return {ok:false, msg:'방 없음'};
  // v12.5: 큐브 잔여방 방어 (cube_rooms 노드 재사용)
  if(room.gameType && room.gameType !== 'mahjong') return {ok:false, msg:'마작방 아님'};
  if(room.status !== 'waiting') return {ok:false, msg:'이미 시작'};
  const ps = room.players || {};
  if(ps[myUid()]) return {ok:true, roomId:rid, rejoin:true};
  if(Object.keys(ps).length >= room.maxPlayers) return {ok:false, msg:'가득참'};
  const seat = Object.keys(ps).length;
  await f.put(`${FB_NODE}/${rid}/players/${myUid()}`, {
    name: myName(), character: (S_()||{}).character||null, qi: myQi(),
    isHost:false, isReady:false, isBot:false, seat, joinedAt: nowMs(),
    hand:[], pickedUp:[], discards:[],
  });
  return {ok:true, roomId:rid};
}

async function addBot(rid){
  const f = fb();
  if(!f) return false;
  // v12.5.1: createRoom 직후 즉시 호출 시 방을 못 찾을 수 있음 → 최대 3회 재시도
  let room = null;
  for(let attempt = 0; attempt < 3; attempt++){
    room = await f.get(`${FB_NODE}/${rid}`);
    if(room) break;
    console.warn('[方劑麻雀 addBot] 방 fetch 실패 — 재시도', attempt+1);
    await new Promise(res => setTimeout(res, 200));
  }
  if(!room){
    console.error('[方劑麻雀 addBot] 방 못 찾음 (3회 재시도 실패)', rid);
    return false;
  }
  if(room.hostId !== myUid()){
    console.error('[方劑麻雀 addBot] 호스트 아님', { rid, hostId: room.hostId, myUid: myUid() });
    return false;
  }
  const ps = room.players || {};
  if(Object.keys(ps).length >= room.maxPlayers){
    toast('가득참','warn');
    return false;
  }
  const botNames = ['岐伯AI','華佗AI','扁鵲AI','張仲景AI','孫思邈AI'];
  const used = new Set(Object.values(ps).map(p => p.name));
  const name = botNames.find(n => !used.has(n)) || `Bot${Object.keys(ps).length}`;
  const seat = Object.keys(ps).length;
  // v12.5.1: nowMs+random 조합으로 ID 충돌 회피
  const botUid = `bot_${seat}_${nowMs()}_${Math.floor(Math.random()*9999)}`;
  const botData = {
    name, character: null,
    qi: 800 + Math.floor(Math.random()*1200),
    isHost:false, isReady:true, isBot:true,
    seat, joinedAt: nowMs(),
    handPlaceholder: 1,   // 시작 시 startGame 에서 hand 로 덮어쓰여짐
  };
  const ok = await f.put(`${FB_NODE}/${rid}/players/${botUid}`, botData);
  if(!ok){
    console.error('[方劑麻雀 addBot] PUT 실패', { rid, botUid });
    return false;
  }
  console.log('[方劑麻雀 addBot] 봇 추가 성공:', name, '(seat', seat, ')');
  return true;
}

// ─── 7) 게임 시작 ────────────────────────────────────────────────────────
async function startGame(rid){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return {ok:false, msg:'방 없음'};
  if(room.hostId !== myUid()) return {ok:false, msg:'호스트만'};
  const ps = room.players || {};
  if(Object.keys(ps).length < 2) return {ok:false, msg:'최소 2人'};

  // 덱 셔플 + 손패 분배
  const deck = shuffleDeck();
  const playerIds = Object.keys(ps);
  for(const uid of playerIds){
    const hand = deck.splice(0, HAND_INIT);
    ps[uid].hand = hand;
    ps[uid].discards = [];
  }
  const turnUserId = playerIds[0];
  await f.put(`${FB_NODE}/${rid}`, {
    ...room, status:'playing', phase:'playing',
    deck, players: ps,
    turnIdx: 0, turnUserId, turnStartedAt: nowMs(), turn: 1,
  });
  return {ok:true};
}

// ─── 8) 화료 / 버리기 (서버 액션) ────────────────────────────────────────
async function declareWin(rid){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room || room.status !== 'playing') return;
  const me = room.players[myUid()];
  if(!me) return;
  const w = checkWinning(me.hand);
  if(!w){ toast('화료 불가','warn'); return; }
  try{ sfx('win'); }catch(_){}
  await f.put(`${FB_NODE}/${rid}`, {
    ...room, status:'finished', phase:'showdown',
    winner: myUid(), winningFormula: w.formula.id,
    winningJaktou: w.jaktou, winningScore: w.score,
  });
  toast(`화료! ${w.formula.han} (${w.score}번)`, 'gold');
}

async function discard(rid, herbIdx){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room || room.status !== 'playing') return;
  if(room.turnUserId !== myUid()) return;
  const me = room.players[myUid()];
  if(!me) return;
  const herb = me.hand[herbIdx];
  if(!herb) return;
  // 손패에서 제거
  const newHand = me.hand.slice();
  newHand.splice(herbIdx, 1);
  const newDiscards = (me.discards||[]).concat([herb]);
  // 다음 턴 카드 뽑기
  const newDeck = room.deck.slice();
  // 다음 플레이어
  const playerIds = Object.keys(room.players).sort((a,b) => room.players[a].seat - room.players[b].seat);
  const myI = playerIds.indexOf(myUid());
  const nextI = (myI + 1) % playerIds.length;
  const nextUid = playerIds[nextI];
  // 다음 플레이어에게 1장
  let nextHand = (room.players[nextUid].hand||[]).slice();
  if(newDeck.length > 0) nextHand.push(newDeck.shift());

  const updated = { ...room, deck: newDeck };
  updated.players = {...room.players};
  updated.players[myUid()] = { ...me, hand: newHand, discards: newDiscards };
  updated.players[nextUid] = { ...room.players[nextUid], hand: nextHand };
  updated.turnUserId = nextUid;
  updated.turnIdx = nextI;
  updated.turnStartedAt = nowMs();
  updated.turn = (room.turn||0) + 1;

  // 최대 턴 초과 시 무승부
  if(updated.turn > MAX_TURNS){
    updated.status = 'finished';
    updated.phase = 'timeout';
  }
  await f.put(`${FB_NODE}/${rid}`, updated);

  // AI 봇 자동 진행 (호스트가 진행)
  if(room.hostId === myUid() && updated.status === 'playing'){
    if(room.players[nextUid] && room.players[nextUid].isBot){
      setTimeout(() => botPlay(rid, nextUid), 1500);
    }
  }
}

async function botPlay(rid, botUid){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room || room.status !== 'playing' || room.turnUserId !== botUid) return;
  const bot = room.players[botUid];
  if(!bot) return;
  // 화료 가능?
  const w = checkWinning(bot.hand);
  if(w){
    // 봇 화료
    await f.put(`${FB_NODE}/${rid}`, {
      ...room, status:'finished', phase:'showdown',
      winner: botUid, winningFormula: w.formula.id,
      winningJaktou: w.jaktou, winningScore: w.score,
    });
    return;
  }
  // 버릴 본초 결정
  const dh = botDiscard(bot.hand);
  const idx = bot.hand.indexOf(dh);
  if(idx < 0) return;
  // 손패에서 제거 + 다음 플레이어로
  const newHand = bot.hand.slice();
  newHand.splice(idx, 1);
  const newDiscards = (bot.discards||[]).concat([dh]);
  const newDeck = room.deck.slice();
  const playerIds = Object.keys(room.players).sort((a,b) => room.players[a].seat - room.players[b].seat);
  const myI = playerIds.indexOf(botUid);
  const nextI = (myI + 1) % playerIds.length;
  const nextUid = playerIds[nextI];
  let nextHand = (room.players[nextUid].hand||[]).slice();
  if(newDeck.length > 0) nextHand.push(newDeck.shift());

  const updated = { ...room, deck: newDeck };
  updated.players = {...room.players};
  updated.players[botUid] = { ...bot, hand: newHand, discards: newDiscards };
  updated.players[nextUid] = { ...room.players[nextUid], hand: nextHand };
  updated.turnUserId = nextUid;
  updated.turnIdx = nextI;
  updated.turnStartedAt = nowMs();
  updated.turn = (room.turn||0) + 1;
  if(updated.turn > MAX_TURNS){
    updated.status = 'finished';
    updated.phase = 'timeout';
  }
  // 봇이 패를 버리는 소리 — 호스트 클라이언트에서만 (봇 자동 진행자)
  try{ sfx('discard'); }catch(_){}
  await f.put(`${FB_NODE}/${rid}`, updated);

  // 다음 봇도 자동
  if(updated.status === 'playing' && updated.players[nextUid] && updated.players[nextUid].isBot){
    setTimeout(() => botPlay(rid, nextUid), 1500);
  }
}

// ─── 9) UI: 메인 home ─────────────────────────────────────────────────────
function open(){
  const v = view(); if(!v) return;
  v.innerHTML = `
    <div class="bjm-lobby fade-in">
      <h2 class="view-title"><span class="han">方劑</span>麻雀</h2>
      <div class="view-sub">${FORMULAS.length}개 처방 · ${Object.keys(HERB_TO_F).length}종 본초 · 손패 ${HAND_INIT}장 · ~5-6분 한 판</div>

      <div class="bjm-step-label">公開 對局</div>
      <div class="bjm-actions-grid">
        <button class="bjm-action-btn bjm-act-public" type="button" id="bjm-act-public">
          <div class="bjm-act-han">公開房 만들기</div>
          <div class="bjm-act-ko">방 개설 · 다른 醫家 대기</div>
        </button>
        <button class="bjm-action-btn bjm-act-join" type="button" id="bjm-act-joinpublic">
          <div class="bjm-act-han">公開房 入場</div>
          <div class="bjm-act-ko">아래 목록에서 클릭</div>
        </button>
      </div>

      <div class="bjm-step-label">AI 對局 (2-4人)</div>
      <div class="bjm-ai-grid">
        <button class="bjm-action-btn bjm-act-ai" type="button" data-np="2">
          <div class="bjm-act-han">2人 對局</div>
          <div class="bjm-act-ko">AI 1봇</div>
        </button>
        <button class="bjm-action-btn bjm-act-ai" type="button" data-np="3">
          <div class="bjm-act-han">3人 對局</div>
          <div class="bjm-act-ko">AI 2봇</div>
        </button>
        <button class="bjm-action-btn bjm-act-ai" type="button" data-np="4">
          <div class="bjm-act-han">4人 對局</div>
          <div class="bjm-act-ko">AI 3봇</div>
        </button>
      </div>

      <div class="bjm-step-label">私房 (친구 초대)</div>
      <div class="bjm-actions-grid">
        <button class="bjm-action-btn" type="button" id="bjm-act-private">
          <div class="bjm-act-han">私房 만들기</div>
          <div class="bjm-act-ko">4자 코드로 친구 초대</div>
        </button>
        <button class="bjm-action-btn" type="button" id="bjm-act-joincode">
          <div class="bjm-act-han">私房 코드 입장</div>
          <div class="bjm-act-ko">받은 코드 입력</div>
        </button>
      </div>

      <div class="bjm-step-label">모집 中 公開房 <small style="opacity:.6">(클릭 즉시 합류)</small></div>
      <div class="bjm-public-list" id="bjm-public-list"></div>

      <div style="margin-top:14px;text-align:center">
        <button class="btn btn-o" type="button" id="bjm-howto">📜 룰 보기 · 처방 ${FORMULAS.length}개 목록</button>
      </div>
    </div>
  `;
  $('#bjm-act-public').addEventListener('click', () => createPublicAndEnter());
  $('#bjm-act-joinpublic').addEventListener('click', () => {
    const list = $('#bjm-public-list');
    if(list) list.scrollIntoView({behavior:'smooth', block:'center'});
    renderPublicList();
  });
  $$('.bjm-act-ai').forEach(b => b.addEventListener('click', () => {
    const np = parseInt(b.dataset.np, 10) || 4;
    startSoloVsAI(np);
  }));
  $('#bjm-act-private').addEventListener('click', () => createPrivateAndEnter());
  $('#bjm-act-joincode').addEventListener('click', promptJoinCode);
  $('#bjm-howto').addEventListener('click', showRulebook);
  renderPublicList();
}

async function createPublicAndEnter(){
  if(!fb() || !myUid()){ toast('네트워크 미연결','warn'); return; }
  const choice = prompt('최대 인원 (2-4): 다른 醫家가 합류할 때까지 대기', '4');
  if(!choice) return;
  const maxP = Math.max(2, Math.min(4, parseInt(choice, 10) || 4));
  const rid = await createRoom({maxPlayers:maxP, isPublic:true});
  if(!rid){ toast('公開房 생성 실패','warn'); return; }
  renderRoom(rid);
}

async function startSoloVsAI(nPlayers){
  if(!fb() || !myUid()){ toast('네트워크 미연결','warn'); return; }
  // nPlayers 미지정 시 사용자에게 묻기 (2/3/4)
  if(!nPlayers){
    const choice = prompt('AI 對局 인원 (2-4): 봇 수가 (입력값 - 1)명이 됩니다', '4');
    if(!choice) return;
    nPlayers = Math.max(2, Math.min(4, parseInt(choice, 10) || 4));
  }
  console.log('[方劑麻雀] AI 對局 시작 시도:', nPlayers, '人');
  const rid = await createRoom({maxPlayers:nPlayers, isPublic:false, name:`${myName()}의 AI 對局 (${nPlayers}人)`});
  if(!rid){ toast('방 생성 실패','warn'); return; }
  // v12.5.1: 봇 (nPlayers-1)명 순차 추가 + 각 추가 후 짧은 지연 (Firebase 반영 대기)
  const needBots = nPlayers - 1;
  let added = 0;
  for(let i = 0; i < needBots; i++){
    const ok = await addBot(rid);
    if(ok) added++;
    else console.warn('[方劑麻雀] AI ' + (i+1) + '번째 봇 추가 실패');
    // Firebase eventual consistency 대비 — 다음 봇 추가 전 짧은 대기
    await new Promise(res => setTimeout(res, 150));
  }
  console.log('[方劑麻雀] 봇 추가 결과:', added, '/', needBots, '명');
  if(added < needBots){
    toast(`AI 봇 ${added}/${needBots}명만 추가됨 — 진행`, 'warn');
  }
  // 방 상태 한 번 더 fetch해서 players 수 확인 (Firebase 반영 보장)
  await new Promise(res => setTimeout(res, 300));
  const f = fb();
  const verifyRoom = await f.get(`${FB_NODE}/${rid}`);
  const actualPlayers = Object.keys((verifyRoom && verifyRoom.players) || {}).length;
  console.log('[方劑麻雀] 시작 직전 방 상태:', actualPlayers, '/', nPlayers, '人');
  if(actualPlayers < 2){
    toast('방에 사람이 너무 적음 — AI 추가 실패','warn');
    renderRoom(rid);
    return;
  }
  // 자동 시작
  const sr = await startGame(rid);
  if(sr && sr.ok === false){
    toast('게임 시작 실패: ' + (sr.msg||''), 'warn');
    renderRoom(rid);
    return;
  }
  renderRoom(rid);
}

async function createPrivateAndEnter(){
  if(!fb() || !myUid()){ toast('네트워크 미연결','warn'); return; }
  const rid = await createRoom({maxPlayers:4, isPublic:false});
  if(!rid){ toast('私房 생성 실패','warn'); return; }
  alert(`私房 코드: ${rid}\n친구에게 알려주세요.`);
  renderRoom(rid);
}

function promptJoinCode(){
  const code = prompt('방 코드 (4자)');
  if(!code) return;
  joinRoom(code).then(r => { if(r.ok) renderRoom(r.roomId); else toast(r.msg,'warn'); });
}

async function renderPublicList(){
  const f = fb();
  const list = $('#bjm-public-list');
  if(!list) return;
  if(!f) return list.innerHTML = '<div class="bjm-empty">네트워크 미연결</div>';
  const all = await f.get(FB_NODE);
  // v12.5: cube_rooms 노드 재사용 — 마작방만 표시 (gameType==='mahjong'). 옛 큐브방 잔여 제외.
  const rooms = !all ? [] : Object.values(all).filter(r =>
    r && r.gameType === 'mahjong' && r.isPublic && r.status === 'waiting'
  );
  if(!rooms.length){
    list.innerHTML = '<div class="bjm-empty">모집 중인 公開房 없음 — 만들어서 호스트가 되어보세요</div>';
    return;
  }
  list.innerHTML = rooms.map(r => {
    const n = Object.keys(r.players||{}).length;
    return `<div class="bjm-room" data-rid="${esc(r.roomId)}">
      <div>
        <div class="bjm-room-name">${esc(r.name)}</div>
        <div class="bjm-room-meta">${n}/${r.maxPlayers}人</div>
      </div>
      <div style="font-size:11px;color:#3A6A4A;font-weight:600">→ 합류</div>
    </div>`;
  }).join('');
  $$('.bjm-room', list).forEach(el => el.addEventListener('click', async ()=>{
    const r = await joinRoom(el.dataset.rid);
    if(r.ok) renderRoom(r.roomId);
    else toast(r.msg, 'warn');
  }));
}

// ─── 10) UI: 방 / 게임 ───────────────────────────────────────────────────
// v12.6: 폴링 시 매번 innerHTML 전체 교체 → '화면 새로고침/깜빡임' 문제 해결.
//   ・ 상태 hash (status + turnUserId + turn + 손패합 + 버린패합) 가 같으면 skip
//   ・ status 천이(waiting→playing, playing→finished) 시에만 전체 재렌더
//   ・ playing 中 같은 status면 변하는 부분만 부분 업데이트
function stateHash(room){
  if(!room) return '';
  const ps = room.players || {};
  const me = ps[myUid()] || {};
  const handStr = (me.hand||[]).slice().sort().join(',');
  const discStr = (me.discards||[]).join(',');
  let othersStr = '';
  for(const [uid, p] of Object.entries(ps)){
    if(uid === myUid()) continue;
    othersStr += uid + ':' + ((p.hand||[]).length) + ':' + ((p.discards||[]).length) + '|';
  }
  return [room.status, room.phase, room.turn||0, room.turnUserId||'', handStr, discStr, othersStr, Object.keys(ps).length].join('#');
}

function renderRoom(rid){
  const v = view(); if(!v) return;
  const f = fb();
  // 폴링 lock — 사용자 액션 직후 짧은 동안 폴링 차단 (깜빡임 방지)
  if(window._bjmPoll) clearInterval(window._bjmPoll);
  window._bjmState = { lastHash:'', lastStatus:'', actionLockUntil:0, rid };

  const tick = async () => {
    if(nowMs() < (window._bjmState.actionLockUntil||0)) return;  // 액션 직후 짧은 lock
    const room = await f.get(`${FB_NODE}/${rid}`);
    if(!room){
      v.innerHTML = '<div style="padding:20px;text-align:center;color:#888">방이 사라졌습니다</div>';
      clearInterval(window._bjmPoll);
      return;
    }
    const h = stateHash(room);
    if(h === window._bjmState.lastHash) return;  // 변화 없음 → 재렌더 skip
    const prevStatus = window._bjmState.lastStatus;
    window._bjmState.lastHash = h;
    window._bjmState.lastStatus = room.status;
    window._bjmState.lastRoom = room;
    // status 천이 또는 첫 그림이면 전체 재렌더
    if(prevStatus !== room.status){
      drawRoom(rid, room);
      if(room.status === 'playing' && prevStatus === 'waiting'){
        try{ sfx('shuffle'); }catch(_){}
      }
      if(room.status === 'finished'){
        try{ sfx(room.winner === myUid() ? 'win' : (room.phase === 'timeout' ? 'timeout' : 'lose')); }catch(_){}
      }
    } else if(room.status === 'playing'){
      // 게임 중: 부분 업데이트만
      updateGameTable(rid, room);
    } else {
      // waiting / finished : 같은 status 內 변화 (좌석 추가 등)
      drawRoom(rid, room);
    }
  };
  tick();
  window._bjmPoll = setInterval(tick, POLL_MS);
}

// 사용자 액션 직후 짧은 lock + 즉시 부분 업데이트 (낙관적 UI)
function _lockPolling(ms){
  if(window._bjmState) window._bjmState.actionLockUntil = nowMs() + (ms||600);
}

function drawRoom(rid, room){
  const v = view(); if(!v) return;
  const isHost = room.hostId === myUid();
  const me = (room.players||{})[myUid()];
  const players = Object.entries(room.players||{}).sort((a,b) => a[1].seat - b[1].seat);

  if(room.status === 'waiting'){
    v.innerHTML = `
      <div class="bjm-room-view fade-in">
        <h2 class="han">方劑麻雀房 — ${esc(rid)}</h2>
        <div style="font-size:12px;color:#888;margin-bottom:8px">${room.isPublic?'公開房':'私房'} · ${Object.keys(room.players).length}/${room.maxPlayers}人</div>
        <div class="bjm-seats">
          ${players.map(([uid, p]) => {
            const cimg = charImgUrl(p.character);
            const avatar = cimg
              ? `<div class="bjm-seat-avatar"><img src="${esc(cimg)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'bjm-seat-avatar-init',textContent:'${esc(charInitial(p.name))}'}))"></div>`
              : `<div class="bjm-seat-avatar"><div class="bjm-seat-avatar-init">${esc(charInitial(p.name))}</div></div>`;
            return `
            <div class="bjm-seat ${uid===myUid()?'is-me':''}">
              ${avatar}
              <div class="bjm-seat-name">${esc(p.name)}${p.isHost?' 👑':''}${p.isBot?' 🤖':''}</div>
              <div class="bjm-seat-seat">座 ${(p.seat||0)+1}</div>
            </div>`;
          }).join('')}
        </div>
        <div class="bjm-tools">
          ${isHost ? `<button class="btn btn-gold" id="bjm-start" type="button">對局 시작</button>` : ''}
          ${isHost && Object.keys(room.players).length < room.maxPlayers ? `<button class="btn" id="bjm-addbot" type="button">+ AI 봇</button>` : ''}
          <button class="btn btn-o" id="bjm-leave" type="button">나가기</button>
        </div>
      </div>
    `;
    if(isHost){
      $('#bjm-start').addEventListener('click', async () => {
        const r = await startGame(rid);
        if(!r.ok) toast(r.msg,'warn');
      });
      const ab = $('#bjm-addbot');
      if(ab) ab.addEventListener('click', async () => {
        ab.disabled = true; ab.textContent = '추가 중…';
        const ok = await addBot(rid);
        ab.disabled = false; ab.textContent = '+ AI 봇';
        if(!ok) toast('AI 봇 추가 실패','warn');
        else toast('AI 봇 추가됨','gold');
      });
    }
    $('#bjm-leave').addEventListener('click', () => {
      clearInterval(window._bjmPoll);
      open();
    });
  } else if(room.status === 'playing'){
    drawGameTable(rid, room, me);
  } else if(room.status === 'finished'){
    const winner = (room.players||{})[room.winner] || {name:'?'};
    const winF = FORMULAS_BY_ID[room.winningFormula] || {han:'?', ko:'?'};
    const wImg = charImgUrl(winner.character);
    v.innerHTML = `
      <div class="bjm-finished fade-in">
        <h2 class="han">${room.phase === 'timeout' ? '無勝負' : '對局 終了'}</h2>
        ${room.winner ? `
          <div class="bjm-winner-block">
            ${wImg ? `<div class="bjm-winner-avatar"><img src="${esc(wImg)}" alt="" onerror="this.parentElement.style.display='none'"></div>` : ''}
            <div class="bjm-winner-name">${esc(winner.name)} 화료!</div>
            <div class="bjm-winner-formula han">${esc(winF.han)} <small>(${esc(winF.ko)})</small></div>
            <div class="bjm-winner-score">${room.winningScore || 0}番 · 雀頭: <span class="han">${esc(room.winningJaktou||'')}</span></div>
            <div style="font-size:12px;color:#888;margin-top:8px">本草: <span class="han">${(winF.comp||[]).join('·')}</span></div>
          </div>
        ` : '<div style="color:#888">무승부 (최대 턴 도달)</div>'}
        <button class="btn btn-gold" id="bjm-new" type="button" style="margin-top:14px">새 게임</button>
        <button class="btn btn-o" id="bjm-back" type="button">홈으로</button>
      </div>
    `;
    $('#bjm-new').addEventListener('click', () => { clearInterval(window._bjmPoll); open(); });
    $('#bjm-back').addEventListener('click', () => { clearInterval(window._bjmPoll); open(); });
  }
}

function _cardHtml(h, opts){
  opts = opts || {};
  const meta = herbMeta(h);
  const idx = opts.idx;
  const formulas = (HERB_TO_F[h]||[]).slice(0,3).join('·');
  const clickable = opts.clickable ? 'is-clickable' : '';
  const attrs = (idx !== undefined) ? `data-idx="${idx}"` : '';
  return `<div class="bjm-card ${clickable}" ${attrs}
      style="--cat:${meta.color}; --cat-bg:${meta.bg}; --cat-text:${meta.text}"
      data-cat="${HERB_CAT[h]||''}" title="${esc(meta.name)} · ${esc(formulas)}">
      <div class="bjm-card-cat">${esc(meta.name)}</div>
      <div class="bjm-card-han han">${esc(h)}</div>
    </div>`;
}

function _opponentBlockHtml(uid, p, room){
  const isTurn = room.turnUserId === uid;
  const cimg = charImgUrl(p.character);
  const avatar = cimg
    ? `<div class="bjm-opp-avatar"><img src="${esc(cimg)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'bjm-opp-avatar-init',textContent:'${esc(charInitial(p.name))}'}))"></div>`
    : `<div class="bjm-opp-avatar"><div class="bjm-opp-avatar-init">${esc(charInitial(p.name))}</div></div>`;
  const handLen = (p.hand||[]).length;
  const discards = (p.discards||[]);
  return `
    <div class="bjm-opponent ${isTurn?'is-turn':''}" data-uid="${esc(uid)}">
      <div class="bjm-opp-header">
        ${avatar}
        <div class="bjm-opp-headtxt">
          <div class="bjm-opp-name">${esc(p.name)}${p.isBot?' 🤖':''}</div>
          <div class="bjm-opp-meta">${handLen}장 ${isTurn?'· ☀ 차례':''}</div>
        </div>
      </div>
      <div class="bjm-opp-hand">${'<span class="bjm-back-card"></span>'.repeat(handLen)}</div>
      <div class="bjm-opp-discards">
        ${discards.length === 0 ? '<span style="opacity:.5;font-size:10px">버린 패 없음</span>' : discards.map(h => {
          const meta = herbMeta(h);
          return `<span class="han bjm-discard-mini" style="background:${meta.bg};color:${meta.text};border-color:${meta.color}">${esc(h)}</span>`;
        }).join('')}
      </div>
    </div>
  `;
}

function _myHandHtml(myHand, isMyTurn){
  return myHand.map((h, i) => _cardHtml(h, {idx:i, clickable:isMyTurn})).join('');
}

function _myDiscardsHtml(discards){
  if(!discards || discards.length === 0) return '<span style="opacity:.5">버린 패 없음</span>';
  return discards.map(h => {
    const meta = herbMeta(h);
    return `<span class="han bjm-discard-mini" style="background:${meta.bg};color:${meta.text};border-color:${meta.color}">${esc(h)}</span>`;
  }).join('');
}

function drawGameTable(rid, room, me){
  const v = view(); if(!v) return;
  const isMyTurn = room.turnUserId === myUid();
  const players = Object.entries(room.players||{}).sort((a,b) => a[1].seat - b[1].seat);
  const myHand = (me && me.hand) || [];
  const canWin = checkWinning(myHand);

  const otherPlayersHtml = players
    .filter(([uid]) => uid !== myUid())
    .map(([uid, p]) => _opponentBlockHtml(uid, p, room))
    .join('');

  v.innerHTML = `
    <div class="bjm-game fade-in" id="bjm-game-root">
      <div class="bjm-header">
        <div class="han">方劑麻雀 — ${esc(rid)}</div>
        <div class="bjm-info" id="bjm-info">턴 ${room.turn||0}/${MAX_TURNS} · 덱 ${(room.deck||[]).length}장</div>
      </div>
      <div class="bjm-opponents" id="bjm-opponents">${otherPlayersHtml}</div>
      <div class="bjm-my-area">
        <div class="bjm-turn-indicator ${isMyTurn?'is-active':''}" id="bjm-turn-ind">${isMyTurn ? '☀ 내 턴 — 1장 클릭해서 버리기' : '⏳ 상대 턴 대기 中…'}</div>
        <div id="bjm-win-btn-wrap">
          ${canWin ? `<button class="btn btn-gold bjm-win-btn" id="bjm-declare-win" type="button">🎴 화료! (${canWin.formula.han}, ${canWin.score}번)</button>` : ''}
        </div>
        <div class="bjm-my-hand" id="bjm-my-hand">${_myHandHtml(myHand, isMyTurn)}</div>
        <div class="bjm-cat-legend">
          ${Object.entries(HERB_CAT_META).filter(([k]) => k !== 'default').map(([k, m]) =>
            `<span class="bjm-leg" style="background:${m.bg};color:${m.text};border-color:${m.color}">${esc(m.name)}</span>`
          ).join('')}
        </div>
        <div class="bjm-my-discards"><span style="font-size:11px;color:#666">내가 버린: </span><span id="bjm-my-disc">${_myDiscardsHtml(me && me.discards)}</span></div>
      </div>
      <button class="btn btn-o" id="bjm-leave-game" type="button" style="margin-top:10px">포기</button>
    </div>
  `;

  _bindGameTableEvents(rid);
  // 초기 손패 길이 기록 (draw 감지용)
  const hand0 = document.getElementById('bjm-my-hand');
  if(hand0) hand0.dataset.len = String(myHand.length);
  if(isMyTurn) try{ sfx('turn'); }catch(_){}
}

// 부분 업데이트 — drawGameTable 호출 없이 변하는 부분만 patch
function updateGameTable(rid, room){
  const root = document.getElementById('bjm-game-root');
  if(!root){ drawGameTable(rid, room, (room.players||{})[myUid()]); return; }

  const isMyTurn = room.turnUserId === myUid();
  const me = (room.players||{})[myUid()] || {};
  const myHand = me.hand || [];
  const canWin = checkWinning(myHand);

  // 헤더 정보
  const info = document.getElementById('bjm-info');
  if(info) info.textContent = `턴 ${room.turn||0}/${MAX_TURNS} · 덱 ${(room.deck||[]).length}장`;

  // 턴 인디케이터
  const ti = document.getElementById('bjm-turn-ind');
  if(ti){
    const wasActive = ti.classList.contains('is-active');
    ti.classList.toggle('is-active', isMyTurn);
    ti.textContent = isMyTurn ? '☀ 내 턴 — 1장 클릭해서 버리기' : '⏳ 상대 턴 대기 中…';
    if(isMyTurn && !wasActive) try{ sfx('turn'); }catch(_){}
  }

  // 화료 버튼
  const wbw = document.getElementById('bjm-win-btn-wrap');
  if(wbw){
    const had = !!wbw.querySelector('#bjm-declare-win');
    if(canWin && !had){
      wbw.innerHTML = `<button class="btn btn-gold bjm-win-btn" id="bjm-declare-win" type="button">🎴 화료! (${canWin.formula.han}, ${canWin.score}번)</button>`;
      const b = document.getElementById('bjm-declare-win');
      if(b) b.addEventListener('click', () => { _lockPolling(1000); declareWin(rid); });
    } else if(!canWin && had){
      wbw.innerHTML = '';
    } else if(canWin && had){
      // 텍스트 갱신
      const b = wbw.querySelector('#bjm-declare-win');
      if(b) b.textContent = `🎴 화료! (${canWin.formula.han}, ${canWin.score}번)`;
    }
  }

  // 내 손패
  const hand = document.getElementById('bjm-my-hand');
  if(hand){
    // 새 카드 뽑힘 감지 — 손패가 늘었으면 draw 사운드 (내 턴 시작)
    const prevLen = parseInt(hand.dataset.len || '0', 10);
    if(myHand.length > prevLen && prevLen > 0){
      try{ sfx('draw'); }catch(_){}
    }
    hand.dataset.len = String(myHand.length);
    hand.innerHTML = _myHandHtml(myHand, isMyTurn);
    if(isMyTurn){
      Array.from(hand.querySelectorAll('.bjm-card.is-clickable')).forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx, 10);
          _lockPolling(800);
          try{ sfx('discard'); }catch(_){}
          // 즉시 시각 피드백 — 카드 빠지는 애니메이션
          el.classList.add('is-discarding');
          setTimeout(() => discard(rid, idx), 130);
        });
      });
    }
  }

  // 내가 버린 패
  const mdisc = document.getElementById('bjm-my-disc');
  if(mdisc) mdisc.innerHTML = _myDiscardsHtml(me.discards);

  // 상대 영역 — 전체 갈아끼우기 (개수가 적어 부담 적음)
  const opp = document.getElementById('bjm-opponents');
  if(opp){
    const players = Object.entries(room.players||{}).sort((a,b) => a[1].seat - b[1].seat);
    const newHtml = players.filter(([uid]) => uid !== myUid()).map(([uid, p]) => _opponentBlockHtml(uid, p, room)).join('');
    if(opp.innerHTML !== newHtml) opp.innerHTML = newHtml;
  }
}

function _bindGameTableEvents(rid){
  const wb = document.getElementById('bjm-declare-win');
  if(wb) wb.addEventListener('click', () => { _lockPolling(1000); declareWin(rid); });

  // 손패 클릭
  $$('.bjm-card.is-clickable').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx, 10);
      _lockPolling(800);
      try{ sfx('discard'); }catch(_){}
      el.classList.add('is-discarding');
      setTimeout(() => discard(rid, idx), 130);
    });
  });

  const lg = document.getElementById('bjm-leave-game');
  if(lg) lg.addEventListener('click', () => {
    if(confirm('포기 하시겠습니까?')){
      clearInterval(window._bjmPoll);
      open();
    }
  });
}

// ─── 11) 룰북 ────────────────────────────────────────────────────────────
function showRulebook(){
  const html = `<div class="modal-body bjm-rulebook">
    <h3 class="han">方劑麻雀 룰북</h3>
    <p><b>1. 게임 목표</b><br>
    14장 본초 카드 덱에서 손패를 받아, 한 처방의 본초들을 모두 모으면 <b>화료</b>(和了) — 승리.</p>

    <p><b>2. 손패 / 진행</b><br>
    ・시작 손패: ${HAND_INIT}장<br>
    ・매 턴: 1장 뽑기 (손패 ${HAND_MAX}장) → 화료 가능하면 화료 선언, 아니면 1장 버리기 (다시 ${HAND_INIT}장)<br>
    ・최대 ${MAX_TURNS}턴 (이후 無勝負)</p>

    <p><b>3. 화료 조건</b><br>
    어떤 한 처방의 모든 본초를 손패에 보유 + 그 중 한 본초를 2장 보유 (君藥 雀頭)</p>

    <p><b>4. 役 (점수)</b></p>
    <table class="bjm-yaku-table">
      <tr><th>役名</th><th>처방 크기</th><th>점수</th><th>例</th></tr>
      <tr><td>小方役</td><td>2-3 본초</td><td>1번</td><td>當歸補血湯, 小承氣湯</td></tr>
      <tr><td>中方役</td><td>4-5 본초</td><td>2-4번</td><td>四君子湯, 桂枝湯</td></tr>
      <tr><td>大方役</td><td>6 본초</td><td>8번</td><td>二陳湯</td></tr>
      <tr><td>方役満</td><td>7 본초</td><td>16번</td><td>葛根湯, 小柴胡湯</td></tr>
    </table>

    <p><b>5. 처방 목록 (${FORMULAS.length}개)</b></p>
    <div class="bjm-formula-list">
      ${FORMULAS_BY_SIZE.map(F => `
        <div class="bjm-formula-card" data-size="${F.comp.length}">
          <span class="bjm-fc-size">${F.comp.length}장</span>
          <span class="han bjm-fc-han">${F.han}</span>
          <small>(${F.ko})</small>
          <div class="bjm-fc-comp han">${F.comp.join('·')}</div>
        </div>
      `).join('')}
    </div>

    <p style="font-size:11px;color:#888;margin-top:14px">
      덱: 본초 ${Object.keys(HERB_TO_F).length}종 / 총 ${DECK_TEMPLATE.length}장 카드<br>
      시뮬 결과: 4인 對局 평균 화료율 96% / 평균 시간 ~6분
    </p>
  </div>`;
  if(window.openModal) window.openModal(html);
}

// ─── 12) 노출 ──────────────────────────────────────────────────────────
window.V12Mahjong = {
  open, createRoom, joinRoom, startGame, discard, declareWin,
  addBot, renderRoom, showRulebook,
  createPublicAndEnter, startSoloVsAI, createPrivateAndEnter,
  FORMULAS, HERB_TO_F, DECK_TEMPLATE,
  HERB_CAT, HERB_CAT_META,
  checkWinning, handScore,
  sfx,
  VERSION:'12.6.0',
};

// ─── 13) 스타일 주입 ─────────────────────────────────────────────────────
if(!document.getElementById('v12-mahjong-style')){
  const st = document.createElement('style');
  st.id = 'v12-mahjong-style';
  st.textContent = `
    .bjm-lobby { padding: 14px 16px 22px; }
    .bjm-lobby .view-title { color:#1F3F2C; font-family:'ZCOOL XiaoWei',serif; font-size:24px; margin: 6px 0 4px; letter-spacing:4px; }
    .bjm-lobby .view-sub { color:#888; font-size:12px; margin-bottom:14px; }
    .bjm-step-label { font-family:'ZCOOL XiaoWei',serif; color:#1F3F2C; font-size:14px; margin:14px 0 8px; border-left:3px solid #3A6A4A; padding-left:8px; }
    .bjm-actions-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-bottom:6px; }
    .bjm-ai-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:6px; }
    .bjm-action-btn { background:#fff; border:1.5px solid #D8C9A0; border-radius:10px; padding:14px 10px; cursor:pointer; text-align:center; transition:all .15s; font-family:inherit; }
    .bjm-action-btn:hover { transform:translateY(-1px); border-color:#3A6A4A; }
    .bjm-action-btn.bjm-act-public { background:linear-gradient(135deg,#E8F5E8,#D0E8D0); border-color:#3A6A4A; }
    .bjm-action-btn.bjm-act-join { background:linear-gradient(135deg,#E8F0F8,#D0E0F0); border-color:#3A5A8A; }
    .bjm-action-btn.bjm-act-ai { background:linear-gradient(135deg,#FFF0E0,#FFE0C0); border-color:#C9701F; }
    .bjm-act-han { font-family:'ZCOOL XiaoWei',serif; font-size:17px; color:#1F3F2C; font-weight:600; }
    .bjm-act-join .bjm-act-han { color:#3A5A8A; }
    .bjm-act-ai .bjm-act-han { color:#C9701F; }
    .bjm-act-ko { font-size:11px; color:#666; margin-top:4px; }
    .bjm-public-list { display:flex; flex-direction:column; gap:6px; }
    .bjm-room { padding:10px 12px; background:#fff; border:1px solid #D8C9A0; border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:transform .15s; }
    .bjm-room:hover { transform:translateY(-1px); box-shadow:0 3px 8px rgba(0,0,0,.1); }
    .bjm-room-name { font-family:'ZCOOL XiaoWei',serif; font-size:14px; color:#1F3F2C; }
    .bjm-room-meta { font-size:11px; color:#888; }
    .bjm-empty { padding:14px; text-align:center; color:#888; font-size:12px; background:#FAF6EC; border-radius:8px; }

    /* === 좌석 (대기실) — 캐릭터 아바타 === */
    .bjm-seats { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:14px 0; }
    .bjm-seat { padding:10px 8px; background:#fff; border:1px solid #D8C9A0; border-radius:10px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:4px; }
    .bjm-seat.is-me { background:linear-gradient(135deg,#E8F5E8,#D0E8D0); border-color:#3A6A4A; box-shadow:0 0 0 2px rgba(58,106,74,.18); }
    .bjm-seat-avatar { width:54px; height:54px; border-radius:50%; overflow:hidden; background:#FAF6EC; border:2px solid #D8C9A0; display:flex; align-items:center; justify-content:center; }
    .bjm-seat-avatar img { width:100%; height:100%; object-fit:cover; }
    .bjm-seat-avatar-init { font-family:'ZCOOL XiaoWei',serif; font-size:24px; color:#1F3F2C; }
    .bjm-seat-name { font-family:'ZCOOL XiaoWei',serif; font-size:13px; color:#1F3F2C; font-weight:600; }
    .bjm-seat-seat { font-size:10px; color:#888; }

    .bjm-tools { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }
    .bjm-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:8px 12px; background:#1F3F2C; color:#F4E2C0; border-radius:6px; }
    .bjm-info { font-size:11px; opacity:.85; }

    /* === 상대 영역 === */
    .bjm-opponents { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:8px; margin-bottom:14px; }
    .bjm-opponent { padding:8px; background:#FAF6EC; border:1.5px solid #D8C9A0; border-radius:8px; transition:all .2s; }
    .bjm-opponent.is-turn { border-color:#C9701F; background:linear-gradient(135deg,#FFF8E0,#FFE5C0); box-shadow:0 0 0 2px rgba(201,112,31,.25); }
    .bjm-opp-header { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
    .bjm-opp-avatar { width:32px; height:32px; border-radius:50%; overflow:hidden; background:#fff; border:1.5px solid #D8C9A0; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .bjm-opp-avatar img { width:100%; height:100%; object-fit:cover; }
    .bjm-opp-avatar-init { font-family:'ZCOOL XiaoWei',serif; font-size:16px; color:#1F3F2C; }
    .bjm-opp-headtxt { flex:1; min-width:0; }
    .bjm-opp-name { font-size:12px; font-weight:600; color:#1F3F2C; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .bjm-opp-meta { font-size:10px; color:#888; }
    .bjm-opp-hand { display:flex; flex-wrap:wrap; gap:2px; margin-bottom:6px; min-height:18px; }
    .bjm-back-card { width:9px; height:14px; background:linear-gradient(135deg,#3A6A4A,#2A4A35); border-radius:2px; display:inline-block; box-shadow:inset 0 1px 0 rgba(255,255,255,.15); }
    .bjm-opp-discards { display:flex; flex-wrap:wrap; gap:2px; min-height:18px; }

    /* === 본초 카드 (본초별 카테고리 색상) === */
    .bjm-my-area { padding:12px; background:#FAF6EC; border:2px solid #3A6A4A; border-radius:10px; }
    .bjm-turn-indicator { font-family:'ZCOOL XiaoWei',serif; color:#888; font-size:14px; margin-bottom:10px; text-align:center; transition:all .25s; }
    .bjm-turn-indicator.is-active { color:#C9701F; font-weight:600; font-size:16px; animation:bjm-pulse 1.8s ease-in-out infinite; }
    @keyframes bjm-pulse { 0%,100%{opacity:1} 50%{opacity:.65} }

    .bjm-my-hand { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0; min-height:62px; justify-content:center; }
    .bjm-card {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:6px 4px; min-width:48px; min-height:62px;
      background:var(--cat-bg, #fff);
      border:2px solid var(--cat, #888);
      border-radius:8px;
      cursor:default;
      transition:transform .15s, box-shadow .15s, opacity .12s;
      box-shadow:0 2px 4px rgba(0,0,0,.06), inset 0 1px 0 rgba(255,255,255,.4);
      position:relative;
    }
    .bjm-card-cat {
      font-size:9px;
      color:var(--cat, #888);
      background:rgba(255,255,255,.7);
      padding:1px 4px;
      border-radius:8px;
      margin-bottom:2px;
      font-weight:600;
      letter-spacing:1px;
    }
    .bjm-card-han {
      font-family:'ZCOOL XiaoWei',serif;
      font-size:18px;
      color:var(--cat-text, #222);
      font-weight:600;
      line-height:1.1;
    }
    .bjm-card.is-clickable { cursor:pointer; }
    .bjm-card.is-clickable:hover { transform:translateY(-5px); box-shadow:0 6px 12px rgba(0,0,0,.18); }
    .bjm-card.is-clickable:active { transform:translateY(-2px); }
    .bjm-card.is-discarding { animation:bjm-discard-anim .25s ease-out forwards; }
    @keyframes bjm-discard-anim {
      0%   { transform:translateY(0)    scale(1)   rotate(0);   opacity:1; }
      100% { transform:translateY(40px) scale(.6)  rotate(8deg); opacity:0; }
    }

    .bjm-cat-legend { display:flex; flex-wrap:wrap; gap:3px; justify-content:center; margin:6px 0 4px; padding-top:6px; border-top:1px dashed #D8C9A0; }
    .bjm-leg { display:inline-block; padding:1px 6px; border:1px solid; border-radius:8px; font-family:'ZCOOL XiaoWei',serif; font-size:10px; }

    .bjm-discard-mini {
      display:inline-block;
      padding:2px 5px;
      background:#fff;
      border:1px solid #D8C9A0;
      border-radius:4px;
      font-size:11px;
      margin:1px;
      font-weight:600;
    }
    .bjm-my-discards { font-size:11px; color:#666; margin-top:8px; padding-top:8px; border-top:1px dashed #D8C9A0; display:flex; flex-wrap:wrap; align-items:center; gap:2px; }

    .bjm-win-btn { animation:bjm-glow 1.4s ease-in-out infinite; margin-bottom:8px; }
    @keyframes bjm-glow {
      0%,100% { box-shadow:0 0 0 0 rgba(212,175,55,.6); }
      50%     { box-shadow:0 0 14px 4px rgba(212,175,55,.65); }
    }

    /* === 종료 화면 === */
    .bjm-finished { padding:20px; text-align:center; }
    .bjm-winner-block { padding:20px; background:linear-gradient(135deg,#FFF8E0,#FFE5C0); border:2px solid #D4AF37; border-radius:12px; margin:14px 0; }
    .bjm-winner-avatar { width:80px; height:80px; margin:0 auto 10px; border-radius:50%; overflow:hidden; border:3px solid #D4AF37; background:#fff; }
    .bjm-winner-avatar img { width:100%; height:100%; object-fit:cover; }
    .bjm-winner-name { font-family:'ZCOOL XiaoWei',serif; font-size:22px; color:#7C5810; font-weight:600; }
    .bjm-winner-formula { font-size:18px; margin:8px 0; color:#1F3F2C; }
    .bjm-winner-score { font-size:14px; color:#7C5810; }

    .bjm-yaku-table { width:100%; border-collapse:collapse; margin:8px 0; font-size:12px; }
    .bjm-yaku-table th, .bjm-yaku-table td { padding:4px 6px; border:1px solid #D8C9A0; text-align:left; }
    .bjm-yaku-table th { background:#FAF6EC; }
    .bjm-formula-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:6px; max-height:300px; overflow-y:auto; }
    .bjm-formula-card { padding:6px 8px; background:#fff; border:1px solid #D8C9A0; border-radius:4px; font-size:11px; }
    .bjm-fc-size { display:inline-block; padding:1px 4px; background:#3A6A4A; color:#fff; border-radius:3px; font-size:9px; margin-right:4px; }
    .bjm-fc-han { font-family:'ZCOOL XiaoWei',serif; font-size:13px; color:#1F3F2C; }
    .bjm-fc-comp { color:#666; font-size:10px; margin-top:2px; }
  `;
  document.head.appendChild(st);
}

console.log('[方劑麻雀 v12.6.0] 모듈 로드 — 새로고침 픽스 + 본초별 디자인 + 캐릭터 아이콘 + 사운드');
})();
