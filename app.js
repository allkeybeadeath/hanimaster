/* app.js — 方劑學 v2.0
 * ============================================================================
 * 中華 帝王風 방제학 학습 PWA
 *
 * 구조 (section 헤더로 구분, ─────):
 *   1. 상수·설정 (FIREBASE_URL, EXAM_META, 등)
 *   2. 상태(S) + STORAGE 추상화 (Firebase REST + localStorage 폴백)
 *   3. 유틸 (util, toast, modal, 时间, 등)
 *   4. 메달리온 (사진+SVG 합성)
 *   5. 헤더 (등급·氣·BGM)
 *   6. BGM (Web Audio 五聲音階 古琴 합성)
 *   7. 라우팅 / 네비
 *   8. 大廳 (홈/로비) — D-N, 온라인, 피드백
 *   9. 캐릭터 picker
 *  10. 명예의 전당
 *  11. 멀티 배틀 (對決開始, 氣博 베팅)
 *  12. 통계 (전체 오답 랭킹, 기출 분석, 약재 분석)
 *  13. 처방 / 약재 (data-formulas.js 와 연동, v1 호환)
 *  14. 초기화
 * ============================================================================ */

// ───── 1. 상수·설정 ─────────────────────────────────────────────────────────
const FIREBASE_URL = 'https://hanimaster-245f6-default-rtdb.asia-southeast1.firebasedatabase.app/';
const STORAGE_KEY = 'bangje.state.v2';

// 시험일 (Asia/Seoul 기준 자정). 사용자 환경에 따라 조정.
const EXAM_DATE_ISO = '2026-05-20T00:00:00+09:00';
const EXAM_META = {
  course: '方劑學',
  examTitle: '2차 수시',
  rangeKR: '8장 보익제 · 6장 온경산한제 · 7장 표리쌍해제',
  rangeHan: '補益 · 溫經 · 表裏雙解',
};

const PRESENCE_REFRESH_MS = 30 * 1000;     // 30초마다 presence 갱신
const PRESENCE_FRESH_MS   = 90 * 1000;     // 90초 이내면 "온라인"
const BATTLE_INTRO_MS     = 5000;          // 인트로 컷 자동 진행

// ───── 2. 상태 + STORAGE ────────────────────────────────────────────────────
// 기본 상태 (사용자별 진행)
let S = {
  userId: null,           // 익명 ID (한번 생성하면 영구)
  name: '',               // 닉네임 (사용자 편집)
  character: 'qibo',      // 선택 캐릭터 id (기본 岐伯 — 학습 지도자)
  qi: 0,                  // 누적 氣 (= XP)
  unlockedDivine: [],     // 구매한 神階 id 배열
  bookmarks: [],          // 처방 북마크
  wrongIds: [],           // 오답 id 배열 (개인용)
  knownIds: [],           // 마스터한 처방
  lastFcIdx: 0, fcMode: 'action',
  quizScope: 'all', lastTab: 'home',
  battleHistory: [],      // 최근 배틀 결과 (최대 20)
};

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      S = Object.assign(S, parsed);
    }
  }catch(_){}
  if(!S.userId) S.userId = 'u_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
  if(!S.name)   S.name = '익명의'+(['醫工','學徒','弟子','선비'][Math.floor(Math.random()*4)]);
}
let _saveTimer = null;
function saveState(){
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }catch(_){}
  }, 250);
}

// Firebase REST 헬퍼 — Greek v60 패턴 단순화
const FB = (() => {
  if(!FIREBASE_URL) return null;
  const base = FIREBASE_URL.replace(/\/$/, '');
  return {
    base,
    get: async (path) => {
      try{
        const r = await fetch(`${base}/${path}.json`);
        if(!r.ok) return null;
        return await r.json();
      }catch(_){ return null; }
    },
    put: async (path, val) => {
      try{
        const r = await fetch(`${base}/${path}.json`, {
          method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(val),
        });
        return r.ok;
      }catch(_){ return false; }
    },
    push: async (path, val) => {
      try{
        const r = await fetch(`${base}/${path}.json`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(val),
        });
        if(!r.ok) return null;
        const j = await r.json();
        return j.name || null;  // pushId
      }catch(_){ return null; }
    },
    patch: async (path, val) => {
      try{
        const r = await fetch(`${base}/${path}.json`, {
          method:'PATCH', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(val),
        });
        return r.ok;
      }catch(_){ return false; }
    },
    del: async (path) => {
      try{ await fetch(`${base}/${path}.json`, {method:'DELETE'}); return true; }
      catch(_){ return false; }
    },
  };
})();

// ───── 3. 유틸 ─────────────────────────────────────────────────────────────
const view = document.getElementById('view');
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
function esc(s){ return String(s||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

function toast(msg, kind){
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.className = 'show' + (kind === 'gold' ? ' gold' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = ''; }, 2400);
}

function openModal(html){
  const slot = document.getElementById('modal-slot');
  slot.innerHTML = `<div class="modal-back" id="modal-back">
    <div class="modal">
      <button class="x" onclick="closeModal()" aria-label="닫기">×</button>
      ${html}
    </div>
  </div>`;
  document.getElementById('modal-back').addEventListener('click', e => {
    if(e.target.id === 'modal-back') closeModal();
  });
}
function closeModal(){ document.getElementById('modal-slot').innerHTML = ''; }
window.closeModal = closeModal;

// 시험 D-N 계산
function daysToExam(){
  const exam = new Date(EXAM_DATE_ISO).getTime();
  const now = Date.now();
  const ms = exam - now;
  const d = Math.ceil(ms / (24*60*60*1000));
  return d;
}
function fmtDday(){
  const d = daysToExam();
  if(d > 0)  return `D-${d}`;
  if(d === 0) return 'D-Day';
  return `D+${-d}`;
}

// 짧은 시간 포맷
function ago(ts){
  const d = Date.now() - ts;
  if(d < 60000) return '방금';
  if(d < 3600000) return Math.floor(d/60000) + '분 전';
  if(d < 86400000) return Math.floor(d/3600000) + '시간 전';
  return Math.floor(d/86400000) + '일 전';
}

// ───── 4. 메달리온 (사진+SVG 합성) ─────────────────────────────────────────
// charOrId: 객체 또는 id 문자열
// size: 픽셀
// 사진 있으면 위에 덮고 onerror 시 SVG 폴백
function _charMedallion(charOrId, size){
  const c = (typeof charOrId === 'string') ? PHYSICIAN_BY_ID[charOrId] : charOrId;
  if(!c){
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="display:inline-block;vertical-align:middle"><circle cx="50" cy="50" r="48" fill="#8B6B45"/><text x="50" y="68" text-anchor="middle" font-family="serif" font-size="44" font-weight="700" fill="#F4E8D8">?</text></svg>`;
  }
  const p = CHAR_PALETTES[c.cat] || CHAR_PALETTES.ancient;
  const showName = size >= 80;
  const gradId = '_g_' + c.id + '_' + size + '_' + Math.floor(Math.random()*100000).toString(36);
  const initY = showName ? 55 : 64;
  const initSize = showName ? 40 : 50;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(c.ko)} (${esc(c.han)})" style="display:inline-block;vertical-align:middle">
    <defs><radialGradient id="${gradId}" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="${p.bg1}"/><stop offset="100%" stop-color="${p.bg2}"/>
    </radialGradient></defs>
    <circle cx="50" cy="50" r="49" fill="${p.ring}"/>
    <circle cx="50" cy="50" r="46" fill="url(#${gradId})"/>
    <g fill="${p.ring}" opacity="0.6">${[0,45,90,135,180,225,270,315].map(deg=>{
      const rad=(deg-90)*Math.PI/180; const x=50+Math.cos(rad)*43; const y=50+Math.sin(rad)*43;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5"/>`;
    }).join('')}</g>
    <text x="50" y="${initY}" text-anchor="middle" font-family="'ZCOOL XiaoWei',serif" font-size="${initSize}" font-weight="700" fill="${p.fg}">${c.init||c.han[0]||'?'}</text>
    ${showName?`<path d="M 14,82 Q 50,90 86,82 L 86,90 Q 50,98 14,90 Z" fill="${p.initBg}" opacity="0.92"/><text x="50" y="91" text-anchor="middle" font-family="serif" font-size="9" font-weight="600" letter-spacing="0.5" fill="${p.initFg}">${esc(c.ko)}</text>`:''}
  </svg>`;
}
window._charMedallion = _charMedallion;

function _charPhotoMedallion(charOrId, size){
  const c = (typeof charOrId === 'string') ? PHYSICIAN_BY_ID[charOrId] : charOrId;
  if(!c) return _charMedallion(charOrId, size);
  const imgs = (typeof CHARACTER_IMAGES !== 'undefined') ? CHARACTER_IMAGES : {};
  const meta = imgs[c.id];
  if(!meta || !meta.url) return _charMedallion(c, size);
  const uid = 'cpm_' + c.id + '_' + size + '_' + Math.floor(Math.random()*100000).toString(36);
  const svg = _charMedallion(c, size);
  const pad = Math.max(2, Math.round(size * 0.04));
  const ring = (CHAR_PALETTES[c.cat] || CHAR_PALETTES.ancient).ring;
  const labelEsc = `${esc(c.ko)} — ${esc(c.han)}`;
  return `<div id="${uid}" role="img" aria-label="${labelEsc}" title="${labelEsc} · ${esc(meta.caption||'')}" style="position:relative;display:inline-block;width:${size}px;height:${size}px;vertical-align:middle">
    <div style="position:absolute;inset:0">${svg}</div>
    <img src="${esc(meta.url)}" alt="${labelEsc}" loading="lazy" decoding="async"
         onerror="this.style.display='none'"
         style="position:absolute;inset:${pad}px;width:calc(100% - ${pad*2}px);height:calc(100% - ${pad*2}px);border-radius:50%;object-fit:cover;border:2px solid ${ring};box-shadow:0 1px 4px rgba(0,0,0,.25);background:var(--mi-w)">
    ${size>=80?`<div style="position:absolute;left:0;right:0;bottom:0;padding:3px 4px;background:linear-gradient(to bottom, transparent 0%, rgba(28,20,10,.92) 65%);color:var(--mi-w);font-size:${Math.max(9,Math.round(size*0.11))}px;text-align:center;font-family:var(--font-display);font-weight:600;letter-spacing:.04em;border-radius:0 0 50% 50%/0 0 100% 100%;pointer-events:none">${esc(c.ko)}</div>`:''}
  </div>`;
}
window._charPhotoMedallion = _charPhotoMedallion;

// ───── 太極 / 八卦 SVG (장식) ───────────────────────────────────────────────
function taijiSVG(size, spin){
  const cls = spin ? 'taiji spin' : 'taiji';
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 100 100">
    <defs>
      <clipPath id="tj_l"><path d="M 50,2 A 48,48 0 0 0 50,98 Z"/></clipPath>
      <clipPath id="tj_r"><path d="M 50,2 A 48,48 0 0 1 50,98 Z"/></clipPath>
    </defs>
    <circle cx="50" cy="50" r="48" fill="#fff" stroke="#1C140A" stroke-width="2"/>
    <path d="M 50,2 A 48,48 0 0 1 50,98 A 24,24 0 0 1 50,50 A 24,24 0 0 0 50,2 Z" fill="#1C140A"/>
    <circle cx="50" cy="26" r="6" fill="#fff"/>
    <circle cx="50" cy="74" r="6" fill="#1C140A"/>
    <circle cx="50" cy="50" r="48" fill="none" stroke="#9C3030" stroke-width="2"/>
  </svg>`;
}

