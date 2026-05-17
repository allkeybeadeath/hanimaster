/* bangje-v98-drill.js — v9.8
 * ============================================================================
 * 君臣佐使 분류 드릴
 *
 *   각 처방의 4-약재를 받아 사용자가 君/臣/佐/使 4분면으로 분류.
 *   정답률에 따라 V98SRS 카드로 자동 등록 (key='formula:{id}:monarch_minister').
 *
 *   • V98Drill.startSession(opts)  — opts.chapter=6|7|8|null, count=10
 *   • V98Drill.openOne(formulaId)  — 단일 처방 드릴 (처방 모달에서 호출용)
 *
 *   monarch_minister 가 잘 정의된 처방만 풀에 포함.
 *   1정답 +5 氣, 5/5 +10 보너스.
 * ============================================================================ */
(function(){
'use strict';

const ROLES = ['君', '臣', '佐', '使'];
const ROLE_COLORS = {
  '君': '#9C3030', '臣': '#C9A227', '佐': '#2A7060', '使': '#876A36',
};
const QI_PER_RIGHT = 5;
const QI_PERFECT_BONUS = 10;

function S(){ return window.S || null; }
function save(){ try{ window.saveState && window.saveState(); }catch(_){} }
function toast(m, k){ try{ window.toast && window.toast(m, k); }catch(_){} }
function $(s, r){ return (r||document).querySelector(s); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function _eligibleFormulas(){
  const all = window.FORMULAS || [];
  return all.filter(f => {
    const mm = f.monarch_minister;
    if(!mm || typeof mm !== 'object') return false;
    return ROLES.every(r => mm[r] && (Array.isArray(mm[r]) ? mm[r].length : true));
  });
}

function _pickPool(chapter, count){
  let pool = _eligibleFormulas();
  if(chapter){
    pool = pool.filter(f => String(f.chapter||'').startsWith(String(chapter)+'장'));
  }
  pool = pool.slice().sort(() => Math.random() - 0.5).slice(0, count || 10);
  return pool;
}

// ─── 한 처방 드릴 — 4개 약재를 4분면에 배치 ─────────────────────────────
function _renderOne(f, onDone){
  const v = $('#view'); if(!v) return;
  // composition 에서 4개 추출 (monarch_minister에 명시된 약재 중심)
  const herbs = [];
  ROLES.forEach(r => {
    const arr = Array.isArray(f.monarch_minister[r]) ? f.monarch_minister[r] : [f.monarch_minister[r]];
    if(arr[0]) herbs.push({ han: arr[0], role: r });
  });
  if(herbs.length < 4){
    toast('이 처방은 4약재 분류가 미정의', 'warn');
    if(onDone) onDone(null);
    return;
  }
  // 셔플
  const shuffled = herbs.slice().sort(() => Math.random() - 0.5);
  // 사용자 분류 결과
  const userMap = {}; // han → role
  const render = () => {
    const remaining = shuffled.filter(h => !userMap[h.han]);
    const slots = ROLES.map(r => {
      const placed = Object.keys(userMap).filter(h => userMap[h] === r);
      return `
        <div class="v98d-slot" data-role="${r}" style="
          border:2px dashed ${ROLE_COLORS[r]}66; border-radius:8px;
          padding:10px; min-height:60px; background:${ROLE_COLORS[r]}11;
          display:flex; flex-direction:column; gap:4px;
          ">
          <div class="han" style="font-size:13px;color:${ROLE_COLORS[r]};font-weight:700;letter-spacing:.1em">${r}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;flex:1">
            ${placed.map(h => `<button class="btn btn-sm" type="button" data-remove="${esc(h)}" style="
              background:${ROLE_COLORS[r]};color:#FFE08A;padding:3px 8px;font-size:12.5px;border:0;cursor:pointer">
              <span class="han">${esc(h)}</span> ✕
            </button>`).join('')}
          </div>
        </div>
      `;
    }).join('');
    v.innerHTML = `
      <h2 class="view-title fade-in"><span class="han">分</span>君臣佐使 분류</h2>
      <div class="card imperial" style="padding:14px">
        <div style="font-size:11px;color:var(--gutong);text-align:center">${esc(f.chapter||'')}</div>
        <div class="han" style="font-size:22px;color:var(--zhusha-d);text-align:center;margin-top:4px">${esc(f.han)}</div>
        <div style="font-size:13px;color:var(--mo-l);text-align:center;margin-top:2px">${esc(f.ko)}</div>
        <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;min-height:42px;padding:8px;background:var(--mi);border-radius:6px">
          ${remaining.length ? remaining.map(h => `
            <button class="btn btn-o v98d-tray" type="button" data-han="${esc(h.han)}" style="
              padding:6px 12px;font-size:13.5px">
              <span class="han">${esc(h.han)}</span>
            </button>
          `).join('') : '<span style="color:var(--gutong);font-size:12px;align-self:center">모두 배치됨 — 채점 가능</span>'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px">${slots}</div>
        <div style="margin-top:12px;display:flex;gap:6px;justify-content:center">
          <button class="btn" type="button" id="v98d-check" ${remaining.length ? 'disabled style="opacity:.4"' : ''}>채점</button>
          <button class="btn btn-o" type="button" id="v98d-skip">건너뛰기</button>
        </div>
      </div>
    `;
    // 본초 → 슬롯 배치 (다음 클릭한 slot으로)
    let pendingHerb = null;
    v.querySelectorAll('.v98d-tray').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingHerb = btn.dataset.han;
        v.querySelectorAll('.v98d-tray').forEach(b => b.style.outline = '');
        btn.style.outline = '2px solid var(--huang)';
      });
    });
    v.querySelectorAll('.v98d-slot').forEach(slot => {
      slot.addEventListener('click', () => {
        if(!pendingHerb) return;
        userMap[pendingHerb] = slot.dataset.role;
        pendingHerb = null;
        render();
      });
    });
    // 배치 취소
    v.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        delete userMap[btn.dataset.remove];
        render();
      });
    });
    // 채점
    const checkBtn = $('#v98d-check');
    if(checkBtn && !checkBtn.disabled){
      checkBtn.addEventListener('click', () => {
        const correctMap = {};
        herbs.forEach(h => correctMap[h.han] = h.role);
        let right = 0;
        herbs.forEach(h => { if(userMap[h.han] === correctMap[h.han]) right++; });
        const isPerfect = (right === 4);
        const earned = right * QI_PER_RIGHT + (isPerfect ? QI_PERFECT_BONUS : 0);
        const s = S();
        if(s){
          s.qi = (s.qi||0) + earned;
          save();
          if(typeof window.refreshHeader === 'function') window.refreshHeader();
        }
        // SRS 등록
        try{
          window.V98SRS && window.V98SRS.rate('formula:'+f.id+':monarch_minister', isPerfect ? 'easy' : right >= 2 ? 'hard' : 'again');
        }catch(_){}
        // 결과
        v.innerHTML = `
          <h2 class="view-title fade-in"><span class="han">${isPerfect?'妙':'評'}</span>채점</h2>
          <div class="card imperial" style="padding:18px;text-align:center">
            <div class="seal" style="font-size:36px;color:${isPerfect?'var(--feicui)':'var(--zhusha-d)'}">${right}/4</div>
            <div style="margin-top:6px;font-size:13px;color:var(--feicui);font-weight:600">+${earned} 氣</div>
            ${isPerfect ? '<div style="margin-top:4px;font-size:11px;color:var(--gutong)">滿點 보너스 +'+QI_PERFECT_BONUS+'</div>' : ''}
            <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
              ${ROLES.map(r => {
                const correct = herbs.find(h => h.role === r);
                const userHerb = Object.keys(userMap).find(h => userMap[h] === r);
                const ok = userHerb === (correct && correct.han);
                return `<div style="padding:6px;border:1.5px solid ${ok?'var(--feicui)':'var(--zhusha)'};border-radius:5px;background:${ROLE_COLORS[r]}11">
                  <div class="han" style="font-size:11px;color:${ROLE_COLORS[r]}">${r}</div>
                  <div style="font-size:14px"><span class="han">${esc((correct&&correct.han)||'?')}</span></div>
                  ${!ok && userHerb ? `<div style="font-size:10px;color:var(--zhusha)">너의 답: ${esc(userHerb)}</div>` : ''}
                </div>`;
              }).join('')}
            </div>
            <div style="margin-top:12px;font-size:11.5px;color:var(--mo-l);text-align:left">
              ${esc((f.keyPoints && f.keyPoints[1]) || '')}
            </div>
          </div>
          <div style="margin-top:10px;display:flex;gap:6px;justify-content:center">
            <button class="btn" type="button" onclick="V98Drill._nextOrDone()">다음</button>
            <button class="btn btn-o" type="button" onclick="setTab('home')">중단</button>
          </div>
        `;
      });
    }
    const skipBtn = $('#v98d-skip');
    if(skipBtn) skipBtn.addEventListener('click', () => onDone && onDone(null));
  };
  render();
}

