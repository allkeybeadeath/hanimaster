/* bangje-cube.js — 方劑Cube (방미큐브) v1.0
 * 본초 카드 2~4人 멀티 對局 — 루미큐브 룰 + 方劑學
 *  - 손패에서 본초 조합 → 처방(set) 만들어 보드에 출패
 *  - 유효 set = 완성 방제 | 派生方 | 증상별 加減
 *  - 보드 set 에 본초 추가 → 가감방 변형 · set 분해 후 재조합 가능
 *  - 손패 0장 먼저 비우면 승리
 * 전역 의존: FORMULAS, FORMULA_ADDITIONS, HERB_NORM_INDEX, HERBS, FB, S, esc, toast, openModal, closeModal
 * Firebase 노드: cube_rooms/{roomId}
 */
(function(){
'use strict';

// ──────────────────────────────────────────────────────────────────
// 0. 상수
// ──────────────────────────────────────────────────────────────────
const BC_VER          = '1.0';
const HAND_4P         = 10;
const HAND_23P        = 12;
const PENALTY_DRAW    = 3;
const TURN_SEC        = 90;
const POLL_MS         = 1800;
const REWARD_WIN      = 80;
const REWARD_RUNNER   = 20;
const FB_NODE         = 'cube_rooms';
const ROOM_TTL_WAIT   = 60 * 60 * 1000;
const ROOM_TTL_DONE   = 30 * 60 * 1000;

// ──────────────────────────────────────────────────────────────────
// 1. 유틸
// ──────────────────────────────────────────────────────────────────
const $  = (q, r) => (r||document).querySelector(q);
const $$ = (q, r) => Array.from((r||document).querySelectorAll(q));
const esc_ = (s) => (typeof esc === 'function')
  ? esc(s)
  : String(s||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const toast_ = (m, k) => { if(typeof toast === 'function') toast(m, k); };
const view = () => document.getElementById('view');
const fb  = () => (typeof FB !== 'undefined' && FB) || null;
const myUid = () => (typeof S !== 'undefined' && S && S.userId) || null;
const myName = () => (typeof S !== 'undefined' && S && S.name) || '醫家';

function herbNorm(h){
  if(!h) return null;
  const raw = String(h).trim(); if(!raw) return null;
  const idx = (typeof HERB_NORM_INDEX !== 'undefined') ? HERB_NORM_INDEX : null;
  if(idx && idx[raw]) return idx[raw];
  const stripped = raw.replace(/\([^)]*\)/g, '').trim();
  if(idx && idx[stripped]) return idx[stripped];
  return stripped;
}
function herbKo(han){
  if(typeof HERBS === 'undefined') return '';
  const h = HERBS.find(x => x.han === han);
  return h ? h.ko : '';
}
function herbSm(han){
  if(typeof HERBS === 'undefined') return '';
  const h = HERBS.find(x => x.han === han);
  return h ? h.sm : '';
}
function sortHerbs(a){ return [...a].sort((x,y) => x<y?-1:x>y?1:0); }
function sig(arr){ return sortHerbs(arr.map(herbNorm).filter(x=>x)).join('|'); }
function msetEq(a, b){ return a.length === b.length && sig(a) === sig(b); }
function boardHerbs(b){
  const all = [];
  for(const s of (b||[])) for(const h of (s.herbs||[])) all.push(h);
  return all;
}
function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
const nowMs = () => Date.now();
const roomCode = () => Math.random().toString(36).slice(2,6).toUpperCase();
const handInit = (n) => n >= 4 ? HAND_4P : HAND_23P;

// ──────────────────────────────────────────────────────────────────
// 2. VALID_SETS 사전 계산
// ──────────────────────────────────────────────────────────────────
let _sets = null, _sigIdx = null, _proto = null;

function build(){
  if(_sets) return;
  if(typeof FORMULAS === 'undefined' || typeof FORMULA_ADDITIONS === 'undefined'){
    console.warn('[方劑Cube] FORMULAS/FORMULA_ADDITIONS 로드되지 않음');
    _sets = []; _sigIdx = {}; _proto = []; return;
  }
  // EXTRA_HERB_ALIASES 를 HERB_NORM_INDEX 에 머지 (한 번만)
  if(typeof EXTRA_HERB_ALIASES !== 'undefined' && typeof HERB_NORM_INDEX !== 'undefined'){
    if(!HERB_NORM_INDEX.__extra_merged){
      for(const [han, aliases] of Object.entries(EXTRA_HERB_ALIASES)){
        HERB_NORM_INDEX[han] = han;
        (aliases||[]).forEach(a => { HERB_NORM_INDEX[a] = han; });
      }
      Object.defineProperty(HERB_NORM_INDEX, '__extra_merged', {value:true, enumerable:false});
    }
  }
  // 통합 처방 목록 — FORMULAS + FORMULAS_EXTRA
  const allFormulas = [...FORMULAS];
  if(typeof FORMULAS_EXTRA !== 'undefined' && Array.isArray(FORMULAS_EXTRA)){
    // id 중복 회피
    const existIds = new Set(FORMULAS.map(f => f.id));
    for(const F of FORMULAS_EXTRA) if(!existIds.has(F.id)) allFormulas.push(F);
  }
  // 통합 가감 목록 — FORMULA_ADDITIONS + EXTRA_ADDITIONS
  const allAdditions = Object.assign({}, FORMULA_ADDITIONS);
  if(typeof EXTRA_ADDITIONS !== 'undefined'){
    for(const [fid, obj] of Object.entries(EXTRA_ADDITIONS)){
      if(allAdditions[fid]) {
        allAdditions[fid] = { items: [...(allAdditions[fid].items||[]), ...(obj.items||[])] };
      } else {
        allAdditions[fid] = obj;
      }
    }
  }

  const sets = [], idx = {};
  const add = (s) => {
    s.sig = sig(s.herbs);
    sets.push(s);
    (idx[s.sig] = idx[s.sig] || []).push(s);
  };
  for(const F of allFormulas){
    const h = F.composition.map(herbNorm).filter(x=>x);
    if(h.length < 2) continue;
    add({ type:'base', label:F.ko, han:F.han, herbs:h, formulaId:F.id,
          chapter:F.chapter||'', action:F.action||'', extra: !FORMULAS.find(x=>x.id===F.id) ? false : true });
  }
  // extra flag — base 셋의 origin 표시 (UI에서 색 구분)
  for(const s of sets){
    if(s.type === 'base'){
      s.extra = !FORMULAS.find(x => x.id === s.formulaId);
    }
  }
  for(const [fid, obj] of Object.entries(allAdditions)){
    const F = allFormulas.find(x => x.id === fid);
    if(!F) continue;
    const base = F.composition.map(herbNorm).filter(x=>x);
    for(let i=0;i<(obj.items||[]).length;i++){
      const it = obj.items[i];
      const addH = (it.herbs||[]).map(herbNorm).filter(x=>x);
      const rmH  = (it.remove||[]).map(herbNorm).filter(x=>x);
      if(!addH.length && !rmH.length) continue;  // 아무 변경 없는 가감은 set 으로 생성 안 함
      const r = [...base.filter(h => !rmH.includes(h)), ...addH];
      if(r.length < 2) continue;
      if(it.kind === 'derive'){
        add({ type:'derive', label:it.target||`${F.ko}+變`, han:it.target||'',
              herbs:r, baseId:fid, baseKo:F.ko, baseHan:F.han,
              mod:it.mod, note:it.note||'' });
      } else if(it.kind === 'symptom'){
        add({ type:'symptom', label:`${F.ko}+${it.symptomKo||it.symptom||'加'}`,
              han:F.han, herbs:r, baseId:fid, baseKo:F.ko, baseHan:F.han,
              symptom:it.symptomKo||it.symptom||'', mod:it.mod, note:it.note||'' });
      }
    }
  }
  _sets = sets; _sigIdx = idx;
  const freq = {};
  for(const F of allFormulas) for(const h of F.composition.map(herbNorm).filter(x=>x))
    freq[h] = (freq[h]||0)+1;
  for(const [fid, obj] of Object.entries(allAdditions))
    for(const it of (obj.items||[])) for(const h of (it.herbs||[]).map(herbNorm).filter(x=>x))
      freq[h] = (freq[h]||0)+0.5;
  const proto = [];
  // v9.7: 빈도 비례 분포 재조정 — 甘草(34회)·生薑(18.5)·白芍(17) 등이
  //       기존 평탄 공식(f>=10이면 일률 4장)에 묻혀 실제 출현 비율과 어긋났음.
  //       방제학 교과서 출현 빈도에 더 가깝게 5단계로 세분화.
  for(const [h, f] of Object.entries(freq)){
    let n;
    if(f >= 25)      n = 7;     // 甘草 (34회 — 거의 모든 처방)
    else if(f >= 15) n = 5;     // 生薑·白芍·茯苓·大棗
    else if(f >= 10) n = 4;     // 當歸·桂枝·人蔘·白朮·川芎
    else if(f >= 5)  n = 3;
    else if(f >= 2)  n = 2;
    else             n = 1;
    for(let i=0;i<n;i++) proto.push(h);
  }
  _proto = proto;
  const baseN = sets.filter(s=>s.type==='base').length;
  const extraN = sets.filter(s=>s.type==='base'&&s.extra).length;
  const deriveN = sets.filter(s=>s.type==='derive').length;
  const symN = sets.filter(s=>s.type==='symptom').length;
  console.log(`[方劑Cube v${BC_VER}] sets=${sets.length} (base ${baseN}: 핵심 ${baseN-extraN} +확장 ${extraN} · 派生 ${deriveN} · 加減 ${symN}) deck=${proto.length} herbs=${Object.keys(freq).length}`);
}

function matchSet(herbs){ build(); return _sigIdx[sig(herbs)] || []; }
function isValidSet(h){ return matchSet(h).length > 0; }
function validateBoard(b){
  for(const s of (b||[])) if(!isValidSet(s.herbs||[])) return {ok:false, badSet:s};
  return {ok:true};
}

// ──────────────────────────────────────────────────────────────────
// 3. Firebase 액션
// ──────────────────────────────────────────────────────────────────
async function createRoom(opts){
  const f = fb(), u = (typeof S !== 'undefined') ? S : null;
  if(!f || !u || !u.userId){ toast_('네트워크/사용자 정보 없음','warn'); return null; }
  opts = Object.assign({maxPlayers:4, isPublic:true, name:''}, opts||{});
  const rid = roomCode();
  const room = {
    roomId: rid, status:'waiting', hostId: u.userId,
    name: opts.name || `${myName()}의 방`,
    maxPlayers: opts.maxPlayers, isPublic: !!opts.isPublic,
    createdAt: nowMs(),
    players: { [u.userId]: {
      name: myName(), character: u.character||null, faction: u.faction||null,
      isHost: true, isReady: true, handCount: 0, joinedAt: nowMs(),
    }},
    turnOrder:[], turnIdx:0, turnUserId:'', turnStartedAt:0,
    board:[], deckCount:0,
  };
  const ok = await f.put(`${FB_NODE}/${rid}`, room);
  if(!ok){ toast_('방 생성 실패','warn'); return null; }
  // v9.7: 업적 추적 — 큐브 對局 (호스트도 참여로 카운트)
  try{ if(window.V97Ach) window.V97Ach.recordCubeJoin(); }catch(_){}
  return rid;
}

async function joinRoom(rid){
  const f = fb(), u = (typeof S !== 'undefined') ? S : null;
  if(!f || !u || !u.userId) return {ok:false, msg:'네트워크 없음'};
  rid = String(rid||'').toUpperCase().trim();
  if(!rid) return {ok:false, msg:'방 코드를 입력하세요'};
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return {ok:false, msg:'방을 찾을 수 없습니다'};
  if(room.status !== 'waiting') return {ok:false, msg:'이미 시작된 對局'};
  const ps = room.players || {};
  if(ps[u.userId]) return {ok:true, roomId:rid, rejoin:true};
  if(Object.keys(ps).length >= (room.maxPlayers||4))
    return {ok:false, msg:'방이 가득 찼습니다'};
  const ok = await f.put(`${FB_NODE}/${rid}/players/${u.userId}`, {
    name: myName(), character: u.character||null, faction: u.faction||null,
    isHost: false, isReady: false, handCount: 0, joinedAt: nowMs(),
  });
  // v9.7: 업적 추적 — 큐브 참여
  if(ok){
    try{ if(window.V97Ach) window.V97Ach.recordCubeJoin(); }catch(_){}
  }
  return ok ? {ok:true, roomId:rid} : {ok:false, msg:'입장 실패'};
}

async function leaveRoom(rid){
  const f = fb(), u = (typeof S !== 'undefined') ? S : null;
  if(!f || !u || !u.userId) return;
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return;
  if((room.status||'waiting') === 'waiting'){
    if(room.hostId === u.userId) await f.del(`${FB_NODE}/${rid}`);
    else await f.del(`${FB_NODE}/${rid}/players/${u.userId}`);
  } else if(room.status === 'playing'){
    await forfeit(rid);
  }
}

async function setReady(rid, ready){
  const f = fb(), u = (typeof S !== 'undefined') ? S : null;
  if(!f || !u || !u.userId) return;
  await f.put(`${FB_NODE}/${rid}/players/${u.userId}/isReady`, !!ready);
}

async function startGame(rid){
  const f = fb(), u = (typeof S !== 'undefined') ? S : null;
  if(!f || !u || !u.userId) return {ok:false, msg:'네트워크 없음'};
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return {ok:false, msg:'방 없음'};
  if(room.hostId !== u.userId) return {ok:false, msg:'호스트만 시작 가능'};
  if(room.status !== 'waiting') return {ok:false, msg:'이미 시작됨'};
  const ps = room.players || {};
  const uids = Object.keys(ps);
  if(uids.length < 2) return {ok:false, msg:'2人 이상 필요'};
  for(const uid of uids){
    if(uid === room.hostId) continue;
    if(!ps[uid].isReady) return {ok:false, msg:`${ps[uid].name} 미준비`};
  }
  build();
  const deck = shuffle(_proto);
  const hSize = handInit(uids.length);
  const order = uids.sort((a,b) => (ps[a].joinedAt||0) - (ps[b].joinedAt||0));
  const hands = {};
  let cursor = 0;
  for(const uid of order){ hands[uid] = deck.slice(cursor, cursor+hSize); cursor += hSize; }
  const remain = deck.slice(cursor);
  const patches = {
    status:'playing', deck:remain, deckCount:remain.length, board:[],
    turnOrder:order, turnIdx:0, turnUserId:order[0],
    turnStartedAt:nowMs(), startedAt:nowMs(), hands,
  };
  for(const uid of order) patches[`players/${uid}/handCount`] = hSize;
  const tasks = [];
  for(const [k,v] of Object.entries(patches)) tasks.push(f.put(`${FB_NODE}/${rid}/${k}`, v));
  const oks = await Promise.all(tasks);
  return {ok: oks.every(x=>x), roomId:rid};
}

async function getMyHand(rid){
  const f = fb(), u = (typeof S !== 'undefined') ? S : null;
  if(!f || !u || !u.userId) return [];
  const h = await f.get(`${FB_NODE}/${rid}/hands/${u.userId}`);
  return Array.isArray(h) ? h : [];
}

async function commitTurn(rid, newBoard, newHand, origHand, origBoard){
  const f = fb(), u = (typeof S !== 'undefined') ? S : null;
  if(!f || !u || !u.userId) return {ok:false, msg:'네트워크 없음'};
  const v = validateBoard(newBoard);
  if(!v.ok) return {ok:false, msg:`유효하지 않은 set: ${(v.badSet&&v.badSet.herbs||[]).join('·')}`, penalty:true};
  if(!(newHand.length < origHand.length))
    return {ok:false, msg:'손패에서 1장 이상 출패해야 합니다'};
  if(!msetEq([...origHand,...boardHerbs(origBoard)], [...newHand,...boardHerbs(newBoard)]))
    return {ok:false, msg:'카드 수 불일치 (외부 본초 혼입?)', penalty:true};
  const labeled = newBoard.map(s => {
    const ms = matchSet(s.herbs);
    const top = ms.find(x=>x.type==='base') || ms[0];
    return {
      id: s.id || `s${Date.now()}${Math.floor(Math.random()*1000)}`,
      herbs: s.herbs,
      label: top ? top.label : '?',
      han:   top ? (top.han || top.label) : '',
      type:  top ? top.type : '?',
      by:    s.by || u.userId, modBy: u.userId, modAt: nowMs(),
    };
  });
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return {ok:false, msg:'방 없음'};
  if(room.turnUserId !== u.userId) return {ok:false, msg:'당신의 차례가 아닙니다'};
  const order = room.turnOrder || [];
  const nIdx = (room.turnIdx+1) % order.length;

  // v9.6: 난이도 점수 누적 — 새 set 가산 + 기존 set 본초 추가분 가산
  const origById = {};
  (origBoard||[]).forEach(s => { if(s.id) origById[s.id] = s; });
  let formDelta = 0;
  for(const s of labeled){
    if(!origById[s.id]){
      // 새로 만든 set
      formDelta += _bcDifficultyPoints(s);
    } else if(s.modBy === u.userId){
      // 기존 set 수정 — 본초 수 증가분만 가산 (가감방 추가 등)
      const before = origById[s.id];
      const beforeSize = (before.herbs||[]).length;
      const afterSize = (s.herbs||[]).length;
      if(afterSize > beforeSize){
        formDelta += (afterSize - beforeSize) * 2;   // 추가 본초당 2점
      }
    }
  }

  const tasks = [
    f.put(`${FB_NODE}/${rid}/board`, labeled),
    f.put(`${FB_NODE}/${rid}/hands/${u.userId}`, newHand),
    f.put(`${FB_NODE}/${rid}/players/${u.userId}/handCount`, newHand.length),
    f.put(`${FB_NODE}/${rid}/turnIdx`, nIdx),
    f.put(`${FB_NODE}/${rid}/turnUserId`, order[nIdx]),
    f.put(`${FB_NODE}/${rid}/turnStartedAt`, nowMs()),
    f.put(`${FB_NODE}/${rid}/lastAction`, {by:u.userId, type:'commit', at:nowMs()}),
  ];
  // 난이도 점수 누적 (있을 때만)
  if(formDelta > 0){
    const curScore = (room.players && room.players[u.userId] && room.players[u.userId]._formulationScore) || 0;
    tasks.push(f.put(`${FB_NODE}/${rid}/players/${u.userId}/_formulationScore`, curScore + formDelta));
  }
  await Promise.all(tasks);
  if(newHand.length === 0) await declareWin(rid, u.userId);
  return {ok:true};
}

// v9.6: 본초 set 의 난이도 점수 — base > derive > symptom · 본초 수 가산
function _bcDifficultyPoints(s){
  const typePt = s.type === 'base' ? 10 : s.type === 'derive' ? 7 : 5;
  const sizePt = Math.min(15, (s.herbs||[]).length);
  return typePt + sizePt;
}

async function draw(rid, n){
  const f = fb(), u = (typeof S !== 'undefined') ? S : null;
  if(!f || !u || !u.userId) return {ok:false, msg:'네트워크 없음'};
  n = n || 1;
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return {ok:false, msg:'방 없음'};
  if(n===1 && room.turnUserId !== u.userId) return {ok:false, msg:'당신의 차례가 아닙니다'};
  const deck = Array.isArray(room.deck) ? [...room.deck] : [];
  if(deck.length < 1) return {ok:false, msg:'덱이 비었습니다'};
  const taken = deck.splice(0, Math.min(n, deck.length));
  const hand = await getMyHand(rid);
  const newHand = [...hand, ...taken];
  const order = room.turnOrder || [];
  const nIdx = n===1 ? (room.turnIdx+1)%order.length : room.turnIdx;
  const tasks = [
    f.put(`${FB_NODE}/${rid}/deck`, deck),
    f.put(`${FB_NODE}/${rid}/deckCount`, deck.length),
    f.put(`${FB_NODE}/${rid}/hands/${u.userId}`, newHand),
    f.put(`${FB_NODE}/${rid}/players/${u.userId}/handCount`, newHand.length),
  ];
  if(n===1){
    tasks.push(
      f.put(`${FB_NODE}/${rid}/turnIdx`, nIdx),
      f.put(`${FB_NODE}/${rid}/turnUserId`, order[nIdx]),
      f.put(`${FB_NODE}/${rid}/turnStartedAt`, nowMs()),
      f.put(`${FB_NODE}/${rid}/lastAction`, {by:u.userId, type:'draw', at:nowMs()}),
    );
  } else {
    tasks.push(f.put(`${FB_NODE}/${rid}/lastAction`, {by:u.userId, type:'penalty', n, at:nowMs()}));
  }
  await Promise.all(tasks);
  return {ok:true, drawn:taken};
}

async function declareWin(rid, winnerUid){
  const f = fb(); if(!f) return;
  await f.put(`${FB_NODE}/${rid}/status`, 'done');
  await f.put(`${FB_NODE}/${rid}/result`, { winnerId:winnerUid, finishedAt:nowMs(), by:'empty-hand' });
}

async function forfeit(rid){
  const f = fb(), u = (typeof S !== 'undefined') ? S : null;
  if(!f || !u || !u.userId) return;
  const room = await f.get(`${FB_NODE}/${rid}`);
  if(!room) return;
  const hand = await getMyHand(rid);
  const deck = Array.isArray(room.deck) ? [...room.deck] : [];
  const newDeck = shuffle([...deck, ...hand]);
  const order = (room.turnOrder||[]).filter(x => x !== u.userId);
  let tIdx = room.turnIdx, tUid = room.turnUserId;
  if(tUid === u.userId){
    tIdx = tIdx % Math.max(1, order.length);
    tUid = order[tIdx] || '';
  } else {
    const oldI = (room.turnOrder||[]).indexOf(u.userId);
    if(oldI >= 0 && oldI < tIdx) tIdx = Math.max(0, tIdx - 1);
    tUid = order[tIdx] || '';
  }
  await Promise.all([
    f.del(`${FB_NODE}/${rid}/hands/${u.userId}`),
    f.put(`${FB_NODE}/${rid}/players/${u.userId}/handCount`, 0),
    f.put(`${FB_NODE}/${rid}/players/${u.userId}/forfeited`, true),
    f.put(`${FB_NODE}/${rid}/deck`, newDeck),
    f.put(`${FB_NODE}/${rid}/deckCount`, newDeck.length),
    f.put(`${FB_NODE}/${rid}/turnOrder`, order),
    f.put(`${FB_NODE}/${rid}/turnIdx`, tIdx),
    f.put(`${FB_NODE}/${rid}/turnUserId`, tUid),
  ]);
  if(order.length === 1) await declareWin(rid, order[0]);
}

async function listRooms(){
  const f = fb(); if(!f) return [];
  const all = await f.get(FB_NODE);
  if(!all || typeof all !== 'object') return [];
  const out = [], now = nowMs();
  for(const [rid, r] of Object.entries(all)){
    if(!r || typeof r !== 'object') continue;
    // v9.6: AI 솔로 룸은 공개 목록에서 제외 (in-memory bridge 룸일 뿐 다른 사람과 무관)
    if(typeof rid === 'string' && rid.startsWith('AI_CUBE_')) continue;
    if(r && r.isPublic === false) continue;
    const age = now - (r.createdAt||0);
    if(r.status === 'waiting' && age > ROOM_TTL_WAIT) continue;
    if(r.status === 'done' && age > ROOM_TTL_DONE) continue;
    out.push({
      roomId:rid, status:r.status||'waiting', name:r.name||'?',
      hostId:r.hostId||'', maxPlayers:r.maxPlayers||4,
      isPublic:r.isPublic !== false,
      playerCount: Object.keys(r.players||{}).length,
      createdAt: r.createdAt||0,
    });
  }
  out.sort((a,b) => b.createdAt - a.createdAt);
  return out;
}

// ──────────────────────────────────────────────────────────────────
// 4. 상태 (IIFE 클로저 공유)
// ──────────────────────────────────────────────────────────────────
let CUR_ROOM = null;
let LOCAL = null;
let SUB = null;
let TURN_TIMER = null;
let MSG_TIMER = null;

function stopTurnTimer(){ if(TURN_TIMER){ clearInterval(TURN_TIMER); TURN_TIMER = null; } }
function unsubRoom(){
  if(SUB && typeof SUB.close === 'function'){ try{ SUB.close(); }catch(_){} }
  SUB = null;
}
function subRoom(rid, cb){
  const f = fb(); if(!f) return null;
  unsubRoom();
  SUB = f.subscribe(`${FB_NODE}/${rid}`, cb, {pollMs: POLL_MS});
  return SUB;
}

// ──────────────────────────────────────────────────────────────────
// 5. 진입 + 라우터
// ──────────────────────────────────────────────────────────────────
async function renderCube(){
  build();
  if(CUR_ROOM) return enterRoom(CUR_ROOM);
  return renderLobby();
}

async function enterRoom(rid){
  unsubRoom(); stopTurnTimer();
  CUR_ROOM = rid;
  const v = view(); if(!v) return;
  v.innerHTML = `<div class="card fade-in"><div style="text-align:center;padding:14px;color:var(--gutong);font-size:13px">불러오는 중…</div></div>`;
  const f = fb();
  const room = f ? await f.get(`${FB_NODE}/${rid}`) : null;
  if(!room){ toast_('방을 찾을 수 없습니다','warn'); CUR_ROOM = null; return renderLobby(); }
  if(room.status === 'waiting') renderWait(rid, room);
  else if(room.status === 'playing') renderGame(rid, room);
  else if(room.status === 'done') renderResult(rid, room);
  subRoom(rid, (snap) => {
    if(!snap){
      toast_('방이 종료되었습니다','warn');
      CUR_ROOM = null; LOCAL = null; unsubRoom(); stopTurnTimer();
      renderLobby();
      return;
    }
    const hasGame   = !!$('#bc-game-root');
    const hasWait   = !!$('#bc-wait-root');
    const hasResult = !!$('#bc-result-root');
    if(snap.status === 'waiting'){
      if(!hasWait) renderWait(rid, snap); else updateWaitView(snap);
    } else if(snap.status === 'playing'){
      if(!hasGame) renderGame(rid, snap); else updateGameView(snap);
    } else if(snap.status === 'done'){
      if(!hasResult) renderResult(rid, snap);
    }
  });
}

function exitToLobby(){
  CUR_ROOM = null; LOCAL = null; unsubRoom(); stopTurnTimer();
  // v9.6: 채팅 ctx 정리 + AI 룸 종료
  try{
    if(typeof window.V96Chat !== 'undefined' && window._v96CurrentCubeChatCtx){
      V96Chat.unmount(window._v96CurrentCubeChatCtx);
      window._v96CurrentCubeChatCtx = null;
    }
    if(typeof window.V96CubeAI !== 'undefined'){
      V96CubeAI.stop();
    }
  }catch(_){}
  renderLobby();
}

// ──────────────────────────────────────────────────────────────────
// 6. 로비 화면
// ──────────────────────────────────────────────────────────────────
async function renderLobby(){
  unsubRoom(); stopTurnTimer();
  build();
  const v = view(); if(!v) return;
  const sets = _sets || [];
  v.innerHTML = `
    <div class="view-title"><span class="han">方劑Cube</span> 본초패 對局</div>
    <div class="view-sub">루미큐브 룰 · 본초로 처방 짜서 손패를 비우자</div>

    <div class="card imperial fade-in">
      <div class="card-title"><span class="han">遊戲規則</span> 게임 룰</div>
      <ul style="font-size:12.5px;line-height:1.7;padding-left:18px;margin:6px 0">
        <li>2~4인 · 본초 카드로 시작 (4인 ${HAND_4P}장 / 2~3인 ${HAND_23P}장)</li>
        <li>유효 set = 완성 방제 · 派生方 · 증상별 加減</li>
        <li>보드 처방에 본초 추가 → 가감방 변형 · set 분해 후 재조합 가능</li>
        <li>턴 종료 시 모든 set 유효 + 손패 1장 이상 출패</li>
        <li>위반 시 <b>${PENALTY_DRAW}장 페널티 드로우</b>, 못 내면 1장 뽑고 턴 종료</li>
        <li>손패 0장 → 승리 · <b>v9.6 등수별 보상</b>:
          <span style="color:var(--zhusha-d)">1등 80</span> ·
          2등 30 · 3등 20 · 4등 10
          <span style="font-size:11px;color:var(--gutong)">+ 처방 난이도 보너스 (최대 +40)</span></li>
        <li><b style="color:var(--feicui)">처방 난이도 점수</b> — 基方 10·派生 7·加減 5 + 본초 수 (가감 추가 ×2)</li>
      </ul>
    </div>

    <div class="card fade-in">
      <div class="card-title"><span class="han">創方</span> 방 만들기</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px">
        <label style="margin:0">최대 인원</label>
        <select id="bc-max" style="width:auto;flex:0 0 80px">
          <option value="2">2人</option>
          <option value="3">3人</option>
          <option value="4" selected>4人</option>
        </select>
        <input id="bc-name" placeholder="방 이름 (선택)" style="flex:1;min-width:140px" maxlength="20">
        <button class="btn btn-gold" id="bc-create" type="button"><span class="han">設</span>&nbsp;방 만들기</button>
      </div>
    </div>

    <!-- v9.6: AI 對局 (사람 안 기다리고 즉시 시작) -->
    <div class="card fade-in" style="border-left:3px solid var(--feicui)">
      <div class="card-title"><span class="han" style="color:var(--feicui)">AI 對局</span> AI 의가와 즉시 대국</div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:8px;line-height:1.6">
        매칭 없이 바로 시작. <b>AI 휴리스틱:</b> 손패에서 가장 가치 큰 set (基方 > 派生 > 加減)을 우선 출패.
        <span style="color:var(--feicui)">보상은 동일하게 적용</span> — 학습 목적에 좋습니다.
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <label style="margin:0;font-size:12px">상대 AI 수</label>
        <select id="bc-ai-num" style="width:auto;flex:0 0 80px">
          <option value="1">1人</option>
          <option value="2">2人</option>
          <option value="3" selected>3人</option>
        </select>
        <button class="btn btn-feicui" id="bc-ai-start" type="button"><span class="han">獨</span>&nbsp;AI 對局 시작</button>
      </div>
    </div>

    <div class="card fade-in">
      <div class="card-title"><span class="han">入方</span> 방 코드로 입장</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <input id="bc-code" placeholder="A2X9" style="flex:1;text-transform:uppercase;letter-spacing:.2em" maxlength="8">
        <button class="btn" id="bc-join" type="button">入</button>
      </div>
    </div>

    <div class="card fade-in">
      <div class="card-title"><span class="han">公示</span> 활성 對局
        <button class="btn btn-sm btn-ghost" id="bc-refresh" type="button" style="float:right">새로고침</button>
      </div>
      <div id="bc-rooms" style="margin-top:8px">
        <div style="font-size:12px;color:var(--gutong);text-align:center;padding:14px">불러오는 중…</div>
      </div>
    </div>

    <div class="card fade-in" style="background:rgba(0,0,0,.02)">
      <div style="font-size:11px;color:var(--gutong);line-height:1.6">
        <b>方劑Cube v${BC_VER}</b> · 유효 set ${sets.length}종
        (기본 ${sets.filter(s=>s.type==='base').length} ·
         派生 ${sets.filter(s=>s.type==='derive').length} ·
         加減 ${sets.filter(s=>s.type==='symptom').length})
      </div>
    </div>
  `;
  $('#bc-create').addEventListener('click', async () => {
    const max = parseInt($('#bc-max').value) || 4;
    const nm  = $('#bc-name').value.trim();
    $('#bc-create').disabled = true;
    const rid = await createRoom({maxPlayers:max, name:nm});
    $('#bc-create').disabled = false;
    if(rid){ toast_('방 생성 완료','gold'); enterRoom(rid); }
  });
  // v9.6: AI 對局 시작 — V96CubeAI.start() 호출 (없으면 안내)
  const aiBtn = $('#bc-ai-start');
  if(aiBtn){
    aiBtn.addEventListener('click', async () => {
      if(typeof window.V96CubeAI === 'undefined'){
        toast_('AI 모듈 로드 실패. 새로고침 후 다시 시도하세요.','red');
        return;
      }
      const n = parseInt($('#bc-ai-num').value) || 3;
      aiBtn.disabled = true;
      try{
        await window.V96CubeAI.start(n);
      }catch(e){
        toast_('AI 시작 실패: '+(e&&e.message||'?'),'red');
      }
      aiBtn.disabled = false;
    });
  }
  $('#bc-join').addEventListener('click', async () => {
    const code = $('#bc-code').value.trim().toUpperCase();
    if(!code){ toast_('방 코드를 입력하세요','warn'); return; }
    $('#bc-join').disabled = true;
    const r = await joinRoom(code);
    $('#bc-join').disabled = false;
    if(r.ok){ toast_('入室','gold'); enterRoom(r.roomId); }
    else toast_(r.msg||'입장 실패','warn');
  });
  $('#bc-refresh').addEventListener('click', refreshRoomList);
  await refreshRoomList();
}

async function refreshRoomList(){
  const el = $('#bc-rooms'); if(!el) return;
  el.innerHTML = `<div style="font-size:12px;color:var(--gutong);text-align:center;padding:14px">불러오는 중…</div>`;
  const rooms = await listRooms();
  if(!rooms.length){
    el.innerHTML = `<div style="font-size:12px;color:var(--gutong);text-align:center;padding:14px">아직 활성 방 없음. 「방 만들기」로 시작.</div>`;
    return;
  }
  el.innerHTML = rooms.map(r => {
    const isPlay = r.status === 'playing';
    const isDone = r.status === 'done';
    const full   = r.playerCount >= r.maxPlayers;
    const col    = isDone ? 'var(--gutong)' : (isPlay ? 'var(--zhusha)' : 'var(--feicui)');
    const lbl    = isDone ? '종료' : (isPlay ? '對局中' : '대기中');
    const canJ   = !isPlay && !isDone && !full;
    return `
      <div style="display:flex;align-items:center;padding:8px;border:1px solid var(--mi-d);border-radius:6px;margin-bottom:6px;background:var(--mi-w)">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${esc_(r.name)} <span style="color:${col};font-size:10.5px;font-weight:500;margin-left:4px">${lbl}</span></div>
          <div style="font-size:11px;color:var(--mo-l);margin-top:2px">코드 <b class="seal" style="letter-spacing:.1em">${esc_(r.roomId)}</b> · ${r.playerCount}/${r.maxPlayers}人</div>
        </div>
        <button class="btn btn-sm ${canJ?'':'btn-ghost'}" data-rid="${esc_(r.roomId)}" ${canJ?'':'disabled'} type="button">${canJ?'入':'—'}</button>
      </div>
    `;
  }).join('');
  $$('#bc-rooms button[data-rid]').forEach(b => {
    b.addEventListener('click', async () => {
      const rid = b.dataset.rid;
      b.disabled = true;
      const r = await joinRoom(rid);
      b.disabled = false;
      if(r.ok) enterRoom(r.roomId);
      else toast_(r.msg||'입장 실패','warn');
    });
  });
}

// ──────────────────────────────────────────────────────────────────
// 7. 대기실 화면
// ──────────────────────────────────────────────────────────────────
function renderWait(rid, room){
  const v = view(); if(!v) return;
  const u = myUid();
  const isHost = (room.hostId === u);
  const ps = room.players || {};
  const meP = ps[u];
  const isReady = meP && meP.isReady;
  v.innerHTML = `
    <div id="bc-wait-root">
      <div class="view-title"><span class="han">候方</span> 대기실</div>
      <div class="view-sub">방 코드 <b class="seal" style="font-size:1.1em;letter-spacing:.2em;color:var(--zhusha-d)">${esc_(rid)}</b> · ${esc_(room.name||'')}</div>

      <div class="card imperial fade-in">
        <div class="card-title"><span class="han">同道</span> 참가자
          <span style="float:right;font-size:11px;color:var(--gutong);font-weight:400">${Object.keys(ps).length}/${room.maxPlayers}</span>
        </div>
        <div id="bc-wait-players" style="margin-top:8px">${waitPlayersHTML(room)}</div>
      </div>

      <div class="card fade-in" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        ${isHost
          ? `<button class="btn btn-gold btn-lg" id="bc-start" type="button" ${waitCanStart(room)?'':'disabled'}><span class="han">開戰</span>&nbsp;對局 시작</button>
             <span style="font-size:11px;color:var(--gutong);flex:1;text-align:right">최소 2人 · 전원 준비</span>`
          : `<button class="btn ${isReady?'btn-gold':''}" id="bc-ready" type="button">${isReady?'준비됨 ✓':'준비'}</button>
             <span style="font-size:11.5px;color:var(--gutong);flex:1">호스트가 시작하면 자동 입장</span>`
        }
        <button class="btn btn-o btn-sm" id="bc-leave" type="button">나가기</button>
      </div>

      <div class="card fade-in" style="background:rgba(0,0,0,.02)">
        <div style="font-size:11px;color:var(--gutong);line-height:1.6">
          방을 공유하려면 코드 <b>${esc_(rid)}</b> 를 알려주세요. 「방미큐브 → 방 코드로 입장」 에서 입력.
        </div>
      </div>
    </div>
  `;
  if(isHost){
    $('#bc-start').addEventListener('click', async () => {
      $('#bc-start').disabled = true;
      const r = await startGame(rid);
      if(!r.ok){ toast_(r.msg||'시작 실패','warn'); $('#bc-start').disabled = false; }
    });
  } else {
    $('#bc-ready').addEventListener('click', async () => { await setReady(rid, !isReady); });
  }
  $('#bc-leave').addEventListener('click', async () => {
    if(!confirm('방에서 나가시겠습니까?')) return;
    await leaveRoom(rid);
    exitToLobby();
  });
}

function waitPlayersHTML(room){
  const ps = room.players || {};
  const u = myUid();
  const uids = Object.keys(ps).sort((a,b) => (ps[a].joinedAt||0) - (ps[b].joinedAt||0));
  return uids.map(uid => {
    const p = ps[uid];
    const isHost = uid === room.hostId;
    const isMe = uid === u;
    const ready = p.isReady || isHost;
    return `
      <div style="display:flex;align-items:center;padding:6px 8px;border-bottom:1px dotted var(--mi-d);gap:8px">
        <div style="font-size:13px;flex:1">
          <b>${esc_(p.name||'?')}</b>
          ${isHost ? '<span class="seal" style="color:var(--huang-d);font-size:11px;margin-left:4px">座</span>' : ''}
          ${isMe   ? '<span style="color:var(--feicui);font-size:11px;margin-left:4px">(나)</span>' : ''}
        </div>
        <div style="font-size:11px;color:${ready?'var(--feicui)':'var(--gutong)'};font-weight:600">${ready?'준비됨':'대기'}</div>
      </div>
    `;
  }).join('');
}

function waitCanStart(room){
  const ps = room.players || {};
  const uids = Object.keys(ps);
  if(uids.length < 2) return false;
  for(const uid of uids){
    if(uid === room.hostId) continue;
    if(!ps[uid].isReady) return false;
  }
  return true;
}

function updateWaitView(room){
  const u = myUid();
  const list = $('#bc-wait-players');
  if(list) list.innerHTML = waitPlayersHTML(room);
  const start = $('#bc-start');
  if(start) start.disabled = !waitCanStart(room);
  const ready = $('#bc-ready');
  if(ready){
    const meP = (room.players||{})[u];
    const isReady = meP && meP.isReady;
    ready.textContent = isReady ? '준비됨 ✓' : '준비';
    ready.className = `btn ${isReady?'btn-gold':''}`;
  }
}

// ──────────────────────────────────────────────────────────────────
// 8. 게임 화면 — 카드 HTML / set HTML
// ──────────────────────────────────────────────────────────────────
function herbCardHTML(han, opts){
  opts = opts || {};
  const ko = herbKo(han) || '';
  const sm = herbSm(han) || '';
  const firstFlavor = (sm.split(',')[0] || '').replace(/[微大小]/g,'').charAt(0);
  const fc = {
    '甘':'#C9A227', '辛':'#9C3030', '苦':'#2C2E48',
    '酸':'#2A7060', '鹹':'#876A36', '淡':'#A8987C',
  }[firstFlavor] || '#876A36';
  const sel = opts.selected ? 'bc-card-sel' : '';
  const sm_ = opts.small ? 'bc-card-sm' : '';
  return `
    <div class="bc-card ${sel} ${sm_}" data-han="${esc_(han)}" data-idx="${opts.idx==null?'':opts.idx}" style="--flavor:${fc}">
      <div class="bc-card-han">${esc_(han)}</div>
      <div class="bc-card-ko">${esc_(ko)}</div>
      ${opts.small ? '' : `<div class="bc-card-sm-text">${esc_(sm)}</div>`}
    </div>
  `;
}

function boardSetHTML(s, idx, opts){
  opts = opts || {};
  const sel = opts.selected ? 'bc-set-sel' : '';
  const tc = {
    base:    'var(--zhusha)',
    derive:  'var(--huang-d)',
    symptom: 'var(--feicui)',
  }[s.type] || (s._candidate ? 'var(--gutong)' : 'var(--zhusha)');
  const valid = isValidSet(s.herbs);
  const validBadge = valid
    ? `<span class="bc-set-valid" style="color:var(--feicui)">✓</span>`
    : `<span class="bc-set-valid" style="color:var(--zhusha-d)">✗ 미완</span>`;
  const ms = matchSet(s.herbs);
  const top = ms.length ? (ms.find(x => x.type==='base') || ms[0]) : null;
  const label = top ? top.label : '(미완성 후보)';
  const han   = top ? (top.han || top.label) : '';
  return `
    <div class="bc-set ${sel}" data-setidx="${idx}" style="--accent:${tc}">
      <div class="bc-set-head" data-action="head">
        ${han ? `<span class="bc-set-label han">${esc_(han)}</span>` : ''}
        <span class="bc-set-label-ko">${esc_(label)}</span>
        <span style="flex:1"></span>
        ${validBadge}
        <span class="bc-set-cnt">${s.herbs.length}</span>
      </div>
      <div class="bc-set-cards">
        ${s.herbs.map((h,i) => {
          const csel = (opts.selectedCards && opts.selectedCards.has(i)) ? true : false;
          return herbCardHTML(h, {small:true, selected:csel, idx:i});
        }).join('')}
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────────
// 9. 게임 화면 메인
// ──────────────────────────────────────────────────────────────────
async function renderGame(rid, room){
  const v = view(); if(!v) return;
  const u = myUid();
  if(!u){ toast_('사용자 정보 없음','warn'); return; }
  const hand = await getMyHand(rid);
  LOCAL = {
    roomId: rid,
    origHand: [...hand],
    origBoard: JSON.parse(JSON.stringify(room.board||[])),
    hand: [...hand],
    board: JSON.parse(JSON.stringify(room.board||[])).map(s => ({...s, _candidate:false})),
    selHand: new Set(),
    selSetIdx: null,
    selSetCards: new Set(),
    isMyTurn: (room.turnUserId === u),
  };
  v.innerHTML = `
    <div id="bc-game-root">
      <div id="bc-topbar" class="card imperial fade-in" style="padding:10px 12px;margin-bottom:8px">
        <div id="bc-turninfo">${topbarHTML(room)}</div>
        <div id="bc-players" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${playersHTML(room)}</div>
      </div>

      <div class="card fade-in" style="padding:10px;margin-bottom:8px">
        <div style="display:flex;align-items:center;margin-bottom:6px">
          <span class="card-title" style="margin:0"><span class="han">桌面</span> 보드</span>
          <span style="flex:1"></span>
          <button type="button" onclick="window.V97Dict && window.V97Dict.open()" title="처방 사전 (對局 중 참조 가능)" style="margin-right:6px;padding:2px 9px;font-size:10.5px;border:1px solid var(--zhusha-d);background:var(--zhusha-d)22;color:var(--zhusha-d);border-radius:10px;cursor:pointer;font-family:var(--font-display)">方劑 사전</button>
          <span style="font-size:11px;color:var(--gutong)" id="bc-deckinfo">덱 <b>${room.deckCount||0}</b>장 · set <b>${(LOCAL.board||[]).length}</b></span>
        </div>
        <div id="bc-board" class="bc-board"></div>
      </div>

      <div id="bc-actions" class="card fade-in" style="position:sticky;bottom:60px;z-index:10;padding:8px;margin-bottom:8px;background:linear-gradient(180deg, var(--mi-w) 0%, var(--mi) 100%);border:1.5px solid var(--huang-d)"></div>

      <div class="card fade-in" style="padding:10px">
        <div style="display:flex;align-items:center;margin-bottom:6px">
          <span class="card-title" style="margin:0"><span class="han">手牌</span> 내 손패</span>
          <span style="flex:1"></span>
          <span style="font-size:11px;color:var(--gutong)"><b id="bc-handcnt">${LOCAL.hand.length}</b>장 · 선택 <b id="bc-selcnt">0</b></span>
        </div>
        <div id="bc-hand" class="bc-hand"></div>
      </div>

      <div id="bc-msg" style="text-align:center;font-size:11.5px;color:var(--gutong);min-height:16px;margin:4px 0"></div>

      <div style="display:flex;gap:6px;justify-content:center;margin-top:8px">
        <button class="btn btn-sm btn-ghost" id="bc-help" type="button">조작법</button>
        <button class="btn btn-sm btn-ghost" id="bc-leave-game" type="button" style="color:var(--zhusha-d);border-color:var(--zhusha-d)">항복</button>
      </div>

      <!-- v9.6: 對局 채팅 -->
      <div id="bc-chat-host"></div>
    </div>
  `;
  renderBoard();
  renderHand();
  renderActions();
  startTurnTimer(room);
  bindHelpAndLeave(rid);
  // v9.6: 채팅 마운트 (이미 마운트된 ctx 가 있고 같은 룸이면 유지)
  try{
    if(typeof window.V96Chat !== 'undefined'){
      const needNew = !window._v96CurrentCubeChatCtx || window._v96CurrentCubeChatCtx._rid !== rid;
      if(needNew){
        if(window._v96CurrentCubeChatCtx){
          V96Chat.unmount(window._v96CurrentCubeChatCtx);
          window._v96CurrentCubeChatCtx = null;
        }
        const isAi = (typeof window.V96CubeAI !== 'undefined' && window.V96CubeAI.isAiRoom && window.V96CubeAI.isAiRoom())
          || String(rid).startsWith('AI_CUBE_');
        window._v96CurrentCubeChatCtx = V96Chat.mount({
          node: `${FB_NODE}/${rid}/chat`,
          container: '#bc-chat-host',
          presets: V96Chat.PRESETS_CUBE,
          isLocal: isAi,
          max: 30,
        });
        window._v96CurrentCubeChatCtx._rid = rid;
      } else {
        // 동일 룸이면 컨테이너만 재바인딩 (위치 이동)
        const host = document.getElementById('bc-chat-host');
        if(host && window._v96CurrentCubeChatCtx){
          // 기존 div 이동
          const ex = document.querySelector(`.chat-card[data-cid="${window._v96CurrentCubeChatCtx.id}"]`);
          if(ex && ex.parentNode !== host){ host.appendChild(ex); }
        }
      }
    }
  }catch(e){ console.warn('cube chat mount failed', e); }
}

function topbarHTML(room){
  const u = myUid();
  const isMy = (room.turnUserId === u);
  const tp = (room.players||{})[room.turnUserId] || {};
  const remain = Math.max(0, TURN_SEC - Math.floor((Date.now() - (room.turnStartedAt||0))/1000));
  return `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="flex:1">
        <div style="font-size:11px;color:var(--gutong);letter-spacing:.06em">${isMy?'<b style="color:var(--zhusha-d)">🪶 당신의 차례</b>':'대기'}</div>
        <div style="font-size:14px;font-weight:600;color:${isMy?'var(--zhusha-d)':'var(--mo)'}">
          <span class="han">回</span> <b id="bc-turn-name">${esc_(tp.name||'?')}</b>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;color:var(--gutong)">남은 시간</div>
        <div style="font-size:18px;font-weight:700;font-family:var(--font-display);color:${remain<15?'var(--zhusha-d)':'var(--mo)'}" id="bc-timer">${remain}s</div>
      </div>
    </div>
  `;
}

function playersHTML(room){
  const u = myUid();
  const ps = room.players || {};
  const order = room.turnOrder || Object.keys(ps);
  return order.filter(uid => ps[uid]).map(uid => {
    const p = ps[uid];
    const isMe = (uid === u);
    const isTurn = (uid === room.turnUserId);
    return `
      <div style="display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;background:${isTurn?'var(--huang-l)':'var(--mi)'};border:1px solid ${isTurn?'var(--huang-d)':'var(--mi-d)'};font-size:11px">
        <span class="han" style="color:var(--zhusha-d);font-weight:600">${isTurn?'▶':'·'}</span>
        <span style="font-weight:${isMe?'700':'500'};color:${isMe?'var(--zhusha-d)':'var(--mo)'}">${esc_(p.name||'?')}${isMe?' (나)':''}</span>
        <span style="font-size:10px;color:var(--gutong)">${p.handCount||0}장</span>
      </div>
    `;
  }).join('');
}

function renderBoard(){
  const el = $('#bc-board'); if(!el) return;
  if(!LOCAL.board.length){
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--gutong);font-size:12px;background:rgba(0,0,0,.02);border-radius:6px;border:1px dashed var(--mi-d)"><span class="han">空</span> &nbsp;보드가 비어있습니다. 첫 처방을 출패하세요</div>`;
  } else {
    el.innerHTML = LOCAL.board.map((s, idx) => boardSetHTML(s, idx, {
      selected: LOCAL.selSetIdx === idx,
      selectedCards: LOCAL.selSetIdx === idx ? LOCAL.selSetCards : null,
    })).join('');
  }
  $$('.bc-set', el).forEach(sEl => {
    const idx = parseInt(sEl.dataset.setidx);
    sEl.querySelector('.bc-set-head').addEventListener('click', (e) => {
      e.stopPropagation();
      onSetHeadClick(idx);
    });
    sEl.querySelectorAll('.bc-set-cards .bc-card').forEach(c => {
      c.addEventListener('click', (e) => {
        e.stopPropagation();
        onBoardCardClick(idx, parseInt(c.dataset.idx));
      });
    });
  });
  const di = $('#bc-deckinfo');
  // deckCount 정보는 update 에서 별도 갱신
}

function renderHand(){
  const el = $('#bc-hand'); if(!el) return;
  if(!LOCAL.hand.length){
    el.innerHTML = `<div style="text-align:center;padding:14px;color:var(--feicui);font-size:13px;font-weight:600">손패가 비었습니다! 턴 종료 시 승리</div>`;
  } else {
    const sorted = LOCAL.hand.map((h,i)=>({h,i})).sort((a,b) => a.h<b.h?-1:a.h>b.h?1:0);
    el.innerHTML = sorted.map(({h,i}) => herbCardHTML(h, {
      selected: LOCAL.selHand.has(i),
      idx: i,
    })).join('');
  }
  $$('.bc-card', el).forEach(c => {
    c.addEventListener('click', () => onHandCardClick(parseInt(c.dataset.idx)));
  });
  const hc = $('#bc-handcnt'); if(hc) hc.textContent = LOCAL.hand.length;
  const sc = $('#bc-selcnt'); if(sc) sc.textContent = LOCAL.selHand.size + LOCAL.selSetCards.size;
}

function renderActions(){
  const el = $('#bc-actions'); if(!el) return;
  const handSelN  = LOCAL.selHand.size;
  const setSelIdx = LOCAL.selSetIdx;
  const setSelN   = LOCAL.selSetCards.size;
  const isMy      = LOCAL.isMyTurn;

  const handChanged = !msetEq(LOCAL.origHand, LOCAL.hand);
  const boardChanged = !msetEq(boardHerbs(LOCAL.origBoard), boardHerbs(LOCAL.board))
                     || LOCAL.board.length !== LOCAL.origBoard.length;
  const anyChange = handChanged || boardChanged;

  if(!isMy){
    el.innerHTML = `<div style="text-align:center;padding:6px;font-size:12px;color:var(--gutong)">상대 차례를 기다리는 중…</div>`;
    return;
  }
  el.innerHTML = `
    <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:center">
      <button class="btn btn-sm" id="bc-newset"  type="button" ${handSelN<2?'disabled':''}><span class="han">創</span>&nbsp;새 set (${handSelN})</button>
      <button class="btn btn-sm" id="bc-addto"   type="button" ${handSelN<1||setSelIdx==null?'disabled':''}><span class="han">加</span>&nbsp;set에 추가</button>
      <button class="btn btn-sm" id="bc-pull"    type="button" ${setSelIdx==null||setSelN<1?'disabled':''}><span class="han">取</span>&nbsp;손패로 (${setSelN})</button>
      <button class="btn btn-sm btn-ghost" id="bc-desel" type="button" ${handSelN+setSelN===0&&setSelIdx==null?'disabled':''}>선택 해제</button>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:6px">
      <button class="btn btn-sm btn-o" id="bc-undo" type="button" ${!anyChange?'disabled':''}>↺ 되돌리기</button>
      <button class="btn btn-gold btn-sm" id="bc-commit" type="button" ${!handChanged?'disabled':''}><span class="han">終</span>&nbsp;턴 종료</button>
      <button class="btn btn-sm" id="bc-drawbtn" type="button" ${anyChange?'disabled':''} style="background:var(--gutong);border-color:var(--mo-l);color:var(--huang-l)"><span class="han">摸</span>&nbsp;패 뽑기</button>
    </div>
  `;
  $('#bc-newset').addEventListener('click', actNewSet);
  $('#bc-addto').addEventListener('click', actAddToSet);
  $('#bc-pull').addEventListener('click', actPullToHand);
  $('#bc-desel').addEventListener('click', actDeselect);
  $('#bc-undo').addEventListener('click', actUndo);
  $('#bc-commit').addEventListener('click', actCommit);
  $('#bc-drawbtn').addEventListener('click', actDraw);
}

// ──────────────────────────────────────────────────────────────────
// 10. 액션 핸들러
// ──────────────────────────────────────────────────────────────────
function onHandCardClick(idx){
  if(!LOCAL.isMyTurn){ msg('당신의 차례가 아닙니다','warn'); return; }
  if(LOCAL.selHand.has(idx)) LOCAL.selHand.delete(idx);
  else LOCAL.selHand.add(idx);
  renderHand(); renderActions();
}

function onBoardCardClick(setIdx, cardIdx){
  if(!LOCAL.isMyTurn){ msg('당신의 차례가 아닙니다','warn'); return; }
  if(LOCAL.selSetIdx !== setIdx){
    LOCAL.selSetIdx = setIdx;
    LOCAL.selSetCards = new Set([cardIdx]);
  } else {
    if(LOCAL.selSetCards.has(cardIdx)) LOCAL.selSetCards.delete(cardIdx);
    else LOCAL.selSetCards.add(cardIdx);
    if(LOCAL.selSetCards.size === 0) LOCAL.selSetIdx = null;
  }
  renderBoard(); renderHand(); renderActions();
}

function onSetHeadClick(setIdx){
  if(!LOCAL.isMyTurn){ msg('당신의 차례가 아닙니다','warn'); return; }
  if(LOCAL.selSetIdx === setIdx){
    if(LOCAL.selSetCards.size === LOCAL.board[setIdx].herbs.length){
      LOCAL.selSetCards.clear();
      LOCAL.selSetIdx = null;
    } else {
      LOCAL.selSetCards.clear();
      for(let i=0;i<LOCAL.board[setIdx].herbs.length;i++) LOCAL.selSetCards.add(i);
    }
  } else {
    LOCAL.selSetIdx = setIdx;
    LOCAL.selSetCards = new Set();
    for(let i=0;i<LOCAL.board[setIdx].herbs.length;i++) LOCAL.selSetCards.add(i);
  }
  renderBoard(); renderHand(); renderActions();
}

function actNewSet(){
  if(LOCAL.selHand.size < 2){ msg('손패에서 2장 이상 선택','warn'); return; }
  const idxs = [...LOCAL.selHand];
  const herbs = idxs.map(i => LOCAL.hand[i]);
  const newS = { id:`s${Date.now()}${Math.floor(Math.random()*1000)}`, herbs, _candidate:true };
  idxs.sort((a,b)=>b-a).forEach(i => LOCAL.hand.splice(i,1));
  LOCAL.board.push(newS);
  LOCAL.selHand.clear();
  const ms = matchSet(herbs);
  msg(ms.length ? `✓ ${ms[0].label}` : `⚠ 미완성 후보 — 더 조합 또는 분해 필요`, ms.length?'gold':'warn');
  renderBoard(); renderHand(); renderActions();
}

function actAddToSet(){
  if(LOCAL.selSetIdx == null || LOCAL.selHand.size < 1){
    msg('손패 카드 + 보드 set 모두 선택','warn'); return;
  }
  const idxs = [...LOCAL.selHand];
  const herbs = idxs.map(i => LOCAL.hand[i]);
  idxs.sort((a,b)=>b-a).forEach(i => LOCAL.hand.splice(i,1));
  const s = LOCAL.board[LOCAL.selSetIdx];
  s.herbs = [...s.herbs, ...herbs];
  s._candidate = !isValidSet(s.herbs);
  LOCAL.selHand.clear();
  const ms = matchSet(s.herbs);
  msg(ms.length ? `→ ${ms[0].label}` : `⚠ 미완성 후보`, ms.length?'gold':'warn');
  renderBoard(); renderHand(); renderActions();
}

function actPullToHand(){
  if(LOCAL.selSetIdx == null || LOCAL.selSetCards.size < 1){
    msg('보드 set 의 카드를 선택','warn'); return;
  }
  const s = LOCAL.board[LOCAL.selSetIdx];
  const idxs = [...LOCAL.selSetCards].sort((a,b)=>b-a);
  const taken = [];
  idxs.forEach(i => { taken.push(s.herbs[i]); s.herbs.splice(i,1); });
  LOCAL.hand = [...LOCAL.hand, ...taken];
  if(s.herbs.length === 0){
    LOCAL.board.splice(LOCAL.selSetIdx, 1);
  } else {
    s._candidate = !isValidSet(s.herbs);
  }
  LOCAL.selSetIdx = null;
  LOCAL.selSetCards.clear();
  msg(`${taken.length}장 손패로 회수`,'');
  renderBoard(); renderHand(); renderActions();
}

function actDeselect(){
  LOCAL.selHand.clear();
  LOCAL.selSetIdx = null;
  LOCAL.selSetCards.clear();
  renderBoard(); renderHand(); renderActions();
}

function actUndo(){
  LOCAL.hand = [...LOCAL.origHand];
  LOCAL.board = JSON.parse(JSON.stringify(LOCAL.origBoard)).map(s => ({...s, _candidate:false}));
  LOCAL.selHand.clear();
  LOCAL.selSetIdx = null;
  LOCAL.selSetCards.clear();
  msg('되돌렸습니다','');
  renderBoard(); renderHand(); renderActions();
}

async function actCommit(){
  if(!LOCAL.isMyTurn){ msg('차례가 아닙니다','warn'); return; }
  // v9.8: 첫 출패(initial meld) 룰 — 외부 모듈이 있으면 위임
  if(window.V98CubeRules){
    const _ck = window.V98CubeRules.validateLocal(LOCAL);
    if(!_ck.ok){ msg(_ck.msg, 'warn'); return; }
  }
  for(const s of LOCAL.board){
    if(!isValidSet(s.herbs)){
      msg(`⚠ 미완성 set: ${s.herbs.join('·')}`,'warn');
      return;
    }
  }
  if(!(LOCAL.hand.length < LOCAL.origHand.length)){
    msg('손패에서 1장 이상 출패해야 합니다','warn'); return;
  }
  const btn = $('#bc-commit'); if(btn) btn.disabled = true;
  const r = await commitTurn(LOCAL.roomId, LOCAL.board, LOCAL.hand, LOCAL.origHand, LOCAL.origBoard);
  if(!r.ok){
    msg(`✗ ${r.msg}`,'warn');
    if(r.penalty){
      const dr = await draw(LOCAL.roomId, PENALTY_DRAW);
      if(dr.ok){
        msg(`페널티 ${PENALTY_DRAW}장: ${dr.drawn.join('·')}`,'warn');
        LOCAL.hand = [...LOCAL.origHand, ...dr.drawn];
        LOCAL.board = JSON.parse(JSON.stringify(LOCAL.origBoard)).map(s => ({...s, _candidate:false}));
        LOCAL.selHand.clear(); LOCAL.selSetIdx = null; LOCAL.selSetCards.clear();
        renderBoard(); renderHand();
      }
    }
    if(btn) btn.disabled = false;
    return;
  }
  toast_('출패 완료','gold');
}

async function actDraw(){
  if(!LOCAL.isMyTurn){ msg('차례가 아닙니다','warn'); return; }
  if(!msetEq(LOCAL.origHand, LOCAL.hand) ||
     !msetEq(boardHerbs(LOCAL.origBoard), boardHerbs(LOCAL.board)) ||
     LOCAL.board.length !== LOCAL.origBoard.length){
    msg('변경 사항이 있습니다. 「되돌리기」 후 뽑으세요','warn'); return;
  }
  const btn = $('#bc-drawbtn'); if(btn) btn.disabled = true;
  const r = await draw(LOCAL.roomId, 1);
  if(!r.ok){
    msg(`✗ ${r.msg||'드로우 실패'}`,'warn');
    if(btn) btn.disabled = false;
    return;
  }
  toast_(`패 뽑기: ${r.drawn[0]}`,'gold');
}

function msg(text, kind){
  const el = $('#bc-msg'); if(!el) return;
  const col = kind === 'warn' ? 'var(--zhusha-d)' : kind === 'gold' ? 'var(--huang-d)' : 'var(--gutong)';
  el.style.color = col;
  el.textContent = text;
  clearTimeout(MSG_TIMER);
  MSG_TIMER = setTimeout(() => { if(el && el.textContent === text) el.textContent = ''; }, 4500);
}

function startTurnTimer(room){
  stopTurnTimer();
  if(room.status !== 'playing') return;
  TURN_TIMER = setInterval(() => {
    const ts = room.turnStartedAt || 0;
    const remain = Math.max(0, TURN_SEC - Math.floor((Date.now() - ts)/1000));
    const t = $('#bc-timer');
    if(t){
      t.textContent = `${remain}s`;
      t.style.color = remain < 15 ? 'var(--zhusha-d)' : 'var(--mo)';
    }
    if(remain <= 0 && LOCAL && LOCAL.isMyTurn){
      stopTurnTimer();
      autoTimeout();
    }
  }, 1000);
}

async function autoTimeout(){
  if(!LOCAL) return;
  LOCAL.hand = [...LOCAL.origHand];
  LOCAL.board = JSON.parse(JSON.stringify(LOCAL.origBoard)).map(s => ({...s, _candidate:false}));
  await draw(LOCAL.roomId, 1);
  toast_('시간 초과 — 자동 드로우','warn');
}

function updateGameView(snap){
  if(!snap) return;
  if(snap.status === 'done'){
    stopTurnTimer();
    renderResult(snap.roomId || CUR_ROOM, snap);
    return;
  }
  const u = myUid();
  const ti = $('#bc-turninfo'); if(ti) ti.innerHTML = topbarHTML(snap);
  const ps = $('#bc-players'); if(ps) ps.innerHTML = playersHTML(snap);
  const di = $('#bc-deckinfo'); if(di) di.innerHTML = `덱 <b>${snap.deckCount||0}</b>장 · set <b>${(snap.board||[]).length}</b>`;

  if(!LOCAL) return;
  const wasMyTurn = LOCAL.isMyTurn;
  const isMy = (snap.turnUserId === u);
  // 보드는 항상 sync (다른 사람이 commit 시)
  LOCAL.origBoard = JSON.parse(JSON.stringify(snap.board||[]));
  // 내가 turn 작업 중이 아니라면 LOCAL.board 도 sync
  if(!isMy || isMy !== wasMyTurn){
    LOCAL.board = JSON.parse(JSON.stringify(snap.board||[])).map(s => ({...s, _candidate:false}));
    LOCAL.selSetIdx = null;
    LOCAL.selSetCards.clear();
  }
  if(isMy !== wasMyTurn){
    // 손패 재조회
    getMyHand(LOCAL.roomId).then(hand => {
      if(!LOCAL) return;
      LOCAL.origHand = [...hand];
      LOCAL.hand = [...hand];
      LOCAL.selHand.clear();
      LOCAL.isMyTurn = isMy;
      renderBoard(); renderHand(); renderActions();
    });
  } else {
    renderBoard();
    renderActions();
  }
  startTurnTimer(snap);
}

function bindHelpAndLeave(rid){
  $('#bc-help').addEventListener('click', () => {
    if(typeof openModal !== 'function') return;
    openModal(`
      <div style="padding:6px 4px">
        <h3 style="font-family:var(--font-display);color:var(--zhusha-d);margin-bottom:10px">方劑Cube 조작법</h3>
        <ol style="font-size:13px;line-height:1.7;padding-left:20px;margin:0">
          <li><b>손패 카드 탭</b> — 선택/해제 (다중 선택 가능)</li>
          <li><b>보드 set 의 카드 탭</b> — 그 카드 선택 (split 후보)</li>
          <li><b>보드 set 의 제목 탭</b> — 전체 카드 선택</li>
          <li><b>「創」 새 set</b> — 손패 선택 카드들로 새 set 만들기 (최소 2장)</li>
          <li><b>「加」 set에 추가</b> — 손패 선택 + 보드 set 선택 → 그 set 에 추가 (가감방 변형)</li>
          <li><b>「取」 손패로</b> — 보드 set 의 선택 카드를 손패로 회수 (split)</li>
          <li><b>「終」 턴 종료</b> — 모든 set 유효 + 손패 1장 이상 출패 → 인정</li>
          <li><b>「摸」 패 뽑기</b> — 변경 없을 때만, 덱 1장 + 턴 종료</li>
          <li><b>「↺」 되돌리기</b> — 턴 시작 시점으로</li>
        </ol>
        <div style="font-size:12px;color:var(--gutong);margin-top:14px;background:rgba(0,0,0,.04);padding:8px;border-radius:6px;line-height:1.6">
          <b>예시:</b> 보드에 사군자탕(인삼·백출·복령·감초) 이 있을 때, 손패의 진피 선택 → 사군자탕 헤더 탭 → 「加」 → <b>이공산</b> 으로 변형. 보드의 처방을 분해해 다른 set 과 재조합도 가능.
        </div>
        <div style="text-align:center;margin-top:14px">
          <button class="btn" id="bc-help-close" type="button">알겠습니다</button>
        </div>
      </div>
    `);
    $('#bc-help-close').addEventListener('click', () => closeModal());
  });
  $('#bc-leave-game').addEventListener('click', async () => {
    if(!confirm('항복하시겠습니까? 게임에서 빠집니다 (보상 없음).')) return;
    await forfeit(rid);
    exitToLobby();
  });
}

// ──────────────────────────────────────────────────────────────────
// 11. 결과 화면
// ──────────────────────────────────────────────────────────────────
const _settled = {};

function renderResult(rid, room){
  const v = view(); if(!v) return;
  stopTurnTimer();
  const u = myUid();
  const winnerId = (room.result && room.result.winnerId) || '';
  const ps = room.players || {};
  const winner = ps[winnerId] || {};
  const isWin = (winnerId === u);

  // v9.6: 등수 산정 — 승자 1등, 나머지는 손패 적은 순 (동률은 난이도 점수 desc)
  const others = Object.entries(ps).filter(([uid]) => uid !== winnerId)
    .map(([uid, p]) => ({uid, ...p, handCount: p.handCount||999, _formulationScore: p._formulationScore||0}));
  others.sort((a,b) => (a.handCount - b.handCount) || (b._formulationScore - a._formulationScore));
  const ranking = [{uid: winnerId, place: 1, ...(ps[winnerId]||{})}];
  others.forEach((p, i) => ranking.push({uid: p.uid, place: i+2, ...p}));
  const myRank = ranking.find(r => r.uid === u);

  // v9.6: 등수별 기본 보상 + 난이도 보너스
  //   1등: 80 + score×0.5 (max 40)
  //   2등: 30 + score×0.4 (max 30)
  //   3등: 20 + score×0.3 (max 20)
  //   4등: 10 + score×0.2 (max 10)
  const PLACE_BASE = { 1:80, 2:30, 3:20, 4:10 };
  const PLACE_DBONUS_RATE = { 1:0.5, 2:0.4, 3:0.3, 4:0.2 };
  const PLACE_DBONUS_CAP  = { 1:40, 2:30, 3:20, 4:10 };

  // 보상 정산 — 한 번만
  let reward = 0, rewardBase = 0, rewardBonus = 0, myFormScore = 0;
  if(!_settled[rid]){
    _settled[rid] = true;
    if(myRank){
      const place = myRank.place;
      myFormScore = myRank._formulationScore || 0;
      rewardBase = PLACE_BASE[place] || 0;
      rewardBonus = Math.min(PLACE_DBONUS_CAP[place]||0, Math.floor(myFormScore * (PLACE_DBONUS_RATE[place]||0)));
      reward = rewardBase + rewardBonus;
    }
    if(reward > 0 && typeof S !== 'undefined' && S){
      S.qi = (S.qi||0) + reward;
      if(typeof saveState === 'function') saveState();
      if(typeof refreshHeader === 'function') refreshHeader();
    }
    // 對局 history 기록 (있으면)
    if(typeof S !== 'undefined' && S){
      S.cubeHistory = S.cubeHistory || [];
      S.cubeHistory.unshift({
        ts: nowMs(), roomId: rid,
        win: isWin, place: (myRank&&myRank.place)||null,
        runner: !isWin && myRank && myRank.place === 2,
        deltaQi: reward,
        formulationScore: myFormScore,
        opponents: Object.keys(ps).filter(uid => uid !== u).length,
        boardSets: (room.board||[]).length,
      });
      if(S.cubeHistory.length > 20) S.cubeHistory = S.cubeHistory.slice(0, 20);
      if(typeof saveState === 'function') saveState();
    }
  } else {
    // 이미 정산됨 — 표시용 값 복원
    if(myRank){
      const place = myRank.place;
      myFormScore = myRank._formulationScore || 0;
      rewardBase = PLACE_BASE[place] || 0;
      rewardBonus = Math.min(PLACE_DBONUS_CAP[place]||0, Math.floor(myFormScore * (PLACE_DBONUS_RATE[place]||0)));
      reward = rewardBase + rewardBonus;
    }
  }
  // 보드 요약
  const finalBoard = (room.board || []).map(s => {
    const ms = matchSet(s.herbs);
    const top = ms.find(x => x.type==='base') || ms[0] || null;
    return {
      label: top ? top.label : '?',
      han:   top ? (top.han || '') : '',
      type:  top ? top.type : '?',
      herbs: s.herbs,
    };
  });
  v.innerHTML = `
    <div id="bc-result-root">
      <div class="view-title"><span class="han">${isWin?'勝':'終'}</span> 對局 종료</div>
      <div class="card imperial fade-in" style="text-align:center;padding:18px 12px">
        <div style="font-size:48px;font-family:var(--font-display);color:${isWin?'var(--zhusha-d)':'var(--gutong)'};line-height:1;letter-spacing:.1em">${isWin?'勝':myRank?`第 ${myRank.place} 等`:'敗'}</div>
        <div style="font-size:14px;color:var(--mo-l);margin-top:8px">
          ${isWin ? '<b style="color:var(--zhusha-d)">당신의 승리입니다</b>' : `승자: <b>${esc_(winner.name||'?')}</b>`}
        </div>
        ${reward > 0 ? `
          <div style="margin-top:14px;display:inline-block;padding:10px 18px;background:var(--huang-l);border:1.5px solid var(--huang-d);border-radius:8px">
            <span class="seal" style="font-size:12.5px;color:var(--mo);display:block;margin-bottom:2px">획득 氣 (${(myRank&&myRank.place)||'-'} 등)</span>
            <b class="han" style="font-size:28px;color:var(--zhusha-d)">+${reward}</b>
            ${rewardBonus > 0 ? `
              <div style="font-size:11px;color:var(--mo-l);margin-top:4px">
                기본 ${rewardBase} + 난이도 보너스 <b style="color:var(--feicui)">+${rewardBonus}</b>
                <span style="font-size:10px;color:var(--gutong);display:block">(處方 점수 ${myFormScore})</span>
              </div>
            ` : `<div style="font-size:11px;color:var(--mo-l);margin-top:4px">기본 ${rewardBase} 氣</div>`}
          </div>
        ` : ''}
      </div>

      <!-- v9.6: 등수 및 난이도 점수표 -->
      <div class="card fade-in">
        <div class="card-title"><span class="han">榜</span> 최종 순위 · 處方 난이도 점수</div>
        <div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">
          ${ranking.map((r, i) => {
            const isMeRow = r.uid === u;
            const isW = r.place === 1;
            const placeSeal = ['🥇','🥈','🥉','4'][r.place-1] || `${r.place}`;
            return `
              <div style="display:flex;align-items:center;gap:8px;padding:7px 8px;background:${isW?'var(--huang-l)':isMeRow?'rgba(156,48,48,.06)':'var(--mi)'};border-radius:5px;${isMeRow?'border:1px solid var(--zhusha-d)':''}">
                <span style="font-size:14px;flex:0 0 28px;text-align:center">${placeSeal}</span>
                <span style="flex:1;font-size:13px;color:var(--mo);font-weight:${isW?'700':'500'}">
                  ${esc_(r.name||'?')}${isMeRow?' <span style="font-size:10px;color:var(--zhusha-d)">(나)</span>':''}
                </span>
                <span style="font-size:11px;color:var(--gutong)">${r.handCount||0}장</span>
                <span style="font-size:11.5px;color:var(--feicui);min-width:60px;text-align:right" title="處方 난이도 누적 점수">
                  ${r._formulationScore||0} <span style="font-size:9.5px;color:var(--gutong)">pt</span>
                </span>
              </div>
            `;
          }).join('')}
        </div>
        <div style="font-size:10.5px;color:var(--gutong);margin-top:8px;font-style:italic;line-height:1.5">
          v9.6 · 난이도 점수 = 基方 10·派生 7·加減 5 + (본초 수 ×1, 가감 +2 ×n) ·
          1等 보너스 ×0.5 (max +40) · 2等 ×0.4 (+30) · 3等 ×0.3 (+20) · 4等 ×0.2 (+10)
        </div>
      </div>

      <div class="card fade-in">
        <div class="card-title"><span class="han">局面</span> 최종 보드 (${finalBoard.length} set)</div>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
          ${finalBoard.length ? finalBoard.map(s => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--mi);border-radius:6px;border-left:3px solid ${s.type==='base'?'var(--zhusha)':s.type==='derive'?'var(--huang-d)':'var(--feicui)'}">
              <div style="flex:0 0 auto;min-width:90px">
                <div class="han" style="font-size:13px;color:var(--zhusha-d);font-weight:600">${esc_(s.han)}</div>
                <div style="font-size:11px;color:var(--mo-l)">${esc_(s.label)}</div>
              </div>
              <div style="flex:1;font-size:11.5px;color:var(--mo)" class="han">${s.herbs.map(esc_).join(' · ')}</div>
            </div>
          `).join('') : '<div style="text-align:center;padding:14px;color:var(--gutong);font-size:12px">보드 비어 있음</div>'}
        </div>
      </div>

      <div class="card fade-in" style="display:flex;gap:6px;justify-content:center">
        <button class="btn btn-gold" id="bc-again" type="button"><span class="han">再</span>&nbsp;새 對局</button>
        <button class="btn btn-o" id="bc-home" type="button">로비로</button>
      </div>

      <!-- v9.6: 對局 종료 후에도 채팅 유지 -->
      <div id="bc-chat-host-result"></div>
    </div>
  `;
  // v9.6: 채팅 컨테이너 이동 (결과 화면에서도 계속 노출)
  try{
    if(window._v96CurrentCubeChatCtx){
      const host = document.getElementById('bc-chat-host-result');
      const ex = document.querySelector(`.chat-card[data-cid="${window._v96CurrentCubeChatCtx.id}"]`);
      if(host && ex){ host.appendChild(ex); }
    }
  }catch(_){}
  $('#bc-again').addEventListener('click', () => exitToLobby());
  $('#bc-home').addEventListener('click', () => exitToLobby());
}

// ──────────────────────────────────────────────────────────────────
// 12. CSS 자동 주입
// ──────────────────────────────────────────────────────────────────
const BC_CSS = `
.bc-card{
  display:inline-flex;flex-direction:column;align-items:center;justify-content:center;
  background:linear-gradient(180deg, var(--mi-w) 0%, var(--mi) 100%);
  border:1.5px solid var(--mi-d);border-radius:8px;
  padding:8px 6px;margin:3px;cursor:pointer;
  min-width:62px;max-width:78px;
  box-shadow:0 1px 3px rgba(28,20,10,.18);
  transition:transform .08s, box-shadow .12s, border-color .12s;
  position:relative;user-select:none;
}
.bc-card::before{
  content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
  background:var(--flavor, var(--gutong));
  border-radius:8px 0 0 8px;
}
.bc-card:hover{border-color:var(--huang-d);box-shadow:0 2px 6px rgba(28,20,10,.28)}
.bc-card-sel{
  border-color:var(--zhusha)!important;
  background:linear-gradient(180deg, var(--huang-l) 0%, #FFE0AA 100%)!important;
  box-shadow:0 0 0 2px var(--zhusha-d), 0 2px 8px rgba(156,48,48,.35)!important;
  transform:translateY(-2px);
}
.bc-card-han{
  font-family:var(--font-han);font-size:14px;font-weight:600;
  color:var(--zhusha-d);letter-spacing:.02em;line-height:1.1;
  text-align:center;white-space:nowrap;
}
.bc-card-ko{
  font-size:9.5px;color:var(--mo-l);margin-top:2px;
  text-align:center;line-height:1.1;
}
.bc-card-sm-text{
  font-size:8px;color:var(--gutong);margin-top:3px;
  text-align:center;line-height:1.05;letter-spacing:.02em;
  font-family:var(--font-han);
}
.bc-card-sm{
  min-width:44px;max-width:56px;padding:5px 3px;margin:2px;
}
.bc-card-sm .bc-card-han{font-size:12px}
.bc-card-sm .bc-card-ko{font-size:8.5px}

.bc-hand{
  display:flex;flex-wrap:wrap;gap:0;
  padding:4px;background:rgba(0,0,0,.02);
  border-radius:6px;min-height:80px;
}
.bc-board{display:flex;flex-direction:column;gap:8px}
.bc-set{
  border:1.5px solid var(--accent);border-radius:8px;
  background:linear-gradient(180deg, var(--mi-w) 0%, var(--mi) 100%);
  padding:6px;position:relative;
  transition:box-shadow .12s, border-color .12s;
}
.bc-set-sel{
  box-shadow:0 0 0 2px var(--zhusha-d), 0 3px 10px rgba(156,48,48,.25);
}
.bc-set-head{
  display:flex;align-items:center;gap:6px;
  padding:4px 6px;background:rgba(0,0,0,.04);
  border-radius:5px;margin-bottom:4px;cursor:pointer;
  font-size:12px;
}
.bc-set-head:hover{background:rgba(0,0,0,.08)}
.bc-set-label{
  color:var(--zhusha-d);font-weight:600;font-size:13px;
}
.bc-set-label-ko{
  color:var(--mo-l);font-size:11px;letter-spacing:.02em;
}
.bc-set-valid{font-size:11px;font-weight:600;letter-spacing:.04em}
.bc-set-cnt{
  background:var(--accent);color:var(--huang-l);
  border-radius:10px;padding:1px 7px;font-size:10px;font-weight:600;
  min-width:18px;text-align:center;
}
.bc-set-cards{
  display:flex;flex-wrap:wrap;gap:0;padding:2px;
}

/* 홈 대청 — 방미큐브 타일 (전용 강조) */
.tile.cube{
  background:linear-gradient(135deg, #FFF8E0 0%, #F5E6B8 50%, #FFE08A 100%);
  border:2px solid var(--huang-d);
  position:relative;overflow:hidden;
  grid-column: span 2;
}
.tile.cube::before{
  content:'';position:absolute;right:-20px;top:-20px;
  width:80px;height:80px;border-radius:50%;
  background:radial-gradient(circle, rgba(156,48,48,.18) 0%, transparent 70%);
}
.tile.cube .han{color:var(--zhusha-d);font-size:22px;font-weight:700}
.tile.cube .ttl{color:var(--mo);font-weight:700;font-size:14.5px}
.tile.cube .desc{color:var(--mo-l)}
.tile.cube .new-badge{
  display:inline-block;background:var(--zhusha);color:var(--huang-l);
  padding:1px 6px;border-radius:8px;font-size:9.5px;font-weight:700;
  margin-left:4px;vertical-align:middle;letter-spacing:.04em;
}
@media (max-width: 380px){
  .bc-card{min-width:54px;max-width:68px;padding:6px 4px}
  .bc-card-han{font-size:13px}
  .bc-card-sm{min-width:40px;max-width:50px}
  .bc-card-sm .bc-card-han{font-size:11px}
}
`;

function injectCSS(){
  if(document.getElementById('bc-css')) return;
  const st = document.createElement('style');
  st.id = 'bc-css';
  st.textContent = BC_CSS;
  document.head.appendChild(st);
}

// ──────────────────────────────────────────────────────────────────
// 13. 외부 노출
// ──────────────────────────────────────────────────────────────────
function init(){
  build();
  injectCSS();
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 외부 노출 — app.js 의 ROUTES 및 v9.6 AI 모듈에서 사용
window.renderCube = renderCube;
window.BC = {
  VERSION: BC_VER,
  build, injectCSS,
  matchSet, isValidSet, validateBoard,
  // v9.6: AI 大局 진입용 — V96CubeAI 가 호출
  enterRoom, startGame,
  // 디버깅용
  sets: () => _sets,
  proto: () => _proto,
  currentRoom: () => CUR_ROOM,
  exitToLobby,
  diag: () => ({
    version: BC_VER,
    sets: (_sets||[]).length,
    deck: (_proto||[]).length,
    sample: (_sets||[]).slice(0,3).map(s => `${s.type}:${s.label}=${s.herbs.join('·')}`),
  }),
};

})();
