/* bangje-v98-cube-rules.js — v9.8
 * ============================================================================
 * 방미큐브 첫 출패(initial meld) 룰
 *
 *   기존: 사전 정의 set 이면 사이즈 무관 commit 가능 (사역탕 3미, 당귀보혈탕 2미도)
 *   v9.8: 첫 commit 시 명시적 진입 장벽 도입.
 *
 *   첫 출패에 만든 새 set 중 적어도 하나가 다음 중 하나를 만족해야 함:
 *     (a) 약재 수 ≥ INITIAL_MIN_HERBS (=4)
 *     (b) 그 set 이 처방 사전 정의 그대로 (사역탕 3미 그대로, 당귀보혈탕 2미 그대로)
 *         즉, 사전의 base/derive/symptom 사이즈와 동일.
 *
 *   첫 통과 후 (player.opened = true) 부터는 사이즈 무관 (3미 set 도 가능).
 *
 *   ── 통합 ──
 *   bangje-cube.js 의 actCommit 시작부에 다음 한 줄을 추가 (patched 파일 동봉):
 *
 *     if(window.V98CubeRules){
 *       const ck = window.V98CubeRules.validateLocal(LOCAL);
 *       if(!ck.ok){ msg(ck.msg,'warn'); return; }
 *     }
 *
 *   opened 상태는 roomId 별로 localStorage 에 기록. 페이지 reload 후에도 보존.
 *
 *   • V98CubeRules.validateLocal(LOCAL)    — actCommit 직전 호출
 *   • V98CubeRules.isOpened(rid, uid)      — 첫 통과 여부
 *   • V98CubeRules.markOpened(rid)         — 통과 표시 (validateLocal 내부에서 호출)
 *   • V98CubeRules.resetForRoom(rid)       — 룸 종료 시 정리
 * ============================================================================ */
(function(){
'use strict';

const INITIAL_MIN_HERBS = 4;
const STORAGE_KEY = 'bangje.v98.cubeOpened';

function _sortJoin(a){
  return (a||[]).slice().sort((x,y) => x<y?-1:x>y?1:0).join('|');
}
function _eq(a, b){
  return a.length === b.length && _sortJoin(a) === _sortJoin(b);
}

// ─── opened 상태 영속화 ───────────────────────────────────────────────
function _load(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch(_){ return {}; }
}
function _save(m){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); }catch(_){}
}
function isOpened(rid, uid){
  if(!rid || !uid) return false;
  const m = _load();
  return !!(m[rid] && m[rid][uid]);
}
function markOpened(rid, uid){
  if(!rid || !uid) return;
  const m = _load();
  m[rid] = m[rid] || {};
  m[rid][uid] = Date.now();
  _save(m);
}
function resetForRoom(rid){
  const m = _load(); delete m[rid]; _save(m);
}
// 오래된(7일 이상) entry 청소
function _gc(){
  const m = _load();
  const cutoff = Date.now() - 7 * 86400 * 1000;
  let dirty = false;
  for(const rid of Object.keys(m)){
    for(const uid of Object.keys(m[rid] || {})){
      if((m[rid][uid] || 0) < cutoff){ delete m[rid][uid]; dirty = true; }
    }
    if(!Object.keys(m[rid] || {}).length){ delete m[rid]; dirty = true; }
  }
  if(dirty) _save(m);
}

// ─── 처방 사전 사이즈 lookup ───────────────────────────────────────────
function _baseSizes(){
  // BC.matchSet 으로 set 객체의 herbs.length 를 그대로 사용 가능.
  // 다만 같은 sig 에 여러 set 후보가 있을 수 있으므로 그중 base 사이즈를 우선.
  return null;
}

function _isExactBaseSize(setHerbs){
  // BC.matchSet 으로 사전 매칭 — 매칭된 set 중 sig 가 동일하면 사이즈도 동일
  // (sig 가 같으면 herbs 가 같은 multiset)
  if(typeof window.BC !== 'object' || typeof window.BC.matchSet !== 'function') return false;
  const ms = window.BC.matchSet(setHerbs);
  if(!ms || !ms.length) return false;
  // matchSet 반환의 set 들은 정의상 setHerbs 와 동일한 multiset → 사이즈도 동일.
  // 즉 사전에 매칭됐다는 것 자체가 "사전 사이즈 그대로" 와 동치.
  return true;
}

// ─── 메인 검증 ────────────────────────────────────────────────────────
// LOCAL = { roomId, hand, origHand, board, origBoard, isMyTurn, ... }
function validateLocal(LOCAL){
  if(!LOCAL) return { ok:true };
  const s = window.S;
  const uid = s && s.userId;
  if(!uid) return { ok:true };

  const rid = LOCAL.roomId || LOCAL.rid || (window.BC && window.BC.currentRoom && (window.BC.currentRoom()||{}).roomId) || '';
  if(!rid) return { ok:true };

  // 이미 opened 상태면 통과 — 기존 룰만 적용 (sub 검증은 bangje-cube.js 가 isValidSet 로)
  if(isOpened(rid, uid)) return { ok:true };

  // 새로 만든 set들 추출 — origBoard 에 없던 (id 가 다른) 또는 herbs 가 달라진 set
  const origSets = LOCAL.origBoard || [];
  const newSets = LOCAL.board || [];
  const newOrModified = [];
  const origById = {};
  origSets.forEach(s0 => { if(s0.id) origById[s0.id] = s0; });
  for(const ns of newSets){
    const old = ns.id && origById[ns.id];
    if(!old){
      newOrModified.push({ kind:'new', herbs: ns.herbs||[] });
    } else if(!_eq(old.herbs||[], ns.herbs||[])){
      // 가감방 변형은 그 자체로 사전 사이즈 그대로일 수 있으므로 통과 후보
      newOrModified.push({ kind:'modified', herbs: ns.herbs||[] });
    }
  }
  if(!newOrModified.length){
    // 손패만 줄였거나(불가) 아무 변화 없음. cube.js 가 별도 에러를 띄움.
    return { ok:true };
  }

  // 첫 출패 룰 — 적어도 하나의 새/변형 set 이 다음을 만족해야 함:
  //   (a) herbs.length ≥ 4
  //   (b) 정확히 사전 매칭된 set (사역탕 3미·당귀보혈탕 2미 등 그대로)
  // 두 조건은 사실상 동등할 수 있으나 명시.
  for(const e of newOrModified){
    if((e.herbs||[]).length >= INITIAL_MIN_HERBS){
      markOpened(rid, uid);
      return { ok:true, message:'初手 통과 (4미 이상)' };
    }
    if(_isExactBaseSize(e.herbs)){
      markOpened(rid, uid);
      return { ok:true, message:'初手 통과 (處方 그대로)' };
    }
  }

  // 진입 장벽 메시지 — 사용자가 의도를 알 수 있게 구체적으로
  const sizes = newOrModified.map(e => (e.herbs||[]).length).join('·');
  return {
    ok: false,
    msg: `初手 룰: 첫 出牌는 4미 이상 또는 사전 처방(사역탕·당귀보혈탕 등)이어야 합니다. 현재 ${sizes}미`,
  };
}

_gc();

window.V98CubeRules = {
  validateLocal, isOpened, markOpened, resetForRoom,
  _INITIAL_MIN_HERBS: INITIAL_MIN_HERBS,
};
})();
