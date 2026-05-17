/* bangje-v99-herbtap.js — v10.0.4
 * ============================================================================
 * 본초 단탭 + 하단 드로어 popup + 大廳 학습 토글
 *
 *   v98-herbpop 의 전체화면 overlay 가 게임을 가려서 진행 불가 → 화면 하단
 *   드로어 (최대 38vh) 로 대체. 위쪽 62vh 는 게임 화면 그대로 사용 가능.
 *
 *   v10.0.4 변경 (2건):
 *     1. 카드 탭이 학습 측 capture-listener 에서 stopPropagation/preventDefault 로
 *        막혀 큐브 손패 선택이 안 되던 버그 수정. 이제 capture 에서 드로어만
 *        열고 클릭은 bubble 시켜 .bc-card 의 카드별 리스너 (onHandCardClick) 가
 *        정상 발동. 드로어 표시 ∥ 카드 선택 동시.
 *     2. 시험범위밖 처방도 함께 표시 — FORMULAS_EXTRA composition + FORMULA_ADDITIONS·
 *        EXTRA_ADDITIONS 의 派生方·加減方 모두 검색. chip 옆에 (시험범위밖) 라벨.
 *        예: 猪膽汁 → 白通加猪膽汁湯 (시험범위밖, 사역탕 派生) 식으로 노출.
 *
 *   동작:
 *     • 학습 ON: .cb-herb-card / .bc-card 클릭 → 하단 드로어 (게임 클릭도 진행)
 *     • 학습 OFF: 본초 카드 클릭은 게임 기본 동작만
 *
 *   영속: S.herbTapEnabled (default true)
 *   부수: V98HerbPop.setMode('off') — long-press 비활성
 *   API: V99HerbTap.isOn()/.toggle()/.on()/.off()/.openFor(han)/.close()
 * ============================================================================ */
