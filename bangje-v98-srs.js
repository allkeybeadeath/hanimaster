/* bangje-v98-srs.js — v9.8
 * ============================================================================
 * SM-2 라이트 간격반복학습 (Spaced Repetition)
 *
 *   • 기존 S.flashRated[key] = 'easy'|'hard'|'again' 표식 위에
 *     {rating, ef, interval, due, reps} 객체로 확장 (마이그레이션 자동)
 *   • SM-2의 단순화 — easy: ef*1.15, interval*=ef; hard: ef*0.85,
 *     interval*=1.2; again: ef−0.2, interval=10분 (0.007일)
 *   • 홈 大廳에 "오늘 복습 N개" 카드 inject (MutationObserver)
 *   • V98SRS.rate(key, rating)         — 사용자 평가 기록
 *   • V98SRS.dueKeys(window=now)       — 만기 카드 키들 (정렬)
 *   • V98SRS.startReviewSession()      — 만기 카드들로 즉시 플래시 세션
 *
 *   상수 EF_MIN=1.3 (SM-2 표준), 초기 EF=2.5.
 *   key 형식은 기존 플래시카드와 호환 (e.g. 'formula:sagunja-tang:action').
 * ============================================================================ */
(function(){
'use strict';

const DAY = 86400000;
const EF_INIT = 2.5, EF_MIN = 1.3;
const MIN_TEN_MIN = 600000;   // 0.007일 ≈ 10분

function _now(){ return Date.now(); }
function S(){ return window.S || null; }
function save(){ try{ window.saveState && window.saveState(); }catch(_){} }

// ─── 데이터 마이그레이션 — 기존 string 표식을 객체로 ────────────────────
function _migrate(){
  const s = S(); if(!s) return;
  if(!s.flashRated || typeof s.flashRated !== 'object') s.flashRated = {};
  let dirty = false;
  for(const k of Object.keys(s.flashRated)){
    const v = s.flashRated[k];
    if(typeof v === 'string'){
      const r = v;
      s.flashRated[k] = {
        rating: r,
        ef: r === 'easy' ? 2.7 : r === 'hard' ? 2.1 : 1.7,
        interval: r === 'easy' ? 3 : r === 'hard' ? 1 : 0.007,
        due: _now() + (r === 'easy' ? 3*DAY : r === 'hard' ? DAY : MIN_TEN_MIN),
        reps: 1,
        last: _now(),
      };
      dirty = true;
    }
  }
  if(dirty) save();
}

// ─── 평가 기록 → 다음 due 계산 ─────────────────────────────────────────
function rate(key, rating){
  const s = S(); if(!s || !key) return;
  _migrate();
  const cur = s.flashRated[key] || { ef:EF_INIT, interval:1, reps:0 };
  let ef = cur.ef || EF_INIT;
  let interval = cur.interval || 1;
  if(rating === 'easy'){
    ef = Math.min(3.0, ef * 1.15);
    interval = Math.max(1, interval * ef);
  } else if(rating === 'hard'){
    ef = Math.max(EF_MIN, ef * 0.85);
    interval = Math.max(0.5, interval * 1.2);
  } else if(rating === 'again'){
    ef = Math.max(EF_MIN, ef - 0.2);
    interval = MIN_TEN_MIN / DAY;
  }
  s.flashRated[key] = {
    rating, ef, interval, reps: (cur.reps||0) + 1,
    last: _now(),
    due: _now() + Math.round(interval * DAY),
  };
  save();
}

// ─── 만기 카드 키 ──────────────────────────────────────────────────────
function dueKeys(t){
  const s = S(); if(!s) return [];
  _migrate();
  const T = t || _now();
  const arr = Object.entries(s.flashRated)
    .filter(([_, v]) => v && typeof v === 'object' && (v.due||0) <= T)
    .sort((a, b) => (a[1].due||0) - (b[1].due||0));
  return arr.map(([k]) => k);
}

function dueCount(){ return dueKeys().length; }

// ─── 大廳 "오늘 복습" 카드 inject ───────────────────────────────────────
function _renderHomeBanner(){
  const n = dueCount();
  if(!n) return '';
  return `
    <div id="v98-srs-banner" class="card" style="
      margin-top:10px; padding:10px 12px;
      background:linear-gradient(135deg, #1C140A 0%, #2A1E10 100%);
      color:#FCF4E5; border:1px solid #876A36;
      display:flex; align-items:center; gap:10px;
      cursor:pointer;"
      onclick="V98SRS.startReviewSession()">
      <span class="seal" style="background:#9C3030;color:#FFE08A;
        padding:4px 8px;border-radius:5px;font-size:14px;
        font-family:'ZCOOL XiaoWei',serif;flex-shrink:0">復</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:#FFE08A;font-weight:700">
          오늘 복습할 카드 <b style="color:#C9A227">${n}</b>개
        </div>
        <div style="font-size:11px;color:#876A36;line-height:1.4;margin-top:2px">
          SM-2 알고리즘 기반 — 잊기 직전에 다시 보기
        </div>
      </div>
      <span style="color:#C9A227;font-size:16px">→</span>
    </div>
  `;
}

function _injectBanner(){
  if(document.getElementById('v98-srs-banner')) return;
  // 명언 카드(.neijing-card) 또는 hello-card 다음에 삽입
  const anchor = document.querySelector('.neijing-card')
              || document.getElementById('hello-card');
  if(!anchor) return;
  const html = _renderHomeBanner();
  if(!html) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  anchor.parentNode.insertBefore(wrap.firstElementChild, anchor.nextSibling);
}

// ─── 즉시 복습 세션 시작 — 기존 startFlashSession 활용 시도 ────────────
function startReviewSession(){
  const keys = dueKeys();
  if(!keys.length){
    if(typeof window.toast === 'function') window.toast('만기된 복습 카드가 없습니다', 'gold');
    return;
  }
  if(typeof window.toast === 'function') window.toast(`${keys.length}개 카드 복습 시작`, 'gold');
  // 기존 플래시카드 시스템이 있으면 활용. 없으면 간단 자체 세션.
  if(typeof window.startFlashSession === 'function'){
    try{ window.startFlashSession({ onlyKeys: keys }); return; }catch(_){}
  }
  _selfSession(keys);
}

// 자체 미니 세션 — 외부 의존 없이 작동하는 fallback
function _selfSession(keys){
  const v = document.getElementById('view'); if(!v) return;
  if(typeof window.setTab === 'function') try{ window.setTab('home'); }catch(_){}
  let i = 0; const total = keys.length;
  const show = () => {
    if(i >= total){
      v.innerHTML = `<h2 class="view-title"><span class="han">畢</span>복습 완료</h2>
        <div class="card imperial fade-in" style="text-align:center;padding:18px">
          <div class="seal" style="font-size:32px;color:var(--zhusha-d)">${total}장</div>
          <div style="margin-top:8px;font-size:13px;color:var(--mo-l)">다음 만기까지 휴식</div>
          <button class="btn" type="button" onclick="setTab('home')" style="margin-top:14px">대청으로</button>
        </div>`;
      return;
    }
    const k = keys[i];
    const front = _renderKeyFront(k);
    v.innerHTML = `
      <div style="font-size:11.5px;color:var(--gutong);margin-bottom:6px">
        ${i+1} / ${total} · ${V98SRS._cardLabel(k)}
      </div>
      <div class="card imperial fade-in" style="padding:18px;min-height:160px;text-align:center">
        ${front}
        <div id="srs-back" style="display:none;margin-top:14px;padding-top:14px;border-top:1px dashed var(--mi-d);font-size:13.5px;line-height:1.7;color:var(--feicui-d)">
          ${V98SRS._renderKeyBack(k)}
        </div>
      </div>
      <div id="srs-actions" style="margin-top:10px;display:flex;gap:6px;justify-content:center">
        <button class="btn" type="button" id="srs-flip">뒤집기</button>
      </div>
    `;
    document.getElementById('srs-flip').addEventListener('click', () => {
      document.getElementById('srs-back').style.display = 'block';
      document.getElementById('srs-actions').innerHTML = `
        <button class="btn" type="button" data-r="again" style="background:var(--zhusha)">다시 (10분)</button>
        <button class="btn btn-o" type="button" data-r="hard">어려움</button>
        <button class="btn" type="button" data-r="easy" style="background:var(--feicui);color:var(--mi-w)">쉬움</button>
      `;
      document.querySelectorAll('#srs-actions [data-r]').forEach(b => {
        b.addEventListener('click', () => { rate(k, b.dataset.r); i++; show(); });
      });
    });
  };
  show();
}

function _renderKeyFront(k){
  const parts = String(k).split(':');
  const t = parts[0], id = parts[1], mode = parts[2] || '';
  if(t === 'formula'){
    const f = (window.FORMULAS||[]).find(x => x.id === id);
    if(!f) return `<div style="font-size:14px;color:var(--gutong)">알 수 없는 카드</div>`;
    if(mode === 'action') return `<div class="han" style="font-size:24px;color:var(--zhusha-d)">${f.han}</div><div style="font-size:14px;color:var(--mo-l);margin-top:6px">作用?</div>`;
    if(mode === 'monarch') return `<div class="han" style="font-size:24px;color:var(--zhusha-d)">${f.han}</div><div style="font-size:14px;color:var(--mo-l);margin-top:6px">君藥?</div>`;
    return `<div class="han" style="font-size:24px;color:var(--zhusha-d)">${f.han}</div><div style="font-size:13px;color:var(--mo-l);margin-top:6px">${f.ko}</div>`;
  }
  if(t === 'herb'){
    const h = (window.HERBS||[]).find(x => x.han === id || x.ko === id);
    if(!h) return id;
    return `<div class="han" style="font-size:24px;color:var(--zhusha-d)">${h.han}</div><div style="font-size:13px;color:var(--mo-l)">${h.ko}</div>`;
  }
  return `<div style="font-size:14px">${k}</div>`;
}

function _renderKeyBack(k){
  const parts = String(k).split(':');
  const t = parts[0], id = parts[1], mode = parts[2] || '';
  if(t === 'formula'){
    const f = (window.FORMULAS||[]).find(x => x.id === id);
    if(!f) return '?';
    if(mode === 'action') return `<span class="han">${f.action||'?'}</span>`;
    if(mode === 'monarch'){
      const m = f.monarch_minister && f.monarch_minister['君'];
      return m ? `<span class="han">${(Array.isArray(m)?m:[m]).join('·')}</span>` : '?';
    }
    return `<span class="han">${(f.composition||[]).join('·')}</span><div style="font-size:11px;margin-top:6px;color:var(--mo-l)">${f.action||''}</div>`;
  }
  if(t === 'herb'){
    const h = (window.HERBS||[]).find(x => x.han === id || x.ko === id);
    return h ? `<span class="han">${h.meaning||''}</span><div style="font-size:11px;color:var(--gutong);margin-top:4px">${h.sm||''}</div>` : '?';
  }
  return '?';
}

function _cardLabel(k){
  const parts = String(k).split(':');
  if(parts[0] === 'formula' && parts[2]) return `處方·${parts[2]}`;
  return parts[0];
}

// ─── MutationObserver — 大廳 진입 시 자동 inject ────────────────────────
function _observe(){
  const v = document.getElementById('view');
  if(!v){ setTimeout(_observe, 300); return; }
  const obs = new MutationObserver(() => { try{ _injectBanner(); }catch(_){} });
  obs.observe(v, { childList:true, subtree:true });
  setTimeout(() => { try{ _injectBanner(); }catch(_){} }, 400);
}
if(document.readyState !== 'loading') setTimeout(_observe, 500);
else document.addEventListener('DOMContentLoaded', () => setTimeout(_observe, 500));

window.V98SRS = {
  rate, dueKeys, dueCount,
  startReviewSession,
  _migrate, _cardLabel, _renderKeyBack,
};
})();
