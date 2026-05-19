/* bangje-v12-jingxue-poker.js — 經穴 포커 v12.0
 * ============================================================================
 *  3 게임 변형 + 1 랜덤 매칭, 최대 8人, AI 봇, Firebase 멀티
 *
 *  모드:
 *    five_draw  五札引換   파이브카드 드로우 (5장+1회 교체)
 *    seven_card 七札對局   세븐 포커 (7장 분배, 5장 최강)
 *    holdem     德州式     텍사스 홀덤 (홀카드 2 + 커뮤니티 5)
 *    random     隨機       위 3종 중 랜덤
 *
 *  베팅: check, call, quarter(¼pot), half(½pot), pot(full), fold, allin
 *  최소 판돈: 참여자 평균 氣의 1/100, 50氣 하한
 *
 *  외부 API: window.V12JxPoker = { open(), createRoom, joinRoom, … }
 *  Firebase: jxpoker_rooms/{rid}
 * ============================================================================ */
(function(){
'use strict';

const FB_NODE = 'jxpoker_rooms';
const POLL_MS = 1500;
const TURN_SEC = 40;
const MIN_QI = 50;
const MAX_PLAYERS = 8;

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

function shuffle(a){
  const x=[...a];
  for(let i=x.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [x[i],x[j]]=[x[j],x[i]];
  }
  return x;
}
function deck(){ return window.JINGXUE_POKER ? [...window.JINGXUE_POKER.DECK] : []; }
function evalHand(h){ return window.JINGXUE_POKER ? window.JINGXUE_POKER.evaluate(h) : {rank:0,key:'empty',hand:h}; }
function handLabel(r){
  const K = window.JINGXUE_POKER && window.JINGXUE_POKER.HAND_KO[r.key];
  return K ? `${K.han} (${K.ko})` : '?';
}

// ─── 1) 방 만들기 / 입장 / 시작 ────────────────────────────────
async function createRoom(opts){
  const f = fb();
  if(!f || !myUid()){ toast('네트워크/사용자 없음','warn'); return null; }
  opts = Object.assign({mode:'five_draw', maxPlayers:8, isPublic:true, name:''}, opts);
  if(opts.mode === 'random'){
    const pool = ['five_draw','seven_card','holdem'];
    opts.mode = pool[Math.floor(Math.random()*pool.length)];
  }
  const rid = roomCode();
  const room = {
    roomId: rid, status:'waiting', hostId: myUid(),
    name: opts.name || `${myName()}의 經穴 포커방`,
    mode: opts.mode, maxPlayers: Math.min(MAX_PLAYERS, opts.maxPlayers||8),
    isPublic: !!opts.isPublic, createdAt: nowMs(),
    players: { [myUid()]: {
      name: myName(), character: (S_()||{}).character||null,
      qi: myQi(), isHost:true, isReady:true, isBot:false,
      seat:0, joinedAt: nowMs(), folded:false, chips: 0, currentBet:0,
    }},
    pot:0, minBet:MIN_QI, board:[], deck:[],
    turnOrder:[], turnIdx:0, turnUserId:'', turnStartedAt:0,
    phase:'lobby', // lobby → deal → bet1 → swap (only five_draw) → bet2 → showdown
    lastAction:null, round:0,
  };
  const ok = await f.put(`${FB_NODE}/${rid}`, room);
  return ok ? rid : null;
}

async function joinRoom(rid){
  const f = fb();
  if(!f || !myUid()) return {ok:false, msg:'네트워크 없음'};
  rid = String(rid||'').toUpperCase().trim();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return {ok:false, msg:'방 없음'};
  if(room.status !== 'waiting') return {ok:false, msg:'이미 시작'};
  const ps = room.players || {};
  if(ps[myUid()]) return {ok:true, roomId:rid, rejoin:true};
  if(Object.keys(ps).length >= room.maxPlayers) return {ok:false, msg:'가득참'};
  const seat = Object.keys(ps).length;
  await f.put(`${FB_NODE}/${rid}/players/${myUid()}`, {
    name: myName(), character: (S_()||{}).character||null, qi: myQi(),
    isHost:false, isReady:false, isBot:false, seat, joinedAt: nowMs(),
    folded:false, chips:0, currentBet:0,
  });
  return {ok:true, roomId:rid};
}

async function addBot(rid){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room || room.hostId !== myUid()) return;
  const ps = room.players || {};
  if(Object.keys(ps).length >= room.maxPlayers) return toast('가득참','warn');
  const botNames = ['岐伯AI','華佗AI','扁鵲AI','張仲景AI','孫思邈AI','李時珍AI','許浚AI'];
  const used = new Set(Object.values(ps).map(p=>p.name));
  const name = botNames.find(n => !used.has(n)) || `Bot${Object.keys(ps).length}`;
  const seat = Object.keys(ps).length;
  const botUid = `bot_${seat}_${nowMs()}`;
  await f.put(`${FB_NODE}/${rid}/players/${botUid}`, {
    name, character: null, qi: 800 + Math.floor(Math.random()*1200),
    isHost:false, isReady:true, isBot:true, seat, joinedAt: nowMs(),
    folded:false, chips:0, currentBet:0,
  });
}

async function setReady(rid, ready){
  const f = fb();
  if(!f || !myUid()) return;
  await f.put(`${FB_NODE}/${rid}/players/${myUid()}/isReady`, !!ready);
}

async function startGame(rid){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return {ok:false, msg:'방 없음'};
  if(room.hostId !== myUid()) return {ok:false, msg:'호스트만'};
  const ps = room.players || {};
  const uids = Object.keys(ps);
  if(uids.length < 2) return {ok:false, msg:'2人 이상 필요'};

  // 평균 氣 의 1/100 → 최소 베팅 단위 (50氣 하한)
  const avgQi = uids.reduce((a,u)=>a+(ps[u].qi||0),0) / uids.length;
  const minBet = Math.max(MIN_QI, Math.floor(avgQi/100));

  // 각자 시작 칩 = 평균 氣 의 1/2 (또는 자기 氣 중 작은 값)
  const startChips = Math.floor(avgQi/2);
  const order = uids.sort((a,b)=>(ps[a].seat||0)-(ps[b].seat||0));
  const d = shuffle(deck());

  // 모드별 카드 분배
  const handSize = (room.mode==='holdem') ? 2 : (room.mode==='seven_card' ? 3 : 5);
  // 세븐포커는 단계별 분배: 첫 3장(2 hole + 1 face-up), 이후 단계별 추가
  const hands = {};
  let cursor = 0;
  for(const uid of order){
    hands[uid] = d.slice(cursor, cursor+handSize);
    cursor += handSize;
  }
  const community = (room.mode==='holdem') ? [] : null; // 홀덤은 단계별 공개
  const remain = d.slice(cursor);

  // 각자 칩 세팅
  const playerPatches = {};
  for(const uid of order){
    const c = Math.min(startChips, ps[uid].qi||startChips);
    playerPatches[`players/${uid}/chips`] = c;
    playerPatches[`players/${uid}/currentBet`] = 0;
    playerPatches[`players/${uid}/folded`] = false;
  }

  const patches = {
    status:'playing', phase:'bet1',
    deck: remain, hands, community,
    minBet, pot:0, round:1,
    turnOrder: order, turnIdx:0, turnUserId: order[0],
    turnStartedAt: nowMs(), startedAt: nowMs(),
    lastAction:{type:'deal', at:nowMs()},
    ...playerPatches,
  };
  const tasks = Object.entries(patches).map(([k,v])=>f.put(`${FB_NODE}/${rid}/${k}`, v));
  await Promise.all(tasks);
  return {ok:true, roomId:rid, mode:room.mode};
}

// ─── 2) 베팅 액션 ────────────────────────────────────────────
async function bet(rid, action, amount){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return {ok:false, msg:'방 없음'};
  if(room.turnUserId !== myUid()) return {ok:false, msg:'당신 차례가 아님'};
  const ps = room.players || {};
  const me = ps[myUid()];
  if(!me) return {ok:false, msg:'참여자 아님'};

  const maxBet = Math.max(...Object.values(ps).map(p=>p.currentBet||0), 0);
  const myCur = me.currentBet || 0;
  const myChips = me.chips || 0;
  const pot = room.pot || 0;
  const minBet = room.minBet || MIN_QI;

  let put = 0, fold = false;
  switch(action){
    case 'check':
      if(maxBet > myCur) return {ok:false, msg:'체크 불가 (call 필요)'};
      break;
    case 'call':
      put = Math.min(maxBet - myCur, myChips);
      break;
    case 'quarter':
      put = Math.min(Math.max(Math.floor(pot/4), minBet), myChips);
      break;
    case 'half':
      put = Math.min(Math.max(Math.floor(pot/2), minBet), myChips);
      break;
    case 'pot':
      put = Math.min(Math.max(pot, minBet), myChips);
      break;
    case 'allin':
      put = myChips;
      break;
    case 'fold':
      fold = true; break;
    default:
      return {ok:false, msg:'알 수 없는 액션'};
  }

  const patches = {};
  if(fold){
    patches[`players/${myUid()}/folded`] = true;
  } else if(put > 0){
    patches[`players/${myUid()}/chips`]      = myChips - put;
    patches[`players/${myUid()}/currentBet`] = myCur + put;
    patches['pot']                            = pot + put;
  }
  // 다음 사람으로
  const order = room.turnOrder || [];
  let nIdx = (room.turnIdx + 1) % order.length;
  for(let i=0;i<order.length;i++){
    if(!ps[order[nIdx]].folded) break;
    nIdx = (nIdx + 1) % order.length;
  }
  patches['turnIdx'] = nIdx;
  patches['turnUserId'] = order[nIdx];
  patches['turnStartedAt'] = nowMs();
  patches['lastAction'] = {by:myUid(), type:action, amount:put, at:nowMs()};

  const tasks = Object.entries(patches).map(([k,v])=>f.put(`${FB_NODE}/${rid}/${k}`, v));
  await Promise.all(tasks);
  return {ok:true};
}

// ─── 3) 파이브 드로우 — 카드 교체 (1회) ──────────────────────
async function swapCards(rid, replaceIdx){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room || room.mode !== 'five_draw') return {ok:false, msg:'모드 아님'};
  if(room.phase !== 'swap') return {ok:false, msg:'교체 단계 아님'};
  const myHand = (room.hands && room.hands[myUid()]) || [];
  const dd = [...(room.deck||[])];
  const newHand = myHand.map((c,i) => replaceIdx.includes(i) ? dd.shift() : c);
  await f.put(`${FB_NODE}/${rid}/hands/${myUid()}`, newHand);
  await f.put(`${FB_NODE}/${rid}/deck`, dd);
  return {ok:true};
}

