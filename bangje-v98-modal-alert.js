/* bangje-v98-modal-alert.js — v9.8
 * ============================================================================
 * 모달/긴급 알림 화살표 — 채팅에 가려지는 게임 모달 인지 보조
 *
 *   배경:
 *     카드 對決 의 reveal modal (initial / deck-empty / penalty), 전탕 시도
 *     모달, 큐브의 페널티 reveal 등은 화면 중앙이지만 우측·하단 채팅 박스가
 *     동시에 빠르게 갱신되어 사용자가 모달을 못 볼 수 있음.
 *
 *   동작:
 *     1) 게임 컨텍스트 (path 가 card_battles/* 또는 cube_rooms/*) 일 때만 활성
 *     2) MutationObserver 로 새 modal 출현 감지 (감지 셀렉터는 가변, 아래)
 *     3) 모달 출현 즉시:
 *        • 화면 외곽 4방향 화살표 펄스 (1.5초)
 *        • 채팅 박스 상단에 「↑ 새 모달 — 화면 중앙 확인」 alert pill
 *        • 작은 chime (Web Audio 단일 톤)
 *     4) 사용자가 모달과 인터랙션 (클릭) 시 즉시 정리
 *     5) 5초 후 자동 정리 (모달 자체는 별도)
 *
 *   감지 대상 (selector — superset, 무관한 일반 모달도 잡아도 OK):
 *     • #modal-slot > * (app.js 의 openModal)
 *     • [class*="reveal-modal"], [class*="decoct-modal"]
 *     • [class*="penalty"]
 *     • [id*="card-modal"], [id*="bc-modal"]
 *
 *   사용자 토글: S.modalAlertEnabled (default true)
 * ============================================================================ */
(function(){
'use strict';

let _enabled = true;
let _activeAlert = null;
let _hideTimer = null;
let _seenModals = new WeakSet();

function S(){ return window.S || null; }
function _isGameContext(){
  // 카드 對決 / 큐브 / 멀티 對決 진행 중인지 — 화면에 게임 보드 element 있으면 true
  const ind = document.querySelector('.cb-board, #bc-board, .bc-card, .cb-herb-card, #card-board, .card-battle, .bc-set');
  return !!ind;
}
function _isModal(el){
  if(!el || el.nodeType !== 1) return false;
  // 우리가 만든 알림 element 자기 자신은 제외
  if(el.id === 'v98-modal-alert' || el.classList.contains('v98-modal-alert')) return false;
  // app.js openModal — #modal-slot 의 직계 자식
  if(el.parentNode && el.parentNode.id === 'modal-slot') return true;
  // 클래스/id 기반 (적용 범위 넓게)
  const cls = (el.className || '') + ' ' + (el.id || '');
  if(typeof cls.indexOf !== 'function') return false;
  if(/reveal-modal|decoct|penalty-reveal|symptom-reveal|attack-modal|card-modal/i.test(cls)) return true;
  // 자식이 #modal-slot 안에 들어간 경우 (.modal-card 등)
  if(el.closest && el.closest('#modal-slot')) return true;
  return false;
}

// ─── 시각 효과 ────────────────────────────────────────────────────────
function _injectCSS(){
  if(document.getElementById('v98-modal-alert-css')) return;
  const st = document.createElement('style');
  st.id = 'v98-modal-alert-css';
  st.textContent = `
    @keyframes v98ArrowPulse {
      0%, 100% { opacity: 0; transform: scale(0.85); }
      20%, 60% { opacity: 1; transform: scale(1); }
    }
    .v98-modal-alert-arrow {
      position: fixed; z-index: 9700; pointer-events: none;
      color: #FFE08A; font-size: 38px; font-weight: 900;
      font-family: 'ZCOOL XiaoWei', 'Ma Shan Zheng', serif;
      text-shadow: 0 0 14px #9C3030, 0 0 28px #9C303088, 0 2px 8px rgba(0,0,0,.6);
      animation: v98ArrowPulse 1.4s ease-in-out 2;
    }
    .v98-modal-alert-pill {
      position: fixed; z-index: 9700; pointer-events: auto;
      background: linear-gradient(135deg, #9C3030 0%, #6E1818 100%);
      color: #FFE08A;
      border: 1.5px solid #FFE08A88;
      box-shadow: 0 6px 20px rgba(0,0,0,.5), 0 0 18px #9C303088;
      padding: 8px 14px 8px 12px;
      border-radius: 22px;
      font-family: 'Noto Serif KR', serif;
      font-size: 12.5px;
      cursor: pointer;
      display: flex; align-items: center; gap: 7px;
      animation: v98AlertPulse 1.4s ease-in-out infinite;
    }
    @keyframes v98AlertPulse {
      0%, 100% { transform: scale(1); box-shadow: 0 6px 20px rgba(0,0,0,.5), 0 0 18px #9C303066; }
      50%     { transform: scale(1.04); box-shadow: 0 8px 26px rgba(0,0,0,.6), 0 0 28px #9C3030AA; }
    }
    .v98-modal-alert-arrow.top    { top: 14vh;    left: 50%; transform: translateX(-50%); }
    .v98-modal-alert-arrow.bottom { bottom: 14vh; left: 50%; transform: translateX(-50%); }
    .v98-modal-alert-arrow.left   { left: 8vw;    top: 50%; transform: translateY(-50%); }
    .v98-modal-alert-arrow.right  { right: 8vw;   top: 50%; transform: translateY(-50%); }
  `;
  document.head.appendChild(st);
}

function _chime(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.25);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.45);
  }catch(_){}
}