// ─── 세션 (N개 처방 연속) ──────────────────────────────────────────────
let _session = null;
function startSession(opts){
  opts = opts || {};
  const pool = _pickPool(opts.chapter, opts.count || 10);
  if(!pool.length){ toast('해당 章에 君臣佐使 정의된 처방 없음', 'warn'); return; }
  _session = { pool, idx: 0, right: 0, started: Date.now() };
  _showCurrent();
}

function _showCurrent(){
  if(!_session) return;
  if(_session.idx >= _session.pool.length){
    const v = $('#view');
    if(v){
      v.innerHTML = `<h2 class="view-title"><span class="han">畢</span>드릴 완료</h2>
        <div class="card imperial fade-in" style="text-align:center;padding:18px">
          <div class="seal" style="font-size:32px;color:var(--zhusha-d)">${_session.pool.length}처방</div>
          <div style="margin-top:8px;font-size:13px;color:var(--mo-l)">${Math.round((Date.now()-_session.started)/1000)}초</div>
          <button class="btn" type="button" onclick="setTab('home')" style="margin-top:14px">대청으로</button>
        </div>`;
    }
    _session = null;
    return;
  }
  _renderOne(_session.pool[_session.idx], () => _nextOrDone());
}

function _nextOrDone(){
  if(!_session) return;
  _session.idx++;
  _showCurrent();
}

function openOne(formulaId){
  const f = (window.FORMULAS||[]).find(x => x.id === formulaId);
  if(!f){ toast('처방 없음', 'warn'); return; }
  _renderOne(f, () => { if(typeof window.setTab === 'function') window.setTab('home'); });
}

window.V98Drill = { startSession, openOne, _nextOrDone };
})();