// ─── 4) 쇼다운 ──────────────────────────────────────────────
async function showdown(rid){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return null;
  const ps = room.players || {};
  const community = room.community || [];
  let best = null;
  let bestUid = null;
  let results = [];
  for(const uid of Object.keys(ps)){
    if(ps[uid].folded) continue;
    const h = [...(room.hands[uid]||[]), ...community];
    const r = evalHand(h);
    results.push({uid, name: ps[uid].name, rank: r.rank, key: r.key});
    if(!best || r.rank > best.rank){ best = r; bestUid = uid; }
  }
  results.sort((a,b)=>b.rank - a.rank);
  // 우승자에게 pot
  if(bestUid){
    await f.put(`${FB_NODE}/${rid}/players/${bestUid}/chips`, (ps[bestUid].chips||0) + (room.pot||0));
  }
  await f.put(`${FB_NODE}/${rid}/status`, 'done');
  await f.put(`${FB_NODE}/${rid}/phase`, 'showdown');
  await f.put(`${FB_NODE}/${rid}/results`, results);
  // 氣 정산 (실제 사용자만)
  for(const uid of Object.keys(ps)){
    if(ps[uid].isBot) continue;
    const finalChips = (uid===bestUid ? (ps[uid].chips||0)+(room.pot||0) : (ps[uid].chips||0));
    const startChips = Math.floor(Object.values(ps).reduce((a,p)=>a+(p.qi||0),0)/Object.keys(ps).length/2);
    const delta = finalChips - startChips;
    try{
      if(window.S && typeof window.S.userId === 'string' && uid === window.S.userId){
        window.S.qi = (window.S.qi||0) + delta;
        if(window.saveProfile) window.saveProfile();
      }
    }catch(_){}
  }
  return { results, winner: bestUid };
}