// 八卦 — 8 trigrams in a circle (decoration)
function baguaSVG(size){
  // 8 trigrams (binary 0..7) — 3 lines each, broken = yin, solid = yang
  const trigrams = [
    [1,1,1], // 乾 (天)  ☰
    [1,1,0], // 兌 (澤)  ☱
    [1,0,1], // 離 (火)  ☲
    [1,0,0], // 震 (雷)  ☳
    [0,1,1], // 巽 (風)  ☴
    [0,1,0], // 坎 (水)  ☵
    [0,0,1], // 艮 (山)  ☶
    [0,0,0], // 坤 (地)  ☷
  ];
  const r = size/2;
  const items = trigrams.map((t, i) => {
    const ang = (i * 45 - 90) * Math.PI / 180;
    const cx = r + Math.cos(ang) * r * 0.78;
    const cy = r + Math.sin(ang) * r * 0.78;
    return t.map((line, li) => {
      const yOff = (li - 1) * 4;
      if(line) return `<rect x="${cx-7}" y="${cy+yOff-1}" width="14" height="2" fill="#1C140A"/>`;
      return `<rect x="${cx-7}" y="${cy+yOff-1}" width="6" height="2" fill="#1C140A"/><rect x="${cx+1}" y="${cy+yOff-1}" width="6" height="2" fill="#1C140A"/>`;
    }).join('');
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="opacity:.55">${items}</svg>`;
}

// ───── 5. 헤더 갱신 ─────────────────────────────────────────────────────────
function refreshHeader(){
  const rk = getRank(S.qi);
  $('#rank-seal').textContent = rk.seal;
  $('#rank-seal').style.background = rk.color;
  $('#rank-name').textContent = rk.ko;
  $('#qi-amt').textContent = S.qi.toLocaleString();
  $('#user-name-mini').textContent = S.name || '黃帝의 방';
  // BGM 아이콘 상태
  $('#bgm-icon').textContent = bgm.on ? '♫' : '♪';
  $('#bgm-icon').style.opacity = bgm.on ? '1' : '.55';
}

// ───── 6. BGM (Web Audio 五聲音階 古琴) ─────────────────────────────────────
// 中華 古風 BGM — Web Audio API 로 五聲音階 (宫商角徵羽) 합성
// 古琴 시뮬레이션: sine + saw mix, 부드러운 attack, 긴 decay
const bgm = {
  ctx: null, master: null, on: false, timer: null, t0: 0,
  scale: [261.63, 293.66, 329.63, 392.00, 440.00],  // C D E G A (penta major)
  bass:  [130.81, 196.00],  // C G drone

  init(){
    if(this.ctx) return;
    try{
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      // 약간의 reverb (느낌 살리기 위한 단순 delay 체인)
      const delay = this.ctx.createDelay();
      delay.delayTime.value = 0.25;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.35;
      delay.connect(fb); fb.connect(delay); delay.connect(this.master);
      this.delayIn = delay;
    }catch(_){ this.ctx = null; }
  },

  pluck(freq, when, dur, gain){
    if(!this.ctx) return;
    const t = when;
    // 두 개의 oscillator 합성 (sine + triangle) — 古琴 느낌
    const o1 = this.ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = this.ctx.createOscillator();
    o2.type = 'triangle'; o2.frequency.value = freq * 2;  // 옥타브 위 약하게
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain || 0.18, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.30;  // 옥타브 위 줄이기
    o2.connect(g2); g2.connect(g);
    o1.connect(g);
    g.connect(this.master);
    g.connect(this.delayIn);
    o1.start(t); o1.stop(t + dur + 0.05);
    o2.start(t); o2.stop(t + dur + 0.05);
  },

  // 古琴 멜로디 패턴 — 五聲音階 무작위, 4박자 1마디 × N마디 반복
  schedule(){
    if(!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const bpm = 70;
    const beat = 60 / bpm;
    const bar = beat * 4;
    const numBars = 4;  // 4마디 패턴
    for(let b = 0; b < numBars; b++){
      const tb = t + b * bar;
      // 4박자 멜로디 — 五聲音階에서 무작위
      for(let i = 0; i < 4; i++){
        const note = this.scale[Math.floor(Math.random() * this.scale.length)];
        const oct = Math.random() < 0.3 ? 2 : 1;  // 30% 옥타브 위
        this.pluck(note * oct, tb + i * beat, beat * 1.3, 0.15 + Math.random() * 0.06);
      }
      // 드론 베이스 — 매 마디 1박
      const bass = this.bass[b % 2];
      this.pluck(bass, tb, beat * 3, 0.13);
    }
    // 다음 schedule
    this.timer = setTimeout(() => this.schedule(), bar * numBars * 1000 - 200);
  },

  start(){
    this.init();
    if(!this.ctx){ toast('이 기기는 BGM 미지원'); return; }
    if(this.ctx.state === 'suspended') this.ctx.resume();
    this.on = true;
    this.schedule();
    refreshHeader();
  },
  stop(){
    this.on = false;
    clearTimeout(this.timer);
    refreshHeader();
  },
  toggle(){ this.on ? this.stop() : this.start(); }
};
window.bgm = bgm;

// ───── 7. 라우팅 ─────────────────────────────────────────────────────────────
function setTab(name){
  S.lastTab = name; saveState();
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  view.scrollTop = 0; window.scrollTo({top:0, behavior:'instant'});
  const r = ROUTES[name] || ROUTES.home;
  view.innerHTML = '';
  r();
  // 페이지 진입 시 사용자 활동 갱신
  if(FB && S.userId) recordPresence();
}
window.setTab = setTab;

const ROUTES = {
  home: renderHome,
  formula: renderFormulas,
  herb: renderHerbs,
  quiz: renderQuiz,
  stats: renderStats,
  hall: renderHall,
};

// ───── 8. 大廳 (홈/로비) ─────────────────────────────────────────────────────
function renderHome(){
  const d = daysToExam();
  const ddayText = d > 0 ? `D-${d}` : (d === 0 ? 'D-Day' : `D+${-d}`);
  const ddayHan = d > 0 ? `試前 ${d}日` : (d === 0 ? '應試之日' : `試後 ${-d}日`);
  const rk = getRank(S.qi);
  const nxt = getNextRank(S.qi);
  const prog = getRankProgress(S.qi);

  view.innerHTML = `
    <!-- D-N 배너 -->
    <div class="dday-banner fade-in">
      <div class="label">${esc(EXAM_META.course)} · ${esc(EXAM_META.examTitle)}</div>
      <div class="big">${ddayText}<span class="dash">·</span><span style="font-size:.5em;letter-spacing:.04em;vertical-align:middle">${esc(ddayHan)}</span></div>
      <div class="meta">
        <span class="han">${esc(EXAM_META.rangeHan)}</span> &nbsp;·&nbsp; ${esc(EXAM_META.rangeKR)}
      </div>
    </div>

    <!-- 캐릭터 인사 (큰 메달리온 + 등급 진행) -->
    <div class="card imperial fade-in" id="hello-card">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="flex-shrink:0">${_charPhotoMedallion(S.character, 80)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="seal-stamp tiny" style="background:${rk.color}">${rk.seal}</span>
            <span class="seal" style="font-size:18px;font-weight:600">${esc(S.name)}</span>
            <span style="font-size:11px;color:var(--gutong)" class="han">${esc(rk.han)}·${esc(rk.ko)}</span>
            <button class="btn btn-sm btn-ghost" id="edit-name-btn" type="button" style="margin-left:auto">이름</button>
          </div>
          <div style="font-size:12.5px;color:var(--mo-l);margin-top:4px">
            누적 <b class="seal" style="color:var(--zhusha-d)">${S.qi.toLocaleString()} 氣</b>
            ${nxt ? `· 다음 <span class="han">${esc(nxt.han)}</span>까지 ${(nxt.cost - S.qi).toLocaleString()} 氣` : '· <b>최고 등급</b>'}
          </div>
          <div class="rank-bar"><div class="rank-bar-fill" style="width:${(prog*100).toFixed(1)}%"></div></div>
        </div>
      </div>
    </div>

    <!-- 학습 메뉴 타일 -->
    <div class="tile-grid fade-in">
      <button class="tile" type="button" onclick="setTab('formula')">
        <span class="han">方劑</span><span class="ttl">처방</span>
        <span class="desc">24 처방 카드 · 작용·구성·적응증</span>
      </button>
      <button class="tile" type="button" onclick="setTab('quiz')">
        <span class="han">問答</span><span class="ttl">기출·암기</span>
        <span class="desc">작년 기출 · 자동 객관식 · 오답함</span>
      </button>
      <button class="tile" type="button" onclick="setTab('herb')">
        <span class="han">本草</span><span class="ttl">약재</span>
        <span class="desc">68 약재 · 처방 역인덱스</span>
      </button>
      <button class="tile" type="button" onclick="setTab('stats')">
        <span class="han">析究</span><span class="ttl">통계·분석</span>
        <span class="desc">전체 오답 랭킹 · 기출·약재 시각화</span>
      </button>
      <button class="tile gold wide" type="button" onclick="setTab('hall')">
        <span class="han">譽 · 對決</span><span class="ttl">명예의 전당 · 멀티 對決</span>
        <span class="desc">9 等級 (賓醫→眞人) · 50 의가 · 氣博 베팅 배틀</span>
      </button>
    </div>

    <!-- 온라인 학습자 -->
    <div class="card fade-in" id="presence-card">
      <div class="card-title">
        <span class="han">同學</span> 함께 학습 중 ·
        <span id="presence-count" style="color:var(--feicui);font-weight:700">…</span>명
      </div>
      <div class="presence-list" id="presence-list">
        <span style="font-size:11.5px;color:var(--gutong)">불러오는 중…</span>
      </div>
    </div>

    <!-- 건의사항 -->
    <div class="card fade-in">
      <div class="card-title"><span class="han">建議</span> 건의사항·피드백</div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:6px">버그·개선 의견·요청 등 자유롭게.</div>
      <div class="feedback-form">
        <textarea id="fb-msg" placeholder="자유롭게 적어주세요…" maxlength="500"></textarea>
        <div style="display:flex;gap:6px;justify-content:flex-end">
          <button class="btn btn-sm btn-o" type="button" id="fb-refresh">새로고침</button>
          <button class="btn btn-sm" type="button" id="fb-send">보내기</button>
        </div>
      </div>
      <div class="feedback-list" id="fb-list">
        <div style="font-size:11.5px;color:var(--gutong);text-align:center;padding:8px">불러오는 중…</div>
      </div>
    </div>

    <!-- 학습 진행 통계 -->
    <div class="card fade-in">
      <div class="card-title"><span class="han">進度</span> 나의 학습 진행</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;margin-top:4px">
        <div><div class="seal" style="font-size:22px;color:var(--zhusha)">${(S.knownIds||[]).length}</div><div style="font-size:11px;color:var(--mo-l)">마스터</div></div>
        <div><div class="seal" style="font-size:22px;color:var(--gutong)">${(S.bookmarks||[]).length}</div><div style="font-size:11px;color:var(--mo-l)">북마크</div></div>
        <div><div class="seal" style="font-size:22px;color:var(--zhusha-d)">${(S.wrongIds||[]).length}</div><div style="font-size:11px;color:var(--mo-l)">오답</div></div>
      </div>
    </div>
  `;

  // 이름 편집
  $('#edit-name-btn').addEventListener('click', () => {
    openModal(`
      <h3 class="seal" style="margin:0 0 10px;color:var(--zhusha-d)">닉네임 변경</h3>
      <div style="font-size:12px;color:var(--mo-l);margin-bottom:8px">멀티 對決·명예의 전당에서 표시됩니다.</div>
      <label>닉네임</label>
      <input id="name-input" value="${esc(S.name)}" maxlength="20">
      <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:12px">
        <button class="btn btn-o btn-sm" onclick="closeModal()">취소</button>
        <button class="btn btn-sm" id="name-save">저장</button>
      </div>
    `);
    $('#name-save').addEventListener('click', () => {
      const v = $('#name-input').value.trim().slice(0,20);
      if(!v) return toast('이름을 입력하세요');
      S.name = v; saveState(); refreshHeader();
      closeModal(); toast('저장됨','gold');
      renderHome();
    });
  });

  // 피드백 send / refresh
  $('#fb-send').addEventListener('click', sendFeedback);
  $('#fb-refresh').addEventListener('click', loadFeedback);

  // presence + 피드백 비동기 로드
  loadPresenceList();
  loadFeedback();
}

// ─ presence ─
let _presenceTimer = null;
async function recordPresence(){
  if(!FB) return;
  const p = {
    name: S.name || '익명',
    character: S.character,
    qi: S.qi,
    ts: Date.now(),
  };
  // 우선 즉시 1회 기록
  await FB.put(`presence/${S.userId}`, p);
  // 주기적 갱신 타이머 (중복 셋업 방지)
  if(!_presenceTimer){
    _presenceTimer = setInterval(async () => {
      try{ await FB.put(`presence/${S.userId}`, {...p, ts: Date.now()}); }catch(_){}
    }, PRESENCE_REFRESH_MS);
  }
}

async function loadPresenceList(){
  const elList = $('#presence-list');
  const elCount = $('#presence-count');
  if(!elList || !FB){ if(elList) elList.innerHTML='<span style="font-size:11.5px;color:var(--gutong)">오프라인</span>'; return; }
  const all = await FB.get('presence');
  if(!all){ elList.innerHTML='<span style="font-size:11.5px;color:var(--gutong)">아무도 없음</span>'; if(elCount) elCount.textContent='0'; return; }
  const now = Date.now();
  const fresh = Object.entries(all)
    .map(([uid, p]) => ({uid, ...p}))
    .filter(p => (now - (p.ts||0)) < PRESENCE_FRESH_MS)
    .sort((a,b) => (b.ts||0) - (a.ts||0));
  if(elCount) elCount.textContent = fresh.length;
  if(fresh.length === 0){
    elList.innerHTML = '<span style="font-size:11.5px;color:var(--gutong)">현재 아무도 학습 중이 아닙니다.</span>';
    return;
  }
  elList.innerHTML = fresh.slice(0, 24).map(p => {
    const isMe = p.uid === S.userId;
    const med = _charMedallion(p.character || 'qibo', 22);
    return `<div class="presence-chip" title="${esc(p.character||'')} · ${ago(p.ts||0)}">
      <span class="dot"></span>${med}<span class="nm">${esc(p.name||'익명')}</span>
      ${isMe?'<span style="font-size:9.5px;color:var(--zhusha)">(나)</span>':''}
    </div>`;
  }).join('');
}

// ─ feedback ─
async function sendFeedback(){
  if(!FB){ toast('네트워크 미지원'); return; }
  const msg = $('#fb-msg').value.trim();
  if(!msg){ toast('내용을 입력하세요'); return; }
  if(msg.length > 500){ toast('500자 이하'); return; }
  $('#fb-send').disabled = true;
  const ok = await FB.push('feedback', {
    name: S.name || '익명',
    msg,
    ts: Date.now(),
    userId: S.userId,
  });
  $('#fb-send').disabled = false;
  if(ok){ $('#fb-msg').value = ''; toast('전송됨','gold'); loadFeedback(); }
  else   { toast('전송 실패'); }
}

async function loadFeedback(){
  const el = $('#fb-list'); if(!el || !FB) return;
  const all = await FB.get('feedback');
  if(!all){ el.innerHTML = '<div style="font-size:11.5px;color:var(--gutong);text-align:center;padding:8px">아직 피드백이 없습니다.</div>'; return; }
  const items = Object.values(all).sort((a,b) => (b.ts||0) - (a.ts||0)).slice(0, 12);
  el.innerHTML = items.map(it => `
    <div class="feedback-item">
      <span class="who">${esc(it.name||'익명')}</span>
      <span>${esc(it.msg||'')}</span>
      <span class="when">${ago(it.ts||0)}</span>
    </div>
  `).join('');
}

// ───── 9. 캐릭터 picker ─────────────────────────────────────────────────────
function openCharacterPicker(){
  const cur = S.character;
  const grouped = {};
  PHYSICIANS.forEach(p => { (grouped[p.cat] ||= []).push(p); });
  const order = ['divine','ancient','tang','song','jinyuan','ming','qing','late','korean','gag'];
  let html = `
    <h3 class="seal" style="margin:0 0 4px;color:var(--zhusha-d);font-size:20px">캐릭터 선택</h3>
    <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:10px">총 ${PHYSICIANS.length}인 · 神階는 누적 氣로 잠금 해제</div>
  `;
  for(const cat of order){
    const list = grouped[cat]; if(!list) continue;
    html += `<div style="margin-top:14px;display:flex;align-items:center;gap:6px">
      <span class="han" style="font-size:13px;color:var(--zhusha-d);font-weight:700;letter-spacing:.08em">${esc(CAT_LABELS[cat]||cat)}</span>
      <span style="font-size:10.5px;color:var(--gutong)">${list.length}人</span>
      <div style="flex:1;height:1px;background:linear-gradient(90deg, var(--gutong), transparent)"></div>
    </div>`;
    html += `<div class="char-grid">`;
    for(const p of list){
      const locked = (cat === 'divine') && (S.qi < (p.cost||999) && !S.unlockedDivine.includes(p.id));
      const sel = p.id === cur;
      html += `<button class="char-cell ${sel?'selected':''} ${locked?'locked':''}" type="button" data-id="${p.id}">
        ${locked?`<span class="lock-badge">🔒 ${p.cost} 氣</span>`:''}
        <div>${_charPhotoMedallion(p, 72)}</div>
        <span class="nm">${esc(p.ko)}</span>
        <span class="han">${esc(p.han)}</span>
        <span class="work">${esc(p.work_han)}<br>${esc(p.work_ko)}</span>
      </button>`;
    }
    html += `</div>`;
  }
  openModal(html);
  $$('.char-cell').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const p = PHYSICIAN_BY_ID[id]; if(!p) return;
      if(p.cat === 'divine' && S.qi < (p.cost||999) && !S.unlockedDivine.includes(id)){
        // 구매 다이얼로그
        return openPurchaseDialog(p);
      }
      S.character = id; saveState(); refreshHeader();
      toast(`캐릭터 변경: ${p.ko} (${p.han})`,'gold');
      closeModal();
      if(S.lastTab === 'home') renderHome();
      else if(S.lastTab === 'hall') renderHall();
    });
  });
}
window.openCharacterPicker = openCharacterPicker;

function openPurchaseDialog(p){
  closeModal();
  const cost = p.cost || 999;
  const can = S.qi >= cost;
  openModal(`
    <h3 class="seal" style="margin:0 0 6px;color:var(--zhusha-d)">${esc(p.han)} 잠금 해제</h3>
    <div style="text-align:center;margin:12px 0">${_charPhotoMedallion(p, 120)}</div>
    <div style="text-align:center;font-size:13px;color:var(--mo-l);margin-bottom:6px">${esc(p.ko)} · ${esc(p.work_han)}</div>
    <div style="text-align:center;font-size:11.5px;color:var(--gutong);font-style:italic;margin-bottom:14px">${esc(p.ep||'')}</div>
    <div style="background:var(--mi);padding:10px;border-radius:6px;text-align:center">
      필요 氣: <b class="seal" style="color:var(--zhusha-d);font-size:18px">${cost.toLocaleString()}</b><br>
      현재 氣: <b class="seal" style="color:var(--gutong)">${S.qi.toLocaleString()}</b>
    </div>
    <div style="display:flex;gap:6px;justify-content:center;margin-top:14px">
      <button class="btn btn-o" onclick="closeModal()">취소</button>
      <button class="btn ${can?'':'btn-ghost'}" id="purchase-btn" ${can?'':'disabled'}>
        ${can?'잠금 해제 (氣 차감)':`${(cost - S.qi).toLocaleString()} 氣 부족`}
      </button>
    </div>
  `);
  $('#purchase-btn').addEventListener('click', () => {
    if(S.qi < cost) return;
    S.qi -= cost;
    S.unlockedDivine.push(p.id);
    S.character = p.id;
    saveState(); refreshHeader();
    closeModal();
    toast(`${p.han} 잠금 해제!`,'gold');
    setTimeout(() => openCharacterPicker(), 300);
  });
}

// ───── 10. 명예의 전당 ──────────────────────────────────────────────────────
function renderHall(){
  const rk = getRank(S.qi);
  const nxt = getNextRank(S.qi);
  const prog = getRankProgress(S.qi);
  const cur = PHYSICIAN_BY_ID[S.character] || PHYSICIANS[0];

  let html = `
    <h2 class="view-title fade-in"><span class="han">譽</span>명예의 전당</h2>
    <div class="view-sub">9 等級 · 누적 氣 기준 자동 승급</div>

    <!-- 캐릭터 + 등급 큰 카드 -->
    <div class="card imperial fade-in" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="flex-shrink:0;cursor:pointer" onclick="openCharacterPicker()" title="캐릭터 변경">${_charPhotoMedallion(cur, 96)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--font-display);font-size:20px;color:var(--mo)">${esc(S.name)}</div>
          <div style="font-size:13px;color:var(--gutong);margin-top:2px"><span class="han">${esc(cur.han)}</span> · ${esc(cur.ko)}</div>
          <div style="font-size:10.5px;color:var(--gutong);margin-top:1px">${esc(cur.work_han)}<br>${esc(cur.work_ko)}</div>
        </div>
        <div style="flex-shrink:0;text-align:center">
          <span class="seal-stamp big" style="background:${rk.color}">${rk.seal}</span>
          <div style="font-size:11px;color:var(--mo-l);margin-top:4px"><span class="han">${esc(rk.han)}</span><br>${esc(rk.ko)}</div>
        </div>
      </div>
      <div style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--mo-l)">
          <span><b class="seal" style="color:var(--zhusha-d);font-size:14px">${S.qi.toLocaleString()}</b> 氣</span>
          ${nxt?`<span>다음: <b class="han">${esc(nxt.han)}</b> (${nxt.cost.toLocaleString()} 氣)</span>`:`<span><b>최고 등급</b></span>`}
        </div>
        <div class="rank-bar"><div class="rank-bar-fill" style="width:${(prog*100).toFixed(1)}%"></div></div>
      </div>
    </div>

    <!-- 對決 入口 -->
    <div class="card gold fade-in" style="cursor:pointer" onclick="openBattleLobby()">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="seal-stamp" style="background:var(--zhusha)">對</div>
        <div style="flex:1">
          <div style="font-family:var(--font-display);font-size:16px;color:var(--zhusha-d)">멀티 對決 · 氣博</div>
          <div style="font-size:11.5px;color:var(--mo-l);margin-top:2px">2~6인 · 4단계 베팅 · 제로섬 氣 쟁탈</div>
        </div>
        <div style="font-size:18px;color:var(--zhusha)">▶</div>
      </div>
    </div>

    <!-- 등급 사다리 -->
    <div class="card fade-in" style="margin-top:14px">
      <div class="card-title"><span class="han">階梯</span> 등급 사다리</div>
      ${RANKS.map((r,i) => {
        const reached = S.qi >= r.cost;
        const current = r.id === rk.id;
        return `<div style="display:flex;align-items:center;gap:10px;padding:7px 4px;${current?'background:#FFF8E0;border-radius:6px':''}">
          <span class="seal-stamp tiny" style="background:${r.color};${reached?'':'opacity:.35'}">${r.seal}</span>
          <div style="flex:1">
            <div style="font-family:var(--font-display);font-size:14px;color:${reached?'var(--mo)':'var(--gutong)'}">${esc(r.han)} <span style="font-size:11.5px;color:var(--mo-l);font-family:var(--font-body)">${esc(r.ko)}</span></div>
            <div style="font-size:10.5px;color:var(--gutong);margin-top:1px">${esc(r.desc)}</div>
          </div>
          <span style="font-size:11.5px;color:${reached?'var(--zhusha-d)':'var(--gutong)'};font-family:var(--font-display)">${r.cost.toLocaleString()} 氣</span>
        </div>`;
      }).join('')}
      <div style="font-size:10.5px;color:var(--gutong);margin-top:8px;font-style:italic;line-height:1.5">
        出典: 黃帝內經 素問 上古天眞論 — "上古有眞人者… 中古之時，有至人者… 其次有聖人者… 其次有賢人者"
      </div>
    </div>

    <!-- 글로벌 랭킹 -->
    <div class="card fade-in" style="margin-top:14px">
      <div class="card-title"><span class="han">榜單</span> 학습자 氣 랭킹 (전체)</div>
      <div id="global-rank-list" style="font-size:12.5px;color:var(--mo-l);text-align:center;padding:10px">불러오는 중…</div>
    </div>

    <!-- 최근 對決 기록 -->
    ${(S.battleHistory && S.battleHistory.length > 0) ? `
    <div class="card fade-in" style="margin-top:14px">
      <div class="card-title"><span class="han">戰績</span> 최근 對決 (${S.battleHistory.length}/20)</div>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:11.5px">
        ${S.battleHistory.slice(0, 10).map(h => `
          <div style="display:flex;justify-content:space-between;padding:5px 6px;background:var(--mi-w);border-radius:4px">
            <span><span class="han">${h.win?'勝':'敗'}</span> vs ${esc(h.opponentName||'?')}</span>
            <span style="color:${h.deltaQi>=0?'var(--feicui)':'var(--zhusha)'}">${h.deltaQi>=0?'+':''}${h.deltaQi} 氣</span>
            <span style="color:var(--gutong)">${ago(h.ts||0)}</span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}
  `;
  view.innerHTML = html;
  loadGlobalRank();
}

async function loadGlobalRank(){
  const el = $('#global-rank-list'); if(!el || !FB) return;
  const all = await FB.get('presence');
  if(!all){ el.innerHTML = '아직 학습자가 없습니다.'; return; }
  const list = Object.entries(all)
    .map(([uid, p]) => ({uid, ...p}))
    .sort((a,b) => (b.qi||0) - (a.qi||0))
    .slice(0, 20);
  el.innerHTML = list.map((p, i) => {
    const r = getRank(p.qi||0);
    const med = _charMedallion(p.character || 'qibo', 26);
    const isMe = p.uid === S.userId;
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 6px;${isMe?'background:#FFF8E0;':''}border-radius:4px;text-align:left">
      <span style="width:22px;text-align:center;font-family:var(--font-display);font-size:14px;color:${i<3?'var(--zhusha-d)':'var(--gutong)'}">${i+1}</span>
      ${med}
      <span style="flex:1;font-weight:600;color:var(--mo)">${esc(p.name||'익명')}${isMe?' (나)':''}</span>
      <span class="han" style="font-size:11px;color:${r.color}">${esc(r.han)}</span>
      <span class="seal" style="font-size:12px;color:var(--zhusha-d)">${(p.qi||0).toLocaleString()}</span>
    </div>`;
  }).join('');
}

