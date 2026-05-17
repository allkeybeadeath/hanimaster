/* bangje-v98-diff.js — v9.8
 * ============================================================================
 * 처방 비교 모드 (diff view)
 *
 *   두 처방을 좌·우 컬럼으로 펼쳐 composition / action / indication 비교.
 *   • 共通 약재: 가운데 翡翠 chip
 *   • 한쪽에만 있는 약재: 좌·우 컬럼에 朱砂/古銅
 *   • action 키워드 集合 diff (단순 단어 split)
 *
 *   • V98Diff.open(idA, idB)             — 두 처방 비교 모달
 *   • V98Diff.openPicker(idA)            — A 고정 + B를 picker로 선택
 *   • V98Diff.suggestPairs(idA, n=5)     — 자주 혼동되는 쌍 휴리스틱
 *     (같은 chapter + composition 70% 이상 겹침)
 * ============================================================================ */
(function(){
'use strict';

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m, k); }catch(_){} }
function formulas(){ return (window.FORMULAS || []).concat(window.FORMULAS_EXTRA || []); }
function findF(id){ return formulas().find(x => x.id === id || x.ko === id || x.han === id); }

function _splitKw(s){
  return String(s || '').split(/[ ·,，。.\s]+/).filter(w => w && w.length >= 2);
}

function _diffSets(a, b){
  const sa = new Set(a), sb = new Set(b);
  const common = [], onlyA = [], onlyB = [];
  for(const x of sa){ (sb.has(x) ? common : onlyA).push(x); }
  for(const x of sb){ if(!sa.has(x)) onlyB.push(x); }
  return { common, onlyA, onlyB };
}

function _herbChip(h, kind){
  const colorMap = {
    common: 'background:#2A7060;color:#E8F4E8',
    onlyA:  'background:#9C3030;color:#FFE08A',
    onlyB:  'background:#876A36;color:#F0DCC4',
  };
  return `<span class="han v98diff-chip" data-han="${esc(h)}" style="${colorMap[kind]};padding:3px 8px;border-radius:10px;font-size:12px;cursor:pointer;display:inline-block;margin:2px">${esc(h)}</span>`;
}

function _kwChip(k, kind){
  const colorMap = {
    common: 'background:#2A706022;color:#2A7060;border:1px solid #2A706066',
    onlyA:  'background:#9C303022;color:#9C3030;border:1px solid #9C303066',
    onlyB:  'background:#876A3622;color:#876A36;border:1px solid #876A3666',
  };
  return `<span class="han" style="${colorMap[kind]};padding:2px 6px;border-radius:8px;font-size:11px;margin:1px;display:inline-block">${esc(k)}</span>`;
}