// ─── 5) AI 봇 의사결정 (간이) ──────────────────────────────
function botDecide(room, uid){
  const ps = room.players || {};
  const p = ps[uid]; if(!p) return null;
  const h = [...(room.hands[uid]||[]), ...(room.community||[])];
  const r = evalHand(h);
  const strong = r.rank >= 7;     // 풀하우스 이상
  const medium = r.rank >= 4;     // 쓰리카드 이상
  const maxBet = Math.max(...Object.values(ps).map(x=>x.currentBet||0), 0);
  const myCur = p.currentBet || 0;
  const callAmt = maxBet - myCur;
  if(strong){
    if(Math.random() < 0.6) return {action:'half'};
    return {action:'call'};
  }
  if(medium){
    if(callAmt === 0) return {action:'check'};
    if(callAmt <= (room.minBet||MIN_QI) * 5) return {action:'call'};
    return {action: Math.random()<0.4 ? 'call' : 'fold'};
  }
  // weak
  if(callAmt === 0) return {action:'check'};
  if(callAmt <= (room.minBet||MIN_QI) * 2 && Math.random()<0.5) return {action:'call'};
  return {action:'fold'};
}

// 봇 자동 진행 — 호스트가 polling 중 자기 차례 봇 발견하면 대신 베팅
async function maybeStepBot(rid){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room || room.status !== 'playing') return;
  const ps = room.players || {};
  const turnUid = room.turnUserId;
  if(!turnUid || !ps[turnUid] || !ps[turnUid].isBot) return;
  if(room.hostId !== myUid()) return; // 호스트만 봇 진행
  const d = botDecide(room, turnUid);
  if(!d) return;
  // 봇 베팅 (myUid 가 아니므로 직접 패치)
  await applyBotBet(rid, turnUid, d.action);
}