function _showArrows(rect){
  // 모달의 위치 추정 — 화면 중앙이면 4방향 모두, 그 외면 모달 위치 기준
  const cx = rect ? (rect.left + rect.width/2) : (window.innerWidth/2);
  const cy = rect ? (rect.top + rect.height/2) : (window.innerHeight/2);
  const isTop = cy < window.innerHeight * 0.4;
  const isBottom = cy > window.innerHeight * 0.6;
  const dirs = [];
  // 채팅이 보통 우측 또는 하단에 → 그 반대 방향에서 화살표를 모달 쪽으로 가리킴
  if(!isTop) dirs.push({ d:'top',    char:'↓' });
  if(!isBottom) dirs.push({ d:'bottom', char:'↑' });
  dirs.push({ d:'left',  char:'→' });
  dirs.push({ d:'right', char:'←' });
  dirs.forEach(({d, char}) => {
    const a = document.createElement('div');
    a.className = 'v98-modal-alert-arrow ' + d;
    a.textContent = char;
    document.body.appendChild(a);
    setTimeout(() => { try{ a.remove(); }catch(_){} }, 2900);
  });
}

function _showPill(modalEl){
  if(_activeAlert) try{ _activeAlert.remove(); }catch(_){}
  const pill = document.createElement('div');
  pill.id = 'v98-modal-alert';
  pill.className = 'v98-modal-alert-pill';
  pill.innerHTML = `<span class="han" style="font-size:16px;font-family:'ZCOOL XiaoWei',serif">急</span> <span>새 모달 — 화면 중앙 확인</span> <span style="font-size:14px;margin-left:2px">→</span>`;
  // 위치: 채팅이 우하단이면 좌하단에 표시, 채팅이 우측 사이드면 상단 중앙
  // 보수적으로 화면 상단 중앙 — 모바일에서 가장 잘 보이는 위치
  pill.style.top = '14px';
  pill.style.left = '50%';
  pill.style.transform = 'translateX(-50%)';
  document.body.appendChild(pill);
  _activeAlert = pill;
  pill.addEventListener('click', () => {
    // 모달 element 로 스크롤 + 강조
    if(modalEl && modalEl.scrollIntoView){
      try{ modalEl.scrollIntoView({ behavior:'smooth', block:'center' }); }catch(_){}
      modalEl.animate &&
        modalEl.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }],
          { duration: 500 },
        );
    }
    _dismiss();
  });
  // 자동 정리
  clearTimeout(_hideTimer);
  _hideTimer = setTimeout(_dismiss, 6000);
}

function _dismiss(){
  if(_activeAlert){
    try{ _activeAlert.remove(); }catch(_){}
    _activeAlert = null;
  }
  clearTimeout(_hideTimer);
}

// 모달 element 클릭 시 즉시 정리
function _attachDismissOnInteract(modalEl){
  if(!modalEl) return;
  const cleanup = (e) => {
    if(modalEl.contains(e.target)){
      _dismiss();
      document.removeEventListener('pointerdown', cleanup, true);
    }
  };
  document.addEventListener('pointerdown', cleanup, true);
  // 모달이 사라지면 alert 도 자동 사라짐
  const obs = new MutationObserver(() => {
    if(!document.body.contains(modalEl)){
      _dismiss();
      obs.disconnect();
    }
  });
  if(modalEl.parentNode) obs.observe(modalEl.parentNode, { childList:true });
}

// ─── MutationObserver ─────────────────────────────────────────────────
function _onMutation(records){
  if(!_enabled) return;
  if(!_isGameContext()) return;
  const s = S();
  if(s && s.modalAlertEnabled === false) return;
  for(const r of records){
    for(const node of r.addedNodes){
      if(node.nodeType !== 1) continue;
      // 새로 들어온 element가 modal 본체이거나 modal 을 자식으로 가질 수 있음
      const targets = [node].concat(Array.from(node.querySelectorAll ? node.querySelectorAll('*') : []));
      for(const el of targets){
        if(_isModal(el) && !_seenModals.has(el)){
          _seenModals.add(el);
          const rect = el.getBoundingClientRect();
          // 너무 작은 element 는 skip (가짜 매치)
          if(rect.width < 80 || rect.height < 40) continue;
          _showArrows(rect);
          _showPill(el);
          _chime();
          _attachDismissOnInteract(el);
          return;   // 한 번 알림 후 break
        }
      }
    }
  }
}

function _attach(){
  _injectCSS();
  const obs = new MutationObserver(_onMutation);
  obs.observe(document.body, { childList:true, subtree:true });
}

// ─── API ──────────────────────────────────────────────────────────────
function enable(){ _enabled = true; const s = S(); if(s){ s.modalAlertEnabled = true; window.saveState && window.saveState(); } }
function disable(){ _enabled = false; _dismiss(); const s = S(); if(s){ s.modalAlertEnabled = false; window.saveState && window.saveState(); } }
function toggle(){ _enabled ? disable() : enable(); try{window.toast && window.toast('모달 화살표 ' + (_enabled?'ON':'OFF'), 'gold');}catch(_){}}
function isEnabled(){ return _enabled; }
function ping(modalEl){
  // 외부에서 강제로 알림 발화 — modalEl 옵션
  if(!modalEl){
    _showArrows(null);
    _showPill(null);
    _chime();
    return;
  }
  const rect = modalEl.getBoundingClientRect();
  _showArrows(rect);
  _showPill(modalEl);
  _chime();
  _attachDismissOnInteract(modalEl);
}

function _boot(){
  const s = S();
  if(s && typeof s.modalAlertEnabled === 'boolean') _enabled = s.modalAlertEnabled;
  _attach();
}
if(document.readyState !== 'loading') setTimeout(_boot, 500);
else document.addEventListener('DOMContentLoaded', () => setTimeout(_boot, 500));

window.V98ModalAlert = { enable, disable, toggle, isEnabled, ping };
})();
