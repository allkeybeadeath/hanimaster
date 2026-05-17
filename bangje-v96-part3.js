/* bangje-v96 part 3 — Card 對決 AI
 *
 * 핵심 아이디어:
 *   - 실제 카드 對決의 FB.put/get/subscribe 를 가짜 in-memory 룸으로 가로채는
 *     bridge 활성. app.js 의 startCardBattle / renderCardBattle / openDecoctModal
 *     이 평소처럼 동작하되, 모든 RTDB IO 가 로컬 객체로 향함.
 *   - AI 결정은 SYNDROME_BY_ID, FORMULAS 의 indication 키워드 매칭 휴리스틱.
 *   - 채팅은 window._v96CurrentChatCtx 에 등록된 ctx 에 push.
 *
 * v9.7 픽스:
 *   - _setupBridge() 가 boolean 반환 (성공/실패).
 *   - FB 탐색 다중화: window.FB → globalThis.FB → 렉시컬 FB.
 *   - 셋업 실패 시 start() 가 즉시 stop() → _started 가 stuck 되지 않음
 *     ("이미 진행중" 무한 락아웃 버그 해결).
 *   - startCardBattle 후 probe query 로 브릿지 검증.
 *   - _patchedF 변수로 teardown 안정화 (window.FB 가 그 사이 변경돼도 OK).
 */