async function applyBotBet(rid, uid, action){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  const ps = room.players || {};
  const me = ps[uid]; if(!me) return;
  const maxBet = Math.max(...Object.values(ps).map(p=>p.currentBet||0), 0);
  const myCur = me.currentBet||0, myChips = me.chips||0;
  const pot = room.pot||0, minBet = room.minBet||MIN_QI;
  let put = 0, fold = false;
  if(action==='fold') fold = true;
  else if(action==='check') {}
  else if(action==='call') put = Math.min(maxBet - myCur, myChips);
  else if(action==='half') put = Math.min(Math.max(Math.floor(pot/2), minBet), myChips);
  else if(action==='quarter') put = Math.min(Math.max(Math.floor(pot/4), minBet), myChips);

  const patches = {};
  if(fold) patches[`players/${uid}/folded`] = true;
  else if(put > 0){
    patches[`players/${uid}/chips`] = myChips - put;
    patches[`players/${uid}/currentBet`] = myCur + put;
    patches['pot'] = pot + put;
  }
  const order = room.turnOrder || [];
  let nIdx = (room.turnIdx + 1) % order.length;
  for(let i=0;i<order.length;i++){
    if(!ps[order[nIdx]].folded) break;
    nIdx = (nIdx + 1) % order.length;
  }
  patches['turnIdx'] = nIdx;
  patches['turnUserId'] = order[nIdx];
  patches['turnStartedAt'] = nowMs();
  patches['lastAction'] = {by:uid, type:action, amount:put, at:nowMs(), bot:true};
  const tasks = Object.entries(patches).map(([k,v])=>f.put(`${FB_NODE}/${rid}/${k}`, v));
  await Promise.all(tasks);
}

// ─── 6) UI — 메인 진입 ──────────────────────────────────────
// 현재 선택된 모드 (home 화면 mode picker 상태)
let _pickedMode = 'five_draw';

function open(){
  const v = view(); if(!v) return;
  v.innerHTML = `
    <div class="jxp-lobby fade-in">
      <h2 class="view-title"><span class="han">經穴</span> 포커</h2>
      <div class="view-sub">361穴 카드 덱 · 14단계 족보 · 최대 8人 · 학술 보너스 4종 (★)</div>

      <div class="jxp-step-label">① 모드 선택</div>
      <div class="jxp-mode-grid">
        ${modeCard('five_draw',  '五札引換', '파이브카드 드로우', '5장 + 1회 교체')}
        ${modeCard('seven_card', '七札對局', '세븐 포커', '7장 중 5장 최강')}
        ${modeCard('holdem',     '德州式',   '텍사스 홀덤', '홀 2 + 커뮤니티 5')}
        ${modeCard('random',     '隨機',     '랜덤 배정', '위 3종 중 무작위')}
      </div>

      <div class="jxp-step-label">② 對局 시작</div>
      <div class="jxp-actions-grid">
        <button class="jxp-action-btn jxp-act-public" type="button" id="jxp-act-public">
          <div class="jxp-act-han">公開房 만들기</div>
          <div class="jxp-act-ko">새 방 개설 · 다른 醫家 대기</div>
        </button>
        <button class="jxp-action-btn jxp-act-ai" type="button" id="jxp-act-ai">
          <div class="jxp-act-han">AI와 大局</div>
          <div class="jxp-act-ko">AI 3봇 즉시 대국</div>
        </button>
        <button class="jxp-action-btn" type="button" id="jxp-act-private">
          <div class="jxp-act-han">私房 만들기</div>
          <div class="jxp-act-ko">코드로 친구 초대</div>
        </button>
        <button class="jxp-action-btn" type="button" id="jxp-act-joincode">
          <div class="jxp-act-han">私房 코드 입장</div>
          <div class="jxp-act-ko">4자 코드 입력</div>
        </button>
      </div>

      <div class="jxp-step-label">③ 모집 中 公開房 <small style="opacity:.6">(클릭 즉시 합류)</small></div>
      <div class="jxp-public-list" id="jxp-public-list"></div>

      <div style="margin-top:14px;text-align:center">
        <button class="btn btn-o" type="button" id="jxp-howto">📜 族譜·룰 보기 (14단계 + 확률표)</button>
      </div>
    </div>
  `;
  // 모드 카드 — 선택 토글
  $$('.jxp-mode').forEach(el => {
    if(el.dataset.mode === _pickedMode) el.classList.add('is-picked');
    el.addEventListener('click', () => {
      _pickedMode = el.dataset.mode;
      $$('.jxp-mode').forEach(e => e.classList.toggle('is-picked', e.dataset.mode === _pickedMode));
    });
  });
  // 액션 4종
  $('#jxp-act-public').addEventListener('click', () => createPublicAndEnter(_pickedMode));
  $('#jxp-act-ai').addEventListener('click',     () => startSoloVsAI(_pickedMode));
  $('#jxp-act-private').addEventListener('click',() => createPrivateAndEnter(_pickedMode));
  $('#jxp-act-joincode').addEventListener('click', promptJoinCode);
  $('#jxp-howto').addEventListener('click', showRulebook);
  renderPublicList();
}

