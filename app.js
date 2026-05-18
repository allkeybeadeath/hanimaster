/* app.js — 方劑學 v4
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
const APP_VERSION = 'v11.1a';                  // ★ 진단학 (동무의 방) 설진 학습 도구 (2026-05) — 48장 사진 + 객관/주관/드릴/사진첩, 5/19 5/26 D-N 표시
const APP_BUILD   = '2026.05.18.v10.0.8';     // v10.0.8 scope correction
const FIREBASE_URL = 'https://hanimaster-245f6-default-rtdb.asia-southeast1.firebasedatabase.app/';
const STORAGE_KEY = 'bangje.state.v2';

// 시험일 (Asia/Seoul 기준 자정). 사용자 환경에 따라 조정.
const EXAM_DATE_ISO = '2026-05-20T00:00:00+09:00';
const EXAM_META = {
  course: '方劑學',
  examTitle: '2차 수시',
  rangeKR: '7장 표리쌍해제 · 8장 보익제',
  rangeHan: '表裏雙解 · 補益(補氣血·陰陽幷補)',
};

const PRESENCE_REFRESH_MS = 30 * 1000;     // 30초마다 presence 갱신
const PRESENCE_FRESH_MS   = 90 * 1000;     // 90초 이내면 "온라인"
const BATTLE_INTRO_MS     = 9000;          // v4: 5000→9000 (양측 동시 한문 낭독)
const BATTLE_INTRO_FORFEIT_MS = 5000;      // v4: 이순재 등 무음 측만 있을 때 단축
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
  character: null,        // v8.5: 첫 시작 시 神급·이순재 제외 랜덤 부여 (loadState 에서)
  faction: '',            // v5: 四象 진영 id (taeyang/soyang/taeum/soeum) — 최초 진입 시 랜덤
  qi: 0,                  // 누적 氣 (= XP)
  unlockedDivine: [],     // 구매한 神階 id 배열
  bookmarks: [],          // 처방 북마크
  wrongIds: [],           // 오답 id 배열 (개인용)
  knownIds: [],           // 마스터한 처방
  lastFcIdx: 0, fcMode: 'action',
  quizScope: 'all', lastTab: 'home',
  battleHistory: [],      // 최근 배틀 결과 (최대 20)
  cardBattleHistory: [],  // v8.5: 카드 對決 전적 (5지선다 별도)
  herbLang: 'han',        // v8.5: 본초 표시 언어 ('han'=한자 / 'ko'=한글)
  // v9.4: 플래시카드 + 주관식
  flashRated: {},                          // {key: 'easy'|'hard'|'again'} — Spaced repetition 표식
  shortAnswerStats: {ok:0, ng:0, qi:0},    // 누적 주관식 통계
  flashLang: 'han',                        // 플래시카드 표시 언어 ('han' | 'ko')
  // v9.6: 현재 활동 (presence 클릭 상세 표시용 — Firebase 에 함께 게시)
  activity: { label:'', sub:'', ts: 0 },
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
  // v5: 진영이 없으면 랜덤 부여 (기존 사용자도 다음 로드 때 1회 부여됨)
  if(!S.faction || !FACTION_BY_ID[S.faction]){
    S.faction = (typeof randomFactionId === 'function') ? randomFactionId() : 'taeyang';
  }
  // v8.5: 캐릭터가 없으면 神급(divine) + 이순재 제외하고 랜덤 부여 (첫 시작 전용)
  if(!S.character){
    if(typeof PHYSICIANS !== 'undefined' && Array.isArray(PHYSICIANS)){
      const pool = PHYSICIANS.filter(p => p && p.id && p.cat !== 'divine' && p.id !== 'leesoonjae');
      if(pool.length){
        S.character = pool[Math.floor(Math.random() * pool.length)].id;
      } else {
        S.character = 'huatuo';  // 안전망 (PHYSICIANS 로드 실패 시 任意 ancient)
      }
    } else {
      S.character = 'huatuo';
    }
  }
  // v8.5: 누적 필드 보강
  if(!Array.isArray(S.cardBattleHistory)) S.cardBattleHistory = [];
  if(!S.herbLang) S.herbLang = 'han';
  // v9.4: 플래시카드 필드 보강
  if(!S.flashRated || typeof S.flashRated !== 'object') S.flashRated = {};
  if(!S.shortAnswerStats || typeof S.shortAnswerStats !== 'object') S.shortAnswerStats = {ok:0, ng:0, qi:0};
  if(typeof S.shortAnswerStats.ok !== 'number') S.shortAnswerStats.ok = 0;
  if(typeof S.shortAnswerStats.ng !== 'number') S.shortAnswerStats.ng = 0;
  if(typeof S.shortAnswerStats.qi !== 'number') S.shortAnswerStats.qi = 0;
  if(!S.flashLang) S.flashLang = 'han';
  // v9.6: 활동 필드 보강
  if(!S.activity || typeof S.activity !== 'object') S.activity = { label:'', sub:'', ts:0 };
}
let _saveTimer = null;
function saveState(){
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }catch(_){}
  }, 250);
}

// v9.7: const/let 전역은 window 에 자동 부착되지 않음 — v97 외부 모듈용 노출
//       S 는 Object.assign 으로만 mutate 되므로 한 번 노출하면 참조 안정.
try{
  window.S = S;
  window.saveState = saveState;
  window.EXAM_DATE_ISO = EXAM_DATE_ISO;
  window.EXAM_META = EXAM_META;
}catch(_){}

// v8.5: SSE 콜백 에러 진단 (FB.subscribe emit() 에서 갱신)
let _lastSubError = null;

// Firebase REST 헬퍼 — Greek v60 패턴 단순화
const FB = (() => {
  if(!FIREBASE_URL) return null;
  const base = FIREBASE_URL.replace(/\/$/, '');
  return {
    base,
    // v8.6: fetch 무한 hang 픽스. 모든 fetch 에 AbortController 5초 timeout.
    //       응답 없는 네트워크 환경에서 await 가 영원히 멈추던 버그 회복.
    get: async (path, timeoutMs) => {
      const ctl = new AbortController();
      const tm = setTimeout(() => { try{ ctl.abort(); }catch(_){} }, timeoutMs || 5000);
      try{
        const r = await fetch(`${base}/${path}.json`, {signal: ctl.signal});
        clearTimeout(tm);
        if(!r.ok) return null;
        return await r.json();
      }catch(_){ clearTimeout(tm); return null; }
    },
    put: async (path, val, timeoutMs) => {
      const ctl = new AbortController();
      const tm = setTimeout(() => { try{ ctl.abort(); }catch(_){} }, timeoutMs || 5000);
      try{
        const r = await fetch(`${base}/${path}.json`, {
          method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(val), signal: ctl.signal,
        });
        clearTimeout(tm);
        return r.ok;
      }catch(_){ clearTimeout(tm); return false; }
    },
    // v2.2.1: 재시도 가능한 PUT — 큐 등록 등 결정적 작업용
    // 반환: { ok: bool, status: number|null, retries: number, message: string }
    // v8.6: 각 시도에 5초 timeout
    putRetry: async (path, val, opts) => {
      const o = Object.assign({tries:3, backoffMs:300, timeoutMs:5000}, opts||{});
      let lastStatus = null, lastErr = '';
      for(let i=0; i<o.tries; i++){
        const ctl = new AbortController();
        const tm = setTimeout(() => { try{ ctl.abort(); }catch(_){} }, o.timeoutMs);
        try{
          const r = await fetch(`${base}/${path}.json`, {
            method:'PUT', headers:{'Content-Type':'application/json'},
            body: JSON.stringify(val), signal: ctl.signal,
          });
          clearTimeout(tm);
          if(r.ok) return { ok:true, status:r.status, retries:i, message:'' };
          lastStatus = r.status;
          // 401·403 (보안 룰 거부) — 재시도해도 의미 없음
          if(r.status === 401 || r.status === 403){
            return { ok:false, status:r.status, retries:i, message:'권한 거부(보안 룰)' };
          }
          // 5xx·기타 — 재시도
          lastErr = `HTTP ${r.status}`;
        }catch(e){
          clearTimeout(tm);
          lastErr = (e && e.name === 'AbortError') ? `timeout ${o.timeoutMs}ms` : ((e && e.message) || '네트워크 오류');
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
    // v7.1: 멀티 진단 — 각 노드의 GET/PUT 권한을 직접 REST로 점검.
    //   반환: [{node, op, ok, status, msg, body, url}, ...]
    //   PUT 테스트는 __diag/{userId} 임시 키에 timestamp 쓰고 즉시 삭제.
    //   사용자 콘솔에 결과를 명시적으로 표시 (어떤 노드의 어떤 권한이 막혔는지).
    //   v8.1: 실패 시 Firebase 응답 본문(예: "Permission denied")까지 표시
    diag: async (userId) => {
      const results = [];
      const stamp = Date.now();
      const tryGet = async (node) => {
        const url = `${base}/${node}.json?shallow=true`;
        try{
          const r = await fetch(url);
          let body = '';
          if(!r.ok){ try{ body = await r.text(); }catch(_){} }
          results.push({node, op:'read',  ok:r.ok, status:r.status, body, url,
                        msg: r.ok ? '읽기 OK' : (r.status === 401 || r.status === 403 ? '권한 거부' : `HTTP ${r.status}`)});
        }catch(e){
          results.push({node, op:'read', ok:false, status:0, url, msg:'네트워크 오류'});
        }
      };
      const tryPut = async (node) => {
        const path = `${node}/__diag/${userId||'anon'}`;
        const url = `${base}/${path}.json`;
        try{
          const r = await fetch(url, {
            method:'PUT', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ts:stamp})
          });
          let body = '';
          if(!r.ok){ try{ body = await r.text(); }catch(_){} }
          results.push({node, op:'write', ok:r.ok, status:r.status, body, url,
                        msg: r.ok ? '쓰기 OK' : (r.status === 401 || r.status === 403 ? '권한 거부' : `HTTP ${r.status}`)});
          if(r.ok){
            // 청소
            try{ await fetch(url, {method:'DELETE'}); }catch(_){}
          }
        }catch(e){
          results.push({node, op:'write', ok:false, status:0, url, msg:'네트워크 오류'});
        }
      };
      // 5지선다 멀티
      await tryGet('lobby');       await tryPut('lobby');
      await tryGet('battles');     await tryPut('battles');
      // 카드 對決
      await tryGet('lobby_card');  await tryPut('lobby_card');
      await tryGet('card_battles');await tryPut('card_battles');
      // presence (둘러보는 중)
      await tryGet('presence');    await tryPut('presence');
      // 5지선다 idle
      await tryGet('lobby_idle');  await tryPut('lobby_idle');
      return results;
    },
    // v8.9 critical 재작성: paideia 패턴 — polling-only (SSE 완전 제거).
    //   기존 (v2.2~v8.8): EventSource SSE + 복잡한 폴백 + active polling 병행.
    //     iOS Safari 에서 SSE 가 첫 메시지 후 끊기면 자동 회복 실패 → cross-client
    //     변경 안 보이는 근본 문제. v8.8 의 병행 polling 도 SSE 부분이 잔존하여
    //     race + 중복 emit.
    //   v8.9: paideia-pwa-v60 의 검증된 패턴을 채택 — 매 2초 fetch GET 으로
    //     full snapshot 동기화. SSE 없음. AbortController 4초 timeout 으로 hang 방지.
    //     close() 가 깨끗하게 polling 종료.
    //   호출처 API 동일 (subscribe(path, onUpdate, opts) → {close, snapshot}).
    subscribe: (path, onUpdate, opts) => {
      const o = Object.assign({pollMs: 2000, timeoutMs: 4000}, opts||{});
      const url = `${base}/${path}.json`;
      let snapshot = null;
      let closed = false;
      let pollTimer = null;

      const emit = () => {
        if(closed) return;
        try{ onUpdate(snapshot); }
        catch(e){
          try{ console.error('[FB.subscribe] onUpdate error', path, e); }catch(_){}
          try{ _lastSubError = {path, err: e && e.message || String(e), at: Date.now()}; }catch(_){}
        }
      };

      const tick = async () => {
        if(closed) return;
        const ctl = new AbortController();
        const tm = setTimeout(() => { try{ ctl.abort(); }catch(_){} }, o.timeoutMs);
        try{
          const r = await fetch(url, {signal: ctl.signal});
          clearTimeout(tm);
          if(r.ok){
            const v = await r.json();
            snapshot = (v === null || v === undefined) ? null : v;
            emit();
          }
        }catch(_){
          clearTimeout(tm);
          // 일시적 실패 — 다음 tick 에서 재시도
        }
        if(!closed) pollTimer = setTimeout(tick, o.pollMs);
      };
      // 즉시 첫 fetch (초기 snapshot 빠르게 확보)
      tick();

      return {
        close: () => {
          closed = true;
          if(pollTimer){ clearTimeout(pollTimer); pollTimer = null; }
        },
        get snapshot(){ return snapshot; },
      };
    },
  };
})();

// v9.7.0 (롤업): FB 를 window 에 노출.
// 이유: 최상위 const 는 globalThis 에 자동 노출되지 않음 (classic script 사양).
//      bangje-v96-part3.js (Card AI) / bangje-v96-part4.js (Cube AI) 가
//      window.FB.get/put/subscribe 를 monkey-patch 해 in-memory 룸 IO 를 흉내내는데,
//      window.FB 가 undefined 면 setupBridge() 가 silent return → 패치 안됨 →
//      AI 룸 데이터가 진짜 Firebase 에 query 됨 → "방 데이터 없음" / "방을 찾을 수 없습니다".
// 또한 bangje-cube.js 의 fb() 헬퍼는 lexical FB 를 반환하므로, 패치가 양쪽 참조에
// 동시에 적용되도록 동일 객체 reference 를 window.FB 에 묶어둠 (대입 X · 동일 ref).
// globalThis 에도 노출해 module scope 외부에서 안전하게 접근 가능.
if(typeof window !== 'undefined' && FB){ window.FB = FB; }
if(typeof globalThis !== 'undefined' && FB){ globalThis.FB = FB; }

// ───── 3. 유틸 ─────────────────────────────────────────────────────────────
const view = document.getElementById('view');
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
function esc(s){ return String(s||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

// v5: 四象 진영 헬퍼 (data-factions.js 의 getFaction 래핑) — S.faction 미설정 안전망
function _curFaction(){ return (typeof getFaction === 'function') ? getFaction(S.faction) : {id:'',han:'',han2:'',ko:'',color:'#666',passive:''}; }
function _factionChip(id, size){
  const f = (typeof getFaction === 'function') ? getFaction(id) : null;
  if(!f) return '';
  const cls = size === 'tiny' ? ' tiny' : (size === 'big' ? ' big' : '');
  return `<span class="faction-chip${cls}" style="background:${esc(f.color)}" title="${esc(f.han)} (${esc(f.ko)}) — ${esc(f.passive)}">${esc(f.han2)}</span>`;
}

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

// ─── v3 기출/자작 분리 헬퍼 ───────────────────────────────────────────────
// PAST_EXAMS (진짜 22학번 기출, src: '22-2 ...', id: 'past_*')
// BULK_QUESTIONS (v3 자작 350+, src: '신규-수시범위', id: 'bq_*')
// 두 풀은 같은 스키마이나 의미가 다르므로 화면별로 명확히 구분.
function isPastQ(q){
  if(!q) return false;
  if(q.id && /^past_/.test(q.id)) return true;
  if(q.src && /수시$|학번|기출/.test(q.src) && !/^신규/.test(q.src)) return true;
  return false;
}
function isNewQ(q){
  if(!q) return false;
  if(q.id && /^bq_/.test(q.id)) return true;
  if(q.src && /^신규/.test(q.src)) return true;
  return false;
}
// 통합 풀 — 기본 'all', 'past'면 기출만, 'new'면 자작만.
// 의미상 어떤 풀이 필요한지 호출부에서 명시. 호환성 위해 'all' default 유지.
function questionPool(mode){
  const past = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const bulk = (typeof BULK_QUESTIONS !== 'undefined') ? BULK_QUESTIONS : [];
  if(mode === 'past') return past;
  if(mode === 'new')  return bulk;
  return past.concat(bulk);
}
window.isPastQ = isPastQ; window.isNewQ = isNewQ; window.questionPool = questionPool;

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

// 사진 있는 캐릭터는 사진을 덮어 표시.
// v2.3 chained fallback: meta.url (로컬 우선) → meta.fallback (Wikimedia 등 원격) → CSS init 메달리온
//   url 로드 실패 → fallback 시도 → 그것마저 실패 → display:none 으로 SVG init 노출
function _charPhotoMedallion(charOrId, size){
  const c = (typeof charOrId === 'string') ? PHYSICIAN_BY_ID[charOrId] : charOrId;
  if(!c) return _charMedallion(charOrId, size);
  const imgs = (typeof CHARACTER_IMAGES !== 'undefined') ? CHARACTER_IMAGES : {};
  const meta = imgs[c.id];
  if(!meta || !meta.url) return _charMedallion(c, size);
  // 메달리온을 안쪽에 깔고 사진을 위에 덮음.
  const showName = size >= 80;
  const init = c.init || (c.han && c.han[0]) || '?';
  const initSize = showName ? Math.round(size * 0.42) : Math.round(size * 0.55);
  const nameSize = Math.max(8, Math.round(size * 0.105));
  const pad = Math.max(2, Math.round(size * 0.06));
  const labelEsc = `${esc(c.ko)} — ${esc(c.han)}`;
  // onerror 핸들러: 1차 실패 → fallback url 시도, 2차 실패 → 숨김 (SVG init 노출)
  const fb = meta.fallback || '';
  const onerr = fb
    ? `if(!this.dataset.fb){this.dataset.fb='1';this.src='${esc(fb)}'}else{this.style.display='none'}`
    : `this.style.display='none'`;
  return `<div role="img" aria-label="${labelEsc}" title="${labelEsc} · ${esc(meta.caption||'')}" style="position:relative;display:inline-block;width:${size}px;height:${size}px;vertical-align:middle">
    <div class="cmedal cat-${esc(c.cat||'ancient')}" style="position:absolute;inset:0;width:100%;height:100%">
      <div class="cmedal-init" style="font-size:${initSize}px">${esc(init)}</div>
      ${showName ? `<div class="cmedal-name" style="font-size:${nameSize}px">${esc(c.ko)}</div>` : ''}
    </div>
    <img src="${esc(meta.url)}" alt="${labelEsc}" loading="lazy" decoding="async"
         onerror="${onerr}"
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

// ─── v4: TTS (인트로 한문 낭독) ──────────────────────────────────────────
//   v6 개편: SpeechSynthesis(zh voice 보유 시) → Google Translate TTS (audio element fallback)
//            → silent (둘 다 실패 시). 사용자가 별도 설치 없이 중국어 들림.
//   A안 — zh-CN voice 통일. 양측이 거의 동시에 발화하도록 speak() 동시 호출.
//   이순재(id='leesoonjae') 는 명시적으로 무음 (시트콤 외래 캐릭터).
const tts = {
  voicesReady: null,
  zhVoices: [],
  supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
  warnedNoZh: false,        // v6: 중국어 voice 없음 안내 1회만
  _activeAudios: [],        // v6: Google fallback 활성 Audio 인스턴스 추적 (cancel용)

  init(){
    if(!this.supported) return Promise.resolve([]);
    if(this.voicesReady) return this.voicesReady;
    this.voicesReady = new Promise((resolve) => {
      const grab = () => {
        const list = speechSynthesis.getVoices() || [];
        this.zhVoices = list.filter(v => /^zh(-|_)?(CN|HK|TW)/i.test(v.lang) || /Chinese|普通话|國語|Mandarin|Cantonese/i.test(v.name||''));
        this.zhVoices.sort((a,b) => {
          const A = /zh.CN/i.test(a.lang) ? 0 : (/zh.TW/i.test(a.lang) ? 1 : 2);
          const B = /zh.CN/i.test(b.lang) ? 0 : (/zh.TW/i.test(b.lang) ? 1 : 2);
          return A - B;
        });
        resolve(list);
      };
      const cur = speechSynthesis.getVoices();
      if(cur && cur.length){ grab(); return; }
      speechSynthesis.addEventListener('voiceschanged', grab, { once:true });
      setTimeout(grab, 1500);
    });
    return this.voicesReady;
  },

  // v6: Google Translate 비공식 TTS endpoint — audio element 로 재생 (CORS 우회)
  //   100자 제한이 있으나 인트로 명언은 보통 12자 내외.
  //   네트워크 / 차단 시 자동 silent. 인트로 진행은 안 막음.
  _googleTTSUrl(text){
    const t = String(text||'').slice(0, 90);   // 안전 마진
    return `https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=${encodeURIComponent(t)}`;
  },
  _playGoogleTTS(text, opts){
    if(!text) return null;
    try{
      const a = new Audio(this._googleTTSUrl(text));
      a.volume = opts && opts.volume != null ? opts.volume : 0.95;
      a.playbackRate = opts && opts.rate != null ? Math.max(0.5, Math.min(2.0, opts.rate)) : 0.85;
      this._activeAudios.push(a);
      a.addEventListener('ended', () => {
        this._activeAudios = this._activeAudios.filter(x => x !== a);
      });
      a.addEventListener('error', () => {
        this._activeAudios = this._activeAudios.filter(x => x !== a);
      });
      // play() 는 Promise 반환. 차단 환경에서는 catch 로 silent 처리.
      const p = a.play();
      if(p && typeof p.catch === 'function') p.catch(() => {});
      return a;
    } catch(e){ return null; }
  },

  // 단일 한문 발화. 분기: zh voice 있으면 SpeechSynthesis, 없으면 Google TTS
  speak(text, opts){
    if(!text) return null;
    opts = opts || {};
    // v6: zh voice 보유 → 기존 SpeechSynthesis
    if(this.supported && this.zhVoices.length){
      try{
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = opts.rate != null ? opts.rate : 0.85;
        u.pitch = opts.pitch != null ? opts.pitch : 1.0;
        u.volume = opts.volume != null ? opts.volume : 0.95;
        const idx = ((opts.voiceIndex|0) % this.zhVoices.length + this.zhVoices.length) % this.zhVoices.length;
        u.voice = this.zhVoices[idx];
        speechSynthesis.speak(u);
        return u;
      } catch(e){ /* fall through */ }
    }
    // v6: zh voice 없음 → Google Translate TTS fallback
    if(!this.warnedNoZh){
      this.warnedNoZh = true;
      // 첫 1회만 toast — 게임 진행 안 막음
      try{ if(typeof toast === 'function') toast('중국어 voice 없음 → 인터넷 TTS 사용 (네트워크 필요)','gold'); }catch(_){}
    }
    return this._playGoogleTTS(text, opts);
  },

  // 양측 동시 발화. me/opp 두 quote 객체. id가 leesoonjae 면 그 측은 무음.
  speakIntroPair(meId, meText, oppId, oppText){
    return Promise.resolve(this.init()).then(() => {
      this.cancel();
      const meSilent = (meId === 'leesoonjae');
      const oppSilent = (oppId === 'leesoonjae');
      if(meSilent && oppSilent) return;
      // v6: Google TTS fallback 시 동시 재생은 audio element 가 알아서 병렬 처리
      if(!oppSilent && oppText){
        this.speak(oppText, { rate: 0.82, pitch: 0.92, voiceIndex: 0 });
      }
      if(!meSilent && meText){
        // 약간의 지연 — Google TTS audio 가 동시 시작하면 한쪽이 묻힐 수 있어 80ms 분리
        const delayMs = this.zhVoices.length ? 0 : 80;
        setTimeout(() => {
          this.speak(meText, { rate: 0.82, pitch: 1.08, voiceIndex: this.zhVoices.length > 1 ? 1 : 0 });
        }, delayMs);
      }
    });
  },

  cancel(){
    if(this.supported){ try{ speechSynthesis.cancel(); } catch(_){} }
    // v6: Google TTS audio 도 정지
    this._activeAudios.forEach(a => { try{ a.pause(); a.currentTime = 0; }catch(_){} });
    this._activeAudios = [];
  }
};
if(typeof window !== 'undefined') window.tts = tts;

// 中華 古風 BGM — Web Audio API 로 五聲音階 (宫商角徵羽) 합성
// 古琴 시뮬레이션: sine + saw mix, 부드러운 attack, 긴 decay
const bgm = {
  ctx: null, master: null, on: false, timer: null, t0: 0,
  mode: null,        // 'ambient' | 'battle' | 'victory' | 'defeat' | null
  prevMode: null,
  userGestureSeen: false,  // v3: 첫 클릭 등 user-gesture 감지 후에만 AudioContext.resume() 안전
  userDisabled: false,     // v3: 사용자가 명시적으로 OFF 시 자동 재생 금지
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

  // v3: 모든 schedule 루프를 단일 invariant — 한 번에 한 모드만 살아 있게.
  // ambient/battle/victory/defeat 어느 것을 시작하기 전에 반드시 호출.
  _stopSchedulers(){
    clearTimeout(this.timer);
    this.timer = null;
  },
  _ensureCtx(){
    this.init();
    if(!this.ctx) return false;
    // user-gesture 이전엔 resume() 해도 의미 없지만 시도는 한다 (suspended일 때만)
    if(this.ctx.state === 'suspended'){
      try{ this.ctx.resume(); }catch(_){}
    }
    return true;
  },

  start(){
    if(!this._ensureCtx()){ toast('이 기기는 BGM 미지원'); return; }
    this._stopSchedulers();
    this.on = true;
    this.mode = 'ambient';
    this.userDisabled = false;
    this.schedule();
    refreshHeader();
  },
  stop(){
    this._stopSchedulers();
    this.on = false;
    this.mode = null;
    this.userDisabled = true;  // v3: 사용자가 끈 의도 기억 → 자동 재생 차단
    refreshHeader();
  },
  toggle(){ this.on ? this.stop() : this.start(); },

  // v3: 大廳 진입 시 자동 ambient 재생. 첫 user-gesture 이후 + 사용자 OFF 의도 없을 때만.
  autoStartAmbient(){
    if(this.userDisabled) return;
    if(!this.userGestureSeen) return;
    if(this.on && this.mode === 'ambient') return;
    if(!this._ensureCtx()) return;
    this._stopSchedulers();
    this.on = true;
    this.mode = 'ambient';
    this.schedule();
    refreshHeader();
  },

  // 배틀 입장 시 호출 — 긴박한 戰鬪 BGM 으로 즉시 전환 (사용자 토글에 무관)
  startBattle(){
    if(!this._ensureCtx()) return;
    this._stopSchedulers();
    this.on = true;
    this.mode = 'battle';
    this.prevMode = this.prevMode || 'ambient';
    this.scheduleBattle();
    refreshHeader();
  },
  // 배틀 종료 시 호출 — 이전 ambient 모드로 복귀
  stopBattle(){
    if(this.mode !== 'battle') return;
    this._stopSchedulers();
    this.mode = 'ambient';
    if(this.on) this.schedule();
    refreshHeader();
  },

  // ── v3: 승리 BGM — C major arpeggio, 110 BPM, bell-like (sine+triangle 1옥타브 위)
  //    배틀 결과 화면 진입 시 호출. ambient/battle은 _stopSchedulers로 끔.
  scheduleVictory(){
    if(!this.ctx || !this.on || this.mode !== 'victory') return;
    const t = this.ctx.currentTime;
    const bpm = 110;
    const beat = 60 / bpm;
    const bar = beat * 4;
    const numBars = 4;
    // C major arpeggio (C4 E4 G4 C5 E5 G5) — 밝은 상승
    const arp = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    for(let b = 0; b < numBars; b++){
      const tb = t + b * bar;
      // 8분음표 6개 + 마무리 C5 sustain
      for(let i = 0; i < 6; i++){
        this.pluck(arp[i], tb + i * (beat/2), beat * 1.1, 0.16);
      }
      // 베이스 C2 + G2 (V→I 진행 흉내)
      this.pluck(65.41, tb, beat * 2, 0.12);              // C2
      this.pluck(98.00, tb + beat * 2, beat * 2, 0.11);   // G2
      // 마지막 마디 종지: C5 길게
      if(b === numBars - 1){
        this.pluck(523.25, tb + beat * 3, beat * 2.5, 0.20);
      }
    }
    this.timer = setTimeout(() => this.scheduleVictory(), bar * numBars * 1000 - 200);
  },
  startVictory(){
    if(!this._ensureCtx()) return;
    this._stopSchedulers();
    this.on = true;
    this.mode = 'victory';
    this.scheduleVictory();
    refreshHeader();
  },

  // ── v3: 패배 BGM — A minor 저속 드론 (A2, C3, E3 sustained), 매우 느린 LFO 스웰
  scheduleDefeat(){
    if(!this.ctx || !this.on || this.mode !== 'defeat') return;
    const t = this.ctx.currentTime;
    const bar = 4.0; // 4초 단위
    const numBars = 4;
    // 단조 화음 — 3-note long drone
    const chord = [110.00, 130.81, 164.81]; // A2, C3, E3
    for(let b = 0; b < numBars; b++){
      const tb = t + b * bar;
      chord.forEach((f, idx) => {
        // 길게 sustain + 부드러운 fade-in/fade-out
        this.pluck(f, tb + idx * 0.15, bar * 1.05, 0.09);
      });
      // 마디 후반 한숨처럼 하강하는 高音 single note (A4→F4)
      if(b % 2 === 0){
        this.pluck(440.00, tb + bar * 0.55, 1.2, 0.08);
        this.pluck(349.23, tb + bar * 0.78, 1.5, 0.07);
      }
    }
    this.timer = setTimeout(() => this.scheduleDefeat(), bar * numBars * 1000 - 200);
  },
  startDefeat(){
    if(!this._ensureCtx()) return;
    this._stopSchedulers();
    this.on = true;
    this.mode = 'defeat';
    this.scheduleDefeat();
    refreshHeader();
  },

  // ── v3: 선지 클릭 효과음 (정답: 상승 C5→E5→G5, 200ms / 오답: 하강 G4→Eb4, 350ms)
  //    BGM on/off와 무관하게 항상 재생. ctx만 있으면 작동.
  //    user-gesture 이전엔 ctx.resume()이 실패해도 silent 처리.
  sfxCorrect(){
    if(!this._ensureCtx()) return;
    const t = this.ctx.currentTime;
    // 3음 빠른 상승 (각 70ms)
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const o2 = this.ctx.createOscillator();
      o2.type = 'triangle'; o2.frequency.value = f * 2;
      const g = this.ctx.createGain();
      const ts = t + i * 0.065;
      g.gain.setValueAtTime(0, ts);
      g.gain.linearRampToValueAtTime(0.20, ts + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.18);
      const g2 = this.ctx.createGain(); g2.gain.value = 0.22;
      o2.connect(g2); g2.connect(g); o.connect(g);
      // SFX는 master를 거치되 BGM master gain 영향 받지 않게 별도 출력
      g.connect(this.ctx.destination);
      o.start(ts); o.stop(ts + 0.22);
      o2.start(ts); o2.stop(ts + 0.22);
    });
  },
  sfxWrong(){
    if(!this._ensureCtx()) return;
    const t = this.ctx.currentTime;
    // 2음 하강 (G4 → Eb4) — 묵직한 톤
    const notes = [392.00, 311.13];
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const o2 = this.ctx.createOscillator();
      o2.type = 'sawtooth'; o2.frequency.value = f / 2; // 옥타브 아래 약하게
      const g = this.ctx.createGain();
      const ts = t + i * 0.16;
      g.gain.setValueAtTime(0, ts);
      g.gain.linearRampToValueAtTime(0.18, ts + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.34);
      const g2 = this.ctx.createGain(); g2.gain.value = 0.12;
      o2.connect(g2); g2.connect(g); o.connect(g);
      g.connect(this.ctx.destination);
      o.start(ts); o.stop(ts + 0.40);
      o2.start(ts); o2.stop(ts + 0.40);
    });
  }
};
window.bgm = bgm;

// ───── 6.5 사용자별 전적 (v3) ───────────────────────────────────────────────
// Firebase /stats/records/{userId}: {w, l, d, lastTs}
// 한 화면당 1회 batch fetch로 캐싱 (5초 TTL) — Hall/Intro에서 공용.
const _recordsCache = { data: null, ts: 0, TTL_MS: 5000 };
async function fetchAllRecords(force){
  if(!FB) return null;
  const now = Date.now();
  if(!force && _recordsCache.data && (now - _recordsCache.ts) < _recordsCache.TTL_MS){
    return _recordsCache.data;
  }
  try{
    const all = await FB.get('stats/records');
    _recordsCache.data = all || {};
    _recordsCache.ts = now;
    return _recordsCache.data;
  }catch(_){
    return _recordsCache.data || {};
  }
}
// 단일 사용자 record (FB 1회 조회) — 인트로처럼 2-3명만 필요할 때
async function fetchUserRecord(uid){
  if(!FB) return {w:0,l:0,d:0};
  try{ return (await FB.get(`stats/records/${uid}`)) || {w:0,l:0,d:0}; }
  catch(_){ return {w:0,l:0,d:0}; }
}
// 미니 W-L 칩 HTML — Hall 사다리·글로벌랭킹·인트로 공용
// size: 'tiny' (10.5px) | 'small' (12px) | 'large' (17px)
function recordChip(rec, size){
  const r = rec || {w:0,l:0,d:0};
  const w = r.w||0, l = r.l||0, d = r.d||0;
  const total = w + l + d;
  if(total === 0){
    if(size === 'large') return '<span style="font-size:11px;color:var(--gutong);font-style:italic">無 戰績</span>';
    return '';
  }
  const winRate = total > 0 ? Math.round(w/total*100) : 0;
  if(size === 'large'){
    return `<span style="display:inline-flex;gap:4px;align-items:center;font-size:11px;color:var(--mo-l);font-weight:600;letter-spacing:.03em">
      <b style="color:var(--feicui)">${w}勝</b>
      ${l>0?`<b style="color:var(--zhusha)">${l}敗</b>`:''}
      ${d>0?`<b style="color:var(--gutong)">${d}和</b>`:''}
      <span style="color:var(--gutong);font-weight:400">(${winRate}%)</span>
    </span>`;
  }
  // tiny/small — 한 줄에 압축
  const fs = size === 'small' ? '11px' : '10px';
  return `<span style="font-size:${fs};color:var(--gutong);margin-left:4px;white-space:nowrap"
    title="${w}勝 ${l}敗 ${d}和 · 승률 ${winRate}%">
    <b style="color:var(--feicui);font-weight:700">${w}</b>·<b style="color:var(--zhusha);font-weight:700">${l}</b>${d?`·<b style="color:var(--gutong)">${d}</b>`:''}
  </span>`;
}

// ───── 7. 라우팅 ─────────────────────────────────────────────────────────────
function setTab(name){
  // v9.3: 매치 확인 화면에서는 탭 이동 강제 차단. 사용자는 「對決開始」 또는 「取消」 둘 중 하나만 가능.
  //   30초 timeout 으로 자동 취소되므로 무한 잠금 아님.
  if(_inMatchConfirm){
    toast('매치 확인 중 — 對決開始 또는 取消 를 누르세요','gold');
    return;
  }
  // v7.2: 배틀 중 외부 탭 이동 가드 — 확인 모달 + forfeit 처리
  //   결과 화면이거나 명시적으로 'battle' 탭 호출이면 통과.
  //   _inBattleSession 이 true 인데 외부 탭으로 가려고 하면 모달 띄우고 탭 이동 중단.
  if(_inBattleSession && name !== 'battle'){
    confirmLeaveBattle(() => {
      // 확인됨 — forfeit 처리 후 탭 이동
      forfeitCurrentBattle().finally(() => {
        _inBattleSession = false;
        _battleSessionMeta = null;
        setTab(name);  // 가드 통과 후 재호출
      });
    });
    return;
  }
  // v2.2.2: 다른 탭으로 이동 시 멀티 로비 SSE/idle 정리
  if(typeof stopLobbyStreams === 'function') stopLobbyStreams();
  if(typeof stopLobbyIdle    === 'function') stopLobbyIdle();
  // v7: 카드 對決 스트림 정리 (배틀 탭이 아닐 때만 — 배틀 중 자기 화면 갱신은 막지 않음)
  if(name !== 'battle' && typeof stopCardStreams === 'function') stopCardStreams();
  S.lastTab = name; saveState();
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  view.scrollTop = 0; window.scrollTo({top:0, behavior:'instant'});
  // v9.6: 활동 라벨 갱신 (presence detail 모달에서 표시)
  if(typeof window.V96Activity !== 'undefined'){
    const labels = {
      home: '大廳', formula: '處方 학습', herb: '本草 학습', quiz: '기출·암기',
      flash: '암기·주관식', stats: '통계·분석', hall: '명예의 전당',
      cube: '방미큐브 對局', warrior2h: '2시간의 전사', battle: '對決 진행 중',
    };
    try{ window.V96Activity.set(labels[name] || name, ''); }catch(_){}
  }
  const r = ROUTES[name] || ROUTES.home;
  view.innerHTML = '';
  r();
  // 페이지 진입 시 사용자 활동 갱신
  if(FB && S.userId) recordPresence();
}
window.setTab = setTab;

// v7.2: 배틀 이탈 확인 모달
function confirmLeaveBattle(onConfirm){
  const meta = _battleSessionMeta || {};
  const modeKo = meta.mode === 'card' ? '카드 對決' : '5지선다 對決';
  openModal(`
    <div style="text-align:center;padding:8px 4px 4px">
      <div class="han" style="font-size:34px;color:var(--zhusha-d);margin-bottom:6px">敗</div>
      <h3 style="font-family:var(--font-display);font-size:18px;color:var(--zhusha-d);margin-bottom:10px">정말 ${esc(modeKo)}에서 나가시겠습니까?</h3>
      <div style="font-size:13px;color:var(--mo);margin-bottom:6px">
        나가면 <b style="color:var(--zhusha-d)">패배 처리</b>되어 베팅한 氣를 잃습니다.<br>
        상대에게는 부전승이 부여됩니다.
      </div>
      <div style="font-size:11px;color:var(--gutong);margin-bottom:16px">방 ID: ${esc(meta.roomId||'?')}</div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button class="btn" id="leave-cancel" type="button">계속 對決</button>
        <button class="btn btn-o" id="leave-confirm" type="button" style="color:var(--zhusha-d);border-color:var(--zhusha-d)">나가기 (패배)</button>
      </div>
    </div>
  `);
  $('#leave-cancel').addEventListener('click', () => closeModal());
  $('#leave-confirm').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}
window.confirmLeaveBattle = confirmLeaveBattle;

// v7.2: 현재 진행 중 배틀에 대한 forfeit 처리
//   5지선다: players/{me}/done=true, score=0, surrendered=true 마킹
//             → 상대 클라이언트는 allDone 검사에서 즉시 정산 (자기 승리)
//   카드:    result={winner:oppId, by:'forfeit'} + status='done'
//             → 상대 _cardRoomStream 이 즉시 결과 화면 표시
//   beforeunload(keepalive)에서도 호출 가능하도록 keepalive 옵션 분기 제공.
async function forfeitCurrentBattle(opts){
  const meta = _battleSessionMeta;
  if(!meta || !meta.roomId) return;
  const keepalive = !!(opts && opts.keepalive);
  const base = FB && FB.base;
  if(!base) return;
  try{
    if(meta.mode === 'card'){
      // 카드 對決 — 상대를 승자로
      const oppId = meta.oppId;
      if(!oppId){ return; }
      const result = {winner: oppId, by: 'forfeit', forfeitedBy: S.userId, finishedAt: Date.now()};
      // PUT result + PUT status (병렬, keepalive 가능)
      fetch(`${base}/card_battles/${meta.roomId}/result.json`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(result), keepalive
      }).catch(()=>{});
      await fetch(`${base}/card_battles/${meta.roomId}/status.json`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify('done'), keepalive
      }).catch(()=>{});
    } else {
      // 5지선다 — 자기 done=true + surrendered=true. 상대는 자동 승리.
      const patch = {done:true, score:0, surrendered:true, finishedAt:Date.now()};
      await fetch(`${base}/battles/${meta.roomId}/players/${S.userId}.json`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(patch), keepalive
      }).catch(()=>{});
    }
    // 로컬 측: 氣 정산 (베팅은 이미 에스크로로 차감됨, 추가 손실 없음 — 베팅 손실 = 패배 정산)
    // battleHistory 에 forfeit 기록 추가
    S.battleHistory = S.battleHistory || [];
    S.battleHistory.unshift({
      ts: Date.now(), win: false, draw: false, forfeit: true, surrender: true,
      myScore: 0, oppScore: '-',
      opponentName: '(상대)', opponentChar: null,
      bet: 0, deltaQi: 0, factionBonus: 0, faction: S.faction,
      mode: meta.mode
    });
    if(S.battleHistory.length > 20) S.battleHistory = S.battleHistory.slice(0,20);
    // 패배 record 갱신
    if(!keepalive && FB && S.userId){
      try{
        const rec = (await FB.get(`stats/records/${S.userId}`)) || {w:0,l:0,d:0};
        rec.l = (rec.l||0)+1;
        rec.lastTs = Date.now();
        await FB.put(`stats/records/${S.userId}`, rec);
      }catch(_){}
    }
    saveState();
  }catch(_){}
}
window.forfeitCurrentBattle = forfeitCurrentBattle;

// v7.2: 페이지 닫기/새로고침/뒤로가기 가드
//   beforeunload 에서 browser confirm + 백그라운드로 forfeit 시도 (keepalive)
window.addEventListener('beforeunload', (e) => {
  if(!_inBattleSession) return;
  // forfeit 시도 (keepalive fetch — async 완료 못 기다림)
  try{ forfeitCurrentBattle({keepalive:true}); }catch(_){}
  // 브라우저 표준 확인 다이얼로그 (사용자 작업 종료 방지)
  e.preventDefault();
  e.returnValue = '對決 중입니다. 페이지를 떠나면 패배 처리됩니다.';
  return e.returnValue;
});

const ROUTES = {
  home: renderHome,
  formula: renderFormulas,
  herb: renderHerbs,
  quiz: renderQuiz,
  flash: renderFlashHub,       // v9.4: 플래시카드 + 주관식 허브
  stats: renderStats,
  hall: renderHall,
  cube: (typeof renderCube === 'function') ? renderCube : renderHome,  // v9.5: 방미큐브
  warrior2h: (typeof window !== 'undefined' && typeof window.V96RenderWarrior2H === 'function') ? window.V96RenderWarrior2H : renderHome,  // v9.6: 2시간의전사
  admin: renderAdminPanel,  // v8.2: PWA 내장 관리자 패널 (#admin URL 또는 hidden 진입)
};

// ───── 7.5. 관리자 패널 (v8.2) ────────────────────────────────────────────────
// PWA 와 같은 origin 이라 admin HTML 의 cross-origin/sandbox 문제 우회.
// 진입: URL 에 #admin 추가 (예: index.html#admin) 또는 헤더 朱砂 도장 5회 연타.
const ADMIN_NODES = [
  {key:'lobby',        desc:'5지선다 매칭 큐'},
  {key:'lobby_idle',   desc:'5지선다 둘러보는 중'},
  {key:'lobby_card',   desc:'카드 對決 매칭 큐'},
  {key:'battles',      desc:'5지선다 對決 방'},
  {key:'card_battles', desc:'카드 對決 방'},
  {key:'presence',     desc:'사용자 접속 표시'},
  {key:'stats',        desc:'전적·오답 집계'},
  {key:'feedback',     desc:'사용자 피드백'},
];

async function _adminProbeRead(key){
  const base = FB && FB.base;
  if(!base) return {ok:false, status:0, msg:'FB 없음'};
  const url = `${base}/${key}.json?shallow=true`;
  try{
    const r = await fetch(url);
    let body = '';
    if(!r.ok){ try{ body = await r.text(); }catch(_){} return {ok:false, status:r.status, body, url}; }
    const j = await r.json();
    const count = j === null ? 0 : (typeof j === 'object' ? Object.keys(j).length : 1);
    return {ok:true, status:r.status, count, url};
  }catch(e){ return {ok:false, status:0, msg:e.message, url}; }
}

async function _adminProbeWrite(key){
  const base = FB && FB.base;
  if(!base) return {ok:false, status:0, msg:'FB 없음'};
  const url = `${base}/${key}/__probe_${Date.now()}.json`;
  try{
    const r = await fetch(url, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({t:Date.now()})
    });
    let body = '';
    if(!r.ok){ try{ body = await r.text(); }catch(_){} return {ok:false, status:r.status, body, url}; }
    await fetch(url, {method:'DELETE'});
    return {ok:true, status:r.status, url};
  }catch(e){ return {ok:false, status:0, msg:e.message, url}; }
}

async function _adminDelete(key){
  const base = FB && FB.base;
  if(!base) return {ok:false};
  const url = `${base}/${key}.json`;
  try{
    const r = await fetch(url, {method:'DELETE'});
    let body = '';
    if(!r.ok){ try{ body = await r.text(); }catch(_){} }
    return {ok:r.ok, status:r.status, body, url};
  }catch(e){ return {ok:false, status:0, msg:e.message, url}; }
}

function _adminLog(msg, kind){
  const el = document.getElementById('admin-log');
  if(!el) return;
  const t = new Date().toLocaleTimeString('ko-KR', {hour12:false});
  const line = document.createElement('div');
  if(kind) line.style.color = ({ok:'#7ddc7d', err:'#ff8b8b', info:'#9bcfff', warn:'#ffd17a'})[kind] || '';
  line.textContent = `[${t}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function renderAdminPanel(){
  if(!FB){
    view.innerHTML = '<div class="card">Firebase 미설정 — 관리자 기능 사용 불가</div>';
    return;
  }
  view.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">掃</span>관리자 패널</h2>
    <div class="view-sub">Firebase RTDB 8개 노드 진단 · 청소 (PWA 동일 origin)</div>

    <div class="card fade-in">
      <div class="card-title" style="font-family:var(--font-display);color:var(--zhusha-d);font-size:13px;margin-bottom:6px">현재 RTDB 호스트</div>
      <div style="font-family:ui-monospace,monospace;font-size:11px;color:var(--mo-l);word-break:break-all;background:var(--mi);padding:6px 8px;border-radius:3px">${esc(FB.base)}</div>
    </div>

    <div class="card fade-in" id="admin-nodes-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-family:var(--font-display);color:var(--zhusha-d);font-size:13px">노드별 카운트</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-o" type="button" id="admin-refresh">카운트</button>
          <button class="btn btn-sm btn-o" type="button" id="admin-probe">쓰기 점검</button>
        </div>
      </div>
      <div id="admin-nodes" style="font-size:11.5px"></div>
    </div>

    <div class="card fade-in" style="background:#FFF8E0;border:1px dashed var(--zhusha-d)">
      <div style="font-family:var(--font-display);color:var(--zhusha-d);font-size:14px;margin-bottom:6px">⚠ 전체 삭제</div>
      <div style="font-size:12px;color:var(--mo);margin-bottom:8px;line-height:1.55">
        8개 노드 전체 삭제. 모든 사용자의 매칭 큐·전적·오답·진행중 對決 사라짐.
        氣는 클라이언트 localStorage 에 있어 별개.
      </div>
      <button class="btn" type="button" id="admin-wipe" style="background:var(--zhusha-d);color:#fff;border-color:var(--zhusha-d);font-weight:600">전체 삭제 (이중 확인)</button>
    </div>

    <div class="card fade-in" style="background:#FFE8E0;border:1px dashed var(--zhusha-d)">
      <div style="font-family:var(--font-display);color:var(--zhusha-d);font-size:14px;margin-bottom:6px">⚠ 모든 사용자 단말 localStorage 청소 (원격 wipe)</div>
      <div style="font-size:12px;color:var(--mo);margin-bottom:8px;line-height:1.55">
        Firebase 의 <code>/system/wipeAt</code> 노드에 현재 timestamp 를 게시 → 각 사용자가 다음 PWA 로드 시 자동으로 자기 단말의 氣·이름·진영·battleHistory 까지 모두 청소되고 새로 시작합니다. 동일 사용자에게 1회만 적용 (wipeAt 갱신 전엔 재실행 안 됨). 모든 사용자가 v8.3+ 를 로드한 상태여야 작동합니다.
      </div>
      <button class="btn" type="button" id="admin-remote-wipe" style="background:var(--zhusha-d);color:#fff;border-color:var(--zhusha-d);font-weight:600">단말 청소 신호 발사</button>
    </div>

    <div class="card fade-in" style="background:#161616;padding:10px 12px">
      <div style="font-family:ui-monospace,monospace;font-size:10.5px;color:#9bcfff;margin-bottom:4px">로그</div>
      <div id="admin-log" style="font-family:ui-monospace,monospace;font-size:10.5px;color:#d4d4d4;max-height:240px;overflow:auto;white-space:pre-wrap;word-break:break-all"></div>
    </div>
  `;
  _renderAdminNodeRows();
  document.getElementById('admin-refresh').addEventListener('click', _adminRefreshAll);
  document.getElementById('admin-probe').addEventListener('click', _adminProbeAll);
  document.getElementById('admin-wipe').addEventListener('click', _adminWipeAll);
  document.getElementById('admin-remote-wipe').addEventListener('click', _adminRemoteWipe);
  _adminLog('관리자 패널 준비됨. PWA 와 같은 origin 이라 CORS 영향 없음.', 'info');
  _adminRefreshAll();
}

function _renderAdminNodeRows(){
  const c = document.getElementById('admin-nodes');
  c.innerHTML = ADMIN_NODES.map(n => `
    <div style="display:grid;grid-template-columns:1fr 70px 80px;gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid var(--mi)" data-key="${esc(n.key)}">
      <div>
        <div style="font-family:ui-monospace,monospace;color:var(--zhusha-d);font-size:12px">/${esc(n.key)}</div>
        <div style="font-size:10.5px;color:var(--gutong)">${esc(n.desc)}</div>
      </div>
      <div style="text-align:right;font-family:ui-monospace,monospace;font-weight:600" id="admin-cnt-${esc(n.key)}">—</div>
      <div><button class="btn btn-sm btn-o" type="button" data-del="${esc(n.key)}" style="font-size:10.5px;padding:3px 6px;width:100%">개별 삭제</button></div>
    </div>
  `).join('');
  c.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', async () => {
      const key = b.dataset.del;
      if(!confirm(`/${key} 노드를 정말 삭제할까요?`)) return;
      b.disabled = true;
      _adminLog(`/${key} 삭제 중…`, 'info');
      const r = await _adminDelete(key);
      if(r.ok){ _adminLog(`✓ /${key} 삭제 완료`, 'ok'); }
      else{ _adminLog(`✗ /${key} 실패 (HTTP ${r.status}${r.body?' · '+r.body.slice(0,150):''})`, 'err'); }
      b.disabled = false;
      const c2 = await _adminProbeRead(key);
      const cntEl = document.getElementById(`admin-cnt-${key}`);
      if(cntEl) cntEl.textContent = c2.ok ? c2.count.toLocaleString() : 'err';
    });
  });
}

async function _adminRefreshAll(){
  _adminLog('카운트 수집…', 'info');
  let total = 0;
  for(const n of ADMIN_NODES){
    const r = await _adminProbeRead(n.key);
    const el = document.getElementById(`admin-cnt-${n.key}`);
    if(r.ok){
      total += r.count;
      if(el){ el.textContent = r.count.toLocaleString(); el.style.color = r.count === 0 ? 'var(--gutong)' : 'var(--mo)'; }
      _adminLog(`  /${n.key} : ${r.count}`, r.count > 0 ? null : 'info');
    } else {
      if(el){ el.textContent = `err ${r.status||0}`; el.style.color = 'var(--zhusha-d)'; }
      _adminLog(`  ✗ /${n.key} HTTP ${r.status} · ${r.body||r.msg||''}`, 'err');
      _adminLog(`     URL: ${r.url}`, 'info');
    }
  }
  _adminLog(`총 ${total} 항목`, total > 0 ? 'warn' : 'ok');
}

async function _adminProbeAll(){
  _adminLog('쓰기 권한 점검…', 'info');
  let ok = 0, fail = 0;
  for(const n of ADMIN_NODES){
    const r = await _adminProbeWrite(n.key);
    if(r.ok){ _adminLog(`  ✓ /${n.key} 쓰기 OK`, 'ok'); ok++; }
    else {
      const reason = r.status === 401 || r.status === 403 ? '권한 거부' : `HTTP ${r.status}`;
      _adminLog(`  ✗ /${n.key} ${reason}${r.body?' · '+r.body.slice(0,150):''}${r.msg?' · '+r.msg:''}`, 'err');
      _adminLog(`     URL: ${r.url}`, 'info');
      fail++;
    }
  }
  _adminLog(`결과: ${ok} 통과 / ${fail} 실패`, fail === 0 ? 'ok' : 'warn');
  if(fail === ADMIN_NODES.length){
    _adminLog('━━ 전 노드 실패 = "게시 안 됨" 또는 "다른 인스턴스" 가능성. 응답 본문에 Permission denied 가 있는지 확인.', 'warn');
  }
}

async function _adminWipeAll(){
  const phrase = '모두 삭제';
  const typed = prompt(`모든 사용자 기록을 영구 삭제합니다.\n진행하려면 정확히 입력: "${phrase}"`);
  if(typed !== phrase){ _adminLog('취소됨 (확인 문구 불일치)', 'warn'); return; }
  if(!confirm('마지막 확인 — 정말 모두 삭제? 되돌릴 수 없음')){
    _adminLog('취소됨 (최종 확인 거부)', 'warn'); return;
  }
  _adminLog('━━ 전체 삭제 시작 ━━', 'warn');
  document.getElementById('admin-wipe').disabled = true;
  let ok = 0, fail = 0;
  for(const n of ADMIN_NODES){
    const r = await _adminDelete(n.key);
    if(r.ok){ _adminLog(`  ✓ /${n.key} 삭제`, 'ok'); ok++; }
    else { _adminLog(`  ✗ /${n.key} HTTP ${r.status} · ${r.body||r.msg||''}`, 'err'); fail++; }
  }
  _adminLog(`━━ 완료: 성공 ${ok} / 실패 ${fail}`, fail === 0 ? 'ok' : 'err');
  await _adminRefreshAll();
  document.getElementById('admin-wipe').disabled = false;
}

async function _adminRemoteWipe(){
  const phrase = '단말 청소';
  const typed = prompt(`모든 사용자 단말의 localStorage 를 청소합니다.\n각 사용자는 다음 PWA 로드 시 자동으로 새로 시작.\n\n진행하려면 정확히 입력: "${phrase}"`);
  if(typed !== phrase){ _adminLog('취소됨 (확인 문구 불일치)', 'warn'); return; }
  if(!confirm('마지막 확인 — 모든 사용자 단말 청소 신호를 발사합니다. 진행할까요?')){
    _adminLog('취소됨', 'warn'); return;
  }
  const stamp = Date.now();
  _adminLog(`/system/wipeAt = ${stamp} (${new Date(stamp).toLocaleString('ko-KR')}) 게시 중…`, 'info');
  const base = FB && FB.base;
  if(!base){ _adminLog('FB 없음', 'err'); return; }
  try{
    const r = await fetch(`${base}/system/wipeAt.json`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(stamp)
    });
    if(!r.ok){
      let body = '';
      try{ body = await r.text(); }catch(_){}
      _adminLog(`✗ 실패 HTTP ${r.status} · ${body}`, 'err');
      return;
    }
    _adminLog(`✓ 원격 wipe 신호 발사 완료. 각 사용자가 PWA 를 다시 열면 자동 청소됩니다.`, 'ok');
    _adminLog('  본인 단말도 같은 신호를 받습니다 — 새로고침하면 자기도 청소됨.', 'warn');
  }catch(e){ _adminLog(`✗ 네트워크 오류 · ${e.message}`, 'err'); }
}

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

    <!-- v9.6: 매일의 黃帝內經 명언 (명예의 전당에서 이전) -->
    ${_neijingCardHTML()}

    <!-- 캐릭터 인사 (큰 메달리온 + 등급 진행) -->
    <div class="card imperial fade-in" id="hello-card">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="flex-shrink:0;cursor:pointer" id="char-pick-medal" title="캐릭터 변경">${_charPhotoMedallion(S.character, 80)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="seal-stamp tiny" style="background:${rk.color}">${rk.seal}</span>
            <span class="seal" style="font-size:18px;font-weight:600">${esc(S.name)}</span>
            <span class="faction-chip" style="background:${esc(_curFaction().color)}" title="${esc(_curFaction().han)} (${esc(_curFaction().ko)}) — ${esc(_curFaction().passive)}">${esc(_curFaction().han2)}</span>
            <span style="font-size:11px;color:var(--gutong)" class="han">${esc(rk.han)}·${esc(rk.ko)}</span>
            <button class="btn btn-sm btn-ghost" id="edit-name-btn" type="button" style="margin-left:auto">이름·진영</button>
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
      <button class="tile cube" type="button" onclick="setTab('cube')">
        <span class="han">方劑Cube</span><span class="ttl">방미큐브 · 4人 對局<span class="new-badge">NEW</span></span>
        <span class="desc">루미큐브 룰 · 본초 카드 · 처방 짜서 손패 비우자</span>
      </button>
      <button class="tile" type="button" onclick="setTab('formula')">
        <span class="han">方劑</span><span class="ttl">처방</span>
        <span class="desc">26 처방 카드 · 작용·구성·적응증</span>
      </button>
      <button class="tile" type="button" onclick="setTab('quiz')">
        <span class="han">問答</span><span class="ttl">기출·암기</span>
        <span class="desc">작년 기출 · 자동 객관식 · 오답함</span>
      </button>
      <button class="tile warrior2h" type="button" onclick="setTab('warrior2h')">
        <span class="han">勇者</span><span class="ttl">2시간의 전사<span class="new-badge">NEW</span></span>
        <span class="desc">점수 없는 기출 반복 학습 · 틀린 문제 ×4 가중치</span>
      </button>
      <button class="tile" type="button" onclick="setTab('herb')">
        <span class="han">本草</span><span class="ttl">약재</span>
        <span class="desc">80 약재 · 처방 역인덱스</span>
      </button>
      <button class="tile" type="button" onclick="setTab('flash')">
        <span class="han">暗誦</span><span class="ttl">암기·주관식</span>
        <span class="desc">처방·가감 플래시카드 · 조성 직접 입력 채점 <span style="background:var(--huang);color:var(--mo);padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;margin-left:2px">NEW</span></span>
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

  // 이름 + 진영 편집
  $('#edit-name-btn').addEventListener('click', () => {
    const curF = (S.faction || 'taeyang');
    openModal(`
      <h3 class="seal" style="margin:0 0 10px;color:var(--zhusha-d)">닉네임 · 四象 진영</h3>
      <div style="font-size:12px;color:var(--mo-l);margin-bottom:8px">멀티 對決·명예의 전당에서 표시됩니다.</div>
      <label>닉네임</label>
      <input id="name-input" value="${esc(S.name)}" maxlength="20">

      <div style="margin-top:12px">
        <label>四象 진영 (체질별 패시브)</label>
        <div class="faction-grid" id="faction-grid">
          ${FACTIONS.map(f => `
            <button type="button" class="faction-cell ${f.id===curF?'selected':''}"
                    data-fid="${esc(f.id)}"
                    style="--ftc:${esc(f.color)}">
              <div class="ft-head">
                <span class="faction-chip" style="background:${esc(f.color)}">${esc(f.han2)}</span>
                <span class="ft-han">${esc(f.han)}</span>
                <span class="ft-ko">${esc(f.ko)}</span>
              </div>
              <div class="ft-pas">${esc(f.passive)}</div>
            </button>
          `).join('')}
        </div>
        <div style="font-size:10.5px;color:var(--gutong);margin-top:6px;font-style:italic;line-height:1.5">
          東武 李濟馬 「東醫壽世保元」 사상의학 4 체질 · 패시브 즉시 적용
        </div>
      </div>

      <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:14px">
        <button class="btn btn-o btn-sm" onclick="closeModal()">취소</button>
        <button class="btn btn-sm" id="name-save">저장</button>
      </div>
    `);
    let pickedF = curF;
    $$('#faction-grid .faction-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        pickedF = cell.dataset.fid;
        $$('#faction-grid .faction-cell').forEach(c => c.classList.toggle('selected', c.dataset.fid === pickedF));
      });
    });
    $('#name-save').addEventListener('click', () => {
      const v = $('#name-input').value.trim().slice(0,20);
      if(!v) return toast('이름을 입력하세요');
      const changedF = pickedF !== S.faction;
      S.name = v;
      if(FACTION_BY_ID[pickedF]) S.faction = pickedF;
      saveState(); refreshHeader();
      // presence 즉시 갱신 (영토 반영)
      if(typeof recordPresence === 'function'){ try{ recordPresence(); }catch(_){} }
      closeModal();
      toast(changedF ? `${getFaction(S.faction).han} 진영으로 변경` : '저장됨','gold');
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
  // v9.6: S.activity 가 있으면 함께 기록 (presence 클릭 상세에서 사용)
  const act = (typeof S !== 'undefined' && S && S.activity) || null;
  const p = {
    name: S.name || '익명',
    character: S.character,
    faction: S.faction || '',   // v5: 영토 집계용
    qi: S.qi,
    ts: Date.now(),
    activity: act,              // v9.6
  };
  // 우선 즉시 1회 기록
  await FB.put(`presence/${S.userId}`, p);
  // 주기적 갱신 타이머 (중복 셋업 방지)
  if(!_presenceTimer){
    _presenceTimer = setInterval(async () => {
      try{
        const curAct = (typeof S !== 'undefined' && S && S.activity) || null;
        await FB.put(`presence/${S.userId}`, {...p, faction: S.faction || '', qi: S.qi, ts: Date.now(), activity: curAct});
      }catch(_){}
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
  // v9.7: 업적 추적 — 동시 학습자 최대치
  try{ if(window.V97Ach) window.V97Ach.recordPresencePeak(fresh.length); }catch(_){}
  if(fresh.length === 0){
    elList.innerHTML = '<span style="font-size:11.5px;color:var(--gutong)">현재 아무도 학습 중이 아닙니다.</span>';
    return;
  }
  elList.innerHTML = fresh.slice(0, 24).map(p => {
    const isMe = p.uid === S.userId;
    const med = _charMedallion(p.character || 'qibo', 22);
    // v9.6: activity label 짧게 표기
    const act = p.activity || null;
    const actStr = act && act.label ? `<span class="presence-act" title="${esc(act.sub||'')}" style="font-size:9.5px;color:var(--feicui);margin-left:2px">· ${esc(act.label)}</span>` : '';
    return `<div class="presence-chip" data-uid="${esc(p.uid)}" title="${esc(p.character||'')} · ${ago(p.ts||0)}${act&&act.label?' · '+esc(act.label):''}">
      <span class="dot"></span>${med}<span class="nm">${esc(p.name||'익명')}</span>
      ${isMe?'<span style="font-size:9.5px;color:var(--zhusha)">(나)</span>':''}
      ${actStr}
    </div>`;
  }).join('');
  // v9.6: presence chip 클릭 → 상세 모달
  if(typeof window.V96BindPresenceClicks === 'function'){
    try{ window.V96BindPresenceClicks('#presence-list'); }catch(_){}
  }
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
    // v9.7: 神階 해금 업적 즉시 평가
    try{ if(window.V97Ach) window.V97Ach.evaluateAll(); }catch(_){}
    setTimeout(() => openCharacterPicker(), 300);
  });
}

// ───── 10. 명예의 전당 ──────────────────────────────────────────────────────
// v9.3: 매일 1편의 黃帝內經 명언을 帝王風 카드로 렌더.
//   data-neijing.js 의 pickDailyAphorism() 결과를 신뢰. fallback 안전.
//   KST 자정에 자동 변경되므로 별도 갱신 타이머 불필요 (다음 진입 시 새 명언).
function _neijingCardHTML(){
  const ap = (typeof pickDailyAphorism === 'function') ? pickDailyAphorism() : null;
  if(!ap) return '';
  const koSafe = (ap.ko && ap.ko !== ap.han) ? `<div class="neijing-ko">${esc(ap.ko)}</div>` : '';
  return `
    <div class="neijing-card fade-in" role="region" aria-label="오늘의 황제내경 명언">
      <div class="neijing-label">오늘의 黃帝內經 · 每日一句</div>
      <div class="neijing-han han">${esc(ap.han)}</div>
      ${koSafe}
      <div class="neijing-src">${esc(ap.src)}</div>
    </div>`;
}

function renderHall(){
  // v3: 大廳 진입 시 ambient BGM 자동 재생 시도 (user-gesture 후·사용자 OFF 의도 없을 때만)
  try{ bgm.autoStartAmbient(); }catch(_){}
  const rk = getRank(S.qi);
  const nxt = getNextRank(S.qi);
  const prog = getRankProgress(S.qi);
  const cur = PHYSICIAN_BY_ID[S.character] || PHYSICIANS[0];

  let html = `
    <h2 class="view-title fade-in"><span class="han">譽</span>명예의 전당</h2>
    <div class="view-sub">9 等級 · 누적 氣 기준 자동 승급</div>

    <!-- v9.6: 황제내경 명언은 대청(renderHome)으로 이동 -->

    <!-- 캐릭터 + 등급 큰 카드 -->
    <div class="card imperial fade-in" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="flex-shrink:0;cursor:pointer" onclick="openCharacterPicker()" title="캐릭터 변경">${_charPhotoMedallion(cur, 96)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-family:var(--font-display);font-size:20px;color:var(--mo)">${esc(S.name)}</span>
            ${_factionChip(S.faction)}
          </div>
          <div style="font-size:13px;color:var(--gutong);margin-top:2px"><span class="han">${esc(cur.han)}</span> · ${esc(cur.ko)}</div>
          <div style="font-size:10.5px;color:var(--gutong);margin-top:1px">${esc(cur.work_han)}<br>${esc(cur.work_ko)}</div>
          <div style="font-size:10.5px;color:${esc(_curFaction().colorDim||'#666')};margin-top:3px;font-style:italic">
            ${esc(_curFaction().han)} 패시브 · ${esc(_curFaction().passive)}
          </div>
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
        <!-- v3: 내 전적 -->
        <div id="my-record" style="margin-top:6px;text-align:right;min-height:14px"></div>
      </div>
    </div>

    <!-- v5: 四象 영토 (territory) — 진영별 氣 점유율 -->
    <div class="card fade-in territory-card" id="territory-card">
      <div class="card-title">
        <span class="han">四象 領土</span>
        <span style="float:right;font-size:11px;color:var(--gutong);font-family:var(--font-body);font-weight:400">진영별 氣 점유율</span>
      </div>
      <div class="territory-bar" id="territory-bar">
        <div class="territory-seg empty" style="flex:1">
          <span class="t-han">─</span><span class="t-pct">불러오는 중…</span>
        </div>
      </div>
      <div class="territory-legend" id="territory-legend"></div>
      <div style="font-size:10.5px;color:var(--gutong);margin-top:8px;font-style:italic;line-height:1.5">
        東醫壽世保元 四象人 — 太陽·少陽·太陰·少陰 · 누적 氣 합산 기준
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
      <div class="card-title"><span class="han">戰績</span> 최근 5지선다 對決 (${S.battleHistory.length}/20)</div>
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

    <!-- v8.7 F5: 카드 對決 별도 전적 -->
    ${(S.cardBattleHistory && S.cardBattleHistory.length > 0) ? `
    <div class="card fade-in" style="margin-top:14px">
      <div class="card-title"><span class="han">匕</span> 최근 카드 對決 (${S.cardBattleHistory.length}/20)</div>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:11.5px">
        ${S.cardBattleHistory.slice(0, 10).map(h => {
          const winLossHan = h.draw ? '和' : (h.win?'勝':'敗');
          const reasonKo = h.by==='attack'?'전탕 一致':(h.by==='forfeit'?'부전승':(h.by==='inactivity'?'상대 잠수':(h.by==='turn_limit'?'무승부':h.by||'?')));
          return `
          <div style="display:flex;justify-content:space-between;padding:5px 6px;background:var(--mi-w);border-radius:4px">
            <span><span class="han">${winLossHan}</span> vs ${esc(h.opponentName||'?')} <span style="color:var(--gutong);font-size:10.5px">· ${esc(reasonKo)}</span></span>
            <span style="color:${(h.deltaQi||0)>=0?'var(--feicui)':'var(--zhusha)'}">${(h.deltaQi||0)>=0?'+':''}${h.deltaQi||0} 氣</span>
            <span style="color:var(--gutong)">${ago(h.ts||0)}</span>
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:6px;font-size:10.5px;color:var(--gutong);text-align:center">
        ${(() => {
          const ch = S.cardBattleHistory;
          const w = ch.filter(h=>h.win).length;
          const l = ch.filter(h=>!h.win && !h.draw).length;
          const d = ch.filter(h=>h.draw).length;
          const fft = ch.filter(h=>h.forfeit).length;
          return `${w}勝 ${l}敗 ${d}和 · forfeit ${fft}회`;
        })()}
      </div>
    </div>` : ''}
  `;
  view.innerHTML = html;
  // v3: 사용자별 전적 — 한 번 fetch해서 3곳(내 카드/사다리/글로벌)에 분배
  (async () => {
    const recs = (FB ? (await fetchAllRecords(true)) : null) || {};
    const myEl = document.getElementById('my-record');
    if(myEl){
      myEl.innerHTML = recordChip(recs[S.userId] || {w:0,l:0,d:0}, 'large');
    }
    loadGlobalRank(recs);
    loadLadderUsers(recs);
    loadTerritory();   // v5: 四象 영토 비동기 로드
  })();
}

// v5: 四象 영토 — presence 의 faction·qi 합산 → 점유율 바·범례 렌더
async function loadTerritory(){
  const barEl = document.getElementById('territory-bar');
  const lgEl  = document.getElementById('territory-legend');
  if(!barEl) return;

  // presence 데이터 수집 — Firebase 없으면 본인만으로라도 표시 (로컬 모드)
  let presence = null;
  if(FB){
    try{ presence = await FB.get('presence'); }catch(_){ presence = null; }
  }
  if(!presence){
    // 로컬 모드 fallback — 본인만 표시
    presence = { [S.userId]: {name: S.name, qi: S.qi, faction: S.faction} };
  } else {
    // 본인 데이터가 presence 에 아직 안 올라갔을 경우 (recordPresence 전) 강제 합산
    if(!presence[S.userId]){
      presence[S.userId] = {name: S.name, qi: S.qi, faction: S.faction};
    }
  }

  const agg = (typeof aggregateFactions === 'function')
    ? aggregateFactions(presence)
    : [];
  const grandTotal = agg.reduce((s,a) => s + a.totalQi, 0);

  // 바: 점유 0 인 진영도 최소폭 (4%) 확보해 한자 보이게
  if(grandTotal <= 0){
    // 全 진영 미참가 (사실상 발생 X) — 균등 분할
    barEl.innerHTML = FACTIONS.map(f => `
      <div class="territory-seg empty" style="flex:1">
        <span class="t-han">${esc(f.han2)}</span><span class="t-pct">0%</span>
      </div>
    `).join('');
  } else {
    // 표시는 원본 FACTIONS 순서 유지 (좌→우 일관성)
    const byId = Object.fromEntries(agg.map(a => [a.id, a]));
    barEl.innerHTML = FACTIONS.map(f => {
      const a = byId[f.id] || {totalQi:0, share:0, count:0};
      const sharePct = (a.share * 100);
      // flex-grow 는 점유 비율 + 최소 시각 보장 (zero-faction 도 4% 폭)
      const flex = Math.max(a.share, 0.04);
      const isEmpty = a.totalQi <= 0;
      return `<div class="territory-seg ${isEmpty?'empty':''}"
                   style="flex:${flex.toFixed(4)};${isEmpty?'':`background-color:${esc(f.color)}`}"
                   title="${esc(f.han)} · ${a.totalQi.toLocaleString()} 氣 (${sharePct.toFixed(1)}%) · ${a.count}명">
        <span class="t-han">${esc(f.han2)}</span>
        <span class="t-pct">${sharePct.toFixed(1)}%</span>
      </div>`;
    }).join('');
  }

  // 범례 — 진영별 총 氣·인원·1위 표시 (점유율 큰 순)
  if(lgEl){
    lgEl.innerHTML = agg.map(a => {
      const isMine = a.id === S.faction;
      const sharePct = (a.share * 100).toFixed(1);
      return `<div class="territory-legend-row ${isMine?'is-mine':''}">
        <span class="dot" style="background:${esc(a.color)}"></span>
        <span class="lg-han">${esc(a.han2)}</span>
        <span class="lg-meta">${a.totalQi.toLocaleString()} 氣 · ${a.count}명 · ${sharePct}%</span>
        ${isMine?'<span class="territory-mybadge">我</span>':''}
      </div>`;
    }).join('');
  }
}

// 등급 사다리 각 행에 해당 등급에 오른 사용자 표시 (v2.2) — v3: 전적 inline
async function loadLadderUsers(recs){
  if(!FB){
    $$('.ladder-users').forEach(el => { el.innerHTML = '<span class="ladder-user-empty">오프라인</span>'; });
    return;
  }
  const all = await FB.get('presence');
  const rs = recs || {};
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
      const rec = rs[p.uid];
      const recHtml = rec ? recordChip(rec, 'tiny') : '';
      return `<span class="ladder-user-chip ${isMe?'is-me':''}" data-uid="${esc(p.uid)}" title="${esc(p.name||'')} · ${(p.qi||0).toLocaleString()} 氣">
        ${med}<span class="nm">${esc(p.name||'익명')}${isMe?'(나)':''}${recHtml}</span>
      </span>`;
    }).join('') + (matched.length > 18 ? `<span class="ladder-user-empty" style="font-style:normal">+${matched.length-18}명</span>` : '');
  });
}

async function loadGlobalRank(recs){
  const el = $('#global-rank-list'); if(!el || !FB) return;
  const all = await FB.get('presence');
  if(!all){ el.innerHTML = '아직 학습자가 없습니다.'; return; }
  const rs = recs || {};
  const list = Object.entries(all)
    .map(([uid, p]) => ({uid, ...p}))
    .sort((a,b) => (b.qi||0) - (a.qi||0))
    .slice(0, 20);
  el.innerHTML = list.map((p, i) => {
    const r = getRank(p.qi||0);
    const med = _charMedallion(p.character || 'qibo', 26);
    const isMe = p.uid === S.userId;
    const rec = rs[p.uid];
    const recHtml = rec ? recordChip(rec, 'small') : '';
    return `<div class="global-rank-row" data-uid="${esc(p.uid)}" style="display:flex;align-items:center;gap:6px;padding:5px 6px;${isMe?'background:#FFF8E0;':''}border-radius:4px;text-align:left;flex-wrap:wrap">
      <span style="width:22px;text-align:center;font-family:var(--font-display);font-size:14px;color:${i<3?'var(--zhusha-d)':'var(--gutong)'}">${i+1}</span>
      ${med}
      <span style="flex:1;min-width:0;font-weight:600;color:var(--mo)">${esc(p.name||'익명')}${isMe?' (나)':''}</span>
      <span class="rec-slot" style="font-size:11px">${recHtml}</span>
      <span class="han" style="font-size:11px;color:${r.color}">${esc(r.han)}</span>
      <span class="seal" style="font-size:12px;color:var(--zhusha-d)">${(p.qi||0).toLocaleString()}</span>
    </div>`;
  }).join('');
}

// ───── 11. 멀티 對決 (氣博 베팅) ────────────────────────────────────────────
// 베팅 레벨 — v4: diffProfile = [D1, D2, D3, D4] 비율 (합=1.0)
//   小博 = 빈출/기초 (D1·D2 중심)    中博 = 응용 (D2 중심)
//   大博 = 심화 (D2·D3 중심)          賭命 = 지옥 (D3·D4 중심, 함정 선지)
const BET_LEVELS = [
  { id:'small',  han:'小博', ko:'소박', pct:0.05, min:20,  desc:'5% · 최소 20 氣',  diffProfile:[0.60, 0.30, 0.10, 0.00] },
  { id:'medium', han:'中博', ko:'중박', pct:0.15, min:50,  desc:'15% · 최소 50 氣', diffProfile:[0.20, 0.50, 0.25, 0.05] },
  { id:'large',  han:'大博', ko:'대박', pct:0.30, min:150, desc:'30% · 최소 150 氣',diffProfile:[0.05, 0.30, 0.45, 0.20] },
  { id:'allin',  han:'賭命', ko:'도명', pct:0.50, min:500, desc:'50% · 최소 500 氣',diffProfile:[0.00, 0.10, 0.40, 0.50] },
];
try{ window.BET_LEVELS = BET_LEVELS; }catch(_){}
function calcBet(level){
  const lv = BET_LEVELS.find(l => l.id === level) || BET_LEVELS[0];
  const pct = Math.floor(S.qi * lv.pct);
  return Math.max(lv.min, pct);
}

// 배틀 상태 (메모리)
let _battle = null;
// v7.2: 배틀 진행 중 (intro/play 단계, 결과 화면 진입 전) — 탭 이탈 가드용
//   true 면 setTab(외부 탭) 호출 시 confirm 모달 + forfeit 처리
//   startBattle / startCardBattle / 인트로 진입 시 → true
//   showResult / renderCardResult 진입 시 → false (결과 화면에서는 자유 이동)
let _inBattleSession = false;
let _battleSessionMeta = null;   // {mode:'quiz'|'card', roomId, oppId}
// v9.3: 매치 확인 화면 진입 중 — setTab 가드용. 강제로 對決開始 / 取消 만 가능.
let _inMatchConfirm = false;
let _matchConfirmMeta = null;    // {roomId, bet} — 가드 모달이나 비상 환불 시 참조
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
  // v7: 對決 방식 토글 (5지선다 vs 카드 對決)
  let battleMode = 'quiz';  // 'quiz' | 'card'
  // v9.6: 카드 對決에서 AI 상대 선택 (5지선다 은 AI 없음)
  let useCardAi = false;
  view.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">對決</span>멀티 배틀</h2>
    <div class="view-sub">같은 베팅 레벨끼리 자동 매칭 · 승자가 패자의 氣 획득</div>

    <!-- v7.1: Firebase 진단 (멀티 작동 안할 때 어디서 막혔는지 명시) -->
    <div class="card fade-in" id="multi-diag-card" style="padding:10px 12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-family:var(--font-display);font-size:13px;color:var(--zhusha-d)">서버 연결 진단</div>
        <button class="btn btn-sm btn-o" type="button" id="diag-rerun" style="font-size:11px;padding:2px 8px">재진단</button>
      </div>
      <div id="diag-result" style="font-size:11.5px;color:var(--mo)">진단 중…</div>
    </div>

    <!-- v7: 對決 방식 토글 -->
    <div class="card fade-in" style="padding:10px 12px">
      <div style="font-family:var(--font-display);font-size:13px;color:var(--zhusha-d);margin-bottom:6px">對決 방식</div>
      <div class="cb-mode-toggle" id="cb-mode-toggle">
        <button class="cb-mode-btn active" type="button" data-mode="quiz">
          <span class="han">問</span>
          <span style="font-family:var(--font-display);font-size:14px">5지선다</span>
          <span style="font-size:10.5px;color:var(--gutong);display:block">기출 + 자동생성 · 60초</span>
        </button>
        <button class="cb-mode-btn" type="button" data-mode="card">
          <span class="han">牌</span>
          <span style="font-family:var(--font-display);font-size:14px">카드 對決</span>
          <span style="font-size:10.5px;color:var(--gutong);display:block">證 추리 + 본초 조합 · 25% 베팅</span>
        </button>
      </div>
    </div>

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
            <div class="bet-diff-strip" title="이 레벨의 출제 난이도 분포 (D1·D2·D3·D4)">
              ${(o.diffProfile||[]).map((p, i) => p > 0 ? `<span class="bet-diff-seg d${i+1}" style="flex:${Math.max(p, 0.04)}" title="D${i+1} ${Math.round(p*100)}%">${Math.round(p*100)}</span>` : '').join('')}
            </div>
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
  // v7: 모드 토글 이벤트 — 카드 모드면 베팅 카드/규칙 카드 분리 표시
  const applyMode = () => {
    const isCard = battleMode === 'card';
    $$('.cb-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === battleMode));
    // 베팅 그리드 카드 숨기기 (카드 모드는 25% 자동)
    const betCard = $('#bet-grid')?.closest('.card');
    if(betCard) betCard.style.display = isCard ? 'none' : '';
    // 카드 모드 안내 카드
    let modeInfo = $('#cb-mode-info');
    if(isCard && !modeInfo){
      const ix = document.createElement('div');
      ix.id = 'cb-mode-info';
      ix.className = 'card fade-in';
      const bet = calcCardBet();
      ix.innerHTML = `
        <div class="card-title"><span class="han">牌</span>카드 對決 (25% 베팅)</div>
        <div style="font-size:12.5px;line-height:1.6">
          베팅 <b class="seal" style="color:var(--zhusha-d)">${bet.toLocaleString()} 氣 (현재 氣의 25%)</b><br>
          ① 양측이 무작위 3개 證 중 1개를 10초 안에 선택<br>
          ② 공유 1덱(본초 카드) + 보드 초기 3장 · 게임 시작 시 <b>각자 자기 증상 1개를 골라 공개</b> (30초)<br>
          ③ 매 턴: 神급 스킬(게임 1회) → 전탕 시도 or 턴 종료 · 턴 종료 시 덱에서 1장 보드로<br>
          ④ <b>덱 소진 후</b>엔 자기 턴마다 증상 1개를 골라 공개 (15초)<br>
          ⑤ <span style="color:var(--zhusha-d)"><b>전탕 빗나가면</b> 페널티로 자기 증상 1개 선택 공개</span><br>
          ⑥ 상대 證에 맞는 처방을 본초로 먼저 구성한 쪽이 승리
        </div>
        <!-- v9.6: AI 상대 선택 -->
        <div class="v96-ai-toggle" style="margin-top:10px">
          <span class="v96-ai-han">AI</span>
          <label>
            <input type="checkbox" id="cb-use-ai" ${useCardAi?'checked':''}>
            AI 의가와 對決 (멀티 매칭 없이 즉시 시작 · 베팅 없음 · 학습용)
          </label>
        </div>
      `;
      const ruleCard = view.querySelector('.card[style*="--mi"]');
      if(ruleCard) view.insertBefore(ix, ruleCard);
      else view.appendChild(ix);
      // AI 토글 이벤트
      const aiBox = document.getElementById('cb-use-ai');
      if(aiBox){
        aiBox.addEventListener('change', () => {
          useCardAi = aiBox.checked;
          // 入場 버튼 라벨 갱신
          const jb = $('#join-battle');
          if(jb){
            jb.innerHTML = useCardAi
              ? '<span class="han" style="margin-right:4px">對</span>AI 對決 시작'
              : '<span class="han" style="margin-right:4px">入</span>入場';
          }
        });
      }
    } else if(!isCard && modeInfo){
      modeInfo.remove();
      // 5지선다로 돌아오면 AI 옵션 자동 해제
      useCardAi = false;
      const jb = $('#join-battle');
      if(jb) jb.innerHTML = '<span class="han" style="margin-right:4px">入</span>入場';
    }
  };
  $$('#cb-mode-toggle .cb-mode-btn').forEach(b => {
    b.addEventListener('click', () => {
      battleMode = b.dataset.mode;
      applyMode();
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
    if(battleMode === 'card'){
      if(useCardAi && typeof window.V96CardAI !== 'undefined'){
        // v9.6: AI 對決 — 매칭 없이 즉시 진행
        window.V96CardAI.start();
      } else {
        joinCardBattleQueue();
      }
    } else {
      joinBattleQueue(selected);
    }
  });
  // v2.2.2: SSE 기반 실시간 동기화 + 둘러보는 중 등록
  startLobbyStreams();
  startLobbyIdle(selected);
  applyMode();

  // v7.1: 멀티 진단 자동 실행 (사용자가 매칭 안되는 원인을 화면에서 즉시 확인)
  runMultiDiag();
  $('#diag-rerun').addEventListener('click', runMultiDiag);
}
window.openBattleLobby = openBattleLobby;

// v7.1: Firebase 진단 — 11개 노드 × (read|write) 권한 점검 후 UI에 표시
async function runMultiDiag(){
  const el = $('#diag-result');
  if(!el) return;
  if(!FB){
    el.innerHTML = `<span style="color:var(--zhusha-d)">⚠ Firebase 설정 없음</span>`;
    return;
  }
  el.textContent = '진단 중…';
  let results;
  try{
    results = await FB.diag(S.userId || 'anon');
  }catch(e){
    el.innerHTML = `<span style="color:var(--zhusha-d)">진단 실패: ${esc(e.message||e)}</span>`;
    return;
  }
  // 결과 집계
  const fails = results.filter(r => !r.ok);
  const writeOk = (node) => results.find(r => r.node === node && r.op === 'write')?.ok;
  const allWriteNodes = ['lobby','battles','lobby_card','card_battles','presence','lobby_idle'];
  const missingWrites = allWriteNodes.filter(n => !writeOk(n));
  if(fails.length === 0){
    el.innerHTML = `<span style="color:#1a7a3a">✓ 전 노드 읽기·쓰기 OK — 다른 사용자가 동시에 같은 모드 큐에 있어야 매칭됩니다</span>`;
    return;
  }
  // 표 + 룰 안내
  const rows = results.map((r, i) => {
    const icon = r.ok ? '<span style="color:#1a7a3a">✓</span>' : '<span style="color:var(--zhusha-d)">✗</span>';
    const bodyLine = (!r.ok && r.body)
      ? `<details style="grid-column:1/-1;margin:2px 0 4px 22px"><summary style="font-size:10.5px;color:var(--zhusha-d);cursor:pointer">Firebase 응답 본문</summary><pre style="font-size:10px;background:#fff;padding:4px 6px;border:1px solid var(--gutong);border-radius:2px;margin:3px 0 0;white-space:pre-wrap;word-break:break-all">${esc(r.body.slice(0,300))}</pre><div style="font-size:10px;color:var(--gutong);margin-top:2px;word-break:break-all">URL: ${esc(r.url||'')}</div></details>`
      : '';
    return `<div style="display:grid;grid-template-columns:18px 1fr 50px 1fr;gap:4px;align-items:center;padding:1px 0">
      ${icon}
      <span style="font-family:var(--font-display)">${esc(r.node)}</span>
      <span style="color:var(--gutong);font-size:10.5px">${r.op}</span>
      <span style="color:${r.ok?'#1a7a3a':'var(--zhusha-d)'};font-size:10.5px">${esc(r.msg)}</span>
    </div>${bodyLine}`;
  }).join('');
  // Firebase 룰 JSON (모든 노드 포함)
  const ruleJson = `{
  "rules": {
    "presence":     { ".read": true, ".write": true },
    "feedback":     { ".read": true, ".write": true },
    "lobby":        { ".read": true, ".write": true },
    "lobby_idle":   { ".read": true, ".write": true },
    "battles":      { ".read": true, ".write": true },
    "lobby_card":   { ".read": true, ".write": true },
    "card_battles": { ".read": true, ".write": true },
    "stats":        { ".read": true, ".write": true }
  }
}`;
  // v8.1: 모든 노드 실패 = "게시 안 됨" 패턴 식별
  const allWritesFail = allWriteNodes.every(n => !writeOk(n));
  const allReadsFail  = allWriteNodes.every(n => {
    const r = results.find(x => x.node === n && x.op === 'read');
    return r && !r.ok;
  });
  const totalFailPattern = allWritesFail && allReadsFail;
  el.innerHTML = `
    <div style="margin-bottom:6px;color:var(--zhusha-d);font-weight:600">⚠ ${fails.length}개 항목 실패 — 멀티가 작동하지 않는 원인입니다</div>
    ${totalFailPattern ? `
      <div style="margin:6px 0 10px;padding:8px 10px;background:#FFF8E0;border-left:3px solid var(--zhusha-d);font-size:12px;line-height:1.55">
        <b style="color:var(--zhusha-d)">전 노드 거부 패턴</b> — 룰이 실제로 게시되지 않았을 가능성이 가장 높습니다. Console 룰 페이지에 들어가 "게시" 버튼이 <b>회색(비활성)</b>인지 확인하세요. 파란색이면 미게시 변경사항이 남아있다는 뜻입니다. 또한 Console 의 RTDB URL 호스트가 아래 진단 URL 과 정확히 같은지 비교 (region 다른 인스턴스 가능성).
      </div>` : ''}
    <div style="background:var(--mi);padding:6px 8px;border-radius:3px;font-size:11px;font-family:ui-monospace,monospace">${rows}</div>
    ${missingWrites.length ? `
      <div style="margin-top:8px;padding:6px 8px;background:#FFF8E0;border:1px dashed var(--zhusha-d);border-radius:3px">
        <div style="font-size:11.5px;color:var(--mo);margin-bottom:4px">
          <b>Firebase Console → Realtime Database → 규칙</b>에 아래 JSON 붙여넣고 <b>게시</b>:
        </div>
        <pre style="font-size:10.5px;background:#fff;padding:6px;border:1px solid var(--gutong);border-radius:2px;overflow-x:auto;white-space:pre;margin:0">${esc(ruleJson)}</pre>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm btn-gold" type="button" onclick="(()=>{navigator.clipboard.writeText(${JSON.stringify(ruleJson)}).then(()=>toast('룰 JSON 복사됨','gold'),()=>toast('복사 실패','red'))})()" style="font-size:11px;padding:3px 10px">룰 복사</button>
          <a class="btn btn-sm btn-o" href="https://console.firebase.google.com/project/hanimaster-245f6/database/hanimaster-245f6-default-rtdb/rules" target="_blank" rel="noopener" style="font-size:11px;padding:3px 10px;text-decoration:none">Console 열기 ↗</a>
        </div>
      </div>` : ''}
  `;
}
window.runMultiDiag = runMultiDiag;

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

// 매칭 큐 — v9.0 자율 매치 (paideia 패턴)
//   • /lobby/{level} 폴링으로 큐 동기화
//   • 선임자 (ts 최소) 만 매치 publish → race-free
//   • 다른 사용자는 /battles 폴링으로 자기 player 인 fresh room 발견 시 자동 입장
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
      <div style="font-size:11.5px;color:var(--gutong);margin-top:2px;min-height:14px" id="queue-count"></div>
      <div style="font-size:11px;color:var(--gutong);margin-top:4px" id="queue-timer"></div>
      <div style="margin-top:18px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-o btn-sm" id="leave-queue">취소 (환불)</button>
        <button class="btn btn-o btn-sm" id="rereg-queue">큐 재등록</button>
      </div>
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

  // v8.4: 자기 stale entry 강제 정리 (이전 세션 잔재 제거)
  try{ await FB.del(`lobby/${level}/${S.userId}`); }catch(_){}
  await new Promise(r => setTimeout(r, 150));

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
  // v8.4: 수동 재등록 (stale 상태로 stuck 됐을 때)
  $('#rereg-queue').addEventListener('click', async () => {
    try{
      $('#queue-status').textContent = '큐 재등록 중…';
      await FB.del(`lobby/${level}/${S.userId}`);
      await new Promise(r => setTimeout(r, 200));
      const rok = await FB.putRetry(`lobby/${level}/${S.userId}`, {...myEntry, ts: Date.now()}, {tries:3, backoffMs:400});
      if(rok && rok.ok){ $('#queue-status').textContent = '재등록 완료 — 상대 찾는 중'; }
      else { $('#queue-status').textContent = `재등록 실패 (HTTP ${rok && rok.status||'?'})`; }
    }catch(e){ $('#queue-status').textContent = '재등록 오류: ' + e.message; }
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
  // v9.0 자율 매치 (paideia 패턴) — 호스트/입장자 분리 제거
  // ──────────────────────────────────────────────────────────────────────
  //   기존: 사전 순 작은 userId 가 방 생성자, 큰 userId 는 onBattlesSnap 으로 입장
  //         → 한쪽이 방을 못 보는 race 다수 발생
  //   v9.0: 모두가 동등하게 lobby/{level}/{uid} 자기 키만 PUT
  //         가장 오래 기다린 사람 (선임자 = ts 최소) 이 매치 publish
  //         양측이 동일한 polling 으로 battles/{roomId} 발견 → 자동 합류
  //         "방 생성자"/"입장자" 분리 없음 → 한쪽 못 들어가는 race 자체 사라짐
  const STALE_ROOM_MS = 5 * 60 * 1000;

  // /battles 폴링 — 누구나 자기가 player 인 fresh room 발견 시 진입
  //   v9.3: status 별 분기 ─
  //     'matched'  → renderMatchConfirmation (對決開始 버튼 화면)
  //     'starting' → startBattle (인트로 + 게임)
  //     'done'/'cancelled' → 무시
  const onBattlesSnap = (battles) => {
    if(!active || matching) return;
    if(!battles) return;
    const now = Date.now();
    const myRoom = Object.values(battles).find(r =>
      r && r.players && r.players[S.userId]
      && r.status !== 'done' && r.status !== 'cancelled'
      && (now - (r.createdAt||0)) < STALE_ROOM_MS
    );
    if(myRoom){
      matching = true;
      const status = $('#queue-status'); if(status) status.textContent = '매치 발견 — 입장…';
      (async () => {
        await cleanup(false);
        if(myRoom.status === 'starting'){
          startBattle(myRoom.roomId, false);
        } else {
          // 'matched' (또는 status 없음 — 구버전 잔재) → 매치 확인 화면
          renderMatchConfirmation(myRoom.roomId, false);
        }
      })();
    }
  };
  _battlesStream = FB.subscribe('battles', onBattlesSnap);

  // 입장 직후 자기의 stale 방 정리
  (async () => {
    try{
      const allBattles = await FB.get('battles');
      if(allBattles){
        const now2 = Date.now();
        for(const [rid, r] of Object.entries(allBattles)){
          if(r && r.players && r.players[S.userId] && r.status !== 'done'
             && (now2 - (r.createdAt||0)) >= STALE_ROOM_MS){
            try{ await FB.put(`battles/${rid}/status`, 'done'); }catch(_){}
          }
        }
      }
    }catch(_){}
  })();

  // /lobby/{level} 폴링 — 선임자만 매치 publish (자율 매치 · v9.3)
  //
  // v9.3 변경 (멀티 race 잔재 제거):
  //   기존 v9.0~v9.2: senior = sortedFresh[0]  (ts 기준 최소)
  //     문제 — ts 는 keep-alive (15s) 로 RTDB 에서 끊임없이 변동.
  //            두 클라이언트의 polling 시점이 어긋나면 서로 다른 senior 를
  //            보게 되어 양쪽이 동시에 매치 publish → 다른 roomId 두 개 생성
  //            → 한쪽이 다른 방에서 상대 없는 채 대기.
  //   v9.3: senior = userId 사전순 최소.
  //     - userId 는 영구 불변 (한 번 발급 후 변동 X).
  //     - 두 클라이언트가 같은 큐 스냅샷을 어떤 시점에 보아도 동일한 senior 결정.
  //     - roomId 도 양측 userId 의 결정론적 함수 (sortedUids.join('_'))
  //       로 만들어 만에 하나 양측이 동시 publish 해도 같은 키에 멱등 PUT.
  //
  // 추가 변경 — status 'starting' → 'matched':
  //   v9.3 부터는 publish 후 곧장 인트로로 가지 않고, 매치 확인 화면을 거침.
  //   양측 누구든 "對決開始" 버튼을 누르면 status='starting' 으로 전이.
  //   양측 onBattlesSnap 폴링이 starting 을 감지하면 그때 인트로 진입.
  const onLobbySnap = async (all) => {
    if(!active || matching) return;
    const now = Date.now();
    const fresh = all ? Object.values(all).filter(p => p && (now - (p.ts||0)) < LOBBY_FRESH_MS) : [];
    // userId 사전 순 정렬 (결정론적 tiebreaker)
    const sortedFresh = fresh.slice().sort((a,b) => {
      const au = String(a.userId||''), bu = String(b.userId||'');
      return au < bu ? -1 : au > bu ? 1 : 0;
    });
    const others = sortedFresh.filter(p => p.userId !== S.userId);
    const cntEl = $('#queue-count');
    if(cntEl) cntEl.textContent = `현재 큐 (${esc(lvlInfo.han)}): ${fresh.length}명 · 대기 ${others.length}명`;
    if(others.length === 0){
      const status = $('#queue-status'); if(status) status.textContent = '대기 중…';
      return;
    }

    // 자율 매치 결정 룰: userId 사전순 최소 = senior. senior 만 publish.
    const senior = sortedFresh[0];
    if(senior.userId !== S.userId){
      // 자기가 senior 아님 — 대기. onBattlesSnap 이 status='matched' 방을 잡아줌.
      const status = $('#queue-status');
      if(status) status.textContent = `상대 발견 (${esc(others[0].name||'')}) — 매치 대기…`;
      return;
    }

    // 자기가 senior — 매치 publish (재진입 가드)
    matching = true;
    const status = $('#queue-status');
    if(status) status.textContent = `상대 발견 (${esc(others[0].name||'')}) — 매치 시작…`;
    const opp = others[0];

    // 결정론적 roomId — 양 userId 의 사전순 결합 + level + 1분 단위 시간 슬롯.
    //   같은 두 사람이 동시 publish 해도 같은 roomId 에 멱등 PUT.
    //   1분 슬롯은 이전 세션 잔재 (재매칭 시) 와 충돌 방지.
    const slot = Math.floor(Date.now() / 60000);
    const uids = [S.userId, opp.userId].sort();
    const roomId = `r_${uids[0]}_${uids[1]}_${slot}`.replace(/[^a-zA-Z0-9_]/g,'_').slice(0,80);

    const room = {
      roomId, level, bet, status: 'matched',   // v9.3: 'starting' → 'matched'
      players: {
        [S.userId]:  { userId:S.userId,  name:S.name,  character:S.character,  score:0, qi:S.qi+bet, bet, done:false },
        [opp.userId]:{ userId:opp.userId,name:opp.name,character:opp.character,score:0, qi:opp.qi,    bet, done:false },
      },
      questions: generateBattleQuestions(5, level),
      createdAt: Date.now(),
      startedBy: null,   // v9.3: 對決開始 누른 사용자 id
      cancelledBy: null  // v9.3: 取消 누른 사용자 id
    };
    // v9.2 픽스 유지: publish 는 백그라운드 promise. publish 가 늦어도 호스트는 즉시 매치 확인 화면으로.
    //   startBattle 의 FB.get 재시도 + polling 이 publish 완료를 자동 감지.
    FB.putRetry(`battles/${roomId}`, room, {tries:3, backoffMs:400, timeoutMs:5000})
      .then(res => {
        if(!res || !res.ok){
          console.warn('[battles publish] background fail:', res);
          try{ _lastSubError = {path:`battles/${roomId}`, err:'publish fail status='+(res&&res.status), at:Date.now()}; }catch(_){}
        }
      })
      .catch(e => { console.warn('[battles publish] exception:', e); });
    // 자기 큐 entry 만 정리
    try{ await FB.del(`lobby/${level}/${S.userId}`); }catch(_){}
    await cleanup(false);
    // v9.3: 곧장 startBattle 이 아니라 매치 확인 화면 진입
    renderMatchConfirmation(roomId, true);
  };
  _lobbyQueueStream = FB.subscribe(`lobby/${level}`, onLobbySnap);
}

// 배틀 문제 생성 (기출/자동) — 데이터가 있으면 사용, 없으면 placeholder


// v9.3 신규: 매치 확인 화면.
//   매칭 직후 양측이 이 화면에서 대기. 누구든 「對決開始」 누르면
//   battles/{roomId}/status 를 'starting' 으로 패치 → 양측 polling 이
//   변화 감지 → 인트로 진입. 「取消」 시 'cancelled' + 양측 환불.
//   30초 미응답 시 자동 취소 (양측 환불).
//
//   설계 원칙 — 데드락 없음:
//     - 누구든 시작 가능 (호스트/입장자 비대칭 없음)
//     - 멱등성: 양측 동시에 「對決開start」 눌러도 RTDB 가 같은 status='starting'
//       으로 멱등 PUT. startBattle 도 양측 polling 이 같은 starting 감지.
//     - 매치 확인 화면에서 한쪽이 페이지 닫으면 30초 timeout 으로 자동 환불.
//       (active page 가 1명이라도 있으면 그 사람이 「取消」 또는 「對決開始」 로 전이 가능)
const MATCH_CONFIRM_TIMEOUT_MS = 30 * 1000;
const MATCH_CONFIRM_POLL_MS    = 1500;  // 자체 status polling 주기 (subscribe 와 별개)

async function renderMatchConfirmation(roomId, isCreator){
  // 1) room fetch (publish 가 fire-and-forget 이므로 약간의 retry)
  let room = null;
  for(let i=0; i<4; i++){
    try{ room = await FB.get(`battles/${roomId}`); }catch(_){ room = null; }
    if(room && room.players) break;
    await new Promise(r => setTimeout(r, 300 * (i+1)));
  }
  if(!room || !room.players){
    toast('방을 찾을 수 없음','red');
    // 환불 — bet 정보가 없으니 직접 복구 불가. 사용자에게 매칭 재시도 권유.
    setTab('hall');
    return;
  }

  const me  = room.players[S.userId];
  const oppId = Object.keys(room.players).find(k => k !== S.userId);
  const opp = oppId ? room.players[oppId] : null;
  if(!me || !opp){
    toast('상대 정보 없음','red');
    setTab('hall');
    return;
  }

  // v9.3: 탭 이동 강제 차단. 사용자는 對決開始 또는 取消 둘 중 하나만 가능.
  _inMatchConfirm = true;
  _matchConfirmMeta = { roomId, bet: room.bet||0 };

  const meChar  = (typeof PHYSICIAN_BY_ID !== 'undefined' && PHYSICIAN_BY_ID[me.character])  || (typeof PHYSICIANS !== 'undefined' ? PHYSICIANS[0] : {han:'?', ko:'?'});
  const oppChar = (typeof PHYSICIAN_BY_ID !== 'undefined' && PHYSICIAN_BY_ID[opp.character]) || (typeof PHYSICIANS !== 'undefined' ? PHYSICIANS[0] : {han:'?', ko:'?'});
  const lvlInfo = (typeof BET_LEVELS !== 'undefined') ? BET_LEVELS.find(l => l.id === room.level) : null;

  view.innerHTML = `
    <div class="match-confirm fade-in">
      <h2 class="view-title"><span class="han">遇</span>對手出現</h2>
      <div class="view-sub">${esc(lvlInfo && lvlInfo.han || room.level)} · ${(room.bet||0).toLocaleString()} 氣 (에스크로)</div>

      <div class="match-confirm-banner">매치 성공</div>
      <div class="match-confirm-meta">아래 「對決開始」 버튼을 눌러 시작하세요</div>

      <div class="match-confirm-vs">
        <div class="match-confirm-side is-me">
          ${_charPhotoMedallion(meChar, 110)}
          <div class="name">${esc(me.name||'')}</div>
          <div class="charname han">${esc(meChar.han||'')}</div>
        </div>
        <div class="match-confirm-vs-han han">對</div>
        <div class="match-confirm-side is-opp">
          ${_charPhotoMedallion(oppChar, 110)}
          <div class="name">${esc(opp.name||'')}</div>
          <div class="charname han">${esc(oppChar.han||'')}</div>
        </div>
      </div>

      <div class="match-confirm-actions">
        <button class="btn btn-gold" id="match-start" type="button">對決開始</button>
        <button class="btn btn-o"    id="match-cancel" type="button">取消 (환불)</button>
      </div>

      <div class="match-confirm-status is-waiting" id="match-status">상대를 기다리는 중… (누구든 먼저 누르면 시작)</div>
      <div class="match-confirm-timer" id="match-timer"></div>
    </div>
  `;

  // 2) 상태 전이 감시 — battles/{roomId} 자체를 polling
  let watcherClosed = false;
  let cleanedUp = false;
  const startedAt = Date.now();

  const cleanup = () => {
    if(cleanedUp) return;
    cleanedUp = true;
    watcherClosed = true;
    _inMatchConfirm = false;
    _matchConfirmMeta = null;
    try{ statusStream && statusStream.close && statusStream.close(); }catch(_){}
    clearInterval(timerTick);
  };

  // 3) 「對決開始」 — status='starting' 패치 + startedBy 기록
  $('#match-start').addEventListener('click', async () => {
    const btn = $('#match-start');
    if(btn){ btn.disabled = true; btn.textContent = '시작 중…'; }
    const statEl = $('#match-status');
    if(statEl){ statEl.className = 'match-confirm-status'; statEl.textContent = '시작 신호 송신 중…'; }
    // 멱등 PUT — 만약 상대가 동시 클릭으로 이미 starting 으로 갔어도 안전.
    const r = await FB.putRetry(`battles/${roomId}/status`, 'starting', {tries:3, backoffMs:300, timeoutMs:4000});
    if(r && r.ok){
      // startedBy 도 기록 (감사 + 디버깅용)
      try{ FB.put(`battles/${roomId}/startedBy`, S.userId); }catch(_){}
      // 자기는 즉시 인트로 진입. 상대는 polling 으로 따라옴.
      cleanup();
      startBattle(roomId, isCreator);
    } else {
      if(btn){ btn.disabled = false; btn.textContent = '對決開始'; }
      if(statEl){ statEl.className = 'match-confirm-status'; statEl.style.color = 'var(--zhusha)'; statEl.textContent = `송신 실패 (HTTP ${r&&r.status||'?'}) — 다시 시도하세요`; }
    }
  });

  // 4) 「取消」 — status='cancelled' 패치 + 자기 환불
  $('#match-cancel').addEventListener('click', async () => {
    const btn = $('#match-cancel');
    if(btn){ btn.disabled = true; btn.textContent = '취소 중…'; }
    try{ await FB.putRetry(`battles/${roomId}/status`, 'cancelled', {tries:2, backoffMs:300, timeoutMs:3000}); }catch(_){}
    try{ FB.put(`battles/${roomId}/cancelledBy`, S.userId); }catch(_){}
    cleanup();
    // 환불
    S.qi += (room.bet||0);
    saveState(); refreshHeader();
    toast(`매치 취소 — ${room.bet} 氣 환불`,'gold');
    setTab('hall');
  });

  // 5) 30초 timeout + 시계
  const timerTick = setInterval(async () => {
    if(cleanedUp) return;
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remain = Math.max(0, Math.ceil(MATCH_CONFIRM_TIMEOUT_MS/1000) - elapsed);
    const el = $('#match-timer');
    if(el) el.textContent = `경과 ${elapsed}초 · ${remain}초 후 자동 취소 (환불)`;
    if(elapsed * 1000 >= MATCH_CONFIRM_TIMEOUT_MS){
      // 자동 취소
      try{ await FB.putRetry(`battles/${roomId}/status`, 'cancelled', {tries:2, backoffMs:300, timeoutMs:3000}); }catch(_){}
      cleanup();
      S.qi += (room.bet||0);
      saveState(); refreshHeader();
      toast(`30초 동안 시작 안 됨 — ${room.bet} 氣 환불`,'gold');
      setTab('hall');
    }
  }, 1000);

  // 6) status 변화 감시 — 상대가 「對決開始」 또는 「取消」 누르면 polling 이 잡아냄
  const onStatusSnap = (r) => {
    if(watcherClosed) return;
    if(!r) return;
    if(r.status === 'starting'){
      // 상대가 먼저 시작 누름 — 잠깐 안내 후 인트로 진입
      const statEl = $('#match-status');
      const btn1 = $('#match-start');
      const btn2 = $('#match-cancel');
      if(statEl){
        statEl.className = 'match-confirm-status is-other-started';
        statEl.textContent = '상대가 對決開始을 눌렀습니다 — 곧 시작…';
      }
      if(btn1) btn1.disabled = true;
      if(btn2) btn2.disabled = true;
      // 0.6초 후 인트로
      setTimeout(() => {
        cleanup();
        startBattle(roomId, isCreator);
      }, 600);
    } else if(r.status === 'cancelled'){
      // 상대 (또는 timeout) 취소 — 환불
      cleanup();
      S.qi += (room.bet||0);
      saveState(); refreshHeader();
      toast(`상대가 취소 — ${room.bet} 氣 환불`,'gold');
      setTab('hall');
    }
  };
  const statusStream = FB.subscribe(`battles/${roomId}`, onStatusSnap, {pollMs: MATCH_CONFIRM_POLL_MS});
}

async function startBattle(roomId, isCreator){
  // v9.2: FB.get 4회 재시도 (350·700·1050·1400 ms 백오프, 총 3.5초). publish 가 fire-and-forget 이므로
  //       그 완료를 위해 충분한 retry window. polling subscribe 가 추가 안전망.
  let room = null;
  for(let i=0; i<4; i++){
    try{ room = await FB.get(`battles/${roomId}`); }catch(_){ room = null; }
    if(room) break;
    await new Promise(r => setTimeout(r, 350 * (i+1)));
  }
  if(!room){ toast('방을 찾을 수 없음','red'); setTab('hall'); return; }
  _battle = { roomId, isCreator, room };
  // v7.2: 배틀 진행 중 플래그 ON — 탭 이탈 가드 활성
  const oppId = Object.keys(room.players||{}).find(k => k !== S.userId) || null;
  _inBattleSession = true;
  _battleSessionMeta = { mode:'quiz', roomId, oppId };
  // v9.7: 멀티 모드 — 시그니처 효과·점수 OFF
  try{ if(window.V97Sig) window.V97Sig.setMode('multi'); }catch(_){}
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
        <!-- v3: 전적 칩 -->
        <div class="intro-record" data-uid="${esc(oppId)}" style="margin-top:4px;min-height:16px"></div>
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
        <!-- v3: 전적 칩 -->
        <div class="intro-record" data-uid="${esc(S.userId)}" style="margin-top:4px;min-height:16px"></div>
        <div class="intro-charname"><span class="han">${esc(meChar.han)}</span> · ${esc(meChar.work_han)}</div>
        <div style="font-size:11px;color:var(--zhusha-d);font-weight:600;letter-spacing:.08em;margin-top:6px">▲ 나</div>
      </div>

      <div style="text-align:center;margin-top:16px">
        <button class="btn btn-gold" id="intro-skip" type="button">바로 시작 →</button>
      </div>
    </div>
  `;
  // v3: 양측 전적 비동기 로드 (인트로 차단 X — 5초 안에 도착하면 표시, 못 오면 빈칸)
  if(FB){
    Promise.all([fetchUserRecord(S.userId), fetchUserRecord(oppId)]).then(([mr, or]) => {
      const meEl = view.querySelector(`.intro-record[data-uid="${CSS.escape(S.userId)}"]`);
      const opEl = view.querySelector(`.intro-record[data-uid="${CSS.escape(oppId)}"]`);
      if(meEl) meEl.innerHTML = recordChip(mr, 'large');
      if(opEl) opEl.innerHTML = recordChip(or, 'large');
    }).catch(_=>{});
  }
  // v4: 양측 동시 한문 낭독 (zh-CN TTS). 이순재는 무음 — 그러면 인트로 단축.
  const meSilent = (meChar.id === 'leesoonjae');
  const oppSilent = (oppChar.id === 'leesoonjae');
  const bothSilent = meSilent && oppSilent;
  // 시각적 동시 펄스 클래스 부여 — 발화 동안 말풍선 강조
  const bubbles = view.querySelectorAll('.intro-bubble');
  bubbles.forEach(b => b.classList.add('intro-speaking'));
  setTimeout(() => bubbles.forEach(b => b.classList.remove('intro-speaking')), 4500);
  // TTS 발화 (300ms 후 — 인트로 fade-in 끝난 뒤)
  if(!bothSilent && tts.supported){
    setTimeout(() => {
      tts.speakIntroPair(meChar.id, meQ.han, oppChar.id, oppQ.han);
    }, 300);
  }
  let advanced = false;
  const advance = () => {
    if(advanced) return; advanced = true;
    clearTimeout(tm);
    tts.cancel();  // v4: skip 또는 자동 진행 시 TTS 즉시 정지
    onContinue();
  };
  $('#intro-skip').addEventListener('click', advance);
  // 양측 다 무음이면 5초로 단축 (낭독 대기 불필요)
  const introMs = bothSilent ? BATTLE_INTRO_FORFEIT_MS : BATTLE_INTRO_MS;
  const tm = setTimeout(advance, introMs);
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
        // v3: 선지 효과음
        try{ correct ? bgm.sfxCorrect() : bgm.sfxWrong(); }catch(_){}
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
      <div style="margin-top:12px;color:var(--mo-l);font-size:12px" id="judging-status">상대 결과 대기…</div>
      <div style="margin-top:4px;color:var(--gutong);font-size:10.5px" id="judging-sub"></div></div>
    `;
    // 내 점수 기록 — v3: putRetry로 네트워크 jitter에 견딤 (FB.putRetry 없으면 put fallback)
    const putReliable = (path, val) => {
      if(FB && typeof FB.putRetry === 'function') return FB.putRetry(path, val);
      return FB.put(path, val);
    };
    try{
      await putReliable(`battles/${roomId}/players/${S.userId}/score`, myScore);
      await putReliable(`battles/${roomId}/players/${S.userId}/done`, true);
    }catch(e){
      // 업로드 자체 실패 — 로컬 정산만으로 진행 (방 미존재 처리)
      toast('점수 기록 실패 — 로컬 환불 처리', 'red');
      S.qi += room.bet;
      saveState(); refreshHeader();
      bgm.stopBattle();
      setTab('hall');
      return;
    }
    // v8.6: 결과 대기 단축 + SSE 즉시 감지 — "무한 상대 결과 대기" 픽스
    //   기존 v8.5: 1500ms × 50회 = 75초 폴링만. 양측 done 감지가 평균 0.75초 지연.
    //   v8.6: SSE 구독으로 done 변화 즉시 감지 (지연 0) + 폴링 800ms × 31회 = ~25초 백오프 (forfeit 임계 단축)
    //         양측 정상 종료 시 SSE 가 거의 즉시 결과 화면 전이.
    const POLL_MS = 800;
    const MAX_TRIES = 31;             // 800ms × 31 ≈ 25초 (75초 → 25초)
    const DISCONNECT_FAILS = 3;
    const FORFEIT_AFTER_FAIL_MS = 5000;
    let tries = 0;
    let consecutiveFails = 0;
    let firstFailTs = 0;
    let _resultShown = false;
    let _resultStream = null;

    // v8.6: SSE 구독 — 양측 done 즉시 감지 (폴링 대기 없음)
    const tryFinish = (r, forfeit) => {
      if(_resultShown) return;
      _resultShown = true;
      try{ if(_resultStream){ _resultStream.close(); _resultStream = null; } }catch(_){}
      showResult(r, forfeit);
    };
    if(FB && typeof FB.subscribe === 'function'){
      _resultStream = FB.subscribe(`battles/${roomId}`, (r) => {
        if(_resultShown) return;
        if(!r){
          // 방 사라짐 → 환불 (에스크로 복구)
          _resultShown = true;
          try{ if(_resultStream){ _resultStream.close(); _resultStream = null; } }catch(_){}
          S.qi += room.bet; saveState(); refreshHeader();
          bgm.stopBattle();
          toast('방이 사라졌습니다 — 베팅 환불','gold');
          setTab('hall');
          return;
        }
        const players = r.players || {};
        const allDone = Object.keys(players).length >= 2
                     && Object.values(players).every(p => p && p.done);
        if(allDone) tryFinish(r, false);
      });
    }

    async function pollEnd(){
      if(_resultShown) return;  // v8.6: SSE 가 먼저 처리하면 polling 종료
      tries++;
      let r = null;
      try{
        r = await FB.get(`battles/${roomId}`);
        consecutiveFails = 0;
        firstFailTs = 0;
      }catch(e){
        consecutiveFails++;
        if(firstFailTs === 0) firstFailTs = Date.now();
        if(consecutiveFails >= DISCONNECT_FAILS && Date.now() - firstFailTs >= FORFEIT_AFTER_FAIL_MS){
          // 네트워크 부재 → 로컬 환불 (안전한 fallback, 패배 처리 안 함)
          _resultShown = true;
          try{ if(_resultStream){ _resultStream.close(); _resultStream = null; } }catch(_){}
          S.qi += room.bet;
          saveState(); refreshHeader();
          bgm.stopBattle();
          toast('연결 끊김 — 베팅 환불', 'gold');
          setTab('hall');
          return;
        }
        // 일시적 실패는 폴링 계속
        setTimeout(pollEnd, POLL_MS);
        return;
      }
      if(!r){
        // 방이 사라짐 → 환불 (에스크로 복구)
        _resultShown = true;
        try{ if(_resultStream){ _resultStream.close(); _resultStream = null; } }catch(_){}
        S.qi += room.bet;
        saveState(); refreshHeader();
        bgm.stopBattle();
        toast('방이 사라졌습니다 — 베팅 환불','gold');
        setTab('hall');
        return;
      }
      const players = r.players || {};
      const allDone = Object.keys(players).length >= 2
                   && Object.values(players).every(p => p && p.done);
      if(allDone){
        tryFinish(r, false);
        return;
      }
      if(tries > MAX_TRIES){
        // v8.6: 25초 경과 — 상대 응답 없음 → 부전승 (75초 → 25초로 단축)
        tryFinish(r, true);
        return;
      }
      const elapsed = tries * POLL_MS / 1000;
      const total = MAX_TRIES * POLL_MS / 1000;
      const st = $('#judging-status');
      const sub = $('#judging-sub');
      if(st) st.textContent = `상대 결과 대기… (${elapsed.toFixed(1)}/${total.toFixed(0)}초)`;
      if(sub) sub.textContent = `${(total - elapsed).toFixed(0)}초 후 자동 부전승 처리`;
      setTimeout(pollEnd, POLL_MS);
    }
    pollEnd();
  }

  async function showResult(room, forfeit){
    // v7.2: 결과 화면 진입 — 탭 이탈 가드 해제
    _inBattleSession = false;
    _battleSessionMeta = null;
    // v9.7: 솔로 모드 복원 (시그니처 효과 재가동)
    try{ if(window.V97Sig) window.V97Sig.setMode('solo'); }catch(_){}
    bgm.stopBattle();  // 戰鬪 BGM 종료 후 → 승/패 BGM 전환
    const players = room.players;
    const me = players[S.userId];
    const oppId = Object.keys(players).find(k => k !== S.userId);
    const opp = players[oppId];
    const bet = room.bet;
    let outcome = 'draw';
    let deltaQi = 0;          // 사용자 노출용: 진입 전 대비 변화
    let qiAdjust = 0;          // 에스크로 후 추가 조정량
    let factionBonus = 0;     // v5: 진영 패시브 보너스 (별도 추적·UI 노출)

    // v8.6 critical 픽스: 양측 모두 timeout 시 양쪽 화면이 각자 상대를 forfeit 으로 보고
    //                     양쪽 다 win 처리 → 氣 부풀림. 정산 무결성 유지를 위해
    //                     done 플래그를 양측 다 검사 + 미완료 시 score 비교.
    if(forfeit){
      const meDone  = !!me.done;
      const oppDone = !!(opp && opp.done);
      if(meDone && !oppDone){
        // 정상 forfeit — 나만 완료, 상대 미응답
        outcome = 'win';  deltaQi = bet;  qiAdjust = bet * 2;
      } else if(!meDone && oppDone){
        // 상대만 완료 — 내가 forfeit 한 셈
        outcome = 'lose'; deltaQi = -bet; qiAdjust = 0;
      } else if(!meDone && !oppDone){
        // ★ 양측 모두 미완료 — score 부분 진행도 비교 (사용자 신고 픽스)
        if(me.score > (opp.score||0)){       outcome='win';  deltaQi=bet;  qiAdjust=bet*2; }
        else if(me.score < (opp.score||0)){  outcome='lose'; deltaQi=-bet; qiAdjust=0; }
        else {                                outcome='draw'; deltaQi=0;   qiAdjust=bet; }
      } else {
        // 양측 모두 완료 — 정상 종료 케이스 (forfeit=true 인데 SSE 가 늦게 잡힌 경우)
        if(me.score > (opp.score||0)){       outcome='win';  deltaQi=bet;  qiAdjust=bet*2; }
        else if(me.score < (opp.score||0)){  outcome='lose'; deltaQi=-bet; qiAdjust=0; }
        else {                                outcome='draw'; deltaQi=0;   qiAdjust=bet; }
      }
    } else if(me.score > (opp.score||0)){
      outcome = 'win';  deltaQi = bet;  qiAdjust = bet * 2;
    } else if(me.score < (opp.score||0)){
      outcome = 'lose'; deltaQi = -bet; qiAdjust = 0;            // 에스크로로 이미 차감됨
    } else {
      outcome = 'draw'; deltaQi = 0;   qiAdjust = bet;            // 환불
    }

    // v5: 四象 패시브 — 太陽人 (勝 +10%) / 少陽人 (敗 緩衝 10%)
    if(outcome === 'win' && S.faction === 'taeyang'){
      factionBonus = Math.round(bet * 0.10);
      qiAdjust += factionBonus;
      deltaQi  += factionBonus;
    } else if(outcome === 'lose' && S.faction === 'soyang'){
      factionBonus = Math.round(bet * 0.10);
      qiAdjust += factionBonus;
      deltaQi  += factionBonus;   // -bet + bonus → 손실 완화
    }

    // 氣 정산 (에스크로 후 추가 조정)
    S.qi += qiAdjust;
    if(S.qi < 0) S.qi = 0;
    // 배틀 히스토리 (로컬)
    S.battleHistory = S.battleHistory || [];
    S.battleHistory.unshift({
      ts: Date.now(), win: outcome === 'win', draw: outcome === 'draw', forfeit: !!forfeit,
      myScore: me.score, oppScore: opp.score||0,
      opponentName: opp.name, opponentChar: opp.character,
      bet, deltaQi, factionBonus, faction: S.faction
    });
    if(S.battleHistory.length > 20) S.battleHistory = S.battleHistory.slice(0, 20);
    saveState(); refreshHeader();

    // v9.7: 업적 추적 — 對決 결과
    try{
      if(window.V97Ach){
        const lvlIdx = BET_LEVELS.findIndex(l => l.id === room.level) + 1;  // 1..4
        window.V97Ach.recordBattle({ outcome, betLevel: lvlIdx });
      }
    }catch(_){}

    // v3: 전역 W-L 기록 — 양측 모두 increment (winner 본인이 쓰지만 안전을 위해 본인 것만 씀)
    //     상대 측은 상대 클라이언트가 자기 결과 화면에서 자기 record를 갱신함.
    //     무승부는 양측 모두 d++. forfeit 패배자는 클라이언트가 안 떠 있으므로 적용 안 됨 (게임이론상 적절).
    if(FB){
      try{
        const cur = (await FB.get(`stats/records/${S.userId}`)) || {w:0, l:0, d:0};
        const upd = {
          w: (cur.w||0) + (outcome === 'win' ? 1 : 0),
          l: (cur.l||0) + (outcome === 'lose' ? 1 : 0),
          d: (cur.d||0) + (outcome === 'draw' ? 1 : 0),
          lastTs: Date.now()
        };
        await FB.put(`stats/records/${S.userId}`, upd);
      }catch(_){ /* 기록 실패해도 게임은 계속 */ }
    }

    // v9.0 자율 매치: 결과 후 방 정리도 양측 모두 시도 (DEL 멱등)
    setTimeout(() => FB.del(`battles/${roomId}`), 5000);

    // v3: 승/패 BGM 전환
    try{
      if(outcome === 'win') bgm.startVictory();
      else if(outcome === 'lose') bgm.startDefeat();
      // 무승부는 ambient 유지 — stopBattle()이 이미 ambient로 돌렸음
    }catch(_){}

    const meChar = PHYSICIAN_BY_ID[me.character];
    const oppChar = PHYSICIAN_BY_ID[opp.character];
    const titleHan = outcome === 'win' ? '勝' : (outcome === 'lose' ? '敗' : '和');
    const titleKo = outcome === 'win' ? (forfeit?'부전승':'승리') : (outcome === 'lose' ? '패배' : '무승부');
    // v3: 가운데 한자 색상 — 승=#FFD700(huang), 패=#444(dim), 무=gutong
    const centerColor = outcome === 'win' ? '#FFD700' : (outcome === 'lose' ? '#444' : 'var(--gutong)');
    const centerShadow = outcome === 'win'
      ? '0 0 20px rgba(255,215,0,.55), 0 0 6px rgba(255,215,0,.9)'
      : (outcome === 'lose' ? '0 0 18px rgba(0,0,0,.5)' : 'none');

    view.innerHTML = `
      <h2 class="view-title fade-in"><span class="han">${titleHan}</span>${esc(titleKo)}</h2>

      <!-- v3: 메달리온 ─ 한자 ─ 메달리온 (가로 정렬) -->
      <div class="card imperial fade-in" style="padding:22px 12px 18px">
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:nowrap">
          <div style="flex:1;text-align:center;min-width:0">
            <div style="display:inline-block;border:2px solid ${outcome==='win'?'var(--huang)':'var(--mi-d)'};border-radius:50%;padding:3px;${outcome==='win'?'box-shadow:0 0 14px rgba(201,162,39,.5)':''}">${_charPhotoMedallion(meChar, 78)}</div>
            <div style="font-weight:700;color:var(--mo);margin-top:6px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(me.name)} <span style="color:var(--zhusha);font-size:10px">(나)</span></div>
            <div class="seal" style="font-size:26px;color:${outcome==='win'?'var(--huang)':'var(--mo-l)'};margin-top:2px">${me.score}</div>
          </div>
          <div style="flex:0 0 auto;text-align:center">
            <div style="font-family:var(--font-display);font-size:64px;line-height:1;color:${centerColor};text-shadow:${centerShadow};font-weight:900;letter-spacing:0">${titleHan}</div>
            <div style="font-size:10.5px;color:var(--gutong);margin-top:6px;letter-spacing:.1em">${room.bet.toLocaleString()} 氣</div>
          </div>
          <div style="flex:1;text-align:center;min-width:0">
            <div style="display:inline-block;border:2px solid ${outcome==='lose'?'var(--huang)':'var(--mi-d)'};border-radius:50%;padding:3px;${outcome==='lose'?'box-shadow:0 0 14px rgba(201,162,39,.5)':''}">${_charPhotoMedallion(oppChar, 78)}</div>
            <div style="font-weight:700;color:var(--mo);margin-top:6px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(opp.name)}</div>
            <div class="seal" style="font-size:26px;color:${outcome==='lose'?'var(--huang)':'var(--mo-l)'};margin-top:2px">${opp.score||0}${forfeit?'<span style="font-size:9px;color:var(--gutong)"> (미응답)</span>':''}</div>
          </div>
        </div>
        <div style="text-align:center;margin-top:16px;padding-top:14px;border-top:1px solid var(--mi-d)">
          <div style="font-size:30px;font-family:var(--font-display);color:${deltaQi>0?'var(--feicui)':(deltaQi<0?'var(--zhusha)':'var(--gutong)')}">
            ${deltaQi>0?'+':''}${deltaQi} 氣
          </div>
          ${factionBonus > 0 ? `
            <div style="margin-top:4px;font-size:11.5px;color:${esc(_curFaction().colorDim||'#666')};font-weight:600">
              ${_factionChip(S.faction,'tiny')}
              <span style="margin-left:4px">${esc(_curFaction().han)} 패시브 +${factionBonus} 氣</span>
              <span style="color:var(--gutong);font-weight:400">(${outcome==='win'?'勝':'敗'} 보너스)</span>
            </div>` : ''}
          <div style="margin-top:4px;font-size:12px;color:var(--mo-l)">현재 ${S.qi.toLocaleString()} 氣${forfeit?'<br><span style="color:var(--gutong);font-size:10.5px;font-style:italic">(상대 응답 없음 — 부전승)</span>':''}</div>
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
      <button class="tile gold" type="button" data-stab="personal">
        <span class="han">私</span><span class="ttl">私的 약점 분석</span>
        <span class="desc">내 오답으로 본 章·처방·유형·난이도별 약점 → 학습 연결</span>
      </button>
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
  // v4: 기본은 개인 약점 분석 (가장 학습-동기 직결)
  renderStatDetail('personal');
}

async function renderStatDetail(kind){
  const det = $('#stat-detail');
  if(kind === 'personal') return renderPersonalAnalysis(det);
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
  const exams    = (typeof PAST_EXAMS !== 'undefined') ? ((typeof BULK_QUESTIONS !== 'undefined') ? [...PAST_EXAMS, ...BULK_QUESTIONS] : PAST_EXAMS) : [];
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

// ─── v4: 개인 약점 분석 ─────────────────────────────────────────────────
//   S.wrongIds (개인 오답 누적) 와 question metadata (chapter / formula / type / difficulty)
//   를 교차 분석하여 약점 영역을 산출한다. 章·처방·유형·난이도 4축.
//   章 크기 보정: 절대 카운트가 아닌 "章 내 처방 수 대비 오답 비율" 로 정규화.
//   자동생성 문제(id 없음/auto:*) 는 분석에서 제외 — 章/처방 메타가 일관되지 않음.
//   각 약점 카드에 액션 버튼:
//     (1) "이 章 자동 출제" → startQuizSession('auto', 2, 10, {chapter})
//     (2) "이 처방 심층 분석" → openFormulaDeep(formulaId)
//     (3) "학습 탭 (이 章 필터)" → quiz.sel.v1 에 chapter 박아 setTab('quiz')
async function renderPersonalAnalysis(det){
  const pastAll = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const bulkAll = (typeof BULK_QUESTIONS !== 'undefined') ? BULK_QUESTIONS : [];
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const allExams = pastAll.concat(bulkAll);
  const examById = new Map(allExams.map(e => [e.id, e]));

  // 개인 오답 — id 기반 lookup. auto:* qid 는 metadata 없으므로 제외.
  const wrongIds = (S.wrongIds || []).filter(id => examById.has(id));
  const wrongExams = wrongIds.map(id => examById.get(id));

  if(!wrongExams.length){
    det.innerHTML = `
      <div class="card fade-in imperial">
        <div class="card-title"><span class="han">私</span> 私的 약점 분석</div>
        <div style="text-align:center;padding:24px;color:var(--gutong);font-size:12.5px">
          <div class="han" style="font-size:28px;color:var(--feicui-d);margin-bottom:10px">空</div>
          아직 분석할 오답 기록이 없습니다.<br>
          기출·암기 탭에서 문제를 풀면 오답이 누적되어 약점 분석이 가능해집니다.
        </div>
        <div style="text-align:center;margin-top:12px">
          <button class="btn btn-gold" type="button" onclick="setTab('quiz')">
            <span class="han" style="margin-right:6px">問</span>기출·암기 시작
          </button>
        </div>
      </div>`;
    return;
  }

  // 축별 집계
  const byChapter  = new Map();   // chapter (1차 분류 — 章) → count
  const byFormula  = new Map();   // formula 한자 이름 → count
  const byType     = new Map();   // 문제 유형 → count
  const byDiff     = {1:0, 2:0, 3:0, 4:0};
  wrongExams.forEach(e => {
    const ch = (e.chapter || '').split('-')[0] || '기타';
    const fo = e.formula || '기타';
    const ty = e.type || '기타';
    const d  = e.difficulty || 1;
    byChapter.set(ch, (byChapter.get(ch)||0) + 1);
    byFormula.set(fo, (byFormula.get(fo)||0) + 1);
    byType.set(ty,    (byType.get(ty)||0)    + 1);
    byDiff[d] = (byDiff[d]||0) + 1;
  });

  // 章별 정규화: 章 내 처방 수 대비 오답 비율 (큰 章이 자연스럽게 오답 많은 점을 보정)
  // 또는 章 내 문항 수 대비 — 후자가 더 정확하므로 채택.
  const chapterQCount = new Map();
  allExams.forEach(e => {
    const ch = (e.chapter || '').split('-')[0] || '기타';
    chapterQCount.set(ch, (chapterQCount.get(ch)||0) + 1);
  });
  const chapterRows = Array.from(byChapter.entries()).map(([ch, n]) => {
    const total = chapterQCount.get(ch) || 1;
    return { ch, n, total, rate: n/total };
  }).sort((a,b) => b.rate - a.rate);

  // 처방별 정규화: 해당 처방 문항 수 대비
  const formulaQCount = new Map();
  allExams.forEach(e => {
    const fo = e.formula || '기타';
    formulaQCount.set(fo, (formulaQCount.get(fo)||0) + 1);
  });
  const formulaRows = Array.from(byFormula.entries()).map(([fo, n]) => {
    const total = formulaQCount.get(fo) || 1;
    return { fo, n, total, rate: n/total };
  }).sort((a,b) => (b.rate - a.rate) || (b.n - a.n)).slice(0, 12);

  const typeRows = Array.from(byType.entries())
    .map(([ty, n]) => ({ ty, n }))
    .sort((a,b) => b.n - a.n)
    .slice(0, 8);

  // formula 한자 이름 → id 매핑 (FORMULAS 의 han 필드와 매칭)
  const formulaByHan = new Map();
  formulas.forEach(f => { if(f.han) formulaByHan.set(f.han, f); });

  // 추천 난이도 — 가장 많이 틀린 난이도가 약점
  const weakestDiff = Object.entries(byDiff).sort((a,b) => b[1]-a[1])[0];
  const weakestDiffN = weakestDiff ? +weakestDiff[0] : 2;

  // 上位 약점 章 3개 (rate 기준) + 上位 처방 5개
  const topChapters = chapterRows.slice(0, 3);
  const topFormulas = formulaRows.slice(0, 5);

  // 막대 헬퍼
  const maxBar = Math.max(1, ...chapterRows.map(r => r.n), ...formulaRows.map(r => r.n));
  const bar = (n) => `<div class="pa-bar"><div class="pa-bar-fill" style="width:${Math.round((n/maxBar)*100)}%"></div></div>`;

  // 난이도 분포 — DIFFICULTY_META 의 색상 사용
  const diffStrip = [1,2,3,4].map(d => {
    const m = DIFFICULTY_META[d];
    const n = byDiff[d] || 0;
    const w = Math.max(8, Math.round((n / Math.max(1, wrongExams.length)) * 100));
    return `<div class="pa-diff-seg" style="flex:${w};background:${m.color}" title="${m.han} ${m.ko} ${n}회">
      <b>${m.han}</b><span>${n}</span>
    </div>`;
  }).join('');

  det.innerHTML = `
    <div class="card fade-in imperial">
      <div class="card-title">
        <span class="han">私</span> 私的 약점 분석
        <span style="float:right;font-size:11px;color:var(--gutong);font-weight:400;font-family:var(--font-body)">
          총 ${wrongExams.length}회 오답 (자동생성 제외)
        </span>
      </div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:10px;line-height:1.55">
        본인의 오답 기록을 章·처방·유형·난이도 4축으로 분석합니다.
        章·처방별 비율은 <b>해당 영역 문항 수 대비</b> 정규화 — 큰 章의 오답이 부풀려 보이는 편향을 제거.
      </div>

      <!-- 난이도 축 -->
      <div class="pa-section">
        <div class="pa-section-title"><span class="han">難</span> 난이도별 오답 분포</div>
        <div class="pa-diff-strip">${diffStrip}</div>
        <div style="font-size:11px;color:var(--gutong);margin-top:6px;text-align:center">
          ⇒ 가장 자주 막히는 난이도: <b style="color:${DIFFICULTY_META[weakestDiffN].color}">
          ${DIFFICULTY_META[weakestDiffN].han} ${DIFFICULTY_META[weakestDiffN].ko} (${byDiff[weakestDiffN]}회)</b>
        </div>
      </div>

      <!-- 章 축 -->
      <div class="pa-section">
        <div class="pa-section-title">
          <span class="han">章</span> 章별 약점 <span class="pa-hint">(章 내 문항 수 대비 오답률)</span>
        </div>
        <div class="pa-rows">
          ${chapterRows.slice(0, 6).map((r, i) => {
            const isWeak = i < 3;
            return `<div class="pa-row ${isWeak?'weak':''}">
              <div class="pa-row-name"><span class="han">${esc(r.ch)}</span></div>
              <div class="pa-row-bar">
                ${bar(r.n)}
                <div class="pa-row-meta">${r.n}/${r.total} = <b>${(r.rate*100).toFixed(0)}%</b></div>
              </div>
              <button class="pa-row-act" data-act="chapter-auto" data-chapter="${esc(r.ch)}" title="이 章 자동 출제 (10문)">
                <span class="han">出</span>
              </button>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- 처방 축 -->
      <div class="pa-section">
        <div class="pa-section-title">
          <span class="han">方</span> 처방별 약점 TOP ${topFormulas.length} <span class="pa-hint">(처방 내 문항 수 대비)</span>
        </div>
        <div class="pa-rows">
          ${topFormulas.map((r, i) => {
            const fmeta = formulaByHan.get(r.fo);
            const isWeak = i < 3;
            return `<div class="pa-row ${isWeak?'weak':''}">
              <div class="pa-row-name"><span class="han">${esc(r.fo)}</span>${fmeta?`<span class="pa-row-sub">${esc(fmeta.ko||'')}</span>`:''}</div>
              <div class="pa-row-bar">
                ${bar(r.n)}
                <div class="pa-row-meta">${r.n}/${r.total} = <b>${(r.rate*100).toFixed(0)}%</b></div>
              </div>
              ${fmeta ? `<button class="pa-row-act" data-act="formula-drill" data-formula-id="${esc(fmeta.id)}" title="이 처방 드릴 (반복 학습)">
                <span class="han">練</span>
              </button>
              <button class="pa-row-act" data-act="formula-deep" data-formula="${esc(r.fo)}" title="이 처방 심층 분석">
                <span class="han">析</span>
              </button>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- 유형 축 -->
      <div class="pa-section">
        <div class="pa-section-title">
          <span class="han">類</span> 자주 틀리는 문제 유형
        </div>
        <div class="pa-type-chips">
          ${typeRows.map(r => `<span class="pa-type-chip"><b>${esc(r.ty)}</b>·${r.n}회</span>`).join('')}
        </div>
      </div>

      <!-- 처방안 (액션) -->
      <div class="pa-section pa-actions">
        <div class="pa-section-title"><span class="han">策</span> 처방안 — 약점 보강</div>
        <div class="pa-action-grid">
          ${topFormulas[0] && formulaByHan.get(topFormulas[0].fo) ? `
            <button class="pa-action-btn primary" data-act="formula-drill-lg" data-formula-id="${esc(formulaByHan.get(topFormulas[0].fo).id)}">
              <div class="pa-action-han">練</div>
              <div class="pa-action-ttl">${esc(topFormulas[0].fo)} 드릴</div>
              <div class="pa-action-sub">본초·君臣·作用·主治 반복</div>
            </button>` : ''}
          ${topChapters[0] ? `
            <button class="pa-action-btn" data-act="chapter-auto-lg" data-chapter="${esc(topChapters[0].ch)}">
              <div class="pa-action-han">出</div>
              <div class="pa-action-ttl">${esc(topChapters[0].ch)} 자동 출제</div>
              <div class="pa-action-sub">${DIFFICULTY_META[weakestDiffN].han}·${DIFFICULTY_META[weakestDiffN].ko} 10문</div>
            </button>` : ''}
          ${topFormulas[0] && formulaByHan.get(topFormulas[0].fo) ? `
            <button class="pa-action-btn" data-act="formula-deep-lg" data-formula="${esc(topFormulas[0].fo)}">
              <div class="pa-action-han">析</div>
              <div class="pa-action-ttl">${esc(topFormulas[0].fo)} 심층</div>
              <div class="pa-action-sub">구성·君臣佐使·기출</div>
            </button>` : ''}
          <button class="pa-action-btn" data-act="wrong-mode">
            <div class="pa-action-han">錯</div>
            <div class="pa-action-ttl">오답함 풀이</div>
            <div class="pa-action-sub">틀린 문제만 다시</div>
          </button>
        </div>
      </div>
    </div>
  `;

  // 스타일 한 번만 주입
  if(!document.getElementById('pa-style')){
    const st = document.createElement('style');
    st.id = 'pa-style';
    st.textContent = `
      .pa-section{margin-top:14px;padding-top:12px;border-top:1px solid var(--mi-d)}
      .pa-section:first-of-type{border-top:0;margin-top:8px;padding-top:0}
      .pa-section-title{font-family:var(--font-display);font-size:13px;color:var(--zhusha-d);margin-bottom:8px;letter-spacing:.04em}
      .pa-section-title .han{margin-right:6px;color:var(--zhusha)}
      .pa-section-title .pa-hint{float:right;font-size:10px;color:var(--gutong);font-weight:400;font-family:var(--font-body);letter-spacing:0}
      .pa-diff-strip{display:flex;gap:2px;height:36px;border-radius:6px;overflow:hidden;border:1px solid var(--mi-d)}
      .pa-diff-seg{display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:var(--font-display);min-width:0;padding:3px 0}
      .pa-diff-seg b{font-size:14px;line-height:1;letter-spacing:.02em;text-shadow:0 1px 2px rgba(0,0,0,.35)}
      .pa-diff-seg span{font-size:10px;opacity:.92;margin-top:2px}
      .pa-rows{display:flex;flex-direction:column;gap:4px}
      .pa-row{display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--mi-w);border-radius:5px;border-left:3px solid var(--mi-d);transition:background .12s}
      .pa-row.weak{border-left-color:var(--zhusha);background:#FFF8E8}
      .pa-row-name{flex:0 0 28%;font-size:12.5px;display:flex;flex-direction:column;line-height:1.25}
      .pa-row-name .han{font-family:var(--font-han);color:var(--zhusha-d);font-weight:600}
      .pa-row-name .pa-row-sub{font-size:10px;color:var(--gutong);font-weight:400}
      .pa-row-bar{flex:1;display:flex;align-items:center;gap:6px;min-width:0}
      .pa-bar{flex:1;height:8px;background:var(--mi-d);border-radius:4px;overflow:hidden;min-width:30px}
      .pa-bar-fill{height:100%;background:linear-gradient(90deg,var(--huang),var(--zhusha));transition:width .3s}
      .pa-row-meta{font-size:10.5px;color:var(--mo-l);min-width:64px;text-align:right;font-family:var(--font-display)}
      .pa-row-meta b{color:var(--zhusha-d)}
      .pa-row-act{background:var(--mi-w);border:1px solid var(--zhusha);color:var(--zhusha-d);border-radius:5px;padding:4px 8px;font-family:var(--font-han);font-size:13px;cursor:pointer;flex-shrink:0;transition:all .12s}
      .pa-row-act:hover{background:var(--zhusha);color:var(--mi-w)}
      .pa-type-chips{display:flex;flex-wrap:wrap;gap:5px}
      .pa-type-chip{background:rgba(42,112,96,.12);border:1px solid rgba(42,112,96,.35);color:var(--mo-l);font-size:11px;padding:3px 9px;border-radius:11px}
      .pa-type-chip b{color:var(--feicui-d);margin-right:2px}
      .pa-actions{background:linear-gradient(180deg,rgba(201,162,39,.05),rgba(201,162,39,0));border-radius:6px;padding:12px 8px;margin:14px -8px -8px;border-top:2px solid var(--huang-l)}
      .pa-action-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:4px}
      .pa-action-btn{background:var(--mi-w);border:1.5px solid var(--gutong);border-radius:8px;padding:10px 8px;text-align:center;cursor:pointer;color:var(--mo);transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:2px}
      .pa-action-btn:hover{transform:translateY(-1px);border-color:var(--zhusha);box-shadow:var(--sh-sm)}
      .pa-action-btn.primary{background:linear-gradient(180deg,var(--huang-l),var(--huang));border-color:var(--zhusha);color:var(--mo)}
      .pa-action-han{font-family:var(--font-han);font-size:22px;color:var(--zhusha-d);line-height:1}
      .pa-action-btn.primary .pa-action-han{color:var(--zhusha-d)}
      .pa-action-ttl{font-size:12px;font-weight:600;margin-top:2px;line-height:1.25}
      .pa-action-sub{font-size:10px;color:var(--gutong);margin-top:1px}
      .pa-action-btn.primary .pa-action-sub{color:var(--mo-l)}
    `;
    document.head.appendChild(st);
  }

  // 액션 핸들러
  det.querySelectorAll('[data-act]').forEach(el => {
    el.addEventListener('click', () => {
      const act = el.dataset.act;
      if(act === 'chapter-auto' || act === 'chapter-auto-lg'){
        const ch = el.dataset.chapter;
        // v6 수정: wrongExams 의존이 아닌 FORMULAS 전체에서 章 매칭으로 처방 풀 구성.
        // 章 약점은 표시되었는데 처방 데이터 부족으로 출제 못 하는 버그를 해소.
        // formula.chapter 는 '8장 補益劑·補氣' 형식, 표시 章은 split('-')[0] 후 .trim() 한 값.
        // 그러나 chapter 는 '·'·' ' 구분자가 섞여있어 split('-')[0] 결과는 그냥 '8장 補益劑' 같은 형식.
        // 안전 매칭: formula.chapter 시작 일치 (대분류) + 백업으로 wrongExams 추출.
        const formIds = [];
        formulas.forEach(f => {
          const fCh = (f.chapter||'').split('-')[0].split('·')[0].trim();
          const target = ch.split('-')[0].split('·')[0].trim();
          if(fCh === target || (f.chapter||'').startsWith(target)){
            if(!formIds.includes(f.id)) formIds.push(f.id);
          }
        });
        // 백업: 매칭 0건이면 wrongExams 에서 추출
        if(!formIds.length){
          wrongExams.forEach(e => {
            const eCh = (e.chapter||'').split('-')[0];
            if(eCh === ch){
              const f = formulaByHan.get(e.formula);
              if(f && !formIds.includes(f.id)) formIds.push(f.id);
            }
          });
        }
        if(!formIds.length){
          toast(`${ch} — FORMULAS 에서 매칭되는 처방이 없습니다`,'gold');
          return;
        }
        toast(`${ch} 자동 출제 시작 — ${DIFFICULTY_META[weakestDiffN].ko} 10문 (${formIds.length}개 처방 풀)`,'gold');
        startQuizSession('auto', weakestDiffN, 10, {formulaIds: formIds});
      } else if(act === 'formula-deep' || act === 'formula-deep-lg'){
        const formulaName = el.dataset.formula;
        if(typeof openFormulaDeep === 'function') openFormulaDeep(formulaName);
        else toast('처방 심층 모달을 열 수 없습니다');
      } else if(act === 'formula-drill' || act === 'formula-drill-lg'){
        // v6: 처방 드릴 — 약점 처방 1개를 다각도로 반복 학습
        const fid = el.dataset.formulaId;
        startFormulaDrill(fid);
      } else if(act === 'quiz-tab'){
        // 章 필터를 quiz.sel.v1 에 박고 quiz 탭 이동.
        // 학습 탭은 chapter 필터를 UI로 노출하지 않으므로 일회성 사전 설정 후 toast 안내.
        const ch = el.dataset.chapter;
        const sel = JSON.parse(localStorage.getItem('quiz.sel.v1')||'{}');
        sel._chapterHint = ch;  // 자체적으론 무시되지만 다음 startQuizSession 호출 시 toast로 안내 표시 가능
        localStorage.setItem('quiz.sel.v1', JSON.stringify(sel));
        toast(`학습 탭으로 이동 — ${ch} 약점 보강 추천`,'gold');
        setTab('quiz');
      } else if(act === 'wrong-mode'){
        const sel = JSON.parse(localStorage.getItem('quiz.sel.v1')||'{}');
        sel.mode = 'wrong'; sel.diff = weakestDiffN; sel.count = sel.count || 5;
        localStorage.setItem('quiz.sel.v1', JSON.stringify(sel));
        setTab('quiz');
      }
    });
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
  const exams = (typeof PAST_EXAMS !== 'undefined') ? ((typeof BULK_QUESTIONS !== 'undefined') ? [...PAST_EXAMS, ...BULK_QUESTIONS] : PAST_EXAMS) : [];
  const byId = new Map(exams.map(e => [e.id, e]));
  const list = Object.entries(wrongs)
    .map(([qid, count]) => ({qid, count: Number(count)||0}))
    .filter(x => x.count > 0)
    .filter(x => !x.qid.startsWith('auto:'))   // v6: 자동 생성 문제 제외 (재현 불가)
    .sort((a,b) => b.count - a.count)
    .slice(0, 30);

  // 카테고리: 기출(past_*) / 기타 (auto:* 는 위에서 필터링됨)
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
        기출 ${npast}건 · 자동생성 제외 · 클릭 시 상세
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

// ─── 기출 분석 v2.3 ──────────────────────────────────────────────────────
// 모든 년도 기출 + 유형·章·처방·난이도별 분포. sub-tabs 로 5종 차트 전환.
// v2.3: 기출(PAST_EXAMS) / 자작(BULK_QUESTIONS) / 통합 소스 토글 추가. 기본 '기출만'.
let _examSrcMode = 'past';  // 'past' | 'new' | 'all'
function renderExamAnalysis(det){
  const pastAll  = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const bulkAll  = (typeof BULK_QUESTIONS !== 'undefined') ? BULK_QUESTIONS : [];
  const exams = _examSrcMode === 'past' ? pastAll
              : _examSrcMode === 'new'  ? bulkAll
              : pastAll.concat(bulkAll);
  if(!pastAll.length && !bulkAll.length){
    det.innerHTML = `<div class="card"><div class="card-title"><span class="han">問</span> 기출 분석</div><div style="font-size:12.5px;color:var(--gutong);text-align:center;padding:16px">data-formulas.js 에 PAST_EXAMS 배열이 필요합니다.</div></div>`;
    return;
  }

  // 소스별 카운트 (헤더용)
  const nPast = pastAll.length, nNew = bulkAll.length;

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
      <div class="card-title"><span class="han">問</span> ${_examSrcMode==='past'?'기출':_examSrcMode==='new'?'자작':'전체'} ${exams.length}문 종합 분석</div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:6px">${Object.keys(byExam).length}회 · ${Object.keys(byFormula).length}처방 · ${Object.keys(byType).length}유형</div>
      <div class="subtab-row" id="exam-src-tab" style="margin-bottom:8px">
        <button class="subtab-btn${_examSrcMode==='past'?' on':''}" data-src="past" title="22학번 1·2차 수시 등 진짜 기출">舊 기출 ${nPast}</button>
        <button class="subtab-btn${_examSrcMode==='new'?' on':''}" data-src="new" title="v3에서 신규 생성된 자작 문항 (기출 아님)">新 자작 ${nNew}</button>
        <button class="subtab-btn${_examSrcMode==='all'?' on':''}" data-src="all">全 통합 ${nPast+nNew}</button>
      </div>
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

  // 소스 토글 핸들러
  $$('#exam-src-tab .subtab-btn').forEach(b => b.addEventListener('click', () => {
    _examSrcMode = b.dataset.src;
    renderExamAnalysis(det);
  }));

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
    chapter:    () => `<div><b style="font-size:13px;color:var(--zhusha-d)">章별 분포</b><div style="font-size:11px;color:var(--gutong);margin-bottom:6px">7장 表裏雙解·8장 補益</div>${bar(sort(byChapter))}</div>`,
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

// v2.3: 처방별 심층 분석 — 기출(PAST)과 신규자작(BULK)을 명확히 분리
async function openFormulaDeep(formulaName){
  const pastAll  = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const bulkAll  = (typeof BULK_QUESTIONS !== 'undefined') ? BULK_QUESTIONS : [];
  const exams    = pastAll.concat(bulkAll);  // 행 클릭 시 검색용
  const formulas = (typeof FORMULAS    !== 'undefined') ? FORMULAS    : [];
  // 처방 데이터 (한글명 매칭 — 가감방은 ko 와 정확히 일치, 변형은 contains)
  const f = formulas.find(x => x.ko === formulaName) ||
            formulas.find(x => x.han === formulaName) ||
            formulas.find(x => x.ko && formulaName.includes(x.ko));
  const relPast = pastAll.filter(e => (e.formula || '').trim() === formulaName);
  const relNew  = bulkAll.filter(e => (e.formula || '').trim() === formulaName);
  const relExams = relPast;  // 통계는 기출 기준
  // 글로벌 오답 (기출+자작 모두)
  let wrongMap = {};
  if(FB){
    try{
      const w = await FB.get('stats/wrongs');
      if(w) wrongMap = w;
    }catch(_){}
  }
  // 집계 (기출 기준)
  const byType = {}, bySrc = {}, byDiff = {};
  relPast.forEach(e => {
    byType[e.type||'기타'] = (byType[e.type||'기타']||0)+1;
    bySrc[e.src||'기타']   = (bySrc[e.src||'기타']||0)+1;
    byDiff[e.difficulty||1] = (byDiff[e.difficulty||1]||0)+1;
  });
  const totalWrongPast = relPast.reduce((s, e) => s + (Number(wrongMap[e.id])||0), 0);
  const totalWrongNew  = relNew.reduce((s, e) => s + (Number(wrongMap[e.id])||0), 0);
  const pastRanked = relPast.slice().map(e => ({...e, _w: Number(wrongMap[e.id])||0}))
    .sort((a,b) => b._w - a._w);
  const newRanked  = relNew.slice().map(e => ({...e, _w: Number(wrongMap[e.id])||0}))
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
  const examRow = (e, badge) => `
    <div class="fdeep-exam-row" data-qid="${esc(e.id)}">
      <div class="ex-meta">
        ${badge ? `<span class="ex-src" style="background:${badge.bg};color:${badge.fg}">${badge.label}</span>` : ''}
        <span class="ex-src">${esc(e.src||'')}</span>
        <span class="ex-type">${esc(e.type||'')}</span>
        <span class="ex-diff diff-${e.difficulty||1}">난이도 ${e.difficulty||1}</span>
        ${e._w > 0 ? `<span class="ex-w">오답 ${e._w}</span>` : ''}
      </div>
      <div class="ex-q">${esc(e.q||'').slice(0,90)}${(e.q||'').length>90?'…':''}</div>
    </div>`;
  const badgePast = { label:'舊', bg:'#6E1818', fg:'#FFE08A' };
  const badgeNew  = { label:'新', bg:'#2A7060', fg:'#E8F4E8' };

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
      <div class="modal-tag">처방 심층 분석 v2.3</div>
      <h3 class="modal-title"><span class="han" style="margin-right:6px">析</span>${esc(formulaName)}</h3>
      <div class="modal-sub">
        舊기출 <b>${relPast.length}</b>문 · 新자작 <b>${relNew.length}</b>문 ·
        글로벌 오답 <b style="color:var(--zhusha-d)">${totalWrongPast+totalWrongNew}</b>회
      </div>
    </div>
    <div class="modal-body fdeep-body">
      ${formulaCard}

      ${relPast.length ? `
        <div class="fdeep-grid">
          <div class="fdeep-block">
            <div class="fdeep-blk-title"><span class="han">類</span> 기출 유형 분포</div>
            ${miniBar(sort(byType))}
          </div>
          <div class="fdeep-block">
            <div class="fdeep-blk-title"><span class="han">期</span> 출제 시험</div>
            ${miniBar(sort(bySrc))}
          </div>
        </div>

        <div class="fdeep-block">
          <div class="fdeep-blk-title"><span class="han">舊</span> 진짜 기출 (${relPast.length}문) — 오답 많은 순</div>
          <div style="font-size:11px;color:var(--gutong);margin-bottom:6px">22학번 1·2차 수시 등. 클릭 시 정답·해설</div>
          <div class="fdeep-exams">
            ${pastRanked.map(e => examRow(e, badgePast)).join('')}
          </div>
        </div>
      ` : `
        <div class="fdeep-block" style="text-align:center;color:var(--gutong);padding:12px">
          이 처방의 진짜 기출 (PAST_EXAMS) 은 없습니다.
        </div>
      `}

      ${relNew.length ? `
        <div class="fdeep-block" style="margin-top:8px">
          <div class="fdeep-blk-title"><span class="han">新</span> v3 자작 (${relNew.length}문) — 오답 많은 순</div>
          <div style="font-size:11px;color:var(--gutong);margin-bottom:6px">시험 출제 가능성에 따른 신규 자작 문항. 기출이 아님.</div>
          <div class="fdeep-exams">
            ${newRanked.slice(0, 30).map(e => examRow(e, badgeNew)).join('')}
            ${newRanked.length > 30 ? `<div style="font-size:11px;color:var(--gutong);text-align:center;padding:8px">… 외 ${newRanked.length-30}문 (상위 30문만 표시)</div>` : ''}
          </div>
        </div>
      ` : ''}

      <div class="modal-actions">
        <button class="btn btn-sm btn-o" onclick="closeModal()">닫기</button>
      </div>
    </div>
  `;
  openModal(html);
  // 행 클릭 → 문제 상세 모달
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
  const pastAll = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const bulkAll = (typeof BULK_QUESTIONS !== 'undefined') ? BULK_QUESTIONS : [];
  const exams = pastAll.concat(bulkAll);  // 카운트 표시용 (모든 풀)
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
  // 난이도별 카운트 (기출/자작 분리)
  const byDiffPast = {1:0,2:0,3:0,4:0};
  const byDiffNew  = {1:0,2:0,3:0,4:0};
  pastAll.forEach(e => { byDiffPast[e.difficulty||1] = (byDiffPast[e.difficulty||1]||0)+1; });
  bulkAll.forEach(e => { byDiffNew[e.difficulty||1]  = (byDiffNew[e.difficulty||1]||0)+1; });
  const totalAuto = formulas.length;  // 자동 생성 가능 풀

  // 현재 선택 상태 (localStorage 캐시)
  const sel = JSON.parse(localStorage.getItem('quiz.sel.v1')||'{}');
  if(!sel.diff)  sel.diff = 1;
  if(!sel.count) sel.count = 5;
  if(!sel.mode)  sel.mode = 'past';   // v2.3: default 'past' (기출만 — v3 자작 제외)

  view.innerHTML = `
    <h2 class="view-title"><span class="han">問</span>기출·암기</h2>
    <div class="view-sub">난이도·문제수를 골라 시작하세요</div>

    <!-- 난이도 선택 -->
    <div class="card imperial fade-in">
      <div class="card-title"><span class="han">難度</span> 난이도 선택</div>
      <div class="diff-grid">
        ${[1,2,3,4].map(d => {
          const m = DIFFICULTY_META[d];
          const np = byDiffPast[d], nn = byDiffNew[d];
          const supplyText = d === 4
            ? `<span style="color:var(--gutong);font-size:10.5px">舊${np}·新${nn}·自${totalAuto}+</span>`
            : `<span style="color:var(--feicui);font-size:10.5px">舊${np} · 新${nn}</span>`;
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
        <button class="mode-btn ${sel.mode==='past'?'on':''}" type="button" data-m="past">
          <span class="han">舊問</span> 기출만 <span class="hint">22학번 1·2차 ${pastAll.length}문</span>
        </button>
        <button class="mode-btn ${sel.mode==='new'?'on':''}" type="button" data-m="new">
          <span class="han">新問</span> 자작만 <span class="hint">v3 신규 ${bulkAll.length}문</span>
        </button>
        <button class="mode-btn ${sel.mode==='auto'?'on':''}" type="button" data-m="auto">
          <span class="han">自題</span> 자동만 <span class="hint">처방 데이터 기반</span>
        </button>
        <button class="mode-btn ${sel.mode==='mixed'?'on':''}" type="button" data-m="mixed">
          <span class="han">混合</span> 全 혼합 <span class="hint">기출+자작+자동</span>
        </button>
        <button class="mode-btn ${sel.mode==='wrong'?'on':''}" type="button" data-m="wrong" style="grid-column:1/-1">
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

window.startQuizSession = function(mode, diff, count, opts){
  mode  = mode  || 'past';
  diff  = diff  || 1;
  count = count || 5;
  opts  = opts  || {};
  const pastAll = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const bulkAll = (typeof BULK_QUESTIONS !== 'undefined') ? BULK_QUESTIONS : [];

  // v4: chapter 또는 formulaIds 필터 — 약점 章/처방 집중 학습용
  const filterByOpts = (arr) => {
    let r = arr;
    if(opts.chapter){
      r = r.filter(e => e.chapter === opts.chapter);
    }
    if(opts.formulaIds && opts.formulaIds.length){
      const idset = new Set(opts.formulaIds);
      r = r.filter(e => idset.has(e.formula_id || e.formula));
    }
    return r;
  };

  // 풀 빌드 — v2.3: 'past'와 'new'를 명확히 분리. mixed는 全 합산.
  let pool = [];
  if(mode === 'past'){
    // 진짜 22학번 기출만
    pool = filterByOpts(pastAll).filter(e => (e.difficulty||1) === diff);
    if(!pool.length){
      toast(`${DIFFICULTY_META[diff].ko} 기출이 없습니다. 자동생성으로 전환`);
      pool = generateQuizQuestions(count*2, diff, opts);
    }
  } else if(mode === 'new'){
    // v3 신규 자작만
    pool = filterByOpts(bulkAll).filter(e => (e.difficulty||1) === diff);
    if(!pool.length){
      toast(`${DIFFICULTY_META[diff].ko} 자작 문항이 없습니다`);
      return;
    }
  } else if(mode === 'wrong'){
    // 오답함 (기출+자작 합산에서)
    const allExams = pastAll.concat(bulkAll);
    pool = filterByOpts(allExams).filter(e => S.wrongIds.includes(e.id));
    pool = pool.filter(e => (e.difficulty||1) === diff);
    if(!pool.length){ toast('해당 난이도 오답이 없습니다'); return; }
  } else if(mode === 'auto'){
    pool = generateQuizQuestions(count*2, diff, opts);
  } else {  // mixed — 全 합산 + 자동
    const allFiltered = filterByOpts(pastAll.concat(bulkAll)).filter(e => (e.difficulty||1) === diff);
    const autoNeeded = Math.max(count - allFiltered.length, Math.ceil(count/3));
    pool = allFiltered.concat(generateQuizQuestions(autoNeeded, diff, opts));
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

  // v9.7: 시그니처 세션 초기화 (솔로 학습 모드)
  try{
    if(window.V97Sig){
      window.V97Sig.setMode('solo');
      window.V97Sig.resetSession();
    }
  }catch(_){}
  let _quizStreak = 0;       // v9.7: 한 퀴즈 내 연속 정답
  let _quizBestStreak = 0;   // v9.7: 한 퀴즈 내 최고 연속

  function show(){
    if(cur >= pool.length){
      // 결과 + 氣 보상 (난이도 보너스)
      const baseReward = score * 10;
      const diffMult = [1, 1.5, 2, 3][diff-1] || 1;
      const baseEarned = Math.round(baseReward * diffMult);
      // v5: 四象 패시브 — 太陰人 (+10% 상시) / 少陰人 (全 정답시 N×5×diffMult)
      let factionBonus = 0;
      const isPerfect = (score === pool.length && pool.length > 0);
      if(S.faction === 'taeum'){
        factionBonus = Math.round(baseEarned * 0.10);
      } else if(S.faction === 'soeum' && isPerfect){
        factionBonus = Math.round(pool.length * 5 * diffMult);
      }
      // v9.7: 캐릭터 시그니처 보너스 (솔로만, baseEarned 의 최대 +50% 캡)
      let sigBonus = 0;
      let sigBreakdown = null;
      try{
        if(window.V97Sig){
          const r = window.V97Sig.sessionBonus(baseEarned);
          sigBonus = r.bonus || 0;
          sigBreakdown = r.breakdown;
        }
      }catch(_){}
      const earned = baseEarned + factionBonus + sigBonus;
      S.qi += earned; saveState(); refreshHeader();
      // v9.7: 업적 추적 — 全 정답·연속 정답·플래시 카운터 (퀴즈는 따로)
      try{
        if(window.V97Ach){
          window.V97Ach.recordStreak(_quizBestStreak);
          if(isPerfect) window.V97Ach.recordPerfectQuiz();
          // 오답함 비움: 누적 10문제 이상 풀고 wrongIds 가 0 일 때만 인정
          if((S.wrongIds || []).length === 0 &&
             (S.achStats && (S.achStats.totalAnswered || 0) >= 10)){
            window.V97Ach.recordWrongCleared();
          }
        }
      }catch(_){}
      const fObj = (typeof getFaction === 'function') ? getFaction(S.faction) : null;
      const factionLine = factionBonus > 0 && fObj ? `
        <div style="margin-top:6px;font-size:12px;color:${esc(fObj.colorDim||'#666')};font-weight:600">
          ${_factionChip(S.faction,'tiny')}
          <span style="margin-left:4px">${esc(fObj.han)} 패시브 +${factionBonus} 氣</span>
          <span style="color:var(--gutong);font-weight:400;font-size:10.5px">${S.faction==='soeum'?'(全 정답 N='+pool.length+'×5×'+diffMult+')':'(상시 +10%)'}</span>
        </div>` : '';
      // v9.7: 시그니처 보너스 표시
      const charObj = PHYSICIAN_BY_ID[S.character];
      const sigLine = (sigBonus > 0 && sigBreakdown && charObj) ? `
        <div style="margin-top:6px;font-size:12px;color:var(--feicui);font-weight:600">
          <span class="han">${esc(charObj.han)}</span>
          <span> 시그니처 +${sigBonus} 氣</span>
          ${sigBreakdown.juexue > 0 ? `<span style="color:var(--huang);margin-left:4px">絕學!</span>` : ''}
          ${sigBreakdown.raw > sigBreakdown.cap ? `<span style="color:var(--gutong);font-weight:400;font-size:10.5px"> (캡 적용)</span>` : `<span style="color:var(--gutong);font-weight:400;font-size:10.5px"> (章典 ${window.V97Sig.getSession().totalChapter} · 逸品 ${window.V97Sig.getSession().totalYipin}${sigBreakdown.juexue>0?' · 絕學 1':''})</span>`}
        </div>` : '';
      view.innerHTML = `
        <h2 class="view-title fade-in"><span class="han">畢</span>완료</h2>
        <div class="card imperial" style="text-align:center;padding:22px">
          <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:6px">
            <span class="seal-stamp" style="background:${dm.color};font-size:13px">${dm.icon}</span>
            <span class="han" style="font-size:14px;color:${dm.color}">${dm.han}·${dm.ko}</span>
          </div>
          <div class="seal" style="font-size:42px;color:var(--zhusha-d);line-height:1">${score}<span style="font-size:24px;opacity:.6">/${pool.length}</span></div>
          <div style="margin-top:8px;font-size:14px;color:var(--feicui);font-weight:600">+${earned} 氣 ${diff>1?`<span style="font-size:11px;color:var(--gutong)">(×${diffMult} 난이도 보너스)</span>`:''}</div>
          ${factionLine}
          ${sigLine}
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
    // v2.3: 출처 배지 — 舊(기출) / 新(v3 자작) / 自(자동생성)
    const srcBadge = isPastQ(q) ? `<span style="background:#6E1818;color:#FFE08A;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;font-family:var(--font-display)" title="22학번 1·2차 수시 등 진짜 기출">舊 기출</span>`
                    : isNewQ(q) ? `<span style="background:#2A7060;color:#E8F4E8;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;font-family:var(--font-display)" title="v3 신규 자작 — 기출 아님">新 자작</span>`
                    : `<span style="background:#8C5028;color:#F0DCC4;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;font-family:var(--font-display)" title="처방 데이터 기반 자동생성">自 자동</span>`;
    view.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span class="seal-stamp tiny" style="background:${dm.color}">${dm.icon}</span>
        <span class="han" style="font-size:13px;color:${dm.color}">${dm.han}·${dm.ko}</span>
        ${srcBadge}
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
      // v3: 선지 효과음
      try{ correct ? bgm.sfxCorrect() : bgm.sfxWrong(); }catch(_){}
      // v9.7: 시그니처 평가 + 효과 + 업적
      if(correct){
        _quizStreak++;
        if(_quizStreak > _quizBestStreak) _quizBestStreak = _quizStreak;
        try{
          // 업적 누적: 총 정답 / 정답 캐릭터별 / 정답 章별
          if(window.V97Ach){
            window.V97Ach.bumpCounter('totalAnswered', 1);
            window.V97Ach.recordCharacterRight(S.character);
            // 章 추출: q.formula 가 있으면 매칭, 아니면 자동생성 처방의 ch
            const fAll = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
            const fHan = q.formula || q.formula_han || '';
            const fId  = q.formula_id || '';
            let f = null;
            if(fId)  f = fAll.find(x => x.id === fId);
            if(!f && fHan){
              f = fAll.find(x => x.ko === fHan || x.han === fHan);
            }
            if(f && f.chapter){
              const m = f.chapter.match(/^(\d)/);
              if(m) window.V97Ach.recordChapterRight(m[1]);
            }
            // 시그니처 평가 — formula 객체 필요
            if(window.V97Sig){
              const sigRes = window.V97Sig.evaluate(S.character, q, f);
              if(sigRes && sigRes.tier){
                window.V97Sig.fireEffect(S.character, sigRes);
                const tickRes = window.V97Sig.tickSession(sigRes.tier);
                window.V97Ach.recordSignature(sigRes.tier);
                if(tickRes && tickRes.juexue){
                  setTimeout(() => {
                    try{ window.V97Sig.fireJuexueEffect(S.character, sigRes); }catch(_){}
                  }, 1700);
                  window.V97Ach.recordSignature('juexue');
                }
              } else {
                window.V97Sig.tickSession(null);
              }
            }
          }
        }catch(_){}
      } else {
        _quizStreak = 0;
        try{
          if(window.V97Sig) window.V97Sig.tickSession(null);
          if(window.V97Ach) window.V97Ach.bumpCounter('totalAnswered', 1);
        }catch(_){}
      }
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

// ═══════════════════════════════════════════════════════════════════════════
// v6: 처방 드릴 모드 — 한 처방을 여러 각도로 반복 학습
// ═══════════════════════════════════════════════════════════════════════════
// 사용자의 약점 처방 1개를 받아 그 처방의 모든 학습 포인트를 카드 단위로 생성:
//   - 본초 빈칸 (composition 의 각 본초마다 1장)
//   - 君臣佐使 매칭 (monarch_minister 의 각 본초마다 1장)
//   - 主作用 (action)
//   - 主治 키워드 (indication 에서 핵심 어구)
//   - 加減 변환 (keyPoints 에서 +/-/→ 패턴 자동 추출)
//   - 出典 (source)
// 객관식 4지선다 + 즉시 정답 공개. 점수 추적은 하되 결과는 보조적
// (드릴의 목적은 마스터, 점수 X).

function generateDrillCards(formula){
  if(!formula) return [];
  const herbs = (typeof HERBS !== 'undefined') ? HERBS : [];
  const allFormulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const herbByHan = new Map();
  herbs.forEach(h => herbByHan.set(h.han, h));
  // 본초 매칭 헬퍼 — 炙甘草·甘草(炙) → 甘草 정규화
  const normHerb = (s) => String(s||'').replace(/\([^)]*\)/g, '').replace(/^炙/,'');

  const cards = [];
  const shuffle = (arr) => arr.map(x => ({x, r: Math.random()})).sort((a,b)=>a.r-b.r).map(o=>o.x);
  const pick = (arr, n, exclude) => {
    const ex = new Set(exclude || []);
    return shuffle(arr.filter(x => !ex.has(x))).slice(0, n);
  };

  // ── 1. 본초 빈칸 (각 본초당 1장) ─────────────────────────────
  const comp = formula.composition || [];
  comp.forEach((herb, i) => {
    const base = normHerb(herb);
    // 같은 章의 다른 처방에서 본초 후보 추출 (난이도↑)
    const sameChapterHerbs = new Set();
    allFormulas.forEach(f => {
      if(f.chapter === formula.chapter && f.id !== formula.id){
        (f.composition || []).forEach(c => sameChapterHerbs.add(normHerb(c)));
      }
    });
    sameChapterHerbs.delete(base);
    comp.forEach(c => sameChapterHerbs.delete(normHerb(c)));
    let pool = Array.from(sameChapterHerbs);
    if(pool.length < 3){
      // 부족하면 HERBS 전체에서 보충
      const allHerbs = herbs.map(h => h.han).filter(h => !comp.includes(h) && h !== base);
      pool = pool.concat(shuffle(allHerbs).slice(0, 6));
    }
    const distractors = pick(pool, 3);
    const blanked = comp.map((c, j) => j === i ? '___' : c).join(' · ');
    const herbMeta = herbByHan.get(base);
    cards.push({
      type: 'blank_herb',
      label: '構成',
      prompt: `${formula.han} 構成 中 빈칸의 본초는?`,
      detail: blanked,
      answer: herb,
      options: shuffle([herb, ...distractors]),
      explain: herbMeta ? `<b>${herb}</b> (${herbMeta.ko}) — ${herbMeta.sm}<br>${herbMeta.meaning}` : herb,
    });
  });

  // ── 2. 君臣佐使 매칭 ─────────────────────────────────────
  if(formula.monarch_minister){
    const roles = ['君','臣','佐','使'];
    Object.entries(formula.monarch_minister).forEach(([role, hs]) => {
      (hs || []).forEach(h => {
        cards.push({
          type: 'monarch',
          label: '君臣佐使',
          prompt: `${formula.han} 에서 <b style="color:var(--zhusha-d)">${h}</b> 은(는) 어떤 役인가?`,
          detail: '',
          answer: role,
          options: roles.slice(),
          explain: `${formula.han} 君臣佐使<br>` + Object.entries(formula.monarch_minister)
            .map(([r, hh]) => `<b>${r}</b>: ${(hh||[]).join('·')}`).join(' / '),
        });
      });
    });
  }

  // ── 3. 主作用 ─────────────────────────────────────────
  if(formula.action){
    // 같은 章의 다른 처방 작용을 distractor 로
    const otherActions = allFormulas
      .filter(f => f.id !== formula.id && f.action)
      .map(f => f.action);
    cards.push({
      type: 'action',
      label: '作用',
      prompt: `${formula.han} 의 主作用은?`,
      detail: '',
      answer: formula.action,
      options: shuffle([formula.action, ...pick(otherActions, 3)]),
      explain: `<b>${formula.han}</b> = ${formula.action}<br><span style="color:var(--gutong);font-size:11px">主治: ${formula.indication || ''}</span>`,
    });
  }

  // ── 4. 主治 — indication 분석 (첫 「證」 또는 첫 구두점까지) ─────
  if(formula.indication){
    const firstSeg = formula.indication.split(/[.。·,，]/)[0].trim();
    if(firstSeg && firstSeg.length < 25){
      const others = allFormulas
        .filter(f => f.id !== formula.id && f.indication)
        .map(f => f.indication.split(/[.。·,，]/)[0].trim())
        .filter(s => s && s.length < 25 && s !== firstSeg);
      cards.push({
        type: 'indication',
        label: '主治',
        prompt: `${formula.han} 의 主治 证候는?`,
        detail: '',
        answer: firstSeg,
        options: shuffle([firstSeg, ...pick(others, 3)]),
        explain: `<b>${formula.han}</b>: ${formula.indication}`,
      });
    }
  }

  // ── 5. 加減 변환 (keyPoints 에서 +/-/→ 패턴 추출) ─────────────
  (formula.keyPoints || []).forEach(kp => {
    // 패턴: "+X·Y → ZZ방" 또는 "−X + Y = 본방"
    const m = kp.match(/([+−\-][^\s,，]+(?:[·,，][^\s,，]+)*)\s*[→=]\s*([^\s,，()]+)/);
    if(m){
      const change = m[1];
      const target = m[2];
      // distractor: 같은 章의 다른 처방명
      const otherNames = allFormulas
        .filter(f => f.id !== formula.id && f.chapter === formula.chapter)
        .map(f => f.han)
        .filter(n => n !== target);
      if(otherNames.length >= 3){
        cards.push({
          type: 'addition',
          label: '加減',
          prompt: `${formula.han} ${change} → ?`,
          detail: '',
          answer: target,
          options: shuffle([target, ...pick(otherNames, 3)]),
          explain: kp,
        });
      }
    }
  });

  // ── 6. 出典 ─────────────────────────────────────────────
  if(formula.source){
    const cleanSource = formula.source.split('—')[0].trim();
    const otherSources = Array.from(new Set(
      allFormulas
        .filter(f => f.id !== formula.id && f.source)
        .map(f => f.source.split('—')[0].trim())
        .filter(s => s && s !== cleanSource)
    ));
    if(otherSources.length >= 3){
      cards.push({
        type: 'source',
        label: '出典',
        prompt: `${formula.han} 의 出典은?`,
        detail: '',
        answer: cleanSource,
        options: shuffle([cleanSource, ...pick(otherSources, 3)]),
        explain: formula.source,
      });
    }
  }

  return shuffle(cards);
}

// 처방 드릴 세션 — bgm 영향 없음. setTab('quiz') 아닌 직접 view 렌더
function startFormulaDrill(formulaId){
  const allFormulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const formula = allFormulas.find(f => f.id === formulaId);
  if(!formula){ toast('처방을 찾을 수 없습니다'); return; }
  const cards = generateDrillCards(formula);
  if(!cards.length){ toast('드릴 카드를 생성할 수 없습니다'); return; }

  let cur = 0;
  let correct = 0;
  let answered = false;

  const render = () => {
    if(cur >= cards.length){
      // 결과 화면
      const pct = Math.round(correct / cards.length * 100);
      const grade = pct === 100 ? '滿點' : pct >= 80 ? '熟達' : pct >= 60 ? '習得' : pct >= 40 ? '練習中' : '初學';
      const gradeColor = pct >= 80 ? 'var(--feicui)' : pct >= 60 ? 'var(--huang)' : pct >= 40 ? 'var(--gutong)' : 'var(--zhusha)';
      view.innerHTML = `
        <h2 class="view-title fade-in"><span class="han">了</span>드릴 완료</h2>
        <div class="card imperial fade-in" style="text-align:center;padding:24px">
          <div class="han" style="font-size:36px;color:var(--zhusha-d);letter-spacing:.1em;margin-bottom:8px">${esc(formula.han)}</div>
          <div style="font-size:12px;color:var(--mo-l);margin-bottom:18px">${esc(formula.ko)} · ${esc(formula.chapter)}</div>
          <div style="font-family:var(--font-display);font-size:54px;color:${gradeColor};margin:6px 0">${grade}</div>
          <div style="font-size:22px;color:var(--mo);margin:6px 0"><b>${correct}</b> / ${cards.length}<span style="color:var(--gutong);font-size:14px"> (${pct}%)</span></div>
          <div style="margin-top:18px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-gold" onclick="startFormulaDrill('${esc(formulaId)}')">다시 드릴 (재셔플)</button>
            <button class="btn btn-o" onclick="openFormulaDeep('${esc(formula.han)}')">${esc(formula.han)} 심층</button>
            <button class="btn btn-o" onclick="setTab('stats')">사적 분석</button>
          </div>
        </div>`;
      // 마스터 표시
      if(pct === 100){
        S.masteredFormulas = S.masteredFormulas || [];
        if(!S.masteredFormulas.includes(formulaId)){
          S.masteredFormulas.push(formulaId);
          saveState();
          toast(`${formula.han} 滿點 마스터 등록`,'gold');
        }
      }
      return;
    }

    const c = cards[cur];
    answered = false;
    const progressPct = Math.round((cur / cards.length) * 100);
    view.innerHTML = `
      <h2 class="view-title fade-in">
        <span class="han">練</span>${esc(formula.han)} 드릴
        <span style="float:right;font-size:12px;color:var(--gutong);font-family:var(--font-body)">${cur+1} / ${cards.length}</span>
      </h2>
      <div class="drill-progress"><div class="drill-progress-fill" style="width:${progressPct}%"></div></div>
      <div class="card imperial fade-in" style="margin-top:10px">
        <div class="drill-label"><span class="han">${esc(c.label)}</span></div>
        <div class="drill-prompt">${c.prompt}</div>
        ${c.detail ? `<div class="drill-detail">${esc(c.detail)}</div>` : ''}
        <div class="drill-opts" id="drill-opts">
          ${c.options.map((o, i) => `
            <button class="drill-opt" data-idx="${i}" data-val="${esc(o)}">
              <span class="drill-opt-num">${i+1}</span>
              <span class="drill-opt-val">${esc(o)}</span>
            </button>`).join('')}
        </div>
        <div class="drill-feedback" id="drill-feedback" style="display:none"></div>
        <div style="margin-top:12px;text-align:center">
          <button class="btn btn-o btn-sm" onclick="setTab('stats')">중단 (사적 분석으로)</button>
        </div>
      </div>
    `;

    // 드릴 스타일 한 번 주입
    if(!document.getElementById('drill-style')){
      const st = document.createElement('style');
      st.id = 'drill-style';
      st.textContent = `
        .drill-progress{height:4px;background:var(--mi-d);border-radius:2px;overflow:hidden;margin-top:-4px}
        .drill-progress-fill{height:100%;background:linear-gradient(90deg,var(--feicui),var(--huang));transition:width .3s ease}
        .drill-label{font-family:var(--font-display);font-size:11px;color:var(--zhusha);letter-spacing:.1em;margin-bottom:6px}
        .drill-label .han{background:var(--zhusha);color:#FFF;padding:2px 8px;border-radius:3px;margin-right:6px}
        .drill-prompt{font-size:14.5px;color:var(--mo);line-height:1.6;margin-bottom:10px}
        .drill-prompt b{color:var(--zhusha-d)}
        .drill-detail{font-family:var(--font-han);font-size:16px;color:var(--zhusha-d);background:var(--mi-w);padding:10px 14px;border-radius:6px;border-left:3px solid var(--huang);margin-bottom:14px;letter-spacing:.05em;text-align:center}
        .drill-opts{display:flex;flex-direction:column;gap:6px}
        .drill-opt{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--mi-d);background:#FFF;border-radius:6px;cursor:pointer;font-family:var(--font-body);font-size:13.5px;color:var(--mo);text-align:left;transition:all .12s}
        .drill-opt:hover:not(.disabled){border-color:var(--huang);background:var(--mi-w)}
        .drill-opt.disabled{cursor:default;opacity:.85}
        .drill-opt.correct{border-color:var(--feicui);background:#E8F5E8}
        .drill-opt.wrong{border-color:var(--zhusha);background:#FDE8E8}
        .drill-opt-num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--mi-d);color:var(--gutong);font-family:var(--font-display);font-size:12px;font-weight:bold;flex:0 0 24px}
        .drill-opt.correct .drill-opt-num{background:var(--feicui);color:#FFF}
        .drill-opt.wrong .drill-opt-num{background:var(--zhusha);color:#FFF}
        .drill-opt-val{flex:1;font-family:var(--font-han);font-size:14px;color:var(--mo)}
        .drill-feedback{margin-top:12px;padding:10px 12px;border-radius:6px;font-size:12.5px;line-height:1.6}
        .drill-feedback.ok{background:#E8F5E8;color:#1A5A3A;border-left:3px solid var(--feicui)}
        .drill-feedback.no{background:#FDE8E8;color:#7A2424;border-left:3px solid var(--zhusha)}
        .drill-feedback b{color:inherit}
        .drill-next-btn{display:block;width:100%;margin-top:10px;padding:11px;font-family:var(--font-display);font-size:14px;letter-spacing:.1em}
      `;
      document.head.appendChild(st);
    }

    // 옵션 클릭 핸들러
    $$('#drill-opts .drill-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if(answered) return;
        answered = true;
        const picked = btn.dataset.val;
        const ok = picked === c.answer;
        if(ok) correct++;
        // 모든 옵션 disabled, 정/오답 색칠
        $$('#drill-opts .drill-opt').forEach(b => {
          b.classList.add('disabled');
          if(b.dataset.val === c.answer) b.classList.add('correct');
          else if(b === btn && !ok) b.classList.add('wrong');
        });
        // 피드백
        const fb = $('#drill-feedback');
        fb.style.display = '';
        fb.className = 'drill-feedback ' + (ok ? 'ok' : 'no');
        fb.innerHTML = `
          <div style="font-family:var(--font-display);font-size:13px;margin-bottom:4px">
            ${ok ? '<span class="han" style="color:var(--feicui)">正</span> 정답!' : '<span class="han" style="color:var(--zhusha)">誤</span> 오답'}
            ${!ok ? `<span style="margin-left:6px;color:inherit;font-size:11.5px">정답: <b>${esc(c.answer)}</b></span>` : ''}
          </div>
          <div>${c.explain || ''}</div>
        `;
        // 다음 버튼
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn drill-next-btn';
        nextBtn.textContent = cur + 1 >= cards.length ? '결과 보기 →' : `다음 (${cur+2} / ${cards.length}) →`;
        nextBtn.onclick = () => { cur++; render(); };
        fb.parentNode.appendChild(nextBtn);
      });
    });
  };

  render();
}
if(typeof window !== 'undefined') window.startFormulaDrill = startFormulaDrill;
// ═══════════════════════════════════════════════════════════════════════════
// v9.4 — 플래시카드 + 주관식 (Flashcard + Short Answer)
// ═══════════════════════════════════════════════════════════════════════════
// 구조:
//   renderFlashHub()              — 허브 화면 (모드 선택 + 진행도 요약)
//   startFlashFormula(scope)      — 처방 암기 카드 (조성/효능/주치/가감 順次)
//   startFlashAddition(scope, t)  — 가감 카드 (증상 → 가감약물). t='mc'|'sa'
//   startShortAnswer(scope)       — 주관식 (조성·효능·주치·군약·출전 입력)
// 채점:
//   normForGrade()        공백·구두점 제거, 한자 이체자 통일
//   normHerbToken(s)      본초 1개 정규화 (한자/한글/별칭 → 정식 한자명)
//   levenshtein(a, b)     편집 거리
//   parseHerbList(text)   입력 문자열 → 본초 토큰 배열 (구분자 무관)
//   gradeComposition()    조성 채점 (집합 비교 + 오타 허용)
//   gradeShortText()      단일 텍스트 채점 (정규화 + 오타 허용)
// ═══════════════════════════════════════════════════════════════════════════

// ─── 채점용 정규화 헬퍼 ───────────────────────────────────────────────
function normForGrade(s){
  return String(s||'')
    .replace(/[\s\u00A0\u2000-\u200B\u3000]/g, '')
    .replace(/[,，。·．\.、:：;；\/\\\-_~`'"!?！？…\u2022\u00B7]/g, '')
    .replace(/[\(\)（）\[\]【】「」『』〔〕]/g, '')
    .toLowerCase();
}

function normHerbToken(token){
  const cleaned = normForGrade(token);
  if(!cleaned) return '';
  const idx = (typeof HERB_NORM_INDEX !== 'undefined') ? HERB_NORM_INDEX : {};
  if(idx[cleaned]) return idx[cleaned];
  if(idx[token])   return idx[token];
  const stripped = String(token).replace(/[\(（][^\)）]*[\)）]/g, '').replace(/^炙/,'');
  if(idx[stripped]) return idx[stripped];
  const strippedClean = normForGrade(stripped);
  if(idx[strippedClean]) return idx[strippedClean];
  return cleaned;
}

function levenshtein(a, b){
  if(a === b) return 0;
  const m = a.length, n = b.length;
  if(!m) return n;
  if(!n) return m;
  let prev = new Array(n+1);
  for(let j=0; j<=n; j++) prev[j] = j;
  for(let i=1; i<=m; i++){
    const cur = new Array(n+1);
    cur[0] = i;
    for(let j=1; j<=n; j++){
      const cost = (a.charCodeAt(i-1) === b.charCodeAt(j-1)) ? 0 : 1;
      cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost);
    }
    prev = cur;
  }
  return prev[n];
}

function herbsMatch(userTok, correctTok){
  const u = normHerbToken(userTok);
  const c = normHerbToken(correctTok);
  if(!u || !c) return false;
  if(u === c) return true;
  // 1자 본초는 오타 허용 안 함
  if(c.length <= 1 || u.length <= 1) return false;
  // 정규화된 한자 레벨에서 1자 차이는 OK (간자체·번자체 이체자 흡수)
  if(levenshtein(u, c) <= 1) return true;
  // 별칭 레벨에서 같은-스크립트 1자 오타 허용 (예: 백출↔백술)
  // c는 정식 한자명, 그 별칭 배열에 대해 사용자 raw 입력을 비교
  const aliases = (typeof HERB_ALIASES !== 'undefined' && HERB_ALIASES[c]) || [];
  const userRaw = normForGrade(userTok);
  if(userRaw.length >= 2){
    for(const a of aliases){
      const ac = normForGrade(a);
      if(!ac || ac.length < 2) continue;
      if(userRaw === ac) return true;
      if(levenshtein(userRaw, ac) <= 1) return true;
    }
  }
  return false;
}

function parseHerbList(text){
  if(!text) return [];
  const rawTokens = String(text)
    .replace(/[\(（][^\)）]*[\)）]/g, '')
    .split(/[\s,，、·．\.\/\\\;；\+]+/)
    .map(t => t.trim())
    .filter(Boolean);
  if(rawTokens.length >= 2) return rawTokens;
  const idx = (typeof HERB_NORM_INDEX !== 'undefined') ? HERB_NORM_INDEX : {};
  const aliasKeys = Object.keys(idx).sort((a,b) => b.length - a.length);
  const blob = (rawTokens[0] || '').replace(/\s/g, '');
  const out = [];
  let rest = blob;
  let safety = 50;
  while(rest && safety-- > 0){
    let matched = null;
    for(const k of aliasKeys){ if(rest.startsWith(k)){ matched = k; break; } }
    if(matched){
      out.push(matched);
      rest = rest.slice(matched.length);
    } else {
      return rawTokens.length ? rawTokens : (blob ? [blob] : []);
    }
  }
  return out.length ? out : (rawTokens.length ? rawTokens : []);
}

function gradeComposition(userText, correctHerbs){
  const userTokens = parseHerbList(userText).map(normHerbToken).filter(Boolean);
  const userSet = Array.from(new Set(userTokens));
  const correct = (correctHerbs || []).map(h =>
    String(h).replace(/[\(（][^\)）]*[\)）]/g, '').replace(/^炙/, '').trim()
  ).map(normHerbToken).filter(Boolean);
  const correctSet = Array.from(new Set(correct));

  const hits = [];
  const missed = [];
  const matchedUserIdx = new Set();
  for(const c of correctSet){
    let found = -1;
    for(let i=0; i<userSet.length; i++){
      if(matchedUserIdx.has(i)) continue;
      if(herbsMatch(userSet[i], c)){ found = i; break; }
    }
    if(found >= 0){ hits.push(c); matchedUserIdx.add(found); }
    else missed.push(c);
  }
  const extras = userSet.filter((_, i) => !matchedUserIdx.has(i));
  const total = correctSet.length || 1;
  const score = hits.length / total;
  const ok = (missed.length === 0) && (extras.length === 0);
  return { ok, hits, missed, extras, score };
}

function gradeShortText(userText, correct){
  const u = normForGrade(userText);
  if(!u) return { ok:false, dist: Infinity };
  const candidates = Array.isArray(correct) ? correct : [correct];
  let best = { ok:false, dist: Infinity };
  for(const c of candidates){
    const cc = normForGrade(c);
    if(!cc) continue;
    if(u === cc){ return { ok:true, dist:0 }; }
    if(u.includes(cc) && cc.length >= 3){ return { ok:true, dist:0, partial:true }; }
    if(cc.includes(u) && u.length >= cc.length * 0.8){ return { ok:true, dist:0, partial:true }; }
    const tol = Math.max(1, Math.floor(cc.length * 0.15));
    const d = levenshtein(u, cc);
    if(d <= tol){ return { ok:true, dist:d }; }
    if(d < best.dist) best = { ok:false, dist:d, nearest:c };
  }
  return best;
}

window.normHerbToken = normHerbToken;
window.parseHerbList = parseHerbList;
window.gradeComposition = gradeComposition;
window.gradeShortText = gradeShortText;
window.levenshtein = levenshtein;

// ─── 플래시카드 / 주관식 공용 스타일 (1회만 주입) ──────────────────────
function _injectFlashStyles(){
  if(document.getElementById('flash-style')) return;
  const st = document.createElement('style');
  st.id = 'flash-style';
  st.textContent = `
    .flash-hub-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:8px}
    .flash-mode-tile{background:var(--mi-w);border:1.5px solid var(--zhusha);border-radius:10px;
                     padding:14px 12px;cursor:pointer;text-align:left;color:var(--mo);
                     transition:transform .12s, box-shadow .12s;position:relative;overflow:hidden;
                     font-family:var(--font-body);display:flex;flex-direction:column;gap:2px}
    .flash-mode-tile:hover{transform:translateY(-1px);box-shadow:var(--sh-sm)}
    .flash-mode-tile .ic{font-family:var(--font-display);font-size:20px;color:var(--zhusha);letter-spacing:.06em}
    .flash-mode-tile .ttl{font-size:14px;font-weight:700;margin-top:2px}
    .flash-mode-tile .desc{font-size:11.5px;color:var(--mo-l);margin-top:3px;line-height:1.4}
    .flash-mode-tile.wide{grid-column:1/-1}
    .flash-mode-tile.gold{background:linear-gradient(180deg,#FFF8DC 0%,#FFE08A 100%);border-color:var(--huang-d)}
    .flash-mode-tile.gold .ic{color:var(--zhusha-d)}
    .flash-progress{height:5px;background:var(--mi-d);border-radius:3px;overflow:hidden;margin:6px 0 14px}
    .flash-progress-fill{height:100%;background:linear-gradient(90deg,var(--feicui),var(--huang));transition:width .3s ease}
    .flash-card{background:var(--mi-w);border:1.5px solid var(--zhusha);border-radius:14px;
                padding:22px 18px;min-height:220px;box-shadow:var(--sh);position:relative;
                display:flex;flex-direction:column;justify-content:center}
    .flash-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;
                        background:linear-gradient(180deg,var(--huang),var(--zhusha),var(--huang));
                        border-radius:14px 0 0 14px}
    .flash-side-label{position:absolute;top:8px;right:14px;font-family:var(--font-display);
                      font-size:11px;color:var(--gutong);letter-spacing:.1em}
    .flash-name{font-family:var(--font-display);font-size:32px;color:var(--zhusha-d);
                text-align:center;letter-spacing:.08em;margin-bottom:6px;line-height:1.2}
    .flash-name-ko{text-align:center;font-size:13px;color:var(--mo-l);margin-bottom:8px;letter-spacing:.04em}
    .flash-name-sub{text-align:center;font-size:11px;color:var(--gutong);letter-spacing:.06em}
    .flash-q-label{display:inline-block;background:var(--zhusha);color:var(--huang-l);
                   padding:3px 12px;border-radius:14px;font-family:var(--font-display);
                   font-size:12px;letter-spacing:.08em;margin-bottom:10px}
    .flash-question{font-family:var(--font-han);font-size:16px;color:var(--mo);line-height:1.7;margin:6px 0}
    .flash-answer{font-family:var(--font-han);font-size:15.5px;color:var(--zhusha-d);
                  background:var(--mi);padding:12px 14px;border-radius:8px;
                  border-left:3px solid var(--huang);line-height:1.7;margin-top:8px}
    .flash-answer .ko{font-family:var(--font-body);font-size:13px;color:var(--mo-l);margin-top:6px;display:block;line-height:1.55}
    .flash-hint{text-align:center;color:var(--gutong);font-size:11.5px;margin:10px 0;letter-spacing:.04em}
    .flash-bottom{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;justify-content:center}
    .flash-bottom .btn{flex:1 1 auto;min-width:80px;font-size:13.5px;padding:10px}
    .flash-rate-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:14px}
    .flash-rate{padding:11px 6px;border:1.5px solid;border-radius:8px;cursor:pointer;
                background:transparent;font-family:var(--font-body);font-size:13px;font-weight:600;
                transition:transform .1s, background .1s;display:flex;flex-direction:column;align-items:center;gap:2px}
    .flash-rate:hover{transform:translateY(-1px)}
    .flash-rate .han{font-family:var(--font-display);font-size:16px;line-height:1}
    .flash-rate.again{border-color:var(--zhusha);color:var(--zhusha-d)}
    .flash-rate.again:hover{background:rgba(156,48,48,.08)}
    .flash-rate.hard{border-color:var(--gutong);color:var(--gutong)}
    .flash-rate.hard:hover{background:rgba(135,106,54,.08)}
    .flash-rate.easy{border-color:var(--feicui);color:var(--feicui)}
    .flash-rate.easy:hover{background:rgba(42,112,96,.08)}
    .flash-rate-hint{font-size:9.5px;opacity:.7;font-weight:400}
    .add-symptom{font-family:var(--font-han);font-size:21px;color:var(--zhusha-d);
                 text-align:center;letter-spacing:.05em;line-height:1.4;margin:6px 0 4px}
    .add-symptom-ko{text-align:center;font-size:12.5px;color:var(--mo-l);margin-bottom:8px;line-height:1.5}
    .add-formula-tag{display:inline-block;background:var(--huang);color:var(--mo);
                     padding:2px 10px;border-radius:10px;font-family:var(--font-display);
                     font-size:11.5px;letter-spacing:.05em;margin-bottom:10px}
    .sa-input{width:100%;min-height:64px;padding:10px 12px;border:1.5px solid var(--mi-d);
              border-radius:8px;font-family:var(--font-han);font-size:15px;line-height:1.55;
              background:#FFF;color:var(--mo);resize:vertical;outline:none}
    .sa-input:focus{border-color:var(--zhusha)}
    .sa-input.ok{border-color:var(--feicui);background:#F2F8F3}
    .sa-input.ng{border-color:var(--zhusha);background:#FDF1F1}
    .sa-feedback{margin-top:10px;padding:10px 12px;border-radius:8px;font-size:13px;line-height:1.6}
    .sa-feedback.ok{background:#E8F4E8;color:#1F5A3A;border-left:3px solid var(--feicui)}
    .sa-feedback.ng{background:#FBE8E8;color:#7A1818;border-left:3px solid var(--zhusha)}
    .sa-feedback .label{font-family:var(--font-display);font-size:12px;letter-spacing:.06em;display:block;margin-bottom:4px}
    .sa-feedback .han{font-family:var(--font-han);color:var(--zhusha-d);font-size:14px}
    .sa-feedback ul{margin:6px 0 0 16px;padding:0}
    .sa-feedback li{font-size:12.5px}
    .sa-hint{font-size:11px;color:var(--gutong);margin-top:4px}
    .flash-tabs{display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap}
    .flash-tab{padding:6px 12px;border:1.5px solid var(--mi-d);border-radius:14px;
               background:var(--mi-w);color:var(--mo-l);font-family:var(--font-body);font-size:12px;
               cursor:pointer;transition:all .12s;font-weight:600}
    .flash-tab.on{background:var(--zhusha);color:var(--huang-l);border-color:var(--zhusha-d)}
    .flash-tab:hover:not(.on){background:var(--mi);border-color:var(--gutong)}
    .flash-lang-toggle{display:inline-flex;background:var(--mi);border-radius:14px;padding:2px;border:1px solid var(--mi-d)}
    .flash-lang-toggle button{border:none;background:transparent;padding:4px 10px;font-size:11px;
                              color:var(--mo-l);cursor:pointer;border-radius:12px;font-family:var(--font-body);font-weight:600}
    .flash-lang-toggle button.on{background:var(--zhusha);color:var(--huang-l)}
    .sa-count-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:4px}
    .sa-count-btn{background:var(--mi-w);border:1.5px solid var(--gutong);border-radius:8px;
                  padding:10px 0;font-size:18px;font-weight:700;cursor:pointer;color:var(--mo);
                  font-family:var(--font-display);transition:all .15s;text-align:center}
    .sa-count-btn:hover{transform:translateY(-1px)}
    .sa-count-btn.on{background:var(--zhusha);color:var(--mi-w);border-color:var(--zhusha)}
  `;
  document.head.appendChild(st);
}

// ─── 플래시카드 허브 ──────────────────────────────────────────────────────
function renderFlashHub(){
  _injectFlashStyles();
  const formulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const additions = (typeof FORMULA_ADDITIONS !== 'undefined') ? FORMULA_ADDITIONS : {};
  if(!formulas.length){
    view.innerHTML = `
      <h2 class="view-title"><span class="han">卡</span>플래시카드</h2>
      <div class="card"><div style="text-align:center;color:var(--gutong);padding:24px;font-size:13px">
        <div class="han" style="font-size:24px;color:var(--zhusha-d);margin-bottom:8px">未充</div>
        data-formulas.js 의 FORMULAS 가 필요합니다
      </div></div>`;
    return;
  }
  const addItemCount = Object.values(additions).reduce((s, v) => s + (v.items ? v.items.length : 0), 0);
  const formulaCount = formulas.length;
  const easyCount = Object.values(S.flashRated || {}).filter(v => v === 'easy').length;
  const sa = S.shortAnswerStats || {ok:0, ng:0, qi:0};
  const total = (sa.ok || 0) + (sa.ng || 0);
  const acc = total ? Math.round((sa.ok / total) * 100) : 0;

  view.innerHTML = `
    <h2 class="view-title"><span class="han">卡</span>플래시카드·주관식</h2>
    <div class="view-sub">안 보고 외우기 + 주관식 채점 (오타·띄어쓰기 허용)</div>

    <div class="card imperial fade-in" style="padding:14px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:140px">
          <div class="card-title" style="margin:0"><span class="han">熟達</span> 학습 진행</div>
          <div style="font-size:12px;color:var(--mo-l);margin-top:3px;line-height:1.6">
            완전 익숙 <b style="color:var(--feicui)">${easyCount}</b> 카드 ·
            주관식 누적 <b style="color:var(--zhusha-d)">${total}</b>문
            ${total ? `(<span style="color:var(--feicui)">${acc}%</span> 정확도, +${sa.qi||0} 氣)` : ''}
          </div>
        </div>
        <div class="flash-lang-toggle" title="조성·효능 표시 언어">
          <button id="fl-lang-han" type="button" class="${S.flashLang==='han'?'on':''}">漢</button>
          <button id="fl-lang-ko" type="button" class="${S.flashLang==='ko'?'on':''}">한</button>
        </div>
      </div>
    </div>

    <div class="card fade-in">
      <div class="card-title"><span class="han">範圍</span> 범위 선택</div>
      <div class="flash-tabs" id="fl-scope-tabs">
        <button type="button" class="flash-tab on" data-s="all">전체 ${formulaCount}처방</button>
        <button type="button" class="flash-tab" data-s="8">8장 補益劑</button>
        <button type="button" class="flash-tab" data-s="7">7장 表裏雙解劑</button>
        <button type="button" class="flash-tab" data-s="bookmark">★ 북마크</button>
        <button type="button" class="flash-tab" data-s="weak">↻ 다시 보기·어려움</button>
      </div>
    </div>

    <div class="flash-hub-grid fade-in">
      <button class="flash-mode-tile wide gold" type="button" id="fl-mode-formula">
        <span class="ic">方·誦</span>
        <span class="ttl">처방 암기 카드</span>
        <span class="desc">처방명만 보고 → 조성·효능·주치를 順次로 떠올린 뒤 카드 펼침. 익숙/보통/다시 평가</span>
      </button>
      <button class="flash-mode-tile" type="button" id="fl-mode-addition">
        <span class="ic">加·症</span>
        <span class="ttl">가감 카드 (객관식)</span>
        <span class="desc">증상 보고 → 가감약물 4지선다. ${addItemCount}항</span>
      </button>
      <button class="flash-mode-tile" type="button" id="fl-mode-addition-sa">
        <span class="ic">加·書</span>
        <span class="ttl">가감 주관식</span>
        <span class="desc">증상 보고 → 가감약물 직접 입력 (오타 허용)</span>
      </button>
      <button class="flash-mode-tile wide" type="button" id="fl-mode-shortanswer">
        <span class="ic">問·書</span>
        <span class="ttl">주관식 문제 (정통 시험형)</span>
        <span class="desc">조성·효능·주치·군약·출전을 직접 입력. 띄어쓰기·오타 허용, 객관식 대비 2~5배 氣</span>
      </button>
    </div>

    <div class="card fade-in" style="margin-top:14px">
      <div class="card-title"><span class="han">指針</span> 사용 안내</div>
      <ul style="margin:0 0 0 18px;padding:0;font-size:12.5px;color:var(--mo-l);line-height:1.7">
        <li><b>처방 암기 카드</b>: 처방명만 노출 → 머리로 조성·효능·주치를 떠올린 뒤 카드를 펼쳐 비교</li>
        <li><b>가감 카드</b>: 「臍上動悸」 같은 증상 → 「加桂」 정답. 4지선다·즉시 해설</li>
        <li><b>가감 주관식</b>: 같은 내용 직접 입력. 한글·한자 모두 가능 (「계지」 = 「桂枝」)</li>
        <li><b>주관식 문제</b>: 「四君子湯의 조성을 모두 쓰시오」 같은 정통 시험형. 띄어쓰기 무관·1자 오타 허용</li>
        <li>학습 진행도·「다시 보기」 등급은 자동 저장 (다음 接속 시 이어보기 가능)</li>
      </ul>
    </div>
  `;

  let scope = 'all';
  $$('#fl-scope-tabs .flash-tab').forEach(b => b.addEventListener('click', () => {
    $$('#fl-scope-tabs .flash-tab').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    scope = b.dataset.s;
  }));
  $('#fl-lang-han').addEventListener('click', () => { S.flashLang = 'han'; saveState(); renderFlashHub(); });
  $('#fl-lang-ko').addEventListener('click',  () => { S.flashLang = 'ko';  saveState(); renderFlashHub(); });
  $('#fl-mode-formula').addEventListener('click',       () => startFlashFormula(scope));
  $('#fl-mode-addition').addEventListener('click',      () => startFlashAddition(scope, 'mc'));
  $('#fl-mode-addition-sa').addEventListener('click',   () => startFlashAddition(scope, 'sa'));
  $('#fl-mode-shortanswer').addEventListener('click',   () => startShortAnswer(scope));
}
if(typeof window !== 'undefined') window.renderFlashHub = renderFlashHub;

// ─── 범위 필터 헬퍼 ──────────────────────────────────────────────────────
function _filterFormulasByScope(scope){
  const all = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  if(scope === 'all' || !scope) return all;
  if(scope === 'bookmark'){
    const bm = new Set(S.bookmarks || []);
    return all.filter(f => bm.has(f.id));
  }
  if(scope === 'weak'){
    const rated = S.flashRated || {};
    return all.filter(f =>
      rated[`f:${f.id}`] === 'again' || rated[`f:${f.id}`] === 'hard'
    );
  }
  if(scope === '6' || scope === '7' || scope === '8'){
    return all.filter(f => String(f.chapter || '').startsWith(scope));
  }
  return all;
}

// ═══════════════════════════════════════════════════════════════════
// 모드 1: 처방 암기 카드 (처방명 → 조성 → 효능 → 주치 → 가감 → 평가)
// ═══════════════════════════════════════════════════════════════════
function startFlashFormula(scope){
  _injectFlashStyles();
  const pool = _filterFormulasByScope(scope);
  if(!pool.length){
    toast('해당 범위에 처방이 없습니다');
    renderFlashHub();
    return;
  }
  const cards = pool.slice().sort(() => Math.random() - 0.5);
  let idx = 0;
  let stage = 0;  // 0=처방명만, 1=조성, 2=효능, 3=주치, 4=가감, 5=평가
  const stageLabels = ['提示', '構成', '作用', '主治', '加減', '評價'];

  const render = () => {
    if(idx >= cards.length){
      view.innerHTML = `
        <h2 class="view-title fade-in"><span class="han">畢</span>암기 카드 완료</h2>
        <div class="card imperial" style="text-align:center;padding:24px">
          <div class="han" style="font-size:42px;color:var(--zhusha-d);margin-bottom:6px">熟</div>
          <div style="font-size:14px;color:var(--mo);margin-bottom:14px">
            ${cards.length}개 처방 카드를 모두 살펴봤습니다.<br>
            <span style="font-size:12px;color:var(--gutong)">「다시 보기」 평가한 카드는 「↻ 다시 보기·어려움」 범위에서 다시 만날 수 있어요</span>
          </div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <button class="btn" type="button" onclick="renderFlashHub()">허브로</button>
            <button class="btn btn-o" type="button" id="fl-replay">다시 한 사이클</button>
          </div>
        </div>`;
      $('#fl-replay').addEventListener('click', () => startFlashFormula(scope));
      return;
    }

    const f = cards[idx];
    const progress = Math.round((idx / cards.length) * 100);
    const stageLabel = stageLabels[stage] || '?';
    const lang = S.flashLang || 'han';
    const composition = (f.composition || []).map(h => String(h).replace(/[\(（][^\)）]*[\)）]/g, '').trim());
    const compStr = composition.join(' · ');
    const compStrKo = composition.map(h => {
      const norm = (typeof HERB_NORM_INDEX !== 'undefined' && HERB_NORM_INDEX[h]) || h;
      const meta = (typeof HERBS !== 'undefined') ? HERBS.find(x => x.han === norm) : null;
      return meta && meta.ko ? meta.ko : h;
    }).join(' · ');
    const additionEntry = (typeof FORMULA_ADDITIONS !== 'undefined') && FORMULA_ADDITIONS[f.id];
    const hasAdditions = additionEntry && (additionEntry.items || []).length > 0;

    let cardBody = '';
    if(stage === 0){
      cardBody = `
        <div class="flash-side-label">${stageLabel}</div>
        <div class="flash-name">${esc(f.han || '?')}</div>
        <div class="flash-name-ko">${esc(f.ko || '')}</div>
        <div class="flash-name-sub">${esc(f.chapter || '')} · ${esc(f.source || '')}</div>
        <div class="flash-hint" style="margin-top:18px">머릿속으로 <b>조성·효능·주치·가감</b>을 떠올려 보세요</div>
      `;
    } else if(stage === 1){
      cardBody = `
        <div class="flash-side-label">${stageLabel}</div>
        <div class="flash-name" style="font-size:22px">${esc(f.han || '')}</div>
        <div class="flash-q-label">構成 (${composition.length}味)</div>
        <div class="flash-answer">
          ${esc(lang === 'ko' ? compStrKo : compStr)}
          ${lang !== 'ko' ? `<span class="ko">${esc(compStrKo)}</span>` : ''}
        </div>
      `;
    } else if(stage === 2){
      cardBody = `
        <div class="flash-side-label">${stageLabel}</div>
        <div class="flash-name" style="font-size:22px">${esc(f.han || '')}</div>
        <div class="flash-q-label">作用·效能</div>
        <div class="flash-answer">${esc(f.action || '(데이터 없음)')}</div>
      `;
    } else if(stage === 3){
      cardBody = `
        <div class="flash-side-label">${stageLabel}</div>
        <div class="flash-name" style="font-size:22px">${esc(f.han || '')}</div>
        <div class="flash-q-label">適應症·主治</div>
        <div class="flash-answer">${esc(f.indication || '(데이터 없음)')}</div>
      `;
    } else if(stage === 4){
      if(hasAdditions){
        const lines = additionEntry.items.map(it => `
          <div style="margin:8px 0;padding:8px 10px;background:var(--mi-w);border-radius:6px;border-left:2px solid var(--huang)">
            <div style="font-family:var(--font-han);font-size:13.5px;color:var(--zhusha-d)">${esc(it.symptom || '')}</div>
            <div style="font-size:11.5px;color:var(--mo-l);margin-top:2px">${esc(it.symptomKo || '')}</div>
            <div style="font-family:var(--font-han);font-size:13px;color:var(--mo);margin-top:4px"><b>→</b> ${esc(it.mod || '')}</div>
          </div>
        `).join('');
        cardBody = `
          <div class="flash-side-label">${stageLabel}</div>
          <div class="flash-name" style="font-size:22px">${esc(f.han || '')}</div>
          <div class="flash-q-label">加減法</div>
          <div style="margin-top:6px">${lines}</div>
        `;
      } else {
        cardBody = `
          <div class="flash-side-label">${stageLabel}</div>
          <div class="flash-name" style="font-size:22px">${esc(f.han || '')}</div>
          <div class="flash-q-label">加減法</div>
          <div class="flash-hint" style="margin:14px 0">이 처방은 구조화된 가감 데이터가 없어요 — 핵심 포인트로 대체:</div>
          <ul style="margin:0 0 0 18px;font-size:12.5px;color:var(--mo-l);line-height:1.7">
            ${(f.keyPoints || []).slice(0, 4).map(k => `<li>${esc(k)}</li>`).join('')}
          </ul>
        `;
      }
    } else {
      cardBody = `
        <div class="flash-side-label">${stageLabel}</div>
        <div class="flash-name" style="font-size:24px">${esc(f.han || '')}</div>
        <div class="flash-name-ko">${esc(f.ko || '')} · ${esc(f.chapter || '')}</div>
        <div class="flash-hint" style="margin-top:8px">이 처방, 얼마나 익숙해요?</div>
        <div class="flash-rate-grid">
          <button class="flash-rate again" type="button" data-r="again">
            <span class="han">復</span>다시 보기
            <span class="flash-rate-hint">아직 헷갈림</span>
          </button>
          <button class="flash-rate hard" type="button" data-r="hard">
            <span class="han">難</span>보통
            <span class="flash-rate-hint">조금 더 연습</span>
          </button>
          <button class="flash-rate easy" type="button" data-r="easy">
            <span class="han">熟</span>익숙
            <span class="flash-rate-hint">완전 익혔음</span>
          </button>
        </div>
      `;
    }

    view.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <button class="btn btn-sm btn-ghost" type="button" onclick="renderFlashHub()">← 허브</button>
        <span style="margin-left:auto;font-size:12px;color:var(--gutong)">${idx+1} / ${cards.length}</span>
      </div>
      <div class="flash-progress"><div class="flash-progress-fill" style="width:${progress}%"></div></div>
      <div class="flash-card fade-in" id="flash-card">${cardBody}</div>
      <div class="flash-bottom">
        ${stage > 0 ? '<button class="btn btn-o" type="button" id="fl-prev">← 이전 단계</button>' : ''}
        ${stage < 5 ? `<button class="btn" type="button" id="fl-next">${stage === 0 ? '카드 펼치기 →' : (stage === 4 ? '평가 →' : '다음 →')}</button>` : ''}
        ${stage === 5 ? '<button class="btn btn-ghost" type="button" id="fl-skip">평가 건너뛰기</button>' : ''}
      </div>
    `;

    if(stage > 0){
      const prev = $('#fl-prev'); if(prev) prev.addEventListener('click', () => { stage--; render(); });
    }
    if(stage < 5){
      const next = $('#fl-next'); if(next) next.addEventListener('click', () => { stage++; render(); });
    }
    if(stage === 5){
      const skip = $('#fl-skip');
      if(skip) skip.addEventListener('click', () => { idx++; stage = 0; render(); });
      $$('.flash-rate').forEach(b => b.addEventListener('click', () => {
        const r = b.dataset.r;
        S.flashRated = S.flashRated || {};
        const prevRating = S.flashRated[`f:${f.id}_prev`];
        S.flashRated[`f:${f.id}`] = r;
        if(r === 'easy' && prevRating !== 'easy'){
          S.qi = (S.qi || 0) + 5;
        }
        S.flashRated[`f:${f.id}_prev`] = r;
        saveState();
        try{ refreshHeader(); }catch(_){}
        try{
          if(typeof bgm !== 'undefined'){
            if(r === 'easy' && bgm.sfxCorrect) bgm.sfxCorrect();
            else if(r === 'again' && bgm.sfxWrong) bgm.sfxWrong();
          }
        }catch(_){}
        idx++; stage = 0; render();
      }));
    }
  };

  render();
}
if(typeof window !== 'undefined') window.startFlashFormula = startFlashFormula;

// ═══════════════════════════════════════════════════════════════════
// 모드 2: 가감 카드 (증상 → 가감약물)
// ═══════════════════════════════════════════════════════════════════
function startFlashAddition(scope, type){
  _injectFlashStyles();
  type = type || 'mc';
  const additions = (typeof FORMULA_ADDITIONS !== 'undefined') ? FORMULA_ADDITIONS : {};
  const allFormulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const formulaById = {};
  allFormulas.forEach(f => { formulaById[f.id] = f; });
  const scopeFormulas = _filterFormulasByScope(scope);
  const scopeIds = new Set(scopeFormulas.map(f => f.id));

  const allItems = [];
  for(const [fid, entry] of Object.entries(additions)){
    if(!scopeIds.has(fid)) continue;
    (entry.items || []).forEach((it, i) => {
      if((!it.herbs || !it.herbs.length) && !it.target) return;
      allItems.push({ ...it, formulaId: fid, idxInF: i });
    });
  }

  if(!allItems.length){
    toast('해당 범위에 가감 데이터가 없습니다');
    renderFlashHub();
    return;
  }

  const allHerbs = (typeof HERBS !== 'undefined' && HERBS.length)
    ? HERBS.map(h => h.han)
    : Object.keys((typeof HERB_NORM_INDEX !== 'undefined') ? HERB_NORM_INDEX : {});

  const items = allItems.slice().sort(() => Math.random() - 0.5);
  let idx = 0;
  let correctCount = 0;
  const startedAt = Date.now();

  const render = () => {
    if(idx >= items.length){
      const earned = correctCount * 4;
      S.qi = (S.qi || 0) + earned;
      // 가감 주관식이면 shortAnswerStats에도 누적
      if(type === 'sa'){
        S.shortAnswerStats.ok = (S.shortAnswerStats.ok || 0) + correctCount;
        S.shortAnswerStats.ng = (S.shortAnswerStats.ng || 0) + (items.length - correctCount);
        S.shortAnswerStats.qi = (S.shortAnswerStats.qi || 0) + earned;
      }
      saveState();
      try{ refreshHeader(); }catch(_){}
      view.innerHTML = `
        <h2 class="view-title fade-in"><span class="han">畢</span>가감 카드 완료</h2>
        <div class="card imperial" style="text-align:center;padding:24px">
          <div class="seal" style="font-size:42px;color:var(--zhusha-d);line-height:1">${correctCount}<span style="font-size:24px;opacity:.6">/${items.length}</span></div>
          <div style="margin-top:8px;font-size:14px;color:var(--feicui);font-weight:600">+${earned} 氣</div>
          <div style="margin-top:6px;font-size:11px;color:var(--gutong)">${Math.round((Date.now()-startedAt)/1000)}초 소요</div>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">
          <button class="btn" type="button" onclick="renderFlashHub()">허브로</button>
          <button class="btn btn-o" type="button" id="fl-add-again">다시</button>
        </div>`;
      $('#fl-add-again').addEventListener('click', () => startFlashAddition(scope, type));
      return;
    }

    const item = items[idx];
    const f = formulaById[item.formulaId] || {};
    const progress = Math.round((idx / items.length) * 100);
    const correctHerbs = (item.herbs || []).slice();
    const correctTarget = item.target || null;

    let mcOptions = [];
    let mcAnswerIdx = -1;
    if(type === 'mc'){
      let correctOpt;
      if(correctHerbs.length){
        correctOpt = correctHerbs.join('·');
      } else if(correctTarget){
        correctOpt = correctTarget;
      } else {
        correctOpt = item.mod;
      }
      const distractorPool = new Set();
      if(correctHerbs.length){
        const sameF = (additions[item.formulaId] && additions[item.formulaId].items) || [];
        sameF.forEach(o => {
          if(o === item) return;
          if(o.herbs && o.herbs.length){
            distractorPool.add(o.herbs.join('·'));
          }
        });
        const samples = allHerbs.filter(h => !correctHerbs.includes(h))
          .sort(() => Math.random() - 0.5).slice(0, 30);
        for(let i = 0; i < 20 && distractorPool.size < 8; i++){
          const n = Math.max(1, Math.min(correctHerbs.length, 2));
          const picks = samples.slice(i*n, i*n + n);
          if(picks.length === n) distractorPool.add(picks.join('·'));
        }
      } else if(correctTarget){
        allFormulas.filter(x => x.id !== f.id && x.chapter === f.chapter)
          .forEach(x => distractorPool.add(x.han));
      }
      distractorPool.delete(correctOpt);
      const distractors = Array.from(distractorPool).sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = [correctOpt, ...distractors].sort(() => Math.random() - 0.5);
      mcOptions = opts;
      mcAnswerIdx = opts.indexOf(correctOpt);
    }

    view.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <button class="btn btn-sm btn-ghost" type="button" onclick="renderFlashHub()">← 허브</button>
        <span style="margin-left:auto;font-size:12px;color:var(--gutong)">${idx+1} / ${items.length}</span>
      </div>
      <div class="flash-progress"><div class="flash-progress-fill" style="width:${progress}%"></div></div>
      <div class="flash-card fade-in">
        <div class="flash-side-label">${type==='mc'?'加減·객':'加減·서'}</div>
        <div style="text-align:center"><span class="add-formula-tag">${esc(f.han || '?')}</span></div>
        <div class="add-symptom">${esc(item.symptom || '')}</div>
        <div class="add-symptom-ko">${esc(item.symptomKo || '')}</div>
        <div class="flash-q-label" style="display:block;margin:8px auto 4px;text-align:center;width:fit-content">
          ${type === 'mc' ? '↓ 가감약물을 고르세요' : '↓ 가감약물을 적으세요'}
        </div>
        <div id="add-answer-area"></div>
      </div>
    `;

    const ansArea = $('#add-answer-area');
    if(type === 'mc'){
      ansArea.innerHTML = mcOptions.map((opt, i) => `
        <button class="btn btn-o quiz-opt" type="button" style="display:block;width:100%;margin:6px 0;text-align:left;padding:10px 12px;white-space:normal;line-height:1.45;font-family:var(--font-han);font-size:15px" data-i="${i}">
          <span class="han" style="color:var(--zhusha-d);margin-right:8px;font-weight:700">${'甲乙丙丁戊'[i]||(i+1)}</span>${esc(opt)}
        </button>
      `).join('');
      $$('.quiz-opt').forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        const correct = (i === mcAnswerIdx);
        if(correct) correctCount++;
        try{
          if(typeof bgm !== 'undefined'){
            if(correct && bgm.sfxCorrect) bgm.sfxCorrect();
            else if(!correct && bgm.sfxWrong) bgm.sfxWrong();
          }
        }catch(_){}
        $$('.quiz-opt').forEach(x => {
          x.disabled = true;
          if(+x.dataset.i === mcAnswerIdx){ x.style.background='var(--feicui)'; x.style.color='var(--mi-w)'; x.style.borderColor='transparent'; }
          if(+x.dataset.i === i && !correct){ x.style.background='var(--zhusha)'; x.style.color='var(--mi-w)'; x.style.borderColor='transparent'; }
        });
        const noteDiv = document.createElement('div');
        noteDiv.style.cssText = 'margin-top:10px;padding:10px;background:var(--mi);border-radius:6px;font-size:12.5px;color:var(--mo);line-height:1.55';
        noteDiv.innerHTML = `
          <b style="color:var(--zhusha-d)">機轉</b> ${esc(item.note || '(설명 없음)')}<br>
          <span class="han" style="color:var(--mo-l);font-size:12px">정답 ${esc(item.mod || '')}</span>
          ${item.remove ? `<br><span style="color:var(--gutong);font-size:11.5px">去: ${esc(item.remove.join('·'))}</span>`:''}
        `;
        ansArea.appendChild(noteDiv);
        const nx = document.createElement('button');
        nx.className = 'btn';
        nx.type = 'button';
        nx.style.cssText = 'display:block;width:100%;margin-top:10px;padding:10px';
        nx.textContent = idx + 1 >= items.length ? '결과 보기 →' : '다음 →';
        nx.onclick = () => { idx++; render(); };
        ansArea.appendChild(nx);
      }));
    } else {
      // 주관식
      ansArea.innerHTML = `
        <textarea class="sa-input" id="add-sa-input" placeholder="예: 桂枝 / 桂枝·茯苓 / 계지, 복령 (한글·한자 모두 가능, 순서 무관)" autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
        <div class="sa-hint">${correctHerbs.length || '?'}개 가감약물 입력 ${item.remove ? ` · 「去」 약물은 적지 않아도 됩니다` : ''}</div>
        <button class="btn" type="button" id="add-sa-submit" style="display:block;width:100%;margin-top:10px;padding:10px">제출 →</button>
        <div id="add-sa-fb"></div>
      `;
      const ta = $('#add-sa-input');
      const fb = $('#add-sa-fb');
      try{ ta.focus(); }catch(_){}
      const submit = () => {
        if(ta.disabled) return;
        const text = ta.value;
        // herbs가 비고 target만 있는 경우는 처방명 채점으로
        const result = correctHerbs.length
          ? gradeComposition(text, correctHerbs)
          : { ok: gradeShortText(text, correctTarget || item.mod).ok, hits: [], missed: [correctTarget || item.mod], extras: [] };
        ta.classList.remove('ok','ng');
        ta.classList.add(result.ok ? 'ok' : 'ng');
        ta.disabled = true;
        $('#add-sa-submit').disabled = true;
        if(result.ok) correctCount++;
        try{
          if(typeof bgm !== 'undefined'){
            if(result.ok && bgm.sfxCorrect) bgm.sfxCorrect();
            else if(!result.ok && bgm.sfxWrong) bgm.sfxWrong();
          }
        }catch(_){}
        const missedStr = (result.missed && result.missed.length) ? `<li>맞히지 못한 본초: <span class="han">${esc(result.missed.join('·'))}</span></li>` : '';
        const extrasStr = (result.extras && result.extras.length) ? `<li>잘못 적은 본초: <span class="han">${esc(result.extras.join('·'))}</span></li>` : '';
        const correctStr = correctHerbs.length ? correctHerbs.join('·') : (correctTarget || item.mod || '?');
        fb.innerHTML = `
          <div class="sa-feedback ${result.ok?'ok':'ng'}">
            <span class="label">${result.ok ? '✓ 정답' : '× 오답'}</span>
            <b style="color:var(--zhusha-d)">정답</b> <span class="han">${esc(correctStr)}</span>
            ${item.remove ? `<br><span style="font-size:11.5px;color:var(--gutong)">去: ${esc(item.remove.join('·'))}</span>`:''}
            ${(missedStr||extrasStr) ? `<ul>${missedStr}${extrasStr}</ul>` : ''}
            <div style="margin-top:6px;font-size:12.5px"><b>機轉</b> ${esc(item.note || '')}</div>
          </div>
          <button class="btn" type="button" id="add-sa-next" style="display:block;width:100%;margin-top:10px;padding:10px">${idx+1>=items.length?'결과 →':'다음 →'}</button>
        `;
        $('#add-sa-next').addEventListener('click', () => { idx++; render(); });
      };
      $('#add-sa-submit').addEventListener('click', submit);
      ta.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)){ e.preventDefault(); submit(); }
      });
    }
  };

  render();
}
if(typeof window !== 'undefined') window.startFlashAddition = startFlashAddition;

// ═══════════════════════════════════════════════════════════════════
// 모드 3: 주관식 문제 (조성·효능·주치·군약·출전 직접 입력)
// 점수: 객관식 대비 2~5배. 조성 15·효능/주치 10·군약 8·출전 6 氣/문
// ═══════════════════════════════════════════════════════════════════
function startShortAnswer(scope){
  _injectFlashStyles();
  const formulas = _filterFormulasByScope(scope);
  if(!formulas.length){ toast('해당 범위에 처방이 없습니다'); renderFlashHub(); return; }

  const buildQuestions = () => {
    const out = [];
    formulas.forEach(f => {
      if((f.composition || []).length){
        out.push({
          type: 'composition', fid: f.id, formula: f,
          prompt: `<b>${esc(f.han)}</b> (${esc(f.ko)})의 <b>구성 본초</b>를 모두 적으시오 (순서 무관, 한자·한글 모두 가능)`,
          hint: `${f.composition.length}味. 띄어쓰기·쉼표 무관, 1자 오타까지 허용`,
          correctHerbs: f.composition,
          points: 15,
        });
      }
      if(f.action){
        out.push({
          type: 'action', fid: f.id, formula: f,
          prompt: `<b>${esc(f.han)}</b>의 <b>효능(작용)</b>을 적으시오`,
          hint: '예: 益氣健脾 / 補氣生血 / 溫中補虛 등',
          correct: f.action,
          points: 10,
        });
      }
      if(f.indication){
        const m = f.indication.match(/^([^.。·,，()\n]{2,16}證|[^.。·,，()\n]{2,16}病)/);
        const firstSeg = m ? m[1].trim() : f.indication.split(/[.。·,，\n]/)[0].trim();
        if(firstSeg && firstSeg.length <= 20){
          out.push({
            type: 'indication', fid: f.id, formula: f,
            prompt: `<b>${esc(f.han)}</b>의 <b>主治證</b>의 명칭은? (證 이름)`,
            hint: '예: 脾胃氣虛證, 血虛陽浮發熱證 등',
            correct: firstSeg,
            points: 10,
          });
        }
      }
      if(f.monarch_minister && f.monarch_minister['君']){
        const monarchs = f.monarch_minister['君'];
        if(monarchs.length){
          out.push({
            type: 'monarch', fid: f.id, formula: f,
            prompt: `<b>${esc(f.han)}</b>의 <b>君藥</b>은? ${monarchs.length > 1 ? `(${monarchs.length}味)` : ''}`,
            hint: monarchs.length > 1 ? `${monarchs.length}개 모두 적어주세요` : '1味',
            correctHerbs: monarchs,
            points: 8,
            asList: true,
          });
        }
      }
      if(f.source){
        const src = f.source.split(/[—\(（]/)[0].trim();
        if(src && src.length <= 14){
          out.push({
            type: 'source', fid: f.id, formula: f,
            prompt: `<b>${esc(f.han)}</b>의 <b>出典</b>은?`,
            hint: '예: 傷寒論, 太平惠民和劑局方, 脾胃論 등',
            correct: src,
            points: 6,
          });
        }
      }
    });
    return out;
  };

  const allQuestions = buildQuestions();
  if(!allQuestions.length){ toast('주관식 문제를 만들 수 없습니다'); renderFlashHub(); return; }

  view.innerHTML = `
    <button class="btn btn-sm btn-ghost" type="button" onclick="renderFlashHub()">← 허브</button>
    <h2 class="view-title fade-in"><span class="han">問</span>주관식 문제</h2>
    <div class="view-sub">조성·효능·주치·군약·출전 직접 입력 · 띄어쓰기·오타 허용</div>

    <div class="card fade-in">
      <div class="card-title"><span class="han">出題</span> 문제 유형 선택</div>
      <div class="flash-tabs" id="sa-type-tabs">
        <button type="button" class="flash-tab on" data-t="all">전체 (${allQuestions.length}문)</button>
        <button type="button" class="flash-tab" data-t="composition">조성만</button>
        <button type="button" class="flash-tab" data-t="action">효능만</button>
        <button type="button" class="flash-tab" data-t="indication">주치만</button>
        <button type="button" class="flash-tab" data-t="monarch">군약만</button>
        <button type="button" class="flash-tab" data-t="source">출전만</button>
      </div>
    </div>

    <div class="card fade-in">
      <div class="card-title"><span class="han">數</span> 문제수</div>
      <div class="sa-count-grid" id="sa-count-grid">
        ${[3,5,10,20].map((n, i) => `
          <button type="button" class="sa-count-btn ${i===1?'on':''}" data-n="${n}">${n}<span style="font-size:10px;color:var(--gutong);margin-left:2px">문</span></button>
        `).join('')}
      </div>
    </div>

    <div class="card fade-in">
      <div class="card-title"><span class="han">配点</span> 점수 안내</div>
      <ul style="margin:0 0 0 18px;padding:0;font-size:12px;color:var(--mo-l);line-height:1.7">
        <li>조성 (구성 본초 전체) — <b style="color:var(--zhusha-d)">15 氣 / 문</b> · 모두 맞춰야 만점</li>
        <li>효능·주치 — <b style="color:var(--zhusha-d)">10 氣 / 문</b></li>
        <li>군약 — <b style="color:var(--zhusha-d)">8 氣 / 문</b></li>
        <li>출전 — <b style="color:var(--zhusha-d)">6 氣 / 문</b></li>
        <li>객관식(2~3 氣) 대비 약 <b>2~5배</b>. 조성·군약은 부분점수 가능</li>
      </ul>
    </div>

    <button class="btn btn-lg" type="button" style="display:block;width:100%;margin-top:14px;padding:13px;font-size:16px" id="sa-start">
      <span class="han" style="margin-right:6px">始</span>시작
    </button>
  `;

  let filterType = 'all';
  let count = 5;
  $$('#sa-type-tabs .flash-tab').forEach(b => b.addEventListener('click', () => {
    $$('#sa-type-tabs .flash-tab').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    filterType = b.dataset.t;
  }));
  $$('#sa-count-grid .sa-count-btn').forEach(b => b.addEventListener('click', () => {
    $$('#sa-count-grid .sa-count-btn').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    count = +b.dataset.n;
  }));

  $('#sa-start').addEventListener('click', () => {
    const pool = (filterType === 'all')
      ? allQuestions
      : allQuestions.filter(q => q.type === filterType);
    if(!pool.length){
      toast('선택한 유형의 문제가 없습니다');
      return;
    }
    const session = pool.slice().sort(() => Math.random() - 0.5).slice(0, count);
    runShortAnswerSession(session, scope);
  });
}
if(typeof window !== 'undefined') window.startShortAnswer = startShortAnswer;

// ─── 주관식 세션 실행 ──────────────────────────────────────────────────
function runShortAnswerSession(questions, returnScope){
  let idx = 0;
  let totalPoints = 0;
  let earned = 0;
  let okCount = 0;
  const results = [];   // {q, ok, score, userText}
  const startedAt = Date.now();

  const render = () => {
    if(idx >= questions.length){
      // 결과 화면
      const totalAvail = questions.reduce((s, q) => s + (q.points || 10), 0);
      const pct = totalAvail ? Math.round((earned / totalAvail) * 100) : 0;
      const grade = pct >= 90 ? '甲' : pct >= 75 ? '乙' : pct >= 60 ? '丙' : pct >= 40 ? '丁' : '戊';
      const gradeColor = pct >= 75 ? 'var(--feicui)' : pct >= 50 ? 'var(--huang-d)' : 'var(--zhusha)';
      S.qi = (S.qi || 0) + earned;
      S.shortAnswerStats.ok = (S.shortAnswerStats.ok || 0) + okCount;
      S.shortAnswerStats.ng = (S.shortAnswerStats.ng || 0) + (questions.length - okCount);
      S.shortAnswerStats.qi = (S.shortAnswerStats.qi || 0) + earned;
      saveState();
      try{ refreshHeader(); }catch(_){}
      view.innerHTML = `
        <h2 class="view-title fade-in"><span class="han">果</span>주관식 결과</h2>
        <div class="card imperial fade-in" style="text-align:center;padding:24px">
          <div style="font-family:var(--font-display);font-size:54px;color:${gradeColor};line-height:1">${grade}</div>
          <div style="font-size:18px;color:var(--mo);margin-top:8px"><b>${earned}</b> / ${totalAvail} 氣 (${pct}%)</div>
          <div style="font-size:12px;color:var(--gutong);margin-top:4px">${okCount} / ${questions.length} 문항 완답 · ${Math.round((Date.now()-startedAt)/1000)}초</div>
        </div>
        <div class="card fade-in">
          <div class="card-title"><span class="han">細目</span> 문항별 결과</div>
          ${results.map((r, i) => {
            const f = r.q.formula;
            const okIcon = r.ok ? '<span style="color:var(--feicui);font-weight:700">✓</span>' : '<span style="color:var(--zhusha);font-weight:700">×</span>';
            return `
              <div style="padding:8px 0;border-bottom:1px dashed var(--mi-d);font-size:12.5px">
                <div>${okIcon} <b>${esc(f.han)}</b> <span style="color:var(--gutong);font-size:11px">${esc(r.q.type)}</span>
                  <span style="float:right;color:${r.ok?'var(--feicui)':'var(--gutong)'};font-weight:600">+${r.earned} 氣</span></div>
                <div style="color:var(--mo-l);font-size:11.5px;margin-top:2px">정답: <span class="han" style="color:var(--zhusha-d)">${esc(r.correctText || '')}</span></div>
              </div>
            `;
          }).join('')}
        </div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap">
          <button class="btn" type="button" onclick="renderFlashHub()">허브로</button>
          <button class="btn btn-o" type="button" id="sa-again">같은 범위로 다시</button>
        </div>
      `;
      $('#sa-again').addEventListener('click', () => startShortAnswer(returnScope));
      return;
    }

    const q = questions[idx];
    const progress = Math.round((idx / questions.length) * 100);
    const isList = q.correctHerbs;
    const placeholder = isList
      ? '예: 人蔘, 白朮, 茯苓, 甘草 / 인삼 백출 복령 감초 (순서·구분자 무관)'
      : '예: 益氣健脾 (간결하게)';
    const minHeight = isList ? '80px' : '56px';

    view.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <button class="btn btn-sm btn-ghost" type="button" onclick="renderFlashHub()">← 허브</button>
        <span style="margin-left:auto;font-size:12px;color:var(--gutong)">${idx+1} / ${questions.length} · 누적 +${earned} 氣</span>
      </div>
      <div class="flash-progress"><div class="flash-progress-fill" style="width:${progress}%"></div></div>
      <div class="sa-card fade-in" style="background:var(--mi-w);border:1.5px solid var(--zhusha);border-radius:12px;padding:18px 16px;box-shadow:var(--sh-sm)">
        <div style="font-size:11px;color:var(--gutong);font-family:var(--font-display);letter-spacing:.08em;margin-bottom:8px">
          ${esc(({composition:'構成', action:'作用·效能', indication:'適應症·主治', monarch:'君藥', source:'出典'})[q.type] || '問')}
          <span style="background:var(--huang);color:var(--mo);padding:1px 8px;border-radius:8px;font-size:11px;font-weight:700;margin-left:6px">${q.points} 氣</span>
        </div>
        <div style="font-family:var(--font-han);font-size:15.5px;color:var(--mo);line-height:1.7;margin-bottom:8px">${q.prompt}</div>
        <textarea class="sa-input" id="sa-input" style="min-height:${minHeight}" placeholder="${esc(placeholder)}" autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
        <div class="sa-hint">${esc(q.hint)}</div>
        <button class="btn" type="button" id="sa-submit" style="display:block;width:100%;margin-top:10px;padding:10px">제출 →</button>
        <div id="sa-fb"></div>
      </div>
    `;

    const ta = $('#sa-input');
    const fb = $('#sa-fb');
    try{ ta.focus(); }catch(_){}

    const submit = () => {
      if(ta.disabled) return;
      const text = ta.value;
      let result, correctText, gainedRatio = 0;
      if(q.correctHerbs){
        result = gradeComposition(text, q.correctHerbs);
        correctText = q.correctHerbs.map(h => String(h).replace(/[\(（][^\)）]*[\)）]/g, '').trim()).join(' · ');
        if(result.ok){
          gainedRatio = 1.0;
        } else if(result.score > 0){
          // 부분점수: 절반 임계 — 절반 이상 맞으면 그 비율, 미만이면 0
          const penalty = result.extras.length > 0 ? Math.max(0.5, 1 - result.extras.length * 0.15) : 1;
          gainedRatio = (result.score >= 0.5) ? Math.max(0, result.score * penalty) : 0;
        }
      } else {
        result = gradeShortText(text, q.correct);
        correctText = q.correct;
        gainedRatio = result.ok ? 1.0 : 0;
      }
      const pts = Math.round(q.points * gainedRatio);
      earned += pts;
      const ok = (gainedRatio >= 0.999);
      if(ok || gainedRatio >= 0.5) okCount += (ok ? 1 : 0.5);
      results.push({ q, ok, score: gainedRatio, earned: pts, correctText });
      ta.classList.add(ok ? 'ok' : 'ng');
      ta.disabled = true;
      $('#sa-submit').disabled = true;
      try{
        if(typeof bgm !== 'undefined'){
          if(ok && bgm.sfxCorrect) bgm.sfxCorrect();
          else if(!ok && bgm.sfxWrong) bgm.sfxWrong();
        }
      }catch(_){}
      let detail = '';
      if(q.correctHerbs && !ok){
        const missedStr = (result.missed && result.missed.length) ? `<li>맞히지 못한 본초: <span class="han">${esc(result.missed.join('·'))}</span></li>` : '';
        const extrasStr = (result.extras && result.extras.length) ? `<li>잘못 적은 본초: <span class="han">${esc(result.extras.join('·'))}</span></li>` : '';
        detail = (missedStr || extrasStr) ? `<ul>${missedStr}${extrasStr}</ul>` : '';
      } else if(!q.correctHerbs && !ok && result.nearest){
        detail = `<div style="font-size:11.5px;color:var(--gutong);margin-top:4px">입력 「${esc(text || '(빈칸)')}」 과 정답이 다릅니다</div>`;
      }
      fb.innerHTML = `
        <div class="sa-feedback ${ok?'ok':'ng'}">
          <span class="label">${ok ? '✓ 정답' : (gainedRatio > 0 ? `△ 부분 정답 (${Math.round(gainedRatio*100)}%)` : '× 오답')} · +${pts} 氣</span>
          <b style="color:var(--zhusha-d)">정답</b> <span class="han">${esc(correctText)}</span>
          ${detail}
        </div>
        <button class="btn" type="button" id="sa-next" style="display:block;width:100%;margin-top:10px;padding:10px">${idx+1>=questions.length?'결과 →':'다음 →'}</button>
      `;
      $('#sa-next').addEventListener('click', () => { idx++; render(); });
    };

    $('#sa-submit').addEventListener('click', submit);
    ta.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)){ e.preventDefault(); submit(); }
    });
  };

  render();
}
if(typeof window !== 'undefined') window.runShortAnswerSession = runShortAnswerSession;

// 끝 — v9.4 플래시카드 + 주관식

// ─── 난이도별 자동 문제 생성 ─────────────────────────────────────────────
// difficulty 1: 작용·구성 단순 매칭 (빈출 위주)
// difficulty 2: 적응증·가감·君藥 (중간)
// difficulty 3: 약재 단위 의의·감별·함정 선지 (어려움)
// difficulty 4: 처방 깊은 이해·약재 4-5개 모두 알아야 (지옥)
// v4: opts.chapter (string) 또는 opts.formulaIds (array) 로 풀 제한 가능 (오답 분석 → 약점 章 집중 출제용)
function generateQuizQuestions(n, diff, opts){
  diff = diff || 1;
  opts = opts || {};
  const allFormulas = (typeof FORMULAS !== 'undefined') ? FORMULAS : [];
  const herbs       = (typeof HERBS    !== 'undefined') ? HERBS    : [];
  if(!allFormulas.length) return [];
  // v4: 필터링된 처방 풀 (chapter 또는 formulaIds 제한 시)
  let formulas = allFormulas;
  if(opts.chapter){
    formulas = allFormulas.filter(f => f.chapter === opts.chapter);
  } else if(opts.formulaIds && opts.formulaIds.length){
    const idset = new Set(opts.formulaIds);
    formulas = allFormulas.filter(f => idset.has(f.id));
  }
  if(!formulas.length) formulas = allFormulas;  // 필터 결과 없으면 전체로 fallback

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

// 배틀용 — v4: level 인자에 따른 난이도 분포 차등
//   profile = BET_LEVELS[level].diffProfile  ex) [0.6, 0.3, 0.1, 0]
//   각 난이도별로 (PAST_EXAMS + BULK_QUESTIONS) 우선, 부족하면 generateQuizQuestions 보충
function generateBattleQuestions(n, level){
  level = level || 'small';
  const lv = BET_LEVELS.find(l => l.id === level) || BET_LEVELS[0];
  const profile = lv.diffProfile || [0.6, 0.3, 0.1, 0];
  const pastAll = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const bulkAll = (typeof BULK_QUESTIONS !== 'undefined') ? BULK_QUESTIONS : [];
  const allExams = [...pastAll, ...bulkAll];

  // 난이도별 목표 문항수 산출 (잔차 보정)
  const targets = profile.map(p => Math.floor(n * p));
  let remain = n - targets.reduce((a,b)=>a+b, 0);
  // 잔차를 큰 비율 칸부터 +1 씩 분배
  const order = profile.map((p,i)=>({p,i})).sort((a,b)=>b.p-a.p);
  for(let k=0; k<order.length && remain>0; k++){ targets[order[k].i] += 1; remain--; }

  const out = [];
  const shuf = (a) => a.slice().sort(()=>Math.random()-0.5);
  for(let d=1; d<=4; d++){
    const t = targets[d-1];
    if(t <= 0) continue;
    // 1) 기출 + 자작 풀에서 해당 난이도 sample
    const pool = shuf(allExams.filter(e => (e.difficulty||1) === d));
    const fromPool = pool.slice(0, t);
    out.push(...fromPool);
    // 2) 부족하면 자동 생성으로 보충
    const need = t - fromPool.length;
    if(need > 0){
      out.push(...generateQuizQuestions(need, d));
    }
  }
  // 셔플 후 옵션 셔플
  return shuf(out).slice(0, n).map(p => {
    const correctTxt = p.options[p.answer||0];
    const shuffled = p.options.slice().sort(() => Math.random()-0.5);
    return {...p, options: shuffled, answer: shuffled.indexOf(correctTxt)};
  });
}

// ───── 14. 초기화 ───────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
// v7: 카드 對決 게임 (Card Battle)
// ════════════════════════════════════════════════════════════════════════════
// 규칙 요약:
//   1. 양측 25% 베팅 (calcBet 의 'card' 별도 비율). 매칭은 별도 큐 lobby_card.
//   2. 시작 시 양측 무작위 證 3 후보, 10초 안에 1 선택 (timeout → 0번 자동).
//   3. 공유 1덱: 양측 정답 처방 composition 합집합 + 같은 章 노이즈 = 셔플.
//   4. 초기 보드 3장. 매 턴 종료 시 덱에서 1장 추가 (덱 비면 추가 안 함).
//   5. 매 턴 액션: 증상 공개(1회 필수) → 神급 스킬(게임 1회) → 전탕 시도 or 턴 종료.
//   6. 전탕: 26 처방 중 1개 선택 → 그 처방 composition 본초가 보드에 모두 있고
//           그 처방이 상대의 證에 해당하면 승리. 아니면 정답 처방 X → 자동 턴 종료.
//   7. 50턴 경과 시 무승부 (양측 베팅 환불).
//   8. 神급 캐릭터 5종 스킬:
//      - 黃帝 (huangdi)   : 거짓 증상 1개 공개 (다음 자기 증상 공개에 적용)
//      - 神農 (shennong)  : 본초 召喚 — 텍스트 입력, 덱에 있으면 보드로
//      - 伏羲 (fuxi)      : 八卦 預知 — 덱 상위 3장 자기만 미리 봄
//      - 女媧 (nuwa)      : 補天造化 — 보드 본초 1장을 덱에서 무작위 1장과 교체
//      - 岐伯 (qibo)      : 雷公問難 — 자기 정답 처방 君藥 1개를 보드로 끌어옴
//
// Firebase 스키마: /card_battles/{roomId}
//   { roomId, status, bet, players: {[uid]: {...}}, deck, board, turn, turnIdx,
//     log[], result, startedAt, lastActionAt }
// ────────────────────────────────────────────────────────────────────────────

const CARD_GAME_BET_PCT = 0.25;             // 25% 베팅
const CARD_CHOOSE_MS    = 10000;            // 證 선택 10초
const CARD_TURN_MAX     = 50;               // 무승부 한계 턴
const CARD_NOISE_HERBS  = 10;               // 노이즈 본초 장수

// 신급 캐릭터 → 스킬 매핑
const CARD_SKILLS = {
  huangdi:  { id:'fake_symptom',   han:'欺症',  ko:'거짓 증상', desc:'다음 강제 공개(턴별 자동/페널티)를 무관한 증상으로 대체' },
  shennong: { id:'summon_herb',    han:'召草',  ko:'본초 召喚', desc:'본초 한자 1개 입력 — 덱에 있으면 보드로' },
  fuxi:     { id:'foresee_deck',   han:'卦知',  ko:'八卦 預知', desc:'덱 상위 3장을 자기만 미리 봄' },
  nuwa:     { id:'transmute_board',han:'造化',  ko:'補天造化', desc:'보드 본초 1장을 덱에서 무작위로 교체' },  // v10.0.4: legacy 키 유지 (혹시 기존 저장 데이터 호환)
  nvwa:     { id:'transmute_board',han:'造化',  ko:'補天造化', desc:'보드 본초 1장을 덱에서 무작위로 교체' },  // v10.0.4: 실제 캐릭터 id 와 일치하는 정식 키
  qibo:     { id:'reveal_monarch', han:'問難',  ko:'雷公問難', desc:'자기 정답 처방의 君藥 1개를 보드로' }
};

// 카드 對決 베팅액 산정 (기 25%)
function calcCardBet(){
  return Math.max(1, Math.floor(S.qi * CARD_GAME_BET_PCT));
}

// 카드 對決 매칭 큐 진입 (별도 lobby_card 큐 사용)
let _cardLobbyStream = null;
let _cardBattlesStream = null;
let _cardMatchTimeout = null;

// v8.4: 카드 큐 keep-alive timer (10초마다 ts 갱신) — 45초 fresh 윈도우 안전 유지
let _cardKeepaliveTimer = null;

async function joinCardBattleQueue(){
  if(!S.userId){ alert('사용자 정보가 없습니다'); return; }
  const bet = calcCardBet();
  if(bet < 1 || S.qi < bet){ toast('氣가 부족합니다','red'); return; }

  // 베팅 차감 (에스크로)
  S.qi -= bet;
  saveState();
  renderHall();

  setTab('battle');
  view.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">求</span>對手를 찾는 중…</h2>
    <div class="card fade-in">
      <div style="text-align:center;padding:24px 12px">
        <div class="han" style="font-size:48px;color:var(--zhusha-d);margin-bottom:8px">候</div>
        <div id="card-queue-status" style="font-size:14px;color:var(--mo)">큐에 등록 중…</div>
        <div id="card-queue-count" style="font-size:11.5px;color:var(--gutong);margin-top:4px;min-height:14px"></div>
        <div style="margin-top:8px;font-size:11.5px;color:var(--gutong)">베팅 ${bet.toLocaleString()} 氣 · 카드 對決</div>
        <div style="margin-top:14px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-o" id="card-cancel-btn">취소 (환불)</button>
          <button class="btn btn-o" id="card-reregister-btn">큐 재등록</button>
        </div>
      </div>
    </div>
  `;

  let matching = false, active = true, cleanedUp = false;
  const myEntry = {
    userId: S.userId, name: S.name||'무명', character: S.character||null,
    faction: S.faction||null, bet, ts: Date.now()
  };

  const cleanup = async (refund) => {
    if(cleanedUp) return; cleanedUp = true; active = false;
    if(_cardMatchTimeout){ clearTimeout(_cardMatchTimeout); _cardMatchTimeout = null; }
    if(_cardKeepaliveTimer){ clearInterval(_cardKeepaliveTimer); _cardKeepaliveTimer = null; }
    if(_cardLobbyStream){ try{ _cardLobbyStream.close(); }catch(_){} _cardLobbyStream = null; }
    if(_cardBattlesStream){ try{ _cardBattlesStream.close(); }catch(_){} _cardBattlesStream = null; }
    try{ if(FB && S.userId) await FB.del(`lobby_card/${S.userId}`); }catch(_){}
    if(refund){ S.qi += bet; saveState(); renderHall(); }
  };
  $('#card-cancel-btn').addEventListener('click', async () => { await cleanup(true); setTab('hall'); });
  // v8.4: 수동 재등록 버튼 — stale 상태로 stuck 됐을 때 강제 새로고침
  $('#card-reregister-btn').addEventListener('click', async () => {
    try{
      $('#card-queue-status').textContent = '큐 재등록 중…';
      await FB.del(`lobby_card/${S.userId}`);
      await new Promise(r => setTimeout(r, 200));
      const ok = await FB.putRetry(`lobby_card/${S.userId}`, {...myEntry, ts: Date.now()});
      if(ok && ok.ok){ $('#card-queue-status').textContent = '재등록 완료 — 상대 찾는 중'; }
      else { $('#card-queue-status').textContent = '재등록 실패 (HTTP ' + (ok && ok.status||'?') + ')'; }
    }catch(e){ $('#card-queue-status').textContent = '재등록 오류: ' + e.message; }
  });

  if(!FB){
    $('#card-queue-status').textContent = 'Firebase 없음 — 카드 對決 불가';
    setTimeout(async ()=>{ await cleanup(true); setTab('hall'); }, 1500);
    return;
  }

  // v8.4: 자기 stale entry 강제 정리 (이전 세션 잔재 제거)
  try{ await FB.del(`lobby_card/${S.userId}`); }catch(_){}
  await new Promise(r => setTimeout(r, 150));  // Firebase 전파 잠시 대기

  // 큐에 자기 등록 — v8.4: putRetry 결과 명시적 검사
  const regResult = await FB.putRetry(`lobby_card/${S.userId}`, myEntry, {tries:3, backoffMs:400});
  if(!regResult || !regResult.ok){
    const reason = regResult && (regResult.status === 401 || regResult.status === 403)
      ? '권한 거부 (Firebase 보안 룰 — lobby_card 노드 확인 필요)'
      : `HTTP ${regResult && regResult.status || '?'} · ${regResult && regResult.message || '네트워크'}`;
    $('#card-queue-status').textContent = '큐 등록 실패 — ' + reason;
    setTimeout(async ()=>{ await cleanup(true); setTab('hall'); }, 2500);
    return;
  }
  $('#card-queue-status').textContent = '대기 중 — 상대를 찾는 중';

  // v8.4: keep-alive — 10초마다 ts 갱신 (45초 fresh 윈도우 안전 유지)
  _cardKeepaliveTimer = setInterval(async () => {
    if(!active) return;
    try{ await FB.put(`lobby_card/${S.userId}`, {...myEntry, ts: Date.now()}); }catch(_){}
  }, 10 * 1000);

  // STALE 5분 (v8.5: 5지선다와 통일)
  const STALE_ROOM_MS = 5 * 60 * 1000;
  // 자기 stale card_battles 정리 — 5분 이상 자기 player 인 not-done 방 모두 즉시 done 마킹
  // v8.5: 1분 → 5분. 1분은 SSE 지연 환경에서 정상 매칭도 stale 처리되는 버그 유발.
  const STALE_BATTLE_QUICK_MS = 5 * 60 * 1000;
  (async () => {
    try{
      const all = await FB.get('card_battles');
      if(all){
        const now2 = Date.now();
        for(const [rid, r] of Object.entries(all)){
          if(r && r.players && r.players[S.userId] && r.status !== 'done'
             && (now2 - (r.createdAt||0)) >= STALE_BATTLE_QUICK_MS){
            try{ await FB.put(`card_battles/${rid}/status`, 'done'); }catch(_){}
          }
        }
      }
    }catch(_){}
  })();

  // v9.0 자율 매치 (paideia 패턴) — 카드 對決
  // /lobby_card 폴링 — 선임자(ts 최소) 만 방 publish
  const onLobbySnap = async (q) => {
    if(!active || matching) return;
    const now = Date.now();
    const fresh = q ? Object.values(q).filter(x => x && x.userId && (now - (x.ts||0)) < 45000) : [];
    const sortedFresh = fresh.slice().sort((a,b) => (a.ts||0) - (b.ts||0));
    const others = sortedFresh.filter(x => x.userId !== S.userId);
    const cnt = $('#card-queue-count');
    if(cnt) cnt.textContent = `현재 큐: ${fresh.length}명 (나 + 대기 ${others.length}명)`;
    if(others.length === 0) return;

    const senior = sortedFresh[0];
    if(senior.userId !== S.userId){
      // 자기가 선임자 아님 — 대기. onBattlesSnap 이 잡아줌.
      $('#card-queue-status').textContent = `상대 발견 (${esc(others[0].name||'')}) — 매치 대기…`;
      return;
    }

    // 자기가 선임자 — 매치 publish (재진입 가드)
    matching = true;
    $('#card-queue-status').textContent = '상대 발견 — 매치 시작…';
    const opp = others[0];
    const roomId = 'cb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
    try{
      await createCardBattleRoom(roomId, S, opp, bet);
    }catch(e){
      matching = false;
      $('#card-queue-status').textContent = '매치 publish 실패: ' + (e && e.message || e) + ' — 재시도 대기';
      return;
    }
    // 자기 큐 entry 만 정리
    try{ await FB.del(`lobby_card/${S.userId}`); }catch(_){}
    await cleanup(false);
    startCardBattle(roomId, true);
  };
  _cardLobbyStream = FB.subscribe('lobby_card', onLobbySnap);

  // /card_battles 폴링 — 자기가 player 인 fresh room 발견 시 입장
  const onBattlesSnap = (battles) => {
    if(!active || matching) return;
    if(!battles) return;
    const now = Date.now();
    const myRoom = Object.values(battles).find(r =>
      r && r.players && r.players[S.userId]
      && r.status !== 'done'
      && (now - (r.createdAt||0)) < STALE_BATTLE_QUICK_MS
    );
    if(myRoom){
      matching = true;
      $('#card-queue-status').textContent = '매치 발견 — 입장…';
      (async () => {
        await cleanup(false);
        startCardBattle(myRoom.roomId, false);
      })();
    }
  };
  _cardBattlesStream = FB.subscribe('card_battles', onBattlesSnap);

  // 75s 매칭 타임아웃
  _cardMatchTimeout = setTimeout(async () => {
    if(matching) return;
    $('#card-queue-status').textContent = '매칭 실패 — 환불 처리';
    await cleanup(true);
    setTimeout(()=>setTab('hall'), 1200);
  }, 75000);
}
window.joinCardBattleQueue = joinCardBattleQueue;

// 방 생성자가 호출 — 양측 證 후보 3개씩 부여, 카드패 구성, status='choosing'
async function createCardBattleRoom(roomId, me, opp, bet){
  if(!Array.isArray(SYNDROMES) || SYNDROMES.length < 6){
    throw new Error('SYNDROMES 데이터 부족');
  }
  // 1) 양측 證 후보 3개씩 무작위 (겹치지 않게)
  const all = SYNDROMES.slice();
  const shuffled = all.slice().sort(()=>Math.random()-0.5);
  const meOpts  = shuffled.slice(0, 3);
  const oppOpts = shuffled.slice(3, 6);

  // 2) 정답 처방은 양측이 선택 후 결정되지만, 카드패는 미리 양측 후보 모두 커버하도록 넓게 구성
  //    실제 정답이 어느 후보일지 모르므로, 양측 모든 6 후보의 합집합 본초 + 章 노이즈 사용.
  const candidates = [...meOpts, ...oppOpts];
  const allComp = new Set();
  candidates.forEach(syn => {
    const f = FORMULAS.find(x => x.id === syn.formulaId);
    if(f && Array.isArray(f.composition)) f.composition.forEach(h => allComp.add(h));
  });
  // 노이즈: 같은 章의 다른 처방에서 무작위 본초 CARD_NOISE_HERBS 장 추가
  const chapters = new Set(candidates.map(s => {
    const f = FORMULAS.find(x => x.id === s.formulaId);
    return f ? f.chapter : '';
  }));
  const noiseSrc = new Set();
  FORMULAS.forEach(f => {
    if(chapters.has(f.chapter) && Array.isArray(f.composition)){
      f.composition.forEach(h => { if(!allComp.has(h)) noiseSrc.add(h); });
    }
  });
  const noiseArr = [...noiseSrc].sort(()=>Math.random()-0.5).slice(0, CARD_NOISE_HERBS);
  noiseArr.forEach(h => allComp.add(h));

  // 3) 셔플된 덱 (배열). 보드는 처음 3장.
  const deck = [...allComp].sort(()=>Math.random()-0.5);
  const board = deck.splice(0, 3);

  // 4) 선공: 사전 순으로 작은 userId
  const firstTurn = (me.userId < opp.userId) ? me.userId : opp.userId;

  const room = {
    roomId, bet, status: 'choosing',
    createdAt: Date.now(), startedAt: 0, lastActionAt: Date.now(),
    chooseUntil: Date.now() + CARD_CHOOSE_MS + 1500,  // 클라이언트 동기 여유
    players: {
      [me.userId]: {
        userId: me.userId, name: me.name||'무명',
        character: me.character||null, faction: me.faction||null,
        syndromeOptions: meOpts.map(s => s.id),
        syndromeChosen: null,
        revealedSymptoms: [],
        skillUsed: false,
        fakeSymptomNext: null,           // 황제 스킬 결과 (다음 강제 공개를 거짓으로 대체)
        foreseenDeck: null,              // 복희 스킬 결과
        initialRevealed: false,          // v7.3: 게임 시작 자동 공개 완료 마커 (중복 방지)
        lastAutoRevealTurnIdx: -1        // v7.3: 덱 빈 단계 턴별 자동 공개 마커
      },
      [opp.userId]: {
        userId: opp.userId, name: opp.name||'무명',
        character: opp.character||null, faction: opp.faction||null,
        syndromeOptions: oppOpts.map(s => s.id),
        syndromeChosen: null,
        revealedSymptoms: [],
        skillUsed: false,
        fakeSymptomNext: null,
        foreseenDeck: null,
        initialRevealed: false,
        lastAutoRevealTurnIdx: -1
      }
    },
    deck, board, turn: firstTurn, turnIdx: 0,
    log: [],
    result: null
  };
  // v9.2 critical 픽스: publish fire-and-forget → 호스트 hang 방지.
  //   startCardBattle 의 FB.get + polling subscribe 가 publish 완료를 자동 감지.
  FB.putRetry(`card_battles/${roomId}`, room, {tries:3, backoffMs:400, timeoutMs:5000})
    .then(res => {
      if(!res || !res.ok){
        console.warn('[card_battles publish] background fail:', res);
      }
    })
    .catch(e => { console.warn('[card_battles publish] exception:', e); });
  return room;
}

// v8.7: 카드 對決 inactivity timeout — lastActionAt 갱신 없이 60초 경과 시 자동 정산.
//       자기 턴이 아닐 때 (= 상대 응답 없는 경우) 만 자기가 책임지고 트리거하여
//       양측 동시 트리거 회피. 자기 턴이면서 무액션은 의도적 게임 진행 — 트리거 안 함.
const CARD_INACTIVITY_MS = 60 * 1000;
let _cardInactivityTimer = null;
function armCardInactivityWatchdog(roomId, room){
  if(_cardInactivityTimer){ clearTimeout(_cardInactivityTimer); _cardInactivityTimer = null; }
  if(!room || !room.players || !room.players[S.userId]) return;
  if(room.status !== 'playing') return;        // choosing/done 은 별도 흐름
  if(room.turn === S.userId) return;           // 자기 턴 무액션은 자기 의도
  const last = room.lastActionAt || room.startedAt || room.createdAt || Date.now();
  const remain = CARD_INACTIVITY_MS - (Date.now() - last);
  if(remain <= 0){ triggerCardInactivityForfeit(roomId, room); return; }
  _cardInactivityTimer = setTimeout(() => {
    if(!_cardRoomState || _cardRoomState.status !== 'playing') return;
    if(_cardRoomState.turn === S.userId) return;
    triggerCardInactivityForfeit(roomId, _cardRoomState);
  }, remain + 250);  // 250ms 여유 — SSE 가 갱신을 가져올 시간
}
async function triggerCardInactivityForfeit(roomId, room){
  if(!room || !room.players || room.status === 'done') return;
  try{
    const oppId = Object.keys(room.players).find(k => k !== S.userId);
    if(!oppId) return;
    // 멱등성: status='done' 으로 transition 가능한 경우에만 (다른 클라이언트가 먼저 처리했으면 skip)
    const fresh = await FB.get(`card_battles/${roomId}`);
    if(!fresh || fresh.status === 'done') return;
    const result = { winner: S.userId, by: 'inactivity', inactiveSide: oppId, finishedAt: Date.now() };
    await FB.put(`card_battles/${roomId}/result`, result);
    await FB.put(`card_battles/${roomId}/status`, 'done');
    toast('상대 응답 없음 — 부전승 처리', 'gold');
  }catch(e){ try{ console.error('inactivity forfeit error', e); }catch(_){} }
}

// 카드 對決 시작 (양측이 동시에 진입)
let _cardRoomStream = null;
let _cardRoomState  = null;
let _cardChooseTimer= null;
let _cardLoadWatchdog = null;  // v8.5: 로딩 watchdog timer
let _cardFirstRenderDone = false;  // v8.5: 첫 렌더 성공 플래그
// v9.7: 증상 공개 picker 가드 (SSE re-render 시 모달 중복 방지)
let _cardInitialPickerShown = false;   // 게임 시작 picker 표시 여부 (roomId 단위)
let _cardDeckPickerTurnIdx  = -1;       // 덱 빈 단계 마지막 picker 가 떴던 turnIdx
let _cardPickerRoomId       = null;     // 현재 picker 가드가 유효한 roomId
async function startCardBattle(roomId, isCreator){
  setTab('battle');
  view.innerHTML = `
    <div class="card imperial fade-in" style="text-align:center">
      <div class="han" style="font-size:32px;color:var(--zhusha-d)">對決</div>
      <div style="margin-top:8px">방 ${esc(roomId)}</div>
      <div id="cb-stage" style="margin-top:12px">로딩…</div>
      <div id="cb-diag" style="margin-top:6px;font-size:11px;color:var(--gutong);min-height:14px"></div>
    </div>
    <!-- v9.6: 카드 對決 채팅 호스트 -->
    <div id="cb-chat-host"></div>
  `;
  // v8.5: 카드 對決 전용 BGM (없으면 일반 battle BGM 으로 폴백)
  try{ (bgm.startCardDuel || bgm.startBattle).call(bgm); }catch(_){}

  // v9.6: 채팅 마운트 — AI 룸이면 로컬, 사람-사람 룸이면 Firebase
  try{
    if(typeof window.V96Chat !== 'undefined'){
      // 기존 채팅 ctx 가 있으면 정리
      if(window._v96CurrentChatCtx){ V96Chat.unmount(window._v96CurrentChatCtx); window._v96CurrentChatCtx = null; }
      const isAi = (typeof V96CardAI !== 'undefined') && String(roomId).startsWith('AI_CARD_');
      window._v96CurrentChatCtx = V96Chat.mount({
        node: `card_battles/${roomId}/chat`,
        container: '#cb-chat-host',
        presets: V96Chat.PRESETS_CARD,
        isLocal: isAi,
        max: 30,
      });
    }
  }catch(e){ console.warn('chat mount failed', e); }

  // v7.2: 배틀 진행 중 플래그 ON (탭 이탈 가드용) — oppId 는 첫 SSE 콜백에서 확정
  _inBattleSession = true;
  _battleSessionMeta = { mode:'card', roomId, oppId:null };
  _cardFirstRenderDone = false;
  // v9.7: 멀티 모드 — 시그니처 효과·점수 OFF (카드 對決)
  try{ if(window.V97Sig) window.V97Sig.setMode('multi'); }catch(_){}
  // v9.7: 증상 공개 picker 가드 초기화
  _cardInitialPickerShown = false;
  _cardDeckPickerTurnIdx  = -1;
  _cardPickerRoomId       = roomId;

  // v9.2: 초기 방 데이터 FB.get 4회 재시도 (350·700·1050·1400 ms, 총 3.5초). publish fire-and-forget
  //       완료를 위한 retry window. polling subscribe 가 추가 안전망.
  (async () => {
    let initial = null;
    for(let i=0; i<4; i++){
      try{ initial = await FB.get(`card_battles/${roomId}`); }catch(_){ initial = null; }
      if(initial) break;
      await new Promise(r => setTimeout(r, 350 * (i+1)));
    }
    if(initial){
      _cardRoomState = initial;
      if(_battleSessionMeta && !_battleSessionMeta.oppId && initial.players){
        _battleSessionMeta.oppId = Object.keys(initial.players).find(k => k !== S.userId) || null;
      }
      try{ renderCardBattle(roomId, initial); _cardFirstRenderDone = true; }
      catch(e){
        const d = $('#cb-diag'); if(d) d.textContent = '렌더 오류: '+(e&&e.message||e);
      }
    }
    // 실패해도 별도 메시지 없음 — polling 이 곧 잡아줌
  })();

  // 방 데이터 구독 (라이브 업데이트용)
  _cardRoomStream = FB.subscribe(`card_battles/${roomId}`, (room) => {
    if(!room){
      $('#cb-stage').innerHTML = '<div style="color:var(--zhusha-d);padding:20px">방 데이터 없음 (정상 종료 후 청소되었을 수 있음)</div>';
      return;
    }
    _cardRoomState = room;
    if(_battleSessionMeta && !_battleSessionMeta.oppId && room.players){
      _battleSessionMeta.oppId = Object.keys(room.players).find(k => k !== S.userId) || null;
    }
    try{
      renderCardBattle(roomId, room);
      _cardFirstRenderDone = true;
      const d = $('#cb-diag'); if(d && d.textContent && !/렌더 오류/.test(d.textContent)) d.textContent = '';
    }catch(e){
      try{ console.error('renderCardBattle error', e); }catch(_){}
      const d = $('#cb-diag'); if(d) d.textContent = '렌더 오류: ' + (e && e.message || e);
    }
    // v8.7: inactivity watchdog 갱신 — lastActionAt 기반 60초 무액션 자동 forfeit
    armCardInactivityWatchdog(roomId, room);
  });

  // v9.1: watchdog 폐기 — polling 2초 (v8.9) 가 첫 렌더 보장. 별도 watchdog 가
  //       오히려 사용자 혼란 (정상 폴링 직전 진단 UI 깜빡임). 비정상 상황 (네트워크
  //       끊김 등) 은 polling 이 계속 재시도하므로 화면이 "로딩…" 으로 유지되다가
  //       복구 시 자동 진행.
}

// 화면 렌더링 — status 별로 분기
function renderCardBattle(roomId, room){
  const stage = $('#cb-stage');
  if(!stage){ return; }
  const me   = room.players[S.userId];
  const oppU = Object.keys(room.players).find(u => u !== S.userId);
  const opp  = room.players[oppU];
  if(!me || !opp){
    stage.innerHTML = '<div style="color:var(--zhusha-d)">플레이어 데이터 불완전</div>';
    return;
  }

  if(room.status === 'choosing'){
    return renderCardChoose(roomId, room, me, opp);
  }
  if(room.status === 'playing'){
    return renderCardPlaying(roomId, room, me, opp);
  }
  if(room.status === 'done'){
    return renderCardResult(roomId, room, me, opp);
  }
}

// ── 證 선택 단계 (10초)
function renderCardChoose(roomId, room, me, opp){
  const stage = $('#cb-stage');
  const remain = Math.max(0, Math.floor(((room.chooseUntil||0) - Date.now())/1000));
  const myDone = !!me.syndromeChosen;
  const oppDone= !!opp.syndromeChosen;

  const myOpts = (me.syndromeOptions||[]).map(id => SYNDROME_BY_ID[id]).filter(Boolean);
  stage.innerHTML = `
    <div style="font-family:var(--font-display);font-size:18px;color:var(--zhusha-d);margin-bottom:6px">證 選擇 (${remain}s)</div>
    <div style="font-size:12px;color:var(--mo-l);margin-bottom:12px">
      3개의 證 중 하나를 골라 본인의 證으로 합니다. 시간 내 미선택 시 1번 證 자동 선택.
    </div>
    <div class="cb-syn-grid">
      ${myOpts.map((s, i) => `
        <button class="cb-syn-card ${me.syndromeChosen===s.id?'chosen':''}"
                data-sid="${s.id}" type="button" ${myDone?'disabled':''}>
          <div class="cb-syn-han">${esc(s.han)}</div>
          <div class="cb-syn-ko">${esc(s.ko)}</div>
          <div class="cb-syn-sym">${(s.symptoms||[]).slice(0,3).map(x=>`<span class="cb-sym-chip">${esc(x)}</span>`).join('')}</div>
        </button>
      `).join('')}
    </div>
    <div style="margin-top:14px;font-size:12.5px;color:var(--gutong)">
      상대: <b>${esc(opp.name)}</b> ${oppDone ? '✓ 선택 완료' : '… 선택 중'}<br>
      나: ${myDone ? '<b style="color:var(--feicui)">✓ 선택 완료 — 상대 대기</b>' : '<b style="color:var(--zhusha-d)">선택해 주세요</b>'}
    </div>
  `;
  $$('.cb-syn-card').forEach(btn => {
    btn.addEventListener('click', async () => {
      if(me.syndromeChosen) return;
      const sid = btn.dataset.sid;
      try{
        await FB.put(`card_battles/${roomId}/players/${S.userId}/syndromeChosen`, sid);
      }catch(e){
        toast('선택 실패: '+e.message, 'red');
      }
    });
  });

  // 카운트다운 + 자동 진행
  if(_cardChooseTimer){ clearInterval(_cardChooseTimer); _cardChooseTimer=null; }
  _cardChooseTimer = setInterval(async () => {
    if(!_cardRoomState || _cardRoomState.status !== 'choosing'){
      clearInterval(_cardChooseTimer); _cardChooseTimer=null; return;
    }
    const r = _cardRoomState;
    const left = Math.max(0, Math.floor(((r.chooseUntil||0) - Date.now())/1000));
    const stg = $('#cb-stage');
    const titleEl = stg && stg.querySelector('div');
    if(titleEl && /[0-9]+s/.test(titleEl.textContent||'')){
      titleEl.textContent = `證 選擇 (${left}s)`;
    }
    // 시간 만료 시 자동 1번 선택 (자기 것만 처리, race 회피)
    if(left === 0){
      const my = r.players[S.userId];
      if(my && !my.syndromeChosen){
        const first = my.syndromeOptions && my.syndromeOptions[0];
        if(first){ try{ await FB.put(`card_battles/${roomId}/players/${S.userId}/syndromeChosen`, first); }catch(_){} }
      }
      clearInterval(_cardChooseTimer); _cardChooseTimer=null;

      // v9.0 자율 매치: 양측 모두 transition 시도 (선공 책임 폐기).
      //   Firebase last-write-wins + status='done' 가드로 멱등성 보장.
      setTimeout(async () => {
        try{
          const r2 = await FB.get(`card_battles/${roomId}`);
          if(r2 && r2.status === 'choosing'){
            const us = Object.values(r2.players);
            const all = us.every(p => p.syndromeChosen);
            if(all){
              await FB.put(`card_battles/${roomId}/status`, 'playing');
              await FB.put(`card_battles/${roomId}/startedAt`, Date.now());
              await FB.put(`card_battles/${roomId}/lastActionAt`, Date.now());
            }
          }
        }catch(_){}
      }, 1200);
    }
  }, 500);

  // v9.0 자율 매치: 양측 즉시 transition 시도 (선공 책임 폐기)
  if(myDone && oppDone){
    (async () => {
      try{
        await FB.put(`card_battles/${roomId}/status`, 'playing');
        await FB.put(`card_battles/${roomId}/startedAt`, Date.now());
        await FB.put(`card_battles/${roomId}/lastActionAt`, Date.now());
      }catch(_){}
    })();
  }
}

// ── 본 게임 단계
function renderCardPlaying(roomId, room, me, opp){
  const stage = $('#cb-stage');
  if(_cardChooseTimer){ clearInterval(_cardChooseTimer); _cardChooseTimer=null; }
  const mySyn  = SYNDROME_BY_ID[me.syndromeChosen];
  const oppSyn = SYNDROME_BY_ID[opp.syndromeChosen];
  if(!mySyn || !oppSyn){
    stage.innerHTML = '<div style="color:var(--zhusha-d)">證 데이터 오류</div>';
    return;
  }
  const isMyTurn = (room.turn === S.userId);
  const myChar  = (typeof PHYSICIANS !== 'undefined') ? PHYSICIANS.find(p=>p.id===me.character) : null;
  const oppChar = (typeof PHYSICIANS !== 'undefined') ? PHYSICIANS.find(p=>p.id===opp.character) : null;
  const isDivineMe  = myChar  && myChar.cat === 'divine';  // v10.0.4: .category → .cat (data-physicians.js 정의와 일치). 이전엔 항상 false 라 신급 스킬 버튼이 안 떴음.
  const skillMeta = isDivineMe ? CARD_SKILLS[me.character] : null;

  // ── v9.7: 증상 공개는 모두 "사용자 선택" — 자동/랜덤 폐기 ──
  //   ① 게임 시작 — 양측 각자 1개 선택 공개 (모달; 30초 후 미선택 시 자동 폴백)
  //   ② 덱 비고 자기 턴 시작 — 1개 선택 공개 (모달; 15초 후 자동 폴백)
  //   ③ 페널티 (오답 후) — openPenaltyRevealModal 이미 사용자 선택 (6초)
  //   SSE re-render 가드: _cardInitialPickerShown, _cardDeckPickerTurnIdx
  const deckEmpty = (room.deck||[]).length === 0;
  if(_cardPickerRoomId !== roomId){
    // 가드가 다른 방으로 묵은 경우 초기화
    _cardInitialPickerShown = false;
    _cardDeckPickerTurnIdx  = -1;
    _cardPickerRoomId       = roomId;
  }
  if(!me.initialRevealed && !_cardInitialPickerShown){
    _cardInitialPickerShown = true;
    openInitialRevealModal(roomId, room, me, mySyn).catch(_=>{});
  } else if(me.initialRevealed && isMyTurn && deckEmpty
            && me.lastAutoRevealTurnIdx !== room.turnIdx
            && _cardDeckPickerTurnIdx !== room.turnIdx){
    _cardDeckPickerTurnIdx = room.turnIdx;
    openDeckEmptyRevealModal(roomId, room, me, mySyn).catch(_=>{});
  }

  // 자기 증상 (남은 미공개 + 공개됨 — 자기 화면에서는 모두 표시)
  const myRevealed = me.revealedSymptoms||[];
  const myRemaining= (mySyn.symptoms||[]).filter(s => !myRevealed.includes(s));

  stage.innerHTML = `
    <!-- 상단: 상대 (이름·캐릭터·공개 증상) -->
    <div class="cb-opp">
      <div class="cb-opp-head">
        <span class="han">敵</span>
        <span class="cb-opp-name">${esc(opp.name)}</span>
        ${opp.skillUsed ? `<span class="cb-skill-used">스킬 사용</span>` : ''}
      </div>
      <div class="cb-opp-sym">
        <div class="cb-opp-sym-title">공개된 증상 (${(opp.revealedSymptoms||[]).length})</div>
        <div class="cb-opp-sym-list">
          ${((opp.revealedSymptoms||[]).map(s => `<span class="cb-sym-chip revealed">${esc(s)}</span>`).join('')) || '<span class="cb-empty">아직 없음</span>'}
        </div>
      </div>
    </div>

    <!-- 중앙: 보드 + 덱 -->
    <div class="cb-board-wrap">
      <div class="cb-board-meta">
        턴 ${room.turnIdx+1}/${CARD_TURN_MAX} · 덱 ${room.deck.length}장${deckEmpty?' <span style="color:var(--zhusha-d);font-size:11px">[증상 공개 단계]</span>':''} ·
        ${isMyTurn ? '<b style="color:var(--feicui)">나의 턴</b>' : '<b style="color:var(--gutong)">상대 턴</b>'}
        <button class="cb-lang-toggle" onclick="toggleHerbLang()" title="본초 한자↔한글 토글" style="margin-left:8px;padding:1px 8px;font-size:10.5px;border:1px solid var(--gutong);background:transparent;border-radius:10px;cursor:pointer;color:var(--mo);font-family:var(--font-display)">${S.herbLang==='ko'?'韓→漢':'漢→韓'}</button>
        <button class="cb-dict-btn" onclick="window.V97Dict && window.V97Dict.open()" title="처방 사전 (게임 중 참조 가능)" style="margin-left:4px;padding:1px 8px;font-size:10.5px;border:1px solid var(--zhusha-d);background:var(--zhusha-d)22;color:var(--zhusha-d);border-radius:10px;cursor:pointer;font-family:var(--font-display)">方劑 사전</button>
      </div>
      <!-- v7.5: 五味 색 범례 -->
      <div class="cb-taste-legend" style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin:4px 0 6px;font-size:10.5px;font-family:var(--font-display)">
        ${['辛','甘','苦','酸','鹹','淡','澁'].map(t => {
          const c = herbTasteColor(t+',');
          return `<span style="display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:8px;background:${c.bg};border:1px solid ${c.bd};color:${c.accent}">${t}</span>`;
        }).join('')}
      </div>
      <div class="cb-board" id="cb-board">
        ${(room.board||[]).map(h => renderHerbCardHTML(h)).join('')}
      </div>
    </div>

    <!-- 하단: 본인 증 + 액션 -->
    <div class="cb-me">
      <div class="cb-me-head">
        <span class="han">己</span>
        <span class="cb-me-name">${esc(me.name)}</span>
        <span class="cb-me-syn">— <b>${esc(mySyn.han)}</b> (${esc(mySyn.ko)})</span>
      </div>
      <div class="cb-me-sym">
        <div class="cb-me-sym-title">나의 증상 (전체 — 공개 ${myRevealed.length}/${(mySyn.symptoms||[]).length})</div>
        <div class="cb-me-sym-list">
          ${myRemaining.map(s => `<span class="cb-sym-chip own" data-sym="${esc(s)}">${esc(s)}</span>`).join('')}
          ${myRevealed.map(s => `<span class="cb-sym-chip own revealed-mine">${esc(s)}</span>`).join('')}
        </div>
        ${me.fakeSymptomNext ? `<div class="cb-fake-banner" style="margin-top:6px">黃帝 欺症 발동 중 — 다음 강제 공개는 <b>거짓 증상 "${esc(me.fakeSymptomNext)}"</b> 로 대체됩니다</div>` : ''}
      </div>
      <div class="cb-me-act">
        ${skillMeta && !me.skillUsed ? `<button class="btn btn-gold ${isMyTurn?'':'disabled'}" id="cb-act-skill" ${isMyTurn?'':'disabled'}>${esc(skillMeta.han)} (${esc(skillMeta.ko)})</button>` : ''}
        <button class="btn btn-o ${isMyTurn?'':'disabled'}" id="cb-act-decoct" ${isMyTurn?'':'disabled'}>전탕 시도</button>
        <button class="btn btn-o ${isMyTurn?'':'disabled'}" id="cb-act-end" ${isMyTurn?'':'disabled'}>턴 종료</button>
      </div>
      ${skillMeta ? `<div class="cb-skill-hint">神급 스킬: <b>${esc(skillMeta.han)}</b> — ${esc(skillMeta.desc)}${me.skillUsed?' <span style="color:var(--zhusha-d)">[사용 완료]</span>':''}</div>` : ''}
      <div class="cb-action-hint" id="cb-action-hint">
        ${isMyTurn
          ? (deckEmpty
              ? '덱 소진 — 매 턴 자기 증상 1개가 자동 공개됩니다. 전탕을 시도하거나 턴을 종료하세요.'
              : '전탕을 시도하거나 턴을 종료하세요. 턴 종료 시 덱에서 1장이 보드로 옵니다.')
          : '상대 턴 진행 중…'}
      </div>
    </div>
  `;

  if(isMyTurn){
    if(skillMeta && !me.skillUsed){
      $('#cb-act-skill') && $('#cb-act-skill').addEventListener('click', () => openSkillModal(roomId, room, me, opp, skillMeta));
    }
    $('#cb-act-decoct') && $('#cb-act-decoct').addEventListener('click', () => openDecoctModal(roomId, room, me, opp));
    $('#cb-act-end') && $('#cb-act-end').addEventListener('click', () => endCardTurn(roomId, room));
  }

  // v9.0 자율 매치: 50턴 도달 시 양측 모두 무승부 정산 시도 (선공 책임 폐기).
  //   settleCardBattle 내부 `if(r.status === 'done') return` 가드로 멱등성 보장.
  if(room.turnIdx >= CARD_TURN_MAX - 1){
    setTimeout(() => settleCardBattle(roomId, room, null, 'turn_limit'), 800);
  }
}

// v7.3: 강제 증상 공개 (자동/페널티 공통)
//   opts.kind: 'initial' (게임 시작) | 'deck_empty' (덱 빈 턴별) | 'penalty' (오답 후)
//   opts.turnIdx: 'deck_empty' 일 때 사용 (lastAutoRevealTurnIdx 갱신용)
//   opts.pick: 'penalty' 시 사용자가 선택한 증상 (없으면 random)
//   fakeSymptomNext 가 있으면 그것을 노출 (자기 진짜 증상 보전, fake 만 소비)
async function autoRevealOneSymptom(roomId, room, me, mySyn, opts){
  opts = opts || {};
  const fb = FB && FB.base ? FB : null;
  if(!fb) return false;
  // 황제 fake 우선
  if(me.fakeSymptomNext){
    const newRev = (me.revealedSymptoms||[]).slice();
    newRev.push(me.fakeSymptomNext);
    try{
      await FB.put(`card_battles/${roomId}/players/${S.userId}/revealedSymptoms`, newRev);
      await FB.put(`card_battles/${roomId}/players/${S.userId}/fakeSymptomNext`, null);
      if(opts.kind === 'initial') await FB.put(`card_battles/${roomId}/players/${S.userId}/initialRevealed`, true);
      if(opts.kind === 'deck_empty' && typeof opts.turnIdx === 'number'){
        await FB.put(`card_battles/${roomId}/players/${S.userId}/lastAutoRevealTurnIdx`, opts.turnIdx);
      }
      appendCardLog(roomId, room, `${me.name}: ${opts.kind==='initial'?'게임 시작':opts.kind==='deck_empty'?'턴별':'페널티'} 공개 (黃帝 欺症)`);
    }catch(_){}
    return true;
  }
  // 일반 강제 공개
  const remaining = (mySyn.symptoms||[]).filter(s => !(me.revealedSymptoms||[]).includes(s));
  if(!remaining.length){
    // 더 공개할 게 없으면 마커만 갱신 (게임 계속)
    try{
      if(opts.kind === 'initial') await FB.put(`card_battles/${roomId}/players/${S.userId}/initialRevealed`, true);
      if(opts.kind === 'deck_empty' && typeof opts.turnIdx === 'number'){
        await FB.put(`card_battles/${roomId}/players/${S.userId}/lastAutoRevealTurnIdx`, opts.turnIdx);
      }
    }catch(_){}
    return false;
  }
  const sym = opts.pick && remaining.includes(opts.pick)
    ? opts.pick
    : remaining[Math.floor(Math.random()*remaining.length)];
  const newRev = (me.revealedSymptoms||[]).slice();
  newRev.push(sym);
  try{
    await FB.put(`card_battles/${roomId}/players/${S.userId}/revealedSymptoms`, newRev);
    if(opts.kind === 'initial') await FB.put(`card_battles/${roomId}/players/${S.userId}/initialRevealed`, true);
    if(opts.kind === 'deck_empty' && typeof opts.turnIdx === 'number'){
      await FB.put(`card_battles/${roomId}/players/${S.userId}/lastAutoRevealTurnIdx`, opts.turnIdx);
    }
    const kindKo = opts.kind === 'initial' ? '게임 시작 공개' :
                   opts.kind === 'deck_empty' ? '턴별 공개' :
                   opts.kind === 'penalty' ? '페널티 공개' : '강제 공개';
    appendCardLog(roomId, room, `${me.name}: ${kindKo} — ${sym}`);
  }catch(_){}
  return true;
}

// v9.7: 게임 시작 증상 공개 모달 — 자기 증상 1개를 골라 공개 (30초 타임아웃)
//   각자(양쪽 다) 시작 시 하나씩 선택 공개. 미선택 시 첫 번째로 폴백.
//   _cardInitialPickerShown 가드는 호출 측에서 처리됨 (renderCardPlaying).
//   race 픽스: initialRevealed=true 검사를 await 직전에 다시 확인 (FB.put 지연 동안 중복 호출 방지).
function openInitialRevealModal(roomId, room, me, mySyn){
  return new Promise((resolve) => {
    // double-fire 방어: 이미 공개 완료 상태라면 즉시 종료
    if(me.initialRevealed){ resolve(); return; }
    const remaining = (mySyn.symptoms||[]).filter(s => !(me.revealedSymptoms||[]).includes(s));
    const hasFake = !!me.fakeSymptomNext;
    // 공개할 게 없으면 마커만 갱신
    if(!remaining.length && !hasFake){
      (async () => {
        try{ await FB.put(`card_battles/${roomId}/players/${S.userId}/initialRevealed`, true); }catch(_){}
        resolve();
      })();
      return;
    }

    const m = document.createElement('div');
    m.className = 'overlay';
    m.innerHTML = `
      <div class="modal" style="max-width:520px">
        <div class="modal-title" style="color:var(--feicui)">▶ 게임 시작 — 자기 증상 1개 공개</div>
        <div class="modal-body">
          <div style="margin-bottom:10px;font-size:12.5px;color:var(--mo)">
            <b>${esc(mySyn.han)}</b> (${esc(mySyn.ko)}) — 시작 단서로 <b>자기 증상 1개</b>를 골라 상대에게 공개합니다.
          </div>
          ${hasFake ? `<div class="cb-fake-banner" style="margin-bottom:8px">黃帝 欺症 발동 중 — 어느 것을 골라도 <b>거짓 증상 "${esc(me.fakeSymptomNext)}"</b> 가 공개됩니다.</div>` : ''}
          <div style="margin:6px 0;font-size:11.5px;color:var(--mo-l)">증상 선택 (30초 — 미선택 시 첫 번째 자동):</div>
          <div class="cb-sym-grid" id="cb-initial-grid">
            ${remaining.length
              ? remaining.map(s => `<button class="cb-sym-btn" type="button" data-sym="${esc(s)}">${esc(s)}</button>`).join('')
              : '<div style="color:var(--gutong);padding:8px">공개할 증상이 없습니다 (fake 만 공개)</div>'}
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--gutong);text-align:right" id="cb-initial-timer">30초</div>
        </div>
      </div>`;
    document.body.appendChild(m);

    let done = false;
    let remain = 30;
    const timerEl = m.querySelector('#cb-initial-timer');
    const tick = setInterval(() => {
      remain--;
      if(timerEl) timerEl.textContent = `${remain}초`;
      if(remain <= 0){
        clearInterval(tick);
        if(!done){ done = true; finish(remaining[0] || null); }
      }
    }, 1000);

    const finish = async (pick) => {
      if(m.parentNode) m.remove();
      try{
        await autoRevealOneSymptom(roomId, room, me, mySyn, {kind:'initial', pick: pick||undefined});
      }catch(_){}
      resolve();
    };

    m.querySelectorAll('.cb-sym-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if(done) return; done = true; clearInterval(tick);
        finish(btn.dataset.sym);
      });
    });
  });
}

// v9.7: 덱 소진 단계 자기 턴 증상 공개 모달 — 자기 증상 1개를 골라 공개 (15초 타임아웃)
//   자기 턴 시작 시 1회 트리거. lastAutoRevealTurnIdx 로 턴별 중복 방지.
function openDeckEmptyRevealModal(roomId, room, me, mySyn){
  return new Promise((resolve) => {
    const turnIdx = room.turnIdx;
    if(me.lastAutoRevealTurnIdx === turnIdx){ resolve(); return; }
    const remaining = (mySyn.symptoms||[]).filter(s => !(me.revealedSymptoms||[]).includes(s));
    const hasFake = !!me.fakeSymptomNext;
    if(!remaining.length && !hasFake){
      (async () => {
        try{ await FB.put(`card_battles/${roomId}/players/${S.userId}/lastAutoRevealTurnIdx`, turnIdx); }catch(_){}
        resolve();
      })();
      return;
    }

    const m = document.createElement('div');
    m.className = 'overlay';
    m.innerHTML = `
      <div class="modal" style="max-width:520px">
        <div class="modal-title" style="color:var(--zhusha-d)">⚪ 덱 소진 — 자기 증상 1개 공개</div>
        <div class="modal-body">
          <div style="margin-bottom:10px;font-size:12.5px;color:var(--mo)">
            덱이 비었습니다. 자기 턴마다 <b>자기 증상 1개</b>를 골라 상대에게 공개해야 합니다.
          </div>
          ${hasFake ? `<div class="cb-fake-banner" style="margin-bottom:8px">黃帝 欺症 발동 중 — 어느 것을 골라도 <b>거짓 증상 "${esc(me.fakeSymptomNext)}"</b> 가 공개됩니다.</div>` : ''}
          <div style="margin:6px 0;font-size:11.5px;color:var(--mo-l)">증상 선택 (15초 — 미선택 시 첫 번째 자동):</div>
          <div class="cb-sym-grid">
            ${remaining.length
              ? remaining.map(s => `<button class="cb-sym-btn" type="button" data-sym="${esc(s)}">${esc(s)}</button>`).join('')
              : '<div style="color:var(--gutong);padding:8px">공개할 증상이 없습니다 (fake 만 공개)</div>'}
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--gutong);text-align:right" id="cb-deck-timer">15초</div>
        </div>
      </div>`;
    document.body.appendChild(m);

    let done = false;
    let remain = 15;
    const timerEl = m.querySelector('#cb-deck-timer');
    const tick = setInterval(() => {
      remain--;
      if(timerEl) timerEl.textContent = `${remain}초`;
      if(remain <= 0){
        clearInterval(tick);
        if(!done){ done = true; finish(remaining[0] || null); }
      }
    }, 1000);

    const finish = async (pick) => {
      if(m.parentNode) m.remove();
      try{
        await autoRevealOneSymptom(roomId, room, me, mySyn, {kind:'deck_empty', turnIdx, pick: pick||undefined});
      }catch(_){}
      resolve();
    };

    m.querySelectorAll('.cb-sym-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if(done) return; done = true; clearInterval(tick);
        finish(btn.dataset.sym);
      });
    });
  });
}

// 본초 카드 SVG HTML
// v7.5: 본초 맛(味) → 五行 팔레트 (전통: 辛→金, 甘→土, 苦→火, 酸→木, 鹹→水)
//   HERBS.sm 의 콤마 앞 부분 (예: "甘微苦,微溫" → "甘微苦") 의 첫 맛 글자로 결정.
//   微/大 같은 prefix 무시. 복합 맛은 주(主) 맛 = 첫 글자 원칙.
function herbTasteColor(sm){
  const fallback = {bg:'#F5E6D3', bd:'#876A36', accent:'#5E4920', taste:'?'};
  if(!sm) return fallback;
  const tasteSection = String(sm).split(',')[0] || '';
  // 첫 맛 글자만 추출 (微·大 등 강도 prefix 제거)
  const cleaned = tasteSection.replace(/[微大小極]/g, '');
  const first = cleaned[0] || '';
  switch(first){
    case '辛': return {bg:'#FFF1E4', bd:'#C97A3A', accent:'#7A3A14', taste:'辛'};
    case '甘': return {bg:'#FFF8D8', bd:'#B89A3A', accent:'#5E4920', taste:'甘'};
    case '苦': return {bg:'#FBE2E0', bd:'#9C3030', accent:'#5E1414', taste:'苦'};
    case '酸': return {bg:'#E2F3E5', bd:'#3D7E50', accent:'#1E5030', taste:'酸'};
    case '鹹':
    case '咸': return {bg:'#DDE7F5', bd:'#3D5E9C', accent:'#1E3060', taste:'鹹'};
    case '淡': return {bg:'#ECECEC', bd:'#7A7A7A', accent:'#3D3D3D', taste:'淡'};
    case '澁':
    case '澀': return {bg:'#E8DCC0', bd:'#7A5C30', accent:'#3D2E14', taste:'澁'};
    default:   return fallback;
  }
}

function renderHerbCardHTML(herb, opts){
  opts = opts || {};
  // HERBS 에서 약재 찾기 (han 또는 별칭)
  const h = (typeof HERBS !== 'undefined') ? HERBS.find(x => x.han === herb || x.han_alt === herb) : null;
  // v7.5: 맛 기준 五行 팔레트
  const c = herbTasteColor(h && h.sm);
  const ko    = (h && h.ko) ? h.ko : '';
  const click = opts.click ? `data-herb="${esc(herb)}" style="cursor:pointer"` : '';
  const klass = opts.selected ? 'cb-card-selected' : '';
  // v8.7 F4: 한자↔한글 토글 — S.herbLang='ko' 시 한글 우선, 한자 보조
  const koMode = (S && S.herbLang === 'ko' && ko);
  const main   = koMode ? ko   : herb;          // 큰 글자
  const sub    = koMode ? herb : ko;            // 보조 글자
  return `
    <div class="cb-herb-card ${klass}" ${click} style="background:${c.bg};border-color:${c.bd};color:${c.accent}">
      <div class="cb-herb-han">${esc(main)}</div>
      ${sub ? `<div class="cb-herb-ko">${esc(sub)}</div>` : ''}
      <div class="cb-herb-taste" style="font-size:9px;letter-spacing:.08em;opacity:.65;margin-top:2px;font-family:var(--font-display)">${esc(c.taste)}</div>
    </div>
  `;
}

// v8.7 F4: 본초 언어 토글 — 헤더 또는 카드 對決 UI 에서 호출
window.toggleHerbLang = function toggleHerbLang(){
  S.herbLang = (S.herbLang === 'ko') ? 'han' : 'ko';
  saveState();
  toast(S.herbLang === 'ko' ? '본초 한글 우선' : '본초 한자 우선', 'gold');
  // 현재 카드 對決 진행 중이면 즉시 리렌더
  try{
    if(_cardRoomState && _battleSessionMeta && _battleSessionMeta.mode === 'card'){
      renderCardBattle(_battleSessionMeta.roomId, _cardRoomState);
    }
  }catch(_){}
  // 헤더에 토글 상태 반영
  try{ refreshHeader(); }catch(_){}
};

// 증상 공개 모달 (자기 증상 1개 → 공개 OR 황제 스킬 fake 적용)
function openSymptomRevealModal(roomId, room, me, mySyn){
  const remaining = (mySyn.symptoms||[]).filter(s => !(me.revealedSymptoms||[]).includes(s));
  const usingFake = !!me.fakeSymptomNext;
  if(!remaining.length && !usingFake){ toast('공개할 증상이 없습니다','gold'); return; }

  const m = document.createElement('div');
  m.className = 'overlay';
  m.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-title">증상 공개</div>
      <div class="modal-body">
        ${usingFake ? `<div class="cb-fake-banner">黃帝 스킬 발동 중 — <b>거짓 증상: ${esc(me.fakeSymptomNext)}</b> 가 자동 공개됩니다.</div>` : ''}
        <div style="margin:8px 0 6px;font-size:12px;color:var(--mo-l)">자기 증상 중 하나를 골라 상대에게 공개합니다 (정직).</div>
        <div class="cb-sym-grid">
          ${remaining.map(s => `<button class="cb-sym-btn" type="button" data-sym="${esc(s)}">${esc(s)}</button>`).join('')}
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-o" id="cb-modal-close">닫기</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  $('#cb-modal-close').addEventListener('click', () => m.remove());
  m.querySelectorAll('.cb-sym-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sym = btn.dataset.sym;
      m.remove();
      try{
        const newRev = (me.revealedSymptoms||[]).slice();
        // 우선순위: 황제 fake 가 살아있으면 그것을 (자기 증과 무관한 증상으로) 공개, 자기가 고른 sym 은 그대로 노출 X (낭비됨)
        // 단 명세 단순화: fake 가 있으면 fake 만 공개되고 sym 은 무효 (자기 진짜 증상 보전)
        if(me.fakeSymptomNext){
          newRev.push(me.fakeSymptomNext);
          await FB.put(`card_battles/${roomId}/players/${S.userId}/revealedSymptoms`, newRev);
          await FB.put(`card_battles/${roomId}/players/${S.userId}/fakeSymptomNext`, null);
          appendCardLog(roomId, room, `${me.name}: 증상 공개 (黃帝 欺症)`);
        } else {
          newRev.push(sym);
          await FB.put(`card_battles/${roomId}/players/${S.userId}/revealedSymptoms`, newRev);
          appendCardLog(roomId, room, `${me.name}: 증상 공개 — ${sym}`);
        }
        await FB.put(`card_battles/${roomId}/lastActionAt`, Date.now());
        $('#cb-action-hint') && ($('#cb-action-hint').textContent = '증상 공개 완료. 전탕을 시도하거나 턴을 종료하세요.');
      }catch(e){ toast('공개 실패: '+e.message, 'red'); }
    });
  });
}

// 神급 스킬 모달
function openSkillModal(roomId, room, me, opp, skillMeta){
  const m = document.createElement('div');
  m.className = 'overlay';
  let bodyHtml = '';
  if(skillMeta.id === 'fake_symptom'){
    // 황제: 거짓 증상 1개 골라 next reveal 에 등록 (자기 證 외의 무작위 풀에서 선택 옵션 5개 표시)
    const myFid = SYNDROME_BY_ID[me.syndromeChosen]?.formulaId;
    const otherSyms = [];
    SYNDROMES.forEach(s => {
      if(s.formulaId === myFid) return;
      (s.symptoms||[]).forEach(x => { if(!otherSyms.includes(x)) otherSyms.push(x); });
    });
    const pool = otherSyms.sort(()=>Math.random()-0.5).slice(0, 6);
    bodyHtml = `
      <div style="font-size:12px;color:var(--mo-l);margin-bottom:8px">하나를 골라 다음 자기 증상 공개에 적용. 상대는 거짓 증상을 진실로 받아들임.</div>
      <div class="cb-sym-grid">
        ${pool.map(s => `<button class="cb-sym-btn" type="button" data-fake="${esc(s)}">${esc(s)}</button>`).join('')}
      </div>
    `;
  } else if(skillMeta.id === 'summon_herb'){
    // 신농: 텍스트 입력으로 본초 호출. v8.7 F1: datalist 자동완성 (덱 본초의 한자명 + 한글 alias)
    const deckHerbs = (room.deck||[]).slice();
    const datalistOpts = deckHerbs.map(h => {
      const meta = (typeof HERBS !== 'undefined') ? HERBS.find(x => x.han === h || x.han_alt === h) : null;
      const ko = meta && meta.ko ? meta.ko : '';
      return `<option value="${esc(h)}">${esc(h)}${ko?' ('+esc(ko)+')':''}</option>`;
    }).join('');
    bodyHtml = `
      <div style="font-size:12px;color:var(--mo-l);margin-bottom:8px">덱에 있는 본초의 한자명 1개를 입력하면 보드로 호출됩니다. <b>입력란을 클릭하면 덱 본초 목록이 자동완성</b> 됩니다 (한글로 검색해 한자 자동 선택 가능).</div>
      <input type="text" id="cb-summon-input" list="cb-summon-list" autocomplete="off"
             placeholder="예: 人蔘 (또는 인삼)" inputmode="text"
             style="width:100%;padding:8px;font-size:14px;border:1px solid var(--gutong);border-radius:6px;font-family:var(--font-display)">
      <datalist id="cb-summon-list">${datalistOpts}</datalist>
      <div style="font-size:11px;color:var(--gutong);margin-top:6px">덱 잔여: ${room.deck.length}장 (덱 본초만 호출 가능)</div>
      <div style="margin-top:8px"><button class="btn btn-gold" id="cb-summon-go">召喚</button></div>
    `;
  } else if(skillMeta.id === 'foresee_deck'){
    // 복희: 덱 상위 3장 미리 보기 (이미 본 적 없으면 표시)
    const top3 = (room.deck||[]).slice(0, 3);
    bodyHtml = `
      <div style="font-size:12px;color:var(--mo-l);margin-bottom:8px">덱 상위 3장을 미리 봅니다 (자기만).</div>
      <div class="cb-board" style="margin-bottom:8px">
        ${top3.length ? top3.map(h => renderHerbCardHTML(h)).join('') : '<div class="cb-empty">덱이 비었습니다</div>'}
      </div>
      <div style="margin-top:8px"><button class="btn btn-gold" id="cb-foresee-go">확인 (스킬 사용)</button></div>
    `;
  } else if(skillMeta.id === 'transmute_board'){
    // 여와: 보드 본초 1장 선택 → 덱에서 무작위 1장과 교체
    bodyHtml = `
      <div style="font-size:12px;color:var(--mo-l);margin-bottom:8px">보드의 본초 1장을 골라 덱에서 무작위 1장과 교체. (덱 비어있으면 효과 없음)</div>
      <div class="cb-board">
        ${(room.board||[]).map(h => `<div class="cb-herb-card cb-card-pickable" data-herb="${esc(h)}" style="cursor:pointer">${renderHerbCardHTML(h).replace(/<div class="cb-herb-card[^>]*>/,'').replace(/<\/div>$/,'')}</div>`).join('')}
      </div>
    `;
  } else if(skillMeta.id === 'reveal_monarch'){
    // 기백: 자기 정답 처방의 君藥 중 하나를 보드로
    const fid = SYNDROME_BY_ID[me.syndromeChosen]?.formulaId;
    const f = FORMULAS.find(x => x.id === fid);
    const monarchList = (f && f.monarch_minister && f.monarch_minister['君']) || [];
    bodyHtml = `
      <div style="font-size:12px;color:var(--mo-l);margin-bottom:8px">자기 정답 처방의 君藥 중 하나를 보드로 끌어옵니다. 보드에 이미 있는 것은 효과 없이 사용됨.</div>
      <div class="cb-board">
        ${monarchList.length ? monarchList.map(h => renderHerbCardHTML(h, {click:true})).join('') : '<div class="cb-empty">君藥 정보 없음</div>'}
      </div>
    `;
  }

  m.innerHTML = `
    <div class="modal" style="max-width:560px">
      <div class="modal-title">神급 스킬: ${esc(skillMeta.han)} (${esc(skillMeta.ko)})</div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-foot">
        <button class="btn btn-o" id="cb-skill-close">취소</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  $('#cb-skill-close').addEventListener('click', () => m.remove());

  if(skillMeta.id === 'fake_symptom'){
    m.querySelectorAll('[data-fake]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fk = btn.dataset.fake;
        m.remove();
        playSkillFX('huangdi', '欺');  // v8.7 F2
        try{
          await FB.put(`card_battles/${roomId}/players/${S.userId}/fakeSymptomNext`, fk);
          await FB.put(`card_battles/${roomId}/players/${S.userId}/skillUsed`, true);
          appendCardLog(roomId, room, `${me.name}: 黃帝 欺症 발동`);
          await FB.put(`card_battles/${roomId}/lastActionAt`, Date.now());
        }catch(e){ toast('스킬 실패: '+e.message, 'red'); }
      });
    });
  } else if(skillMeta.id === 'summon_herb'){
    $('#cb-summon-go').addEventListener('click', async () => {
      let v = ($('#cb-summon-input').value||'').trim();
      if(!v){ toast('본초 한자를 입력하세요','gold'); return; }
      // v8.7 F1: 한글 입력 → 한자 매핑 (HERBS.ko 로 검색)
      if(!/[\u4e00-\u9fff]/.test(v) && typeof HERBS !== 'undefined'){
        const m = HERBS.find(x => x.ko === v || (x.ko && x.ko.replace(/\s/g,'') === v.replace(/\s/g,'')));
        if(m) v = m.han;
      }
      const idx = (room.deck||[]).indexOf(v);
      if(idx < 0){ toast('덱에 없는 본초입니다 (입력: '+v+')','red'); return; }
      m.remove();
      playSkillFX('shennong', '草');  // v8.7 F2
      try{
        const newDeck = room.deck.slice(); newDeck.splice(idx, 1);
        const newBoard = (room.board||[]).slice(); newBoard.push(v);
        await FB.put(`card_battles/${roomId}/deck`, newDeck);
        await FB.put(`card_battles/${roomId}/board`, newBoard);
        await FB.put(`card_battles/${roomId}/players/${S.userId}/skillUsed`, true);
        appendCardLog(roomId, room, `${me.name}: 神農 召草 — ${v}`);
        await FB.put(`card_battles/${roomId}/lastActionAt`, Date.now());
      }catch(e){ toast('스킬 실패: '+e.message, 'red'); }
    });
  } else if(skillMeta.id === 'foresee_deck'){
    $('#cb-foresee-go').addEventListener('click', async () => {
      m.remove();
      playSkillFX('fuxi', '卦');  // v8.7 F2
      try{
        await FB.put(`card_battles/${roomId}/players/${S.userId}/skillUsed`, true);
        appendCardLog(roomId, room, `${me.name}: 伏羲 卦知 — 덱 預知`);
        await FB.put(`card_battles/${roomId}/lastActionAt`, Date.now());
      }catch(e){ toast('스킬 실패: '+e.message, 'red'); }
    });
  } else if(skillMeta.id === 'transmute_board'){
    m.querySelectorAll('.cb-card-pickable').forEach(el => {
      el.addEventListener('click', async () => {
        const h = el.dataset.herb;
        if(!room.deck.length){ toast('덱이 비어 교체 불가','gold'); return; }
        m.remove();
        playSkillFX('nvwa', '化');  // v8.7 F2
        try{
          const newDeck = room.deck.slice();
          const dIdx = Math.floor(Math.random()*newDeck.length);
          const draw = newDeck.splice(dIdx, 1)[0];
          newDeck.push(h);  // 교체된 보드 본초는 덱 끝으로
          const newBoard = (room.board||[]).slice();
          const bIdx = newBoard.indexOf(h);
          if(bIdx >= 0) newBoard[bIdx] = draw;
          await FB.put(`card_battles/${roomId}/deck`, newDeck);
          await FB.put(`card_battles/${roomId}/board`, newBoard);
          await FB.put(`card_battles/${roomId}/players/${S.userId}/skillUsed`, true);
          appendCardLog(roomId, room, `${me.name}: 女媧 造化 — ${h} → ${draw}`);
          await FB.put(`card_battles/${roomId}/lastActionAt`, Date.now());
        }catch(e){ toast('스킬 실패: '+e.message, 'red'); }
      });
    });
  } else if(skillMeta.id === 'reveal_monarch'){
    m.querySelectorAll('[data-herb]').forEach(el => {
      el.addEventListener('click', async () => {
        const h = el.dataset.herb;
        m.remove();
        playSkillFX('qibo', '問');  // v8.7 F2
        try{
          // 보드에 이미 있으면 효과 없이 스킬만 소진
          let logMsg = `${me.name}: 岐伯 問難 — ${h}`;
          if(!(room.board||[]).includes(h)){
            // 덱에서 제거 (있으면)
            const newDeck = room.deck.slice();
            const di = newDeck.indexOf(h);
            if(di >= 0) newDeck.splice(di, 1);
            const newBoard = (room.board||[]).slice();
            newBoard.push(h);
            await FB.put(`card_battles/${roomId}/deck`, newDeck);
            await FB.put(`card_battles/${roomId}/board`, newBoard);
          } else {
            logMsg += ' (이미 보드에 존재, 효과 없음)';
          }
          await FB.put(`card_battles/${roomId}/players/${S.userId}/skillUsed`, true);
          appendCardLog(roomId, room, logMsg);
          await FB.put(`card_battles/${roomId}/lastActionAt`, Date.now());
        }catch(e){ toast('스킬 실패: '+e.message, 'red'); }
      });
    });
  }
}

// 전탕 시도 모달 (26 처방 중 1개 선택)
// v7.2: 힌트 제거 — "시도 가능 처방" 분류와 "부족 본초" 노출 모두 폐기.
//   사용자는 보드 本草를 직접 보고 추리해 26 처방 중 골라야 한다.
//   본초 부족 / 오답 판정은 클릭 후 attemptDecoct 에서 처리.
function openDecoctModal(roomId, room, me, opp){
  // 26 처방을 章 → 처방 순서로 정렬 (게임 내 일관된 순서 유지)
  const formulas = FORMULAS.slice().sort((a,b) => {
    const ca = (a.chapter||'').localeCompare(b.chapter||'');
    if(ca !== 0) return ca;
    return (a.id||'').localeCompare(b.id||'');
  });

  const m = document.createElement('div');
  m.className = 'overlay';
  m.innerHTML = `
    <div class="modal" style="max-width:640px">
      <div class="modal-title">전탕 시도 (煎湯)</div>
      <div class="modal-body">
        <div style="font-size:12px;color:var(--mo-l);margin-bottom:10px;line-height:1.55">
          26 처방 중 하나를 선택. 상대 證에 맞는 처방이면 즉시 승리,
          아니면 턴 손실. 보드 本草만으로 추리하세요.
        </div>
        <div class="cb-formula-grid">
          ${formulas.map(f => `
            <button class="cb-formula-btn" type="button" data-fid="${esc(f.id)}">
              <div class="cb-formula-han">${esc(f.han)}</div>
              <div class="cb-formula-ko">${esc(f.ko)}</div>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-o" id="cb-decoct-close">취소</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  $('#cb-decoct-close').addEventListener('click', () => m.remove());
  m.querySelectorAll('[data-fid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fid = btn.dataset.fid;
      m.remove();
      await attemptDecoct(roomId, room, me, opp, fid);
    });
  });
}

// 전탕 판정
// v7.2g: 본초 부족 = 오답과 완전 동일 처리 (페널티 증상 공개 + 턴 손실).
//   26회 brute-force 차단. 어떤 본초가 부족한지는 노출하지 않음.
async function attemptDecoct(roomId, room, me, opp, formulaId){
  const f = FORMULAS.find(x => x.id === formulaId);
  if(!f){ toast('처방 데이터 없음','red'); return; }
  const board   = new Set(room.board||[]);
  const haveAll = f.composition.every(h => board.has(h));
  const oppFid  = SYNDROME_BY_ID[opp.syndromeChosen]?.formulaId;
  const correct = haveAll && (formulaId === oppFid);

  // 로그 — 본초 부족도 시도 횟수에 포함, 공개 로그에 별도 표기
  let logTag;
  if(correct)       logTag = '✓ 정답';
  else if(!haveAll) logTag = '✗ 본초 부족';
  else              logTag = '✗ 오답';
  appendCardLog(roomId, room, `${me.name}: 전탕 시도 — ${f.han} → ${logTag}`);

  if(correct){
    await settleCardBattle(roomId, room, S.userId, 'attack', formulaId);
    return;
  }
  // 본초 부족 + 오답 둘 다 → 페널티 (자기 증상 강제 공개) + 턴 손실
  const msg = haveAll
    ? `✗ 오답 — 자기 증상 1개를 공개해야 합니다`
    : `✗ 본초 부족 — 자기 증상 1개를 공개해야 합니다`;
  toast(msg, 'red');
  const mySyn = SYNDROME_BY_ID[me.syndromeChosen];
  await openPenaltyRevealModal(roomId, room, me, mySyn, f);
  await endCardTurn(roomId, room);
}

// v7.3: 페널티 공개 모달 — 자기 미공개 증상 중 1개 강제 선택
//   黃帝 fakeSymptomNext 가 있으면 모달 표시 후 자동 적용 (사용자 선택 무의미)
//   타임아웃 6초 — 응답 없으면 무작위 선택
function openPenaltyRevealModal(roomId, room, me, mySyn, attemptedFormula){
  return new Promise((resolve) => {
    const remaining = (mySyn.symptoms||[]).filter(s => !(me.revealedSymptoms||[]).includes(s));
    const hasFake = !!me.fakeSymptomNext;
    // 더 공개할 게 없고 fake 도 없으면 즉시 resolve (게임 막바지)
    if(!remaining.length && !hasFake){
      toast('공개할 증상이 더 없습니다','gold');
      resolve(); return;
    }

    const m = document.createElement('div');
    m.className = 'overlay';
    m.innerHTML = `
      <div class="modal" style="max-width:520px">
        <div class="modal-title" style="color:var(--zhusha-d)">⚠ 페널티 — 자기 증상 1개 공개</div>
        <div class="modal-body">
          <div style="margin-bottom:10px;font-size:12.5px;color:var(--mo)">
            전탕 시도 (<b>${esc(attemptedFormula.han)}</b>)가 빗나갔습니다.
            추측 리스크로 <b style="color:var(--zhusha-d)">자기 證 증상 1개</b>를 골라 상대에게 공개해야 합니다.
          </div>
          ${hasFake ? `<div class="cb-fake-banner" style="margin-bottom:8px">黃帝 欺症 발동 중 — 어느 것을 골라도 <b>거짓 증상 "${esc(me.fakeSymptomNext)}"</b> 가 공개됩니다.</div>` : ''}
          <div style="margin:6px 0;font-size:11.5px;color:var(--mo-l)">남은 증상 (6초 안에 선택 — 미선택 시 무작위):</div>
          <div class="cb-sym-grid" id="cb-penalty-grid">
            ${remaining.length
              ? remaining.map(s => `<button class="cb-sym-btn" type="button" data-sym="${esc(s)}">${esc(s)}</button>`).join('')
              : '<div style="color:var(--gutong);padding:8px">남은 미공개 증상 없음 (fake 만 공개)</div>'}
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--gutong);text-align:right" id="cb-penalty-timer">6초</div>
        </div>
      </div>`;
    document.body.appendChild(m);

    let done = false;
    let remain = 6;
    const timerEl = m.querySelector('#cb-penalty-timer');
    const tick = setInterval(() => {
      remain--;
      if(timerEl) timerEl.textContent = `${remain}초`;
      if(remain <= 0){
        clearInterval(tick);
        if(!done){ done = true; finish(null); }
      }
    }, 1000);

    const finish = async (pick) => {
      if(m.parentNode) m.remove();
      try{
        await autoRevealOneSymptom(roomId, room, me, mySyn, {kind:'penalty', pick: pick||undefined});
      }catch(_){}
      resolve();
    };

    m.querySelectorAll('.cb-sym-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if(done) return; done = true; clearInterval(tick);
        finish(btn.dataset.sym);
      });
    });
  });
}

// 턴 종료 (덱 1장 보드로 + 상대로 턴 넘김)
async function endCardTurn(roomId, room){
  const r = await FB.get(`card_battles/${roomId}`);
  if(!r || r.status !== 'playing') return;
  const oppU = Object.keys(r.players).find(u => u !== S.userId);
  // 덱에서 1장 보드로 (덱 있을 때만)
  const newDeck = (r.deck||[]).slice();
  const newBoard= (r.board||[]).slice();
  if(newDeck.length){
    const draw = newDeck.shift();
    newBoard.push(draw);
  }
  const newIdx = (r.turnIdx||0) + 1;
  try{
    await FB.put(`card_battles/${roomId}/deck`, newDeck);
    await FB.put(`card_battles/${roomId}/board`, newBoard);
    await FB.put(`card_battles/${roomId}/turn`, oppU);
    await FB.put(`card_battles/${roomId}/turnIdx`, newIdx);
    await FB.put(`card_battles/${roomId}/lastActionAt`, Date.now());
  }catch(e){ toast('턴 종료 실패: '+e.message, 'red'); }
}

// v8.7 F2: 神급 스킬 발동 시 풀스크린 시각 이펙트 (1.5초)
//   char: 'huangdi'·'shennong'·'fuxi'·'nvwa'·'qibo'
//   han: 표시할 한자 1글자 (스킬의 han)
function playSkillFX(char, han){
  try{
    const fx = document.createElement('div');
    fx.className = 'skill-fx fx-' + (char||'qibo');
    let particles = '';
    for(let i=0; i<24; i++){
      const ang = (Math.PI * 2 * i) / 24;
      const r = 40 + Math.random() * 30;
      const dx = Math.cos(ang) * r;
      const dy = Math.sin(ang) * r;
      const delay = Math.random() * 0.2;
      particles += `<span style="left:50%;top:50%;--dx:${dx}px;--dy:${dy}px;animation-delay:${delay}s"></span>`;
    }
    fx.innerHTML = `
      <div class="skill-fx-particles">${particles}</div>
      <div class="skill-fx-han">${esc(han||'神')}</div>
    `;
    document.body.appendChild(fx);
    setTimeout(() => { try{ fx.remove(); }catch(_){} }, 1700);
  }catch(_){}
}

// 게임 로그 추가
async function appendCardLog(roomId, room, msg){
  try{
    const log = (room.log||[]).slice();
    log.push({ts: Date.now(), msg});
    if(log.length > 50) log.splice(0, log.length-50);
    await FB.put(`card_battles/${roomId}/log`, log);
  }catch(_){}
}

// 정산
async function settleCardBattle(roomId, room, winnerUid, reason, attackedFormula){
  try{
    const r = await FB.get(`card_battles/${roomId}`);
    if(!r) return;
    if(r.status === 'done') return;
    const result = {
      winner: winnerUid,
      by: reason,
      attackedFormula: attackedFormula||null,
      finishedAt: Date.now()
    };
    await FB.put(`card_battles/${roomId}/result`, result);
    await FB.put(`card_battles/${roomId}/status`, 'done');
  }catch(e){ toast('정산 실패: '+e.message, 'red'); }
}

// 결과 화면
async function renderCardResult(roomId, room, me, opp){
  // v7.2: 결과 화면 진입 — 탭 이탈 가드 해제
  _inBattleSession = false;
  _battleSessionMeta = null;
  // v9.7: 솔로 모드 복원 (시그니처 효과 재가동)
  try{ if(window.V97Sig) window.V97Sig.setMode('solo'); }catch(_){}
  if(_cardChooseTimer){ clearInterval(_cardChooseTimer); _cardChooseTimer=null; }
  const stage = $('#cb-stage');
  const res = room.result || {};
  let outcome = 'draw';
  if(res.winner === S.userId) outcome = 'win';
  else if(res.winner && res.winner !== S.userId) outcome = 'loss';
  const oppSyn = SYNDROME_BY_ID[opp.syndromeChosen];
  const mySyn  = SYNDROME_BY_ID[me.syndromeChosen];
  const bet    = room.bet || 0;
  const han    = outcome==='win'?'勝':(outcome==='loss'?'敗':'和');

  // 한 번만 정산 (양측이 각자 자기 record 만 갱신)
  if(!room._settled || !room._settled[S.userId]){
    try{
      if(outcome === 'win'){ S.qi += bet * 2; }
      else if(outcome === 'draw'){ S.qi += bet; }
      // loss 는 추가 없음 (이미 베팅 차감됨)
      // v8.7 F5: 카드 對決 별도 전적 기록 (5지선다 battleHistory 와 분리)
      S.cardBattleHistory = S.cardBattleHistory || [];
      S.cardBattleHistory.unshift({
        ts: Date.now(),
        win: outcome === 'win',
        draw: outcome === 'draw',
        forfeit: res.by === 'forfeit' || res.by === 'inactivity',
        bet,
        deltaQi: outcome==='win' ? bet : (outcome==='loss' ? -bet : 0),
        opponentName: opp.name,
        opponentChar: opp.character,
        opponentSyn: opp.syndromeChosen || null,
        mySyn: me.syndromeChosen || null,
        by: res.by || 'unknown',
        attackedFormula: res.attackedFormula || null
      });
      if(S.cardBattleHistory.length > 20) S.cardBattleHistory = S.cardBattleHistory.slice(0, 20);
      saveState();
      // v9.7: 업적 추적 — 카드 對決 결과
      try{
        if(window.V97Ach){
          const lvlIdx = (typeof BET_LEVELS !== 'undefined') ? (BET_LEVELS.findIndex(l => l.id === room.level) + 1) : 0;
          window.V97Ach.recordBattle({
            outcome: outcome === 'loss' ? 'lose' : outcome,
            betLevel: lvlIdx,
          });
        }
      }catch(_){}
      await FB.put(`card_battles/${roomId}/_settled/${S.userId}`, true);
      // record 갱신 (5지선다와 통합 W/L — 기존 동작 유지)
      if(FB && S.userId){
        const rec = (await FB.get(`stats/records/${S.userId}`)) || {w:0, l:0, d:0};
        if(outcome === 'win') rec.w = (rec.w||0)+1;
        else if(outcome === 'loss') rec.l = (rec.l||0)+1;
        else rec.d = (rec.d||0)+1;
        rec.lastTs = Date.now();
        await FB.put(`stats/records/${S.userId}`, rec);
      }
    }catch(_){}
  }
  // BGM 전환
  try{
    if(outcome === 'win' && bgm.startVictory) bgm.startVictory();
    else if(outcome === 'loss' && bgm.startDefeat) bgm.startDefeat();
    else if(bgm.stopBattle) bgm.stopBattle();
  }catch(_){}

  stage.innerHTML = `
    <div style="text-align:center;padding:20px 8px">
      <div style="font-family:var(--font-display);font-size:68px;color:${outcome==='win'?'#FFD700':(outcome==='loss'?'#444':'var(--gutong)')};${outcome==='win'?'text-shadow:0 0 20px rgba(255,215,0,0.6)':''};margin-bottom:8px">${han}</div>
      <div style="font-size:14px;color:var(--mo);margin-bottom:14px">
        ${outcome==='win'?`+${bet.toLocaleString()} 氣 획득`:(outcome==='loss'?`-${bet.toLocaleString()} 氣 손실`:`±0 氣 (환불)`)}
      </div>
      <div class="card" style="text-align:left;font-size:12.5px;max-width:520px;margin:0 auto">
        <div><b>상대 證</b>: ${esc(oppSyn?.han||'?')} (${esc(oppSyn?.ko||'?')})</div>
        <div><b>나의 證</b>: ${esc(mySyn?.han||'?')} (${esc(mySyn?.ko||'?')})</div>
        ${res.attackedFormula ? `<div><b>승부 처방</b>: ${esc(FORMULAS.find(f=>f.id===res.attackedFormula)?.han||res.attackedFormula)}</div>` : ''}
        <div style="margin-top:8px;color:var(--gutong)">종료 사유: ${esc(res.by||'unknown')}</div>
      </div>
      <div style="margin-top:14px;display:flex;gap:6px;justify-content:center">
        <button class="btn" onclick="setTab('hall')">大廳으로</button>
        <button class="btn btn-gold" onclick="joinCardBattleQueue()">다시 카드 對決</button>
      </div>
    </div>
  `;

  // v9.0 자율 매치: 결과 화면 진입 후 5초 뒤 방 정리. 양측 모두 시도 (DEL 은 멱등).
  setTimeout(async () => { try{ await FB.del(`card_battles/${roomId}`); }catch(_){} }, 8000);
}

// 페이지 떠날 때 스트림 정리
function stopCardStreams(){
  try{
    if(_cardLobbyStream){ _cardLobbyStream.close(); _cardLobbyStream=null; }
    if(_cardBattlesStream){ _cardBattlesStream.close(); _cardBattlesStream=null; }
    if(_cardRoomStream){ _cardRoomStream.close(); _cardRoomStream=null; }
    if(_cardChooseTimer){ clearInterval(_cardChooseTimer); _cardChooseTimer=null; }
    if(_cardLoadWatchdog){ clearTimeout(_cardLoadWatchdog); _cardLoadWatchdog=null; }  // v8.5
    if(_cardInactivityTimer){ clearTimeout(_cardInactivityTimer); _cardInactivityTimer=null; }  // v8.7
    // v9.6: 채팅 정리 + AI 룸 정리
    if(typeof window.V96Chat !== 'undefined' && window._v96CurrentChatCtx){
      V96Chat.unmount(window._v96CurrentChatCtx);
      window._v96CurrentChatCtx = null;
    }
    if(typeof window.V96CardAI !== 'undefined'){
      try{ V96CardAI.stop(); }catch(_){}
    }
  }catch(_){}
}

// v8.3: 원격 wipe 메커니즘
//   Firebase 의 /system/wipeAt 노드에 timestamp(ms) 를 게시하면
//   각 사용자가 다음 PWA 로드 시 자동으로 localStorage 청소 + reload.
//   bangje.* / quiz.* prefix 의 모든 localStorage 키 청소.
//   청소 후 wipeAt 값을 bangje.wipeAck.v1 에 기록 → 동일 wipe 신호는 1회만 실행.
async function checkRemoteWipe(){
  if(!FB) return false;
  try{
    const remote = await FB.get('system/wipeAt');
    const remoteN = parseInt(remote, 10);
    if(!remoteN || remoteN <= 0) return false;
    const localAck = parseInt(localStorage.getItem('bangje.wipeAck.v1')||'0', 10);
    if(remoteN <= localAck) return false;
    // 청소 대상: bangje.* 와 quiz.* prefix (사용자 데이터). wipeAck 자체는 보존.
    const keysToWipe = [];
    for(let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if(!k) continue;
      if(k === 'bangje.wipeAck.v1') continue;
      if(k.startsWith('bangje.') || k.startsWith('quiz.')) keysToWipe.push(k);
    }
    keysToWipe.forEach(k => localStorage.removeItem(k));
    localStorage.setItem('bangje.wipeAck.v1', String(remoteN));
    // 사용자에게 짧게 알리고 새로고침
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
                  flex-direction:column;gap:14px;
                  font-family:'Noto Serif KR',serif;background:#FAF7EF;color:#9C3030">
        <div style="font-size:48px">掃</div>
        <div style="font-size:16px">관리자 청소 적용 — 새로 시작합니다</div>
        <div style="font-size:11px;color:#888">${new Date(remoteN).toLocaleString('ko-KR')}</div>
      </div>`;
    setTimeout(() => location.reload(), 900);
    return true;
  }catch(_){ return false; }
}

function init(){
  // v8.3: 원격 wipe 체크 우선. wipe 발견 시 청소 + reload → 이후 단계 무시.
  checkRemoteWipe().then(wiped => {
    if(wiped) return;
    _initContinue();
  });
}

function _initContinue(){
  loadState();
  refreshHeader();
  // 헤더 칩 클릭
  $('#rank-chip').addEventListener('click', () => setTab('hall'));
  $('#qi-chip').addEventListener('click', () => setTab('hall'));
  $('#bgm-chip').addEventListener('click', () => bgm.toggle());
  // 네비
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  // v8.2: 관리자 패널 hidden 진입
  //   ① URL hash 가 #admin 이면 자동 진입 (예: index.html#admin)
  //   ② 헤더의 朱砂 도장(rank-chip) 5초 안에 5회 연타로 진입
  const hashIsAdmin = () => (location.hash || '').toLowerCase() === '#admin';
  let firstTab = S.lastTab || 'home';
  if(hashIsAdmin()) firstTab = 'admin';
  setTab(firstTab);
  // 朱砂 5연타 카운터
  let _adminTaps = []; const _ADMIN_TAP_WINDOW = 5000;
  const rankChip = $('#rank-chip');
  if(rankChip){
    rankChip.addEventListener('click', () => {
      const now = Date.now();
      _adminTaps = _adminTaps.filter(t => now - t < _ADMIN_TAP_WINDOW);
      _adminTaps.push(now);
      if(_adminTaps.length >= 5){
        _adminTaps = [];
        toast('관리자 패널 진입', 'gold');
        setTab('admin');
      }
    });
  }
  window.addEventListener('hashchange', () => { if(hashIsAdmin()) setTab('admin'); });
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
        // v7: 카드 對決 큐 정리
        FB.delKeepalive(`lobby_card/${S.userId}`);
      }
    }catch(_){}
  };
  window.addEventListener('pagehide', unloadCleanup);
  window.addEventListener('beforeunload', unloadCleanup);

  // v3: 첫 user-gesture 감지 — AudioContext.resume()이 안전해지는 시점.
  //     capture phase에서 1회만 잡고 제거. 이후 hall 진입 시 BGM 자동 재생 가능.
  //     v4: 동시에 SpeechSynthesis voice 목록 prefetch (voiceschanged 이벤트 대기).
  const markGesture = () => {
    bgm.userGestureSeen = true;
    document.removeEventListener('pointerdown', markGesture, true);
    document.removeEventListener('keydown', markGesture, true);
    // 사용자가 명시적으로 BGM을 끈 적이 없고, 현재 hall 화면이면 즉시 시작
    if(!bgm.userDisabled && !bgm.on && (S.lastTab === 'hall' || S.lastTab === 'home')){
      try{ bgm.autoStartAmbient(); }catch(_){}
    }
    // v4: TTS voice 사전 로딩
    try{ tts.init(); }catch(_){}
  };
  document.addEventListener('pointerdown', markGesture, true);
  document.addEventListener('keydown', markGesture, true);
}

document.addEventListener('DOMContentLoaded', init);
if(document.readyState === 'interactive' || document.readyState === 'complete') init();