// ───── 11. 멀티 對決 (氣博 베팅) ────────────────────────────────────────────
// 베팅 레벨
const BET_LEVELS = [
  { id:'small',  han:'小博', ko:'소박', pct:0.05, min:20,  desc:'5% · 최소 20 氣' },
  { id:'medium', han:'中博', ko:'중박', pct:0.15, min:50,  desc:'15% · 최소 50 氣' },
  { id:'large',  han:'大博', ko:'대박', pct:0.30, min:150, desc:'30% · 최소 150 氣' },
  { id:'allin',  han:'賭命', ko:'도명', pct:0.50, min:500, desc:'50% · 최소 500 氣' },
];
function calcBet(level){
  const lv = BET_LEVELS.find(l => l.id === level) || BET_LEVELS[0];
  const pct = Math.floor(S.qi * lv.pct);
  return Math.max(lv.min, pct);
}

// 배틀 상태 (메모리)
let _battle = null;

function openBattleLobby(){
  // 입장 가능 베팅 레벨 필터링
  const opts = BET_LEVELS.map(l => {
    const bet = calcBet(l.id);
    const can = S.qi >= bet;
    return {...l, bet, can};
  });
  let selected = opts.find(o => o.can)?.id || 'small';
  view.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">對決</span>멀티 배틀</h2>
    <div class="view-sub">2~6인 · 같은 베팅 레벨끼리 매칭 · 승자가 패자의 氣 획득</div>

    <div class="card imperial fade-in">
      <div class="card-title"><span class="han">氣博</span> 베팅 단계</div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:6px">현재 보유: <b class="seal" style="color:var(--zhusha-d)">${S.qi.toLocaleString()} 氣</b></div>
      <div class="bet-grid" id="bet-grid">
        ${opts.map(o => `
          <button class="bet-cell ${o.id===selected?'selected':''} ${o.can?'':'locked'}" type="button" data-id="${o.id}" ${o.can?'':'disabled'}>
            <div class="han">${esc(o.han)}</div>
            <div class="pct">${(o.pct*100)|0}%</div>
            <div class="min">${o.can?`= ${o.bet.toLocaleString()} 氣`:`氣 부족 (≥${o.min})`}</div>
          </button>
        `).join('')}
      </div>
    </div>

    <div class="card fade-in">
      <div class="card-title"><span class="han">大廳</span> 대기실 (실시간)</div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:8px">선택한 레벨의 다른 학습자와 자동 매칭됩니다.</div>
      <div style="display:flex;gap:6px;justify-content:center;margin-top:10px">
        <button class="btn btn-lg" id="join-battle">入場</button>
        <button class="btn btn-o" id="cancel-battle">취소</button>
      </div>
    </div>

    <div class="card fade-in" style="font-size:11px;color:var(--gutong);background:var(--mi)">
      <div style="font-family:var(--font-display);font-size:13px;color:var(--zhusha-d);margin-bottom:4px">對決 규칙</div>
      <div>1. 입장 시 베팅액이 미리 차감(에스크로). 매칭 실패 시 환불.</div>
      <div>2. 5문제 객관식 (작년 기출 + 처방 자동 생성). 60초 제한.</div>
      <div>3. 승자가 패자의 베팅 全額 획득. 무승부면 환불.</div>
      <div>4. 입장 시 캐릭터의 명언이 말풍선에 표시됩니다.</div>
    </div>
  `;
  $$('#bet-grid .bet-cell').forEach(el => {
    el.addEventListener('click', () => {
      if(el.disabled) return;
      selected = el.dataset.id;
      $$('#bet-grid .bet-cell').forEach(x => x.classList.toggle('selected', x.dataset.id === selected));
    });
  });
  $('#cancel-battle').addEventListener('click', () => setTab('hall'));
  $('#join-battle').addEventListener('click', () => joinBattleQueue(selected));
}
window.openBattleLobby = openBattleLobby;

// 매칭 큐 — Firebase RTDB 의 /lobby/{level}/{userId} 에 자기 정보 push
// 같은 level 의 다른 user 가 보이면 방을 만들고 양쪽 redirect
async function joinBattleQueue(level){
  if(!FB){ toast('Firebase 연결 안됨'); return; }
  const bet = calcBet(level);
  if(S.qi < bet){ toast('氣 부족'); return; }
  view.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">入場</span>대결 대기</h2>
    <div class="view-sub">상대를 찾는 중입니다…</div>
    <div style="text-align:center;margin:40px 0">
      ${taijiSVG(120, true)}
      <div style="font-family:var(--font-display);font-size:14px;color:var(--zhusha-d);margin-top:18px;letter-spacing:.08em">
        ${BET_LEVELS.find(l=>l.id===level).han} · ${bet.toLocaleString()} 氣
      </div>
      <div style="font-size:12px;color:var(--mo-l);margin-top:8px" id="queue-status">대기 중…</div>
      <button class="btn btn-o btn-sm" id="leave-queue" style="margin-top:18px">취소</button>
    </div>
  `;
  // 큐에 등록
  const myEntry = {
    userId: S.userId, name: S.name, character: S.character,
    bet, level, qi: S.qi, ts: Date.now()
  };
  await FB.put(`lobby/${level}/${S.userId}`, myEntry);
  // 폴링: 같은 level 의 다른 사용자 탐지 → 첫 발견 시 매칭 시도
  let polling = true;
  $('#leave-queue').addEventListener('click', async () => {
    polling = false;
    await FB.del(`lobby/${level}/${S.userId}`);
    setTab('hall');
  });
  let pollCount = 0;
  async function poll(){
    if(!polling) return;
    pollCount++;
    const all = await FB.get(`lobby/${level}`);
    if(!all){ setTimeout(poll, 2000); return; }
    const now = Date.now();
    const others = Object.values(all)
      .filter(p => p.userId !== S.userId && (now - (p.ts||0)) < 60000)
      .sort((a,b) => (a.ts||0) - (b.ts||0));
    if(others.length > 0){
      // 가장 먼저 등록된 상대와 매칭
      const opp = others[0];
      // race 회피: userId 가 더 작은 쪽이 방 생성
      if(S.userId < opp.userId){
        const roomId = 'r_' + Math.random().toString(36).slice(2,8);
        const room = {
          roomId, level, bet, status: 'starting',
          players: {
            [S.userId]: {name:S.name, character:S.character, score:0, qi:S.qi},
            [opp.userId]: {name:opp.name, character:opp.character, score:0, qi:opp.qi},
          },
          questions: generateBattleQuestions(5),
          createdAt: Date.now()
        };
        await FB.put(`battles/${roomId}`, room);
        // 큐에서 제거
        await FB.del(`lobby/${level}/${S.userId}`);
        await FB.del(`lobby/${level}/${opp.userId}`);
        polling = false;
        startBattle(roomId, true);
        return;
      } else {
        // 상대가 방 생성 대기 — 잠깐 더 폴링
        $('#queue-status').textContent = '상대 발견! 방 생성 대기…';
      }
    }
    // 자기 방이 생성됐는지 확인
    const battles = await FB.get('battles');
    if(battles){
      const myRoom = Object.values(battles).find(r => r.players && r.players[S.userId]);
      if(myRoom){
        polling = false;
        startBattle(myRoom.roomId, false);
        return;
      }
    }
    $('#queue-status').textContent = `대기 중… (${pollCount * 2}초)`;
    setTimeout(poll, 2000);
  }
  setTimeout(poll, 1500);
}

