/* bangje-v99-herbtap.js — v10.0.2
 * ============================================================================
 * 본초 단탭 popup + 大廳 학습 토글 + 「+ 나머지 본초」 표시
 *
 *   v98-herbpop 의 long-press 가 학습용으로 불편 → 단탭으로 즉시 popup.
 *   기능은 단일 ON/OFF — 大廳의 작은 chip 으로 토글.
 *   본초가 단방이 아닌 경우, 어떤 본초를 *더하면* 그 처방이 되는지 chip 아래 표시.
 *
 *   동작:
 *     • 학습 ON: .cb-herb-card / .bc-card 클릭 → 즉시 popup (게임 진행 동작 차단)
 *     • 학습 OFF: 본초 카드 클릭 → 게임 기본 동작 (선택·플레이)
 *
 *   영속: S.herbTapEnabled (default true — 학습용 기본 ON)
 *   의존: V98HerbPop.openFor(han), FORMULAS, FORMULAS_EXTRA
 *
 *   • V99HerbTap.isOn()
 *   • V99HerbTap.toggle() / .on() / .off()
 * ============================================================================ */
(function(){
'use strict';

function S(){ return window.S || null; }
function save(){ try{ window.saveState && window.saveState(); }catch(_){} }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function isOn(){
  const s = S(); if(!s) return true;
  return s.herbTapEnabled !== false;  // default true
}
function _set(v){
  const s = S(); if(!s) return;
  s.herbTapEnabled = !!v;
  save();
}
function on()  { _set(true);  _refreshChip(); toast('본초 학습 ON — 본초 카드 탭 시 처방 popup', 'gold'); }
function off() { _set(false); _refreshChip(); toast('본초 학습 OFF — 본초 카드는 게임용', null); }
function toggle(){ isOn() ? off() : on(); }

// ─── click capture — 본초 카드 단탭 ────────────────────────────────────
// capture phase 에서 가로채야 game logic (cube/card-duel) 보다 먼저 동작.
function _onClickCapture(e){
  if(!isOn()) return;
  const t = e.target;
  if(!t || !t.closest) return;
  // popup 모달 안의 클릭은 통과
  if(t.closest('[data-fid]') || t.closest('#v98hp-close')) return;
  // 우리 토글 chip 자체는 통과
  if(t.closest('#v99-herbtap-chip')) return;
  // 본초 카드?
  const card = t.closest('.cb-herb-card, .bc-card');
  if(!card) return;
  const han = (card.dataset && (card.dataset.han || card.dataset.herb)) || '';
  if(!han) return;
  // 가로채서 popup
  e.stopPropagation();
  e.preventDefault();
  _openWithAdjuncts(han);
}

// ─── popup + adjunct herbs inject ──────────────────────────────────────
function _openWithAdjuncts(han){
  try{
    if(window.V98HerbPop && window.V98HerbPop.openFor){
      window.V98HerbPop.openFor(han);
      // popup 이 DOM 에 attach 된 직후 chip 들에 "+ 나머지 본초" inject
      setTimeout(() => _injectAdjuncts(han), 80);
    } else {
      toast('본초 popup 모듈 미로딩 (V98HerbPop)', null);
    }
  }catch(_){}
}

// 본초 항목에서 한자명만 추출 — "甘草 6g" → "甘草"
function _herbName(item){
  if(!item) return '';
  const s = String(item).trim();
  const m = s.match(/^([\u4E00-\u9FFF]+)/);
  return m ? m[1] : s;
}

function _injectAdjuncts(currentHan){
  const popup = document.querySelectorAll('button[data-fid]');
  if(!popup.length) return;
  const allF = (window.FORMULAS || []).concat(window.FORMULAS_EXTRA || []);
  popup.forEach(btn => {
    if(btn.dataset.v99adj) return;       // 중복 inject 방지
    btn.dataset.v99adj = '1';
    const fid = btn.dataset.fid;
    const f = allF.find(x => x.id === fid);
    if(!f || !Array.isArray(f.composition) || f.composition.length === 0) return;
    // 현재 본초를 제외한 나머지 본초 추출
    const others = f.composition.filter(it => {
      const n = _herbName(it);
      return n && n !== currentHan && !n.startsWith(currentHan) && !currentHan.startsWith(n);
    }).map(_herbName).filter(Boolean);
    // 중복 제거
    const uniq = Array.from(new Set(others));
    if(uniq.length === 0){
      // 단방 (oneness) — 가독성용 작은 표시
      btn.style.display = 'inline-flex';
      btn.style.flexDirection = 'column';
      btn.style.alignItems = 'flex-start';
      btn.style.textAlign = 'left';
      const tag = document.createElement('span');
      tag.style.cssText = 'display:block;font-size:9px;opacity:.55;margin-top:1px;line-height:1.2;font-style:italic';
      tag.textContent = '單方';
      btn.appendChild(tag);
      return;
    }
    // 본초 chip 다중 줄 — flex column 로 전환
    btn.style.display = 'inline-flex';
    btn.style.flexDirection = 'column';
    btn.style.alignItems = 'flex-start';
    btn.style.textAlign = 'left';
    const adj = document.createElement('span');
    adj.style.cssText = 'display:block;font-size:9.5px;opacity:.72;margin-top:2px;line-height:1.35;max-width:240px;font-weight:400';
    // "+" 기호 + 한자 본초들 (가독성 위해 · 구분)
    adj.innerHTML = '<span style="opacity:.6">+ </span><span class="han" style="letter-spacing:.02em">' +
      uniq.map(h => esc(h)).join(' · ') + '</span>';
    btn.appendChild(adj);
  });
}

// ─── 大廳 토글 chip ────────────────────────────────────────────────────
function _injectCSS(){
  if(document.getElementById('v99-herbtap-css')) return;
  const st = document.createElement('style');
  st.id = 'v99-herbtap-css';
  st.textContent = `
    .v99-herbtap-chip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 11px;
      font-family: 'Noto Serif KR', serif; font-size: 11px;
      letter-spacing: 0.02em;
      cursor: pointer; user-select: none;
      transition: all 0.15s;
      white-space: nowrap;
      border: 1px solid;
      margin-left: 4px;
    }
    .v99-herbtap-chip.on {
      background: linear-gradient(135deg, #6E1818 0%, #9C3030 100%);
      border-color: #C9A227;
      color: #FFE08A;
      box-shadow: 0 0 6px rgba(201,162,39,.25);
    }
    .v99-herbtap-chip.off {
      background: rgba(28, 20, 10, 0.04);
      border-color: rgba(135, 106, 54, 0.32);
      color: var(--gutong, #876A36);
    }
    .v99-herbtap-chip .han {
      font-family: 'ZCOOL XiaoWei', serif; font-size: 13px;
      line-height: 1; font-weight: 700;
    }
    .v99-herbtap-chip.on:hover {
      filter: brightness(1.1);
    }
    .v99-herbtap-chip.off:hover {
      background: rgba(28, 20, 10, 0.08);
      border-color: rgba(135, 106, 54, 0.55);
    }
    .v99-herbtap-chip .state {
      font-size: 10px; font-weight: 700;
      padding: 1px 5px; border-radius: 7px;
      background: rgba(255, 224, 138, 0.18);
    }
    .v99-herbtap-chip.off .state {
      background: rgba(135, 106, 54, 0.13);
    }
  `;
  document.head.appendChild(st);
}

function _chipHtml(){
  const on = isOn();
  return `
    <span class="han">本草</span>
    <span style="opacity:.85">學習</span>
    <span class="state">${on ? 'ON' : 'OFF'}</span>
  `;
}

let _lastChipHtml = '';
function _inject(){
  // 大廳 hello-card 영역에만 표시
  const hello = document.getElementById('hello-card');
  if(!hello) return;
  let chip = document.getElementById('v99-herbtap-chip');
  if(!chip){
    chip = document.createElement('div');
    chip.id = 'v99-herbtap-chip';
    chip.className = 'v99-herbtap-chip ' + (isOn() ? 'on' : 'off');
    chip.title = '본초 카드 탭 → 처방 popup (학습용). 게임에 방해되면 OFF.';
    chip.addEventListener('click', toggle);
    // sichen-chip 옆에 두기 (sichen 이 없으면 hello-card 앞에)
    const sichen = document.getElementById('v99-sichen-chip');
    if(sichen){
      sichen.parentNode.insertBefore(chip, sichen.nextSibling);
    } else {
      hello.parentNode.insertBefore(chip, hello);
    }
  }
  // class 갱신
  chip.className = 'v99-herbtap-chip ' + (isOn() ? 'on' : 'off');
  const next = _chipHtml();
  if(next !== _lastChipHtml){
    chip.innerHTML = next;
    _lastChipHtml = next;
  }
}

function _refreshChip(){
  _lastChipHtml = '';
  try{ _inject(); }catch(_){}
}

// ─── 부팅 ──────────────────────────────────────────────────────────────
function _attach(){
  _injectCSS();
  // v98-herbpop 의 long-press 트리거 자동 비활성
  try{
    if(window.V98HerbPop && window.V98HerbPop.setMode){
      window.V98HerbPop.setMode('off');
    }
  }catch(_){}
  // capture phase click — game logic 보다 먼저
  document.addEventListener('click', _onClickCapture, true);
}

function _observe(){
  const v = document.getElementById('view');
  if(!v){ setTimeout(_observe, 400); return; }
  _injectCSS();
  // 자기 자신 mutation 무시 + throttle (sichen-clock 과 같은 패턴)
  let _t = null;
  const obs = new MutationObserver(records => {
    let external = false;
    for(const r of records){
      const tgt = r.target;
      if(!tgt) continue;
      if(tgt.id === 'v99-herbtap-chip') continue;
      if(tgt.closest && tgt.closest('#v99-herbtap-chip')) continue;
      external = true; break;
    }
    if(!external) return;
    if(_t) return;
    _t = setTimeout(() => { _t = null; try{ _inject(); }catch(_){} }, 300);
  });
  obs.observe(v, { childList: true, subtree: true });
  setTimeout(_inject, 400);
}

if(document.readyState !== 'loading') setTimeout(() => { _attach(); _observe(); }, 600);
else document.addEventListener('DOMContentLoaded', () => setTimeout(() => { _attach(); _observe(); }, 600));

window.V99HerbTap = { isOn, toggle, on, off };
})();
