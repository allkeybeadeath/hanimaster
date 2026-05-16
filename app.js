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
const APP_VERSION = 'v2.2.2';              // ★ 로비 표시용 (2026-05)
const APP_BUILD   = '2026.05.17';
const FIREBASE_URL = 'https://hanimaster-245f6-default-rtdb.asia-southeast1.firebasedatabase.app/';
const STORAGE_KEY = 'bangje.state.v2';

// 시험일 (Asia/Seoul 기준 자정). 사용자 환경에 따라 조정.
const EXAM_DATE_ISO = '2026-05-20T00:00:00+09:00';
const EXAM_META = {
  course: '方劑學',
  examTitle: '2차 수시',
  rangeKR: '6장 온경산한제 · 7장 표리쌍해제 · 8장 보익제',
  rangeHan: '溫經散寒 · 表裏雙解 · 補益(補氣血·陰陽幷補)',
};

const PRESENCE_REFRESH_MS = 30 * 1000;     // 30초마다 presence 갱신
const PRESENCE_FRESH_MS   = 90 * 1000;     // 90초 이내면 "온라인"
const BATTLE_INTRO_MS     = 5000;          // 인트로 컷 자동 진행
const LOBBY_REFRESH_MS    = 4000;          // (legacy) SSE 실패 시 폴링 fallback 주기
const LOBBY_FRESH_MS      = 45 * 1000;     // 45초 이내면 대기중 (v2.2.2: 60→45)
const MATCH_TIMEOUT_MS    = 75 * 1000;     // 75초 매칭 실패 시 자동 환불
const POLL_INTERVAL_MS    = 2500;          // (legacy) SSE 실패 시 폴링 주기
// v2.2.2: 둘러보는 중 (idle browse) — 入場 버튼 누르기 전 로비 체류자
const LOBBY_IDLE_REFRESH_MS = 12 * 1000;   // 12초마다 idle ts 갱신
const LOBBY_IDLE_FRESH_MS   = 30 * 1000;   // 30초 이내면 둘러보는 중
const SSE_FALLBACK_POLL_MS  = 3000;        // SSE 실패 시 폴링 백오프 주기

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
    // v2.2.1: 재시도 가능한 PUT — 큐 등록 등 결정적 작업용
    // 반환: { ok: bool, status: number|null, retries: number, message: string }
    putRetry: async (path, val, opts) => {
      const o = Object.assign({tries:3, backoffMs:300}, opts||{});
      let lastStatus = null, lastErr = '';
      for(let i=0; i<o.tries; i++){
        try{
          const r = await fetch(`${base}/${path}.json`, {
            method:'PUT', headers:{'Content-Type':'application/json'},
            body: JSON.stringify(val),
          });
          if(r.ok) return { ok:true, status:r.status, retries:i, message:'' };
          lastStatus = r.status;
          // 401·403 (보안 룰 거부) — 재시도해도 의미 없음
          if(r.status === 401 || r.status === 403){
            return { ok:false, status:r.status, retries:i, message:'권한 거부(보안 룰)' };
          }
          // 5xx·기타 — 재시도
          lastErr = `HTTP ${r.status}`;
        }catch(e){
          lastErr = (e && e.message) || '네트워크 오류';
        }
        if(i < o.tries-1) await new Promise(res => setTimeout(res, o.backoffMs * (i+1)));
      }
      return { ok:false, status:lastStatus, retries:o.tries, message:lastErr };
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
    // v2.2.2: page-unload 안전 DELETE (fetch keepalive 옵션)
    delKeepalive: (path) => {
      try{
        fetch(`${base}/${path}.json`, {method:'DELETE', keepalive:true});
        return true;
      }catch(_){ return false; }
    },
    // v2.2.2: Firebase RTDB SSE 스트리밍 — 실시간 매칭/대기자 동기화
    //   const sub = FB.subscribe('lobby/small', snap => updateUI(snap));
    //   sub.close();
    // EventSource 미지원·실패 시 폴링으로 자동 폴백.
    // 콜백은 path 의 현재 스냅샷(객체 or null)을 전달, put/patch 적용 후마다 호출.
    subscribe: (path, onUpdate, opts) => {
      const o = Object.assign({fallbackPollMs: SSE_FALLBACK_POLL_MS}, opts||{});
      const url = `${base}/${path}.json`;
      let snapshot = null;
      let closed = false;
      let es = null;
      let pollTimer = null;
      let gotFirst = false;

      const emit = () => { if(!closed){ try{ onUpdate(snapshot); }catch(_){} } };

      // 상대 path("/", "/key", "/key/sub")에 put/patch 적용
      const applyEvent = (type, raw) => {
        let parsed;
        try{ parsed = JSON.parse(raw); }catch(_){ return; }
        const rel = (parsed && parsed.path) || '/';
        const data = parsed && 'data' in parsed ? parsed.data : null;
        const parts = rel.split('/').filter(Boolean);
        if(type === 'put'){
          if(parts.length === 0){
            snapshot = data;
          } else {
            if(snapshot === null || typeof snapshot !== 'object') snapshot = {};
            let cur = snapshot;
            for(let i=0; i<parts.length-1; i++){
              const k = parts[i];
              if(cur[k] === null || cur[k] === undefined || typeof cur[k] !== 'object'){
                cur[k] = {};
              }
              cur = cur[k];
            }
            const lastK = parts[parts.length-1];
            if(data === null) delete cur[lastK];
            else              cur[lastK] = data;
          }
        } else if(type === 'patch'){
          // patch: data 의 키만 merge. value === null 이면 해당 키 삭제.
          let cur;
          if(parts.length === 0){
            if(snapshot === null || typeof snapshot !== 'object') snapshot = {};
            cur = snapshot;
          } else {
            if(snapshot === null || typeof snapshot !== 'object') snapshot = {};
            cur = snapshot;
            for(const k of parts){
              if(cur[k] === null || cur[k] === undefined || typeof cur[k] !== 'object'){
                cur[k] = {};
              }
              cur = cur[k];
            }
          }
          for(const k of Object.keys(data || {})){
            if(data[k] === null) delete cur[k];
            else                 cur[k] = data[k];
          }
        }
        emit();
      };

      const startPolling = async () => {
        if(pollTimer) return;
        const tick = async () => {
          if(closed) return;
          try{
            const v = await (async () => {
              try{
                const r = await fetch(`${base}/${path}.json`);
                if(!r.ok) return null;
                return await r.json();
              }catch(_){ return null; }
            })();
            snapshot = v;
            emit();
          }catch(_){}
          if(!closed) pollTimer = setTimeout(tick, o.fallbackPollMs);
        };
        tick();
      };

      const startSSE = () => {
        if(typeof EventSource === 'undefined'){ startPolling(); return; }
        try{ es = new EventSource(url); }
        catch(_){ startPolling(); return; }
        es.addEventListener('put',   e => { gotFirst = true; applyEvent('put',   e.data); });
        es.addEventListener('patch', e => { gotFirst = true; applyEvent('patch', e.data); });
        es.addEventListener('keep-alive', () => {});
        es.addEventListener('cancel', () => {
          try{ es.close(); }catch(_){}
          if(!closed) startPolling();
        });
        es.addEventListener('auth_revoked', () => {
          try{ es.close(); }catch(_){}
          if(!closed) startPolling();
        });
        es.onerror = () => {
          // 첫 메시지 전 에러면 SSE 미지원 가능성 → 폴링 폴백.
          // 그 외엔 브라우저가 자동 재연결하므로 무시.
          if(!gotFirst){
            try{ es.close(); }catch(_){}
            es = null;
            setTimeout(() => { if(!closed) startPolling(); }, 1200);
          }
        };
      };

      startSSE();

      return {
        close: () => {
          closed = true;
          if(es){ try{ es.close(); }catch(_){} es = null; }
          if(pollTimer){ clearTimeout(pollTimer); pollTimer = null; }
        },
        get snapshot(){ return snapshot; },
      };
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

// v2.2.2: 効能 카테고리 — 약재(meaning)·처방(action) 공용 키워드 사전
// renderHerbAnalysis 와 renderFormulaIndex 가 공유.
const EFFICACY_CATS = [
  { id:'buqi',   ko:'補氣',  han:'補氣',   color:'#C9A227', keys:['補氣','益氣','補中','補脾','大補元氣'] },
  { id:'buxue',  ko:'補血',  han:'補血',   color:'#9C3030', keys:['補血','養血','生血','和血'] },
  { id:'buyin',  ko:'補陰',  han:'補陰',   color:'#3068A0', keys:['滋陰','養陰','補陰','潤燥','生津','滋腎陰'] },
  { id:'buyang', ko:'補陽',  han:'補陽',   color:'#876A36', keys:['補陽','助陽','溫補','溫腎','補火','補腎陽'] },
  { id:'jiebiao',ko:'解表',  han:'解表',   color:'#2A7060', keys:['解表','發表','發汗','解肌','疏散','疏風'] },
  { id:'qingre', ko:'淸熱',  han:'淸熱',   color:'#3CA6A6', keys:['淸熱','清熱','瀉火','凉血','解毒','除煩','淸裡','清裡'] },
  { id:'wenli',  ko:'溫裏',  han:'溫裏',   color:'#B25040', keys:['溫中','溫裏','溫經','散寒','祛寒','回陽','救逆'] },
  { id:'xiexia', ko:'瀉下',  han:'瀉下',   color:'#5B4080', keys:['瀉下','潤腸','通便','軟堅','攻裏','內瀉','瀉熱'] },
  { id:'huatan', ko:'化痰',  han:'化痰',   color:'#807040', keys:['化痰','止咳','平喘','宣肺','降逆','開竅化痰'] },
  { id:'xingqi', ko:'行氣',  han:'行氣',   color:'#A07020', keys:['行氣','理氣','降氣','破氣','疏肝','順氣','消痞'] },
  { id:'huoxue', ko:'活血',  han:'活血',   color:'#883050', keys:['活血','祛瘀','行血','通脈','通痺','消積'] },
  { id:'anshen', ko:'安神',  han:'安神',   color:'#406090', keys:['安神','寧心','養心','鎮驚'] },
  { id:'lishui', ko:'利水',  han:'利水',   color:'#3090A0', keys:['利水','滲濕','利尿','燥濕'] },
  { id:'guse',   ko:'固澁',  han:'固澁',   color:'#705030', keys:['固表','止汗','澀精','收斂','止瀉'] },
  { id:'kaiqiao',ko:'開竅',  han:'開竅',   color:'#9050A0', keys:['開竅','醒神','豁痰開竅'] },
  { id:'shengyang',ko:'升陽',han:'升陽',   color:'#D08020', keys:['升陽','擧陷','升擧'] },
  { id:'heli',   ko:'和裏',  han:'和裏',   color:'#608060', keys:['和解','和裏','緩急','調和'] },
];
function efficaciesOfText(txt){
  const t = txt || '';
  return EFFICACY_CATS.filter(c => c.keys.some(k => t.includes(k))).map(c => c.id);
}

// v2.2.2: 콘텐츠 해시 기반 안정 qid
//   • PAST_EXAMS: q.id (예: 'past_001') 그대로 — click 으로 문제 복원 가능
//   • auto-generated: 문제 텍스트+선택지(정렬)+유형 해시 → 'auto:<base36>'
//     같은 내용의 자동 문제는 항상 같은 qid 로 모이므로 /stats/wrongs 집계가 의미있어짐.
//     순서 셔플로 인한 변동은 options 정렬로 무효화.
function qidOf(q){
  if(q && q.id) return q.id;
  if(!q) return 'auto:0';
  const opts = Array.isArray(q.options) ? q.options.slice().sort().join('|') : '';
  const txt = (q.q || '') + '||' + opts + '||' + (q.type || '');
  let h = 5381;
  for(let i=0; i<txt.length; i++){ h = ((h << 5) + h + txt.charCodeAt(i)) | 0; }
  return 'auto:' + (h >>> 0).toString(36);
}

// ───── 4. 메달리온 (CSS only — 인물 SVG 폐기 v2.2) ────────────────────────
// charOrId: 객체 또는 id 문자열
// size: 픽셀
// CSS 메달리온: cmedal.cat-{cat} 클래스로 카테고리 팔레트 적용
// 사진 있으면 위에 덮음. onerror 시 자연스럽게 CSS 배경 노출.
function _charMedallion(charOrId, size){
  const c = (typeof charOrId === 'string') ? PHYSICIAN_BY_ID[charOrId] : charOrId;
  if(!c){
    return `<div class="cmedal cat-ancient" style="width:${size}px;height:${size}px" role="img" aria-label="未知">
      <div class="cmedal-init" style="font-size:${Math.round(size*0.45)}px">?</div>
    </div>`;
  }
  const showName = size >= 80;
  const init = c.init || (c.han && c.han[0]) || '?';
  const initSize = showName ? Math.round(size * 0.42) : Math.round(size * 0.55);
  const nameSize = Math.max(8, Math.round(size * 0.105));
  return `<div class="cmedal cat-${esc(c.cat||'ancient')}" style="width:${size}px;height:${size}px" role="img" aria-label="${esc(c.ko)} (${esc(c.han)})">
    <div class="cmedal-init" style="font-size:${initSize}px">${esc(init)}</div>
    ${showName ? `<div class="cmedal-name" style="font-size:${nameSize}px">${esc(c.ko)}</div>` : ''}
  </div>`;
}
window._charMedallion = _charMedallion;

// 사진 있는 캐릭터는 사진을 덮어 표시. 사진 onerror 시 CSS 메달리온이 자동 노출.
function _charPhotoMedallion(charOrId, size){
  const c = (typeof charOrId === 'string') ? PHYSICIAN_BY_ID[charOrId] : charOrId;
  if(!c) return _charMedallion(charOrId, size);
  const imgs = (typeof CHARACTER_IMAGES !== 'undefined') ? CHARACTER_IMAGES : {};
  const meta = imgs[c.id];
  if(!meta || !meta.url) return _charMedallion(c, size);
  // 메달리온을 안쪽에 깔고 사진을 위에 덮음. 사진 onerror → 숨김 → CSS 메달리온 노출.
  const showName = size >= 80;
  const init = c.init || (c.han && c.han[0]) || '?';
  const initSize = showName ? Math.round(size * 0.42) : Math.round(size * 0.55);
  const nameSize = Math.max(8, Math.round(size * 0.105));
  const pad = Math.max(2, Math.round(size * 0.06));
  const labelEsc = `${esc(c.ko)} — ${esc(c.han)}`;
  return `<div role="img" aria-label="${labelEsc}" title="${labelEsc} · ${esc(meta.caption||'')}" style="position:relative;display:inline-block;width:${size}px;height:${size}px;vertical-align:middle">
    <div class="cmedal cat-${esc(c.cat||'ancient')}" style="position:absolute;inset:0;width:100%;height:100%">
      <div class="cmedal-init" style="font-size:${initSize}px">${esc(init)}</div>
      ${showName ? `<div class="cmedal-name" style="font-size:${nameSize}px">${esc(c.ko)}</div>` : ''}
    </div>
    <img src="${esc(meta.url)}" alt="${labelEsc}" loading="lazy" decoding="async"
         onerror="this.style.display='none'"
         class="cmedal-photo"
         style="top:${pad}px;left:${pad}px;width:calc(100% - ${pad*2}px);height:calc(100% - ${pad*2}px)">
    ${showName ? `<div style="position:absolute;left:0;right:0;bottom:0;padding:3px 2px 4px;background:linear-gradient(to bottom, transparent 0%, rgba(28,20,10,.85) 80%);color:var(--mi-w);font-size:${nameSize}px;text-align:center;font-family:var(--font-display);font-weight:600;letter-spacing:.04em;pointer-events:none;border-radius:0 0 50%/0 0 100%">${esc(c.ko)}</div>` : ''}
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
  mode: null,        // 'ambient' | 'battle' | null
  prevMode: null,
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

  // 戰鼓 — 짧고 강한 저주파 펄스 (배틀 음악용)
  drum(when, gain){
    if(!this.ctx) return;
    const t = when;
    // 노이즈 + 저주파 sine
    const o = this.ctx.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain || 0.32, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.22);
    // 단단한 attack — 짧은 잡음 클릭
    const bn = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.04, this.ctx.sampleRate);
    const data = bn.getChannelData(0);
    for(let i = 0; i < data.length; i++) data[i] = (Math.random()*2 - 1) * (1 - i/data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = bn;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime((gain||0.32) * 0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(ng); ng.connect(this.master);
    src.start(t);
  },

  // 古琴 멜로디 패턴 — 五聲音階 무작위, 4박자 1마디 × N마디 반복
  schedule(){
    if(!this.ctx || !this.on || this.mode === 'battle') return;
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

  // 戰鬪 BGM — 五聲音階 단조형 (角宮羽商徵 거꾸로), 140 BPM, 戰鼓 강조
  // A2/E3 드론 + 짧고 빠른 멜로디 + 16분음 戰鼓 → 긴박감
  scheduleBattle(){
    if(!this.ctx || !this.on || this.mode !== 'battle') return;
    const t = this.ctx.currentTime;
    const bpm = 140;
    const beat = 60 / bpm;
    const bar = beat * 4;
    const numBars = 4;
    // 단조형 五聲 (D minor pentatonic): D F G A C
    const battleScale = [146.83, 174.61, 196.00, 220.00, 261.63];
    const battleBass = [73.42, 110.00];  // D2, A2
    for(let b = 0; b < numBars; b++){
      const tb = t + b * bar;
      // 戰鼓 — 매박 강박, 1·3박 강함
      for(let i = 0; i < 4; i++){
        const isStrong = (i === 0 || i === 2);
        this.drum(tb + i * beat, isStrong ? 0.34 : 0.18);
        // 16분음 추가 (긴박)
        if(i === 1 || i === 3){
          this.drum(tb + (i + 0.5) * beat, 0.12);
        }
      }
      // 멜로디 — 8분음표로 빠르게, 가끔 16분음 추가
      for(let i = 0; i < 8; i++){
        if(Math.random() < 0.78){
          const note = battleScale[Math.floor(Math.random() * battleScale.length)];
          const oct = Math.random() < 0.4 ? 2 : 1;
          this.pluck(note * oct, tb + i * (beat/2), beat * 0.7, 0.13 + Math.random() * 0.05);
        }
      }
      // 베이스 드론 — 1박 + 3박 강조
      this.pluck(battleBass[b % 2], tb, beat * 1.9, 0.18);
      this.pluck(battleBass[(b+1) % 2], tb + beat * 2, beat * 1.9, 0.16);
    }
    this.timer = setTimeout(() => this.scheduleBattle(), bar * numBars * 1000 - 200);
  },

  start(){
    this.init();
    if(!this.ctx){ toast('이 기기는 BGM 미지원'); return; }
    if(this.ctx.state === 'suspended') this.ctx.resume();
    this.on = true;
    this.mode = 'ambient';
    clearTimeout(this.timer);
    this.schedule();
    refreshHeader();
  },
  stop(){
    this.on = false;
    this.mode = null;
    clearTimeout(this.timer);
    refreshHeader();
  },
  toggle(){ this.on ? this.stop() : this.start(); },

  // 배틀 입장 시 호출 — 긴박한 戰鬪 BGM 으로 즉시 전환 (사용자 토글에 무관)
  startBattle(){
    this.init();
    if(!this.ctx) return;
    if(this.ctx.state === 'suspended') this.ctx.resume();
    this.on = true;
    this.mode = 'battle';
    this.prevMode = this.prevMode || 'ambient';
    clearTimeout(this.timer);
    this.scheduleBattle();
    refreshHeader();
  },
  // 배틀 종료 시 호출 — 이전 ambient 모드로 복귀
  stopBattle(){
    if(this.mode !== 'battle') return;
    this.mode = 'ambient';
    clearTimeout(this.timer);
    if(this.on) this.schedule();
    refreshHeader();
  }
};
window.bgm = bgm;

// ───── 7. 라우팅 ─────────────────────────────────────────────────────────────
function setTab(name){
  // v2.2.2: 다른 탭으로 이동 시 멀티 로비 SSE/idle 정리
  if(typeof stopLobbyStreams === 'function') stopLobbyStreams();
  if(typeof stopLobbyIdle    === 'function') stopLobbyIdle();
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
        <div style="flex-shrink:0;cursor:pointer" id="char-pick-medal" title="캐릭터 변경">${_charPhotoMedallion(S.character, 80)}</div>
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
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm btn-o" type="button" id="char-pick-btn">
              <span class="han" style="margin-right:3px">人</span>캐릭터 (${PHYSICIANS.length}인)
            </button>
            <span style="font-size:10.5px;color:var(--gutong);align-self:center">현재: <span class="han">${esc((PHYSICIAN_BY_ID[S.character]||{}).han||'?')}</span> · ${esc((PHYSICIAN_BY_ID[S.character]||{}).ko||'')}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 학습 메뉴 타일 -->
    <div class="tile-grid fade-in">
      <button class="tile" type="button" onclick="setTab('formula')">
        <span class="han">方劑</span><span class="ttl">처방</span>
        <span class="desc">26 처방 카드 · 작용·구성·적응증</span>
      </button>
      <button class="tile" type="button" onclick="setTab('quiz')">
        <span class="han">問答</span><span class="ttl">기출·암기</span>
        <span class="desc">작년 기출 · 자동 객관식 · 오답함</span>
      </button>
      <button class="tile" type="button" onclick="setTab('herb')">
        <span class="han">本草</span><span class="ttl">약재</span>
        <span class="desc">80 약재 · 처방 역인덱스</span>
      </button>
      <button class="tile" type="button" onclick="setTab('stats')">
        <span class="han">析究</span><span class="ttl">통계·분석</span>
        <span class="desc">기출·약재 시각화 · 全 학습자 오답</span>
      </button>
      <button class="tile gold wide" type="button" onclick="setTab('hall')">
        <span class="han">譽 · 對決</span><span class="ttl">명예의 전당 · 멀티 對決</span>
        <span class="desc">9 等級 (賓醫→眞人) · 51 의가 · 氣博 베팅 배틀</span>
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

    <!-- 버전 표시 -->
    <div class="version-row fade-in">
      <span class="version-chip" title="앱 버전 ${esc(APP_VERSION)} (${esc(APP_BUILD)})">
        <span class="dot"></span>
        <span>方劑學 ${esc(APP_VERSION)} · ${esc(APP_BUILD)}</span>
      </span>
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

  // 캐릭터 선택 — 메달리온 & 버튼 둘 다 picker 열기
  $('#char-pick-btn').addEventListener('click', openCharacterPicker);
  $('#char-pick-medal').addEventListener('click', openCharacterPicker);

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

    <!-- 등급 사다리 (등급별 사용자 표시 v2.2) -->
    <div class="card fade-in" style="margin-top:14px">
      <div class="card-title"><span class="han">階梯</span> 등급 사다리</div>
      ${RANKS.map((r,i) => {
        const reached = S.qi >= r.cost;
        const current = r.id === rk.id;
        const nextCost = RANKS[i+1] ? RANKS[i+1].cost : null;
        return `<div class="ladder-row ${current?'is-current':''}">
          <span class="seal-stamp tiny" style="background:${r.color};${reached?'':'opacity:.35'}">${r.seal}</span>
          <div class="ladder-mid">
            <div class="ladder-title" style="color:${reached?'var(--mo)':'var(--gutong)'}">
              ${esc(r.han)} <span style="font-size:11.5px;color:var(--mo-l);font-family:var(--font-body)">${esc(r.ko)}</span>
            </div>
            <div class="ladder-desc">${esc(r.desc)}</div>
            <div class="ladder-users" data-rank="${r.id}" data-min="${r.cost}" ${nextCost?`data-max="${nextCost}"`:''}>
              <span class="ladder-user-empty">불러오는 중…</span>
            </div>
          </div>
          <span class="ladder-cost" style="color:${reached?'var(--zhusha-d)':'var(--gutong)'}">${r.cost.toLocaleString()} 氣</span>
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
  loadLadderUsers();
}

// 등급 사다리 각 행에 해당 등급에 오른 사용자 표시 (v2.2)
async function loadLadderUsers(){
  if(!FB){
    $$('.ladder-users').forEach(el => { el.innerHTML = '<span class="ladder-user-empty">오프라인</span>'; });
    return;
  }
  const all = await FB.get('presence');
  $$('.ladder-users').forEach(el => {
    const min = parseInt(el.dataset.min) || 0;
    const max = el.dataset.max ? parseInt(el.dataset.max) : Infinity;
    if(!all){ el.innerHTML = '<span class="ladder-user-empty">아무도 없음</span>'; return; }
    // presence 데이터에서 min ≤ qi < max 범위에 해당하는 사용자 모두
    const matched = Object.entries(all)
      .map(([uid,p]) => ({uid, ...p}))
      .filter(p => (p.qi||0) >= min && (p.qi||0) < max)
      .sort((a,b) => (b.qi||0) - (a.qi||0));
    if(!matched.length){
      el.innerHTML = '<span class="ladder-user-empty">아직 도달자 없음</span>';
      return;
    }
    el.innerHTML = matched.slice(0, 18).map(p => {
      const isMe = p.uid === S.userId;
      const med = _charMedallion(p.character || 'qibo', 18);
      return `<span class="ladder-user-chip ${isMe?'is-me':''}" title="${esc(p.name||'')} · ${(p.qi||0).toLocaleString()} 氣">
        ${med}<span class="nm">${esc(p.name||'익명')}${isMe?'(나)':''}</span>
      </span>`;
    }).join('') + (matched.length > 18 ? `<span class="ladder-user-empty" style="font-style:normal">+${matched.length-18}명</span>` : '');
  });
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
let _lobbyTimer = null;          // (legacy) 폴링 fallback 시에만 사용
let _lobbySelfTimer = null;
// v2.2.2: SSE 스트림 + 둘러보는 중(idle) 프레전스
let _lobbyStream     = null;     // /lobby SSE (모든 level 한 번에)
let _lobbyIdleStream = null;     // /lobby_idle SSE
let _lobbyIdleTimer  = null;     // 자기 idle entry keep-alive
let _lobbyIdleLevel  = null;     // 현재 둘러보는 중인 선호 level
let _battlesStream   = null;     // 큐 중 /battles SSE (내 방 생성 감지)
let _lobbyQueueStream = null;    // 큐 중 /lobby/{level} SSE (상대 발견)
// 마지막 렌더 캐시 (불필요한 DOM 업데이트 방지용)
let _lobbyRenderSig = '';

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
    <div class="view-sub">같은 베팅 레벨끼리 자동 매칭 · 승자가 패자의 氣 획득</div>

    <!-- v2.2.2: 둘러보는 중(idle browsers) 실시간 표시 -->
    <div class="card fade-in idle-banner" id="idle-banner" style="display:none">
      <div class="idle-banner-title">
        <span class="han">觀</span>
        <span id="idle-banner-count">0</span>명이 멀티 對決을 둘러보는 중
        <span class="idle-banner-hint">— 入場을 누르면 같은 레벨 사람과 매칭됩니다</span>
      </div>
      <div class="idle-banner-list" id="idle-banner-list"></div>
    </div>

    <div class="card imperial fade-in">
      <div class="card-title">
        <span class="han">氣博</span> 베팅 단계
        <span style="float:right;font-size:11px;color:var(--gutong);font-family:var(--font-body);font-weight:400">실시간 대기·관심</span>
      </div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:8px">현재 보유: <b class="seal" style="color:var(--zhusha-d)">${S.qi.toLocaleString()} 氣</b></div>
      <div class="bet-grid" id="bet-grid">
        ${opts.map(o => `
          <button class="bet-cell ${o.id===selected?'selected':''} ${o.can?'':'locked'}" type="button" data-id="${o.id}" ${o.can?'':'disabled'}>
            <span class="waiting-badges">
              <span class="waiting-badge queue zero" data-level="${o.id}" data-kind="queue" title="入場 대기자">대기 0</span>
              <span class="waiting-badge idle zero"  data-level="${o.id}" data-kind="idle"  title="이 레벨을 둘러보는 중">관심 0</span>
            </span>
            <div class="han">${esc(o.han)} <span style="font-size:11.5px;color:var(--gutong);font-family:var(--font-body)">${esc(o.ko)}</span></div>
            <div class="pct">${(o.pct*100)|0}%</div>
            <div class="min">${o.can?`= ${o.bet.toLocaleString()} 氣`:`氣 부족 (≥${o.min})`}</div>
            <div class="waiting-list" data-list="${o.id}">
              <span class="w-empty">대기자 없음</span>
            </div>
          </button>
        `).join('')}
      </div>
    </div>

    <div class="card fade-in">
      <div style="display:flex;gap:6px;justify-content:center">
        <button class="btn btn-lg" id="join-battle"><span class="han" style="margin-right:4px">入</span>入場</button>
        <button class="btn btn-o" id="cancel-battle">취소</button>
      </div>
      <div style="text-align:center;font-size:11px;color:var(--gutong);margin-top:8px">
        선택한 레벨에 대기자가 있으면 즉시 매칭됩니다.
      </div>
    </div>

    <div class="card fade-in" style="font-size:11px;color:var(--gutong);background:var(--mi)">
      <div style="font-family:var(--font-display);font-size:13px;color:var(--zhusha-d);margin-bottom:4px">對決 규칙</div>
      <div>1. 입장 시 베팅액이 미리 차감(에스크로). 매칭 실패 시 환불.</div>
      <div>2. 5문제 객관식 (작년 기출 + 처방 자동 생성). 시간 제한.</div>
      <div>3. 승자가 패자의 베팅 全額 획득. 무승부면 환불.</div>
      <div>4. 입장 시 캐릭터의 명언이 말풍선에 표시됩니다. (긴박한 戰鬪 BGM)</div>
      <div>5. ${Math.round(MATCH_TIMEOUT_MS/1000)}초 내 매칭 실패 시 자동 환불.</div>
    </div>
  `;
  $$('#bet-grid .bet-cell').forEach(el => {
    el.addEventListener('click', () => {
      if(el.disabled) return;
      selected = el.dataset.id;
      $$('#bet-grid .bet-cell').forEach(x => x.classList.toggle('selected', x.dataset.id === selected));
      // v2.2.2: 선호 level 변경 → idle entry 갱신
      setLobbyIdleLevel(selected);
    });
  });
  $('#cancel-battle').addEventListener('click', () => {
    stopLobbyStreams();
    stopLobbyIdle();
    setTab('hall');
  });
  $('#join-battle').addEventListener('click', () => {
    stopLobbyStreams();
    stopLobbyIdle();
    joinBattleQueue(selected);
  });
  // v2.2.2: SSE 기반 실시간 동기화 + 둘러보는 중 등록
  startLobbyStreams();
  startLobbyIdle(selected);
}
window.openBattleLobby = openBattleLobby;

// v2.2.2: SSE 기반 실시간 대기자/관심자 동기화
//   _lobbyStream      : /lobby      전체 (모든 level) SSE 1개
//   _lobbyIdleStream  : /lobby_idle 전체 SSE 1개
//   _lobbyIdleTimer   : 자기 idle entry 12s keep-alive
function startLobbyStreams(){
  stopLobbyStreams();
  if(!FB) return;
  _lobbyStream     = FB.subscribe('lobby',      renderLobbyStreams);
  _lobbyIdleStream = FB.subscribe('lobby_idle', renderLobbyStreams);
}
function stopLobbyStreams(){
  if(_lobbyStream){     try{ _lobbyStream.close();     }catch(_){} _lobbyStream     = null; }
  if(_lobbyIdleStream){ try{ _lobbyIdleStream.close(); }catch(_){} _lobbyIdleStream = null; }
  if(_lobbyTimer){ clearInterval(_lobbyTimer); _lobbyTimer = null; }
  _lobbyRenderSig = '';
}

// 양쪽 SSE 스냅샷을 합쳐 DOM 일괄 업데이트 (시그니처 비교로 noop 회피)
function renderLobbyStreams(){
  const now   = Date.now();
  const lobby = (_lobbyStream     && _lobbyStream.snapshot)     || {};
  const idle  = (_lobbyIdleStream && _lobbyIdleStream.snapshot) || {};

  // 시그니처
  const idleFresh = [];
  let sig = '';
  for(const [uid, p] of Object.entries(idle)){
    if(!p) continue;
    if((now - (p.ts||0)) < LOBBY_IDLE_FRESH_MS && uid !== S.userId){
      idleFresh.push({uid, ...p});
      sig += `i:${uid}:${p.level||''};`;
    }
  }
  const perLevelQueue = {};
  const perLevelIdle  = {};
  for(const lvl of BET_LEVELS){
    perLevelIdle[lvl.id] = idleFresh.filter(p => p.level === lvl.id);
    const all = lobby[lvl.id] || {};
    const queueFresh = Object.entries(all)
      .map(([uid,p]) => ({uid, ...(p||{})}))
      .filter(p => p && (now - (p.ts||0)) < LOBBY_FRESH_MS);
    perLevelQueue[lvl.id] = queueFresh;
    queueFresh.forEach(p => sig += `q:${lvl.id}:${p.uid};`);
  }
  if(sig === _lobbyRenderSig) return;
  _lobbyRenderSig = sig;

  // 둘러보는 중 배너
  const banner = $('#idle-banner');
  if(banner){
    if(idleFresh.length === 0){
      banner.style.display = 'none';
    } else {
      banner.style.display = '';
      const c = $('#idle-banner-count'); if(c) c.textContent = idleFresh.length;
      const list = $('#idle-banner-list');
      if(list){
        list.innerHTML = idleFresh.slice(0, 12).map(p => {
          const med   = _charMedallion(p.character || 'qibo', 18);
          const lvHan = (BET_LEVELS.find(l => l.id === p.level) || {}).han || '?';
          return `<span class="idle-chip" title="${esc(p.name||'')} · 선호 ${esc(lvHan)} · ${ago(p.ts||0)}">
            ${med}<span class="nm">${esc(p.name||'익명')}</span><span class="lv">${esc(lvHan)}</span>
          </span>`;
        }).join('') + (idleFresh.length > 12 ? `<span class="idle-more">+${idleFresh.length-12}</span>` : '');
      }
    }
  }

  // cell 별 큐/관심 배지 + 리스트
  for(const lvl of BET_LEVELS){
    const qBadge = $(`.waiting-badge[data-level="${lvl.id}"][data-kind="queue"]`);
    const iBadge = $(`.waiting-badge[data-level="${lvl.id}"][data-kind="idle"]`);
    const listEl = $(`.waiting-list[data-list="${lvl.id}"]`);
    const qN = perLevelQueue[lvl.id].length;
    const iN = perLevelIdle[lvl.id].length;
    if(qBadge){ qBadge.textContent = `대기 ${qN}`; qBadge.classList.toggle('zero', qN === 0); }
    if(iBadge){ iBadge.textContent = `관심 ${iN}`; iBadge.classList.toggle('zero', iN === 0); }
    if(listEl){
      const combined = perLevelQueue[lvl.id].map(p => ({...p, _kind:'q'}))
        .concat(perLevelIdle[lvl.id].map(p => ({...p, _kind:'i'})));
      if(combined.length === 0){
        listEl.innerHTML = '<span class="w-empty">대기·관심 없음</span>';
      } else {
        listEl.innerHTML = combined.slice(0, 6).map(p => {
          const med = _charMedallion(p.character || 'qibo', 16);
          const cls = p._kind === 'q' ? 'w-chip q' : 'w-chip i';
          const tip = (p._kind === 'q' ? '入場 대기 · ' : '둘러보는 중 · ') + (p.name||'') + ' · ' + ago(p.ts||0);
          return `<span class="${cls}" title="${esc(tip)}">${med}<span class="nm">${esc(p.name||'익명')}</span></span>`;
        }).join('') + (combined.length > 6 ? `<span class="w-empty" style="font-style:normal">+${combined.length-6}명</span>` : '');
      }
    }
  }
}

// 둘러보는 중 (idle browse) — 入場 누르기 전 로비 체류자
function startLobbyIdle(level){
  if(!FB) return;
  stopLobbyIdle();
  _lobbyIdleLevel = level;
  const writeIdle = () => {
    if(!FB || !_lobbyIdleLevel) return;
    FB.put(`lobby_idle/${S.userId}`, {
      userId: S.userId, name: S.name, character: S.character,
      level: _lobbyIdleLevel, ts: Date.now(),
    }).catch(()=>{});
  };
  writeIdle();
  _lobbyIdleTimer = setInterval(writeIdle, LOBBY_IDLE_REFRESH_MS);
}
function setLobbyIdleLevel(level){
  if(!FB || !_lobbyIdleTimer) return;
  _lobbyIdleLevel = level;
  // 즉시 한 번 갱신해 다른 사용자가 빠르게 알아챌 수 있게
  FB.put(`lobby_idle/${S.userId}`, {
    userId: S.userId, name: S.name, character: S.character,
    level: _lobbyIdleLevel, ts: Date.now(),
  }).catch(()=>{});
}
function stopLobbyIdle(){
  if(_lobbyIdleTimer){ clearInterval(_lobbyIdleTimer); _lobbyIdleTimer = null; }
  if(FB && S.userId){
    // best-effort 정리 (keepalive 로 unload 도 대응)
    FB.delKeepalive(`lobby_idle/${S.userId}`);
  }
  _lobbyIdleLevel = null;
}

// ── legacy 폴링 헬퍼 (joinBattleQueue 가 호출하지 않게 됐으나 fallback 보존)
function startLobbyPoll(){ startLobbyStreams(); }
function stopLobbyPoll(){  stopLobbyStreams(); stopLobbyIdle(); }

// 매칭 큐 — v2.2.2: SSE 기반 실시간 매칭
//   • /lobby/{level} 과 /battles 를 SSE 로 동시 구독
//   • 새 entry 가 떨어지면 즉시 매칭 시도 (race 회피: userId 사전 순 작은 쪽이 방 생성)
//   • 상대가 생성자였을 때도 /battles SSE 가 즉시 알려줌
//   • 무한 로딩 방지: MATCH_TIMEOUT_MS 이내 매칭 실패 시 자동 환불
async function joinBattleQueue(level){
  if(!FB){ toast('Firebase 연결 안됨'); return; }
  const bet = calcBet(level);
  if(S.qi < bet){ toast('氣 부족'); return; }

  // 에스크로 — 즉시 氣 차감 (매칭 실패 시 환불)
  S.qi -= bet;
  saveState(); refreshHeader();

  const startedAt = Date.now();
  const lvlInfo = BET_LEVELS.find(l=>l.id===level);
  view.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">入場</span>대결 대기</h2>
    <div class="view-sub">상대를 찾는 중입니다…</div>
    <div style="text-align:center;margin:36px 0">
      ${taijiSVG(120, true)}
      <div style="font-family:var(--font-display);font-size:14px;color:var(--zhusha-d);margin-top:18px;letter-spacing:.08em">
        ${esc(lvlInfo.han)} · ${bet.toLocaleString()} 氣 <span style="color:var(--gutong);font-size:11px">(에스크로)</span>
      </div>
      <div style="font-size:12px;color:var(--mo-l);margin-top:8px" id="queue-status">대기 중…</div>
      <div style="font-size:11px;color:var(--gutong);margin-top:4px" id="queue-timer"></div>
      <button class="btn btn-o btn-sm" id="leave-queue" style="margin-top:18px">취소 (환불)</button>
    </div>
  `;

  // 큐 등록 정보
  const myEntry = {
    userId: S.userId, name: S.name, character: S.character,
    bet, level, qi: S.qi + bet, ts: Date.now()
  };
  let active = true;
  let cleanedUp = false;
  let matching = false;   // 방 생성 중복 회피 (re-entrancy guard)

  const cleanup = async (refund) => {
    if(cleanedUp) return;
    cleanedUp = true;
    active = false;
    if(_lobbySelfTimer){ clearInterval(_lobbySelfTimer); _lobbySelfTimer = null; }
    if(_lobbyQueueStream){ try{ _lobbyQueueStream.close(); }catch(_){} _lobbyQueueStream = null; }
    if(_battlesStream){    try{ _battlesStream.close();    }catch(_){} _battlesStream    = null; }
    clearInterval(timerDisp);
    try{ await FB.del(`lobby/${level}/${S.userId}`); }catch(_){}
    if(refund){
      S.qi += bet;
      saveState(); refreshHeader();
      toast(`매칭 실패 — ${bet} 氣 환불`,'gold');
    }
  };

  // 1) 큐 등록 (재시도)
  const ok = await FB.putRetry(`lobby/${level}/${S.userId}`, myEntry, {tries:3, backoffMs:400});
  if(!ok.ok){
    await cleanup(true);
    const reason = ok.status === 401 || ok.status === 403
      ? 'Firebase 보안 룰이 lobby 쓰기를 막고 있습니다. 관리자에게 룰 확인을 요청하세요.'
      : (ok.message || '네트워크 오류 — 잠시 후 다시 시도하세요.');
    view.innerHTML = `
      <h2 class="view-title fade-in"><span class="han">阻</span>큐 등록 실패</h2>
      <div class="card imperial fade-in" style="text-align:center;padding:22px">
        <div style="font-size:14px;color:var(--mo-l);margin-bottom:6px">${esc(reason)}</div>
        <div style="font-size:11.5px;color:var(--gutong);margin-bottom:14px">
          ${ok.status ? 'HTTP ' + ok.status + ' · ' : ''}재시도 ${ok.retries}회
        </div>
        <div class="seal" style="font-size:16px;color:var(--feicui)">+${bet} 氣 환불 완료</div>
        <div style="margin-top:14px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
          <button class="btn" onclick="openBattleLobby()">다시 시도</button>
          <button class="btn btn-o" onclick="setTab('hall')">명예의 전당</button>
        </div>
      </div>
    `;
    return;
  }

  // 2) 자기 entry keep-alive (15초마다 ts 갱신)
  _lobbySelfTimer = setInterval(async () => {
    if(!active) return;
    try{ await FB.put(`lobby/${level}/${S.userId}`, {...myEntry, ts: Date.now()}); }catch(_){}
  }, 15 * 1000);

  // 3) 취소 버튼
  $('#leave-queue').addEventListener('click', async () => {
    await cleanup(true);
    setTab('hall');
  });

  // 4) 타임아웃 시계 표시
  const timerDisp = setInterval(async () => {
    const el = $('#queue-timer');
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remain = Math.max(0, Math.ceil(MATCH_TIMEOUT_MS/1000) - elapsed);
    if(el) el.textContent = `경과 ${elapsed}초 · ${remain}초 후 자동 환불`;
    if(elapsed * 1000 > MATCH_TIMEOUT_MS && active){
      await cleanup(true);
      view.innerHTML = `
        <h2 class="view-title fade-in"><span class="han">流</span>매칭 실패</h2>
        <div class="card imperial fade-in" style="text-align:center;padding:22px">
          <div style="font-size:14px;color:var(--mo-l);margin-bottom:10px">${Math.round(MATCH_TIMEOUT_MS/1000)}초 동안 상대를 찾지 못했습니다.</div>
          <div class="seal" style="font-size:18px;color:var(--feicui)">+${bet} 氣 환불 완료</div>
          <div style="margin-top:14px;display:flex;gap:6px;justify-content:center">
            <button class="btn" onclick="openBattleLobby()">다시 시도</button>
            <button class="btn btn-o" onclick="setTab('hall')">명예의 전당</button>
          </div>
        </div>
      `;
    }
  }, 1000);

  // 5) /battles SSE — 상대가 방 생성자였을 때 즉시 감지
  const onBattlesSnap = (battles) => {
    if(!active || matching) return;
    if(!battles) return;
    const myRoom = Object.values(battles).find(r => r && r.players && r.players[S.userId] && r.status !== 'done');
    if(myRoom){
      matching = true;
      const status = $('#queue-status'); if(status) status.textContent = '방 발견 — 입장 중…';
      // cleanup 은 cleanedUp 플래그로 중복 호출 보호되므로 안전
      (async () => {
        await cleanup(false);  // 환불 안 함 (실제 매칭 성공)
        startBattle(myRoom.roomId, false);
      })();
    }
  };
  _battlesStream = FB.subscribe('battles', onBattlesSnap);

  // 6) /lobby/{level} SSE — 상대 발견 시 사전순 작은 쪽이 방 생성
  const onLobbySnap = async (all) => {
    if(!active || matching) return;
    if(!all){
      const status = $('#queue-status'); if(status) status.textContent = '대기 중…';
      return;
    }
    const now = Date.now();
    const others = Object.values(all)
      .filter(p => p && p.userId !== S.userId && (now - (p.ts||0)) < LOBBY_FRESH_MS)
      .sort((a,b) => (a.ts||0) - (b.ts||0));
    if(others.length === 0){
      const status = $('#queue-status'); if(status) status.textContent = '대기 중…';
      return;
    }
    const opp = others[0];
    if(S.userId < opp.userId){
      // 내가 방 생성자
      if(matching) return;
      matching = true;
      const status = $('#queue-status'); if(status) status.textContent = `상대 발견 (${esc(opp.name||'')}) — 방 생성 중…`;
      const roomId = 'r_' + Math.random().toString(36).slice(2,8) + Date.now().toString(36).slice(-4);
      const room = {
        roomId, level, bet, status: 'starting',
        players: {
          [S.userId]:  { userId:S.userId,  name:S.name,  character:S.character,  score:0, qi:S.qi+bet, bet, done:false },
          [opp.userId]:{ userId:opp.userId,name:opp.name,character:opp.character,score:0, qi:opp.qi,    bet, done:false },
        },
        questions: generateBattleQuestions(5),
        createdAt: Date.now()
      };
      const created = await FB.putRetry(`battles/${roomId}`, room, {tries:3, backoffMs:300});
      if(!created.ok){
        // 방 생성 실패 — matching flag 해제하고 SSE 다음 스냅샷에서 재시도
        matching = false;
        const st = $('#queue-status'); if(st) st.textContent = `방 생성 실패 (HTTP ${created.status||'?'}) — 재시도 대기`;
        return;
      }
      // 양쪽 큐 entry 제거 (각자 노력 — 상대가 실패해도 자기는 정리됨)
      try{ await FB.del(`lobby/${level}/${S.userId}`); }catch(_){}
      try{ await FB.del(`lobby/${level}/${opp.userId}`); }catch(_){}
      await cleanup(false);  // 환불 안 함 (정상 매칭)
      startBattle(roomId, true);
    } else {
      // 상대가 방 생성자 — _battlesStream 이 곧 잡아냄
      const status = $('#queue-status'); if(status) status.textContent = `상대 발견 (${esc(opp.name||'')}) — 방 생성 대기…`;
    }
  };
  _lobbyQueueStream = FB.subscribe(`lobby/${level}`, onLobbySnap);
}

// 배틀 문제 생성 (기출/자동) — 데이터가 있으면 사용, 없으면 placeholder


async function startBattle(roomId, isCreator){
  const room = await FB.get(`battles/${roomId}`);
  if(!room){ toast('방을 찾을 수 없음'); setTab('hall'); return; }
  _battle = { roomId, isCreator, room };
  // 戰鬪 BGM 시작 — 긴박감 (사용자 토글과 무관하게 켜짐)
  try{ bgm.startBattle(); }catch(_){}
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
        // 오답 기록 (개인 + 글로벌 통계) — v2.2.2: 콘텐츠 해시 qid
        if(!correct){
          const qid = qidOf(q);
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
      <div style="margin-top:12px;color:var(--mo-l);font-size:12px" id="judging-status">상대 결과 대기…</div></div>
    `;
    // 내 점수 기록
    await FB.put(`battles/${roomId}/players/${S.userId}/score`, myScore);
    await FB.put(`battles/${roomId}/players/${S.userId}/done`, true);
    // 폴링 — 최대 30초 대기 후 강제 종료 (상대 disconnect 시 부전승)
    const MAX_TRIES = 20;
    const POLL_MS = 1500;
    let tries = 0;
    async function pollEnd(){
      tries++;
      const r = await FB.get(`battles/${roomId}`);
      if(!r){
        // 방이 사라짐 → 패배 처리 안 함, 환불 (에스크로 복구)
        S.qi += room.bet;
        saveState(); refreshHeader();
        bgm.stopBattle();
        toast('방이 사라졌습니다 — 베팅 환불','gold');
        setTab('hall');
        return;
      }
      const players = r.players || {};
      const allDone = Object.values(players).every(p => p.done);
      if(allDone){
        showResult(r, false);
        return;
      }
      if(tries > MAX_TRIES){
        // 상대 타임아웃 → 부전승 (forfeit)
        showResult(r, true);
        return;
      }
      const elapsed = tries * POLL_MS / 1000;
      const st = $('#judging-status');
      if(st) st.textContent = `상대 결과 대기… (${elapsed.toFixed(0)}초)`;
      setTimeout(pollEnd, POLL_MS);
    }
    pollEnd();
  }

  async function showResult(room, forfeit){
    bgm.stopBattle();  // 戰鬪 BGM 종료 → ambient 복귀
    const players = room.players;
    const me = players[S.userId];
    const oppId = Object.keys(players).find(k => k !== S.userId);
    const opp = players[oppId];
    const bet = room.bet;
    let outcome = 'draw';
    let deltaQi = 0;          // 사용자 노출용: 진입 전 대비 변화
    let qiAdjust = 0;          // 에스크로 후 추가 조정량

    if(forfeit && (!opp.done)){
      outcome = 'win';
      deltaQi = bet;
      qiAdjust = bet * 2;       // 에스크로 환불 + 상대 베팅 흡수
    } else if(me.score > (opp.score||0)){
      outcome = 'win';  deltaQi = bet;  qiAdjust = bet * 2;
    } else if(me.score < (opp.score||0)){
      outcome = 'lose'; deltaQi = -bet; qiAdjust = 0;            // 에스크로로 이미 차감됨
    } else {
      outcome = 'draw'; deltaQi = 0;   qiAdjust = bet;            // 환불
    }

    // 氣 정산 (에스크로 후 추가 조정)
    S.qi += qiAdjust;
    if(S.qi < 0) S.qi = 0;
    // 배틀 히스토리
    S.battleHistory = S.battleHistory || [];
    S.battleHistory.unshift({
      ts: Date.now(), win: outcome === 'win', draw: outcome === 'draw', forfeit: !!forfeit,
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
    const titleKo = outcome === 'win' ? (forfeit?'부전승':'승리') : (outcome === 'lose' ? '패배' : '무승부');
    view.innerHTML = `
      <h2 class="view-title fade-in"><span class="han">${titleHan}</span>${esc(titleKo)}</h2>
      <div class="card imperial fade-in" style="text-align:center;padding:24px 14px">
        <div class="seal-stamp big" style="background:${outcome==='win'?'var(--huang)':(outcome==='lose'?'var(--zhusha-d)':'var(--gutong)')};color:var(--mi-w);margin:0 auto 12px">${titleHan}</div>
        <div style="font-size:30px;font-family:var(--font-display);color:${deltaQi>0?'var(--feicui)':(deltaQi<0?'var(--zhusha)':'var(--gutong)')}">
          ${deltaQi>0?'+':''}${deltaQi} 氣
        </div>
        <div style="margin-top:6px;font-size:13px;color:var(--mo-l)">베팅 ${bet.toLocaleString()} 氣 · 현재 ${S.qi.toLocaleString()} 氣${forfeit?'<br><span style="color:var(--gutong);font-size:11px;font-style:italic">(상대 응답 없음 — 부전승)</span>':''}</div>
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
          <div class="seal" style="font-size:22px;color:var(--zhusha-d)">${opp.score||0}${forfeit?' <span style="font-size:10px;color:var(--gutong)">(미응답)</span>':''}</div>
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
    <div class="view-sub">전체 학습자 데이터 + 기출·약재·처방별 시각화</div>

    <!-- 메뉴 -->
    <div class="tile-grid fade-in">
      <button class="tile" type="button" data-stab="wrongs">
        <span class="han">難題</span><span class="ttl">전체 오답 랭킹</span>
        <span class="desc">가장 많이 틀린 문제 TOP 30 · 클릭하면 해당 문제</span>
      </button>
      <button class="tile" type="button" data-stab="exam">
        <span class="han">問</span><span class="ttl">기출 분석</span>
        <span class="desc">유형·章·처방·난이도 분포</span>
      </button>
      <button class="tile" type="button" data-stab="formula">
        <span class="han">析</span><span class="ttl">처방별 심층</span>
        <span class="desc">처방마다 기출·유형·글로벌 오답률</span>
      </button>
      <button class="tile" type="button" data-stab="herb">
        <span class="han">本草</span><span class="ttl">약재 분석</span>
        <span class="desc">빈출 약재 · 君臣佐使 · 처방내 쓰임</span>
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
  if(kind === 'wrongs')  return renderWrongsRank(det);
  if(kind === 'exam')    return renderExamAnalysis(det);
  if(kind === 'formula') return renderFormulaIndex(det);
  if(kind === 'herb')    return renderHerbAnalysis(det);
}

// v2.2.2: 처방별 심층 분석 — 약재 분석 패턴 그대로, 5종 시각화
//   ① 効能 카테고리 그리드 — 補氣·補血·解表·溫裏·... 별 처방 클러스터
//   ② 章·分類 — chapter sub-category 별 그룹
//   ③ 補瀉×寒熱 scatter — 처방마다 action 키워드로 좌표 산출
//   ④ 구성 약재 수 분포 — 軆方의 크기
//   ⑤ 君藥 빈도 — 全 처방의 君藥 TOP
async function renderFormulaIndex(det){
  const formulas = (typeof FORMULAS    !== 'undefined') ? FORMULAS    : [];
  const exams    = (typeof PAST_EXAMS  !== 'undefined') ? PAST_EXAMS  : [];
  if(!formulas.length){
    det.innerHTML = `<div class="card"><div class="card-title"><span class="han">析</span> 처방별 분석</div><div style="font-size:12.5px;color:var(--gutong);text-align:center;padding:16px">data-formulas.js 의 FORMULAS 가 필요합니다.</div></div>`;
    return;
  }

  // 글로벌 오답 ─ 처방마다 (해당 처방의 past_* qid 합산)
  let wrongMap = {};
  if(FB){ try{ const w = await FB.get('stats/wrongs'); if(w) wrongMap = w; }catch(_){} }
  const totalWrongFor = (name) => exams
    .filter(e => e.formula === name)
    .reduce((s, e) => s + (Number(wrongMap[e.id])||0), 0);
  const examCountFor = (name) => exams.filter(e => e.formula === name).length;

  // 각 처방의 effect 카테고리
  const formulaEffs = formulas.map(f => ({
    f, effs: efficaciesOfText(f.action || ''),
    examN: examCountFor(f.ko),
    wrongN: totalWrongFor(f.ko),
  }));

  // ① 効能 → 처방 역인덱스
  const effIdx = {};
  EFFICACY_CATS.forEach(c => effIdx[c.id] = []);
  formulaEffs.forEach(fe => fe.effs.forEach(eid => effIdx[eid].push(fe)));

  // ② chapter sub-category (·뒤) 그룹
  const subIdx = {};
  formulas.forEach(f => {
    const ch = f.chapter || '';
    // "8장 補益劑·補氣" → main "8장 補益劑", sub "補氣"
    const parts = ch.split('·');
    const main = parts[0] || '?';
    const sub  = parts[1] || '기타';
    const key  = `${main} · ${sub}`;
    (subIdx[key] = subIdx[key] || []).push(f);
  });
  // chapter 순서 보존 (data 순)
  const subOrder = [];
  formulas.forEach(f => {
    const ch = f.chapter || '';
    const parts = ch.split('·');
    const key = `${parts[0]||'?'} · ${parts[1]||'기타'}`;
    if(!subOrder.includes(key)) subOrder.push(key);
  });

  // ③ scatter 좌표 산출 — 補瀉(x) × 寒熱(y)
  // 補類: buqi/buxue/buyin/buyang → x −1; 瀉類: xiexia/qingre → x +1; 解表 → x +0.5; 和裏 → x 0
  // 寒類: qingre → y −1; 溫類: wenli/buyang → y +1; 平 → y 0
  const X_BU = new Set(['buqi','buxue','buyin','buyang']);
  const X_XIE = new Set(['xiexia','qingre']);
  const X_JIEBIAO = new Set(['jiebiao']);
  const Y_RE = new Set(['wenli','buyang']);
  const Y_HAN = new Set(['qingre']);
  function scatterScore(fe){
    let x = 0, y = 0;
    fe.effs.forEach(e => {
      if(X_BU.has(e)) x -= 1;
      if(X_XIE.has(e)) x += 1;
      if(X_JIEBIAO.has(e)) x += 0.6;
      if(Y_RE.has(e)) y += 1;
      if(Y_HAN.has(e)) y -= 1;
    });
    // chapter 보정 (溫裏劑 章은 강한 溫 가중)
    const ch = fe.f.chapter || '';
    if(ch.includes('溫裏劑')) y += 0.6;
    if(ch.includes('溫經散寒')) y += 0.4;
    if(ch.includes('表裏雙解')) x += 0.4;
    if(ch.includes('補益劑')) x -= 0.4;
    // clamp [-2, +2]
    return { x: Math.max(-2, Math.min(2, x)), y: Math.max(-2, Math.min(2, y)) };
  }
  const scatter = formulaEffs.map(fe => ({...fe, ...scatterScore(fe)}));
  function xPct(n){ return (8 + ((n+2)/4)*84).toFixed(2); }
  function yPct(n){ return (88 - ((n+2)/4)*72).toFixed(2); }  // 위가 +熱

  // ④ 구성 크기 distribution
  const sizeBins = {};
  formulas.forEach(f => {
    const k = (f.composition || []).length;
    const bin = k <= 3 ? '≤3' : k <= 5 ? '4–5' : k <= 7 ? '6–7' : k <= 10 ? '8–10' : '≥11';
    sizeBins[bin] = (sizeBins[bin]||0) + 1;
  });
  const sizeOrder = ['≤3','4–5','6–7','8–10','≥11'];

  // ⑤ 君藥 빈도
  const junIdx = {};
  formulas.forEach(f => {
    const ms = f.monarch_minister || {};
    const jun = ms['君'] || [];
    (Array.isArray(jun) ? jun : [jun]).forEach(h => {
      const name = (typeof h === 'string' ? h : (h && (h.han||h.ko)) || '?').replace(/\([^)]*\)/g,'').trim();
      if(!name) return;
      (junIdx[name] = junIdx[name] || []).push(f);
    });
  });
  const junTop = Object.entries(junIdx).sort((a,b)=>b[1].length-a[1].length).slice(0, 12);
  const junMax = junTop[0]?.[1].length || 1;

  // 가감방 (FORMULAS 에 없는데 PAST_EXAMS 에 있는 처방)
  const known = new Set(formulas.map(f => f.ko));
  const extraFormulas = Array.from(new Set(exams.map(e => e.formula).filter(Boolean)))
    .filter(name => !known.has(name));

  // ── 처방 칩 (모든 시각화에서 공통)
  const formulaChip = (fe, opts = {}) => {
    const cls = opts.small ? 'fchip small' : 'fchip';
    const wn = fe.wrongN || 0;
    const en = fe.examN  || 0;
    const heat = wn > 0 ? Math.min(1, wn/20) : 0;
    return `<button class="${cls}" type="button" data-formula="${esc(fe.f.ko)}" style="--heat:${heat.toFixed(2)}">
      <span class="han">${esc(fe.f.han)}</span>
      <span class="ko">${esc(fe.f.ko)}</span>
      ${en > 0 ? `<span class="badge q">問${en}</span>` : ''}
      ${wn > 0 ? `<span class="badge w">錯${wn}</span>` : ''}
    </button>`;
  };

  det.innerHTML = `
    <div class="card fade-in">
      <div class="card-title">
        <span class="han">析</span> 처방별 심층 분석 (${formulas.length}처방)
      </div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:8px">
        효능별·章별·補瀉×寒熱 좌표로 시각화. 처방을 클릭하면 구성·기출·글로벌 오답률 모달이 열립니다.
      </div>
      <div class="subtab-row" id="fidx-subtab">
        <button class="subtab-btn on" data-k="eff">効能 클러스터</button>
        <button class="subtab-btn"    data-k="chapter">章·分類</button>
        <button class="subtab-btn"    data-k="scatter">補瀉×寒熱</button>
        <button class="subtab-btn"    data-k="size">구성 크기</button>
        <button class="subtab-btn"    data-k="jun">君藥 빈도</button>
      </div>
      <div id="fidx-detail"></div>
    </div>
    ${extraFormulas.length ? `
      <div class="card fade-in">
        <div class="card-title"><span class="han">加</span> 가감방·기타 (PAST_EXAMS only, ${extraFormulas.length}처방)</div>
        <div class="fchip-grid">
          ${extraFormulas.map(name => {
            const fe = {f:{ko:name, han:name}, examN: examCountFor(name), wrongN: totalWrongFor(name)};
            return formulaChip(fe, {small:true});
          }).join('')}
        </div>
      </div>
    ` : ''}
  `;

  const detEl = $('#fidx-detail');

  const viewEff = () => {
    const cats = EFFICACY_CATS.filter(c => effIdx[c.id].length > 0);
    return `
      <div class="fidx-eff-grid">
        ${cats.map(c => `
          <div class="fidx-eff-cell" style="--cat-color:${c.color}">
            <div class="fidx-eff-head">
              <span class="han">${esc(c.han)}</span>
              <span class="cnt">${effIdx[c.id].length}처방</span>
            </div>
            <div class="fchip-grid">
              ${effIdx[c.id]
                .sort((a,b) => (b.wrongN||0) - (a.wrongN||0))
                .map(fe => formulaChip(fe, {small:true})).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div style="font-size:10.5px;color:var(--gutong);margin-top:8px;font-style:italic">
        ※ 한 처방이 여러 효능에 동시 매칭될 수 있습니다 (예: 보중익기탕 = 補氣 + 升陽).
      </div>
    `;
  };

  const viewChapter = () => `
    <div class="fidx-ch-list">
      ${subOrder.map(key => `
        <div class="fidx-ch-cell">
          <div class="fidx-ch-head">${esc(key)} <span class="cnt">${subIdx[key].length}처방</span></div>
          <div class="fchip-grid">
            ${subIdx[key].map(f => {
              const fe = formulaEffs.find(x => x.f === f);
              return formulaChip(fe || {f, examN:0, wrongN:0});
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  const viewScatter = () => `
    <div class="fidx-scatter">
      <div class="axis axis-x"></div>
      <div class="axis axis-y"></div>
      <span class="axis-tick t-left">補</span>
      <span class="axis-tick t-right">瀉/解</span>
      <span class="axis-tick t-top">熱·溫</span>
      <span class="axis-tick t-bot">寒·涼</span>
      <span class="axis-tick t-center">和裏·平</span>
      ${scatter.map(fe => {
        const ch = fe.f.chapter || '';
        const grp = ch.includes('補益劑') ? 'bu' : ch.includes('溫裏劑') ? 'wen' : ch.includes('表裏雙解') ? 'biao' : 'other';
        return `<button class="fidx-dot grp-${grp}" type="button"
                  data-formula="${esc(fe.f.ko)}"
                  style="left:${xPct(fe.x)}%;top:${yPct(fe.y)}%"
                  title="${esc(fe.f.ko)} (${esc(fe.f.action||'')})">
          <span class="han">${esc(fe.f.han.slice(0, 2))}</span>
          <span class="lbl">${esc(fe.f.ko)}</span>
        </button>`;
      }).join('')}
    </div>
    <div class="fidx-scatter-legend">
      <span class="lg-dot bu"></span>補益劑
      <span class="lg-dot wen"></span>溫裏劑
      <span class="lg-dot biao"></span>表裏雙解劑
    </div>
    <div style="font-size:10.5px;color:var(--gutong);margin-top:6px;font-style:italic">
      ※ x = action 키워드 기반 補(−) ↔ 瀉/解(+), y = 寒(−) ↔ 熱(+). chapter 가중 포함.
    </div>
  `;

  const viewSize = () => {
    const max = Math.max(...Object.values(sizeBins), 1);
    return `
      <div style="margin-bottom:8px"><b style="font-size:13px;color:var(--zhusha-d)">구성 약재 수 분포</b>
        <div style="font-size:11px;color:var(--gutong)">${formulas.length}처방의 軆方 크기. 4–7味가 中道.</div>
      </div>
      <div class="bar-chart">
        ${sizeOrder.filter(k => sizeBins[k]).map(k => `
          <div class="bar-row">
            <span class="bar-label">${esc(k)} 味</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(sizeBins[k]/max)*100}%">${sizeBins[k]}</div></div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:14px"><b style="font-size:13px;color:var(--zhusha-d)">大方·小方</b></div>
      <div class="fchip-grid">
        ${[...formulaEffs].sort((a,b) => (b.f.composition?.length||0) - (a.f.composition?.length||0))
          .slice(0, 10).map(fe => formulaChip({...fe, examN:0, wrongN: (fe.f.composition||[]).length}, {small:true})).join('')}
      </div>
      <div style="font-size:10.5px;color:var(--gutong);margin-top:6px;font-style:italic">
        ※ 칩 우측 숫자 = 구성 약재 수.
      </div>
    `;
  };

  const viewJun = () => `
    <div style="margin-bottom:8px"><b style="font-size:13px;color:var(--zhusha-d)">君藥 빈도 TOP ${junTop.length}</b>
      <div style="font-size:11px;color:var(--gutong)">전체 처방에서 君으로 쓰인 약재. 君藥을 알면 처방의 主治가 보임.</div>
    </div>
    <div class="bar-chart">
      ${junTop.map(([name, fs]) => `
        <div class="bar-row clickable" data-jun="${esc(name)}">
          <span class="bar-label">${esc(name)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(fs.length/junMax)*100}%">${fs.length}</div></div>
        </div>
      `).join('')}
    </div>
    <div id="fidx-jun-detail" style="margin-top:10px"></div>
  `;

  const renderers = { eff: viewEff, chapter: viewChapter, scatter: viewScatter, size: viewSize, jun: viewJun };

  function show(k){
    detEl.innerHTML = renderers[k]();
    $$('#fidx-subtab .subtab-btn').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    // 클릭 핸들러 — 처방 칩·점 → openFormulaDeep
    $$('#fidx-detail .fchip, #fidx-detail .fidx-dot').forEach(b => {
      b.addEventListener('click', () => openFormulaDeep(b.dataset.formula));
    });
    // 君藥 막대 → 해당 君을 쓰는 처방 펼치기
    if(k === 'jun'){
      $$('#fidx-detail .bar-row[data-jun]').forEach(row => {
        row.addEventListener('click', () => {
          const name = row.dataset.jun;
          const fs = junIdx[name] || [];
          const target = $('#fidx-jun-detail');
          target.innerHTML = `
            <div style="font-size:12px;color:var(--mo);margin-bottom:6px"><b>${esc(name)}</b> 君藥인 처방 (${fs.length})</div>
            <div class="fchip-grid">${fs.map(f => {
              const fe = formulaEffs.find(x => x.f === f) || {f, examN:0, wrongN:0};
              return formulaChip(fe, {small:true});
            }).join('')}</div>
          `;
          $$('#fidx-jun-detail .fchip').forEach(b => {
            b.addEventListener('click', () => openFormulaDeep(b.dataset.formula));
          });
        });
      });
    }
  }
  $$('#fidx-subtab .subtab-btn').forEach(b => b.addEventListener('click', () => show(b.dataset.k)));
  show('eff');

  // 가감방 카드의 칩 클릭
  $$('.card .fchip-grid > .fchip').forEach(b => {
    if(b.closest('#fidx-detail')) return;  // 본 카드 칩은 show() 가 바인딩
    b.addEventListener('click', () => openFormulaDeep(b.dataset.formula));
  });
}

// v2.2.2: 오답 빈도 분석 — qid lookup, 클릭 → 문제 모달
async function renderWrongsRank(det){
  det.innerHTML = `<div class="card fade-in"><div class="card-title"><span class="han">難題</span> 전체 학습자 오답 랭킹</div><div style="text-align:center;padding:20px;color:var(--gutong)">불러오는 중…</div></div>`;
  if(!FB){ det.innerHTML = `<div class="card">Firebase 미연결</div>`; return; }
  const wrongs = await FB.get('stats/wrongs');
  if(!wrongs){
    det.innerHTML = `<div class="card"><div class="card-title"><span class="han">難題</span> 전체 오답 랭킹</div><div style="font-size:12.5px;color:var(--gutong);text-align:center;padding:16px">아직 데이터가 없습니다. 객관식 풀이를 시작하세요.</div></div>`;
    return;
  }
  const exams = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const byId = new Map(exams.map(e => [e.id, e]));
  const list = Object.entries(wrongs)
    .map(([qid, count]) => ({qid, count: Number(count)||0}))
    .filter(x => x.count > 0)
    .sort((a,b) => b.count - a.count)
    .slice(0, 30);

  // 카테고리: 기출(past_*) / 자동생성(auto:*) / 기타
  const annotate = (it) => {
    if(it.qid.startsWith('past_')){
      const ex = byId.get(it.qid);
      if(ex){
        return {
          ...it, kind:'past', exam: ex,
          label: `${ex.formula || '?'} · ${ex.type || '?'}`,
          sub:   `${ex.src || ''} · 난이도 ${ex.difficulty || '?'} · ${(ex.q||'').slice(0,40)}…`,
        };
      }
      return {...it, kind:'past-missing', label: it.qid, sub:'(데이터에서 제거됨)'};
    }
    if(it.qid.startsWith('auto:')){
      return {...it, kind:'auto', label:'자동 생성 문제', sub:'재현 불가 (즉석 생성, 콘텐츠 해시)'};
    }
    return {...it, kind:'other', label: it.qid, sub:''};
  };
  const rows = list.map(annotate);
  const max = rows[0]?.count || 1;
  const npast = rows.filter(r => r.kind==='past').length;
  const nauto = rows.filter(r => r.kind==='auto').length;

  det.innerHTML = `
    <div class="card fade-in">
      <div class="card-title"><span class="han">難題</span> 가장 많이 틀린 문제 TOP ${rows.length}</div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:8px">
        기출 ${npast}건 · 자동생성 ${nauto}건 · 클릭 시 상세
      </div>
      <div class="wrong-list" id="wrong-list">
        ${rows.map((r, i) => {
          const w = (r.count / max) * 100;
          const clickable = r.kind === 'past';
          return `<div class="wrong-row ${clickable?'clickable':'dim'}" data-qid="${esc(r.qid)}" data-kind="${r.kind}">
            <div class="rank">${i+1}</div>
            <div class="meta">
              <div class="lbl">${esc(r.label)}${clickable?' <span class="chev">›</span>':''}</div>
              <div class="sub">${esc(r.sub)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
            </div>
            <div class="cnt">${r.count}<span>회</span></div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
  // 클릭 핸들러
  $$('#wrong-list .wrong-row').forEach(row => {
    row.addEventListener('click', () => {
      const qid = row.dataset.qid;
      const kind = row.dataset.kind;
      if(kind === 'past'){
        const ex = byId.get(qid);
        if(ex) openWrongDetailModal(ex, Number(wrongs[qid])||0);
      } else if(kind === 'auto'){
        toast('자동 생성 문제는 즉석 생성되므로 원본 복원 불가','gold');
      } else {
        toast(`${qid} — 데이터 없음`);
      }
    });
  });
}

// v2.2.2: 오답 문제 상세 모달 — 정답·해설·풀이 시작
function openWrongDetailModal(ex, globalCount){
  const correctIdx = ex.answer || 0;
  const ch = ex.chapter || '?';
  const html = `
    <div class="modal-head">
      <div class="modal-tag">${esc(ex.src||'')} · 난이도 ${ex.difficulty||1} · ${esc(ex.type||'기타')}</div>
      <h3 class="modal-title"><span class="han" style="margin-right:6px">問</span>${esc(ex.formula||'?')}</h3>
      <div class="modal-sub">${esc(ch)} · 전체 학습자 누적 오답 <b style="color:var(--zhusha-d)">${globalCount}</b>회</div>
    </div>
    <div class="modal-body">
      <div class="wrong-q">${esc(ex.q||'')}</div>
      <div class="wrong-opts">
        ${(ex.options||[]).map((o, i) => `
          <div class="wrong-opt ${i===correctIdx?'ok':''}">
            <span class="oi">${'①②③④⑤⑥'[i]||(i+1)}</span>
            <span class="ot">${esc(o)}</span>
            ${i===correctIdx?'<span class="ob">정답</span>':''}
          </div>
        `).join('')}
      </div>
      <div class="wrong-expl">
        <div class="lbl"><span class="han">解</span> 해설</div>
        <div class="txt">${esc(ex.explanation||'(해설 없음)')}</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-sm" onclick="closeModal(); openFormulaDeep('${esc(ex.formula||'')}')">
          <span class="han">析</span> ${esc(ex.formula||'')} 처방 심층 분석
        </button>
        <button class="btn btn-sm btn-o" onclick="closeModal()">닫기</button>
      </div>
    </div>
  `;
  openModal(html);
}

// ─── 기출 분석 v2.2 ──────────────────────────────────────────────────────
// 모든 년도 기출 + 유형·章·처방·난이도별 분포. sub-tabs 로 5종 차트 전환.
function renderExamAnalysis(det){
  const exams = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  if(!exams.length){
    det.innerHTML = `<div class="card"><div class="card-title"><span class="han">問</span> 기출 분석</div><div style="font-size:12.5px;color:var(--gutong);text-align:center;padding:16px">data-formulas.js 에 PAST_EXAMS 배열이 필요합니다.</div></div>`;
    return;
  }

  // 년도·시험 추출 (src: "22-2 1차수시", "22-1 기말고사", "심화" 등)
  function srcYear(src){
    const m = (src||'').match(/^(\d{2})/);
    return m ? `20${m[1]}` : (src && src.startsWith('심화') ? '심화' : '기타');
  }
  function srcExam(src){
    // 22-2 1차수시 → "22-2 1차수시", 심화 → "심화"
    return src || '기타';
  }

  // 집계
  const byYear     = {};
  const byExam     = {};
  const byType     = {};
  const byFormula  = {};
  const byChapter  = {};
  const byDiff     = {};
  exams.forEach(e => {
    const y = srcYear(e.src);
    const ex = srcExam(e.src);
    const ty = e.type || '기타';
    const fo = e.formula || '기타';
    const ch = (e.chapter||'').split('-')[0] || '?';
    const d  = e.difficulty || 1;
    byYear[y] = (byYear[y]||0)+1;
    byExam[ex] = (byExam[ex]||0)+1;
    byType[ty] = (byType[ty]||0)+1;
    byFormula[fo] = (byFormula[fo]||0)+1;
    byChapter[ch] = (byChapter[ch]||0)+1;
    byDiff[d] = (byDiff[d]||0)+1;
  });

  const bar = (arr, maxOverride) => {
    const max = maxOverride || (arr[0]?.[1] || 1);
    return `<div class="bar-chart">${arr.map(([k,v]) => `
      <div class="bar-row">
        <span class="bar-label">${esc(k)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%">${v}</div></div>
      </div>
    `).join('')}</div>`;
  };

  const sort = (obj, lim) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0, lim||999);

  det.innerHTML = `
    <div class="card fade-in">
      <div class="card-title"><span class="han">問</span> 기출 ${exams.length}문 종합 분석</div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:8px">${Object.keys(byExam).length}회 시험 · ${Object.keys(byFormula).length}처방 · ${Object.keys(byType).length}유형</div>
      <div class="subtab-row" id="exam-subtab">
        <button class="subtab-btn on" data-k="exam">시험회차</button>
        <button class="subtab-btn" data-k="year">년도별</button>
        <button class="subtab-btn" data-k="formula">처방별</button>
        <button class="subtab-btn" data-k="type">유형별</button>
        <button class="subtab-btn" data-k="chapter">章별</button>
        <button class="subtab-btn" data-k="difficulty">난이도</button>
      </div>
      <div id="exam-detail"></div>
    </div>
  `;

  const detEl = $('#exam-detail');
  const charts = {
    exam:       () => `<div><b style="font-size:13px;color:var(--zhusha-d)">시험 회차별 출제 수</b><div style="font-size:11px;color:var(--gutong);margin-bottom:6px">모든 년도 시험을 포함합니다 (${exams.length}문)</div>${bar(sort(byExam))}</div>`,
    year:       () => `<div><b style="font-size:13px;color:var(--zhusha-d)">년도별 출제 수</b>${bar(sort(byYear))}</div>`,
    formula:    () => `<div>
        <b style="font-size:13px;color:var(--zhusha-d)">처방별 출제 빈도 (전체 ${Object.keys(byFormula).length}처방)</b>
        <div style="font-size:11px;color:var(--gutong);margin-bottom:6px">처방을 클릭하면 심층 분석 (기출 문제·유형·오답률 등)</div>
        <div class="bar-chart formula-bars">
          ${sort(byFormula, 30).map(([k,v]) => {
            const max = sort(byFormula)[0][1];
            return `<div class="bar-row clickable" data-formula="${esc(k)}" role="button" tabindex="0">
              <span class="bar-label">${esc(k)} <span class="chev">›</span></span>
              <div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%">${v}</div></div>
            </div>`;
          }).join('')}
        </div>
      </div>`,
    type:       () => `<div><b style="font-size:13px;color:var(--zhusha-d)">유형별 분포</b>${bar(sort(byType))}</div>`,
    chapter:    () => `<div><b style="font-size:13px;color:var(--zhusha-d)">章별 분포</b><div style="font-size:11px;color:var(--gutong);margin-bottom:6px">6장 溫經散寒·7장 表裏雙解·8장 補益</div>${bar(sort(byChapter))}</div>`,
    difficulty: () => {
      const dm = (typeof DIFFICULTY_META !== 'undefined') ? DIFFICULTY_META : {1:{ko:'초급',han:'初級'},2:{ko:'중급',han:'中級'},3:{ko:'고급',han:'高級'},4:{ko:'지옥',han:'地獄'}};
      const arr = [1,2,3,4].map(d => [`${dm[d].han} ${dm[d].ko}`, byDiff[d]||0]);
      return `<div><b style="font-size:13px;color:var(--zhusha-d)">난이도별 분포</b>${bar(arr)}</div>`;
    },
  };
  function showChart(k){
    detEl.innerHTML = (charts[k] || charts.exam)();
    $$('#exam-subtab .subtab-btn').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    // v2.2.2: 처방별 차트의 막대 클릭 → 처방 심층 분석
    if(k === 'formula'){
      $$('#exam-detail .formula-bars .bar-row.clickable').forEach(row => {
        const open = () => openFormulaDeep(row.dataset.formula);
        row.addEventListener('click', open);
        row.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
    }
  }
  $$('#exam-subtab .subtab-btn').forEach(b => b.addEventListener('click', () => showChart(b.dataset.k)));
  showChart('exam');
}

// v2.2.2: 처방별 심층 분석 — 모달 (구성·작용·기출 문제·유형 분포·글로벌 오답률)
async function openFormulaDeep(formulaName){
  const exams    = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const formulas = (typeof FORMULAS    !== 'undefined') ? FORMULAS    : [];
  // 처방 데이터 (한글명 매칭 — 가감방은 ko 와 정확히 일치, 변형은 contains)
  const f = formulas.find(x => x.ko === formulaName) ||
            formulas.find(x => x.han === formulaName) ||
            formulas.find(x => x.ko && formulaName.includes(x.ko));
  const relExams = exams.filter(e => (e.formula || '').trim() === formulaName);
  // 글로벌 오답 (해당 처방의 past_* qid 들만)
  let wrongMap = {};
  if(FB){
    try{
      const w = await FB.get('stats/wrongs');
      if(w) wrongMap = w;
    }catch(_){}
  }
  // 집계
  const byType = {}, bySrc = {}, byDiff = {};
  relExams.forEach(e => {
    byType[e.type||'기타'] = (byType[e.type||'기타']||0)+1;
    bySrc[e.src||'기타']   = (bySrc[e.src||'기타']||0)+1;
    byDiff[e.difficulty||1] = (byDiff[e.difficulty||1]||0)+1;
  });
  const totalWrong = relExams.reduce((s, e) => s + (Number(wrongMap[e.id])||0), 0);
  const examsRanked = relExams.slice().map(e => ({...e, _w: Number(wrongMap[e.id])||0}))
    .sort((a,b) => b._w - a._w);

  const sort = (o) => Object.entries(o).sort((a,b) => b[1]-a[1]);
  const miniBar = (arr) => {
    const max = arr[0]?.[1] || 1;
    return `<div class="bar-chart mini">${arr.map(([k,v]) => `
      <div class="bar-row">
        <span class="bar-label">${esc(String(k))}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%">${v}</div></div>
      </div>`).join('')}</div>`;
  };

  const formulaCard = f ? `
    <div class="fdeep-card">
      <div class="fdeep-han">${esc(f.han)} <span class="fdeep-ko">${esc(f.ko)}</span></div>
      <div class="fdeep-meta">${esc(f.chapter||'')} · ${esc(f.source||'')}</div>
      <div class="fdeep-row"><span class="lbl">구성</span><span class="val">${(f.composition||[]).map(esc).join(' · ')}</span></div>
      <div class="fdeep-row"><span class="lbl">작용</span><span class="val">${esc(f.action||'')}</span></div>
      <div class="fdeep-row"><span class="lbl">적응증</span><span class="val">${esc(f.indication||'')}</span></div>
      <div class="fdeep-row"><span class="lbl">君臣佐使</span><span class="val">${
        f.monarch_minister
          ? ['君','臣','佐','使'].map(r => {
              const arr = f.monarch_minister[r];
              if(!arr || !arr.length) return '';
              return `<span class="ms-pill ms-${r==='君'?'j':r==='臣'?'s':r==='佐'?'z':'sh'}">${r} ${arr.map(esc).join('·')}</span>`;
            }).filter(Boolean).join(' ')
          : '(미정)'
      }</span></div>
      ${f.keyPoints && f.keyPoints.length ? `
        <div class="fdeep-key">
          <div class="lbl">핵심 포인트</div>
          <ul>${f.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ul>
        </div>
      ` : ''}
    </div>
  ` : `<div class="fdeep-card" style="text-align:center;color:var(--gutong)">처방 데이터가 FORMULAS 에 없습니다 (가감방 가능성).</div>`;

  const html = `
    <div class="modal-head">
      <div class="modal-tag">처방 심층 분석 v2.2.2</div>
      <h3 class="modal-title"><span class="han" style="margin-right:6px">析</span>${esc(formulaName)}</h3>
      <div class="modal-sub">
        기출 <b>${relExams.length}</b>문 · 글로벌 누적 오답 <b style="color:var(--zhusha-d)">${totalWrong}</b>회 ·
        시험 ${Object.keys(bySrc).length}회 · 유형 ${Object.keys(byType).length}종
      </div>
    </div>
    <div class="modal-body fdeep-body">
      ${formulaCard}

      ${relExams.length ? `
        <div class="fdeep-grid">
          <div class="fdeep-block">
            <div class="fdeep-blk-title"><span class="han">類</span> 자주 묻는 유형</div>
            ${miniBar(sort(byType))}
          </div>
          <div class="fdeep-block">
            <div class="fdeep-blk-title"><span class="han">期</span> 출제 시험</div>
            ${miniBar(sort(bySrc))}
          </div>
        </div>

        <div class="fdeep-block">
          <div class="fdeep-blk-title"><span class="han">問</span> 실제 기출 — 글로벌 오답 많은 순</div>
          <div style="font-size:11px;color:var(--gutong);margin-bottom:6px">클릭 시 정답·해설</div>
          <div class="fdeep-exams">
            ${examsRanked.map(e => `
              <div class="fdeep-exam-row" data-qid="${esc(e.id)}">
                <div class="ex-meta">
                  <span class="ex-src">${esc(e.src||'')}</span>
                  <span class="ex-type">${esc(e.type||'')}</span>
                  <span class="ex-diff diff-${e.difficulty||1}">난이도 ${e.difficulty||1}</span>
                  ${e._w > 0 ? `<span class="ex-w">오답 ${e._w}</span>` : ''}
                </div>
                <div class="ex-q">${esc(e.q||'').slice(0,90)}${(e.q||'').length>90?'…':''}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="fdeep-block" style="text-align:center;color:var(--gutong);padding:16px">
          이 처방에 대한 기출 문제가 PAST_EXAMS 에 없습니다.
        </div>
      `}

      <div class="modal-actions">
        <button class="btn btn-sm btn-o" onclick="closeModal()">닫기</button>
      </div>
    </div>
  `;
  openModal(html);
  // 기출 행 클릭 → 문제 상세 모달
  $$('.fdeep-exam-row').forEach(row => {
    row.addEventListener('click', () => {
      const qid = row.dataset.qid;
      const ex = exams.find(e => e.id === qid);
      if(ex) openWrongDetailModal(ex, Number(wrongMap[qid])||0);
    });
  });
}
window.openFormulaDeep = openFormulaDeep;

// ─── 약재 분석 v2.2 ──────────────────────────────────────────────────────
// 단순 君臣佐使가 아닌 — 性味·効能·처방내 쓰임으로 시각화
//   ① 性味 scatter — x축 性(寒↔熱), y축 味(辛甘苦酸鹹)
//   ② 効能 category grid — 補氣·補血·解表 등 작용군별 그룹
//   ③ 君臣佐使 conic-gradient pie (총합)
//   ④ TOP 20 빈출 약재 bar
function renderHerbAnalysis(det){
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const herbs    = (typeof HERBS    !== 'undefined') ? HERBS    : [];
  if(!formulas.length || !herbs.length){
    det.innerHTML = `<div class="card"><div class="card-title"><span class="han">本草</span> 약재 분석</div><div style="font-size:12.5px;color:var(--gutong);text-align:center;padding:16px">data-formulas.js 의 FORMULAS·HERBS 필요</div></div>`;
    return;
  }

  // 약재 → 처방 역인덱스 (han 기준)
  const herbIdx = {};
  formulas.forEach(f => {
    (f.composition||[]).forEach(h => {
      const name = (typeof h === 'string') ? h : (h.name||h.han||h.ko||'?');
      // 괄호 안 포자명 제거 (e.g., 甘草(炙) → 甘草)
      const clean = name.replace(/\([^)]*\)/g, '').trim();
      (herbIdx[clean] ||= []).push(f);
    });
  });

  // 性 (-2 寒 ~ +2 熱) 파싱
  function parseNature(sm){
    if(!sm) return 0;
    if(/大熱/.test(sm)) return 2;
    if(/熱/.test(sm))    return 1.5;
    if(/微溫/.test(sm)) return 0.8;
    if(/溫/.test(sm))   return 1.2;
    if(/平/.test(sm))   return 0;
    if(/凉|涼/.test(sm)) return -1;
    if(/微寒/.test(sm)) return -0.8;
    if(/大寒/.test(sm)) return -2;
    if(/寒/.test(sm))   return -1.5;
    return 0;
  }
  // 性 → CSS bubble class
  function natureClass(n){
    if(n <= -1.4) return 'b-cold';
    if(n <= -0.4) return 'b-cool';
    if(n <= 0.4)  return 'b-neut';
    if(n <= 1.4)  return 'b-warm';
    return 'b-hot';
  }
  // 味 — 가중 평균 ([辛甘苦酸鹹] 위치)
  // y axis: -2 (辛) ~ +2 (鹹) — 五味의 配置는 임의지만 인접 미가 가까이
  // 辛(陽散, 上)=-2, 甘(緩中)=-1, 苦(降泄)=0, 酸(收斂)=+1, 鹹(軟堅, 下)=+2
  // 淡(滲) ≒ 甘, 澁 ≒ 酸
  const FLAVOR_POS = {'辛':-2, '甘':-1, '淡':-1, '苦':0, '酸':1, '澁':1, '澀':1, '鹹':2, '咸':2};
  function parseFlavor(sm){
    if(!sm) return 0;
    // sm 형태 예: "甘微苦,微溫" → 부분 "甘微苦"에서 맛만 추출
    const tastePart = sm.split(',')[0] || sm;
    const tastes = [];
    for(const ch of tastePart){
      if(FLAVOR_POS[ch] !== undefined) tastes.push(FLAVOR_POS[ch]);
    }
    if(!tastes.length) return 0;
    return tastes.reduce((a,b)=>a+b,0) / tastes.length;
  }

  // 効能 카테고리 — 모듈 스코프 EFFICACY_CATS 사용 (v2.2.2)
  // 약재별 효능 분류
  function efficacyOf(h){
    return efficaciesOfText(h.meaning || '');
  }

  // 君臣佐使 전체 분포 (모든 처방·약재)
  const totalRoles = {君:0, 臣:0, 佐:0, 使:0, 미배정:0};
  formulas.forEach(f => {
    const ms = f.monarch_minister || {};
    (f.composition||[]).forEach(h => {
      const name = (typeof h === 'string') ? h.replace(/\([^)]*\)/g,'').trim() : h;
      let assigned = false;
      ['君','臣','佐','使'].forEach(r => {
        const v = ms[r];
        if(v && (Array.isArray(v) ? v.some(x => (x||'').replace(/\([^)]*\)/g,'').trim()===name) : v.includes(name))){
          totalRoles[r]++; assigned = true;
        }
      });
      if(!assigned) totalRoles.미배정++;
    });
  });

  // herbs 배열의 각 항목에 위치 정보 부여
  const herbsX = herbs.map(h => {
    const used = herbIdx[h.han] || [];
    return {
      ...h,
      nature: parseNature(h.sm),
      flavor: parseFlavor(h.sm),
      usedCount: used.length,
      usedFormulas: used,
      efficacies: efficacyOf(h)
    };
  }).filter(h => h.usedCount > 0);  // 처방에 실제로 쓰인 것만

  // 효능 category × 약재 grid
  const efnGroups = {};
  EFFICACY_CATS.forEach(c => { efnGroups[c.id] = []; });
  herbsX.forEach(h => h.efficacies.forEach(eid => efnGroups[eid].push(h)));

  // scatter 좌표 변환 — 캔버스 percentage (좌측 패딩 6%, 우측 6%)
  // x: nature -2 → 8%, +2 → 92% (linear)
  // y: flavor -2 → 12%, +2 → 84%
  function xPct(n){ return (8 + ((n+2)/4)*84).toFixed(2); }
  function yPct(f){
    // 위에서 아래로 (辛↑ 鹹↓) — flavor -2 → top 12, +2 → bottom 84 → invert
    return (12 + ((f+2)/4)*72).toFixed(2);
  }

  // 빈출 TOP 20 정렬
  const top20 = Object.entries(herbIdx).sort((a,b)=>b[1].length-a[1].length).slice(0, 20);
  const topMax = top20[0]?.[1].length || 1;

  // role pie 비율
  const totalRoleSum = Object.values(totalRoles).reduce((a,b)=>a+b,0) || 1;
  const roleColors = {君:'#9C3030', 臣:'#C9A227', 佐:'#3068A0', 使:'#2A7060', 미배정:'#876A36'};
  let acc = 0;
  const stops = ['君','臣','佐','使','미배정'].map(r => {
    const pct = totalRoles[r] / totalRoleSum * 100;
    const from = acc, to = acc + pct;
    acc = to;
    return `${roleColors[r]} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
  }).join(', ');
  const totalHerbInstances = totalRoleSum;

  det.innerHTML = `
    <div class="card fade-in">
      <div class="card-title"><span class="han">本草</span> 약재 종합 분석 (${herbsX.length} 종 · ${formulas.length} 처방)</div>
      <div class="subtab-row" id="herb-subtab">
        <button class="subtab-btn on" data-k="scatter">性味 분포</button>
        <button class="subtab-btn" data-k="efficacy">効能 분류</button>
        <button class="subtab-btn" data-k="role">君臣佐使</button>
        <button class="subtab-btn" data-k="top">빈출 TOP 20</button>
      </div>
      <div id="herb-detail"></div>
    </div>
  `;

  const detEl = $('#herb-detail');

  function renderScatter(){
    // 사이즈별 (사용 빈도) bubble radius
    const maxUse = Math.max(...herbsX.map(h => h.usedCount));
    const minR = 12, maxR = 28;
    const bubbles = herbsX.map(h => {
      const r = minR + (maxR - minR) * (h.usedCount / maxUse);
      const x = xPct(h.nature);
      const y = yPct(h.flavor);
      const cls = natureClass(h.nature);
      return `<button type="button" class="herb-bubble ${cls}" style="left:${x}%;top:${y}%;width:${r}px;height:${r}px"
        onclick="openHerbDetail('${esc(h.han)}')"
        title="${esc(h.han)} (${esc(h.ko)}) · 性味: ${esc(h.sm)} · ${h.usedCount}처방">${esc(h.han.slice(0,1))}</button>`;
    }).join('');
    detEl.innerHTML = `
      <div style="font-size:12px;color:var(--mo-l);margin:6px 0 4px">
        <b style="color:var(--zhusha-d)">性味 분포도</b> · X축 性(寒↔熱) Y축 味(辛甘苦酸鹹) · 圓크기 = 사용 빈도
      </div>
      <div class="herb-scatter">
        <span class="axis axis-x"></span>
        <span class="axis axis-y"></span>
        <!-- x축 눈금 -->
        <span class="axis-tick tk-x" style="left:8%">寒</span>
        <span class="axis-tick tk-x" style="left:30%">凉</span>
        <span class="axis-tick tk-x" style="left:50%">平</span>
        <span class="axis-tick tk-x" style="left:70%">溫</span>
        <span class="axis-tick tk-x" style="left:92%">熱</span>
        <!-- y축 눈금 -->
        <span class="axis-tick tk-y" style="top:12%">辛</span>
        <span class="axis-tick tk-y" style="top:30%">甘</span>
        <span class="axis-tick tk-y" style="top:48%">苦</span>
        <span class="axis-tick tk-y" style="top:66%">酸</span>
        <span class="axis-tick tk-y" style="top:84%">鹹</span>
        <span class="ax-title tt-x">性 ─ 四氣 (寒↔熱)</span>
        <span class="ax-title tt-y">味 (辛↑ 鹹↓)</span>
        ${bubbles}
      </div>
      <div class="legend-row">
        <span><span class="lg-sw" style="background:radial-gradient(circle at 30% 30%, #5DA8C8, #08405C)"></span>寒</span>
        <span><span class="lg-sw" style="background:radial-gradient(circle at 30% 30%, #6FB0D8, #2A6080)"></span>凉</span>
        <span><span class="lg-sw" style="background:radial-gradient(circle at 30% 30%, #B5946A, #6E5028)"></span>平</span>
        <span><span class="lg-sw" style="background:radial-gradient(circle at 30% 30%, #E08858, #A02818)"></span>溫</span>
        <span><span class="lg-sw" style="background:radial-gradient(circle at 30% 30%, #FF8030, #6E0E0E)"></span>熱</span>
      </div>
      <div style="font-size:11px;color:var(--gutong);margin-top:8px;font-style:italic;line-height:1.5">
        圓 탭 → 해당 약재의 처방 내 役割·効能 상세. 같은 작용군의 약재들이 비슷한 위치에 모입니다.
      </div>
    `;
  }

  function renderEfficacy(){
    detEl.innerHTML = `
      <div style="font-size:12px;color:var(--mo-l);margin:6px 0 4px">
        <b style="color:var(--zhusha-d)">효능 분류</b> · 작용 키워드별 약재 그룹 (한 약재가 여러 그룹에 속할 수 있음)
      </div>
      <div class="efn-grid">
        ${EFFICACY_CATS.map(c => {
          const list = efnGroups[c.id] || [];
          if(!list.length) return '';
          return `<div class="efn-cell">
            <div class="ef-title">
              <span><span class="han">${esc(c.han)}</span> · ${esc(c.ko)}</span>
              <span class="ef-count">${list.length}종</span>
            </div>
            <div class="ef-herbs">${list.map(h=>`<a style="color:var(--zhusha-d);text-decoration:none;cursor:pointer" onclick="openHerbDetail('${esc(h.han)}')">${esc(h.han)}</a>`).join(' · ')}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:11px;color:var(--gutong);margin-top:10px;font-style:italic;line-height:1.5">
        분류 기준: HERBS 데이터의 meaning(효능) 필드에서 키워드 자동 매칭. 클릭 → 약재 상세.
      </div>
    `;
  }

  function renderRolePie(){
    const cells = ['君','臣','佐','使','미배정'].map(r => `
      <div class="lg">
        <span class="sw" style="background:${roleColors[r]}"></span>
        <span class="han">${esc(r)}</span>
        <span class="v">${totalRoles[r]} / ${(totalRoles[r]/totalRoleSum*100).toFixed(1)}%</span>
      </div>
    `).join('');
    detEl.innerHTML = `
      <div style="font-size:12px;color:var(--mo-l);margin:6px 0 4px">
        <b style="color:var(--zhusha-d)">君臣佐使 전체 분포</b> · ${formulas.length}처방의 약재 ${totalHerbInstances}건
      </div>
      <div class="role-pie-wrap">
        <div class="role-pie" style="background:conic-gradient(${stops})">
          <div class="core">
            <span class="big">${totalHerbInstances}</span>
            <span class="lb">총 약재 인스턴스</span>
          </div>
        </div>
        <div class="role-legend">${cells}</div>
      </div>
      <div style="font-size:11px;color:var(--gutong);margin-top:10px;font-style:italic;line-height:1.5">
        統編教材 군신좌사 통설 기준. 약재 단위 분석은 性味 분포·효능 분류 탭 또는 圓 탭에서 확인.
      </div>
    `;
  }

  function renderTop(){
    detEl.innerHTML = `
      <div style="font-size:12px;color:var(--mo-l);margin:6px 0 6px">
        <b style="color:var(--zhusha-d)">빈출 약재 TOP 20</b> · 가장 많은 처방에 쓰인 순
      </div>
      <div class="bar-chart">
        ${top20.map(([h, list]) => {
          const meta = herbs.find(x => x.han === h);
          const sm = meta?.sm || '';
          return `<div class="bar-row" style="cursor:pointer" onclick="openHerbDetail('${esc(h)}')">
            <span class="bar-label">${esc(h)}<span style="color:var(--gutong);font-size:10px;margin-left:3px">${esc(sm.split(',')[1]||'')}</span></span>
            <div class="bar-track"><div class="bar-fill" style="width:${list.length/topMax*100}%">${list.length}</div></div>
            <span class="bar-val">${list.slice(0,2).map(x=>x.han||x.ko).join('·')}${list.length>2?'…':''}</span>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:11px;color:var(--gutong);margin-top:10px;font-style:italic">바 클릭 → 처방 내 役割·効能·性味 상세</div>
    `;
  }

  const renderers = {scatter:renderScatter, efficacy:renderEfficacy, role:renderRolePie, top:renderTop};
  function showHerbView(k){
    (renderers[k] || renderScatter)();
    $$('#herb-subtab .subtab-btn').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  }
  $$('#herb-subtab .subtab-btn').forEach(b => b.addEventListener('click', () => showHerbView(b.dataset.k)));
  showHerbView('scatter');
}

// ─── 약재 상세 — 효능·性味·役割·사용 처방 v2.2 ──────────────────────────
window.openHerbDetail = function(herbName){
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const herbs    = (typeof HERBS    !== 'undefined') ? HERBS    : [];
  const meta = herbs.find(h => h.han === herbName) || herbs.find(h => h.ko === herbName);
  const using = formulas.filter(f => (f.composition||[]).some(h => {
    const name = (typeof h === 'string') ? h.replace(/\([^)]*\)/g,'').trim() : (h.name||h.han||h.ko||'?');
    return name === herbName;
  }));
  // 君臣佐使 위치 카운트 + 어느 처방에서 어느 역할인지
  const roles = {君:[], 臣:[], 佐:[], 使:[], 미배정:[]};
  using.forEach(f => {
    const ms = f.monarch_minister || {};
    let assigned = false;
    ['君','臣','佐','使'].forEach(r => {
      const v = ms[r];
      if(v && (Array.isArray(v) ? v.some(x => (x||'').replace(/\([^)]*\)/g,'').trim()===herbName) : v.includes(herbName))){
        roles[r].push(f); assigned = true;
      }
    });
    if(!assigned) roles.미배정.push(f);
  });
  // 役割 pie (CSS conic-gradient)
  const total = using.length || 1;
  const roleColors = {君:'#9C3030', 臣:'#C9A227', 佐:'#3068A0', 使:'#2A7060', 미배정:'#876A36'};
  let acc = 0;
  const stops = ['君','臣','佐','使','미배정'].map(r => {
    const pct = roles[r].length / total * 100;
    const from = acc, to = acc + pct;
    acc = to;
    if(pct === 0) return `${roleColors[r]} ${from.toFixed(2)}% ${from.toFixed(2)}%`;
    return `${roleColors[r]} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
  }).join(', ');

  const meaningParts = (meta?.meaning || '').split(',').map(s=>s.trim()).filter(Boolean);
  const sm = meta?.sm || '?';
  const [tastes, nature] = sm.split(',').map(s=>s||'');

  openModal(`
    <h3 class="seal" style="margin:0 0 4px;color:var(--zhusha-d)">${esc(herbName)} <span style="font-size:14px;color:var(--gutong);font-family:var(--font-body)">${esc(meta?.ko||'')}</span></h3>
    <div style="font-size:12px;color:var(--mo-l);margin-bottom:10px">
      性味: <b class="han" style="color:var(--zhusha-d)">${esc(tastes||'?')}</b><span style="color:var(--gutong)"> · ${esc(nature||'?')}</span>
      &nbsp;·&nbsp; 사용 처방 <b>${using.length}</b>종
    </div>
    ${meaningParts.length ? `<div style="margin-bottom:14px">
      <b style="font-size:12px;color:var(--zhusha-d)">効能</b>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px">
        ${meaningParts.map(p => `<span class="presence-chip" style="background:rgba(201,162,39,.12);border-color:rgba(201,162,39,.4)"><span class="han">${esc(p)}</span></span>`).join('')}
      </div>
    </div>` : ''}

    <div style="margin-bottom:14px">
      <b style="font-size:12px;color:var(--zhusha-d)">処方 內 役割 분포</b>
      <div class="role-pie-wrap">
        <div class="role-pie" style="background:conic-gradient(${stops})">
          <div class="core">
            <span class="big">${using.length}</span>
            <span class="lb">처방</span>
          </div>
        </div>
        <div class="role-legend">
          ${['君','臣','佐','使','미배정'].map(r => `
            <div class="lg" title="${roles[r].map(f=>f.han).join(', ')}">
              <span class="sw" style="background:${roleColors[r]}"></span>
              <span class="han">${esc(r)}</span>
              <span class="v">${roles[r].length}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <b style="font-size:12px;color:var(--zhusha-d)">処方別 役割</b>
    <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;font-size:11.5px">
      ${['君','臣','佐','使','미배정'].flatMap(r => roles[r].map(f => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--mi-w);border-radius:4px;border-left:3px solid ${roleColors[r]}">
          <span class="han" style="color:${roleColors[r]};font-weight:700;width:24px;text-align:center">${esc(r)}</span>
          <span style="flex:1"><span class="han" style="color:var(--zhusha-d)">${esc(f.han||'')}</span> ${esc(f.ko||'')}</span>
          <span style="font-size:10px;color:var(--gutong)">${esc(f.action||'')}</span>
        </div>
      `)).join('')}
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

// ─── 난이도 4단계 메타 ──────────────────────────────────────────────────
const DIFFICULTY_META = {
  1: { ko:'초급', han:'初級', color:'#4A8F40', desc:'빈출·구성·작용 매칭',     icon:'初' },
  2: { ko:'중급', han:'中級', color:'#3068A0', desc:'적응증·가감·기본 응용',   icon:'中' },
  3: { ko:'고급', han:'高級', color:'#8C5028', desc:'헷갈리는 비교·약재 의의', icon:'高' },
  4: { ko:'지옥', han:'地獄', color:'#6E1818', desc:'기출 외 심화·약재 단위',  icon:'獄' },
};
window.DIFFICULTY_META = DIFFICULTY_META;

function renderQuiz(){
  const exams = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  if(!exams.length && !formulas.length){
    view.innerHTML = `
      <h2 class="view-title"><span class="han">問</span>기출·암기</h2>
      <div class="card"><div style="text-align:center;color:var(--gutong);padding:24px;font-size:13px">
        <div class="han" style="font-size:24px;color:var(--zhusha-d);margin-bottom:8px">未充</div>
        data-formulas.js 의 PAST_EXAMS·FORMULAS 가 필요합니다
      </div></div>`;
    return;
  }
  // 난이도별 기출 카운트
  const byDiff = {1:0,2:0,3:0,4:0};
  exams.forEach(e => { byDiff[e.difficulty||1] = (byDiff[e.difficulty||1]||0)+1; });
  // 4 단계는 기출이 없으면 자동생성으로 채워짐 — UI 표시는 "∞" (생성)
  const totalAuto = formulas.length;  // 자동 생성 가능 풀

  // 현재 선택 상태 (localStorage 캐시)
  const sel = JSON.parse(localStorage.getItem('quiz.sel.v1')||'{}');
  if(!sel.diff) sel.diff = 1;
  if(!sel.count) sel.count = 5;
  if(!sel.mode) sel.mode = 'mixed';   // mixed | past | auto | wrong

  view.innerHTML = `
    <h2 class="view-title"><span class="han">問</span>기출·암기</h2>
    <div class="view-sub">난이도·문제수를 골라 시작하세요</div>

    <!-- 난이도 선택 -->
    <div class="card imperial fade-in">
      <div class="card-title"><span class="han">難度</span> 난이도 선택</div>
      <div class="diff-grid">
        ${[1,2,3,4].map(d => {
          const m = DIFFICULTY_META[d];
          const n = byDiff[d];
          const supplyText = d === 4
            ? `<span style="color:var(--gutong);font-size:10.5px">자동生 ${totalAuto}+</span>`
            : (n > 0
                ? `<span style="color:var(--feicui);font-size:10.5px">기출 ${n}문</span>`
                : `<span style="color:var(--gutong);font-size:10.5px">자동생성</span>`);
          return `<button class="diff-btn" type="button" data-d="${d}"
            style="border-color:${m.color};${sel.diff===d?`background:${m.color};color:var(--mi-w)`:''}">
            <div class="diff-icon han" style="color:${sel.diff===d?'var(--mi-w)':m.color}">${m.icon}</div>
            <div class="diff-ttl"><span class="han">${m.han}</span> ${m.ko}</div>
            <div class="diff-desc">${m.desc}</div>
            <div class="diff-supply">${supplyText}</div>
          </button>`;
        }).join('')}
      </div>
    </div>

    <!-- 문제수 선택 -->
    <div class="card fade-in">
      <div class="card-title"><span class="han">數</span> 문제수</div>
      <div class="count-grid">
        ${[3,5,10,20].map(n => `
          <button class="count-btn ${sel.count===n?'on':''}" type="button" data-n="${n}">
            ${n}<span style="font-size:10px;color:var(--gutong);margin-left:2px">문</span>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- 출제 풀 선택 -->
    <div class="card fade-in">
      <div class="card-title"><span class="han">源</span> 출제 풀</div>
      <div class="mode-grid">
        <button class="mode-btn ${sel.mode==='mixed'?'on':''}" type="button" data-m="mixed">
          <span class="han">混合</span> 혼합 <span class="hint">기출+자동 (권장)</span>
        </button>
        <button class="mode-btn ${sel.mode==='past'?'on':''}" type="button" data-m="past">
          <span class="han">舊問</span> 기출만 <span class="hint">22학번 1·2차 복원본</span>
        </button>
        <button class="mode-btn ${sel.mode==='auto'?'on':''}" type="button" data-m="auto">
          <span class="han">自題</span> 자동만 <span class="hint">26 처방 데이터 기반</span>
        </button>
        <button class="mode-btn ${sel.mode==='wrong'?'on':''}" type="button" data-m="wrong">
          <span class="han">錯題</span> 오답함 <span class="hint">${S.wrongIds.length}개</span>
        </button>
      </div>
    </div>

    <!-- 시작 -->
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-lg" type="button" id="quiz-start-btn" style="flex:1;font-size:15px;padding:12px">
        <span class="han" style="font-size:16px;margin-right:4px">始</span>시작
      </button>
    </div>
  `;

  // 동적 스타일 (한 번만 주입)
  if(!document.getElementById('quiz-style')){
    const st = document.createElement('style');
    st.id = 'quiz-style';
    st.textContent = `
      .diff-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:4px}
      .diff-btn{background:var(--mi-w);border:2px solid;border-radius:10px;padding:10px 8px;cursor:pointer;text-align:center;transition:all .15s;color:var(--mo)}
      .diff-btn:hover{transform:translateY(-1px);box-shadow:0 2px 6px rgba(0,0,0,.15)}
      .diff-icon{font-size:24px;font-weight:700;line-height:1}
      .diff-ttl{font-size:13px;font-weight:600;margin-top:4px}
      .diff-desc{font-size:10.5px;color:var(--gutong);margin-top:2px;line-height:1.3;min-height:28px}
      .diff-btn[style*="background:#"] .diff-desc{color:rgba(252,244,229,.85)}
      .diff-supply{margin-top:3px;font-weight:600}
      .count-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:4px}
      .count-btn{background:var(--mi-w);border:1.5px solid var(--gutong);border-radius:8px;padding:10px 0;font-size:18px;font-weight:700;cursor:pointer;color:var(--mo);font-family:var(--font-display);transition:all .15s}
      .count-btn:hover{transform:translateY(-1px)}
      .count-btn.on{background:var(--zhusha);color:var(--mi-w);border-color:var(--zhusha)}
      .mode-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:4px}
      .mode-btn{background:var(--mi-w);border:1.5px solid var(--gutong);border-radius:8px;padding:8px 10px;text-align:left;cursor:pointer;color:var(--mo);font-size:13px;transition:all .15s;display:flex;flex-direction:column;gap:2px}
      .mode-btn:hover{transform:translateY(-1px)}
      .mode-btn.on{background:var(--feicui);color:var(--mi-w);border-color:var(--feicui)}
      .mode-btn .hint{font-size:10.5px;opacity:.7;font-weight:400}
    `;
    document.head.appendChild(st);
  }

  // 이벤트
  $$('.diff-btn').forEach(b => b.addEventListener('click', () => {
    sel.diff = +b.dataset.d; localStorage.setItem('quiz.sel.v1', JSON.stringify(sel)); renderQuiz();
  }));
  $$('.count-btn').forEach(b => b.addEventListener('click', () => {
    sel.count = +b.dataset.n; localStorage.setItem('quiz.sel.v1', JSON.stringify(sel)); renderQuiz();
  }));
  $$('.mode-btn').forEach(b => b.addEventListener('click', () => {
    sel.mode = b.dataset.m; localStorage.setItem('quiz.sel.v1', JSON.stringify(sel)); renderQuiz();
  }));
  $('#quiz-start-btn').addEventListener('click', () => {
    startQuizSession(sel.mode, sel.diff, sel.count);
  });
}

window.startQuizSession = function(mode, diff, count){
  mode  = mode  || 'mixed';
  diff  = diff  || 1;
  count = count || 5;
  const exams = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];

  // 풀 빌드
  let pool = [];
  if(mode === 'past'){
    pool = exams.filter(e => (e.difficulty||1) === diff);
    if(!pool.length){
      toast(`${DIFFICULTY_META[diff].ko} 기출이 없습니다. 자동생성으로 전환`);
      pool = generateQuizQuestions(count*2, diff);
    }
  } else if(mode === 'wrong'){
    pool = exams.filter((_,i) => S.wrongIds.includes(exams[i].id || 'past_'+(i+1).toString().padStart(3,'0')));
    pool = pool.filter(e => (e.difficulty||1) === diff);
    if(!pool.length){ toast('해당 난이도 오답이 없습니다'); return; }
  } else if(mode === 'auto'){
    pool = generateQuizQuestions(count*2, diff);
  } else {  // mixed
    const pastFiltered = exams.filter(e => (e.difficulty||1) === diff);
    const autoNeeded = Math.max(count - pastFiltered.length, Math.ceil(count/2));
    pool = pastFiltered.concat(generateQuizQuestions(autoNeeded, diff));
  }
  pool = pool.sort(()=>Math.random()-0.5).slice(0, count);
  if(!pool.length){ toast('문제를 만들 수 없습니다'); return; }

  // 옵션 셔플
  pool = pool.map(q => {
    const correctTxt = q.options[q.answer||0];
    const shuffled = q.options.slice().sort(() => Math.random()-0.5);
    return {...q, options: shuffled, answer: shuffled.indexOf(correctTxt)};
  });

  let cur = 0, score = 0;
  const startedAt = Date.now();
  const dm = DIFFICULTY_META[diff];

  function show(){
    if(cur >= pool.length){
      // 결과 + 氣 보상 (난이도 보너스)
      const baseReward = score * 10;
      const diffMult = [1, 1.5, 2, 3][diff-1] || 1;
      const earned = Math.round(baseReward * diffMult);
      S.qi += earned; saveState(); refreshHeader();
      view.innerHTML = `
        <h2 class="view-title fade-in"><span class="han">畢</span>완료</h2>
        <div class="card imperial" style="text-align:center;padding:22px">
          <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:6px">
            <span class="seal-stamp" style="background:${dm.color};font-size:13px">${dm.icon}</span>
            <span class="han" style="font-size:14px;color:${dm.color}">${dm.han}·${dm.ko}</span>
          </div>
          <div class="seal" style="font-size:42px;color:var(--zhusha-d);line-height:1">${score}<span style="font-size:24px;opacity:.6">/${pool.length}</span></div>
          <div style="margin-top:8px;font-size:14px;color:var(--feicui);font-weight:600">+${earned} 氣 ${diff>1?`<span style="font-size:11px;color:var(--gutong)">(×${diffMult} 난이도 보너스)</span>`:''}</div>
          <div style="margin-top:6px;font-size:11px;color:var(--gutong)">${Math.round((Date.now()-startedAt)/1000)}초 소요</div>
        </div>
        <div style="display:flex;gap:6px;justify-content:center;margin-top:14px">
          <button class="btn" type="button" onclick="setTab('quiz')">다시 풀기</button>
          <button class="btn btn-o" type="button" onclick="setTab('home')">대청으로</button>
        </div>
      `;
      return;
    }
    const q = pool[cur];
    view.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span class="seal-stamp tiny" style="background:${dm.color}">${dm.icon}</span>
        <span class="han" style="font-size:13px;color:${dm.color}">${dm.han}·${dm.ko}</span>
        <span style="margin-left:auto;font-size:12px;color:var(--gutong)">${cur+1} / ${pool.length}</span>
      </div>
      <div class="card imperial fade-in">
        <div style="font-size:14.5px;line-height:1.65;margin-bottom:12px">${esc(q.q||q.question||'?')}</div>
        ${(q.options||[]).map((opt, i) => `
          <button class="btn btn-o quiz-opt" type="button" style="display:block;width:100%;margin:6px 0;text-align:left;padding:10px 12px;white-space:normal;line-height:1.45" data-i="${i}">
            <span class="han" style="color:var(--zhusha-d);margin-right:8px;font-weight:700">${'甲乙丙丁戊'[i]||(i+1)}</span>${esc(opt)}
          </button>
        `).join('')}
        ${q.explanation?`<div id="expl" style="display:none;margin-top:14px;padding:10px;background:var(--mi);border-radius:6px;font-size:12.5px;color:var(--mo);line-height:1.5"><b style="color:var(--zhusha-d)">해설</b><br>${esc(q.explanation)}</div>`:''}
      </div>
    `;
    $$('.quiz-opt').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      const correct = i === (q.answer||0);
      if(correct) score++;
      $$('.quiz-opt').forEach(x => {
        x.disabled = true;
        if(+x.dataset.i === (q.answer||0)){ x.style.background='var(--feicui)'; x.style.color='var(--mi-w)'; x.style.borderColor='transparent'; }
        if(+x.dataset.i === i && !correct){ x.style.background='var(--zhusha)'; x.style.color='var(--mi-w)'; x.style.borderColor='transparent'; }
      });
      const expl = $('#expl'); if(expl) expl.style.display='block';
      // 오답 기록 — v2.2.2: 콘텐츠 해시 qid
      if(!correct){
        const qid = qidOf(q);
        if(!S.wrongIds.includes(qid)) S.wrongIds.push(qid);
        saveState();
        if(FB){
          FB.get(`stats/wrongs/${qid}`).then(c => FB.put(`stats/wrongs/${qid}`, (c||0)+1));
        }
      }
      // 다음 버튼
      setTimeout(() => {
        const next = document.createElement('button');
        next.className = 'btn';
        next.style = 'display:block;width:100%;margin-top:10px;padding:10px';
        next.textContent = cur+1 >= pool.length ? '결과 보기 →' : '다음 문제 →';
        next.onclick = () => { cur++; show(); };
        $('.card.imperial').appendChild(next);
      }, 400);
    }));
  }
  show();
};

// ─── 난이도별 자동 문제 생성 ─────────────────────────────────────────────
// difficulty 1: 작용·구성 단순 매칭 (빈출 위주)
// difficulty 2: 적응증·가감·君藥 (중간)
// difficulty 3: 약재 단위 의의·감별·함정 선지 (어려움)
// difficulty 4: 처방 깊은 이해·약재 4-5개 모두 알아야 (지옥)
function generateQuizQuestions(n, diff){
  diff = diff || 1;
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const herbs    = (typeof HERBS    !== 'undefined') ? HERBS    : [];
  if(!formulas.length) return [];

  const out = [];
  const rand = (a) => a[Math.floor(Math.random()*a.length)];
  const shuf = (a) => a.slice().sort(()=>Math.random()-0.5);

  const generators = {
    // === 1단계: 빈출 ===
    1: [
      // 작용 매칭
      () => {
        const f = rand(formulas);
        const distractors = shuf(formulas.filter(x => x.id !== f.id)).slice(0,4).map(x => x.action);
        return {
          q: `${f.han} (${f.ko})의 작용으로 가장 옳은 것은?`,
          options: [f.action, ...distractors.slice(0,4)].filter(Boolean),
          answer: 0,
          explanation: `${f.han}의 작용은 「${f.action}」. ${f.indication.slice(0,60)}…`,
          type: 'auto-action', difficulty: 1
        };
      },
      // 한자 → 한글
      () => {
        const f = rand(formulas);
        const distractors = shuf(formulas.filter(x => x.id !== f.id)).slice(0,4).map(x => x.ko);
        return {
          q: `「${f.han}」의 한글 이름은?`,
          options: [f.ko, ...distractors],
          answer: 0,
          explanation: `${f.han} = ${f.ko}. 출처: ${f.source||'?'}`,
          type: 'auto-ko', difficulty: 1
        };
      },
    ],
    // === 2단계: 중급 ===
    2: [
      // 君藥 매칭
      () => {
        const candidates = formulas.filter(f => f.monarch_minister && (f.monarch_minister['君']||[]).length);
        if(!candidates.length) return null;
        const f = rand(candidates);
        const monarchs = f.monarch_minister['君'];
        const ans = monarchs[0];
        const allHerbs = formulas.flatMap(x => x.composition).filter(h => !monarchs.includes(h));
        const distractors = shuf(Array.from(new Set(allHerbs))).slice(0,4);
        return {
          q: `${f.han} (${f.ko})의 君藥으로 가장 옳은 것은?`,
          options: [ans, ...distractors],
          answer: 0,
          explanation: `${f.han}의 君藥은 ${monarchs.join('·')}. ${(f.keyPoints||[]).find(k => k.includes('君'))||''}`,
          type: 'auto-monarch', difficulty: 2
        };
      },
      // 적응증 매칭
      () => {
        const f = rand(formulas);
        const distractors = shuf(formulas.filter(x => x.id !== f.id)).slice(0,4).map(x => x.indication.slice(0, 80));
        return {
          q: `다음 적응증에 가장 적합한 처방은?\n「${f.indication.slice(0,140)}…」`,
          options: [f.han, ...shuf(formulas.filter(x => x.id !== f.id)).slice(0,4).map(x => x.han)],
          answer: 0,
          explanation: `${f.han} (${f.ko}) — ${f.action}`,
          type: 'auto-indication', difficulty: 2
        };
      },
    ],
    // === 3단계: 고급 ===
    3: [
      // 구성에 없는 약재
      () => {
        const f = rand(formulas.filter(x => x.composition.length >= 4));
        const inComp = f.composition;
        const allHerbs = Array.from(new Set(formulas.flatMap(x => x.composition))).filter(h => !inComp.includes(h));
        const odd = rand(allHerbs);
        // 4개 정답(구성에 있는) + 1개 함정
        const correct = shuf(inComp).slice(0, 4);
        const options = shuf([...correct, odd]);
        return {
          q: `${f.han} (${f.ko})의 구성 약물이 아닌 것은?`,
          options: options,
          answer: options.indexOf(odd),
          explanation: `${f.han}의 구성: ${inComp.join('·')}. 「${odd}」은 들어가지 않음.`,
          type: 'auto-not-in', difficulty: 3
        };
      },
      // 감별: 비슷한 작용 두 처방
      () => {
        // 작용이 비슷한 두 처방 (같은 chapter prefix)
        const groups = {};
        formulas.forEach(f => {
          const key = (f.chapter||'').split('·')[0];
          (groups[key] = groups[key] || []).push(f);
        });
        const group = Object.values(groups).find(g => g.length >= 2);
        if(!group) return null;
        const [a, b] = shuf(group).slice(0,2);
        const distractors = shuf(formulas.filter(x => ![a.id,b.id].includes(x.id))).slice(0,3).map(x => x.han);
        return {
          q: `「${a.action}」의 작용을 가진 처방은? (「${b.action}」과 감별)`,
          options: [a.han, b.han, ...distractors],
          answer: 0,
          explanation: `${a.han} = ${a.action}. ${b.han} = ${b.action}. 적응증으로 감별.`,
          type: 'auto-compare', difficulty: 3
        };
      },
      // 약재 작용 단독
      () => {
        if(!herbs.length) return null;
        const h = rand(herbs);
        const distractors = shuf(herbs.filter(x => x.han !== h.han)).slice(0,4).map(x => x.meaning);
        return {
          q: `약재 「${h.han}(${h.ko})」의 주된 작용·효능은?`,
          options: [h.meaning, ...distractors],
          answer: 0,
          explanation: `${h.han} (${h.ko}) — 性味: ${h.sm}. 작용: ${h.meaning}`,
          type: 'auto-herb', difficulty: 3
        };
      },
    ],
    // === 4단계: 지옥 ===
    4: [
      // 君臣佐使 위치 매칭
      () => {
        const candidates = formulas.filter(f => f.monarch_minister && ['君','臣','佐','使'].every(r => f.monarch_minister[r]||f.monarch_minister[r+'使']));
        if(!candidates.length){
          // 완전한 君臣佐使 아니더라도 시도
          const f = rand(formulas.filter(x => x.monarch_minister));
          const roles = Object.keys(f.monarch_minister);
          const role = rand(roles);
          const herbs = f.monarch_minister[role];
          if(!herbs || !herbs.length) return null;
          const otherInComp = f.composition.filter(h => !herbs.some(hh => hh.replace(/\([^)]+\)/,'').trim() === h.replace(/\([^)]+\)/,'').trim()));
          if(otherInComp.length < 3) return null;
          return {
            q: `${f.han}에서 「${role}」의 위치에 해당하는 약물은?`,
            options: [herbs[0], ...shuf(otherInComp).slice(0,4)],
            answer: 0,
            explanation: `${f.han}의 君臣佐使: ${Object.entries(f.monarch_minister).map(([k,v])=>k+'='+v.join('·')).join(' / ')}`,
            type: 'auto-role', difficulty: 4
          };
        }
        const f = rand(candidates);
        const role = rand(['君','臣','佐']);
        const correct = f.monarch_minister[role][0];
        const other = ['君','臣','佐','使'].filter(r => r !== role).map(r => (f.monarch_minister[r]||f.monarch_minister[r+'使']||[])[0]).filter(Boolean);
        return {
          q: `${f.han}에서 「${role}藥」의 역할을 하는 약물은?`,
          options: [correct, ...other].slice(0,5),
          answer: 0,
          explanation: `${f.han} 君臣佐使: ${Object.entries(f.monarch_minister).map(([k,v])=>k+'='+v.join('·')).join(' / ')}`,
          type: 'auto-role-strict', difficulty: 4
        };
      },
      // 출처 매칭 (어려운 서지)
      () => {
        const candidates = formulas.filter(f => f.source);
        if(candidates.length < 5) return null;
        const f = rand(candidates);
        const distractors = shuf(candidates.filter(x => x.source !== f.source)).slice(0,4).map(x => x.source);
        return {
          q: `${f.han} (${f.ko})의 출전(出處)은?`,
          options: [f.source, ...distractors],
          answer: 0,
          explanation: `${f.han}은 「${f.source}」에 수록.`,
          type: 'auto-source', difficulty: 4
        };
      },
      // 가감/keyPoint 함정
      () => {
        const candidates = formulas.filter(f => (f.keyPoints||[]).length >= 3);
        if(!candidates.length) return null;
        const f = rand(candidates);
        const kp = rand(f.keyPoints);
        const others = shuf(candidates.filter(x => x.id !== f.id)).slice(0,4);
        return {
          q: `다음 설명에 해당하는 처방은?\n「${kp.replace(/★+기?출[:(]?[^)]*\)?:?\s?/g,'').slice(0,140)}」`,
          options: [f.han, ...others.map(x => x.han)],
          answer: 0,
          explanation: `${f.han} (${f.ko}) — 핵심: ${kp}`,
          type: 'auto-keypoint', difficulty: 4
        };
      },
      // 처방 vs 처방의 약재 차이
      () => {
        if(formulas.length < 3) return null;
        const [a, b] = shuf(formulas).slice(0,2);
        if(!a || !b) return null;
        const aOnly = a.composition.filter(h => !b.composition.includes(h));
        const bOnly = b.composition.filter(h => !a.composition.includes(h));
        if(!aOnly.length || !bOnly.length) return null;
        const ans = aOnly[0];
        const distractors = shuf([...bOnly, ...Array.from(new Set(formulas.flatMap(x => x.composition))).filter(h => !aOnly.includes(h))]).slice(0,4);
        return {
          q: `${a.han}에는 있고 ${b.han}에는 없는 약물은?`,
          options: [ans, ...distractors],
          answer: 0,
          explanation: `${a.han} 구성: ${a.composition.join('·')}\n${b.han} 구성: ${b.composition.join('·')}`,
          type: 'auto-diff', difficulty: 4
        };
      },
    ]
  };

  const gens = generators[diff] || generators[1];
  const tries = n * 5;  // 실패 가능하므로 충분한 시도
  let attempts = 0;
  while(out.length < n && attempts < tries){
    const g = rand(gens);
    const q = g();
    if(q && q.options && q.options.length >= 2){
      out.push(q);
    }
    attempts++;
  }
  return out;
}

// 배틀용 (기존 호환)
function generateBattleQuestions(n){
  const exams = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  // 배틀은 중급 위주 + 일부 기출
  const out = generateQuizQuestions(Math.ceil(n/2), 2);
  const past = (exams.filter(e => (e.difficulty||1) <= 2)).sort(()=>Math.random()-0.5).slice(0, Math.floor(n/2));
  return [...past, ...out].sort(()=>Math.random()-0.5).slice(0, n).map(p => {
    const correctTxt = p.options[p.answer||0];
    const shuffled = p.options.slice().sort(() => Math.random()-0.5);
    return {...p, options: shuffled, answer: shuffled.indexOf(correctTxt)};
  });
}

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
  // v2.2.2: page unload 시 멀티 로비 잔여 정리 (keepalive DELETE)
  const unloadCleanup = () => {
    try{
      if(FB && S.userId){
        FB.delKeepalive(`lobby_idle/${S.userId}`);
        // 큐에 있었다면 모든 level 에서 자기 entry 제거 시도
        for(const lvl of BET_LEVELS){
          FB.delKeepalive(`lobby/${lvl.id}/${S.userId}`);
        }
      }
    }catch(_){}
  };
  window.addEventListener('pagehide', unloadCleanup);
  window.addEventListener('beforeunload', unloadCleanup);
}

document.addEventListener('DOMContentLoaded', init);
if(document.readyState === 'interactive' || document.readyState === 'complete') init();
