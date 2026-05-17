/* bangje-v98-herbpop.js — v9.8
 * ============================================================================
 * 본초 클릭 → 연관 처방 popup
 *
 *   카드 對決(.cb-herb-card[data-herb]) 과 방미큐브(.bc-card[data-han]) 의
 *   본초 element 클릭 시, 그 본초가 君藥인 처방 / 일반 구성에 포함된 처방을
 *   小 popup으로 노출.
 *
 *   • event delegation: document.body 단일 listener
 *   • 사용자 토글: S.herbPopEnabled (default true)
 *   • 게임 진행 중 기본 클릭(선택/플레이) 동작과 충돌 없이 — 우클릭 또는
 *     long-press (700ms) 또는 본초 카드 우측 상단의 작은 ⓘ 버튼으로 발동.
 *   • S.herbPopMode = 'longpress' | 'icon' | 'off' (default 'longpress')
 *
 *   • V98HerbPop.openFor(han)          — 직접 호출 (V98Diff 등에서 사용)
 *   • V98HerbPop.toggle()              — on/off
 *   • V98HerbPop.setMode(mode)         — 발동 방식 변경
 *
 *   기본 동작과 충돌하지 않도록 long-press 만 기본 활성. 사용자 설정으로
 *   ⓘ 아이콘 inject 모드로 전환 가능.
 * ============================================================================ */