// 배틀 문제 생성 (기출/자동) — 데이터가 있으면 사용, 없으면 placeholder
function generateBattleQuestions(n){
  const pool = [];
  if(typeof PAST_EXAMS !== 'undefined' && PAST_EXAMS.length){
    pool.push(...PAST_EXAMS.slice(0, 30));
  }
  if(typeof FORMULAS !== 'undefined' && FORMULAS.length){
    // 자동 생성: "이 처방의 작용은?"
    FORMULAS.slice(0, 10).forEach(f => {
      const distractors = FORMULAS.filter(x => x.id !== f.id).slice(0,3).map(x => x.action);
      pool.push({
        q: `${f.han} (${f.ko}) 의 작용은?`,
        options: [f.action, ...distractors].filter(Boolean),
        answer: 0,
        type: 'auto-action'
      });
    });
  }
  // 폴백: 일반 의가 명언 매칭 문제
  while(pool.length < n){
    const p = PHYSICIANS[Math.floor(Math.random()*PHYSICIANS.length)];
    if(!p.quote) continue;
    const others = PHYSICIANS.filter(x => x.id !== p.id).slice(0,3);
    pool.push({
      q: `다음 명언의 저자는? "${p.quote.han}"`,
      options: [p.han, ...others.map(o => o.han)],
      answer: 0,
      type: 'auto-quote'
    });
  }
  // 셔플 후 각 문제 옵션도 셔플
  const out = pool.sort(() => Math.random()-0.5).slice(0, n);
  return out.map(p => {
    const correctTxt = p.options[p.answer||0];
    const shuffled = p.options.slice().sort(() => Math.random()-0.5);
    return {...p, options: shuffled, answer: shuffled.indexOf(correctTxt)};
  });
}