// ─── ② 액션 헬퍼 ──────────────────────────────────────────────────────────

// 公開房 즉시 만들고 V12Intro 컷 → 다른 醫家 대기
async function createPublicAndEnter(mode){
  if(!fb() || !myUid()){
    if(typeof toast === 'function') toast('네트워크 미연결','warn');
    return;
  }
  const rid = await createRoom({mode, maxPlayers:8, isPublic:true});
  if(!rid){
    if(typeof toast === 'function') toast('公開房 생성 실패','warn');
    return;
  }
  if(window.V12Intro && window.V12Intro.show){
    const me = { id: myUid(), name: myName(), character: (S_()||{}).character };
    window.V12Intro.show({
      gameLabel:'經穴포커', subLabel: '公開房 · ' + MODE_LABEL(mode),
      han:'卦', players:[me],
      startLabel:'바로 시작 (AI 채움)',
      waitText:`방 코드 ${rid} · 다른 醫家가 합류할 때까지 대기. 「바로 시작」을 누르면 AI 봇으로 채워 시작합니다.`,
      onStart:()=>{ window.V12Intro.hide && window.V12Intro.hide(); _fillBotsAndStart(rid); },
      onCancel:()=>{ window.V12Intro.hide && window.V12Intro.hide(); renderRoom(rid); },
    });
  } else renderRoom(rid);
}

// AI와 즉시 대국 — 私房 생성 + AI 봇 3명 추가 + 자동 시작
async function startSoloVsAI(mode){
  if(!fb() || !myUid()){
    if(typeof toast === 'function') toast('네트워크 미연결','warn');
    return;
  }
  const rid = await createRoom({mode, maxPlayers:4, isPublic:false, name:`${myName()}의 AI 대국`});
  if(!rid){
    if(typeof toast === 'function') toast('방 생성 실패','warn');
    return;
  }
  // AI 봇 3명 추가
  await addBot(rid); await addBot(rid); await addBot(rid);

  if(window.V12Intro && window.V12Intro.show){
    const me = { id: myUid(), name: myName(), character: (S_()||{}).character };
    // 봇 이름 미리 결정 (UI 표시용)
    const f = fb();
    const room = await f.get(`${FB_NODE}/${rid}`);
    const bots = Object.entries(room.players||{})
      .filter(([uid, p]) => p.isBot)
      .map(([uid, p]) => ({ id: uid, name: p.name, character: ['qibo','huatuo','bianque'][Math.floor(Math.random()*3)] }));
    window.V12Intro.show({
      gameLabel:'經穴포커', subLabel: 'AI 對局 · ' + MODE_LABEL(mode),
      han:'卦', players:[me, ...bots],
      startLabel:'對局 시작',
      waitText:'AI 봇 3명과 대국합니다',
      onStart: async () => {
        window.V12Intro.hide && window.V12Intro.hide();
        await startGame(rid);
        renderRoom(rid);
      },
      onCancel: () => { window.V12Intro.hide && window.V12Intro.hide(); renderRoom(rid); },
    });
  } else {
    await startGame(rid);
    renderRoom(rid);
  }
}

// 私房 만들기 — 코드만 받아서 친구 초대
async function createPrivateAndEnter(mode){
  if(!fb() || !myUid()){
    if(typeof toast === 'function') toast('네트워크 미연결','warn');
    return;
  }
  const rid = await createRoom({mode, maxPlayers:8, isPublic:false});
  if(!rid){
    if(typeof toast === 'function') toast('私房 생성 실패','warn');
    return;
  }
  alert(`私房 코드: ${rid}\n친구에게 이 코드를 알려주세요.\n친구는 「私房 코드 입장」 으로 들어옵니다.`);
  renderRoom(rid);
}