(function(){
'use strict';

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }
function S(){ return window.S || null; }
function save(){ try{ window.saveState && window.saveState(); }catch(_){} }

const LONGPRESS_MS = 700;

function _isEnabled(){
  const s = S(); if(!s) return true;
  return s.herbPopEnabled !== false;
}
function _mode(){
  const s = S(); if(!s) return 'longpress';
  return s.herbPopMode || 'longpress';
}

function _findHan(el){
  if(!el || !el.dataset) return '';
  return el.dataset.han || el.dataset.herb || '';
}

function _isHerbCard(el){
  return el && el.classList && (el.classList.contains('cb-herb-card') || el.classList.contains('bc-card'));
}

// ─── 처방 매칭 ─────────────────────────────────────────────────────────
function _formulasContaining(han){
  const all = (window.FORMULAS || []).concat(window.FORMULAS_EXTRA || []);
  const out = { monarch: [], minister: [], common: [] };
  for(const f of all){
    if(!f.composition || !f.composition.length) continue;
    if(!f.composition.includes(han) && !f.composition.some(h => String(h).startsWith(han))) continue;
    let role = '';
    if(f.monarch_minister){
      for(const [r, hs] of Object.entries(f.monarch_minister)){
        const arr = Array.isArray(hs) ? hs : [hs];
        if(arr.some(h => h === han || String(h).startsWith(han))){ role = r; break; }
      }
    }
    if(role === '君') out.monarch.push(f);
    else if(role === '臣' || role === '佐' || role === '使') out.minister.push({ f, role });
    else out.common.push(f);
  }
  return out;
}

// ─── popup overlay ─────────────────────────────────────────────────────
let _overlay = null;
function _close(){
  if(_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
  _overlay = null;
}

function openFor(han){
  if(!han) return;
  _close();
  const herb = (window.HERBS || []).find(h => h.han === han || h.ko === han);
  const matches = _formulasContaining(han);
  const total = matches.monarch.length + matches.minister.length + matches.common.length;
  _overlay = document.createElement('div');
  _overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(12,8,4,.7); z-index:9300;
    display:flex; align-items:center; justify-content:center; padding:16px;
  `;
  _overlay.addEventListener('click', (e) => { if(e.target === _overlay) _close(); });
  _overlay.innerHTML = `
    <div style="background:#1C140A; color:#FCF4E5;
                border:1px solid #876A36; border-radius:10px;
                width:100%; max-width:420px; max-height:78vh;
                display:flex; flex-direction:column;
                box-shadow:0 12px 36px rgba(0,0,0,.6);">
      <div style="padding:12px 14px; border-bottom:1px solid #876A3666;
                  display:flex; align-items:center; gap:8px; flex-shrink:0">
        <span class="han" style="font-size:20px;color:#FFE08A;font-family:'ZCOOL XiaoWei',serif">${esc(han)}</span>
        ${herb ? `<span style="font-size:12.5px;color:#C9A227">${esc(herb.ko)}</span>` : ''}
        ${herb && herb.sm ? `<span style="font-size:10.5px;color:#876A36">${esc(herb.sm)}</span>` : ''}
        <button id="v98hp-close" type="button" aria-label="닫기" style="
          margin-left:auto; width:26px; height:26px; border-radius:5px;
          background:#876A3633; border:1px solid #876A3666; color:#FFE08A;
          font-size:16px; cursor:pointer; line-height:1; font-family:inherit">×</button>
      </div>
      ${herb && herb.meaning ? `<div style="padding:6px 14px;border-bottom:1px solid #876A3633;font-size:11.5px;color:#E8D4B8;font-family:'Noto Serif SC',serif;line-height:1.5">${esc(herb.meaning)}</div>` : ''}
      <div style="flex:1; overflow-y:auto; padding:10px 14px">
        ${total === 0 ? '<div style="color:#876A36;text-align:center;padding:20px;font-size:12px">이 본초를 쓰는 처방이 없습니다 (시험 범위 한정)</div>' : ''}
        ${matches.monarch.length ? `
          <div style="font-size:11px;color:#9C3030;font-weight:700;letter-spacing:.08em;margin-top:4px">君藥 ${matches.monarch.length}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px">
            ${matches.monarch.map(f => _chip(f, '#9C3030', 'monarch')).join('')}
          </div>
        ` : ''}
        ${matches.minister.length ? `
          <div style="font-size:11px;color:#C9A227;font-weight:700;letter-spacing:.08em;margin-top:8px">臣·佐·使 ${matches.minister.length}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px">
            ${matches.minister.map(x => _chip(x.f, '#C9A227', x.role)).join('')}
          </div>
        ` : ''}
        ${matches.common.length ? `
          <div style="font-size:11px;color:#876A36;font-weight:700;letter-spacing:.08em;margin-top:8px">구성 (역할 미정)</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px">
            ${matches.common.map(f => _chip(f, '#876A36', '')).join('')}
          </div>
        ` : ''}
      </div>
      <div style="padding:8px 14px; border-top:1px solid #876A3633;
                  font-size:10.5px;color:#876A36;text-align:center">
        처방 클릭 → 상세 보기. 對局 진행은 계속됩니다.
      </div>
    </div>
  `;
  document.body.appendChild(_overlay);
  _overlay.querySelector('#v98hp-close').addEventListener('click', _close);
  _overlay.querySelectorAll('[data-fid]').forEach(b => {
    b.addEventListener('click', () => {
      const fid = b.dataset.fid;
      _close();
      setTimeout(() => {
        if(window.V97Dict) window.V97Dict.open && window.V97Dict.open();
        if(window.openFormulaDeep){
          const f = (window.FORMULAS||[]).find(x => x.id === fid);
          try{ window.openFormulaDeep(f ? f.ko : fid); }catch(_){}
        }
      }, 80);
    });
  });
}

function _chip(f, color, role){
  return `<button type="button" data-fid="${esc(f.id)}" style="
    background:${color}22;color:${color};border:1px solid ${color}66;
    padding:3px 8px;border-radius:8px;font-size:11.5px;cursor:pointer;font-family:inherit">
    ${role?'<span style="font-size:9.5px;opacity:.7">'+esc(role)+'</span> ':''}<span class="han">${esc(f.han)}</span>
    <span style="opacity:.65;font-size:10px"> · ${esc(f.ko)}</span>
  </button>`;
}

// ─── 발동 트리거 (long-press 또는 icon) ────────────────────────────────
let _pressTimer = null, _pressed = false, _pressEl = null;

function _onPointerDown(e){
  if(!_isEnabled()) return;
  if(_mode() === 'off') return;
  if(_mode() !== 'longpress') return;
  const el = e.target.closest('.cb-herb-card, .bc-card');
  if(!_isHerbCard(el)) return;
  const han = _findHan(el);
  if(!han) return;
  _pressEl = el;
  _pressed = false;
  clearTimeout(_pressTimer);
  _pressTimer = setTimeout(() => {
    _pressed = true;
    openFor(han);
  }, LONGPRESS_MS);
}
function _onPointerUp(e){
  clearTimeout(_pressTimer);
  if(_pressed){
    // long-press 가 발동된 경우 그 후의 click 한 번 차단
    const cap = (ev) => { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', cap, true); };
    document.addEventListener('click', cap, true);
  }
  _pressEl = null;
  _pressed = false;
}
function _onPointerMove(){
  // 살짝 움직이면 long-press 취소
  clearTimeout(_pressTimer);
}

// ─── 'icon' 모드 — 본초 카드 우상단에 ⓘ inject ──────────────────────────
function _injectIcons(){
  if(_mode() !== 'icon') return;
  if(!_isEnabled()) return;
  document.querySelectorAll('.cb-herb-card:not([data-v98hp]), .bc-card:not([data-v98hp])').forEach(card => {
    card.dataset.v98hp = '1';
    if(getComputedStyle(card).position === 'static') card.style.position = 'relative';
    const ico = document.createElement('span');
    ico.textContent = 'ⓘ';
    ico.style.cssText = `
      position:absolute; top:1px; right:2px; z-index:5;
      font-size:11px; color:#FFE08A; background:#9C3030;
      width:14px; height:14px; line-height:14px; text-align:center; border-radius:50%;
      cursor:pointer; opacity:.7; font-family:sans-serif;
    `;
    ico.addEventListener('click', (e) => {
      e.stopPropagation();
      const han = _findHan(card);
      if(han) openFor(han);
    });
    card.appendChild(ico);
  });
}

function _watchForIcons(){
  const obs = new MutationObserver(() => { try{ _injectIcons(); }catch(_){} });
  obs.observe(document.body, { childList:true, subtree:true });
  setTimeout(_injectIcons, 300);
}

// ─── 토글 API ──────────────────────────────────────────────────────────
function toggle(){
  const s = S(); if(!s) return;
  s.herbPopEnabled = !_isEnabled();
  save();
  toast('본초 popup ' + (s.herbPopEnabled ? 'ON' : 'OFF'), 'gold');
}
function setMode(m){
  const s = S(); if(!s) return;
  if(['longpress','icon','off'].indexOf(m) < 0) return;
  s.herbPopMode = m; save();
  toast('본초 popup 모드: '+m, 'gold');
  if(m === 'icon') _injectIcons();
}
function getMode(){ return _mode(); }
function isEnabled(){ return _isEnabled(); }

// ─── 부팅 ────────────────────────────────────────────────────────────────
function _attach(){
  document.addEventListener('pointerdown', _onPointerDown, true);
  document.addEventListener('pointerup', _onPointerUp, true);
  document.addEventListener('pointermove', _onPointerMove, true);
  document.addEventListener('pointercancel', _onPointerUp, true);
  _watchForIcons();
}
if(document.readyState !== 'loading') setTimeout(_attach, 400);
else document.addEventListener('DOMContentLoaded', () => setTimeout(_attach, 400));

window.V98HerbPop = { openFor, toggle, setMode, getMode, isEnabled };
})();