async function startBattle(roomId, isCreator){
  const room = await FB.get(`battles/${roomId}`);
  if(!room){ toast('방을 찾을 수 없음'); setTab('hall'); return; }
  _battle = { roomId, isCreator, room };
  // 인트로 컷 (對決開始 + 명언 말풍선)
  renderBattleIntro(room, () => renderBattleGame(roomId));
}

function renderBattleIntro(room, onContinue){
  const me = room.players[S.userId];
  const oppId = Object.keys(room.players).find(k => k !== S.userId);
  const opp = room.players[oppId];
  const meChar = PHYSICIAN_BY_ID[me.character] || PHYSICIANS[0];
  const oppChar = PHYSICIAN_BY_ID[opp.character] || PHYSICIANS[0];
  // 명언 선택 — quotes_pool 있으면 랜덤, 없으면 기본 quote
  function pickQuote(c){
    if(c.quotes_pool && c.quotes_pool.length){
      return c.quotes_pool[Math.floor(Math.random()*c.quotes_pool.length)];
    }
    return c.quote || {han:'...',ko:'',src:''};
  }
  const meQ = pickQuote(meChar);
  const oppQ = pickQuote(oppChar);

  view.innerHTML = `
    <div class="intro-stage">
      <h2 class="view-title" style="margin-top:6px"><span class="han">對</span>對決</h2>
      <div class="view-sub">방 ${esc(room.roomId)} · ${esc(BET_LEVELS.find(l=>l.id===room.level)?.han||room.level)} · ${room.bet.toLocaleString()} 氣</div>

      <!-- 상대 -->
      <div class="intro-side">
        <div style="font-size:11px;color:var(--mo-l);font-weight:600;letter-spacing:.08em;margin-bottom:6px">상대 ▼</div>
        <div class="intro-charwrap">
          <div>${_charPhotoMedallion(oppChar, 130)}</div>
          <div class="intro-bubble bubble-top">
            <div class="intro-han han">${esc(oppQ.han)}</div>
            ${oppQ.ko && oppQ.ko !== oppQ.han ? `<div class="intro-ko">${esc(oppQ.ko)}</div>` : ''}
            <div class="intro-src">— ${esc(oppQ.src||'')}</div>
          </div>
        </div>
        <div class="intro-name">${esc(opp.name)}</div>
        <div class="intro-charname"><span class="han">${esc(oppChar.han)}</span> · ${esc(oppChar.work_han)}</div>
      </div>

      <!-- VS (對決開始) -->
      <div class="intro-vs">
        <div class="intro-vs-line"></div>
        <span class="intro-vs-text">對決開始</span>
      </div>

      <!-- 나 -->
      <div class="intro-side">
        <div class="intro-charwrap">
          <div>${_charPhotoMedallion(meChar, 130)}</div>
          <div class="intro-bubble bubble-bottom">
            <div class="intro-han han">${esc(meQ.han)}</div>
            ${meQ.ko && meQ.ko !== meQ.han ? `<div class="intro-ko">${esc(meQ.ko)}</div>` : ''}
            <div class="intro-src">— ${esc(meQ.src||'')}</div>
          </div>
        </div>
        <div class="intro-name">${esc(me.name)}</div>
        <div class="intro-charname"><span class="han">${esc(meChar.han)}</span> · ${esc(meChar.work_han)}</div>
        <div style="font-size:11px;color:var(--zhusha-d);font-weight:600;letter-spacing:.08em;margin-top:6px">▲ 나</div>
      </div>

      <div style="text-align:center;margin-top:16px">
        <button class="btn btn-gold" id="intro-skip" type="button">바로 시작 →</button>
      </div>
    </div>
  `;
  let advanced = false;
  const advance = () => { if(advanced) return; advanced = true; clearTimeout(tm); onContinue(); };
  $('#intro-skip').addEventListener('click', advance);
  const tm = setTimeout(advance, BATTLE_INTRO_MS);
}