// 公開房 「바로 시작」 시 AI 봇으로 채우고 게임 시작
async function _fillBotsAndStart(rid){
  const f = fb();
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return;
  const cur = Object.keys(room.players||{}).length;
  const need = Math.max(0, Math.min(3, 4 - cur));  // 최소 4명 채움 (호스트 + 봇들)
  for(let i = 0; i < need; i++) await addBot(rid);
  await startGame(rid);
  renderRoom(rid);
}

// 모드 라벨 (UI 표시용 helper)
function MODE_LABEL(mode){
  return ({
    five_draw:  '五札引換',
    seven_card: '七札對局',
    holdem:     '德州式',
    random:     '隨機',
  })[mode] || mode;
}

function modeCard(mode, han, ko, desc){
  return `<div class="jxp-mode" data-mode="${mode}">
    <div class="jxp-mode-han han">${han}</div>
    <div class="jxp-mode-ko">${ko}</div>
    <div class="jxp-mode-desc">${desc}</div>
  </div>`;
}

// legacy — 기존 openCreateModal 호출 시 createPublicAndEnter 로 위임 (호환)
function openCreateModal(mode){
  return createPublicAndEnter(mode);
}

async function renderPublicList(){
  const f = fb(); if(!f) return;
  const all = await f.get(FB_NODE);
  const list = $('#jxp-public-list'); if(!list) return;
  const rooms = Object.values(all||{}).filter(r=>r && r.isPublic && r.status==='waiting');
  if(!rooms.length){
    list.innerHTML = '<div class="jxp-empty">현재 모집 中인 公開房이 없습니다 — 「公開房 만들기」로 첫 호스트가 되어보세요</div>';
    return;
  }
  list.innerHTML = rooms.map(r=>{
    const n = Object.keys(r.players||{}).length;
    return `<div class="jxp-room" data-rid="${esc(r.roomId)}">
      <div>
        <div class="jxp-room-name">${esc(r.name)}</div>
        <div class="jxp-room-meta">${MODE_LABEL(r.mode)} · ${n}/${r.maxPlayers}人 · 최소 ${r.minBet||MIN_QI}氣</div>
      </div>
      <div style="font-size:11px;color:#3A6A4A;font-weight:600">→ 합류</div>
    </div>`;
  }).join('');
  $$('.jxp-room', list).forEach(el => el.addEventListener('click', async ()=>{
    const rid = el.dataset.rid;
    const r = await joinRoom(rid);
    if(r.ok) renderRoom(rid);
    else toast(r.msg, 'warn');
  }));
}

function promptJoinCode(){
  const code = prompt('방 코드 (4자)');
  if(!code) return;
  joinRoom(code).then(r=>{
    if(r.ok) renderRoom(r.roomId);
    else toast(r.msg,'warn');
  });
}

function showRulebook(){
  if(!window.JINGXUE_POKER) return;
  const P = window.JINGXUE_POKER;
  const tbl = P.PROBABILITY_TABLE.map((row,i)=>{
    const K = P.HAND_KO[row.key];
    return `<tr>
      <td>${P.HAND_RANKS[row.key]}</td>
      <td class="han">${K.han}</td>
      <td>${K.ko}</td>
      <td>${K.desc}</td>
      <td>${row.prob_pct.toFixed(4)}%</td>
      <td>1 in ${row.one_in.toLocaleString()}</td>
    </tr>`;
  }).join('');
  const html = `<div class="modal-body">
    <h3 class="han">經穴포커 族譜 (확률 강→약)</h3>
    <table class="jxp-rules">
      <tr><th>우선</th><th>族譜</th><th>韓</th><th>설명</th><th>확률</th><th>1 in N</th></tr>
      ${tbl}
    </table>
    <p style="font-size:11px;color:#888;margin-top:8px">
      ★ = 한의학 학술 특수 족보 (表裏原絡·募兪相應·六腑下合·聖手鍼經)<br>
      덱 124장 — 12 정경 五輸·特定要穴 + 任督脈 대표혈
    </p>
  </div>`;
  if(window.openModal) window.openModal(html);
}

