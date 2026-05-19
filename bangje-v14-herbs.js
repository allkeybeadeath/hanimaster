/* bangje-v14-herbs.js — v14.4 「본초 학습」 UI 모듈
 * ============================================================================
 *  - data-v14-herbs.js (HERBS, HERB_CATEGORIES) 데이터를 시각화
 *  - HG_FORMULAS.composition을 역인덱스하여 약재→처방 자동 매핑
 *  - 진입점: 의서궁(clinic-hub) 신규 「本草學習」 버튼 / 방감 헤더 미니 버튼
 *
 *  외부 API: window.V14Herbs = { open }
 *  라우트:   ROUTES.herbs
 * ============================================================================ */
(function(){
'use strict';

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────
function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ─── 약재 → 처방 역인덱스 빌드 (HG_FORMULAS 활용) ─────────────────────────
let __herbToFormulas = null;
function buildHerbIndex(){
  if(__herbToFormulas) return __herbToFormulas;
  const idx = {};
  const FORMULAS = window.HG_FORMULAS || [];
  FORMULAS.forEach(fm => {
    (fm.composition||[]).forEach(h => {
      if(!idx[h]) idx[h] = [];
      idx[h].push({ id: fm.id, ko: fm.ko, han: fm.han, chapter: fm.chapter||'' });
    });
  });
  __herbToFormulas = idx;
  return idx;
}

// ─── 스타일 주입 ──────────────────────────────────────────────────────────
function injectStyles(){
  if(document.getElementById('v14h-styles')) return;
  const css = `
    .v14h-wrap{
      max-width:1100px; margin:0 auto; padding:14px 12px 60px;
      font-family: -apple-system, "Noto Sans KR", sans-serif;
    }
    .v14h-hdr{
      display:flex; align-items:center; gap:10px; margin-bottom:14px;
      padding-bottom:10px; border-bottom:2px solid #d4a574;
    }
    .v14h-hdr h1{
      font-size:1.4em; margin:0; color:#5a3825; letter-spacing:1px;
      display:flex; align-items:center; gap:8px;
    }
    .v14h-hdr .stamp{
      display:inline-block; padding:2px 8px; border:1.5px solid #c2585b;
      color:#c2585b; font-size:.7em; border-radius:4px; transform:rotate(-2deg);
      letter-spacing:1px;
    }
    .v14h-hdr .meta{ margin-left:auto; font-size:.85em; color:#7a6a5a; }
    .v14h-back{
      background:#5a3825; color:#fff; border:none; padding:6px 12px;
      border-radius:4px; cursor:pointer; font-size:.9em;
    }
    .v14h-search{
      display:flex; align-items:center; gap:8px; margin-bottom:16px;
      padding:8px 12px; background:#f5ede1; border-radius:8px;
    }
    .v14h-search input{
      flex:1; padding:7px 10px; border:1px solid #d4a574; border-radius:4px;
      font-size:1em; background:#fff;
    }
    .v14h-search .count{ font-size:.85em; color:#7a6a5a; white-space:nowrap; }

    .v14h-cat-section{ margin-bottom:18px; }
    .v14h-cat-label{
      display:inline-block; padding:4px 12px; border-radius:14px;
      color:#fff; font-size:.85em; font-weight:600; margin-bottom:8px;
    }
    .v14h-grid{
      display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr));
      gap:8px;
    }
    .v14h-card{
      background:#fff; border:1.5px solid #e0d4c0; border-radius:8px;
      padding:10px 8px; cursor:pointer; transition:all .18s;
      text-align:center;
    }
    .v14h-card:hover{
      border-color:#d4a574; transform:translateY(-2px);
      box-shadow:0 3px 10px rgba(0,0,0,.08);
    }
    .v14h-card .ko{ font-size:1.1em; font-weight:600; color:#5a3825; }
    .v14h-card .han{ font-size:.78em; color:#9c8268; margin-top:2px; }
    .v14h-card .badge{
      display:inline-block; margin-top:4px; padding:1px 6px;
      background:#f5ede1; border-radius:8px; font-size:.7em; color:#7a6a5a;
    }
    .v14h-card.hilite{ border-color:#c2585b; background:#fff7f0; }

    /* 모달 */
    .v14h-modal-back{
      position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:9000;
      display:flex; align-items:center; justify-content:center; padding:14px;
      animation: v14hFade .2s ease-out;
    }
    @keyframes v14hFade { from { opacity:0; } to { opacity:1; } }
    .v14h-modal{
      background:#fef9f0; border:2px solid #d4a574; border-radius:10px;
      max-width:720px; width:100%; max-height:90vh; overflow-y:auto;
      animation: v14hPop .25s ease-out;
    }
    @keyframes v14hPop {
      from { transform:scale(.94) translateY(10px); opacity:0; }
      to   { transform:scale(1) translateY(0); opacity:1; }
    }
    .v14h-modal .h{
      display:flex; align-items:baseline; gap:12px; padding:14px 18px 10px;
      border-bottom:1.5px solid #d4a574;
    }
    .v14h-modal .h .ko{ font-size:1.5em; font-weight:700; color:#5a3825; }
    .v14h-modal .h .han{ font-size:1.1em; color:#9c8268; }
    .v14h-modal .h .close{
      margin-left:auto; background:none; border:none; font-size:1.4em;
      cursor:pointer; color:#7a6a5a; padding:0 4px;
    }
    .v14h-modal .h .close:hover{ color:#c2585b; }

    .v14h-modal .body{ padding:14px 18px 20px; }
    .v14h-modal .row{
      display:grid; grid-template-columns:80px 1fr; gap:10px;
      padding:6px 0; border-bottom:1px dashed #e0d4c0; align-items:baseline;
    }
    .v14h-modal .row .lbl{ font-size:.85em; color:#7a6a5a; font-weight:600; }
    .v14h-modal .row .val{ font-size:.95em; color:#3a2818; }
    .v14h-modal .row.note{ background:#fff7e8; padding:8px 10px; margin-top:8px; border-radius:5px; border:none; grid-template-columns:1fr; }
    .v14h-modal .row.note .val{ font-size:.88em; color:#7a4a25; line-height:1.6; }

    .v14h-modal h3{
      font-size:1em; color:#c2585b; margin:14px 0 6px;
      padding-bottom:4px; border-bottom:1.5px solid #d4a574; letter-spacing:.5px;
    }
    .v14h-formula-list{ display:flex; flex-wrap:wrap; gap:6px; }
    .v14h-formula-chip{
      display:inline-flex; align-items:center; gap:4px;
      padding:4px 10px; background:#5a3825; color:#fff;
      border-radius:14px; font-size:.85em; cursor:pointer;
      transition:background .15s;
    }
    .v14h-formula-chip:hover{ background:#c2585b; }
    .v14h-formula-chip .chp{ font-size:.7em; opacity:.7; }

    .v14h-exam-list{
      margin:0; padding-left:18px;
    }
    .v14h-exam-list li{
      padding:5px 0; font-size:.92em; line-height:1.55; color:#3a2818;
    }
    .v14h-exam-list li:has(strong), .v14h-exam-list li.star{
      color:#a04545; font-weight:500;
    }

    /* 입장 버튼 (의서궁) */
    .v14h-clinic-btn{
      display:flex; align-items:center; gap:10px;
      width:100%; padding:11px 15px; margin:8px 0;
      background:linear-gradient(135deg, #d4a574, #c08855);
      color:#fff; border:none; border-radius:8px; cursor:pointer;
      font-family: inherit; font-size:.98em; font-weight:600;
      transition: all .18s;
    }
    .v14h-clinic-btn:hover{
      background:linear-gradient(135deg, #c08855, #a87245);
      transform: translateX(2px);
      box-shadow: 0 3px 10px rgba(192, 136, 85, 0.3);
    }
    .v14h-clinic-btn .icon{ font-size:1.3em; }
    .v14h-clinic-btn .label{ flex:1; text-align:left; }
    .v14h-clinic-btn .count{ font-size:.82em; opacity:.85; }

    /* 미니 버튼 (방감 헤더) */
    .v14h-mini-btn{
      display:inline-flex; align-items:center; gap:5px;
      padding:5px 10px; background:#d4a574; color:#fff;
      border:none; border-radius:14px; font-size:.85em; cursor:pointer;
      font-family: inherit; transition: background .15s;
    }
    .v14h-mini-btn:hover{ background:#c08855; }

    @media (max-width: 560px){
      .v14h-grid{ grid-template-columns:repeat(auto-fill, minmax(90px, 1fr)); }
      .v14h-modal .row{ grid-template-columns:70px 1fr; }
      .v14h-card .ko{ font-size:1em; }
    }
  `;
  const st = document.createElement('style');
  st.id = 'v14h-styles';
  st.textContent = css;
  document.head.appendChild(st);
}

// ─── 메인 화면 렌더 ───────────────────────────────────────────────────────
function render(rootSel){
  injectStyles();
  const HERBS = window.V14_HERBS || {};
  const CATS = window.V14_HERB_CATEGORIES || [];
  buildHerbIndex();

  const total = Object.keys(HERBS).length;
  const root = $(rootSel || '#view');
  if(!root) return;

  root.innerHTML = `
    <div class="v14h-wrap">
      <div class="v14h-hdr">
        <button class="v14h-back">← 의서궁</button>
        <h1>本草 學習 <span class="stamp">v14.4 NEW</span></h1>
        <div class="meta">총 <b>${total}</b> 약재 · 범주 <b>${CATS.length}</b></div>
      </div>
      <div class="v14h-search">
        <span style="font-size:1.1em;">🔍</span>
        <input type="text" placeholder="약재명·한자·범주로 검색 (예: 황기, 黃芪, 보기약)" id="v14h-q">
        <span class="count" id="v14h-count">${total} / ${total}</span>
      </div>
      <div id="v14h-body"></div>
    </div>
  `;

  $('.v14h-back', root).onclick = () => {
    if(window.ROUTES && window.ROUTES.hub) window.ROUTES.hub();
    else if(window.ROUTES && window.ROUTES.home) window.ROUTES.home();
    else history.back();
  };

  renderBody(root, '');
  const q = $('#v14h-q', root);
  q.addEventListener('input', e => renderBody(root, e.target.value.trim()));
  setTimeout(()=>q.focus(), 50);
}

function renderBody(root, query){
  const HERBS = window.V14_HERBS || {};
  const CATS = window.V14_HERB_CATEGORIES || [];
  const body = $('#v14h-body', root);
  const counter = $('#v14h-count', root);
  const qLower = (query || '').toLowerCase();

  // 검색 필터
  const matched = {};
  let total = 0, hits = 0;
  for(const [name, herb] of Object.entries(HERBS)){
    total++;
    if(!qLower){
      matched[name] = herb;
      hits++;
      continue;
    }
    const hay = (name + '|' + (herb.hanja||'') + '|' + (herb.cat||'') + '|' + (herb.hyo||'')).toLowerCase();
    if(hay.includes(qLower)){
      matched[name] = herb;
      hits++;
    }
  }
  counter.textContent = `${hits} / ${total}`;

  // 범주별 그룹화
  const byCat = {};
  for(const [name, herb] of Object.entries(matched)){
    const c = herb.cat || '기타';
    if(!byCat[c]) byCat[c] = [];
    byCat[c].push({ name, herb });
  }

  // 카테고리 순서대로 출력
  let html = '';
  CATS.forEach(c => {
    if(!byCat[c.key] || !byCat[c.key].length) return;
    html += `<div class="v14h-cat-section">
      <div class="v14h-cat-label" style="background:${c.color}">${c.emoji} ${esc(c.key)} <span style="opacity:.8;font-weight:400;font-size:.92em;">${byCat[c.key].length}</span></div>
      <div class="v14h-grid">`;
    byCat[c.key].forEach(({name, herb}) => {
      const formulaCount = (__herbToFormulas[name] || []).length;
      const star = (herb.examPoints||[]).some(e => e.startsWith('★')) ? '★' : '';
      html += `<div class="v14h-card${star?' hilite':''}" data-herb="${esc(name)}">
        <div class="ko">${esc(name)} ${star?'<span style="color:#c2585b">★</span>':''}</div>
        <div class="han">${esc(herb.hanja||'')}</div>
        <div class="badge">${formulaCount}개 처방</div>
      </div>`;
    });
    html += `</div></div>`;
  });
  // 분류되지 않은 카테고리
  for(const c in byCat){
    if(CATS.some(x => x.key === c)) continue;
    html += `<div class="v14h-cat-section">
      <div class="v14h-cat-label" style="background:#888">${esc(c)} <span style="opacity:.8;font-weight:400;">${byCat[c].length}</span></div>
      <div class="v14h-grid">`;
    byCat[c].forEach(({name, herb}) => {
      html += `<div class="v14h-card" data-herb="${esc(name)}">
        <div class="ko">${esc(name)}</div>
        <div class="han">${esc(herb.hanja||'')}</div>
      </div>`;
    });
    html += `</div></div>`;
  }
  if(!html){
    html = `<div style="text-align:center;padding:60px 20px;color:#9c8268;">
      <div style="font-size:2em;">🔍</div>
      <div style="margin-top:10px;">검색 결과가 없습니다</div>
    </div>`;
  }
  body.innerHTML = html;

  // 카드 클릭 → 모달
  $$('.v14h-card', body).forEach(card => {
    card.onclick = () => openModal(card.dataset.herb);
  });
}

// ─── 약재 상세 모달 ────────────────────────────────────────────────────────
function openModal(name){
  const HERBS = window.V14_HERBS || {};
  const herb = HERBS[name];
  if(!herb) return;
  const formulas = (__herbToFormulas[name] || []).slice();
  // 챕터순 정렬
  formulas.sort((a,b) => (a.chapter||'').localeCompare(b.chapter||''));

  const back = document.createElement('div');
  back.className = 'v14h-modal-back';
  back.innerHTML = `
    <div class="v14h-modal" onclick="event.stopPropagation()">
      <div class="h">
        <span class="ko">${esc(name)}</span>
        <span class="han">${esc(herb.hanja||'')}</span>
        <button class="close" aria-label="닫기">×</button>
      </div>
      <div class="body">
        <div class="row"><div class="lbl">범주</div><div class="val">${esc(herb.cat||'-')}</div></div>
        <div class="row"><div class="lbl">性味</div><div class="val">${esc(herb.seongmi||'-')}</div></div>
        <div class="row"><div class="lbl">歸經</div><div class="val">${esc(herb.gwigyeong||'-')}</div></div>
        <div class="row"><div class="lbl">功效</div><div class="val">${esc(herb.hyo||'-')}</div></div>
        ${herb.note ? `<div class="row note"><div class="val">💡 ${esc(herb.note)}</div></div>` : ''}

        <h3>포함된 處方 (${formulas.length}개)</h3>
        ${formulas.length ? `<div class="v14h-formula-list">
          ${formulas.map(f => `<span class="v14h-formula-chip" data-fid="${esc(f.id)}">
            ${esc(f.ko)} <span class="chp">${esc(f.chapter||'')}</span>
          </span>`).join('')}
        </div>` : '<div style="color:#9c8268;font-size:.9em;">시험범위 내 등록된 처방 없음</div>'}

        <h3>시험 핵심 포인트 (${(herb.examPoints||[]).length}개)</h3>
        ${herb.examPoints && herb.examPoints.length ? `<ul class="v14h-exam-list">
          ${herb.examPoints.map(p => `<li${p.startsWith('★')?' class="star"':''}>${esc(p)}</li>`).join('')}
        </ul>` : '<div style="color:#9c8268;font-size:.9em;">시험 포인트 미등록</div>'}
      </div>
    </div>
  `;
  back.onclick = e => { if(e.target === back) back.remove(); };
  $('.close', back).onclick = () => back.remove();
  // ESC 닫기
  const onKey = e => { if(e.key === 'Escape') { back.remove(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  // 처방 칩 클릭 → 헬게이트의 해당 처방으로 (가능하면)
  $$('.v14h-formula-chip', back).forEach(chip => {
    chip.onclick = () => {
      back.remove();
      if(window.V13Hellgate && window.V13Hellgate.open){
        window.V13Hellgate.open(chip.dataset.fid);
      }
    };
  });
  document.body.appendChild(back);
}

// ─── 진입 함수 ────────────────────────────────────────────────────────────
function open(){
  // header 컨텍스트 (있다면)
  if(window.setHeaderContext) window.setHeaderContext('herbs');
  // view 영역 확보
  let view = document.getElementById('view');
  if(!view){
    view = document.createElement('div');
    view.id = 'view';
    document.body.appendChild(view);
  }
  render('#view');
}

// ─── 의서궁 진입 버튼 주입 ─────────────────────────────────────────────────
function injectInClinic(){
  if(!window.V11ClinicHub || !window.V11ClinicHub.open) return;
  if(window.__v14hCnHooked) return;
  window.__v14hCnHooked = true;
  const orig = window.V11ClinicHub.open;
  window.V11ClinicHub.open = function(){
    orig.apply(this, arguments);
    setTimeout(() => {
      injectStyles();
      const view = $('#view');
      if(!view) return;
      if(view.querySelector('.v14h-clinic-btn')) return;
      const total = Object.keys(window.V14_HERBS||{}).length;
      const btn = document.createElement('button');
      btn.className = 'v14h-clinic-btn';
      btn.innerHTML = `
        <span class="icon">🌿</span>
        <span class="label">本草 學習 — 처방을 약재로 풀어보기</span>
        <span class="count">${total}味</span>
      `;
      btn.onclick = (e) => { e.stopPropagation(); open(); };

      // 헬게이트 배너 / 방감 배너 다음에 끼워 넣기
      const hubBanner = view.querySelector('.hg-hellgate-banner');
      const fjBanner  = view.querySelector('.v14-fj-banner, .v14fj-banner, .v14-banner');
      const grBanner  = view.querySelector('.v14g-banner, .v14-graph-banner');
      const drBanner  = view.querySelector('.v14d-banner, .v14-drill-banner');
      const after = drBanner || grBanner || fjBanner || hubBanner;
      if(after && after.parentNode){
        after.parentNode.insertBefore(btn, after.nextSibling);
      } else {
        // 적당한 위치: hub 그리드 위
        const grid = view.querySelector('.hub-grid');
        if(grid && grid.parentNode){
          grid.parentNode.insertBefore(btn, grid);
        } else {
          view.appendChild(btn);
        }
      }
    }, 100);
  };
  if(window.ROUTES) window.ROUTES.herbs = open;
}

// ─── 방감 헤더 미니 버튼 주입 ──────────────────────────────────────────────
function injectInFangjian(){
  if(!window.V14PyoriBoMap || !window.V14PyoriBoMap.open) return;
  if(window.__v14hFjHooked) return;
  window.__v14hFjHooked = true;
  const orig = window.V14PyoriBoMap.open;
  window.V14PyoriBoMap.open = function(){
    orig.apply(this, arguments);
    setTimeout(() => {
      injectStyles();
      const hdr = document.querySelector('.v14-hdr');
      if(!hdr) return;
      if(hdr.querySelector('.v14h-mini-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'v14h-mini-btn';
      btn.innerHTML = `🌿 本草 →`;
      btn.onclick = (e) => { e.stopPropagation(); open(); };
      // drill 미니 버튼 다음에
      const drBtn = hdr.querySelector('.v14d-mini-btn');
      if(drBtn && drBtn.parentNode){
        drBtn.parentNode.insertBefore(btn, drBtn.nextSibling);
      } else {
        hdr.appendChild(btn);
      }
    }, 100);
  };
}

// ─── 외부 API ─────────────────────────────────────────────────────────────
window.V14Herbs = { open, render };
if(window.ROUTES) window.ROUTES.herbs = open;

// 부트
function boot(){
  // 4단계 잠금 — 다른 모듈이 늦게 로드돼도 잡기
  injectInClinic();
  injectInFangjian();
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
setTimeout(boot, 100);
setTimeout(boot, 500);
setTimeout(boot, 1500);

console.log('[v14.4 본초] UI 모듈 로드 완료');

})();