(function(){
'use strict';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();
const toast_ = (m,k) => { if(typeof toast === 'function') toast(m,k); };

const AI_TURN_DELAY = [1800, 2400, 1500];
const DECOCT_CONFIDENCE = 0.62;

let _origMethods = null;   // 패치 이전 원본 메소드 저장
let _patchedF = null;      // v9.7: setup 때 잡은 F reference (teardown 안정성)
let _roomRef = null;
let _roomId = null;
let _aiUid = null;
let _meUid = null;
let _aiTimer = null;
let _started = false;
const _bridgeSubs = {};

function _aiPersona(){
  if(typeof PHYSICIANS === 'undefined') return {id:'huatuo', han:'華佗', ko:'화타'};
  const myId = (typeof S !== 'undefined' && S && S.character) || '';
  const pool = PHYSICIANS.filter(p => p && p.id && p.cat !== 'divine' && p.id !== 'leesoonjae' && p.id !== myId);
  if(!pool.length) return {id:'huatuo', han:'華佗', ko:'화타'};
  const p = pool[Math.floor(Math.random()*pool.length)];
  return p;
}

function _pickSyndromeOpts(){
  const ids = Object.keys((typeof SYNDROME_BY_ID !== 'undefined') ? SYNDROME_BY_ID : {});
  if(!ids.length) return null;
  return ids.slice().sort(()=>Math.random()-0.5).slice(0, 3);
}

function _buildDeck(meSyn, oppSyn){
  if(typeof FORMULAS === 'undefined' || typeof SYNDROME_BY_ID === 'undefined') return [];
  const meF = FORMULAS.find(x => x.id === SYNDROME_BY_ID[meSyn]?.formulaId);
  const opF = FORMULAS.find(x => x.id === SYNDROME_BY_ID[oppSyn]?.formulaId);
  const set = new Set();
  if(meF) meF.composition.forEach(h => set.add(h));
  if(opF) opF.composition.forEach(h => set.add(h));
  const noise = [];
  const chs = new Set([meF && meF.chapter, opF && opF.chapter].filter(Boolean));
  for(const f of FORMULAS){
    if(chs.has(f.chapter)){ f.composition.forEach(h => noise.push(h)); }
  }
  const noisePick = noise.sort(()=>Math.random()-0.5).slice(0, 10);
  return [...set, ...noisePick].sort(()=>Math.random()-0.5);
}

async function start(){
  if(_started){ toast_('이미 진행 중', 'warn'); return; }
  if(typeof FORMULAS === 'undefined' || typeof SYNDROME_BY_ID === 'undefined'){
    toast_('데이터 미로드','red'); return;
  }
  if(typeof startCardBattle !== 'function'){
    toast_('startCardBattle 미발견','red'); return;
  }
  _started = true;
  const me = S;
  const aiP = _aiPersona();
  _aiUid = 'ai_card_'+Math.random().toString(36).slice(2,8);
  _meUid = me.userId;
  _roomId = 'AI_CARD_'+Math.random().toString(36).slice(2,6).toUpperCase();
  const meSynOpts = _pickSyndromeOpts();
  const aiSynOpts = _pickSyndromeOpts();
  if(!meSynOpts || !aiSynOpts){ toast_('證 데이터 부족','red'); _started=false; return; }

  _roomRef = {
    status: 'choosing',
    chooseUntil: now() + 15000,
    startedAt: 0,
    lastActionAt: now(),
    bet: 0,
    board: [],
    deck: [],
    turn: '',
    turnIdx: 0,
    players: {
      [_meUid]: {
        name: me.name, character: me.character, faction: me.faction||'',
        syndromeOptions: meSynOpts, syndromeChosen: '',
        revealedSymptoms: [], initialRevealed: false,
        skillUsed: false, fakeSymptomNext: '', lastAutoRevealTurnIdx: -1,
      },
      [_aiUid]: {
        name: `${aiP.han} (AI)`, character: aiP.id,
        faction: ['taeyang','soyang','taeum','soeum'][Math.floor(Math.random()*4)],
        syndromeOptions: aiSynOpts, syndromeChosen: '',
        revealedSymptoms: [], initialRevealed: false,
        skillUsed: true, fakeSymptomNext: '', lastAutoRevealTurnIdx: -1,
        _isAi: true,
      },
    },
    chat: {},
  };
  // v9.7: 브릿지 셋업이 실패하면 즉시 stop() — _started 가 stuck 되지 않음
  const bridgeOk = _setupBridge();
  if(!bridgeOk){
    toast_('AI 진입 실패: FB 어댑터 활성화 실패 (새로고침 권장)','red');
    stop();
    return;
  }
  if(window.V96Activity) V96Activity.set('AI 카드 對決', `vs ${aiP.han}`);

  try{
    await startCardBattle(_roomId, true);
  }catch(e){
    console.error('AI card start failed', e);
    toast_('AI 진입 실패: '+(e&&e.message||'?'),'red');
    stop();
    return;
  }
  // v9.7: 브릿지 검증 — _patchedF.get 으로 자기 룸을 query 해서 _roomRef 가 돌아오는지 확인.
  //   돌아오지 않으면 패치가 적용되지 않은 상태 (다른 모듈이 FB 를 재할당 등) → 정리.
  try{
    if(_patchedF){
      const probe = await _patchedF.get(`card_battles/${_roomId}`);
      if(!probe || !probe.players){
        console.warn('[V96CardAI] 브릿지 검증 실패 — probe 결과 비어있음', probe);
        toast_('AI 진입 실패: 어댑터 검증 실패 — 새로고침 권장','red');
        stop();
        return;
      }
    }
  }catch(_){}

  setTimeout(() => {
    if(!_roomRef) return;
    const ai = _roomRef.players[_aiUid];
    if(!ai || ai.syndromeChosen) return;
    const ranked = ai.syndromeOptions.slice().sort((a,b) => {
      const fa = FORMULAS.find(x => x.id === SYNDROME_BY_ID[a]?.formulaId);
      const fb = FORMULAS.find(x => x.id === SYNDROME_BY_ID[b]?.formulaId);
      return ((fb && fb.composition && fb.composition.length)||0) - ((fa && fa.composition && fa.composition.length)||0);
    });
    ai.syndromeChosen = ranked[0] || ai.syndromeOptions[0];
    _aiSay('이 證으로 가겠습니다');
    _notify();
  }, 1200 + Math.random()*1000);
}

function stop(){
  if(!_started) return;
  _started = false;
  if(_aiTimer){ clearTimeout(_aiTimer); _aiTimer = null; }
  _teardownBridge();
  _roomRef = null; _roomId = null; _aiUid = null; _meUid = null;
  if(window.V96Activity) V96Activity.set('', '');
}

function _notify(){
  // v9.6: 마이크로태스크 배칭 — 부분 상태 emit 방지 + 경로별 정확한 데이터 전달
  if(!_roomRef || !_roomId) return;
  _roomRef.lastActionAt = now();
  if(_notifyPending) return;
  _notifyPending = true;
  Promise.resolve().then(() => {
    _notifyPending = false;
    if(!_roomRef || !_roomId) return;
    const rid = _roomId;
    const subs = _bridgeSubs[rid] || [];
    for(const s of subs){
      try{
        if(s.path === `card_battles/${rid}`){
          s.cb(_roomRef);
        } else {
          const rel = s.path.slice(`card_battles/${rid}/`.length);
          const segs = rel.split('/').filter(Boolean);
          let cur = _roomRef;
          for(const k of segs){ if(cur==null) break; cur = cur[k]; }
          s.cb(cur);
        }
      }catch(_){}
    }
  });
}
let _notifyPending = false;

function _setupBridge(){
  if(_origMethods) return true;
  // v9.7: FB 탐색 다중화 — window.FB → globalThis.FB → eval('FB')
  let F = (typeof window !== 'undefined' && window.FB) || null;
  if(!F && typeof globalThis !== 'undefined' && globalThis.FB) F = globalThis.FB;
  if(!F){ try{ F = eval('typeof FB !== "undefined" ? FB : null'); }catch(_){} }
  if(!F){
    console.warn('[V96CardAI] FB 노출 실패 — window.FB / globalThis.FB / lex FB 모두 부재');
    return false;  // ← 호출자가 _started 정리 가능
  }
  // app.js 의 `const FB` 와 `window.FB` 는 동일 객체. 메소드 자체를 패치하면
  // 양쪽 참조 모두 패치된 메소드를 사용. 객체 reference 교체는 const 캡쳐를
  // 우회 못함 → 핵심 픽스.
  _origMethods = {
    get: F.get, put: F.put, putRetry: F.putRetry,
    del: F.del, push: F.push, subscribe: F.subscribe,
  };
  const orig = _origMethods;
  const rid = _roomId;
  const isMine = (path) => path && (path === `card_battles/${rid}` || path.startsWith(`card_battles/${rid}/`));

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
    if(isMine(path)){
      if(path === `card_battles/${rid}`) return _roomRef;
      const rel = path.slice(`card_battles/${rid}/`.length);
      return pathGet(_roomRef, rel);
    }
    return orig.get.call(F, path, ...rest);
  };
  F.put = async function(path, val, ...rest){
    if(isMine(path)){
      if(path === `card_battles/${rid}`){ _roomRef = Object.assign(_roomRef||{}, val); }
      else {
        const rel = path.slice(`card_battles/${rid}/`.length);
        pathSet(_roomRef, rel, val);
      }
      _afterMutation(path, val);
      _notify();
      return true;
    }
    return orig.put.call(F, path, val, ...rest);
  };
  F.putRetry = async function(path, val, opts){
    if(isMine(path)){
      const ok = await F.put(path, val);
      return { ok, status: 200, retries: 0, message: '' };
    }
    return orig.putRetry.call(F, path, val, opts);
  };
  F.del = async function(path, ...rest){
    if(isMine(path)){
      if(path === `card_battles/${rid}`){ _roomRef = null; _notify(); return true; }
      const rel = path.slice(`card_battles/${rid}/`.length);
      const segs = rel.split('/').filter(Boolean);
      let cur = _roomRef;
      for(let i=0;i<segs.length-1;i++){ cur = cur && cur[segs[i]]; }
      if(cur) delete cur[segs[segs.length-1]];
      _notify();
      return true;
    }
    return orig.del.call(F, path, ...rest);
  };
  F.push = async function(path, val, ...rest){
    if(isMine(path)){
      const id = 'lc_'+Math.random().toString(36).slice(2,8);
      if(!_roomRef) return false;
      const rel = path.slice(`card_battles/${rid}/`.length);
      const segs = rel.split('/').filter(Boolean);
      let cur = _roomRef;
      for(const k of segs){
        if(typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
        cur = cur[k];
      }
      cur[id] = val;
      _notify();
      return id;
    }
    return orig.push.call(F, path, val, ...rest);
  };
  F.subscribe = function(path, cb, opts){
    if(isMine(path)){
      (_bridgeSubs[rid] = _bridgeSubs[rid] || []).push({path, cb});
      // 첫 emit — 해당 경로 데이터를 정확히 전달 (전체 룸 X)
      setTimeout(() => {
        try{
          if(path === `card_battles/${rid}`) cb(_roomRef);
          else {
            const rel = path.slice(`card_battles/${rid}/`.length);
            cb(pathGet(_roomRef, rel));
          }
        }catch(_){}
      }, 30);
      return { close: () => {
        const arr = _bridgeSubs[rid] || [];
        _bridgeSubs[rid] = arr.filter(s => s.cb !== cb);
      }};
    }
    return orig.subscribe.call(F, path, cb, opts);
  };
  _patchedF = F;  // v9.7: teardown 시 동일 reference 사용
  return true;
}

function _teardownBridge(){
  if(!_origMethods) return;
  // v9.7: setup 때 잡았던 F reference 우선 사용 (window.FB 가 그 사이 변경됐을 가능성 차단)
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
  for(const k of Object.keys(_bridgeSubs)) delete _bridgeSubs[k];
}

function _afterMutation(path, val){
  if(!_roomRef) return;
  const rid = _roomId;
  // status 'playing' 진입 시 — 덱·보드·턴 초기화
  if(path === `card_battles/${rid}/status` && val === 'playing'){
    const meSyn = _roomRef.players[_meUid].syndromeChosen;
    const aiSyn = _roomRef.players[_aiUid].syndromeChosen;
    if(meSyn && aiSyn && (!_roomRef.deck || !_roomRef.deck.length)){
      const fullDeck = _buildDeck(meSyn, aiSyn);
      _roomRef.deck = fullDeck.slice(3);
      _roomRef.board = fullDeck.slice(0, 3);
      _roomRef.turn = Math.random() < 0.5 ? _meUid : _aiUid;
      _roomRef.turnIdx = 0;
      _roomRef.startedAt = now();
    }
    _notify();
    // AI 첫 자동 공개 (1.2초)
    setTimeout(() => {
      if(!_roomRef) return;
      const ai = _roomRef.players[_aiUid];
      const aSyn = SYNDROME_BY_ID[ai.syndromeChosen];
      if(aSyn && !ai.initialRevealed && (aSyn.symptoms||[]).length){
        ai.revealedSymptoms = [aSyn.symptoms[0]];
        ai.initialRevealed = true;
        _notify();
      }
      if(_roomRef.turn === _aiUid){
        _scheduleAiTurn();
      }
    }, 1200);
    return;
  }
  if(path === `card_battles/${rid}/turn` && val === _aiUid){
    _scheduleAiTurn();
  }
}

function _scheduleAiTurn(){
  if(_aiTimer) clearTimeout(_aiTimer);
  const d = AI_TURN_DELAY[Math.floor(Math.random()*AI_TURN_DELAY.length)];
  _aiTimer = setTimeout(_doAiTurn, d);
}

function _scoreFormulasForOpp(board, oppRevealed){
  const boardSet = new Set(board);
  const out = [];
  if(typeof FORMULAS === 'undefined') return out;
  for(const f of FORMULAS){
    const haveAll = f.composition.every(h => boardSet.has(h));
    if(!haveAll) continue;
    let symScore = 0;
    const ind = (f.indication||'').toString();
    for(const s of (oppRevealed||[])){
      if(!s) continue;
      const parts = String(s).split(/[ ·,，。.]+/).filter(Boolean);
      for(const p of parts){
        if(!p || p.length < 2) continue;
        if(ind.includes(p)) symScore += 1;
      }
    }
    const score = symScore / Math.max(1, (oppRevealed||[]).length);
    out.push({ f, score });
  }
  out.sort((a,b) => b.score - a.score);
  return out;
}

async function _doAiTurn(){
  if(!_roomRef || _roomRef.status !== 'playing') return;
  if(_roomRef.turn !== _aiUid) return;
  const ai = _roomRef.players[_aiUid];
  const me = _roomRef.players[_meUid];
  const meRevealed = me.revealedSymptoms || [];

  if((!_roomRef.deck || _roomRef.deck.length === 0) && ai.lastAutoRevealTurnIdx !== _roomRef.turnIdx){
    const aSyn = SYNDROME_BY_ID[ai.syndromeChosen];
    const remain = (aSyn.symptoms||[]).filter(s => !(ai.revealedSymptoms||[]).includes(s));
    if(remain.length){
      ai.revealedSymptoms = [...(ai.revealedSymptoms||[]), remain[0]];
    }
    ai.lastAutoRevealTurnIdx = _roomRef.turnIdx;
    _notify();
    await sleep(700);
  }

  const ranked = _scoreFormulasForOpp(_roomRef.board||[], meRevealed);
  const top = ranked[0];
  const decoct = top && (top.score >= DECOCT_CONFIDENCE);
  if(decoct){
    const meFid = SYNDROME_BY_ID[me.syndromeChosen]?.formulaId;
    const correct = top.f.id === meFid;
    _aiSay('전탕 시도 — '+top.f.han);
    await sleep(900);
    if(correct){
      _roomRef.status = 'done';
      _roomRef.result = { winnerId: _aiUid, by:'attack', formulaId: top.f.id, finishedAt: now() };
      _notify();
      return;
    } else {
      const aSyn = SYNDROME_BY_ID[ai.syndromeChosen];
      const remain = (aSyn.symptoms||[]).filter(s => !(ai.revealedSymptoms||[]).includes(s));
      if(remain.length){
        ai.revealedSymptoms = [...(ai.revealedSymptoms||[]), remain[0]];
      }
      _endAiTurn();
      return;
    }
  }
  _aiSay(['음…', '한 장 더 보겠습니다', '천천히 …', '碁(생각 中)'][Math.floor(Math.random()*4)]);
  await sleep(700);
  _endAiTurn();
}

function _endAiTurn(){
  if(!_roomRef) return;
  if(_roomRef.deck && _roomRef.deck.length){
    const c = _roomRef.deck.shift();
    _roomRef.board.push(c);
  }
  _roomRef.turn = _meUid;
  _roomRef.turnIdx = (_roomRef.turnIdx||0) + 1;
  _roomRef.lastActionAt = now();
  if(_roomRef.turnIdx >= 50){
    _roomRef.status = 'done';
    _roomRef.result = { winnerId: '', by:'turn_limit', finishedAt: now() };
  }
  _notify();
}

function _aiSay(msg){
  try{
    if(window._v96CurrentChatCtx && window._v96CurrentChatCtx.isLocal){
      V96Chat.aiPush(window._v96CurrentChatCtx, 'AI', msg);
    }
  }catch(_){}
}

window.V96CardAI = { start, stop };

})();