function renderRoom(rid){
  // 자세한 핸드/베팅 UI 는 별도 구현 — 여기는 골격만
  const v = view(); if(!v) return;
  v.innerHTML = `<div class="jxp-room-view fade-in" data-rid="${esc(rid)}">
    <div class="jxp-room-header">
      <h2 class="han">經穴 포커 — ${esc(rid)}</h2>
      <button class="btn-icon" id="jxp-rules-toggle" title="족보 보기">📜</button>
    </div>
    <div class="jxp-pot" id="jxp-pot">판돈: 0氣</div>
    <div class="jxp-table" id="jxp-table"></div>
    <div class="jxp-community" id="jxp-community"></div>
    <div class="jxp-hand" id="jxp-hand"></div>
    <div class="jxp-rank" id="jxp-rank"></div>
    <div class="jxp-actions">
      <button class="btn" data-act="check">체크</button>
      <button class="btn" data-act="call">콜</button>
      <button class="btn" data-act="quarter">쿼터(¼)</button>
      <button class="btn" data-act="half">하프(½)</button>
      <button class="btn" data-act="pot">풀(=pot)</button>
      <button class="btn" data-act="allin">올인</button>
      <button class="btn btn-o" data-act="fold">폴드</button>
    </div>
    <div class="jxp-host-tools" id="jxp-host-tools"></div>
  </div>`;
  $('#jxp-rules-toggle').addEventListener('click', showRulebook);
  $$('.jxp-actions [data-act]').forEach(b => b.addEventListener('click', async ()=>{
    const r = await bet(rid, b.dataset.act);
    if(!r.ok) toast(r.msg, 'warn');
  }));
  // poll
  const poll = async ()=>{
    const f = fb();
    const room = await f.get(`${FB_NODE}/${rid}`);
    if(!room) return;
    updateRoomView(room, rid);
    if(room.status==='playing') maybeStepBot(rid);
  };
  poll();
  const t = setInterval(poll, POLL_MS);
  window._jxpPollTimer = t;
}

function updateRoomView(room, rid){
  const ps = room.players || {};
  $('#jxp-pot').textContent = `판돈: ${(room.pot||0).toLocaleString()}氣 · 최소 ${room.minBet||MIN_QI}氣 · ${room.phase||'대기'}`;
  const tbl = $('#jxp-table');
  if(tbl) tbl.innerHTML = Object.entries(ps).map(([uid,p])=>{
    const cur = room.turnUserId===uid ? 'current' : '';
    const fold = p.folded ? 'folded' : '';
    return `<div class="jxp-player ${cur} ${fold}">
      <div class="name">${esc(p.name)}${p.isBot?'<sup>AI</sup>':''}</div>
      <div class="chips">${(p.chips||0).toLocaleString()}氣</div>
      <div class="bet">베팅: ${(p.currentBet||0).toLocaleString()}</div>
    </div>`;
  }).join('');
  const myHand = (room.hands && room.hands[myUid()]) || [];
  $('#jxp-hand').innerHTML = myHand.map((c,i)=>`
    <div class="jxp-card" data-idx="${i}" style="border-color:${c.mer_color||'#888'}">
      ${window.JINGXUE_POKER && window.JINGXUE_POKER.cardLabel ? window.JINGXUE_POKER.cardLabel(c) : esc(c.han)}
    </div>`).join('');
  if(myHand.length>=5){
    const r = evalHand(myHand);
    $('#jxp-rank').innerHTML = `<b>현재 족보:</b> ${handLabel(r)}`;
  } else {
    $('#jxp-rank').innerHTML = '';
  }
  const tools = $('#jxp-host-tools');
  if(room.hostId === myUid()){
    if(room.status === 'waiting'){
      tools.innerHTML = `<button class="btn btn-gold" id="jxp-start">對局 시작</button>
                        <button class="btn" id="jxp-add-bot">AI 추가</button>`;
      $('#jxp-start').addEventListener('click', async ()=>{
        const r = await startGame(rid);
        if(!r.ok) toast(r.msg,'warn');
        else if(window.V12Intro && window.V12Intro.show) {
          // 대국 시작 컷 — 모든 참여자 표시
          const ps = room.players || {};
          const participants = Object.entries(ps).map(([uid, p]) => ({ id: uid, name: p.name, character: p.character }));
          window.V12Intro.show({
            gameLabel:'經穴포커', subLabel: room.mode === 'random' ? '隨機' : room.mode,
            han:'卦', players: participants,
            pot: { label:'최소 베팅', value: room.minBet || MIN_QI },
            startLabel:'對局開始',
            onStart: ()=> window.V12Intro.hide && window.V12Intro.hide(),
          });
        }
      });
      $('#jxp-add-bot').addEventListener('click', ()=>addBot(rid));
    } else if(room.status === 'playing'){
      tools.innerHTML = `<button class="btn" id="jxp-showdown">쇼다운</button>`;
      $('#jxp-showdown').addEventListener('click', ()=>showdown(rid));
    } else {
      tools.innerHTML = `<button class="btn" id="jxp-leave">나가기</button>`;
      $('#jxp-leave').addEventListener('click', ()=>{
        clearInterval(window._jxpPollTimer);
        if(window.setTab) window.setTab('saamdoin');
      });
    }
  }
}