(function(){
'use strict';

function S(){ return window.S || null; }
function save(){ try{ window.saveState && window.saveState(); }catch(_){} }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function isOn(){ const s=S(); if(!s) return true; return s.herbTapEnabled !== false; }
function _set(v){ const s=S(); if(!s) return; s.herbTapEnabled = !!v; save(); }
function on()  { _set(true);  _refreshChip(); toast('본초 학습 ON', 'gold'); }
function off() { _set(false); _refreshChip(); close(); toast('본초 학습 OFF', null); }
function toggle(){ isOn() ? off() : on(); }

function _herbName(it){
  const s = String(it||'').trim();
  const m = s.match(/^([\u4E00-\u9FFF]+)/);
  return m ? m[1] : s;
}

// v10.0.4: 시험범위 안(FORMULAS) vs 밖(FORMULAS_EXTRA) 표시 + 派生方·加減方 노출
function _formulasContaining(han){
  const FORMULAS_IN  = window.FORMULAS || [];
  const FORMULAS_OUT = window.FORMULAS_EXTRA || [];
  const inIds = new Set(FORMULAS_IN.map(f => f && f.id).filter(Boolean));
  const all = FORMULAS_IN.concat(FORMULAS_OUT);
  const out = { monarch: [], minister: [], common: [] };
  for(const f of all){
    if(!f.composition || !f.composition.length) continue;
    const herbs = f.composition.map(_herbName);
    if(!herbs.some(h => h === han || h.startsWith(han) || han.startsWith(h))) continue;
    let role = '';
    if(f.monarch_minister){
      for(const [r, hs] of Object.entries(f.monarch_minister)){
        const arr = Array.isArray(hs) ? hs : [hs];
        if(arr.some(h => h === han || String(h).startsWith(han))){ role = r; break; }
      }
    }
    const outOfScope = !inIds.has(f.id);
    if(role === '君') out.monarch.push({ f, outOfScope });
    else if(role === '臣' || role === '佐' || role === '使') out.minister.push({ f, role, outOfScope });
    else out.common.push({ f, outOfScope });
  }
  return out;
}

// v10.0.4: 派生方(target 처방명 있음) / 加減方(증상 대응 추가) 에서도 본 본초가 등장하는지.
// parent 가 시험범위 안 처방이라도, 派生方·加減方 자체는 모두 시험범위 밖으로 분류 (학습 강도 분리).
function _additionsContaining(han){
  const FORMULAS_IN  = window.FORMULAS || [];
  const inIds = new Set(FORMULAS_IN.map(f => f && f.id).filter(Boolean));
  const allFormulasById = {};
  (window.FORMULAS||[]).concat(window.FORMULAS_EXTRA||[]).forEach(f => { if(f && f.id) allFormulasById[f.id] = f; });
  const sources = [ window.FORMULA_ADDITIONS || {}, window.EXTRA_ADDITIONS || {} ];
  const out = [];
  for(const adds of sources){
    for(const [fid, obj] of Object.entries(adds)){
      const parent = allFormulasById[fid];
      if(!parent) continue;
      for(const it of (obj.items||[])){
        const hs = (it.herbs||[]).map(_herbName);
        if(!hs.some(h => h === han || h.startsWith(han) || han.startsWith(h))) continue;
        out.push({
          parent,
          target: it.target || '',
          mod: it.mod || '',
          kind: it.kind || 'symptom',     // 'derive' | 'symptom' | 'compose'
          parentInScope: inIds.has(fid),  // 視覺 보조 (현재는 일괄 시험범위밖 라벨)
        });
      }
    }
  }
  return out;
}

function _adjuncts(f, currentHan){
  if(!Array.isArray(f.composition)) return [];
  const others = f.composition.map(_herbName)
    .filter(n => n && n !== currentHan && !n.startsWith(currentHan) && !currentHan.startsWith(n));
  return Array.from(new Set(others));
}

let _drawer = null;

function close(){
  if(_drawer && _drawer.parentNode){
    _drawer.classList.add('hide');
    setTimeout(() => {
      if(_drawer && _drawer.parentNode) _drawer.parentNode.removeChild(_drawer);
      _drawer = null;
    }, 220);
  } else { _drawer = null; }
}

function openFor(han){
  if(!han) return;
  _injectCSS();
  const herb = (window.HERBS || []).find(h => h.han === han || h.ko === han);
  const matches = _formulasContaining(han);
  const additions = _additionsContaining(han);
  const total = matches.monarch.length + matches.minister.length + matches.common.length + additions.length;

  const headHTML = `
    <div class="v99hd-bar"></div>
    <div class="v99hd-head">
      <span class="v99hd-han">${esc(han)}</span>
      ${herb ? `<span class="v99hd-ko">${esc(herb.ko)}</span>` : ''}
      ${herb && herb.sm ? `<span class="v99hd-sm">${esc(herb.sm)}</span>` : ''}
      <span class="v99hd-cnt">${total}개</span>
      <button type="button" class="v99hd-close" aria-label="닫기">×</button>
    </div>`;
  const bodyHTML = `
    ${herb && herb.meaning ? `<div class="v99hd-meaning">${esc(herb.meaning)}</div>` : ''}
    ${total === 0 ? '<div class="v99hd-empty">이 본초를 쓰는 처방이 시험범위·확장사전·派生方 모두에서 발견되지 않음</div>' : ''}
    ${matches.monarch.length ? `<div class="v99hd-sect"><div class="v99hd-sect-head" style="color:#9C3030">君藥 <span class="v99hd-sect-cnt">${matches.monarch.length}</span></div><div class="v99hd-chips">${matches.monarch.map(x => _chip(x.f, '#9C3030', '', han, x.outOfScope)).join('')}</div></div>` : ''}
    ${matches.minister.length ? `<div class="v99hd-sect"><div class="v99hd-sect-head" style="color:#C9A227">臣·佐·使 <span class="v99hd-sect-cnt">${matches.minister.length}</span></div><div class="v99hd-chips">${matches.minister.map(x => _chip(x.f, '#C9A227', x.role, han, x.outOfScope)).join('')}</div></div>` : ''}
    ${matches.common.length ? `<div class="v99hd-sect"><div class="v99hd-sect-head" style="color:#876A36">구성 <span class="v99hd-sect-cnt">${matches.common.length}</span></div><div class="v99hd-chips">${matches.common.map(x => _chip(x.f, '#876A36', '', han, x.outOfScope)).join('')}</div></div>` : ''}
    ${additions.length ? `<div class="v99hd-sect"><div class="v99hd-sect-head" style="color:#6B5A8A">派生方·加減方 <span class="v99hd-sect-cnt">${additions.length}</span></div><div class="v99hd-chips">${additions.map(a => _chipDerived(a, han)).join('')}</div></div>` : ''}
  `;
  if(_drawer){
    _drawer.querySelector('.v99hd-head-wrap').innerHTML = headHTML;
    _drawer.querySelector('.v99hd-body').innerHTML = bodyHTML;
  } else {
    _drawer = document.createElement('div');
    _drawer.id = 'v99-herbtap-drawer';
    _drawer.innerHTML = `<div class="v99hd-head-wrap">${headHTML}</div><div class="v99hd-body">${bodyHTML}</div>`;
    document.body.appendChild(_drawer);
    requestAnimationFrame(() => requestAnimationFrame(() => _drawer && _drawer.classList.add('vis')));
  }
  _attachDrawerHandlers();
}

function _attachDrawerHandlers(){
  if(!_drawer) return;
  const x = _drawer.querySelector('.v99hd-close');
  if(x) x.onclick = close;
  _drawer.querySelectorAll('[data-fid]').forEach(b => {
    b.onclick = () => {
      const fid = b.dataset.fid;
      close();
      setTimeout(() => {
        try{
          if(window.V97Dict && window.V97Dict.open) window.V97Dict.open();
          if(window.openFormulaDeep){
            const f = (window.FORMULAS||[]).concat(window.FORMULAS_EXTRA||[]).find(x => x.id === fid);
            window.openFormulaDeep(f ? f.ko : fid);
          }
        }catch(_){}
      }, 80);
    };
  });
  const bar = _drawer.querySelector('.v99hd-bar');
  if(bar) bar.onclick = close;
}

function _chip(f, color, role, currentHan, outOfScope){
  const adj = _adjuncts(f, currentHan);
  const adjHtml = adj.length === 0
    ? '<span class="v99hd-adj-mark">單方</span>'
    : `<span class="v99hd-adj"><span class="v99hd-adj-plus">+ </span><span class="han">${adj.map(esc).join(' · ')}</span></span>`;
  const scopeLabel = outOfScope ? '<span class="v99hd-scope">(시험범위밖)</span>' : '';
  return `<button type="button" data-fid="${esc(f.id)}" class="v99hd-chip${outOfScope?' v99hd-chip-out':''}" style="border-color:${color}66;background:${color}1A;color:${color}">
    <span class="v99hd-chip-top">${role?'<span class="v99hd-role">'+esc(role)+'</span> ':''}<span class="han v99hd-fhan">${esc(f.han||'')}</span><span class="v99hd-fko"> · ${esc(f.ko||'')}</span>${scopeLabel}</span>
    ${adjHtml}
  </button>`;
}

// v10.0.4: 派生方·加減方 chip. target 처방명(있을 때) + parent 처방 표시.
// 클릭 시 parent 처방 deep view 로 이동 (派生 자체는 별도 페이지가 없으므로).
function _chipDerived(a, currentHan){
  const color = '#6B5A8A';                  // 派生·加減 전용 색
  const parent = a.parent || {};
  const isDerive = a.kind === 'derive';
  const kindLabel = isDerive ? '派生' : '加減';
  // 목표 처방명 (派生이면 보통 있음). 없으면 mod 텍스트로 대체.
  const targetText = a.target || a.mod || `${parent.ko || ''} 加減`;
  const modSummary = a.mod ? `<span class="v99hd-adj"><span class="v99hd-adj-plus">${esc(kindLabel)}: </span><span class="han">${esc(a.mod)}</span></span>` : '';
  return `<button type="button" data-fid="${esc(parent.id||'')}" class="v99hd-chip v99hd-chip-out v99hd-chip-deriv" style="border-color:${color}66;background:${color}1A;color:${color}">
    <span class="v99hd-chip-top"><span class="v99hd-role">${esc(kindLabel)}</span> <span class="han v99hd-fhan">${esc(targetText)}</span><span class="v99hd-fko"> · ${esc(parent.han||'')} ${esc(parent.ko||'')}</span><span class="v99hd-scope">(시험범위밖)</span></span>
    ${modSummary}
  </button>`;
}

function _onClickCapture(e){
  if(!isOn()) return;
  const t = e.target;
  if(!t || !t.closest) return;
  if(t.closest('#v99-herbtap-drawer') || t.closest('#v99-herbtap-chip')) return;
  const card = t.closest('.cb-herb-card, .bc-card');
  if(!card) return;
  const han = (card.dataset && (card.dataset.han || card.dataset.herb)) || '';
  if(!han) return;
  // v10.0.4: stopPropagation/preventDefault 제거 — capture-phase 에서 드로어만
  //          열고 클릭은 그대로 bubble 시켜 게임 카드 선택 핸들러
  //          (.bc-card → onHandCardClick) 가 정상 발동되도록 함. 두 동작 동시.
  openFor(han);
}

function _injectCSS(){
  if(document.getElementById('v99-herbtap-css')) return;
  const st = document.createElement('style');
  st.id = 'v99-herbtap-css';
  st.textContent = `
    .v99-herbtap-chip { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:11px; font-family:'Noto Serif KR',serif; font-size:11px; letter-spacing:.02em; cursor:pointer; user-select:none; transition:all .15s; white-space:nowrap; border:1px solid; margin-left:4px; }
    .v99-herbtap-chip.on { background:linear-gradient(135deg,#6E1818 0%,#9C3030 100%); border-color:#C9A227; color:#FFE08A; box-shadow:0 0 6px rgba(201,162,39,.25); }
    .v99-herbtap-chip.off { background:rgba(28,20,10,.04); border-color:rgba(135,106,54,.32); color:var(--gutong,#876A36); }
    .v99-herbtap-chip .han { font-family:'ZCOOL XiaoWei',serif; font-size:13px; line-height:1; font-weight:700; }
    .v99-herbtap-chip:hover { filter:brightness(1.1); }
    .v99-herbtap-chip .state { font-size:10px; font-weight:700; padding:1px 5px; border-radius:7px; background:rgba(255,224,138,.18); }
    .v99-herbtap-chip.off .state { background:rgba(135,106,54,.13); }
    #v99-herbtap-drawer { position:fixed; left:0; right:0; bottom:0; z-index:9300; background:#1C140A; color:#FCF4E5; border-top:1px solid #C9A227; border-radius:12px 12px 0 0; max-height:38vh; display:flex; flex-direction:column; box-shadow:0 -8px 24px rgba(0,0,0,.45); transform:translateY(105%); transition:transform .22s ease-out; font-family:'Noto Serif KR',serif; }
    #v99-herbtap-drawer.vis { transform:translateY(0); }
    #v99-herbtap-drawer.hide { transform:translateY(105%); }
    .v99hd-bar { width:36px; height:4px; background:#C9A22755; border-radius:2px; margin:6px auto 0; cursor:pointer; }
    .v99hd-head { padding:6px 12px 8px; display:flex; align-items:baseline; gap:7px; border-bottom:1px solid #876A3633; flex-wrap:wrap; }
    .v99hd-han { font-family:'ZCOOL XiaoWei',serif; font-size:19px; color:#FFE08A; font-weight:700; }
    .v99hd-ko { font-size:12.5px; color:#C9A227; }
    .v99hd-sm { font-size:10.5px; color:#876A36; }
    .v99hd-cnt { font-size:10px; color:#C9A227; background:#876A3622; padding:2px 7px; border-radius:7px; margin-left:4px; }
    .v99hd-close { margin-left:auto; width:26px; height:26px; border-radius:5px; background:#876A3633; border:1px solid #876A3666; color:#FFE08A; font-size:17px; cursor:pointer; line-height:1; font-family:inherit; }
    .v99hd-body { flex:1; overflow-y:auto; padding:8px 12px 14px; -webkit-overflow-scrolling:touch; }
    .v99hd-meaning { padding:5px 0 8px; font-size:11.5px; color:#E8D4B8; font-family:'Noto Serif SC',serif; line-height:1.5; border-bottom:1px solid #876A3622; margin-bottom:6px; }
    .v99hd-empty { color:#876A36; text-align:center; padding:20px; font-size:12px; }
    .v99hd-sect { margin-top:8px; }
    .v99hd-sect:first-of-type { margin-top:0; }
    .v99hd-sect-head { font-size:10.5px; font-weight:700; letter-spacing:.08em; margin-bottom:4px; }
    .v99hd-sect-cnt { opacity:.7; font-weight:600; }
    .v99hd-chips { display:flex; flex-wrap:wrap; gap:5px; }
    .v99hd-chip { display:inline-flex; flex-direction:column; align-items:flex-start; padding:4px 8px; border-radius:8px; cursor:pointer; border:1px solid; font-family:inherit; text-align:left; font-size:11.5px; line-height:1.25; }
    .v99hd-chip:hover { filter:brightness(1.15); }
    .v99hd-chip-top { display:inline-flex; align-items:baseline; gap:4px; }
    .v99hd-role { font-size:9.5px; opacity:.7; }
    .v99hd-fhan { font-family:'ZCOOL XiaoWei',serif; font-weight:700; font-size:12.5px; }
    .v99hd-fko { opacity:.65; font-size:10.5px; }
    .v99hd-adj { display:block; font-size:9.5px; opacity:.72; margin-top:1px; line-height:1.32; max-width:240px; font-weight:400; }
    .v99hd-adj-plus { opacity:.55; }
    .v99hd-adj-mark { display:block; font-size:9px; opacity:.5; margin-top:1px; font-style:italic; font-weight:400; }
    .v99hd-scope { display:inline-block; font-size:9px; opacity:.7; margin-left:5px; padding:1px 5px; border-radius:6px; background:rgba(135,106,54,.18); color:#876A36; font-weight:400; letter-spacing:.02em; }
    .v99hd-chip-out { opacity:.85; }
    .v99hd-chip-deriv .v99hd-fhan { font-size:11px; }
    @media (max-height: 600px) { #v99-herbtap-drawer { max-height:50vh; } }
  `;
  document.head.appendChild(st);
}

function _chipHtml(){
  const on_ = isOn();
  return `<span class="han">本草</span><span style="opacity:.85">學習</span><span class="state">${on_ ? 'ON' : 'OFF'}</span>`;
}

let _lastChipHtml = '';
function _injectToggleChip(){
  const hello = document.getElementById('hello-card');
  if(!hello) return;
  let chip = document.getElementById('v99-herbtap-chip');
  if(!chip){
    chip = document.createElement('div');
    chip.id = 'v99-herbtap-chip';
    chip.className = 'v99-herbtap-chip ' + (isOn() ? 'on' : 'off');
    chip.title = '본초 카드 탭 → 하단 드로어. 게임 진행은 위쪽에서 계속 가능';
    chip.addEventListener('click', toggle);
    const sichen = document.getElementById('v99-sichen-chip');
    if(sichen) sichen.parentNode.insertBefore(chip, sichen.nextSibling);
    else hello.parentNode.insertBefore(chip, hello);
  }
  chip.className = 'v99-herbtap-chip ' + (isOn() ? 'on' : 'off');
  const next = _chipHtml();
  if(next !== _lastChipHtml){ chip.innerHTML = next; _lastChipHtml = next; }
}
function _refreshChip(){ _lastChipHtml=''; try{ _injectToggleChip(); }catch(_){} }

function _attach(){
  _injectCSS();
  try{ if(window.V98HerbPop && window.V98HerbPop.setMode) window.V98HerbPop.setMode('off'); }catch(_){}
  document.addEventListener('click', _onClickCapture, true);
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && _drawer) close(); });
}

function _observe(){
  const v = document.getElementById('view');
  if(!v){ setTimeout(_observe, 400); return; }
  _injectCSS();
  let _t = null;
  const obs = new MutationObserver(records => {
    let external = false;
    for(const r of records){
      const tgt = r.target;
      if(!tgt) continue;
      if(tgt.id === 'v99-herbtap-chip' || tgt.id === 'v99-herbtap-drawer') continue;
      if(tgt.closest && (tgt.closest('#v99-herbtap-chip') || tgt.closest('#v99-herbtap-drawer'))) continue;
      external = true; break;
    }
    if(!external) return;
    if(_t) return;
    _t = setTimeout(() => { _t = null; try{ _injectToggleChip(); }catch(_){} }, 300);
  });
  obs.observe(v, { childList: true, subtree: true });
  setTimeout(_injectToggleChip, 400);
}

if(document.readyState !== 'loading') setTimeout(() => { _attach(); _observe(); }, 600);
else document.addEventListener('DOMContentLoaded', () => setTimeout(() => { _attach(); _observe(); }, 600));

window.V99HerbTap = { isOn, toggle, on, off, openFor, close };
})();
