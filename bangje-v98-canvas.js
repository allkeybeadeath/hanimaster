/* bangje-v98-canvas.js — v9.8
 * ============================================================================
 * 君臣佐使 作圖 — HTML5 Drag & Drop 게임
 *
 *   B-2 (V98Drill) 와 같은 데이터를 사용하지만 인터랙션이 다름:
 *     • 화면 상단에 4-약재 트레이 (셔플됨)
 *     • 화면 하단에 4-그리드 (君·臣·佐·使)
 *     • 카드를 드래그해서 슬롯에 떨어뜨림 (HTML5 native drag)
 *     • 모바일은 touch-based fallback (pointer events 기반)
 *     • 슬롯 점등·자석 효과·올바른 배치 시 작은 ✓ feedback
 *
 *   • V98Canvas.start(opts)
 *       opts.chapter, opts.count       — V98Drill 와 동일
 *
 *   각 처방 滿點 시 +15 氣 (드릴 +10 보다 우대, 더 어려움).
 * ============================================================================ */
(function(){
'use strict';

const ROLES = ['君', '臣', '佐', '使'];
const ROLE_COLORS = {
  '君': '#9C3030', '臣': '#C9A227', '佐': '#2A7060', '使': '#876A36',
};
const QI_PERFECT = 15;
const QI_PER_RIGHT = 4;

function $(s, r){ return (r||document).querySelector(s); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }
function S(){ return window.S || null; }
function save(){ try{ window.saveState && window.saveState(); }catch(_){} }

function _eligibleFormulas(){
  return (window.FORMULAS || []).filter(f => {
    const mm = f.monarch_minister;
    if(!mm || typeof mm !== 'object') return false;
    return ROLES.every(r => mm[r] && (Array.isArray(mm[r]) ? mm[r].length : true));
  });
}

let _session = null;

function start(opts){
  opts = opts || {};
  let pool = _eligibleFormulas();
  if(opts.chapter) pool = pool.filter(f => String(f.chapter||'').startsWith(opts.chapter+'장'));
  pool = pool.slice().sort(() => Math.random() - 0.5).slice(0, opts.count || 5);
  if(!pool.length){ toast('해당 章 처방 없음', 'warn'); return; }
  _session = { pool, idx: 0, startedAt: Date.now(), totalRight: 0 };
  _renderCurrent();
}

function _renderCurrent(){
  if(!_session) return;
  if(_session.idx >= _session.pool.length){
    _renderFinish();
    return;
  }
  const f = _session.pool[_session.idx];
  const mm = f.monarch_minister;
  const herbs = ROLES.map(r => {
    const arr = Array.isArray(mm[r]) ? mm[r] : [mm[r]];
    return { han: arr[0], role: r };
  });
  const shuffled = herbs.slice().sort(() => Math.random() - 0.5);
  const placed = {};   // role → han (단 1개씩만 허용)
  const v = $('#view'); if(!v) return;

  v.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">圖</span>君臣佐使 作圖</h2>
    <div class="card imperial" style="padding:14px">
      <div style="font-size:11px;color:var(--gutong);text-align:center">${esc(f.chapter||'')}</div>
      <div class="han" style="font-size:22px;color:var(--zhusha-d);text-align:center;margin-top:4px">${esc(f.han)}</div>
      <div style="font-size:13px;color:var(--mo-l);text-align:center;margin-top:2px">${esc(f.ko)}</div>

      <!-- 본초 트레이 -->
      <div id="v98c-tray" style="margin-top:14px;padding:10px;background:var(--mi);border-radius:6px;
                                  display:flex;flex-wrap:wrap;gap:6px;justify-content:center;min-height:60px">
        ${shuffled.map(h => `
          <div class="v98c-card" draggable="true" data-han="${esc(h.han)}" style="
            background:#1C140A;color:#FFE08A;
            padding:10px 14px;border-radius:6px;
            font-family:'ZCOOL XiaoWei',serif;font-size:17px;font-weight:600;
            cursor:grab;user-select:none;
            box-shadow:0 3px 8px rgba(0,0,0,.3);
            border:1.5px solid #876A36;
            transition:transform .15s ease, box-shadow .15s ease;
            touch-action:none">
            ${esc(h.han)}
          </div>
        `).join('')}
      </div>

      <!-- 4-그리드 -->
      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${ROLES.map(r => `
          <div class="v98c-slot" data-role="${r}" style="
            border:2.5px dashed ${ROLE_COLORS[r]}66; border-radius:8px;
            padding:12px; min-height:74px; background:${ROLE_COLORS[r]}11;
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            transition:border-color .15s ease, background .15s ease, transform .15s ease;
            ">
            <div class="han" style="font-size:14px;color:${ROLE_COLORS[r]};font-weight:700;letter-spacing:.1em">${r}</div>
            <div class="v98c-slot-content" style="margin-top:6px;font-size:14px;color:var(--mo-l)"></div>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:12px;display:flex;gap:6px;justify-content:center">
        <button class="btn" type="button" id="v98c-check">채점</button>
        <button class="btn btn-o" type="button" id="v98c-reset">리셋</button>
        <button class="btn btn-o" type="button" id="v98c-skip">건너뛰기</button>
      </div>
      <div style="margin-top:8px;font-size:10.5px;color:var(--gutong);text-align:center">
        본초 카드를 드래그해서 君·臣·佐·使 칸에 놓으세요
      </div>
    </div>
  `;

  // ─── HTML5 Drag & Drop (desktop) ──────────────────────────────────────
  const cards = v.querySelectorAll('.v98c-card');
  const slots = v.querySelectorAll('.v98c-slot');
  let dragHan = null;

  cards.forEach(c => {
    c.addEventListener('dragstart', e => {
      dragHan = c.dataset.han;
      e.dataTransfer.effectAllowed = 'move';
      try{ e.dataTransfer.setData('text/plain', dragHan); }catch(_){}
      c.style.opacity = '0.5';
    });
    c.addEventListener('dragend', () => { c.style.opacity = '1'; });
  });
  slots.forEach(s => {
    s.addEventListener('dragover', e => {
      e.preventDefault();
      s.style.borderColor = ROLE_COLORS[s.dataset.role];
      s.style.background = ROLE_COLORS[s.dataset.role] + '33';
    });
    s.addEventListener('dragleave', () => {
      s.style.borderColor = ROLE_COLORS[s.dataset.role] + '66';
      s.style.background = ROLE_COLORS[s.dataset.role] + '11';
    });
    s.addEventListener('drop', e => {
      e.preventDefault();
      s.style.borderColor = ROLE_COLORS[s.dataset.role] + '66';
      s.style.background = ROLE_COLORS[s.dataset.role] + '11';
      const han = dragHan || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
      if(!han) return;
      _placeHan(han, s.dataset.role, placed, v);
    });
  });

  // ─── Touch / Pointer fallback (mobile) ────────────────────────────────
  cards.forEach(c => {
    c.addEventListener('pointerdown', e => {
      if(e.pointerType !== 'touch') return;   // 데스크는 native drag로
      _startTouchDrag(c, e, slots, placed, v);
    });
  });

  // ─── 버튼 ─────────────────────────────────────────────────────────────
  $('#v98c-reset').addEventListener('click', () => {
    Object.keys(placed).forEach(k => delete placed[k]);
    cards.forEach(c => c.style.display = '');
    slots.forEach(s => s.querySelector('.v98c-slot-content').textContent = '');
  });
  $('#v98c-skip').addEventListener('click', () => { _session.idx++; _renderCurrent(); });
  $('#v98c-check').addEventListener('click', () => _grade(f, herbs, placed));
}

function _placeHan(han, role, placed, v){
  // 이미 다른 슬롯에 놓여 있으면 빼서 옮김
  for(const r of Object.keys(placed)){
    if(placed[r] === han){
      delete placed[r];
      const oldSlot = v.querySelector(`.v98c-slot[data-role="${r}"] .v98c-slot-content`);
      if(oldSlot) oldSlot.textContent = '';
    }
  }
  // 이미 슬롯에 다른 본초 있으면 트레이로 돌려보내고 새것 받음
  if(placed[role]){
    const old = placed[role];
    const oldCard = v.querySelector(`.v98c-card[data-han="${CSS.escape(old)}"]`);
    if(oldCard) oldCard.style.display = '';
  }
  placed[role] = han;
  const slot = v.querySelector(`.v98c-slot[data-role="${role}"] .v98c-slot-content`);
  if(slot) slot.innerHTML = `<span class="han" style="font-size:16px;color:${ROLE_COLORS[role]};font-weight:700">${esc(han)}</span>`;
  const card = v.querySelector(`.v98c-card[data-han="${CSS.escape(han)}"]`);
  if(card) card.style.display = 'none';
}

// ─── Touch drag (pointer-based) ───────────────────────────────────────────
function _startTouchDrag(card, evDown, slots, placed, v){
  evDown.preventDefault();
  const han = card.dataset.han;
  const rect = card.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  ghost.style.position = 'fixed';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  ghost.style.width = rect.width + 'px';
  ghost.style.zIndex = 9000;
  ghost.style.pointerEvents = 'none';
  ghost.style.opacity = '0.85';
  ghost.style.transform = 'scale(1.08) rotate(-2deg)';
  document.body.appendChild(ghost);
  card.style.opacity = '0.4';

  let lastSlot = null;
  const onMove = (e) => {
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    if(x == null) return;
    ghost.style.left = (x - rect.width/2) + 'px';
    ghost.style.top = (y - rect.height/2) + 'px';
    // hit detection
    const el = document.elementFromPoint(x, y);
    const slot = el && el.closest && el.closest('.v98c-slot');
    if(slot !== lastSlot){
      if(lastSlot){
        lastSlot.style.borderColor = ROLE_COLORS[lastSlot.dataset.role] + '66';
        lastSlot.style.background = ROLE_COLORS[lastSlot.dataset.role] + '11';
      }
      lastSlot = slot;
      if(slot){
        slot.style.borderColor = ROLE_COLORS[slot.dataset.role];
        slot.style.background = ROLE_COLORS[slot.dataset.role] + '33';
      }
    }
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if(lastSlot){
      lastSlot.style.borderColor = ROLE_COLORS[lastSlot.dataset.role] + '66';
      lastSlot.style.background = ROLE_COLORS[lastSlot.dataset.role] + '11';
      _placeHan(han, lastSlot.dataset.role, placed, v);
    } else {
      card.style.opacity = '1';
    }
    try{ ghost.remove(); }catch(_){}
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

// ─── 채점 ────────────────────────────────────────────────────────────────
function _grade(f, herbs, placed){
  let right = 0;
  herbs.forEach(h => { if(placed[h.role] === h.han) right++; });
  const isPerfect = (right === 4);
  const earned = right * QI_PER_RIGHT + (isPerfect ? QI_PERFECT : 0);
  const s = S();
  if(s){ s.qi = (s.qi||0) + earned; save(); }
  try{ window.refreshHeader && window.refreshHeader(); }catch(_){}
  try{
    window.V98SRS && window.V98SRS.rate('formula:'+f.id+':canvas', isPerfect ? 'easy' : right >= 2 ? 'hard' : 'again');
  }catch(_){}
  _session.totalRight += right;

  const v = $('#view'); if(!v) return;
  v.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">${isPerfect?'妙':'評'}</span>채점</h2>
    <div class="card imperial" style="padding:18px;text-align:center">
      <div class="seal" style="font-size:34px;color:${isPerfect?'var(--feicui)':'var(--zhusha-d)'}">${right}/4</div>
      <div style="margin-top:6px;font-size:13px;color:var(--feicui);font-weight:600">+${earned} 氣 ${isPerfect ? `<span style="color:var(--huang);font-size:11px">(滿點 보너스 +${QI_PERFECT})</span>` : ''}</div>
      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${ROLES.map(r => {
          const correct = herbs.find(h => h.role === r);
          const userHerb = placed[r];
          const ok = userHerb === (correct && correct.han);
          return `<div style="padding:6px;border:1.5px solid ${ok?'var(--feicui)':'var(--zhusha)'};border-radius:5px;background:${ROLE_COLORS[r]}11">
            <div class="han" style="font-size:11px;color:${ROLE_COLORS[r]}">${r}</div>
            <div style="font-size:14px"><span class="han">${esc((correct&&correct.han)||'?')}</span></div>
            ${!ok && userHerb ? `<div style="font-size:10px;color:var(--zhusha)">너의 답: ${esc(userHerb)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
    <div style="margin-top:10px;display:flex;gap:6px;justify-content:center">
      <button class="btn" type="button" id="v98c-next">다음</button>
      <button class="btn btn-o" type="button" onclick="setTab('home')">중단</button>
    </div>
  `;
  $('#v98c-next').addEventListener('click', () => { _session.idx++; _renderCurrent(); });
}

function _renderFinish(){
  const v = $('#view'); if(!v) return;
  v.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">畢</span>作圖 완료</h2>
    <div class="card imperial" style="text-align:center;padding:20px">
      <div class="seal" style="font-size:34px;color:var(--zhusha-d)">${_session.totalRight}/${_session.pool.length*4}</div>
      <div style="margin-top:6px;font-size:12px;color:var(--mo-l)">${_session.pool.length}처방 · ${Math.round((Date.now()-_session.startedAt)/1000)}초</div>
      <button class="btn" type="button" onclick="setTab('home')" style="margin-top:14px">대청으로</button>
    </div>
  `;
  _session = null;
}

window.V98Canvas = { start };
})();