// 외부 노출
window.V12JxPoker = {
  open, createRoom, joinRoom, startGame, bet, swapCards, showdown,
  addBot, setReady, renderRoom, showRulebook,
  createPublicAndEnter, startSoloVsAI, createPrivateAndEnter,   // v12.3 신규
  VERSION:'12.3',
};

// ─── 스타일 주입 (모듈 1회만) ─────────────────────────────────────────────
if(!document.getElementById('v12-jxpoker-style')){
  const st = document.createElement('style');
  st.id = 'v12-jxpoker-style';
  st.textContent = `
    .jxp-lobby { padding: 14px 16px 22px; }
    .jxp-lobby .view-title { margin: 6px 0 4px; font-family:'ZCOOL XiaoWei',serif; color:#7C5810; font-size:24px; letter-spacing:4px; }
    .jxp-lobby .view-sub { font-size:12px; color:#888; margin-bottom:14px; }
    .jxp-step-label { font-family:'ZCOOL XiaoWei',serif; color:#7C5810; font-size:14px; margin:14px 0 8px; padding-left:4px; border-left:3px solid #D4AF37; padding-left:8px; }

    /* 모드 카드 그리드 (4칸, 모바일 2칸) */
    .jxp-mode-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:6px; }
    @media (max-width:520px){ .jxp-mode-grid { grid-template-columns:repeat(2, 1fr); } }
    .jxp-mode {
      background:#FAF6EC; border:1.5px solid #D8C9A0; border-radius:10px;
      padding:12px 8px; cursor:pointer; text-align:center; transition:all .15s;
      user-select:none;
    }
    .jxp-mode:hover { transform:translateY(-1px); border-color:#C9A227; }
    .jxp-mode.is-picked {
      background:linear-gradient(135deg, #FFF8E0, #FFE5C0);
      border-color:#D4AF37; box-shadow:0 0 0 2px #D4AF37 inset, 0 4px 12px rgba(212,175,55,.25);
    }
    .jxp-mode-han { font-family:'ZCOOL XiaoWei',serif; font-size:18px; color:#7C5810; font-weight:600; }
    .jxp-mode-ko  { font-size:11px; color:#666; margin-top:3px; }
    .jxp-mode-desc { font-size:10px; color:#999; margin-top:2px; line-height:1.3; }

    /* 액션 4 버튼 (2x2 그리드) */
    .jxp-actions-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-bottom:6px; }
    .jxp-action-btn {
      background:#fff; border:1.5px solid #D8C9A0; border-radius:10px;
      padding:14px 10px; cursor:pointer; text-align:center; transition:all .15s;
      font-family:inherit;
    }
    .jxp-action-btn:hover { transform:translateY(-1px); border-color:#C9A227; box-shadow:0 4px 12px rgba(201,162,39,.15); }
    .jxp-action-btn.jxp-act-public {
      background:linear-gradient(135deg, #FFF8E0, #FFE5C0); border-color:#D4AF37;
    }
    .jxp-action-btn.jxp-act-ai {
      background:linear-gradient(135deg, #E8F0E8, #D8E8D8); border-color:#3A6A4A;
    }
    .jxp-act-han { font-family:'ZCOOL XiaoWei',serif; font-size:17px; color:#7C5810; font-weight:600; }
    .jxp-act-ai .jxp-act-han { color:#3A6A4A; }
    .jxp-act-ko  { font-size:11px; color:#666; margin-top:4px; }

    /* 公開房 리스트 */
    .jxp-public-list { display:flex; flex-direction:column; gap:6px; min-height:40px; }
    .jxp-public-list .jxp-room {
      padding:10px 12px; background:#fff; border:1px solid #D8C9A0; border-radius:8px;
      cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:transform .15s;
    }
    .jxp-public-list .jxp-room:hover { transform:translateY(-1px); box-shadow:0 3px 8px rgba(0,0,0,0.1); }
    .jxp-public-list .jxp-empty { padding:14px; text-align:center; color:#888; font-size:12px; background:#FAF6EC; border-radius:8px; }
    .jxp-room-name { font-family:'ZCOOL XiaoWei',serif; font-size:14px; color:#7C5810; }
    .jxp-room-meta { font-size:11px; color:#888; }

    /* 게임 진행 카드 */
    .jxp-card { display:inline-block; padding:4px 6px; margin:2px; background:#fff;
      border:2px solid #888; border-radius:6px; min-width:50px; text-align:center; }
  `;
  document.head.appendChild(st);
}

console.log('[經穴포커 v12.3] 모듈 로드 — 公開房 만들기 + AI 對局 추가');
})();
