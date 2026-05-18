/* bangje-v96 part 4 — 방미큐브 AI
 *
 * 핵심:
 *   - bangje-cube.js 의 BC 모듈은 모든 IO 를 FB 로 함. FB 를 가짜로 가로채는
 *     bridge 로 in-memory 큐브 룸을 흉내냄.
 *   - AI 휴리스틱: 손패에서 만들 수 있는 가장 가치 큰 set 부터 출패.
 *       우선순위: base > derive > symptom 그리고 set 크기.
 *     못 만들면 1장 드로우.
 *   - 보드 확장 (보드 set 변형) 은 미구현 (난이도·휴리스틱 복잡). 단순화 OK.
 *   - 난이도 누적 점수 _formulationScore 로 추적 → renderResult 에서 가산.
 *
 * v9.7 픽스:
 *   - _setupBridge() 가 boolean 반환 (성공/실패).
 *   - FB 탐색 다중화: window.FB → globalThis.FB → 렉시컬 FB.
 *   - 셋업 실패 시 start() 가 즉시 stop() → _started 가 stuck 되지 않음
 *     ("이미 진행중" 무한 락아웃 + "방을 찾을 수 없습니다" 버그 해결).
 *   - BC.enterRoom 후 BC.currentRoom() 으로 사후 검증.
 *   - _patchedF 변수로 teardown 안정화.
 */
