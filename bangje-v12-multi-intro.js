/* bangje-v12-multi-intro.js — 멀티 게임 공통 시작 컷 + 이스터에그 v12.1
 * ============================================================================
 *  변경 (v12.1):
 *   ★ 이스터에그 1/10 굴림이 페이지 로드 시점 1회 — sessionStorage 캐시 제거.
 *     새로고침 또는 새로 들어갈 때마다 새로 굴림 → 사용자 의도 정확 반영.
 *   ★ _charPhotoMedallion 글로벌 후킹 — 메달리온이 표시되는 모든 곳에서 적용
 *     (의서궁 home·진단학·경혈학·매치 컨펌·멀티 인트로 등 전부).
 *
 *  대상:
 *    lindaoren(린도인) → 1/10 확률 간디 사진 + 비폭력 명언
 *    wuyouke(오우가)   → 1/10 확률 오우거 사진 + "우가우가"
 *
 *  외부: window.V12Intro = { show, charPhoto, eggQuote, eggNameOverride,
 *                            setSubjectIcon, removeSubjectIcon }
 *  CHANGELOG 에 표시되지 않는 숨은 기능.
 * ============================================================================ */
(function(){
'use strict';

// ─── 이스터에그 데이터 ────────────────────────────────────────────────────
const EGG_TARGETS = {
  lindaoren: {
    // Wikimedia 공용 (CC) — 직접 hotlink 가능
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Portrait_Gandhi.jpg/440px-Portrait_Gandhi.jpg',
    fallback: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Portrait_Gandhi.jpg',
    quote: {
      han: '我的生命就是我的訊息',
      ko: '내 삶이 곧 나의 메시지다',
      src: '— Mahatma Gandhi'
    },
    name_override: '간디', han_override: '甘地',
  },
  wuyouke: {
    // v14.3 패치: 사용자 제공 사진(WoW 兩頭 오우거 ─ 紅袍)으로 교체
    src: 'ogre-egg.webp',
    fallback: 'ogre-egg.webp',
    quote: {
      han: '우가우가',
      ko: '우가우가',
      src: '— 오우거'
    },
    name_override: '오우거', han_override: '吳우거',
  },
};
const EGG_CHANCE = 0.10;  // 1/10

// ─── 페이지 로드 시점 1회 굴림 (sessionStorage 캐시 X) ───────────────────
//   같은 페이지 내에서 같은 캐릭터가 여러 위치에 표시될 때 깜빡임을 방지하기 위해
//   모듈 메모리 캐시는 사용 (단, 페이지 새로고침되면 모듈이 다시 로드되므로 새로 굴림).
const _eggResult = {};  // {charId: eggData | null}
for(const charId in EGG_TARGETS){
  _eggResult[charId] = (Math.random() < EGG_CHANCE) ? EGG_TARGETS[charId] : null;
}

function getEgg(charId){
  if(_eggResult[charId] === undefined) return null;
  return _eggResult[charId];
}

function eggQuote(charId){ const e = getEgg(charId); return e ? e.quote : null; }
function eggNameOverride(charId){
  const e = getEgg(charId);
  return e ? { ko:e.name_override, han:e.han_override } : null;
}

// ─── _charPhotoMedallion 글로벌 후킹 ─────────────────────────────────────
//   기존 함수를 wrap 하여 lindaoren/wuyouke 이면서 egg 발동 시 사진을 교체.
//   동일 시그니처 유지 — 호출부 코드 수정 不要.
function _installPhotoHook(){
  if(typeof window._charPhotoMedallion !== 'function') return false;
  if(window._charPhotoMedallion._v12Hooked) return true;
  const orig = window._charPhotoMedallion;

  function hooked(charOrId, size){
    const charId = (typeof charOrId === 'string') ? charOrId : (charOrId && charOrId.id);
    const egg = charId ? getEgg(charId) : null;
    if(!egg) return orig.call(this, charOrId, size);

    // 이스터에그 발동 — 사진을 egg.src 로 교체
    const c = (typeof charOrId === 'string')
      ? (typeof PHYSICIAN_BY_ID !== 'undefined' ? PHYSICIAN_BY_ID[charOrId] : null)
      : charOrId;
    if(!c) return orig.call(this, charOrId, size);

    const sz = size || 110;
    const showName = sz >= 80;
    const nameSize = Math.max(8, Math.round(sz * 0.105));
    const pad = Math.max(2, Math.round(sz * 0.06));
    const init = (c.init || (c.han && c.han[0]) || '?');
    const initSize = showName ? Math.round(sz * 0.42) : Math.round(sz * 0.55);
    const labelEsc = `${escA(egg.name_override)} — ${escA(egg.han_override)}`;
    const onerr = `if(!this.dataset.fb){this.dataset.fb='1';this.src='${escA(egg.fallback||egg.src)}'}else{this.style.display='none'}`;

    return `<div role="img" aria-label="${labelEsc}" title="${labelEsc}" style="position:relative;display:inline-block;width:${sz}px;height:${sz}px;vertical-align:middle" data-egg="${escA(charId)}">
      <div class="cmedal cat-${escA(c.cat||'ancient')}" style="position:absolute;inset:0;width:100%;height:100%">
        <div class="cmedal-init" style="font-size:${initSize}px">${escA(init)}</div>
        ${showName ? `<div class="cmedal-name" style="font-size:${nameSize}px">${escA(egg.name_override)}</div>` : ''}
      </div>
      <img src="${escA(egg.src)}" alt="${labelEsc}" loading="lazy" decoding="async"
           onerror="${onerr}"
           class="cmedal-photo"
           style="top:${pad}px;left:${pad}px;width:calc(100% - ${pad*2}px);height:calc(100% - ${pad*2}px)">
      ${showName ? `<div style="position:absolute;left:0;right:0;bottom:0;padding:3px 2px 4px;background:linear-gradient(to bottom, transparent 0%, rgba(28,20,10,.85) 80%);color:var(--mi-w,#F4E2C0);font-size:${nameSize}px;text-align:center;font-family:var(--font-display);font-weight:600;letter-spacing:.04em;pointer-events:none;border-radius:0 0 50%/0 0 100%">${escA(egg.name_override)}</div>` : ''}
    </div>`;
  }
  hooked._v12Hooked = true;
  hooked._original = orig;
  window._charPhotoMedallion = hooked;
  return true;
}
function escA(s){ return String(s||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

// 즉시 시도 + 늦게 로드되는 케이스 대비 retry
_installPhotoHook();
setTimeout(_installPhotoHook, 200);
setTimeout(_installPhotoHook, 1000);
setTimeout(_installPhotoHook, 3000);

// ─── charPhoto API (V12Intro 명시 호출용) ────────────────────────────────
function charPhoto(charIdOrObj, size, opts){
  size = size || 110;
  opts = opts || {};
  let char = charIdOrObj;
  if(typeof charIdOrObj === 'string'){
    char = (typeof PHYSICIAN_BY_ID !== 'undefined' && PHYSICIAN_BY_ID[charIdOrObj]) ||
           (typeof PHYSICIANS !== 'undefined' && PHYSICIANS.find(p => p.id === charIdOrObj)) ||
           { id: charIdOrObj, ko:'?', han:'?' };
  }
  // opts.allowEgg === false 인 경우 원본 사용
  if(opts.allowEgg === false && window._charPhotoMedallion && window._charPhotoMedallion._original){
    return window._charPhotoMedallion._original.call(null, char, size);
  }
  // 기본은 후킹된 함수 호출 (egg 자동 적용)
  if(typeof window._charPhotoMedallion === 'function')      return window._charPhotoMedallion(char, size);
  if(typeof window._charMedallion === 'function')           return window._charMedallion(char, size);
  const init = (char.han||'?').charAt(0);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#E8C8A0;display:flex;align-items:center;justify-content:center;font-family:'ZCOOL XiaoWei',serif;font-size:${Math.round(size*0.4)}px;color:#3A1810">${init}</div>`;
}

// ─── 멀티 인트로 컷 ───────────────────────────────────────────────────────
function _slot(p, size, sideClass){
  const charId = p.charId || p.character || 'huangdi';
  const eggName = eggNameOverride(charId);
  const char = (typeof PHYSICIAN_BY_ID !== 'undefined' && PHYSICIAN_BY_ID[charId]) || {ko:'?', han:'?'};
  const dispName = eggName ? eggName.ko : (char.ko || '?');
  const dispHan = eggName ? eggName.han : (char.han || '?');
  const meBadge = p.isMe ? ' <span class="v12-intro-me-badge">나</span>' : '';
  return `
    <div class="match-confirm-side ${sideClass} v12-intro-slot" data-uid="${escA(p.id||'')}">
      ${charPhoto(char, size)}
      <div class="name">${escA(p.name||'')}${meBadge}</div>
      <div class="charname han">${escA(dispHan)}</div>
      <div class="charname-ko" style="font-size:11px;opacity:.7">${escA(dispName)}</div>
    </div>`;
}

function show(opts){
  opts = opts || {};
  const v = document.getElementById('view'); if(!v) return;
  const parts = opts.participants || opts.players || [];
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
    ? `<div class="view-sub">${escA(gameLabel)} · ${bet.toLocaleString()} 氣 (에스크로)</div>`
    : `<div class="view-sub">${escA(gameLabel)}</div>`;

  v.innerHTML = `
    <div class="match-confirm v12-intro fade-in">
      <h2 class="view-title"><span class="han">遇</span>對手出現</h2>
      ${betLine}
      <div class="match-confirm-banner">${escA(subtitle || '매치 성공')}</div>
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

function hide(){
  // V12Intro.show 는 view innerHTML 을 직접 갈아끼우므로 별도 hide 불필요. no-op 으로 호환만 유지.
}

// 인트로 컷 스타일 주입
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

window.V12Intro = {
  show, hide, charPhoto, eggQuote, eggNameOverride,
  _eggResult,    // 디버그용
  _installPhotoHook,
};
window.V12Intro_VERSION = '12.1';

})();

// ─── 좌상단 과목 아이콘 (별도 IIFE) ───────────────────────────────────────
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
  mahjong:   { emoji:'🀄', label:'方劑麻雀', color:'#1F3F2C' },
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
if(window.V12Intro){
  window.V12Intro.setSubjectIcon = setSubjectIcon;
  window.V12Intro.removeSubjectIcon = removeSubjectIcon;
  window.V12Intro.SUBJECT_ICONS = SUBJECT_ICONS;
}
console.log('[V12Intro] v12.1 — 과목 아이콘 ' + Object.keys(SUBJECT_ICONS).length + '종 로드');
})();
