/* bangje-v98-dictplus.js — v9.8
 * ============================================================================
 * 처방 사전 / 오답함 / 대청 UX 확장 — 작은 패치들 통합
 *
 *   • B-4: 오답함 모달의 처방명 → V97Dict.open() 또는 V98Diff 직접 점프
 *           (event delegation 으로 모든 .formula-link 클릭 가로채기)
 *   • B-7: V97Dict 항목 펼침 → 派生方·加減方 자동 매칭 표시
 *           (FORMULA_ADDITIONS 에서 base_id === f.id 인 것을 lookup)
 *           V97Dict 의 원본 코드를 수정하지 않고 MutationObserver 로 inject.
 *   • 대청 업데이트 알림: CHANGELOG 데이터 inline + 작은 알림 dot.
 *     사용자가 본 최신 버전을 S.seenChangelogVersion 에 기록.
 *
 *   의존: V97Dict, openModal, S, FORMULAS, FORMULA_ADDITIONS
 * ============================================================================ */
(function(){
'use strict';

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }
function S(){ return window.S || null; }
function save(){ try{ window.saveState && window.saveState(); }catch(_){} }

// ════════════════════════════════════════════════════════════════════════
// B-7: V97Dict 펼침 → 派生方 자동 inject
// ════════════════════════════════════════════════════════════════════════
function _findDerivatives(f){
  const adds = window.FORMULA_ADDITIONS || [];
  const out = [];
  for(const a of adds){
    if(!a) continue;
    if(a.base_id === f.id || a.base_han === f.han || a.baseKo === f.ko){
      out.push(a);
    }
  }
  return out;
}

function _findSubsetFormulas(f){
  // 이 처방의 composition을 부분집합으로 포함하는 다른 처방
  const all = (window.FORMULAS || []).concat(window.FORMULAS_EXTRA || []);
  const setMine = new Set(f.composition || []);
  if(!setMine.size) return [];
  const out = [];
  for(const g of all){
    if(g.id === f.id) continue;
    const setG = new Set(g.composition || []);
    let common = 0;
    for(const x of setMine) if(setG.has(x)) common++;
    if(common >= 2 && common / Math.max(1, setMine.size) >= 0.6){
      out.push({ f: g, common });
    }
  }
  out.sort((a, b) => b.common - a.common);
  return out.slice(0, 8);
}

function _injectDerivatives(){
  const overlay = $('#v97-dict-overlay');
  if(!overlay) return;
  $$('.v97-dict-item.open', overlay).forEach(item => {
    if(item.dataset.v98DerivInjected === '1') return;
    const fid = item.dataset.fid;
    const f = (window.FORMULAS || []).concat(window.FORMULAS_EXTRA || []).find(x => x.id === fid);
    if(!f) return;
    const detail = item.querySelector('div[style*="border-top"]');
    if(!detail) return;
    const derivs = _findDerivatives(f);
    const subs = _findSubsetFormulas(f);
    if(!derivs.length && !subs.length){ item.dataset.v98DerivInjected = '1'; return; }
    const extra = document.createElement('div');
    extra.style.cssText = 'margin-top:8px;padding-top:6px;border-top:1px dashed #876A3644';
    extra.innerHTML = `
      ${derivs.length ? `
        <div style="font-size:11.5px;color:#C9A227">派生·加減</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px">
          ${derivs.map(a => `<span class="han" title="${esc(a.note||a.han||'')}" style="background:#876A3644;color:#FFE08A;padding:2px 6px;border-radius:8px;font-size:11.5px">${esc(a.han || a.ko || '?')}</span>`).join('')}
        </div>
      ` : ''}
      ${subs.length ? `
        <div style="font-size:11.5px;color:#C9A227;margin-top:6px">構成 유사 (${subs[0].common}+ 공통)</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px">
          ${subs.map(x => `<button type="button" class="v98-deriv-chip" data-other="${esc(x.f.id)}" data-base="${esc(f.id)}" style="background:#5C8F3A33;color:#FFE08A;padding:2px 7px;border-radius:8px;font-size:11.5px;border:0;cursor:pointer;font-family:'Noto Serif SC',serif">
            ${esc(x.f.han)} <span style="opacity:.7;font-size:10px">↔</span>
          </button>`).join('')}
        </div>
      ` : ''}
    `;
    detail.appendChild(extra);
    item.dataset.v98DerivInjected = '1';
    // ↔ 클릭 → V98Diff
    extra.querySelectorAll('.v98-deriv-chip').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const base = b.dataset.base, other = b.dataset.other;
        try{ window.V97Dict && window.V97Dict.close(); }catch(_){}
        setTimeout(() => {
          if(window.V98Diff) window.V98Diff.open(base, other);
          else toast('V98Diff 미로드', 'warn');
        }, 100);
      });
    });
  });
}

