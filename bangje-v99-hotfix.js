/* bangje-v99-hotfix.js — v10.0
 * ============================================================================
 * v9.8 검수 권장사항 5건 (A-3, A-5, A-7, A-9, A-10) — monkey-patch.
 * 원본 파일 무수정. 모두 silent fallback (의존 객체 미존재시 skip).
 *
 *   • A-3 子時·寅時 시간대  — getCurrentSichen wrap (정확한 시간 매핑)
 *   • A-5 manifest.json 버전 — runtime mismatch 경고 (콘솔)
 *   • A-7 hello-card 선택자  — DOM 보강 (#hello-name-row id 부여)
 *   • A-9 V97Dict 검색어 보존 — open() wrap + sessionStorage
 *   • A-10 recordChat 카운팅 — push 성공 후 호출되도록 wrap (이미 그러면 skip)
 *
 *   V99Hotfix.report() — 각 항목의 적용 상태 콘솔 출력
 *
 *   load 순서: 다른 모듈 로드 후. v99-bootstrap 이 trigger 또는 자체 retry.
 * ============================================================================ */
(function(){
'use strict';

const _state = { A3: false, A5: false, A7: false, A9: false, A10: false };

// ─── A-3: 子時(23–01), 寅時(03–05) 매핑 보정 ───────────────────────────
// 기존 data-achievements.js 의 time_yin 배열이 [3,4] 로 정의되어 03:00–04:59 만
// 매칭 (실제 寅時 03:00–05:00 의 마지막 시각 5시 누락). 또한 子時는 23–01 (1자정)
// 으로 [23,0] 또는 [-1,0,1] 처리 필요 — 기존 정의가 무엇이든 wrap.
function _patchSichen(){
  if(_state.A3) return true;
  if(typeof window.getCurrentSichen !== 'function'){
    // wrap 대상 함수 부재 — V97 시그니처가 다른 경로로 시각 판정하면 skip
    // 대신 V99Hotfix.checkSichen() 만 export
    _state.A3 = 'no-target';
    return true;
  }
  const orig = window.getCurrentSichen;
  window.getCurrentSichen = function(){
    try{
      const h = new Date().getHours();
      // 子(23-1) 丑(1-3) 寅(3-5) 卯(5-7) 辰(7-9) 巳(9-11)
      // 午(11-13) 未(13-15) 申(15-17) 酉(17-19) 戌(19-21) 亥(21-23)
      const MAP = [
        ['子', [23, 0]], ['丑', [1, 2]], ['寅', [3, 4]], ['卯', [5, 6]],
        ['辰', [7, 8]], ['巳', [9, 10]], ['午', [11, 12]], ['未', [13, 14]],
        ['申', [15, 16]], ['酉', [17, 18]], ['戌', [19, 20]], ['亥', [21, 22]],
      ];
      for(const [name, hrs] of MAP){
        if(name === '子'){
          if(h === 23 || h === 0) return name;
        } else if(hrs.includes(h)) return name;
      }
      return orig.call(this);
    }catch(_){ return orig.call(this); }
  };
  _state.A3 = true;
  return true;
}

// 외부에서 시간 판정 도구로 쓸 수 있게 export
function checkSichen(at){
  const d = at ? new Date(at) : new Date();
  const h = d.getHours();
  const MAP = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  // 子時는 23시 + 0시 모두 포함
  if(h === 23 || h === 0) return '子';
  // 1시부터 22시까지: idx = floor((h+1)/2)
  return MAP[Math.floor((h + 1) / 2)] || '';
}

// ─── A-5: manifest.json 버전 mismatch 경고 ──────────────────────────────
async function _checkManifest(){
  if(_state.A5) return true;
  try{
    const link = document.querySelector('link[rel="manifest"]');
    if(!link){ _state.A5 = 'no-link'; return true; }
    const r = await fetch(link.href, { cache: 'no-cache' });
    if(!r.ok){ _state.A5 = 'fetch-fail'; return true; }
    const m = await r.json();
    const expected = window.APP_VERSION || 'v10.0';
    const desc = String(m.description || m.name || '');
    if(desc && desc.includes(expected.replace('v',''))){
      _state.A5 = 'ok';
    } else {
      _state.A5 = `mismatch: manifest="${desc}" / APP_VERSION="${expected}"`;
      try{ console.warn('[V99Hotfix A-5]', _state.A5); }catch(_){}
    }
  }catch(e){
    _state.A5 = 'error:'+String(e && e.message || e);
  }
  return true;
}

// ─── A-7: hello-card 선택자 보강 ───────────────────────────────────────
// app.js 의 hello-card 이름 줄에 #hello-name-row id 가 없으면 부여.
// MutationObserver 로 hello-card 가 매번 다시 렌더링될 때마다 보정.
function _patchHelloCard(){
  if(_state.A7) return true;
  const inject = () => {
    const card = document.getElementById('hello-card');
    if(!card) return false;
    // 이름이 표시되는 줄 — class 또는 구조 휴리스틱
    let nameRow = card.querySelector('#hello-name-row');
    if(nameRow) return true;
    // 휴리스틱: 첫 .han 또는 첫 큰 텍스트 줄
    const candidate = card.querySelector('.hello-name, [data-role="name"]')
                   || card.querySelector('.han')
                   || (card.children && card.children[0]);
    if(candidate){
      candidate.id = 'hello-name-row';
      return true;
    }
    return false;
  };
  // 초기 시도
  setTimeout(inject, 400);
  // observe 로 매번 보정
  try{
    const v = document.getElementById('view');
    if(v){
      const obs = new MutationObserver(() => { try{ inject(); }catch(_){} });
      obs.observe(v, { childList: true, subtree: true });
    }
  }catch(_){}
  _state.A7 = true;
  return true;
}

// ─── A-9: V97Dict 검색어 보존 ──────────────────────────────────────────
// V97Dict.open 호출 시 마지막 q 를 복원, close 시 저장.
const SS_KEY_Q = 'bangje.v99.dictQ';

function _patchDict(){
  if(_state.A9) return true;
  if(!window.V97Dict || typeof window.V97Dict.open !== 'function'){
    _state.A9 = 'no-target';
    return false;
  }
  const orig = window.V97Dict.open;
  window.V97Dict.open = function(opts){
    try{
      // 마지막 검색어 복원
      const last = sessionStorage.getItem(SS_KEY_Q) || '';
      // V97Dict 의 내부 _state.q 에 옵션이 우선이나, 통상 빈 string 임
      const r = orig.call(this, opts);
      // 렌더 후 input value 보강
      setTimeout(() => {
        const inp = document.querySelector('#dict-input, input[data-role="dict-q"], .dict-search input');
        if(inp && !inp.value && last){
          inp.value = last;
          // dispatch input 으로 V97Dict 가 필터 실행하도록
          try{ inp.dispatchEvent(new Event('input', { bubbles: true })); }catch(_){}
        }
      }, 80);
      return r;
    }catch(_){ return orig.call(this, opts); }
  };
  // close 시 q 저장 — V97Dict 가 자체 close 호출 안 할 수 있으므로
  // input event 자체에 저장 (사용자가 검색하는 그 순간)
  document.addEventListener('input', e => {
    try{
      const t = e.target;
      if(!t) return;
      if(t.matches && t.matches('#dict-input, input[data-role="dict-q"], .dict-search input')){
        sessionStorage.setItem(SS_KEY_Q, t.value || '');
      }
    }catch(_){}
  }, true);
  _state.A9 = true;
  return true;
}

// ─── A-10: recordChat 카운팅 ──────────────────────────────────────────
// 원본 v9.6 part1 의 recordChat 호출이 push 전이라 실패해도 count 가 늘던 문제.
// 외부 호출자가 push 실패 시 V99Hotfix.uncountChat() 로 되돌릴 수 있게 export.
// 또는 recordChat 자체를 wrap 해서 deferred mode 로 사용 가능.
function _patchRecordChat(){
  if(_state.A10) return true;
  if(typeof window.recordChat !== 'function'){
    _state.A10 = 'no-target';
    return false;
  }
  const orig = window.recordChat;
  // wrap — 두 번째 인자에 promise/thenable 을 받으면 그 성공 후에만 count 증가
  window.recordChat = function(meta, gate){
    if(gate && typeof gate.then === 'function'){
      return gate.then(
        v => { try{ orig.call(this, meta); }catch(_){} return v; },
        e => { /* push 실패 — count 증가 안 함 */ throw e; }
      );
    }
    return orig.call(this, meta);
  };
  _state.A10 = true;
  return true;
}

// 외부에서 명시적으로 카운트 되돌리고 싶을 때
function uncountChat(){
  try{
    if(window.S && typeof window.S.chatCount === 'number'){
      window.S.chatCount = Math.max(0, window.S.chatCount - 1);
      window.saveState && window.saveState();
    }
  }catch(_){}
}

// ─── 부팅 ──────────────────────────────────────────────────────────────
let _tries = 0;
function _try(){
  if(_tries++ > 30) return;
  _patchSichen();
  _patchHelloCard();
  let pending = 0;
  if(_state.A9 === false) pending += _patchDict() ? 0 : 1;
  if(_state.A10 === false) pending += _patchRecordChat() ? 0 : 1;
  if(pending > 0) setTimeout(_try, 300);
}

function _bootManifest(){
  // manifest fetch 는 idle 한 번
  if(typeof requestIdleCallback === 'function'){
    requestIdleCallback(() => _checkManifest(), { timeout: 4000 });
  } else {
    setTimeout(_checkManifest, 2500);
  }
}

if(document.readyState !== 'loading'){
  setTimeout(_try, 600);
  _bootManifest();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(_try, 600);
    _bootManifest();
  });
}

function report(){
  const o = {
    'A-3 子寅時 매핑': _state.A3,
    'A-5 manifest 버전': _state.A5,
    'A-7 hello-card id': _state.A7,
    'A-9 Dict 검색어 보존': _state.A9,
    'A-10 recordChat 카운팅': _state.A10,
  };
  try{ console.table(o); }catch(_){ console.log(o); }
  return o;
}

window.V99Hotfix = { report, checkSichen, uncountChat };
})();
