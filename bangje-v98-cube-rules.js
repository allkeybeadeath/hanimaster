/* bangje-v98-cube-rules.js — v10.0.4
 * ============================================================================
 * 방미큐브 첫 出牌(initial meld) 룰
 *
 *   ─ 룰 변경 이력 ─
 *   v9.8 : 첫 出牌가 (a) 4미 이상 또는 (b) 사전 정의 set 그대로 (base/derive/symptom
 *          무관) 면 통과. ← 派生方·加減方 단독으로도 첫 出牌 가능했음.
 *   v10.0.4: 첫 出牌는 **완성된 처방(base) 만** 허용.
 *            派生方·加減方 단독 또는 그 모음으로는 첫 出牌 불가.
 *            한 번 통과 후(opened) 부터는 派生·加減도 자유롭게 사용 가능.
 *
 *   조건(strict): 첫 commit 시 새로 만들거나 변형된 set 중 적어도 하나가
 *     BC.matchSet(herbs) 의 반환에 type === 'base' 가 포함되어야 함.
 *     즉 사전에 정의된 完成 處方 자체여야 함 (사역탕 3미, 당귀보혈탕 2미 등).
 *     크기는 무관. 派生方(type='derive') 이나 加減方(type='symptom') 만으로는 X.
 *
 *   첫 통과 후 (player.opened = true) 부터는 사이즈·종류 무관.
 *
 *   ── 통합 ── (bangje-cube.js actCommit 직전에 호출, 기존과 동일)
 *     if(window.V98CubeRules){
 *       const ck = window.V98CubeRules.validateLocal(LOCAL);
 *       if(!ck.ok){ msg(ck.msg,'warn'); return; }
 *     }
 *
 *   opened 상태는 roomId × uid 별 localStorage 영속 (페이지 reload 후에도 유지).
 *
 *   API:
 *     V98CubeRules.validateLocal(LOCAL)    — actCommit 직전 호출
 *     V98CubeRules.isOpened(rid, uid)      — 첫 통과 여부
 *     V98CubeRules.markOpened(rid, uid)    — 통과 표시 (내부 사용)
 *     V98CubeRules.resetForRoom(rid)       — 룸 종료 시 정리
 * ============================================================================ */
(function(){
'use strict';

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

// ─── 핵심: 본 set 이 完成 처방(base) 인지 ───────────────────────────────
// v10.0.4: 派生(derive)·加減(symptom) 은 false. base 타입 매칭이 1개 이상 있어야 true.
function _hasBaseMatch(setHerbs){
  if(typeof window.BC !== 'object' || typeof window.BC.matchSet !== 'function') return false;
  const ms = window.BC.matchSet(setHerbs);
  if(!Array.isArray(ms) || !ms.length) return false;
  return ms.some(s => s && s.type === 'base');
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

  // 이미 opened 상태면 통과 (기존 룰만 적용 — bangje-cube.js 의 isValidSet 가 sub 검증)
  if(isOpened(rid, uid)) return { ok:true };

  // 새로 만든/변형된 set 만 추출
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
      newOrModified.push({ kind:'modified', herbs: ns.herbs||[] });
    }
  }
  if(!newOrModified.length){
    // 손패만 줄였거나(불가) 아무 변화 없음 — cube.js 가 별도 에러 처리
    return { ok:true };
  }

  // v10.0.4 룰: 새/변형 set 중 최소 1개가 完成 處方(type==='base') 이어야 함.
  for(const e of newOrModified){
    if(_hasBaseMatch(e.herbs)){
      markOpened(rid, uid);
      return { ok:true, message:'初手 통과 (完成 處方)' };
    }
  }

  // 진입 장벽 메시지 — 派生·加減 만 시도한 경우 구체적 안내
  let hasAnyMatch = false;
  let onlyDerivedOrSymptom = false;
  if(typeof window.BC === 'object' && typeof window.BC.matchSet === 'function'){
    for(const e of newOrModified){
      const ms = window.BC.matchSet(e.herbs);
      if(Array.isArray(ms) && ms.length){
        hasAnyMatch = true;
        if(ms.every(s => s && (s.type === 'derive' || s.type === 'symptom'))) onlyDerivedOrSymptom = true;
      }
    }
  }
  const detail = onlyDerivedOrSymptom
    ? '派生方·加減方 만으로는 첫 出牌 불가 — 完成 處方(base)을 먼저 내야 합니다.'
    : (hasAnyMatch ? '完成 處方(base)이 포함되어야 합니다.' : '미완성 set 입니다.');
  return {
    ok: false,
    msg: `初手 룰: ${detail}`,
  };
}

_gc();

window.V98CubeRules = {
  validateLocal, isOpened, markOpened, resetForRoom,
  _RULE_VERSION: '10.0.4',
};
})();
