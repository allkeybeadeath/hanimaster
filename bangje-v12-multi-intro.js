/* bangje-v12-multi-intro.js — 멀티 게임 공통 시작 컷 + 이스터에그 v12.0
 *  모든 멀티 게임 (방제 對決·방미큐브·경혈 포커·오수혈 레이스) 공통 진입 cinematic.
 *  이스터에그 (CHANGELOG 표시 X):
 *    lindaoren(린도인) → 1/10 확률 간디 사진 + 비폭력 명언
 *    wuyouke(오우가)   → 1/10 확률 오우거(판타지) 사진 + "우가우가"
 *  외부: window.V12Intro = { show, charPhoto, eggQuote, eggNameOverride }
 */
(function(){
'use strict';

const EGG = {
  lindaoren: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Portrait_Gandhi.jpg',
    quote: { han:'My life is my message', ko:'내 삶이 곧 나의 메시지다', src:'— Mahatma Gandhi' },
    name_override: '간디', han_override: '甘地',
  },
  wuyouke: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Arthur_Rackham_1909_Undine_Frontispiece.jpg/600px-Arthur_Rackham_1909_Undine_Frontispiece.jpg',
    quote: { han:'우가우가', ko:'우가우가', src:'— 오우거' },
    name_override: '오우거', han_override: '吳우거',
  },
};

function _eggRoll(charId){
  if(!EGG[charId]) return null;
  const key = `v12_egg_${charId}`;
  try{
    const cached = sessionStorage.getItem(key);
    if(cached !== null) return cached === '1' ? EGG[charId] : null;
    const roll = Math.random() < 0.1 ? '1' : '0';
    sessionStorage.setItem(key, roll);
    return roll === '1' ? EGG[charId] : null;
  }catch(_){
    return Math.random() < 0.1 ? EGG[charId] : null;
  }
}

