/* bangje-v98-leeline.js — v9.8
 * ============================================================================
 * 이순재 어록 broadcast
 *
 *   사용자가 솔로 학습에서 정답을 맞히면 Firebase `/leeline/{userId}` 에
 *   {name, qi, ts, line, formula?} 를 1회 publish. 다른 사용자는
 *   `/leeline` 을 구독해 새 entry 가 들어오면 ambient 토스트를 띄움.
 *
 *   소음 제한:
 *     • 자신은 60초당 최대 1회 publish
 *     • 수신은 본인 entry skip, 화면당 최대 1개 동시 표시,
 *       표시는 4초 후 자동 제거.
 *     • 표시 빈도: 받은 broadcast 의 25% (소음 줄임)
 *     • S.leelineBroadcast = false 면 본인 publish + 수신 모두 OFF
 *
 *   • V98Leeline.fire(formula?)        — 자기 정답 시 호출 (app.js 패치 또는
 *                                        V97Sig fireEffect 안에서 호출)
 *   • V98Leeline.toggle()
 *
 *   * 이순재 어록은 LEESOONJAE_QUOTES (data-signatures.js) 풀에서 가져옴.
 *     다른 캐릭터는 일반 한문 quote 1줄.
 * ============================================================================ */
(function(){
'use strict';

const PUB_THROTTLE_MS = 60000;
const DISPLAY_PROBABILITY = 0.25;
const DISPLAY_DURATION = 4000;
const SUB_PATH = 'leeline';

let _lastPub = 0;
let _sub = null;
let _seenIds = {};
let _activeToast = null;

function S(){ return window.S || null; }
function _enabled(){ const s = S(); return !s || s.leelineBroadcast !== false; }
function _toast(m, k){ try{ window.toast && window.toast(m, k); }catch(_){} }

function _pickLine(charId){
  if(charId === 'leesoonjae'){
    const pool = window.LEESOONJAE_QUOTES || [];
    if(pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  const sigs = window.CHAR_SIGNATURES || {};
  const sig = sigs[charId];
  if(sig && sig.line) return sig.line;
  if(sig && sig.quote && sig.quote.ko) return sig.quote.ko;
  return '';
}

async function fire(formulaName){
  if(!_enabled()) return;
  if(!window.FB) return;
  const s = S(); if(!s || !s.userId) return;
  const now = Date.now();
  if(now - _lastPub < PUB_THROTTLE_MS) return;
  _lastPub = now;
  const line = _pickLine(s.character);
  if(!line) return;
  const payload = {
    name: s.name || '익명',
    char: s.character || null,
    qi: s.qi || 0,
    ts: now,
    line,
    formula: formulaName || '',
  };
  try{
    await window.FB.put(`${SUB_PATH}/${s.userId}`, payload);
  }catch(_){}
}

// ─── 수신 ────────────────────────────────────────────────────────────────
function _onSnap(snap){
  if(!_enabled()) return;
  const s = S(); if(!s) return;
  if(!snap || typeof snap !== 'object') return;
  const myUid = s.userId;
  const now = Date.now();
  for(const uid of Object.keys(snap)){
    if(uid === myUid) continue;
    const e = snap[uid];
    if(!e || !e.ts || !e.line) continue;
    const key = uid + ':' + e.ts;
    if(_seenIds[key]) continue;
    if(now - e.ts > 90000) { _seenIds[key] = 1; continue; }   // 오래된 건 skip
    _seenIds[key] = 1;
    // 확률 표시
    if(Math.random() > DISPLAY_PROBABILITY) continue;
    if(_activeToast) continue;    // 동시 표시 1개
    _showToast(e);
  }
}

function _showToast(e){
  const charIcon = (() => {
    const m = (window.CHARACTER_IMAGES || {})[e.char || ''];
    return m && m.url ? m.url : '';
  })();
  const isLee = (e.char === 'leesoonjae');
  const card = document.createElement('div');
  card.style.cssText = `
    position:fixed; left:50%; bottom:120px; transform:translate(-50%, 30px);
    z-index:9050; max-width:88vw; width:auto;
    background:linear-gradient(135deg, #1C140A 0%, #2A1E10 100%);
    color:#FCF4E5; padding:9px 14px 9px 9px; border-radius:24px 8px 8px 24px;
    border:1px solid ${isLee ? '#C04848' : '#876A36'};
    box-shadow:0 6px 22px rgba(0,0,0,.5), 0 0 18px ${isLee?'#C0484866':'#876A3666'};
    display:flex; align-items:center; gap:8px;
    font-family:'Noto Serif KR',serif;
    opacity:0; transition:opacity .3s ease, transform .35s cubic-bezier(.2,.9,.3,1.2);
  `;
  card.innerHTML = `
    ${charIcon ? `<div style="width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid ${isLee?'#C04848':'#876A36'}">
      <img src="${charIcon}" style="width:100%;height:100%;object-fit:cover" alt="">
    </div>` : `<div style="width:32px;height:32px;border-radius:50%;background:#876A3666;color:#FFE08A;display:flex;align-items:center;justify-content:center;font-family:'ZCOOL XiaoWei',serif;font-size:14px">?</div>`}
    <div style="flex:1;min-width:0">
      <div style="font-size:10.5px;color:#876A36;letter-spacing:.06em">
        ${esc(e.name || '익명')} <span style="color:#C04848">${isLee?'★':''}</span>${e.formula ? ' · <span class="han" style="color:#C9A227">'+esc(e.formula)+'</span>' : ''}
      </div>
      <div style="font-size:12.5px;color:${isLee?'#FFE08A':'#E8D4B8'};margin-top:1px;line-height:1.35">${esc(e.line||'')}</div>
    </div>
  `;
  document.body.appendChild(card);
  _activeToast = card;
  requestAnimationFrame(() => { card.style.opacity = '1'; card.style.transform = 'translate(-50%, 0)'; });
  setTimeout(() => { card.style.opacity = '0'; card.style.transform = 'translate(-50%, 30px)'; }, DISPLAY_DURATION);
  setTimeout(() => { try{ card.remove(); }catch(_){} _activeToast = null; }, DISPLAY_DURATION + 400);
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ─── 구독 라이프사이클 ──────────────────────────────────────────────────
function _attachSub(){
  if(_sub) return;
  if(!window.FB || !window.FB.subscribe) return;
  if(!_enabled()) return;
  _sub = window.FB.subscribe(SUB_PATH, _onSnap, { pollMs: 6000 });
}
function _detachSub(){
  if(_sub){ try{ _sub.close(); }catch(_){} _sub = null; }
}

function toggle(){
  const s = S(); if(!s) return;
  s.leelineBroadcast = !_enabled();
  try{ window.saveState && window.saveState(); }catch(_){}
  if(s.leelineBroadcast){ _attachSub(); _toast('이순재 broadcast ON', 'gold'); }
  else { _detachSub(); _toast('이순재 broadcast OFF'); }
}

// 자동 시작 (FB 가 준비되면)
function _boot(){
  if(!window.FB){ setTimeout(_boot, 800); return; }
  _attachSub();
}
if(document.readyState !== 'loading') setTimeout(_boot, 1000);
else document.addEventListener('DOMContentLoaded', () => setTimeout(_boot, 1000));

window.V98Leeline = { fire, toggle, _attachSub, _detachSub };
})();