function open(idA, idB){
  const A = findF(idA), B = findF(idB);
  if(!A || !B){ toast('처방을 찾을 수 없음', 'warn'); return; }
  const cmp = _diffSets(A.composition || [], B.composition || []);
  const kwA = _splitKw(A.action), kwB = _splitKw(B.action);
  const kwd = _diffSets(kwA, kwB);
  const html = `
    <div style="font-size:11px;color:var(--gutong);text-align:center;letter-spacing:.08em">處方 對比 · 異同</div>
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin-top:8px;align-items:start">
      <div style="text-align:right">
        <div class="han" style="font-size:18px;color:var(--zhusha-d);font-weight:700">${esc(A.han)}</div>
        <div style="font-size:12px;color:var(--mo-l)">${esc(A.ko)}</div>
        <div style="font-size:10px;color:var(--gutong);margin-top:2px">${esc(A.chapter||'')}</div>
      </div>
      <div style="font-family:'ZCOOL XiaoWei',serif;font-size:20px;color:var(--zhusha);align-self:center">VS</div>
      <div style="text-align:left">
        <div class="han" style="font-size:18px;color:var(--zhusha-d);font-weight:700">${esc(B.han)}</div>
        <div style="font-size:12px;color:var(--mo-l)">${esc(B.ko)}</div>
        <div style="font-size:10px;color:var(--gutong);margin-top:2px">${esc(B.chapter||'')}</div>
      </div>
    </div>

    <div style="margin-top:14px">
      <div style="font-size:11.5px;color:var(--feicui);font-weight:700;letter-spacing:.08em">構成 <span style="color:var(--gutong);font-weight:400">— 共通 ${cmp.common.length} · A전용 ${cmp.onlyA.length} · B전용 ${cmp.onlyB.length}</span></div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin-top:6px">
        <div style="text-align:right">
          ${cmp.onlyA.length ? cmp.onlyA.map(h => _herbChip(h, 'onlyA')).join('') : '<span style="font-size:11px;color:var(--gutong);font-style:italic">완전 포함됨</span>'}
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:0 4px;border-left:1px dashed var(--mi-d);border-right:1px dashed var(--mi-d);min-width:120px">
          <div style="font-size:9.5px;color:var(--feicui);font-weight:700">共通</div>
          <div>${cmp.common.length ? cmp.common.map(h => _herbChip(h, 'common')).join('') : '<span style="font-size:10.5px;color:var(--gutong)">없음</span>'}</div>
        </div>
        <div style="text-align:left">
          ${cmp.onlyB.length ? cmp.onlyB.map(h => _herbChip(h, 'onlyB')).join('') : '<span style="font-size:11px;color:var(--gutong);font-style:italic">완전 포함됨</span>'}
        </div>
      </div>
    </div>

    <div style="margin-top:12px">
      <div style="font-size:11.5px;color:var(--feicui);font-weight:700;letter-spacing:.08em">作用</div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin-top:6px">
        <div style="text-align:right">${kwd.onlyA.map(k => _kwChip(k,'onlyA')).join('')}</div>
        <div style="text-align:center;border-left:1px dashed var(--mi-d);border-right:1px dashed var(--mi-d);padding:0 4px;min-width:120px">
          ${kwd.common.map(k => _kwChip(k,'common')).join('')}
        </div>
        <div style="text-align:left">${kwd.onlyB.map(k => _kwChip(k,'onlyB')).join('')}</div>
      </div>
    </div>

    <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:11px;color:var(--zhusha-d);font-weight:700">適應 · ${esc(A.han)}</div>
        <div style="font-size:11.5px;color:var(--mo-l);line-height:1.55;margin-top:3px">${esc(A.indication||'-')}</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--zhusha-d);font-weight:700">適應 · ${esc(B.han)}</div>
        <div style="font-size:11.5px;color:var(--mo-l);line-height:1.55;margin-top:3px">${esc(B.indication||'-')}</div>
      </div>
    </div>

    <div style="margin-top:10px;font-size:10px;color:var(--gutong);text-align:center;font-style:italic">
      약재 chip 클릭 → 그 본초를 쓰는 다른 처방 (V98HerbPop 활성 시)
    </div>
  `;
  if(typeof window.openModal === 'function') window.openModal(html);

  // 본초 chip 클릭 → V98HerbPop
  setTimeout(() => {
    document.querySelectorAll('.v98diff-chip').forEach(c => {
      c.addEventListener('click', () => {
        if(window.V98HerbPop) window.V98HerbPop.openFor(c.dataset.han);
      });
    });
  }, 50);
}

function suggestPairs(idA, n){
  const A = findF(idA); if(!A) return [];
  const setA = new Set(A.composition || []);
  const arr = formulas().filter(B => B.id !== A.id && (B.chapter === A.chapter)).map(B => {
    const setB = new Set(B.composition || []);
    let common = 0;
    for(const x of setA) if(setB.has(x)) common++;
    const overlap = common / Math.max(1, Math.min(setA.size, setB.size));
    return { B, overlap };
  }).filter(x => x.overlap >= 0.4)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, n || 5);
  return arr.map(x => x.B);
}

function openPicker(idA){
  const A = findF(idA); if(!A){ toast('처방 없음', 'warn'); return; }
  const suggestions = suggestPairs(idA, 6);
  const allBy = formulas().slice().sort((a, b) => String(a.chapter||'').localeCompare(b.chapter||''));
  const html = `
    <div style="font-size:13px;color:var(--zhusha-d);font-weight:700;text-align:center">
      <span class="han">${esc(A.han)}</span> 와 비교할 다른 처방
    </div>
    ${suggestions.length ? `
      <div style="margin-top:10px;font-size:11px;color:var(--feicui);font-weight:700">자주 혼동되는 처방</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
        ${suggestions.map(B => `<button class="btn btn-sm" type="button" data-pid="${esc(B.id)}" style="background:var(--feicui);color:var(--mi-w);padding:3px 9px;font-size:12px">
          <span class="han">${esc(B.han)}</span>
        </button>`).join('')}
      </div>
    ` : ''}
    <div style="margin-top:10px;font-size:11px;color:var(--gutong);font-weight:700">전체</div>
    <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;max-height:240px;overflow-y:auto">
      ${allBy.filter(B => B.id !== A.id).map(B => `<button class="btn btn-sm btn-o" type="button" data-pid="${esc(B.id)}" style="padding:2px 7px;font-size:11.5px">
        <span class="han">${esc(B.han)}</span>
      </button>`).join('')}
    </div>
  `;
  if(typeof window.openModal === 'function') window.openModal(html);
  setTimeout(() => {
    document.querySelectorAll('[data-pid]').forEach(b => {
      b.addEventListener('click', () => {
        try{ window.closeModal && window.closeModal(); }catch(_){}
        setTimeout(() => open(idA, b.dataset.pid), 80);
      });
    });
  }, 50);
}

window.V98Diff = { open, openPicker, suggestPairs };
})();