// V97Dict가 모달 내부에서 펼침 갱신할 때마다 MutationObserver로 잡기
function _watchDict(){
  const obs = new MutationObserver(() => {
    try{ _injectDerivatives(); }catch(_){}
  });
  obs.observe(document.body, { childList:true, subtree:true });
}

// ════════════════════════════════════════════════════════════════════════
// B-4: 오답함/통계의 처방 chip → V97Dict 또는 V98Diff 점프
// ════════════════════════════════════════════════════════════════════════
function _delegateFormulaClicks(){
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-jump-formula]');
    if(!t) return;
    const fid = t.dataset.jumpFormula;
    if(!fid) return;
    e.preventDefault();
    e.stopPropagation();
    if(window.openFormulaDeep) try{ window.openFormulaDeep(fid); }catch(_){}
    else if(window.V97Dict) try{ window.V97Dict.open && window.V97Dict.open(); }catch(_){}
  }, true);
}

// ════════════════════════════════════════════════════════════════════════
// 大廳 업데이트 알림 (작은 창)
// ════════════════════════════════════════════════════════════════════════
const CHANGELOG = [
  {
    v: 'v9.8',
    date: '2026-05-18',
    title: 'CIM Lab 학습 강화 묶음',
    items: [
      '간격반복학습 (SM-2) — 잊기 직전 카드만 추려서 노출',
      '君臣佐使 분류 드릴 — 4-그리드 분류 게임',
      '처방 비교 (對比) — 두 처방 異同 한눈에',
      '한자 hover → 한국 한자음 자동 노출',
      '글로벌 빈출 오답 가중 출제',
      '본초 클릭 → 연관 처방 popup (對決/큐브)',
      '印章 共鳴 — 동 카테고리 3개 장착 시 보너스',
      '君臣佐使 드래그&드롭 (作圖)',
      '이순재 어록 broadcast (정답시)',
    ],
  },
  {
    v: 'v9.7',
    date: '2026-05-18',
    title: '業績·印章 + 캐릭터 시그니처',
    items: [
      '46개 업적 / 8 카테고리 / 銅·銀·金·翠 4 tier',
      '캐릭터 시그니처 三段 (章典/逸品/絕學)',
      '처방 사전 (게임 중 참조)',
    ],
  },
  {
    v: 'v9.6',
    date: '2026-05-18',
    title: '채팅·AI 對局·2시간의전사',
    items: [
      '카드 對決·방미큐브 채팅 (7 preset + 자유 입력)',
      'AI 對局 — 카드 對決·방미큐브',
      '勇者 2시간의전사 — 기출 반복 무점수 모드',
      '黃帝內經 명언 매일 1편',
    ],
  },
];

function _unreadCount(){
  const s = S(); if(!s) return CHANGELOG.length;
  const seen = s.seenChangelogVersion || '';
  let n = 0;
  for(const e of CHANGELOG){
    if(e.v === seen) break;
    n++;
  }
  return n;
}

function _markSeen(){
  const s = S(); if(!s) return;
  s.seenChangelogVersion = CHANGELOG[0].v;
  save();
  _refreshDotState();
}