async function renderBattleGame(roomId){
  const room = await FB.get(`battles/${roomId}`);
  if(!room){ toast('방 손실'); setTab('hall'); return; }
  let curQ = 0;
  let myScore = 0;
  let answers = [];
  const questions = room.questions || [];

  function showQ(){
    if(curQ >= questions.length){
      return finalizeBattle();
    }
    const q = questions[curQ];
    view.innerHTML = `
      <h2 class="view-title fade-in"><span class="han">問</span>${curQ+1}/${questions.length}</h2>
      <div class="card imperial fade-in">
        <div style="font-size:14.5px;color:var(--mo);line-height:1.6;margin-bottom:14px">${esc(q.q||q.question||'?')}</div>
        ${(q.options||[]).map((opt, i) => `
          <button class="btn btn-o" type="button" style="display:block;width:100%;margin:6px 0;text-align:left;justify-content:flex-start" data-i="${i}">
            <span style="font-family:var(--font-display);color:var(--zhusha-d);margin-right:8px">${'甲乙丙丁戊'[i]||(i+1)}</span>${esc(opt)}
          </button>
        `).join('')}
      </div>
      <div style="text-align:center;font-size:12px;color:var(--gutong);margin-top:10px">현재 정답: <b class="seal">${myScore}/${curQ}</b></div>
    `;
    $$('.btn[data-i]').forEach(b => {
      b.addEventListener('click', () => {
        const i = +b.dataset.i;
        const correct = i === (q.answer||0);
        if(correct) myScore++;
        answers.push({q: curQ, choice:i, correct});
        // 정답 표시
        $$('.btn[data-i]').forEach(x => {
          x.disabled = true;
          if(+x.dataset.i === (q.answer||0)) x.style.background = 'var(--feicui)';
          if(+x.dataset.i === i && !correct) x.style.background = 'var(--zhusha)';
          x.style.color = 'var(--mi-w)';
          x.style.borderColor = 'transparent';
        });
        // 오답 기록 (개인 + 글로벌 통계)
        if(!correct){
          const qid = q.id || `${q.type||'q'}:${curQ}`;
          if(!S.wrongIds.includes(qid)) S.wrongIds.push(qid);
          // 글로벌 통계: stats/wrongs/{qid} 증가
          if(FB){
            FB.get(`stats/wrongs/${qid}`).then(cur => {
              FB.put(`stats/wrongs/${qid}`, (cur||0) + 1);
            });
          }
        }
        setTimeout(() => { curQ++; showQ(); }, 1100);
      });
    });
  }

  async function finalizeBattle(){
    // 상대 점수 fetch — 폴링
    view.innerHTML = `
      <h2 class="view-title"><span class="han">候</span>판정 대기</h2>
      <div style="text-align:center;margin:40px 0">${taijiSVG(80, true)}
      <div style="margin-top:12px;color:var(--mo-l);font-size:12px">상대 결과 대기…</div></div>
    `;
    // 내 점수 기록
    await FB.put(`battles/${roomId}/players/${S.userId}/score`, myScore);
    await FB.put(`battles/${roomId}/players/${S.userId}/done`, true);
    // 폴링
    let tries = 0;
    async function pollEnd(){
      tries++;
      const r = await FB.get(`battles/${roomId}`);
      if(!r){ toast('방이 사라졌습니다'); setTab('hall'); return; }
      const players = r.players || {};
      const allDone = Object.values(players).every(p => p.done);
      if(allDone || tries > 30){
        showResult(r);
        return;
      }
      setTimeout(pollEnd, 1500);
    }
    pollEnd();
  }

  async function showResult(room){
    const players = room.players;
    const me = players[S.userId];
    const oppId = Object.keys(players).find(k => k !== S.userId);
    const opp = players[oppId];
    const bet = room.bet;
    let outcome = 'draw';
    let deltaQi = 0;
    if(me.score > (opp.score||0)){ outcome = 'win'; deltaQi = bet; }
    else if(me.score < (opp.score||0)){ outcome = 'lose'; deltaQi = -bet; }
    else { outcome = 'draw'; deltaQi = 0; }

    // 氣 정산 (개인만 — 글로벌은 presence 다음 ping 으로 반영)
    S.qi += deltaQi;
    if(S.qi < 0) S.qi = 0;
    // 배틀 히스토리
    S.battleHistory = S.battleHistory || [];
    S.battleHistory.unshift({
      ts: Date.now(), win: outcome === 'win', draw: outcome === 'draw',
      myScore: me.score, oppScore: opp.score||0,
      opponentName: opp.name, opponentChar: opp.character,
      bet, deltaQi
    });
    if(S.battleHistory.length > 20) S.battleHistory = S.battleHistory.slice(0, 20);
    saveState(); refreshHeader();
    // 방 정리 (생성자만)
    if(_battle && _battle.isCreator){
      setTimeout(() => FB.del(`battles/${roomId}`), 5000);
    }

    const meChar = PHYSICIAN_BY_ID[me.character];
    const oppChar = PHYSICIAN_BY_ID[opp.character];
    const titleHan = outcome === 'win' ? '勝' : (outcome === 'lose' ? '敗' : '和');
    const titleKo = outcome === 'win' ? '승리' : (outcome === 'lose' ? '패배' : '무승부');
    view.innerHTML = `
      <h2 class="view-title fade-in"><span class="han">${titleHan}</span>${esc(titleKo)}</h2>
      <div class="card imperial fade-in" style="text-align:center;padding:24px 14px">
        <div class="seal-stamp big" style="background:${outcome==='win'?'var(--huang)':(outcome==='lose'?'var(--zhusha-d)':'var(--gutong)')};color:var(--mi-w);margin:0 auto 12px">${titleHan}</div>
        <div style="font-size:30px;font-family:var(--font-display);color:${deltaQi>0?'var(--feicui)':(deltaQi<0?'var(--zhusha)':'var(--gutong)')}">
          ${deltaQi>0?'+':''}${deltaQi} 氣
        </div>
        <div style="margin-top:6px;font-size:13px;color:var(--mo-l)">베팅 ${bet.toLocaleString()} 氣 · 현재 ${S.qi.toLocaleString()} 氣</div>
      </div>
      <div class="card fade-in" style="margin-top:14px">
        <div class="card-title"><span class="han">戰況</span> 결과</div>
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--mi-d)">
          ${_charMedallion(meChar, 40)}
          <div style="flex:1">
            <div style="font-weight:600;color:var(--mo)">${esc(me.name)} (나)</div>
            <div style="font-size:11px;color:var(--gutong)"><span class="han">${esc(meChar?.han||'')}</span></div>
          </div>
          <div class="seal" style="font-size:22px;color:var(--zhusha-d)">${me.score}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0">
          ${_charMedallion(oppChar, 40)}
          <div style="flex:1">
            <div style="font-weight:600;color:var(--mo)">${esc(opp.name)}</div>
            <div style="font-size:11px;color:var(--gutong)"><span class="han">${esc(oppChar?.han||'')}</span></div>
          </div>
          <div class="seal" style="font-size:22px;color:var(--zhusha-d)">${opp.score||0}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;justify-content:center;margin-top:14px">
        <button class="btn" onclick="setTab('hall')">명예의 전당</button>
        <button class="btn btn-o" onclick="openBattleLobby()">다시 對決</button>
      </div>
    `;
  }

  showQ();
}

