/* bangje-v96.js — v9.6 확장 모듈
 * ============================================================================
 *   ① 채팅 모듈 (card_battle · cube_room 공용)
 *   ② presence activity 추적 + 클릭 상세 모달 (전적·진영·캐릭터·현재 활동)
 *   ③ 2시간의전사 (반복 학습 무점수 기출 위주)
 *   ④ AI 대국 — 카드 對決 (證 추리) · 방미큐브 (本草 set 그리디)
 *
 * 의존: FB, S, FORMULAS, FORMULAS_EXTRA, HERBS, HERB_NORM_INDEX, PHYSICIANS,
 *      PHYSICIAN_BY_ID, FACTIONS, FACTION_BY_ID, SYNDROMES, SYNDROME_BY_ID,
 *      PAST_EXAMS, BULK_QUESTIONS, esc, toast, $, $$, view, BC (방미큐브)
 * Firebase: card_battles/{rid}/chat/*, cube_rooms/{rid}/chat/*
 * 단일 IIFE — 전역 노출은 window 에 명시한 항목만.
 * ============================================================================ */
(function(){
'use strict';

const V96_VER = '9.6';

// ─ 유틸 ────────────────────────────────────────────────────────────────────
const $   = (q,r) => (r||document).querySelector(q);
const $$  = (q,r) => Array.from((r||document).querySelectorAll(q));
const esc_= (s) => (typeof esc === 'function')
  ? esc(s)
  : String(s||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const toast_ = (m,k) => { if(typeof toast === 'function') toast(m,k); };
const fb_  = () => (typeof FB !== 'undefined' && FB) || null;
const view_ = () => document.getElementById('view');
const now  = () => Date.now();
const sleep= (ms) => new Promise(r => setTimeout(r, ms));

// ════════════════════════════════════════════════════════════════════════════
// 1. 채팅 모듈 (Chat) — card_battle · cube_room 공용
// ────────────────────────────────────────────────────────────────────────────
// 사용 패턴 (호스트 코드에서):
//   const ctx = V96Chat.mount({node: `card_battles/${rid}/chat`,
//                              container: '#chat-host',
//                              presets: [...], max: 30, isLocal: false});
//   V96Chat.unmount(ctx)   // 정리
// ════════════════════════════════════════════════════════════════════════════

const PRESETS_CARD = [
  '잘 부탁드립니다',
  '재밌네요',
  '한 수 배웁니다',
  '훌륭한 處方',
  '아 …',
  '아쉽네요',
  'GG (수고하셨습니다)',
];
const PRESETS_CUBE = [
  '잘 부탁드립니다',
  '내 차례 입니다',
  '좋은 處方',
  '아 …',
  '한 장만…',
  '거의 다 비었어',
  'GG (수고하셨습니다)',
];

const Chat = (function(){
  const _ctxs = {};
  let _seq = 0;

  function mount(opts){
    const id = (++_seq).toString(36) + Math.random().toString(36).slice(2,5);
    const ctx = {
      id,
      node: opts.node,
      isLocal: !!opts.isLocal,
      localMsgs: [],
      stream: null,
      pollTimer: null,
      presets: opts.presets || PRESETS_CARD,
      max: opts.max || 30,
      onSend: opts.onSend || null,
      destroyed: false,
    };
    _ctxs[id] = ctx;
    const host = (typeof opts.container === 'string')
      ? document.querySelector(opts.container)
      : opts.container;
    if(!host){ console.warn('[V96Chat] container 없음', opts.container); return ctx; }
    host.innerHTML = `
      <div class="chat-card" data-cid="${id}">
        <div class="chat-head">
          <span class="han">話</span>
          <span class="chat-title">대화 (對局 채팅)</span>
          <button class="chat-toggle" type="button" title="접기/펴기">▾</button>
        </div>
        <div class="chat-body">
          <div class="chat-log" id="chat-log-${id}">
            <div class="chat-empty">아직 메시지가 없습니다. 한 마디 건네 보세요.</div>
          </div>
          <div class="chat-presets" id="chat-presets-${id}">
            ${ctx.presets.map((p,i) => `<button class="chat-preset" type="button" data-i="${i}">${esc_(p)}</button>`).join('')}
          </div>
          <div class="chat-input-row">
            <input id="chat-in-${id}" class="chat-input" maxlength="80" placeholder="자유 입력 (최대 80자)…">
            <button class="chat-send" id="chat-send-${id}" type="button">보내기</button>
          </div>
        </div>
      </div>`;
    const root = host.querySelector(`.chat-card[data-cid="${id}"]`);
    const inp  = root.querySelector(`#chat-in-${id}`);
    const send = root.querySelector(`#chat-send-${id}`);
    const togg = root.querySelector('.chat-toggle');
    togg.addEventListener('click', () => {
      const collapsed = root.classList.toggle('collapsed');
      togg.textContent = collapsed ? '▸' : '▾';
    });
    root.querySelectorAll('.chat-preset').forEach(b => {
      b.addEventListener('click', () => {
        const i = +b.dataset.i;
        const msg = ctx.presets[i];
        if(msg) sendMsg(ctx, msg);
      });
    });
    const doSend = () => {
      const v = (inp.value||'').trim();
      if(!v) return;
      inp.value = '';
      sendMsg(ctx, v);
    };
    send.addEventListener('click', doSend);
    inp.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){ e.preventDefault(); doSend(); }
    });
    startSub(ctx);
    return ctx;
  }

  function unmount(ctx){
    if(!ctx || ctx.destroyed) return;
    ctx.destroyed = true;
    try{ if(ctx.stream && typeof ctx.stream.close==='function') ctx.stream.close(); }catch(_){}
    if(ctx.pollTimer){ clearInterval(ctx.pollTimer); ctx.pollTimer = null; }
    delete _ctxs[ctx.id];
  }

  function unmountAll(){
    Object.values(_ctxs).forEach(unmount);
  }

  async function sendMsg(ctx, txt){
    if(ctx.destroyed) return;
    const msg = {
      uid: (typeof S !== 'undefined' && S && S.userId) || 'anon',
      name: (typeof S !== 'undefined' && S && S.name) || '익명',
      char: (typeof S !== 'undefined' && S && S.character) || null,
      faction: (typeof S !== 'undefined' && S && S.faction) || '',
      msg: String(txt).slice(0, 80),
      ts: now(),
    };
    // v9.7: 업적 추적 — 채팅 게시
    try{ if(window.V97Ach) window.V97Ach.recordChat(); }catch(_){}
    if(ctx.onSend){
      try{ await ctx.onSend(msg); }catch(_){}
    }
    if(ctx.isLocal){
      ctx.localMsgs.push(msg);
      ctx.localMsgs = ctx.localMsgs.slice(-ctx.max);
      _renderLog(ctx, ctx.localMsgs);
      return;
    }
    const f = fb_();
    if(!f){
      ctx.localMsgs.push(msg);
      _renderLog(ctx, ctx.localMsgs);
      return;
    }
    try{
      await f.push(ctx.node, msg);
    }catch(e){
      toast_('전송 실패: '+(e&&e.message||'?'), 'red');
    }
  }

  function _renderLog(ctx, msgsObj){
    const el = document.getElementById(`chat-log-${ctx.id}`);
    if(!el) return;
    let msgs = [];
    if(Array.isArray(msgsObj)) msgs = msgsObj;
    else if(msgsObj && typeof msgsObj === 'object'){
      msgs = Object.values(msgsObj);
    }
    msgs = msgs.filter(m => m && m.msg).sort((a,b) => (a.ts||0) - (b.ts||0));
    if(!msgs.length){
      el.innerHTML = '<div class="chat-empty">아직 메시지가 없습니다. 한 마디 건네 보세요.</div>';
      return;
    }
    const myUid = (typeof S !== 'undefined' && S && S.userId) || '';
    el.innerHTML = msgs.slice(-ctx.max).map(m => {
      const isMine = m.uid === myUid;
      const isAI = m.uid && String(m.uid).startsWith('ai_');
      const fac = m.faction ? (typeof FACTION_BY_ID !== 'undefined' && FACTION_BY_ID[m.faction]) : null;
      const facHan = fac ? fac.han2 : '';
      const facColor = fac ? fac.color : 'var(--gutong)';
      const tm = _hhmm(m.ts);
      return `<div class="chat-msg ${isMine?'mine':''} ${isAI?'is-ai':''}">
        <span class="chat-name">${isAI?'<span class="chat-ai-badge">AI</span>':''}${esc_(m.name||'?')}${facHan?`<span class="chat-fac" style="background:${facColor}">${esc_(facHan)}</span>`:''}</span>
        <span class="chat-body-text">${esc_(m.msg)}</span>
        <span class="chat-ts">${tm}</span>
      </div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  function _hhmm(ts){
    if(!ts) return '';
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2,'0');
    const m = String(d.getMinutes()).padStart(2,'0');
    return `${h}:${m}`;
  }

  function startSub(ctx){
    if(ctx.isLocal){
      _renderLog(ctx, ctx.localMsgs);
      return;
    }
    const f = fb_(); if(!f){ _renderLog(ctx, []); return; }
    let usingPoll = false;
    if(typeof f.subscribe === 'function'){
      try{
        ctx.stream = f.subscribe(ctx.node, (data) => {
          if(ctx.destroyed) return;
          _renderLog(ctx, data || {});
        }, {pollMs: 3000});
      }catch(_){ usingPoll = true; }
    } else {
      usingPoll = true;
    }
    if(usingPoll){
      const tick = async () => {
        if(ctx.destroyed) return;
        try{
          const data = await f.get(ctx.node);
          _renderLog(ctx, data || {});
        }catch(_){}
      };
      tick();
      ctx.pollTimer = setInterval(tick, 3500);
    }
  }

  function aiPush(ctx, aiName, msg){
    if(!ctx || !ctx.isLocal) return;
    ctx.localMsgs.push({
      uid: 'ai_'+aiName, name: aiName, msg,
      ts: now(), faction: '', char: null,
    });
    ctx.localMsgs = ctx.localMsgs.slice(-ctx.max);
    _renderLog(ctx, ctx.localMsgs);
  }

  return { mount, unmount, unmountAll, sendMsg, aiPush, PRESETS_CARD, PRESETS_CUBE };
})();
window.V96Chat = Chat;

// ════════════════════════════════════════════════════════════════════════════
// 2. presence activity 추적 + 상세 모달
// ────────────────────────────────────────────────────────────────────────────
// Activity.set(label, sub) 호출 → S.activity 갱신 + Firebase 즉시 push.
// presence chip 클릭 → 캐릭터·진영·전적·현재 활동 모달 표시.
// ════════════════════════════════════════════════════════════════════════════

const Activity = (function(){
  function _ensure(){
    if(typeof S === 'undefined' || !S) return;
    if(!S.activity || typeof S.activity !== 'object'){
      S.activity = { label:'', sub:'', ts: now() };
    }
  }
  function set(label, sub){
    _ensure();
    if(typeof S === 'undefined' || !S) return;
    S.activity = { label: String(label||''), sub: String(sub||''), ts: now() };
    try{
      const f = fb_();
      if(f && S.userId){
        f.put(`presence/${S.userId}/activity`, S.activity).catch(()=>{});
      }
    }catch(_){}
  }
  function current(){
    _ensure();
    return (typeof S !== 'undefined' && S && S.activity) || { label:'', sub:'', ts:0 };
  }
  return { set, current };
})();
window.V96Activity = Activity;

async function _fetchUserProfile(uid){
  const out = { uid, name:'?', character:null, faction:'', qi:0, ts:0, activity:null, record:null };
  const f = fb_();
  if(!f) return out;
  try{
    const p = await f.get(`presence/${uid}`);
    if(p){
      out.name = p.name || '?';
      out.character = p.character || null;
      out.faction = p.faction || '';
      out.qi = p.qi || 0;
      out.ts = p.ts || 0;
      out.activity = p.activity || null;
    }
  }catch(_){}
  try{
    if(typeof fetchAllRecords === 'function'){
      const recs = await fetchAllRecords(true);
      out.record = (recs && recs[uid]) || {w:0,l:0,d:0};
    }
  }catch(_){}
  return out;
}

async function showPresenceDetail(uid){
  const m = document.createElement('div');
  m.className = 'overlay';
  m.id = 'presence-detail-overlay';
  m.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-title">
        <span class="han">人</span> 학습자 상세
        <button class="modal-close" type="button" data-act="close">×</button>
      </div>
      <div class="modal-body" id="pd-body">
        <div style="text-align:center;padding:30px;color:var(--gutong);font-size:13px">불러오는 중…</div>
      </div>
    </div>`;
  document.body.appendChild(m);
  const close = () => { if(m.parentNode) m.remove(); };
  m.querySelector('[data-act=close]').addEventListener('click', close);
  m.addEventListener('click', (e) => { if(e.target === m) close(); });

  const prof = await _fetchUserProfile(uid);
  const ch = (typeof PHYSICIAN_BY_ID !== 'undefined') ? PHYSICIAN_BY_ID[prof.character] : null;
  const fac = (typeof FACTION_BY_ID !== 'undefined') ? FACTION_BY_ID[prof.faction] : null;
  const isMe = (typeof S !== 'undefined' && S && S.userId === uid);
  const fresh = prof.ts && (now() - prof.ts) < 90*1000;
  const rec = prof.record || {w:0,l:0,d:0};
  const total = (rec.w||0) + (rec.l||0) + (rec.d||0);
  const wr = total ? Math.round((rec.w||0)/total*100) : 0;
  const act = prof.activity || {};
  const actAge = act.ts ? Math.max(0, Math.floor((now() - act.ts)/1000)) : 0;
  const actAgeStr = act.ts ? (actAge < 60 ? `${actAge}초 전` : actAge < 3600 ? `${Math.floor(actAge/60)}분 전` : `${Math.floor(actAge/3600)}시간 전`) : '';

  let medallion = '';
  try{
    if(typeof _charPhotoMedallion === 'function' && ch){
      medallion = _charPhotoMedallion(ch, 72);
    } else if(typeof _charMedallion === 'function' && prof.character){
      medallion = _charMedallion(prof.character, 72);
    }
  }catch(_){}

  const body = m.querySelector('#pd-body');
  body.innerHTML = `
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">
      <div style="flex-shrink:0">${medallion}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-family:var(--font-display);font-size:18px;color:var(--mo)">${esc_(prof.name)}</span>
          ${isMe ? '<span style="font-size:11px;color:var(--zhusha-d)">(나)</span>' : ''}
          ${fresh ? '<span class="presence-dot-fresh" title="현재 접속 중">●</span>' : '<span class="presence-dot-stale" title="오프라인">○</span>'}
          ${fac ? `<span class="faction-chip" style="background:${esc_(fac.color)}" title="${esc_(fac.han)}">${esc_(fac.han2)}</span>` : ''}
        </div>
        ${ch ? `<div style="font-size:13px;color:var(--gutong);margin-top:2px"><span class="han">${esc_(ch.han)}</span> · ${esc_(ch.ko)}</div>` : ''}
        ${ch && ch.era ? `<div style="font-size:10.5px;color:var(--gutong);margin-top:1px">${esc_(ch.era)}</div>` : ''}
      </div>
    </div>

    <div class="card" style="padding:10px 12px;margin-bottom:10px;background:var(--mi)">
      <div style="font-family:var(--font-display);font-size:12.5px;color:var(--zhusha-d);margin-bottom:4px">
        <span class="han">在</span> 현재 활동
      </div>
      ${act.label ? `
        <div style="font-size:13px;color:var(--mo)">${esc_(act.label)}</div>
        ${act.sub ? `<div style="font-size:11.5px;color:var(--mo-l);margin-top:2px">${esc_(act.sub)}</div>` : ''}
        ${actAgeStr ? `<div style="font-size:10.5px;color:var(--gutong);margin-top:3px">${actAgeStr}</div>` : ''}
      ` : `<div style="font-size:11.5px;color:var(--gutong);font-style:italic">활동 정보 없음</div>`}
    </div>

    <div class="card" style="padding:10px 12px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-family:var(--font-display);font-size:12.5px;color:var(--zhusha-d)">
          <span class="han">績</span> 누적 氣 · 對決 전적
        </div>
      </div>
      <div style="font-size:13px;color:var(--mo);margin-bottom:6px">
        누적 <b class="seal" style="color:var(--zhusha-d);font-size:16px">${(prof.qi||0).toLocaleString()}</b> 氣
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:11.5px">
        <div style="text-align:center;padding:6px;background:rgba(42,112,96,.10);border-radius:4px">
          <div style="color:var(--feicui);font-weight:700;font-size:16px;font-family:var(--font-display)">${rec.w||0}</div>
          <div style="color:var(--gutong);font-size:10.5px">勝</div>
        </div>
        <div style="text-align:center;padding:6px;background:rgba(156,48,48,.10);border-radius:4px">
          <div style="color:var(--zhusha-d);font-weight:700;font-size:16px;font-family:var(--font-display)">${rec.l||0}</div>
          <div style="color:var(--gutong);font-size:10.5px">敗</div>
        </div>
        <div style="text-align:center;padding:6px;background:rgba(135,106,54,.10);border-radius:4px">
          <div style="color:var(--gutong);font-weight:700;font-size:16px;font-family:var(--font-display)">${rec.d||0}</div>
          <div style="color:var(--gutong);font-size:10.5px">和</div>
        </div>
        <div style="text-align:center;padding:6px;background:rgba(201,162,39,.15);border-radius:4px">
          <div style="color:var(--huang-d);font-weight:700;font-size:16px;font-family:var(--font-display)">${wr}%</div>
          <div style="color:var(--gutong);font-size:10.5px">勝率</div>
        </div>
      </div>
    </div>

    ${fac ? `
    <div class="card" style="padding:10px 12px;background:${esc_(fac.colorBg||'transparent')};border-left:3px solid ${esc_(fac.color)}">
      <div style="font-family:var(--font-display);font-size:12.5px;color:${esc_(fac.colorDim||'var(--zhusha-d)')};margin-bottom:3px">
        <span class="han">${esc_(fac.han)}</span> · ${esc_(fac.ko)}
      </div>
      <div style="font-size:11.5px;color:var(--mo);line-height:1.6">${esc_(fac.passive||'')}</div>
      <div style="font-size:10.5px;color:var(--gutong);margin-top:3px;font-style:italic">${esc_(fac.desc||'')}</div>
    </div>
    ` : ''}
  `;
}
window.V96ShowPresenceDetail = showPresenceDetail;

function bindPresenceClicks(rootSel){
  const root = (typeof rootSel === 'string') ? document.querySelector(rootSel) : (rootSel || document);
  if(!root) return;
  root.querySelectorAll('.presence-chip[data-uid]').forEach(el => {
    if(el.dataset._bound === '1') return;
    el.dataset._bound = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      const uid = el.dataset.uid;
      if(uid) showPresenceDetail(uid);
    });
  });
}
window.V96BindPresenceClicks = bindPresenceClicks;

// 이어서 Warrior2H, CardAI, CubeAI, CSS는 part-2 에서 append (큰 파일 분할)
// → 같은 IIFE 안에서 이어집니다.
window.__V96_PART1_LOADED = true;

})();