function _openModal(){
  const n = _unreadCount();
  const html = `
    <h3 class="seal" style="margin:0;color:var(--zhusha-d);font-size:18px">最近 變更 · CHANGELOG</h3>
    <div style="font-size:11px;color:var(--gutong);margin-top:2px">대청에서 작은 알림으로 노출</div>
    <div style="max-height:60vh;overflow-y:auto;margin-top:10px">
      ${CHANGELOG.map((e, i) => {
        const isNew = i < n;
        return `
        <div style="padding:10px;border-radius:6px;margin-bottom:6px;
          background:${isNew?'#2A1E10':'var(--mi)'};
          border:1px solid ${isNew?'var(--zhusha-d)':'var(--mi-d)'};
          color:${isNew?'#FCF4E5':'var(--mo)'}">
          <div style="display:flex;align-items:center;gap:6px">
            <span class="han" style="font-size:14px;font-weight:700;color:${isNew?'#FFE08A':'var(--zhusha-d)'}">${esc(e.v)}</span>
            ${isNew ? '<span style="background:#9C3030;color:#FFE08A;padding:1px 6px;border-radius:8px;font-size:9.5px;font-weight:700">NEW</span>' : ''}
            <span style="font-size:10.5px;color:${isNew?'#876A36':'var(--gutong)'}">${esc(e.date)}</span>
            <span style="margin-left:auto;font-size:11.5px;color:${isNew?'#C9A227':'var(--mo-l)'};font-weight:600">${esc(e.title)}</span>
          </div>
          <ul style="margin:6px 0 0;padding-left:18px;font-size:11.5px;line-height:1.55;color:${isNew?'#E8D4B8':'var(--mo-l)'}">
            ${e.items.map(it => `<li style="margin:1px 0">${esc(it)}</li>`).join('')}
          </ul>
        </div>`;
      }).join('')}
    </div>
  `;
  if(window.openModal) window.openModal(html);
  _markSeen();
}

function _injectHomeAlert(){
  if(document.getElementById('v98-news-pill')) return;
  // 大廳 진입 시에만 — D-N 배너 옆에 작은 dot
  const hall = document.querySelector('.dn-banner, #hello-card, .tile-grid');
  if(!hall) return;
  const n = _unreadCount();
  if(!n) return;
  const pill = document.createElement('button');
  pill.id = 'v98-news-pill';
  pill.type = 'button';
  pill.style.cssText = `
    position:fixed; right:14px; bottom:88px; z-index:80;
    padding:8px 14px; border-radius:24px;
    background:#9C3030; color:#FFE08A;
    border:1px solid #FFE08A66;
    box-shadow:0 4px 16px rgba(0,0,0,.4), 0 0 12px #9C303066;
    font-family:'Noto Serif KR',serif; font-size:12.5px; font-weight:600;
    cursor:pointer; display:flex; align-items:center; gap:6px;
    animation:v98pulse 2s ease-in-out infinite;
  `;
  pill.innerHTML = `<span class="han" style="font-size:14px">新</span>업데이트 <b>${n}</b>건 →`;
  pill.addEventListener('click', _openModal);
  document.body.appendChild(pill);
  // 펄스 keyframes
  if(!document.getElementById('v98-news-css')){
    const st = document.createElement('style');
    st.id = 'v98-news-css';
    st.textContent = '@keyframes v98pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }';
    document.head.appendChild(st);
  }
}

function _refreshDotState(){
  const pill = document.getElementById('v98-news-pill');
  if(_unreadCount() === 0 && pill) pill.remove();
}

function _observeForHome(){
  const v = document.getElementById('view');
  if(!v){ setTimeout(_observeForHome, 300); return; }
  const obs = new MutationObserver(() => {
    try{
      const s = window.S;
      if(s && (s.lastTab === 'home' || s.lastTab === 'hall')) _injectHomeAlert();
      else { const p = document.getElementById('v98-news-pill'); if(p) p.remove(); }
    }catch(_){}
  });
  obs.observe(v, { childList:true, subtree:true });
  setTimeout(_injectHomeAlert, 400);
}

// ─── 부팅 ────────────────────────────────────────────────────────────────
if(document.readyState !== 'loading'){
  setTimeout(() => { _watchDict(); _delegateFormulaClicks(); _observeForHome(); }, 400);
} else {
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    _watchDict(); _delegateFormulaClicks(); _observeForHome();
  }, 400));
}

window.V98News = {
  open: _openModal,
  unreadCount: _unreadCount,
  markSeen: _markSeen,
  CHANGELOG,
};
window.V98DictPlus = {
  findDerivatives: _findDerivatives,
  findSubsetFormulas: _findSubsetFormulas,
};
})();