// ───── 12. 통계 ─────────────────────────────────────────────────────────────
function renderStats(){
  view.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">析</span>통계·분석</h2>
    <div class="view-sub">전체 학습자 데이터 + 기출·약재 시각화</div>

    <!-- 메뉴 -->
    <div class="tile-grid fade-in">
      <button class="tile" type="button" data-stab="wrongs">
        <span class="han">難題</span><span class="ttl">전체 오답 랭킹</span>
        <span class="desc">가장 많이 틀린 문제 TOP 20</span>
      </button>
      <button class="tile" type="button" data-stab="exam">
        <span class="han">問</span><span class="ttl">기출 분석</span>
        <span class="desc">유형·章·처방별 분포</span>
      </button>
      <button class="tile wide" type="button" data-stab="herb">
        <span class="han">本草</span><span class="ttl">약재 분석</span>
        <span class="desc">빈출 약재 · 君臣佐使 위치 · 처방별 쓰임</span>
      </button>
    </div>

    <div id="stat-detail"></div>
  `;
  $$('.tile[data-stab]').forEach(b => {
    b.addEventListener('click', () => renderStatDetail(b.dataset.stab));
  });
  // 기본은 wrongs
  renderStatDetail('wrongs');
}

async function renderStatDetail(kind){
  const det = $('#stat-detail');
  if(kind === 'wrongs') return renderWrongsRank(det);
  if(kind === 'exam')   return renderExamAnalysis(det);
  if(kind === 'herb')   return renderHerbAnalysis(det);
}

async function renderWrongsRank(det){
  det.innerHTML = `<div class="card fade-in"><div class="card-title"><span class="han">難題</span> 전체 학습자 오답 랭킹</div><div style="text-align:center;padding:20px;color:var(--gutong)">불러오는 중…</div></div>`;
  if(!FB){ det.innerHTML = `<div class="card">Firebase 미연결</div>`; return; }
  const wrongs = await FB.get('stats/wrongs');
  if(!wrongs){
    det.innerHTML = `<div class="card"><div class="card-title"><span class="han">難題</span> 전체 오답 랭킹</div><div style="font-size:12.5px;color:var(--gutong);text-align:center;padding:16px">아직 데이터가 없습니다. 객관식 풀이를 시작하세요.</div></div>`;
    return;
  }
  const list = Object.entries(wrongs)
    .map(([qid, count]) => ({qid, count}))
    .sort((a,b) => b.count - a.count)
    .slice(0, 20);
  const max = list[0]?.count || 1;
  det.innerHTML = `
    <div class="card fade-in">
      <div class="card-title"><span class="han">難題</span> 가장 많이 틀린 문제 TOP ${list.length}</div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:8px">모든 학습자의 누적 오답 횟수 기준</div>
      <div class="bar-chart">
        ${list.map((it, i) => {
          const w = (it.count / max) * 100;
          return `<div class="bar-row">
            <span class="bar-label">${i+1}. ${esc(it.qid).slice(0,20)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${w}%">${it.count}</div></div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderExamAnalysis(det){
  const exams = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  if(!exams.length){
    det.innerHTML = `<div class="card"><div class="card-title"><span class="han">問</span> 기출 분석</div><div style="font-size:12.5px;color:var(--gutong);text-align:center;padding:16px">data-formulas.js 에 PAST_EXAMS 배열이 필요합니다.</div></div>`;
    return;
  }
  // 유형별 카운트
  const byType = {};
  const byFormula = {};
  exams.forEach(e => {
    byType[e.type||'기타'] = (byType[e.type||'기타']||0) + 1;
    if(e.formula) byFormula[e.formula] = (byFormula[e.formula]||0) + 1;
  });
  const typeArr = Object.entries(byType).sort((a,b)=>b[1]-a[1]);
  const formulaArr = Object.entries(byFormula).sort((a,b)=>b[1]-a[1]).slice(0, 12);
  const maxT = typeArr[0]?.[1] || 1;
  const maxF = formulaArr[0]?.[1] || 1;
  det.innerHTML = `
    <div class="card fade-in">
      <div class="card-title"><span class="han">問</span> 기출 ${exams.length}문 분석</div>

      <div style="margin-top:8px"><b style="font-size:13px;color:var(--zhusha-d)">유형별 분포</b></div>
      <div class="bar-chart">
        ${typeArr.map(([k,v]) => `
          <div class="bar-row">
            <span class="bar-label">${esc(k)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${v/maxT*100}%">${v}</div></div>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:14px"><b style="font-size:13px;color:var(--zhusha-d)">처방별 출제 빈도 TOP 12</b></div>
      <div class="bar-chart">
        ${formulaArr.map(([k,v]) => `
          <div class="bar-row">
            <span class="bar-label">${esc(k)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${v/maxF*100}%">${v}</div></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderHerbAnalysis(det){
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  if(!formulas.length){
    det.innerHTML = `<div class="card"><div class="card-title"><span class="han">本草</span> 약재 분석</div><div style="font-size:12.5px;color:var(--gutong);text-align:center;padding:16px">data-formulas.js 에 FORMULAS 배열이 필요합니다.</div></div>`;
    return;
  }
  // 약재 → 처방 역인덱스
  const herbIdx = {};
  formulas.forEach(f => {
    (f.composition||[]).forEach(h => {
      const name = (typeof h === 'string') ? h : (h.name||h.han||h.ko||'?');
      (herbIdx[name] ||= []).push(f);
    });
  });
  const sorted = Object.entries(herbIdx).sort((a,b)=>b[1].length-a[1].length).slice(0, 20);
  const max = sorted[0]?.[1].length || 1;
  det.innerHTML = `
    <div class="card fade-in">
      <div class="card-title"><span class="han">本草</span> 약재 분석 (${Object.keys(herbIdx).length} 종)</div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:6px">처방에 가장 많이 쓰이는 약재 TOP 20</div>
      <div class="bar-chart">
        ${sorted.map(([h, list]) => `
          <div class="bar-row" style="cursor:pointer" onclick="openHerbDetail('${esc(h)}')">
            <span class="bar-label">${esc(h)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${list.length/max*100}%">${list.length}</div></div>
            <span class="bar-val">${list.slice(0,2).map(x=>x.han||x.ko).join('·')}${list.length>2?'…':''}</span>
          </div>
        `).join('')}
      </div>
      <div style="font-size:11px;color:var(--gutong);margin-top:8px;font-style:italic">바를 탭하면 해당 약재의 처방 목록·군신좌사 위치 분석을 볼 수 있습니다.</div>
    </div>
  `;
}
window.openHerbDetail = function(herbName){
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const using = formulas.filter(f => (f.composition||[]).some(h => {
    const name = (typeof h === 'string') ? h : (h.name||h.han||h.ko||'?');
    return name === herbName;
  }));
  // 君臣佐使 위치 카운트
  const roles = {君:0, 臣:0, 佐:0, 使:0, 기타:0};
  using.forEach(f => {
    const ms = f.monarch_minister || {};
    let assigned = false;
    ['君','臣','佐','使'].forEach(r => {
      const v = ms[r] || ms[r.toLowerCase()];
      if(v && (Array.isArray(v) ? v.some(x => (x.name||x.ko||x.han)===herbName) : v.includes(herbName))){
        roles[r]++; assigned = true;
      }
    });
    if(!assigned) roles.기타++;
  });
  openModal(`
    <h3 class="seal" style="margin:0 0 6px;color:var(--zhusha-d)">${esc(herbName)}</h3>
    <div style="font-size:12px;color:var(--mo-l);margin-bottom:10px">사용 처방 ${using.length} 종</div>
    <div style="margin-bottom:14px">
      <b style="font-size:12px;color:var(--zhusha-d)">君臣佐使 위치</b>
      <div class="bar-chart" style="margin-top:6px">
        ${Object.entries(roles).map(([r,n])=>`
          <div class="bar-row">
            <span class="bar-label han">${r}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${using.length?n/using.length*100:0}%">${n}</div></div>
          </div>
        `).join('')}
      </div>
    </div>
    <b style="font-size:12px;color:var(--zhusha-d)">사용 처방</b>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">
      ${using.map(f => `<span class="presence-chip"><span class="han">${esc(f.han||'')}</span> ${esc(f.ko||'')}</span>`).join('')}
    </div>
  `);
};

// ───── 13. 처방 / 약재 / 기출 ───────────────────────────────────────────────
function renderFormulas(){
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  if(!formulas.length){
    view.innerHTML = `
      <h2 class="view-title"><span class="han">方</span>처방</h2>
      <div class="card"><div style="text-align:center;padding:24px;font-size:13px;color:var(--gutong)">
        <div class="han" style="font-size:24px;color:var(--zhusha-d);margin-bottom:8px">未充</div>
        data-formulas.js 에 24 처방 데이터를 넣어주세요.<br>
        v1.0 의 data-formulas.js 를 그대로 복사하면 됩니다.
      </div></div>
    `;
    return;
  }
  view.innerHTML = `
    <h2 class="view-title"><span class="han">方</span>처방</h2>
    <div class="view-sub">${formulas.length} 처방</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${formulas.map(f => `
        <button class="card" type="button" style="text-align:left;cursor:pointer;width:100%" onclick="showFormulaDetail('${esc(f.id)}')">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="han" style="font-size:18px;color:var(--zhusha-d);font-weight:700">${esc(f.han||'')}</span>
            <span style="font-size:13px;color:var(--mo);font-weight:600">${esc(f.ko||'')}</span>
            <span style="margin-left:auto;font-size:11px;color:var(--gutong)">${esc(f.chapter||'')}</span>
          </div>
          ${f.action?`<div style="font-size:12px;color:var(--mo-l);margin-top:4px"><span class="han">${esc(f.action)}</span></div>`:''}
        </button>
      `).join('')}
    </div>
  `;
}

window.showFormulaDetail = function(fid){
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const f = formulas.find(x => x.id === fid);
  if(!f) return;
  const comp = (f.composition||[]).map(h => typeof h === 'string' ? h : (h.han||h.ko||h.name||'?')).join('·');
  view.innerHTML = `
    <button class="btn btn-sm btn-o" onclick="setTab('formula')">← 뒤로</button>
    <h2 class="view-title fade-in"><span class="han">${esc(f.han||'')}</span>${esc(f.ko||'')}</h2>
    ${f.action?`<div class="card imperial fade-in"><div class="card-title"><span class="han">作用</span> 작용</div><div class="han" style="font-size:15px;color:var(--zhusha-d)">${esc(f.action)}</div></div>`:''}
    ${comp?`<div class="card fade-in"><div class="card-title"><span class="han">構成</span> 구성</div><div class="han" style="font-size:14px">${esc(comp)}</div></div>`:''}
    ${f.indication?`<div class="card fade-in"><div class="card-title"><span class="han">適應</span> 적응증</div><div>${esc(f.indication)}</div></div>`:''}
    ${(f.keyPoints||[]).length?`<div class="card fade-in"><div class="card-title"><span class="han">要點</span> 핵심 포인트</div><ul style="margin:0;padding-left:20px">${(f.keyPoints||[]).map(k=>`<li>${esc(k)}</li>`).join('')}</ul></div>`:''}
  `;
};

function renderHerbs(){
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const herbs = (typeof HERBS !== 'undefined') ? HERBS : [];
  // 약재 → 처방 역인덱스 계산
  const idx = {};
  formulas.forEach(f => {
    (f.composition||[]).forEach(h => {
      const name = (typeof h === 'string') ? h : (h.han||h.ko||h.name||'?');
      (idx[name] ||= []).push(f);
    });
  });
  view.innerHTML = `
    <h2 class="view-title"><span class="han">藥</span>약재</h2>
    <div class="view-sub">${herbs.length || Object.keys(idx).length} 약재 · 처방 역인덱스</div>
    ${(!formulas.length) ? `<div class="card"><div style="text-align:center;padding:16px;color:var(--gutong);font-size:13px">data-formulas.js 의 FORMULAS·HERBS 가 필요합니다</div></div>` : `
    <div style="display:flex;flex-direction:column;gap:5px">
      ${Object.entries(idx).sort((a,b)=>b[1].length-a[1].length).map(([h, list]) => `
        <button class="card" type="button" style="text-align:left;cursor:pointer;width:100%" onclick="openHerbDetail('${esc(h)}')">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="han" style="font-size:15px;color:var(--zhusha-d);font-weight:700">${esc(h)}</span>
            <span style="margin-left:auto;font-size:11px;color:var(--gutong)">${list.length}처방</span>
          </div>
        </button>
      `).join('')}
    </div>`}
  `;
}

function renderQuiz(){
  const exams = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  view.innerHTML = `
    <h2 class="view-title"><span class="han">問</span>기출·암기</h2>
    <div class="view-sub">작년 기출 ${exams.length}문 · 자동 객관식 · 오답함</div>
    <div class="tile-grid">
      <button class="tile" type="button" onclick="startQuizSession('past')">
        <span class="han">舊問</span><span class="ttl">작년 기출</span>
        <span class="desc">${exams.length}문제 · 해설 포함</span>
      </button>
      <button class="tile" type="button" onclick="startQuizSession('auto')">
        <span class="han">自題</span><span class="ttl">자동 객관식</span>
        <span class="desc">처방 ${formulas.length}개에서 자동 생성</span>
      </button>
      <button class="tile wide" type="button" onclick="startQuizSession('wrong')">
        <span class="han">錯題</span><span class="ttl">오답함 (${S.wrongIds.length})</span>
        <span class="desc">틀린 문제만 다시 풀기</span>
      </button>
    </div>
    ${(!exams.length && !formulas.length)?`<div class="card"><div style="text-align:center;color:var(--gutong);padding:16px;font-size:13px">data-formulas.js 의 PAST_EXAMS·FORMULAS 가 필요합니다</div></div>`:''}
  `;
}

window.startQuizSession = function(mode){
  // 간단 구현: 5문제 풀이 후 결과
  let pool = [];
  if(mode === 'past') pool = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS.slice() : [];
  else if(mode === 'wrong') pool = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS.filter((_,i)=>S.wrongIds.includes('past:'+i)) : [];
  else pool = generateBattleQuestions(5);
  pool = pool.sort(()=>Math.random()-0.5).slice(0, 5);
  if(!pool.length){ toast('문제가 없습니다'); return; }
  let cur = 0, score = 0;
  function show(){
    if(cur >= pool.length){
      // 풀이 결과 + 氣 보상
      const earned = score * 10;
      S.qi += earned; saveState(); refreshHeader();
      view.innerHTML = `
        <h2 class="view-title fade-in"><span class="han">畢</span>완료</h2>
        <div class="card imperial" style="text-align:center;padding:24px">
          <div class="seal" style="font-size:36px;color:var(--zhusha-d)">${score}/${pool.length}</div>
          <div style="margin-top:10px;font-size:14px;color:var(--feicui)">+${earned} 氣</div>
        </div>
        <div style="display:flex;gap:6px;justify-content:center;margin-top:14px">
          <button class="btn" onclick="setTab('quiz')">기출로</button>
          <button class="btn btn-o" onclick="setTab('home')">대청으로</button>
        </div>
      `;
      return;
    }
    const q = pool[cur];
    view.innerHTML = `
      <h2 class="view-title fade-in"><span class="han">問</span>${cur+1}/${pool.length}</h2>
      <div class="card imperial fade-in">
        <div style="font-size:14.5px;line-height:1.6;margin-bottom:12px">${esc(q.q||q.question||'?')}</div>
        ${(q.options||[]).map((opt, i) => `
          <button class="btn btn-o" type="button" style="display:block;width:100%;margin:6px 0;text-align:left;justify-content:flex-start" data-i="${i}">
            <span class="han" style="color:var(--zhusha-d);margin-right:8px">${'甲乙丙丁戊'[i]||(i+1)}</span>${esc(opt)}
          </button>
        `).join('')}
        ${q.explanation?`<div id="expl" style="display:none;margin-top:14px;padding:10px;background:var(--mi);border-radius:6px;font-size:12.5px;color:var(--mo)"><b style="color:var(--zhusha-d)">해설</b><br>${esc(q.explanation)}</div>`:''}
      </div>
    `;
    $$('.btn[data-i]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      const correct = i === (q.answer||0);
      if(correct) score++;
      $$('.btn[data-i]').forEach(x => {
        x.disabled = true;
        if(+x.dataset.i === (q.answer||0)){ x.style.background='var(--feicui)'; x.style.color='var(--mi-w)'; x.style.borderColor='transparent'; }
        if(+x.dataset.i === i && !correct){ x.style.background='var(--zhusha)'; x.style.color='var(--mi-w)'; x.style.borderColor='transparent'; }
      });
      const expl = $('#expl'); if(expl) expl.style.display='block';
      // 오답 기록 (개인 + 글로벌)
      if(!correct){
        const qid = q.id || `past:${cur}`;
        if(!S.wrongIds.includes(qid)) S.wrongIds.push(qid);
        saveState();
        if(FB){
          FB.get(`stats/wrongs/${qid}`).then(c => FB.put(`stats/wrongs/${qid}`, (c||0)+1));
        }
      }
      setTimeout(() => { cur++; show(); }, 1500);
    }));
  }
  show();
};

// ───── 14. 초기화 ───────────────────────────────────────────────────────────
function init(){
  loadState();
  refreshHeader();
  // 헤더 칩 클릭
  $('#rank-chip').addEventListener('click', () => setTab('hall'));
  $('#qi-chip').addEventListener('click', () => setTab('hall'));
  $('#bgm-chip').addEventListener('click', () => bgm.toggle());
  // 네비
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  // 첫 화면
  setTab(S.lastTab || 'home');
  // presence 시작
  if(FB) recordPresence();
}

document.addEventListener('DOMContentLoaded', init);
if(document.readyState === 'interactive' || document.readyState === 'complete') init();