function charPhoto(charIdOrObj, size, opts){
  size = size || 110;
  opts = opts || {};
  let char = charIdOrObj;
  if(typeof charIdOrObj === 'string'){
    char = (typeof PHYSICIAN_BY_ID !== 'undefined' && PHYSICIAN_BY_ID[charIdOrObj]) ||
           (typeof PHYSICIANS !== 'undefined' && PHYSICIANS.find(p => p.id === charIdOrObj)) ||
           { id: charIdOrObj, ko:'?', han:'?' };
  }
  const charId = char.id;
  const egg = (opts.allowEgg !== false) ? _eggRoll(charId) : null;

  let baseHtml = '';
  if(typeof window._charPhotoMedallion === 'function')      baseHtml = window._charPhotoMedallion(char, size);
  else if(typeof window._charMedallion === 'function')      baseHtml = window._charMedallion(char, size);
  else {
    const init = (char.han||'?').charAt(0);
    baseHtml = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#E8C8A0;display:flex;align-items:center;justify-content:center;font-family:'ZCOOL XiaoWei',serif;font-size:${Math.round(size*0.4)}px;color:#3A1810">${init}</div>`;
  }

  if(!egg) return baseHtml;

  const fallback = char.id;
  const eggImg = `<img src="${egg.src}" onerror="this.onerror=null;this.src='${fallback}.jpeg'" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="${egg.name_override}">`;
  if(/<img[^>]*>/i.test(baseHtml)){
    return baseHtml.replace(/<img[^>]*>/i, eggImg);
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:2px solid #C9A227">${eggImg}</div>`;
}
function eggQuote(charId){ const e = _eggRoll(charId); return e ? e.quote : null; }
function eggNameOverride(charId){ const e = _eggRoll(charId); return e ? { ko:e.name_override, han:e.han_override } : null; }

function esc_(s){ return String(s||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

function _slot(p, size, sideClass){
  const charId = p.charId || p.character || 'huangdi';
  const eggName = eggNameOverride(charId);
  const char = (typeof PHYSICIAN_BY_ID !== 'undefined' && PHYSICIAN_BY_ID[charId]) || {ko:'?', han:'?'};
  const dispName = eggName ? eggName.ko : (char.ko || '?');
  const dispHan = eggName ? eggName.han : (char.han || '?');
  const meBadge = p.isMe ? ' <span class="v12-intro-me-badge">나</span>' : '';
  return `
    <div class="match-confirm-side ${sideClass} v12-intro-slot" data-uid="${esc_(p.id||'')}">
      ${charPhoto(char, size)}
      <div class="name">${esc_(p.name||'')}${meBadge}</div>
      <div class="charname han">${esc_(dispHan)}</div>
      <div class="charname-ko" style="font-size:11px;opacity:.7">${esc_(dispName)}</div>
    </div>`;
}

function show(opts){
  opts = opts || {};
  const v = document.getElementById('view'); if(!v) return;
  const parts = opts.participants || [];
  const gameLabel = opts.gameLabel || '對決';
  const subtitle = opts.subtitle || '';
  const bet = opts.bet || 0;
  const showCancel = opts.showCancel !== false;
  const n = parts.length;
  let slotsHtml = '';
  if(n <= 2){
    slotsHtml = parts.map((p,i) => _slot(p, 110, i===0?'is-me':'is-opp')).join('<div class="match-confirm-vs-han han">對</div>');
  } else if(n <= 4){
    slotsHtml = '<div class="v12-intro-grid v12-intro-grid--quad">' + parts.map(p => _slot(p, 88, '')).join('') + '</div>';
  } else {
    slotsHtml = '<div class="v12-intro-grid v12-intro-grid--many">' + parts.map(p => _slot(p, 64, '')).join('') + '</div>';
  }
  const betLine = bet > 0
    ? `<div class="view-sub">${esc_(gameLabel)} · ${bet.toLocaleString()} 氣 (에스크로)</div>`
    : `<div class="view-sub">${esc_(gameLabel)}</div>`;

  v.innerHTML = `
    <div class="match-confirm v12-intro fade-in">
      <h2 class="view-title"><span class="han">遇</span>對手出現</h2>
      ${betLine}
      <div class="match-confirm-banner">${esc_(subtitle || '매치 성공')}</div>
      <div class="match-confirm-meta">아래 「對決開始」 버튼을 눌러 시작하세요</div>
      <div class="match-confirm-vs">${slotsHtml}</div>
      <div class="match-confirm-actions">
        <button class="btn btn-gold" id="v12-intro-start" type="button">對決開始</button>
        ${showCancel ? '<button class="btn btn-o" id="v12-intro-cancel" type="button">取消</button>' : ''}
      </div>
      <div class="match-confirm-status is-waiting" id="v12-intro-status">대기 중…</div>
      <div class="match-confirm-timer" id="v12-intro-timer"></div>
    </div>`;

  const startBtn = document.getElementById('v12-intro-start');
  if(startBtn) startBtn.addEventListener('click', () => {
    startBtn.disabled = true; startBtn.textContent = '시작 중…';
    if(opts.onStart) opts.onStart();
  });
  const cancelBtn = document.getElementById('v12-intro-cancel');
  if(cancelBtn && showCancel) cancelBtn.addEventListener('click', () => {
    cancelBtn.disabled = true; cancelBtn.textContent = '취소 중…';
    if(opts.onCancel) opts.onCancel();
  });

  if(opts.autoStartMs && opts.onStart){
    const start = Date.now();
    const el = document.getElementById('v12-intro-timer');
    const tick = setInterval(() => {
      const remain = Math.max(0, opts.autoStartMs - (Date.now() - start));
      if(el) el.textContent = `자동 시작 ${Math.ceil(remain/1000)}s`;
      if(remain <= 0){
        clearInterval(tick);
        if(startBtn && !startBtn.disabled) startBtn.click();
      }
    }, 200);
  }
}

if(!document.getElementById('v12-intro-style')){
  const st = document.createElement('style');
  st.id = 'v12-intro-style';
  st.textContent = `
    .v12-intro-grid{display:grid;gap:14px;margin:18px auto;justify-content:center;align-items:center}
    .v12-intro-grid--quad{grid-template-columns:repeat(2,auto)}
    .v12-intro-grid--many{grid-template-columns:repeat(4,auto)}
    .v12-intro-slot{display:flex;flex-direction:column;align-items:center;gap:6px}
    .v12-intro-me-badge{background:#C9A227;color:#fff;font-size:10px;padding:2px 6px;border-radius:8px;margin-left:4px}
    .v12-intro .charname-ko{margin-top:2px}
  `;
  document.head.appendChild(st);
}

window.V12Intro = { show, charPhoto, eggQuote, eggNameOverride, _eggRoll, setSubjectIcon, removeSubjectIcon };
window.V12Intro_VERSION = '12.0';
})();

// ─── 좌상단 과목 아이콘 (별도 IIFE — 모든 房 진입 시 호출) ────────────────
(function(){
'use strict';
const SUBJECT_ICONS = {
  shennong:  { emoji:'📜', label:'方劑',     color:'#C9A227' },
  dongmu:    { emoji:'👅', label:'診斷',     color:'#9C3030' },
  saamdoin:  { emoji:'🪡', label:'經穴',     color:'#3A6A4A' },
  huangdi:   { emoji:'☯️', label:'預防醫學', color:'#E5C97D' },
  qibo:      { emoji:'🫀', label:'病理學',   color:'#2A7060' },
  huatuo:    { emoji:'🔬', label:'洋方病理', color:'#7A3030' },
  lindaoren: { emoji:'📡', label:'影像診斷', color:'#A580C8' },
  zhongjing: { emoji:'📖', label:'傷寒論',   color:'#5A8AB8' },
  poker:     { emoji:'🎴', label:'經穴포커', color:'#D4AF37' },
  cube:      { emoji:'🎲', label:'방미큐브', color:'#C9A227' },
  race:      { emoji:'⚡', label:'五輸레이스',color:'#3A6A4A' },
};
function setSubjectIcon(subjectId){
  const meta = SUBJECT_ICONS[subjectId];
  if(!meta) return removeSubjectIcon();
  let el = document.getElementById('v12-subject-icon');
  if(!el){
    el = document.createElement('div');
    el.id = 'v12-subject-icon';
    el.style.cssText = 'position:fixed;top:14px;left:14px;z-index:99;display:flex;align-items:center;gap:8px;padding:8px 14px 8px 10px;background:rgba(40,28,16,0.85);color:#F4E2C0;border:1px solid rgba(212,175,55,0.4);border-radius:24px;font-family:"ZCOOL XiaoWei",serif;font-size:14px;box-shadow:0 2px 12px rgba(0,0,0,0.3);backdrop-filter:blur(6px);pointer-events:none;transition:opacity .25s';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span style="font-size:20px;line-height:1">${meta.emoji}</span><span style="font-weight:600;color:${meta.color}">${meta.label}</span>`;
  el.style.opacity = '1';
}
function removeSubjectIcon(){
  const el = document.getElementById('v12-subject-icon');
  if(el){ el.style.opacity='0'; setTimeout(() => { if(el && el.parentNode) el.parentNode.removeChild(el); }, 280); }
}
// V12Intro 객체에 추가 노출
if(window.V12Intro){
  window.V12Intro.setSubjectIcon = setSubjectIcon;
  window.V12Intro.removeSubjectIcon = removeSubjectIcon;
  window.V12Intro.SUBJECT_ICONS = SUBJECT_ICONS;
}
console.log('[V12Intro] 과목 아이콘 ' + Object.keys(SUBJECT_ICONS).length + '종 로드');
})();
