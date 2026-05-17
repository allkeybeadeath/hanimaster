/* bangje-v97-profile.js — v9.7
 * ============================================================================
 * 業績 갤러리 + 印章 장착 UI
 *
 *   • V97Profile.openGallery()  — 모달로 전체 업적 표시 (해제/미해제)
 *                                  카테고리별 그루핑, 印章 장착/해제 토글
 *   • V97Profile.sealsHTML(size, max) — 메달리온 둘레에 표시할 印章 HTML
 *                                       (장착된 印章 최대 N개)
 *   • V97Profile.profileTileHTML() — 홈 카드 안에 들어갈 미니 업적 진행도
 *
 *   • 홈 메뉴에 '業績' 타일 자동 추가 (#home-tile-grid 에 inject)
 *
 * ─── 의존성 ──────────────────────────────────────────────────────────────
 *   • window.openModal / window.closeModal   (app.js)
 *   • window.S                               (app.js)
 *   • window.ACHIEVEMENTS / ACHIEVEMENT_BY_ID / TIER_META / ACHIEVEMENT_CAT_COLORS
 *   • window.V97Ach                          (bangje-v97-achievements.js)
 *   • window.toast                           (app.js, 선택)
 * ============================================================================ */

(function(){
'use strict';

function $(sel, root){ return (root || document).querySelector(sel); }
function $$(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
function esc(s){
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _have(id){
  const s = window.S; if(!s) return false;
  return (s.achievements || []).includes(id);
}
function _equipped(id){
  const s = window.S; if(!s) return false;
  return (s.equippedSeals || []).includes(id);
}

// ─── 印章 HTML — 메달리온 옆에 작은 도장으로 표시 ──────────────────────
// equipped 업적의 sealHan/color/tier 를 작은 도장으로 (최대 N 개)
function sealsHTML(size, maxN){
  size = size || 24;
  maxN = (typeof maxN === 'number') ? maxN : 3;
  const s = window.S; if(!s) return '';
  const list = (s.equippedSeals || []).slice(0, maxN);
  if(!list.length) return '';
  const byId = window.ACHIEVEMENT_BY_ID || {};
  const tierMeta = window.TIER_META || {};
  const parts = list.map(id => {
    const ach = byId[id]; if(!ach) return '';
    const tm = tierMeta[ach.tier] || { color:'#C9A227', glow:'rgba(201,162,39,.55)' };
    const fs = Math.round(size * 0.58);
    return `<span title="${esc(ach.han)} · ${esc(ach.ko)}" style="
      display:inline-flex; align-items:center; justify-content:center;
      width:${size}px;height:${size}px;border-radius:5px;
      background:#9C3030;color:#FFE08A;
      font-family:'ZCOOL XiaoWei','Ma Shan Zheng',serif;font-size:${fs}px;line-height:1;
      box-shadow:inset 0 0 0 1.5px ${tm.color}, 0 2px 5px rgba(0,0,0,.4), 0 0 8px ${tm.glow};
      transform:rotate(-5deg);">${esc(ach.sealHan || '✓')}</span>`;
  }).filter(Boolean);
  if(!parts.length) return '';
  return `<span class="v97-seals" style="display:inline-flex; gap:4px; vertical-align:middle">${parts.join('')}</span>`;
}

// ─── 프로필 진행도 미니 HTML (홈 카드용) ───────────────────────────────
function profileTileHTML(){
  const s = window.S; if(!s) return '';
  const total = (window.ACHIEVEMENTS || []).length;
  const have = (s.achievements || []).length;
  const pct = total ? Math.round(have / total * 100) : 0;
  return `
    <div style="display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--mo-l)">
      <span class="han" style="font-size:13px;color:var(--zhusha-d);font-weight:700">業績</span>
      <span><b style="color:var(--zhusha-d);font-size:13px">${have}</b> / ${total}</span>
      <div style="flex:1;height:6px;background:var(--mi-d);border-radius:3px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg, var(--huang) 0%, var(--zhusha) 100%)"></div>
      </div>
      <button class="btn btn-sm btn-ghost" type="button" onclick="V97Profile.openGallery()" style="font-size:11px;padding:2px 8px">열기</button>
    </div>
  `;
}

// ─── 진행률 측정 (조건의 현재 값 → % ) ─────────────────────────────────
function _progress(ach){
  const s = window.S; if(!s) return { val:0, target:1, pct:0 };
  const c = ach.cond || {};
  const stats = s.achStats || {};
  let val = 0, target = 1;
  switch(c.type){
    case 'counter_gte': {
      if(c.name === 'knownIdsCount') val = (s.knownIds||[]).length;
      else if(c.name === 'flashRatedCount') val = Object.keys(s.flashRated||{}).length;
      else if(c.name === 'battleAttended') val = (s.battleStats||{}).attended || 0;
      else if(c.name === 'maxRightByChar'){
        const m = stats._rightByChar || {};
        val = Object.values(m).reduce((a,b) => a>b?a:b, 0);
      }
      else if(c.name && c.name.indexOf('rightByChapter:') === 0){
        val = (stats._rightByChapter || {})[c.name.split(':')[1]] || 0;
      }
      else if(c.name && c.name.indexOf('rightByChar:') === 0){
        val = (stats._rightByChar || {})[c.name.split(':')[1]] || 0;
      }
      else val = stats[c.name] || 0;
      target = c.threshold || 1;
      break;
    }
    case 'streak_gte': val = stats.bestStreak || 0; target = c.threshold; break;
    case 'perfectQuiz': val = stats.perfectQuiz || 0; target = c.threshold; break;
    case 'wrongCleared': val = stats.wrongCleared ? 1 : 0; target = 1; break;
    case 'battleWin': val = (s.battleStats||{}).wins || 0; target = c.threshold; break;
    case 'battleStreak': val = (s.battleStats||{}).bestStreak || 0; target = c.threshold; break;
    case 'battleBetLevel':
      val = (c.level === 3 ? (s.battleStats||{}).bigWins : (s.battleStats||{}).fateWins) || 0;
      target = c.threshold; break;
    case 'characterCount': {
      const byId = window.PHYSICIAN_BY_ID || {};
      const cats = new Set();
      Object.keys(stats._rightByChar || {}).forEach(id => {
        const p = byId[id]; if(p && p.cat) cats.add(p.cat);
      });
      val = cats.size; target = c.threshold; break;
    }
    case 'characterDivine': val = (s.unlockedDivine||[]).length; target = c.threshold; break;
    case 'signatureFired': {
      const m = s.signatureStats || {};
      const key = c.kind === 'chapter' ? 'chapterFired'
                : c.kind === 'formula' ? 'yipinFired'
                : c.kind === 'juexue'  ? 'juexueFired'
                : c.kind === 'leeline' ? 'leelineFired' : null;
      val = key ? (m[key]||0) : 0; target = c.threshold; break;
    }
    case 'achievementCount': val = (s.achievements||[]).length; target = c.threshold; break;
    case 'allChaptersCleared': {
      const map = stats._rightByChapter || {};
      val = Math.min(map['6']||0, 20) + Math.min(map['7']||0, 20) + Math.min(map['8']||0, 20);
      target = 60; break;
    }
    default:
      val = 0; target = 1;
  }
  return { val, target, pct: target ? Math.min(1, val/target) : 0 };
}

// ─── 갤러리 모달 ──────────────────────────────────────────────────────
function openGallery(){
  const all = window.ACHIEVEMENTS || [];
  const s = window.S || {};
  const have = new Set(s.achievements || []);
  const eq = new Set(s.equippedSeals || []);
  const total = all.length;
  const haveN = have.size;
  const tierMeta = window.TIER_META || {};
  const catColors = window.ACHIEVEMENT_CAT_COLORS || {};

  // 카테고리별 그룹
  const grouped = {};
  all.forEach(a => { (grouped[a.cat] || (grouped[a.cat] = [])).push(a); });
  const catOrder = ['학습','문답','章典','氣博','流派','時辰','同學','特技'];

  const renderCell = (ach) => {
    const got = have.has(ach.id);
    const equipped = eq.has(ach.id);
    const tm = tierMeta[ach.tier] || { color:'#C9A227', glow:'rgba(201,162,39,.55)', label:'' };
    const pr = _progress(ach);
    const pct = (pr.pct * 100).toFixed(0);
    return `
      <div class="ach-cell ${got?'got':''}" data-id="${esc(ach.id)}" style="
        background:${got ? 'linear-gradient(180deg, #2A1E10 0%, #1C140A 100%)' : 'var(--mi)'};
        border:1px solid ${got ? tm.color : 'var(--mi-d)'};
        border-radius:8px;
        padding:10px;
        opacity:${got ? '1' : '0.78'};
        ${got ? `box-shadow:0 0 0 1px ${tm.color}55, 0 2px 8px rgba(0,0,0,.3);` : ''}
      ">
        <div style="display:flex; align-items:center; gap:10px">
          <div style="width:38px;height:38px;border-radius:6px;flex-shrink:0;
                      background:${got ? '#9C3030' : '#876A3633'};
                      color:${got ? '#FFE08A' : 'var(--gutong)'};
                      display:flex;align-items:center;justify-content:center;
                      font-family:'ZCOOL XiaoWei','Ma Shan Zheng',serif;font-size:22px;
                      box-shadow:${got ? 'inset 0 0 0 1.5px '+tm.color+', 0 2px 5px rgba(0,0,0,.4)' : 'inset 0 0 0 1px #87673633'};
                      transform:rotate(-4deg)">
            ${esc(ach.sealHan || '?')}
          </div>
          <div style="min-width:0; flex:1">
            <div style="display:flex;align-items:center;gap:6px">
              <span class="han" style="font-size:13px;font-weight:700;color:${got ? '#FFE08A' : 'var(--mo)'}">${esc(ach.han)}</span>
              <span style="font-size:10px;color:${tm.color};background:${tm.color}22;padding:1px 5px;border-radius:8px">${esc(tm.label || '')}</span>
            </div>
            <div style="font-size:11.5px;color:${got ? '#E8D4B8' : 'var(--mo-l)'};line-height:1.35;margin-top:1px">${esc(ach.ko)}</div>
            <div style="font-size:10.5px;color:${got ? '#876A36' : 'var(--gutong)'};line-height:1.3;margin-top:1px">${esc(ach.desc)}</div>
            ${!got ? `<div style="display:flex;align-items:center;gap:6px;margin-top:5px">
              <div style="flex:1;height:4px;background:var(--mi-d);border-radius:2px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${tm.color}"></div>
              </div>
              <span style="font-size:10px;color:var(--gutong);font-variant-numeric:tabular-nums">${pr.val}/${pr.target}</span>
            </div>` : ''}
          </div>
          ${got ? `<button class="ach-equip-btn btn btn-sm ${equipped?'':'btn-o'}" type="button" data-id="${esc(ach.id)}"
                            style="flex-shrink:0;font-size:11px;padding:4px 8px;${equipped?'background:var(--feicui);color:var(--mi-w)':''}">
              ${equipped ? '裝着中' : '裝着'}
            </button>` : ''}
        </div>
      </div>
    `;
  };

  let html = `
    <h3 class="seal" style="margin:0 0 4px;color:var(--zhusha-d);font-size:20px">業績·印章</h3>
    <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:10px">
      해제 <b style="color:var(--zhusha-d)">${haveN}</b> / ${total} ·
      장착 ${(s.equippedSeals||[]).length}/3 ·
      <span style="color:var(--gutong)">印章을 장착하면 메달리온 옆에 도장으로 표시됩니다</span>
    </div>
  `;

  for(const cat of catOrder){
    const list = grouped[cat]; if(!list || !list.length) continue;
    const col = catColors[cat] || '#876A36';
    const gotInCat = list.filter(a => have.has(a.id)).length;
    html += `<div style="margin-top:14px;display:flex;align-items:center;gap:6px">
      <span class="han" style="font-size:13px;color:${col};font-weight:700;letter-spacing:.08em">${esc(cat)}</span>
      <span style="font-size:10.5px;color:var(--gutong)">${gotInCat}/${list.length}</span>
      <div style="flex:1;height:1px;background:linear-gradient(90deg, ${col}, transparent)"></div>
    </div>`;
    html += `<div style="display:grid;grid-template-columns:1fr;gap:6px;margin-top:6px">`;
    list.forEach(a => { html += renderCell(a); });
    html += `</div>`;
  }

  if(typeof window.openModal === 'function'){
    window.openModal(html);
  } else {
    // fallback (단독 호출 시)
    alert('업적 모달: ' + haveN + '/' + total);
    return;
  }

  // 장착 토글 핸들러
  setTimeout(() => {
    $$('.ach-equip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const isEq = (window.S.equippedSeals || []).includes(id);
        if(isEq){
          window.V97Ach.unequip(id);
        } else {
          const ok = window.V97Ach.equip(id);
          if(!ok){
            if(typeof window.toast === 'function') window.toast('印章은 최대 3개까지 장착 가능', 'red');
          }
        }
        // refresh — 모달 다시 열기 (간단)
        try{ window.closeModal && window.closeModal(); }catch(_){}
        setTimeout(openGallery, 80);
        // 헤더/홈도 갱신
        try{ window.refreshHeader && window.refreshHeader(); }catch(_){}
        try{ if(window.S && window.S.lastTab === 'home' && typeof window.renderHome === 'function') window.renderHome(); }catch(_){}
      });
    });
  }, 50);
}

// ─── 홈 타일 자동 추가 ─────────────────────────────────────────────────
// app.js 의 renderHome 가 실행된 후 .tile-grid 에 '業績' 타일을 inject.
// renderHome 를 직접 패치하지 않고, MutationObserver 로 안전하게 추가.
function _injectHomeTile(){
  // tile-grid 에 이미 있으면 skip
  const grids = $$('.tile-grid');
  grids.forEach(grid => {
    if(grid.dataset.v97Injected === '1') return;
    // '명예의 전당 · 멀티 對決' 타일이 있는 grid 만 (홈 화면)
    const hallTile = grid.querySelector('.tile.gold.wide');
    if(!hallTile) return;
    const btn = document.createElement('button');
    btn.className = 'tile';
    btn.type = 'button';
    btn.onclick = () => openGallery();
    btn.innerHTML = `
      <span class="han">業績</span><span class="ttl">業績·印章<span class="new-badge">NEW</span></span>
      <span class="desc">${(window.ACHIEVEMENTS||[]).length} 업적 · 印章 장착으로 프로필 꾸미기</span>
    `;
    // 명예의 전당 wide 타일 바로 앞에 삽입
    grid.insertBefore(btn, hallTile);
    grid.dataset.v97Injected = '1';
  });
}

// 메달리온 옆에 印章 자동 표시 — 홈/명예전당 카드 안에 inject
function _injectSealsBesideMedallions(){
  // hello-card 와 명예전당 카드의 메달리온 옆에 印章 영역 추가
  const targets = [
    { card:'#hello-card', anchor:'.cmedal, [id="char-pick-medal"]' },
  ];
  // hello-card 안에서 name span 옆에 印章 추가
  const helloCard = document.getElementById('hello-card');
  if(helloCard && !helloCard.dataset.v97Seals){
    const sealHtml = sealsHTML(22, 3);
    if(sealHtml){
      // 이름 줄 (.seal[font-size:18px]) 끝에 추가
      const nameRow = helloCard.querySelector('[style*="display:flex"][style*="align-items:center"]');
      if(nameRow){
        const wrap = document.createElement('span');
        wrap.innerHTML = sealHtml;
        wrap.style.marginLeft = '4px';
        // 이름 칩 들 뒤에 그러나 "이름·진영" 버튼 앞에 삽입
        const editBtn = nameRow.querySelector('#edit-name-btn');
        if(editBtn) nameRow.insertBefore(wrap, editBtn);
        else nameRow.appendChild(wrap);
        helloCard.dataset.v97Seals = '1';
      }
    }
  }
}

// MutationObserver 로 홈/명예전당 렌더 후 inject
function _observe(){
  const view = document.getElementById('view');
  if(!view){ setTimeout(_observe, 300); return; }
  const obs = new MutationObserver(() => {
    try{
      _injectHomeTile();
      _injectSealsBesideMedallions();
    }catch(_){}
  });
  obs.observe(view, { childList:true, subtree:true });
  // 첫 시도
  setTimeout(() => {
    try{ _injectHomeTile(); _injectSealsBesideMedallions(); }catch(_){}
  }, 400);
}

if(document.readyState === 'complete' || document.readyState === 'interactive'){
  setTimeout(_observe, 500);
} else {
  document.addEventListener('DOMContentLoaded', () => setTimeout(_observe, 500));
}

// ─── 공개 API ─────────────────────────────────────────────────────────
window.V97Profile = {
  openGallery,
  sealsHTML,
  profileTileHTML,
};

})();
