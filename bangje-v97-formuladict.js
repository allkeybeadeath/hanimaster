/* bangje-v97-formuladict.js — v9.7
 * ============================================================================
 * 처방 사전 모달 — 카드 對決·큐브 對局 중 참고용
 *
 *   • V97Dict.open()          : 모달 열기 (검색 + 章 필터 + 목록 + 상세)
 *   • V97Dict.close()         : 모달 닫기
 *
 *   모달은 overlay 자체 DOM 으로 부착 (openModal 사용 안 함 — 게임 보드 자체가
 *   진행 중이라 view 영역 modal-slot 도 사용 가능하나, 別 모달 스택을 써서
 *   게임 모달(penalty/skill 등)과 충돌 없이 위에 올림).
 *
 * ─── 의존성 ──────────────────────────────────────────────────────────────
 *   • window.FORMULAS                 (data-formulas.js)
 *   • window.FORMULAS_EXTRA (선택)    (data-formulas-extra.js)
 *   • window.FORMULA_ADDITIONS (선택) (data-additions.js)
 *
 *   대상: 6·7·8장 + 핵심·확장 + 派生·加減 (필터로 토글).
 * ============================================================================ */

(function(){
'use strict';

function esc(s){
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

let _state = { chap:'all', q:'' };
let _overlay = null;
let _detailId = null;     // 펼친 처방 id

function _allFormulas(){
  const core = (typeof window.FORMULAS !== 'undefined') ? window.FORMULAS : [];
  const ex = (typeof window.FORMULAS_EXTRA !== 'undefined') ? window.FORMULAS_EXTRA : [];
  return core.concat(ex);
}

function _chapShort(ch){
  if(!ch) return '?';
  // '8장 補益劑·補氣' → '8·補氣'
  const m = String(ch).match(/^(\d)장\s*[^·]+·(.+)$/);
  if(m) return `${m[1]}·${m[2]}`;
  const m2 = String(ch).match(/^(\d)-(\d)/);
  if(m2) return `${m2[1]}-${m2[2]}`;
  return String(ch).slice(0, 8);
}

function _chapNum(ch){
  if(!ch) return 0;
  const m = String(ch).match(/^(\d)/);
  return m ? +m[1] : 9;
}

function _compString(f){
  const c = f.composition || [];
  return c.map(h => typeof h === 'string' ? h : (h.han || h.ko || h.name || '?')).join('·');
}

function _renderList(){
  const all = _allFormulas();
  const q = (_state.q || '').trim().toLowerCase();
  const chap = _state.chap;
  const filtered = all.filter(f => {
    if(chap !== 'all' && _chapNum(f.chapter) !== +chap) return false;
    if(!q) return true;
    const hay = `${f.han||''} ${f.ko||''} ${f.action||''} ${_compString(f)}`.toLowerCase();
    return hay.indexOf(q) >= 0;
  }).sort((a,b) => {
    const ca = _chapNum(a.chapter), cb = _chapNum(b.chapter);
    if(ca !== cb) return ca - cb;
    return (a.chapter||'').localeCompare(b.chapter||'');
  });

  if(!filtered.length){
    return `<div style="text-align:center;padding:20px;color:var(--gutong);font-size:12.5px">검색 결과 없음</div>`;
  }

  return filtered.map(f => {
    const open = (_detailId === f.id);
    return `
      <div class="v97-dict-item${open?' open':''}" data-fid="${esc(f.id)}" style="
        border:1px solid ${open?'var(--zhusha-d)':'var(--mi-d)'};
        border-radius:6px; margin-bottom:5px;
        background:${open?'linear-gradient(180deg, #2A1E10 0%, #1C140A 100%)':'var(--mi)'};
        color:${open?'#FCF4E5':'var(--mo)'};
        overflow:hidden;
        ${open?'box-shadow:0 0 0 1px var(--zhusha-d)55, 0 2px 8px rgba(0,0,0,.3);':''}">
        <button class="v97-dict-head" type="button" data-fid="${esc(f.id)}" style="
          width:100%; text-align:left; padding:8px 10px;
          background:transparent; border:0; cursor:pointer;
          color:inherit; font-family:inherit;
          display:flex; align-items:center; gap:8px;">
          <span class="han" style="font-size:15px;color:${open?'#FFE08A':'var(--zhusha-d)'};font-weight:700;letter-spacing:.02em">${esc(f.han||'?')}</span>
          <span style="font-size:12.5px;color:${open?'#E8D4B8':'var(--mo-l)'}">${esc(f.ko||'')}</span>
          <span style="margin-left:auto;font-size:10.5px;color:${open?'#C9A227':'var(--gutong)'}">${esc(_chapShort(f.chapter))}</span>
        </button>
        ${open ? `
          <div style="padding:0 10px 10px;font-size:12px;line-height:1.55;border-top:1px dashed ${open?'#876A3644':'var(--mi-d)'}">
            ${f.action ? `<div style="margin-top:6px"><span class="han" style="color:#C9A227;font-size:11.5px">作用</span> <span class="han" style="color:#FFE08A">${esc(f.action)}</span></div>` : ''}
            <div style="margin-top:4px"><span class="han" style="color:#C9A227;font-size:11.5px">構成</span> <span class="han" style="color:#FFE08A;font-size:13px">${esc(_compString(f))}</span></div>
            ${f.indication ? `<div style="margin-top:4px"><span class="han" style="color:#C9A227;font-size:11.5px">適應</span> <span style="color:#E8D4B8;font-size:11.5px">${esc(f.indication)}</span></div>` : ''}
            ${f.source ? `<div style="margin-top:4px;font-size:10.5px;color:#876A36"><span class="han">源</span> ${esc(f.source)}</div>` : ''}
            ${(f.keyPoints||[]).length ? `
              <div style="margin-top:6px"><span class="han" style="color:#C9A227;font-size:11.5px">要點</span></div>
              <ul style="margin:2px 0 0;padding-left:18px;font-size:11.5px;color:#E8D4B8">
                ${(f.keyPoints||[]).map(k=>`<li style="margin:2px 0">${esc(k)}</li>`).join('')}
              </ul>` : ''}
            ${(f.mnemonics||[]).length ? `
              <div style="margin-top:6px"><span class="han" style="color:#C9A227;font-size:11.5px">訣</span> <span style="font-size:11.5px;color:#FFE08A">${esc((f.mnemonics||[])[0]||'')}</span></div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function _renderShell(){
  if(!_overlay) return;
  const body = _overlay.querySelector('#v97-dict-body');
  if(body) body.innerHTML = _renderList();
  // 검색·필터 이벤트 재바인딩 불필요 (shell 그대로 유지)
}

function _attachListEvents(){
  if(!_overlay) return;
  _overlay.querySelectorAll('.v97-dict-head').forEach(btn => {
    btn.addEventListener('click', () => {
      const fid = btn.dataset.fid;
      _detailId = (_detailId === fid) ? null : fid;
      _renderShell();
      _attachListEvents();
      // 펼친 항목이 보이도록 스크롤
      if(_detailId){
        setTimeout(() => {
          const it = _overlay.querySelector(`.v97-dict-item[data-fid="${CSS.escape(_detailId)}"]`);
          if(it && it.scrollIntoView) it.scrollIntoView({behavior:'smooth', block:'nearest'});
        }, 30);
      }
    });
  });
}

function open(){
  close();
  const all = _allFormulas();
  const chapters = ['all', 6, 7, 8];
  const overlay = document.createElement('div');
  overlay.id = 'v97-dict-overlay';
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(12,8,4,.82);
    z-index:9200; display:flex; align-items:center; justify-content:center;
    padding:16px;
  `;
  overlay.innerHTML = `
    <div style="background:#1C140A; color:#FCF4E5;
                border:1px solid #876A36; border-radius:10px;
                width:100%; max-width:560px; max-height:88vh;
                display:flex; flex-direction:column;
                box-shadow:0 12px 48px rgba(0,0,0,.6);">
      <div style="padding:12px 14px; border-bottom:1px solid #876A3666;
                  display:flex; align-items:center; gap:8px; flex-shrink:0">
        <span class="seal" style="font-size:16px;color:#FFE08A;font-family:'ZCOOL XiaoWei',serif">方劑 사전</span>
        <span style="font-size:11px;color:#876A36">${all.length} 처방</span>
        <button id="v97-dict-close" type="button" aria-label="닫기" style="
          margin-left:auto; width:30px; height:30px; border-radius:6px;
          background:#876A3633; border:1px solid #876A3666; color:#FFE08A;
          font-size:18px; cursor:pointer; line-height:1; font-family:inherit">×</button>
      </div>
      <div style="padding:10px 14px; border-bottom:1px solid #876A3633; flex-shrink:0">
        <input id="v97-dict-search" type="search" placeholder="검색: 처방명·작용·약재…" autocomplete="off" style="
          width:100%; padding:8px 10px; border-radius:6px;
          background:#2A1E10; border:1px solid #876A3666;
          color:#FCF4E5; font-size:13px; font-family:inherit; box-sizing:border-box">
        <div style="display:flex; gap:4px; margin-top:8px; flex-wrap:wrap">
          ${chapters.map(c => `
            <button class="v97-dict-chap-btn" data-chap="${c}" type="button" style="
              padding:3px 10px; border-radius:14px;
              background:${_state.chap == c ? '#9C3030' : 'transparent'};
              color:${_state.chap == c ? '#FFE08A' : '#C9A227'};
              border:1px solid ${_state.chap == c ? '#FFE08A88' : '#876A3666'};
              font-size:11px; cursor:pointer; font-family:'ZCOOL XiaoWei',serif">
              ${c === 'all' ? '全' : c+'장'}
            </button>
          `).join('')}
        </div>
      </div>
      <div id="v97-dict-body" style="
        flex:1; overflow-y:auto; padding:10px 14px;
        scrollbar-width:thin; scrollbar-color:#876A3666 transparent;">
        ${_renderList()}
      </div>
      <div style="padding:8px 14px; border-top:1px solid #876A3633; font-size:10.5px; color:#876A36; text-align:center; flex-shrink:0">
        처방 클릭 → 構成·作用·要點. 게임 중에도 자유 참조 가능.
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  _overlay = overlay;

  // 이벤트
  overlay.querySelector('#v97-dict-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });

  // 검색
  const search = overlay.querySelector('#v97-dict-search');
  let qTimer = null;
  search.addEventListener('input', () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      _state.q = search.value || '';
      _detailId = null;
      _renderShell();
      _attachListEvents();
    }, 150);
  });

  // 章 필터
  overlay.querySelectorAll('.v97-dict-chap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.chap = btn.dataset.chap;
      _detailId = null;
      // 재렌더 (스타일 갱신 위해 전체 shell 다시)
      close();
      open();
    });
  });

  _attachListEvents();
  setTimeout(() => search.focus(), 100);
}

function close(){
  if(_overlay && _overlay.parentNode){
    _overlay.parentNode.removeChild(_overlay);
  }
  _overlay = null;
}

window.V97Dict = { open, close };

})();