(function(){
'use strict';

const now = () => Date.now();
const toast_ = (m,k) => { if(typeof toast === 'function') toast(m,k); };
const FB_NODE = 'cube_rooms';

let _started = false;
let _origMethods = null;
let _patchedF = null;      // v9.7: setup 때 잡은 F reference
let _room = null;
let _subs = [];
let _aiTimer = null;
let _rid = null;
let _aiUids = [];

function _aiName(){
  if(typeof PHYSICIANS === 'undefined') return 'AI';
  const myId = (typeof S !== 'undefined' && S && S.character) || '';
  const pool = PHYSICIANS.filter(p => p && p.id && p.cat !== 'divine' && p.id !== 'leesoonjae' && p.id !== myId);
  const p = pool[Math.floor(Math.random()*pool.length)] || PHYSICIANS[0];
  return p.han + ' (AI)';
}
function _aiCharId(){
  if(typeof PHYSICIANS === 'undefined') return 'huatuo';
  const myId = (typeof S !== 'undefined' && S && S.character) || '';
  const pool = PHYSICIANS.filter(p => p && p.id && p.cat !== 'divine' && p.id !== 'leesoonjae' && p.id !== myId);
  return (pool[Math.floor(Math.random()*pool.length)] || pool[0] || {id:'huatuo'}).id;
}

async function start(numAi){
  if(_started){ toast_('이미 진행 중','warn'); return; }
  if(!window.BC){ toast_('방미큐브 모듈 미로드','red'); return; }
  numAi = Math.max(1, Math.min(3, numAi||1));
  _rid = 'AI_CUBE_'+Math.random().toString(36).slice(2,5).toUpperCase();
  const me = S;
  const players = {
    [me.userId]: { name: me.name, character: me.character, faction: me.faction||'',
                   handCount: 0, isHost: true, isReady: true, joinedAt: now() },
  };
  _aiUids = [];
  for(let i=0;i<numAi;i++){
    const uid = 'ai_cube_'+i+'_'+Math.random().toString(36).slice(2,4);
    _aiUids.push(uid);
    players[uid] = {
      name: _aiName(), character: _aiCharId(),
      faction: ['taeyang','soyang','taeum','soeum'][i % 4],
      handCount: 0, isHost: false, isReady: true, joinedAt: now()+i+1,
      _isAi: true,
    };
  }
  _room = {
    status: 'waiting',
    hostId: me.userId,
    createdAt: now(),
    maxPlayers: 1 + numAi,
    name: `vs ${numAi} AI`,
    isPublic: false,
    players,
    hands: {},
    deck: [],
    board: [],
    turnOrder: [],
    turnIdx: 0, turnUserId: '',
    deckCount: 0,
    lastAction: null,
    _formulationScore: { [me.userId]: 0 },
    _scoredSetIds: {},
  };
  _aiUids.forEach(u => { _room._formulationScore[u] = 0; });
  _started = true;
  // v9.7: 브릿지 셋업이 실패하면 즉시 stop()
  const bridgeOk = _setupBridge();
  if(!bridgeOk){
    toast_('AI 진입 실패: FB 어댑터 활성화 실패 (새로고침 권장)','red');
    stop();
    return;
  }
  if(window.V96Activity) V96Activity.set('AI 방미큐브', `${1 + numAi}人 對局`);

  // BC 모듈로 입장
  try{
    if(typeof BC.enterRoom === 'function'){
      await BC.enterRoom(_rid);
    } else {
      toast_('BC.enterRoom 없음','red'); stop(); return;
    }
  }catch(e){
    console.error('BC.enterRoom failed', e);
    toast_('AI 룸 진입 실패','red'); stop(); return;
  }
  // v9.7: 入室 후 BC.currentRoom() 이 _rid 와 일치하는지 검증.
  //   enterRoom 은 f.get 실패 시 toast 만 띄우고 silent return 하므로,
  //   브릿지가 잘 적용됐는지 사후 검증 → 불일치면 stop() 으로 정리.
  try{
    const cur = (typeof BC.currentRoom === 'function') ? BC.currentRoom() : null;
    if(cur !== _rid){
      console.warn('[V96CubeAI] enterRoom 결과 CUR_ROOM 불일치', {expected:_rid, actual:cur});
      toast_('AI 룸 진입 검증 실패 — 새로고침 권장','red');
      stop();
      return;
    }
  }catch(_){}

  // 자동 시작 (1.5초 후)
  setTimeout(async () => {
    try{
      if(typeof BC.startGame === 'function'){
        await BC.startGame(_rid);
      } else {
        _selfStart();
      }
      setTimeout(_maybeAiTurn, 1500);
    }catch(e){
      console.error('start game failed', e);
      _selfStart();
      setTimeout(_maybeAiTurn, 1500);
    }
  }, 1500);
}

function stop(){
  if(!_started) return;
  _started = false;
  if(_aiTimer){ clearTimeout(_aiTimer); _aiTimer = null; }
  _teardownBridge();
  _room = null; _rid = null; _aiUids = [];
  if(window.V96Activity) V96Activity.set('', '');
}

function _selfStart(){
  if(!_room) return;
  const order = [_room.hostId, ..._aiUids];
  const hSize = order.length >= 4 ? 10 : 12;
  const proto = (typeof BC !== 'undefined' && BC.proto) ? BC.proto() : [];
  if(!proto.length){ toast_('BC.proto() 비어있음','red'); return; }
  const deck = proto.slice().sort(()=>Math.random()-0.5);
  const hands = {};
  let cursor = 0;
  for(const u of order){
    hands[u] = deck.slice(cursor, cursor+hSize); cursor += hSize;
    _room.players[u].handCount = hSize;
  }
  _room.hands = hands;
  _room.deck = deck.slice(cursor);
  _room.deckCount = _room.deck.length;
  _room.board = [];
  _room.turnOrder = order;
  _room.turnIdx = 0;
  _room.turnUserId = order[0];
  _room.turnStartedAt = now();
  _room.startedAt = now();
  _room.status = 'playing';
  _emit();
}

function _setupBridge(){
  if(_origMethods) return true;
  // v9.7: FB 탐색 다중화 — window.FB → globalThis.FB → eval('FB')
  let F = (typeof window !== 'undefined' && window.FB) || null;
  if(!F && typeof globalThis !== 'undefined' && globalThis.FB) F = globalThis.FB;
  if(!F){ try{ F = eval('typeof FB !== "undefined" ? FB : null'); }catch(_){} }
  if(!F){
    console.warn('[V96CubeAI] FB 노출 실패 — window.FB / globalThis.FB / lex FB 모두 부재');
    return false;  // ← 호출자가 _started 정리 가능
  }
  _origMethods = {
    get: F.get, put: F.put, putRetry: F.putRetry,
    del: F.del, push: F.push, subscribe: F.subscribe,
  };
  const orig = _origMethods;
  const rid = _rid;
  const isMine = (p) => p && (
    p === `${FB_NODE}/${rid}` ||
    p.startsWith(`${FB_NODE}/${rid}/`) ||
    p === FB_NODE
  );
  function pathSet(obj, path, val){
    const segs = path.split('/').filter(Boolean);
    let cur = obj;
    for(let i=0;i<segs.length-1;i++){
      const k = segs[i];
      if(typeof cur[k] !== 'object' || cur[k] === null){ cur[k] = isNaN(+segs[i+1]) ? {} : []; }
      cur = cur[k];
    }
    cur[segs[segs.length-1]] = val;
  }
  function pathGet(obj, path){
    const segs = path.split('/').filter(Boolean);
    let cur = obj;
    for(const k of segs){ if(cur==null) return null; cur = cur[k]; }
    return cur;
  }
  F.get = async function(path, ...rest){
    if(!isMine(path)) return orig.get.call(F, path, ...rest);
    if(path === FB_NODE){ return _room ? { [rid]: _room } : {}; }
    if(path === `${FB_NODE}/${rid}`) return _room;
    const rel = path.slice(`${FB_NODE}/${rid}/`.length);
    return pathGet(_room, rel);
  };
  F.put = async function(path, val, ...rest){
    if(!isMine(path)) return orig.put.call(F, path, val, ...rest);
    if(path === `${FB_NODE}/${rid}`){ _room = Object.assign(_room||{}, val); }
    else {
      const rel = path.slice(`${FB_NODE}/${rid}/`.length);
      pathSet(_room, rel, val);
    }
    _afterMutation(path, val);
    _emit();
    return true;
  };
  F.putRetry = async function(path, val, opts){
    if(isMine(path)){
      const ok = await F.put(path, val);
      return { ok, status: 200, retries: 0, message: '' };
    }
    return orig.putRetry.call(F, path, val, opts);
  };
  F.del = async function(path, ...rest){
    if(!isMine(path)) return orig.del.call(F, path, ...rest);
    if(path === `${FB_NODE}/${rid}`){ _room = null; _emit(); return true; }
    const rel = path.slice(`${FB_NODE}/${rid}/`.length);
    const segs = rel.split('/').filter(Boolean);
    let cur = _room;
    for(let i=0;i<segs.length-1;i++){ cur = cur && cur[segs[i]]; }
    if(cur) delete cur[segs[segs.length-1]];
    _emit();
    return true;
  };
  F.push = async function(path, val, ...rest){
    if(!isMine(path)) return orig.push.call(F, path, val, ...rest);
    const rel = path.slice(`${FB_NODE}/${rid}/`.length);
    const segs = rel.split('/').filter(Boolean);
    let cur = _room;
    for(const k of segs){
      if(typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
      cur = cur[k];
    }
    const id = 'lc_'+Math.random().toString(36).slice(2,8);
    cur[id] = val;
    _emit();
    return id;
  };
  F.subscribe = function(path, cb, opts){
    if(!isMine(path)) return orig.subscribe.call(F, path, cb, opts);
    _subs.push({ path, cb });
    setTimeout(() => {
      try{
        if(path === `${FB_NODE}/${rid}`) cb(_room);
        else if(path === FB_NODE) cb(_room ? { [rid]: _room } : {});
        else {
          const rel = path.slice(`${FB_NODE}/${rid}/`.length);
          cb(pathGet(_room, rel));
        }
      }catch(_){}
    }, 30);
    return { close: () => { _subs = _subs.filter(s => s.cb !== cb); }};
  };
  _patchedF = F;  // v9.7
  return true;
}

function _teardownBridge(){
  if(!_origMethods) return;
  // v9.7: setup 때 잡았던 F reference 우선 사용
  const F = _patchedF || (typeof window !== 'undefined' && window.FB) || null;
  if(F){
    F.get = _origMethods.get;
    F.put = _origMethods.put;
    F.putRetry = _origMethods.putRetry;
    F.del = _origMethods.del;
    F.push = _origMethods.push;
    F.subscribe = _origMethods.subscribe;
  }
  _origMethods = null;
  _patchedF = null;
  _subs = [];
}

function _emit(){
  // v9.6: 마이크로태스크 배칭 + 경로별 정확한 데이터 전달
  if(_emitPending) return;
  _emitPending = true;
  Promise.resolve().then(() => {
    _emitPending = false;
    if(!_room && _subs.length === 0) return;
    const rid = _rid;
    for(const s of _subs){
      try{
        if(s.path === `${FB_NODE}/${rid}`){
          s.cb(_room);
        } else if(s.path === FB_NODE){
          s.cb(_room ? { [rid]: _room } : {});
        } else {
          const rel = s.path.slice(`${FB_NODE}/${rid}/`.length);
          const segs = rel.split('/').filter(Boolean);
          let cur = _room;
          for(const k of segs){ if(cur==null) break; cur = cur[k]; }
          s.cb(cur);
        }
      }catch(_){}
    }
  });
}
let _emitPending = false;

// ─ AI 출패 로직 ────────────────────────────────────────────────────────────
function _findBestPlay(hand){
  if(!window.BC || !BC.sets) return null;
  const sets = BC.sets();
  const handCount = {};
  for(const h of hand) handCount[h] = (handCount[h]||0) + 1;
  const candidates = [];
  for(const s of sets){
    const need = {};
    for(const h of s.herbs) need[h] = (need[h]||0)+1;
    let ok = true;
    for(const k of Object.keys(need)){
      if((handCount[k]||0) < need[k]){ ok = false; break; }
    }
    if(!ok) continue;
    let typeScore = 0;
    if(s.type === 'base') typeScore = 3;
    else if(s.type === 'derive') typeScore = 2;
    else typeScore = 1;
    candidates.push({ s, score: typeScore*100 + s.herbs.length });
  }
  candidates.sort((a,b) => b.score - a.score);
  return candidates[0] ? candidates[0].s : null;
}

function _difficultyPoints(s){
  const typePt = s.type === 'base' ? 10 : s.type === 'derive' ? 7 : 5;
  const sizePt = Math.min(15, (s.herbs||[]).length);
  return typePt + sizePt;
}

function _afterMutation(path, val){
  if(!_room) return;
  const rid = _rid;
  if(path === `${FB_NODE}/${rid}/turnUserId`){
    const p = _room.players[val];
    if(p && p._isAi){ _maybeAiTurn(); }
  }
  // 사람이 commitTurn 으로 board 갱신 → 새 set 점수 누적
  if(path === `${FB_NODE}/${rid}/board`){
    _accumFormulationScoreFromBoard(val);
  }
}

function _accumFormulationScoreFromBoard(board){
  if(!_room || !Array.isArray(board)) return;
  if(!_room._scoredSetIds) _room._scoredSetIds = {};
  for(const s of board){
    if(!s || !s.id) continue;
    if(_room._scoredSetIds[s.id]) continue;
    _room._scoredSetIds[s.id] = true;
    const owner = s.modBy || s.by;
    if(!owner) continue;
    const pts = _difficultyPoints(s);
    _room._formulationScore[owner] = (_room._formulationScore[owner]||0) + pts;
  }
}

function _maybeAiTurn(){
  if(!_room || _room.status !== 'playing') return;
  const uid = _room.turnUserId;
  const p = _room.players[uid];
  if(!p || !p._isAi) return;
  if(_aiTimer) clearTimeout(_aiTimer);
  _aiTimer = setTimeout(_doAiTurn, 1400 + Math.random()*1200);
}

function _doAiTurn(){
  if(!_room || _room.status !== 'playing') return;
  const aiUid = _room.turnUserId;
  if(!_room.players[aiUid] || !_room.players[aiUid]._isAi) return;
  const hand = (_room.hands && _room.hands[aiUid]) || [];
  const pick = _findBestPlay(hand);
  if(pick){
    const need = {};
    for(const h of pick.herbs) need[h] = (need[h]||0)+1;
    const newHand = [];
    for(const h of hand){
      if((need[h]||0) > 0){ need[h]--; }
      else newHand.push(h);
    }
    const sId = `s${now()}${Math.floor(Math.random()*1000)}`;
    const setObj = {
      id: sId,
      herbs: pick.herbs,
      label: pick.label,
      han: pick.han || pick.label,
      type: pick.type,
      by: aiUid, modBy: aiUid, modAt: now(),
    };
    _room.board.push(setObj);
    _room.hands[aiUid] = newHand;
    _room.players[aiUid].handCount = newHand.length;
    _room._scoredSetIds[sId] = true;
    _room._formulationScore[aiUid] = (_room._formulationScore[aiUid]||0) + _difficultyPoints(setObj);
    // v9.8.1: AI 도 사람과 동일 트래킹 (콤보/본초수/선출패) + players/{uid}/_formulationScore 동기화
    _room.players[aiUid]._formulationScore = (_room.players[aiUid]._formulationScore || 0) + _difficultyPoints(setObj);
    if(window.V98CubeVictory && typeof window.V98CubeVictory.applyAiCommit === 'function'){
      try{ window.V98CubeVictory.applyAiCommit(_room, aiUid, setObj, true, (setObj.herbs||[]).length); }catch(_){}
    }
    _aiSay(`處方 — ${pick.han || pick.label}`);
    if(newHand.length === 0){
      _room.status = 'done';
      _room.result = { winnerId: aiUid, finishedAt: now(), by:'empty-hand' };
      _emit();
      return;
    }
  } else {
    if(_room.deck.length > 0){
      const c = _room.deck.shift();
      _room.hands[aiUid] = [...(_room.hands[aiUid]||[]), c];
      _room.players[aiUid].handCount = _room.hands[aiUid].length;
      _room.deckCount = _room.deck.length;
      _aiSay('한 장 …');
    } else {
      _aiSay('패스');
    }
    // v9.8.1: AI 가 commit 못하고 draw/pass → streak 리셋
    if(window.V98CubeVictory && typeof window.V98CubeVictory.applyAiDraw === 'function'){
      try{ window.V98CubeVictory.applyAiDraw(_room, aiUid); }catch(_){}
    }
  }
  const order = _room.turnOrder || [];
  const nIdx = (_room.turnIdx + 1) % order.length;
  _room.turnIdx = nIdx;
  _room.turnUserId = order[nIdx];
  _room.turnStartedAt = now();
  _room.lastAction = { by:aiUid, type: pick?'commit':'draw', at: now() };
  _emit();
  setTimeout(_maybeAiTurn, 200);
}

function _aiSay(msg){
  try{
    if(window._v96CurrentCubeChatCtx && window._v96CurrentCubeChatCtx.isLocal){
      V96Chat.aiPush(window._v96CurrentCubeChatCtx, 'AI', msg);
    }
  }catch(_){}
}

function difficultyBonus(uid){
  if(!_room || !_room._formulationScore) return 0;
  return _room._formulationScore[uid] || 0;
}

function isAiRoom(){ return _started && !!_room; }

window.V96CubeAI = { start, stop, difficultyBonus, isAiRoom };

})();
