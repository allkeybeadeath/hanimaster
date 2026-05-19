/* bangje-v98-home.js — v9.8
 * ============================================================================
 * 大廳 「學習 强化」 진입점 패널 + 설정 토글
 *
 *   • 홈 tile-grid 에 「v9.8 學習」 와이드 타일 자동 inject
 *   • 클릭 시 모달: 진입점 + 토글 설정
 *
 *   진입점:
 *     - SRS 복습 시작 (V98SRS.startReviewSession)
 *     - 君臣佐使 드릴 (V98Drill.startSession)
 *     - 君臣佐使 作圖 (V98Canvas.start)
 *     - 처방 對比 (V98Diff.openPicker — picker 우선)
 *     - 빈출 오답 모드 (V98Weighted.start)
 *     - 처방 사전 (V97Dict.open)
 *
 *   설정 토글:
 *     - 한자 hover (V98Hanyin)
 *     - 본초 popup mode (V98HerbPop.setMode)
 *     - 이순재 broadcast (V98Leeline.toggle)
 *
 *   각 변경 즉시 저장.
 * ============================================================================ */
(function(){
'use strict';

function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function S(){ return window.S || null; }
function save(){ try{ window.saveState && window.saveState(); }catch(_){} }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }

// ─── 모달 ──────────────────────────────────────────────────────────────
function openHub(){
  const dueN = (window.V98SRS && window.V98SRS.dueCount && window.V98SRS.dueCount()) || 0;
  const s = S() || {};
  const hanyinOn = !window.V98Hanyin || window.V98Hanyin.isEnabled();
  const herbPopMode = (window.V98HerbPop && window.V98HerbPop.getMode()) || 'longpress';
  const herbPopOn = !window.V98HerbPop || window.V98HerbPop.isEnabled();
  const leeOn = s.leelineBroadcast !== false;

  const tile = (title, han, sub, onClick, color) => `
    <button class="tile" type="button" style="background:${color||'var(--mi)'};color:${color?'#FFE08A':'var(--mo)'};display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:11px"
      onclick="(${onClick.toString()})(); window.closeModal && window.closeModal();">
      <span class="han" style="font-size:18px;color:${color?'#FFE08A':'var(--zhusha-d)'}">${esc(han)}</span>
      <span class="ttl" style="font-size:13.5px">${esc(title)}</span>
      ${sub ? `<span class="desc" style="font-size:11px;color:${color?'#C9A227':'var(--gutong)'};margin-top:2px">${esc(sub)}</span>` : ''}
    </button>
  `;

  const html = `
    <h3 class="seal" style="margin:0;color:var(--zhusha-d);font-size:18px">v9.8 學習 强化</h3>
    <div style="font-size:11px;color:var(--gutong);margin-top:1px">시험 D-2 학습 모드</div>

    <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
      ${tile('SRS 복습', '復', dueN ? `오늘 만기 ${dueN}` : '만기 없음', () => window.V98SRS.startReviewSession(), '#1C140A')}
      ${tile('君臣佐使 드릴', '分', '4분면 분류', () => window.V98Drill.startSession({count:10}), '')}
      ${tile('君臣佐使 作圖', '圖', '드래그 게임', () => window.V98Canvas.start({count:5}), '#2A1E10')}
      ${tile('處方 對比', '對', '두 처방 異同', () => window.V98Diff.openPicker((window.FORMULAS&&window.FORMULAS[0]&&window.FORMULAS[0].id)||'sagunja-tang'), '')}
      ${tile('빈출 오답 모드', '頻', 'TOP 50 가중', () => window.V98Weighted.start({n:10}), '#9C3030')}
      ${tile('處方 사전', '典', '검색·章 필터', () => window.V97Dict.open(), '')}
    </div>

    <div style="margin-top:14px;padding-top:8px;border-top:1px dashed var(--mi-d)">
      <div style="font-size:11.5px;color:var(--zhusha-d);font-weight:700;letter-spacing:.06em">設定</div>

      <div class="v98-set-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--mi-d)">
        <span class="han" style="font-size:13px;color:var(--mo)">한자 hover → 한국 한자음</span>
        <span style="flex:1;font-size:10.5px;color:var(--gutong)">데스크 hover · 모바일 long-press</span>
        <button type="button" id="v98-set-hanyin" class="btn btn-sm ${hanyinOn?'':'btn-o'}" style="${hanyinOn?'background:var(--feicui);color:var(--mi-w)':''}">${hanyinOn?'ON':'OFF'}</button>
      </div>

      <div class="v98-set-row" style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px dashed var(--mi-d)">
        <div style="flex:1">
          <div class="han" style="font-size:13px;color:var(--mo)">본초 클릭 → 연관 처방 popup</div>
          <div style="font-size:10.5px;color:var(--gutong)">對決·큐브의 본초 카드에서 사용</div>
        </div>
        <select id="v98-set-herbpop-mode" style="background:var(--mi);border:1px solid var(--mi-d);border-radius:4px;padding:3px 6px;font-size:11.5px;font-family:inherit">
          <option value="off"${herbPopMode==='off'?' selected':''}>OFF</option>
          <option value="longpress"${herbPopMode==='longpress'?' selected':''}>롱프레스</option>
          <option value="icon"${herbPopMode==='icon'?' selected':''}>ⓘ 아이콘</option>
        </select>
      </div>

      <div class="v98-set-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--mi-d)">
        <span class="han" style="font-size:13px;color:var(--mo)">이순재 broadcast</span>
        <span style="flex:1;font-size:10.5px;color:var(--gutong)">다른 사용자 정답 시 어록 mini-toast</span>
        <button type="button" id="v98-set-leeline" class="btn btn-sm ${leeOn?'':'btn-o'}" style="${leeOn?'background:var(--feicui);color:var(--mi-w)':''}">${leeOn?'ON':'OFF'}</button>
      </div>
    </div>

    <div style="margin-top:10px;font-size:10.5px;color:var(--gutong);text-align:center">
      <span class="han">v9.8 본과 2학년 방제학</span>
    </div>
  `;
  if(window.openModal) window.openModal(html);

  setTimeout(() => {
    const hy = $('#v98-set-hanyin');
    hy && hy.addEventListener('click', () => {
      window.V98Hanyin && window.V98Hanyin.toggle();
      try{ window.closeModal && window.closeModal(); }catch(_){}
      setTimeout(openHub, 100);
    });
    const hp = $('#v98-set-herbpop-mode');
    hp && hp.addEventListener('change', () => {
      window.V98HerbPop && window.V98HerbPop.setMode(hp.value);
    });
    const lee = $('#v98-set-leeline');
    lee && lee.addEventListener('click', () => {
      window.V98Leeline && window.V98Leeline.toggle();
      try{ window.closeModal && window.closeModal(); }catch(_){}
      setTimeout(openHub, 100);
    });
  }, 50);
}

// ─── 大廳 타일 inject ──────────────────────────────────────────────────
function _injectHomeTile(){
  document.querySelectorAll('.tile-grid').forEach(grid => {
    if(grid.dataset.v98HubInjected === '1') return;
    const hallTile = grid.querySelector('.tile.gold.wide');
    if(!hallTile) return;
    const btn = document.createElement('button');
    btn.className = 'tile';
    btn.type = 'button';
    btn.onclick = openHub;
    btn.style.cssText = 'background:linear-gradient(135deg, #1C140A 0%, #2A1E10 100%);color:#FFE08A;border:1px solid #C9A227';
    const dueN = (window.V98SRS && window.V98SRS.dueCount && window.V98SRS.dueCount()) || 0;
    btn.innerHTML = `
      <span class="han" style="color:#FFE08A">學</span>
      <span class="ttl">v9.8 學習 强化 <span class="new-badge">NEW</span></span>
      <span class="desc" style="color:#C9A227">${dueN ? `오늘 복습 ${dueN}개 · ` : ''}SRS · 君臣佐使 · 對比 · 빈출 오답</span>
    `;
    grid.insertBefore(btn, hallTile);
    grid.dataset.v98HubInjected = '1';
  });
}

function _observe(){
  const v = document.getElementById('view');
  if(!v){ setTimeout(_observe, 300); return; }
  const obs = new MutationObserver(() => { try{ _injectHomeTile(); }catch(_){} });
  obs.observe(v, { childList:true, subtree:true });
  setTimeout(_injectHomeTile, 400);
}
if(document.readyState !== 'loading') setTimeout(_observe, 600);
else document.addEventListener('DOMContentLoaded', () => setTimeout(_observe, 600));

window.V98Hub = { open: openHub };
})();
