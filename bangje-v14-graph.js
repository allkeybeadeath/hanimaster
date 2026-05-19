/* bangje-v14-graph.js — v14 「關係圖(관계도)」 뷰어
 * ============================================================================
 *  - 3개의 SVG 처방 관계도 (表裏雙解劑 / 補益劑 / 章間連結)
 *  - Pan & Zoom 인터랙션:
 *      · 마우스 휠 → 줌 (커서 위치 기준)
 *      · 드래그 → 팬
 *      · 핀치 → 줌 (모바일)
 *      · 더블탭/더블클릭 → 리셋
 *      · +/− 버튼, 풀스크린 버튼, 리셋 버튼
 *      · 키보드: + - 0 화살표 ESC
 *  - 3개 그래프 탭 전환
 *  - 의서궁 / 방제학 home / 방감 모드 안에 「關係圖」 진입점 추가
 *
 *  외부 API: window.V14Graph = { open, render }
 *  라우트: ROUTES.graph
 * ============================================================================ */
(function(){
'use strict';

function $(s,r){ return (r||document).querySelector(s); }
function $$(s,r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ───────────────────────────────────────────────────────────────────────
// 1) 스타일 주입 — 의서궁 디자인 변수 활용 + 그래프 전용 클래스 정의
//    (원본 관계도의 .node-rect, .edge-* 등을 그대로 살림)
// ───────────────────────────────────────────────────────────────────────
function injectStyles(){
  if(document.getElementById('v14-graph-style')) return;
  const s = document.createElement('style');
  s.id = 'v14-graph-style';
  s.textContent = `
    /* ─── v14 關係圖 컨테이너 ─────────────────────────────────────── */
    .v14g-wrap{
      max-width:1100px;margin:0 auto;padding:12px 10px 80px;
      font-family:var(--font-body,'Noto Serif KR',serif);color:var(--mo,#1C140A);
    }
    .v14g-wrap.fs{max-width:100%;padding:6px}

    .v14g-hdr{
      background:linear-gradient(180deg,#1C140A 0%,#3A2A18 100%);
      color:var(--huang-l,#FFE08A);padding:14px 14px;border-radius:var(--r-lg,14px);
      border:2px solid var(--huang,#C9A227);position:relative;overflow:hidden;
      box-shadow:var(--sh-lg,0 8px 24px rgba(0,0,0,.32));
    }
    .v14g-hdr .seal{
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:26px;
      letter-spacing:.08em;color:var(--huang-l,#FFE08A);text-shadow:2px 2px 0 rgba(0,0,0,.4);
    }
    .v14g-hdr .sub{font-size:11px;opacity:.85;margin-top:4px;letter-spacing:.12em}
    .v14g-back{
      position:absolute;top:10px;right:12px;background:rgba(252,244,229,.12);
      border:1px solid var(--huang,#C9A227);color:var(--huang-l,#FFE08A);
      padding:5px 11px;border-radius:8px;font-size:11.5px;cursor:pointer;font-family:inherit;
    }
    .v14g-back:hover{background:rgba(252,244,229,.22)}

    /* 탭 */
    .v14g-tabs{
      display:flex;gap:6px;margin:14px 0 10px;flex-wrap:wrap;
    }
    .v14g-tab{
      flex:1;min-width:90px;background:#FFF;border:1.5px solid var(--gutong,#876A36);
      padding:10px 8px;font-family:inherit;font-size:13px;cursor:pointer;
      border-radius:8px;font-weight:600;color:var(--mo,#1C140A);
      transition:all .15s;
    }
    .v14g-tab:hover{transform:translateY(-1px)}
    .v14g-tab.active{
      background:var(--zhusha,#9C3030);color:var(--huang-l,#FFE08A);
      border-color:var(--zhusha-d,#6E1818);box-shadow:0 2px 6px rgba(110,24,24,.3);
    }
    .v14g-tab.bo.active{background:var(--huang-d,#8C6818);border-color:#5A4008}
    .v14g-tab.pp.active{background:#5D3A6E;border-color:#3A1F4A}

    /* 그래프 컨테이너 */
    .v14g-graph{
      background:#FFFDF6;border:2px solid var(--gutong,#876A36);border-radius:8px;
      position:relative;overflow:hidden;
      touch-action:none;        /* 핀치 줌 직접 처리 */
      user-select:none;-webkit-user-select:none;
      cursor:grab;
      box-shadow:var(--sh,0 3px 10px rgba(0,0,0,.22));
    }
    .v14g-graph.dragging{cursor:grabbing}
    .v14g-graph.fs{
      position:fixed;inset:0;z-index:9999;border-radius:0;border:none;
      background:#FFFDF6;
    }
    .v14g-svg-host{
      width:100%;height:100%;
      transform-origin:0 0;
      transition:transform 0s;
      will-change:transform;
    }
    /* v14.3: SVG를 컨테이너 폭+높이에 꽉 차게 (해상도 향상) */
    .v14g-svg-host svg{
      display:block;width:100%;height:100%;
      pointer-events:none;
    }
    /* 모바일 그래프 높이 — v14.3: 해상도 향상 (저화질 클레임 대응) */
    .v14g-graph{height:78vh;min-height:560px}
    .v14g-graph.fs{height:100vh;min-height:100vh}

    /* 컨트롤 패널 */
    .v14g-ctrl{
      position:absolute;top:8px;left:8px;display:flex;gap:5px;z-index:10;
      background:rgba(255,253,246,.92);padding:4px;border-radius:8px;
      border:1px solid var(--gutong,#876A36);box-shadow:0 2px 6px rgba(0,0,0,.15);
    }
    .v14g-btn{
      background:#FFF;border:1px solid var(--gutong,#876A36);
      width:30px;height:30px;border-radius:5px;cursor:pointer;
      font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;
      color:var(--mo,#1C140A);display:flex;align-items:center;justify-content:center;
      padding:0;line-height:1;
      transition:all .12s;
    }
    .v14g-btn:hover{background:var(--mi-d,#E8D4B8);transform:translateY(-1px)}
    .v14g-btn:active{transform:translateY(0);background:var(--zhusha,#9C3030);color:#FFE08A}
    .v14g-btn.wide{width:auto;padding:0 8px;font-size:11px}

    .v14g-ctrl-right{
      position:absolute;top:8px;right:8px;display:flex;gap:5px;z-index:10;
      background:rgba(255,253,246,.92);padding:4px;border-radius:8px;
      border:1px solid var(--gutong,#876A36);box-shadow:0 2px 6px rgba(0,0,0,.15);
    }

    /* zoom 레벨 표시 */
    .v14g-zoom-info{
      position:absolute;bottom:8px;left:8px;
      background:rgba(28,20,10,.78);color:var(--huang-l,#FFE08A);
      padding:3px 9px;border-radius:6px;font-size:10.5px;
      font-family:'JetBrains Mono',monospace;letter-spacing:.05em;z-index:10;
      pointer-events:none;
    }

    /* 사용법 힌트 */
    .v14g-hint{
      position:absolute;bottom:8px;right:8px;
      background:rgba(255,253,246,.85);color:#666;
      padding:3px 8px;border-radius:6px;font-size:10px;
      border:1px dashed #C8B89A;letter-spacing:.04em;z-index:10;
      pointer-events:none;font-family:inherit;
    }

    /* 범례 — 그래프 아래 */
    .v14g-legend{
      background:#FFF8E8;border:1.5px solid var(--gutong,#876A36);border-radius:8px;
      padding:9px 12px;margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;
      font-size:11.5px;align-items:center;
    }
    .v14g-legend b{
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);
      letter-spacing:.08em;border-right:1.5px solid var(--mo,#1C140A);
      padding-right:8px;font-size:12px;color:var(--zhusha-d,#6E1818);
    }
    .v14g-leg-item{display:inline-flex;align-items:center;gap:5px}
    .v14g-leg-line{display:inline-block;width:24px;height:0;border-top:2px solid var(--mo,#1C140A)}
    .v14g-leg-line.dash{border-top-style:dashed}
    .v14g-leg-line.thick{border-top-width:4px}
    .v14g-leg-box{display:inline-block;width:16px;height:16px;border:1.2px solid var(--mo,#1C140A)}

    /* 그래프 내부 클래스 (원본 관계도와 동일) */
    .v14g-graph svg .node-rect{stroke:var(--mo,#1C140A);stroke-width:1.5;cursor:pointer}
    .v14g-graph svg .node-main{fill:#FFF5D8;stroke:#6E1818;stroke-width:2.5}
    .v14g-graph svg .node-main.bigexam{fill:#FFE5CC;stroke:#A82828;stroke-width:3.5}
    .v14g-graph svg .node-sub{fill:#FDFAF2;stroke:var(--mo,#1C140A);stroke-width:1.5;stroke-dasharray:4 3}
    .v14g-graph svg .node-base{fill:#E0DDC8;stroke:#6E6850;stroke-width:1.5}
    .v14g-graph svg .label-name{font-family:'Noto Serif KR',serif;font-weight:900;text-anchor:middle;dominant-baseline:central;fill:var(--mo,#1C140A)}
    .v14g-graph svg .label-fn{font-family:'Noto Serif KR',serif;font-weight:500;text-anchor:middle;font-size:9.5px;fill:#5A5A5A}
    .v14g-graph svg .label-meta{font-family:'JetBrains Mono',monospace;font-weight:600;text-anchor:middle;font-size:8.5px;fill:#6E1818}
    .v14g-graph svg .exam-badge{fill:#A82828;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:8px;text-anchor:middle}
    .v14g-graph svg .edge{fill:none}
    .v14g-graph svg .edge-add{stroke:#2E6B48;stroke-width:2}
    .v14g-graph svg .edge-sub{stroke:#A82828;stroke-width:2;stroke-dasharray:6 3}
    .v14g-graph svg .edge-equiv{stroke:#234D70;stroke-width:1.5;stroke-dasharray:2 3}
    .v14g-graph svg .edge-similar{stroke:#5A2E6E;stroke-width:1.2;stroke-dasharray:1 4;opacity:.7}
    .v14g-graph svg .edge-contain{stroke:#B8860B;stroke-width:2.5}
    .v14g-graph svg .edge-derive{stroke:#B8521A;stroke-width:2.5}
    .v14g-graph svg .edge-label{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;text-anchor:middle;fill:var(--mo,#1C140A)}
    .v14g-graph svg .edge-label-bg{fill:#FFFDF6;stroke:#C4B598;stroke-width:.5}
    .v14g-graph svg .category-banner{font-family:'Noto Serif KR',serif;font-weight:900;letter-spacing:4px;text-anchor:middle}

    @media(max-width:520px){
      .v14g-hint{display:none}
      .v14g-graph{height:72vh;min-height:480px}
      .v14g-tab{font-size:12px;padding:8px 4px}
      .v14g-wrap{padding:8px 6px 70px}
    }
  `;
  document.head.appendChild(s);
}

// ───────────────────────────────────────────────────────────────────────
// 2) Pan & Zoom 엔진
//    - svgHost(div)에 transform: translate(tx,ty) scale(s) 적용
//    - 마우스 휠 / 드래그 / 터치(핀치) 처리
// ───────────────────────────────────────────────────────────────────────
function createPanZoom(container, svgHost, opts){
  opts = opts || {};
  const state = {
    scale: opts.initialScale || 1,
    tx: 0, ty: 0,
    minScale: 0.4,
    maxScale: 12,   // v14.3: 8 → 12 (고해상도 정밀 확인용)
  };
  let isDragging = false;
  let dragStartX=0, dragStartY=0, dragStartTx=0, dragStartTy=0;
  // 터치(핀치)
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let pinchStartCx=0, pinchStartCy=0;
  let pinchStartTx=0, pinchStartTy=0;

  function apply(){
    svgHost.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
    if(opts.onChange) opts.onChange(state);
  }
  function setScaleAt(newScale, clientX, clientY){
    newScale = Math.max(state.minScale, Math.min(state.maxScale, newScale));
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    // 줌 포인트 기준
    const ratio = newScale / state.scale;
    state.tx = x - (x - state.tx) * ratio;
    state.ty = y - (y - state.ty) * ratio;
    state.scale = newScale;
    apply();
  }
  function reset(){
    state.scale = opts.initialScale || 1;
    state.tx = 0;
    state.ty = 0;
    apply();
  }
  function zoom(factor, cx, cy){
    const rect = container.getBoundingClientRect();
    cx = cx==null ? rect.left + rect.width/2 : cx;
    cy = cy==null ? rect.top + rect.height/2 : cy;
    setScaleAt(state.scale * factor, cx, cy);
  }

  // 휠
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.18 : 1/1.18;
    setScaleAt(state.scale * factor, e.clientX, e.clientY);
  }, { passive:false });

  // 마우스 드래그
  container.addEventListener('mousedown', (e) => {
    if(e.button !== 0) return;
    isDragging = true;
    container.classList.add('dragging');
    dragStartX = e.clientX; dragStartY = e.clientY;
    dragStartTx = state.tx; dragStartTy = state.ty;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if(!isDragging) return;
    state.tx = dragStartTx + (e.clientX - dragStartX);
    state.ty = dragStartTy + (e.clientY - dragStartY);
    apply();
  });
  window.addEventListener('mouseup', () => {
    if(isDragging){ isDragging = false; container.classList.remove('dragging'); }
  });

  // 더블클릭 리셋
  container.addEventListener('dblclick', (e) => {
    e.preventDefault();
    reset();
  });

  // 터치
  function touchDist(t1, t2){
    const dx = t1.clientX - t2.clientX, dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  }
  function touchMid(t1, t2){
    return { x:(t1.clientX+t2.clientX)/2, y:(t1.clientY+t2.clientY)/2 };
  }

  container.addEventListener('touchstart', (e) => {
    if(e.touches.length === 1){
      const t = e.touches[0];
      isDragging = true;
      dragStartX = t.clientX; dragStartY = t.clientY;
      dragStartTx = state.tx; dragStartTy = state.ty;
    } else if(e.touches.length === 2){
      isDragging = false;
      pinchStartDist = touchDist(e.touches[0], e.touches[1]);
      pinchStartScale = state.scale;
      const m = touchMid(e.touches[0], e.touches[1]);
      pinchStartCx = m.x; pinchStartCy = m.y;
      pinchStartTx = state.tx; pinchStartTy = state.ty;
    }
    e.preventDefault();
  }, { passive:false });

  container.addEventListener('touchmove', (e) => {
    if(e.touches.length === 1 && isDragging){
      const t = e.touches[0];
      state.tx = dragStartTx + (t.clientX - dragStartX);
      state.ty = dragStartTy + (t.clientY - dragStartY);
      apply();
    } else if(e.touches.length === 2){
      const d = touchDist(e.touches[0], e.touches[1]);
      const ratio = d / pinchStartDist;
      const newScale = Math.max(state.minScale, Math.min(state.maxScale, pinchStartScale * ratio));
      // 핀치 중심점 기준 줌
      const m = touchMid(e.touches[0], e.touches[1]);
      const rect = container.getBoundingClientRect();
      const cx = pinchStartCx - rect.left;
      const cy = pinchStartCy - rect.top;
      const r = newScale / pinchStartScale;
      state.tx = cx - (cx - pinchStartTx) * r + (m.x - pinchStartCx);
      state.ty = cy - (cy - pinchStartTy) * r + (m.y - pinchStartCy);
      state.scale = newScale;
      apply();
    }
    e.preventDefault();
  }, { passive:false });

  container.addEventListener('touchend', (e) => {
    if(e.touches.length === 0){
      isDragging = false;
      container.classList.remove('dragging');
    }
  });

  // 더블탭 리셋 (모바일)
  let lastTap = 0;
  container.addEventListener('touchend', (e) => {
    const now = Date.now();
    if(e.touches.length === 0 && (now - lastTap) < 300){
      reset();
    }
    lastTap = now;
  });

  apply();

  return {
    reset, zoom,
    zoomIn: () => zoom(1.3),
    zoomOut: () => zoom(1/1.3),
    getState: () => ({...state}),
  };
}

// ───────────────────────────────────────────────────────────────────────
// 3) 메인 화면 렌더
// ───────────────────────────────────────────────────────────────────────
let _currentTab = 'pyori';   // pyori / boik / connect
let _pz = null;              // panzoom 인스턴스
let _isFullscreen = false;

function setActiveTab(tabId){
  _currentTab = tabId;
  const G = window.V14_GRAPHS;
  if(!G || !G[tabId]) return;
  const g = G[tabId];
  // 탭 활성화
  $$('.v14g-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  // SVG 교체
  const host = $('#v14g-svg-host');
  if(!host) return;
  host.innerHTML = g.svg;
  // 새로 만든 SVG에 viewBox 보장
  const svgEl = host.querySelector('svg');
  if(svgEl && !svgEl.getAttribute('viewBox') && g.viewBox){
    svgEl.setAttribute('viewBox', g.viewBox);
  }
  // 제목 갱신
  const titleEl = $('#v14g-cur-title');
  if(titleEl) titleEl.textContent = g.title;
  const subEl = $('#v14g-cur-sub');
  if(subEl) subEl.textContent = g.subtitle;
  // 리셋
  if(_pz) _pz.reset();
}

function updateZoomInfo(scale){
  const el = $('#v14g-zoom-info');
  if(el) el.textContent = Math.round(scale * 100) + '%';
}

function toggleFullscreen(){
  _isFullscreen = !_isFullscreen;
  const wrap = $('#v14g-wrap');
  const graph = $('#v14g-graph');
  if(!wrap || !graph) return;
  if(_isFullscreen){
    wrap.classList.add('fs');
    graph.classList.add('fs');
  } else {
    wrap.classList.remove('fs');
    graph.classList.remove('fs');
  }
  if(_pz) _pz.reset();
}

function render(initialTab){
  const view = document.getElementById('view');
  if(!view){ console.warn('[v14g] #view 없음'); return; }
  injectStyles();

  const G = window.V14_GRAPHS;
  if(!G){
    view.innerHTML = '<div style="padding:20px">데이터(data-v14-graph.js)가 로드되지 않았습니다.</div>';
    return;
  }

  view.innerHTML = `
    <div class="v14g-wrap" id="v14g-wrap">
      <div class="v14g-hdr">
        <button class="v14g-back" id="v14g-back">← 뒤로</button>
        <div class="seal">關係圖 · 處方 Network</div>
        <div class="sub"><span id="v14g-cur-title">${esc(G.pyori.title)}</span> — <span id="v14g-cur-sub">${esc(G.pyori.subtitle)}</span></div>
      </div>

      <div class="v14g-tabs">
        <button class="v14g-tab active" data-tab="pyori">表裏雙解劑</button>
        <button class="v14g-tab bo" data-tab="boik">補益劑</button>
        <button class="v14g-tab pp" data-tab="connect">章間連結</button>
      </div>

      <div class="v14g-graph" id="v14g-graph">
        <div class="v14g-ctrl">
          <button class="v14g-btn" id="v14g-zout" title="축소 (−)">−</button>
          <button class="v14g-btn" id="v14g-zin"  title="확대 (+)">+</button>
          <button class="v14g-btn wide" id="v14g-reset" title="리셋 (0)">⟲</button>
        </div>
        <div class="v14g-ctrl-right">
          <button class="v14g-btn" id="v14g-fs" title="풀스크린">⛶</button>
        </div>
        <div class="v14g-svg-host" id="v14g-svg-host">${G.pyori.svg}</div>
        <div class="v14g-zoom-info" id="v14g-zoom-info">100%</div>
        <div class="v14g-hint">휠/핀치 = 줌 · 드래그 = 이동 · 더블클릭 = 리셋</div>
      </div>

      <div class="v14g-legend">
        <b>線</b>
        <span class="v14g-leg-item"><span class="v14g-leg-line thick" style="border-color:#B8521A"></span>派生</span>
        <span class="v14g-leg-item"><span class="v14g-leg-line" style="border-color:#2E6B48"></span>+ 약물</span>
        <span class="v14g-leg-item"><span class="v14g-leg-line dash" style="border-color:#A82828"></span>− 약물</span>
        <span class="v14g-leg-item"><span class="v14g-leg-line thick" style="border-color:#B8860B"></span>포함</span>
        <span class="v14g-leg-item"><span class="v14g-leg-line dash" style="border-color:#5A2E6E"></span>유사</span>
      </div>
      <div class="v14g-legend">
        <b>方</b>
        <span class="v14g-leg-item"><span class="v14g-leg-box" style="background:#FFE5CC;border-color:#A82828"></span>★시험핵심</span>
        <span class="v14g-leg-item"><span class="v14g-leg-box" style="background:#FFF5D8;border-color:#6E1818"></span>主要 처방</span>
        <span class="v14g-leg-item"><span class="v14g-leg-box" style="background:#FDFAF2;border-style:dashed"></span>가감·변방</span>
        <span class="v14g-leg-item"><span class="v14g-leg-box" style="background:#E0DDC8;border-color:#6E6850"></span>기본방</span>
      </div>
    </div>
  `;

  // 첫 SVG의 viewBox 적용
  const initSvg = $('#v14g-svg-host svg');
  if(initSvg && !initSvg.getAttribute('viewBox')){
    initSvg.setAttribute('viewBox', G.pyori.viewBox);
  }

  // PanZoom 시작 — v14.3: 초기 1.3배 줌으로 노드 글자가 한 눈에 또렷하게
  const graphEl = $('#v14g-graph');
  const hostEl = $('#v14g-svg-host');
  _pz = createPanZoom(graphEl, hostEl, {
    initialScale: 1.3,
    onChange: (s) => updateZoomInfo(s.scale),
  });

  // 컨트롤
  $('#v14g-zin').onclick  = (e) => { e.stopPropagation(); _pz.zoomIn(); };
  $('#v14g-zout').onclick = (e) => { e.stopPropagation(); _pz.zoomOut(); };
  $('#v14g-reset').onclick= (e) => { e.stopPropagation(); _pz.reset(); };
  $('#v14g-fs').onclick   = (e) => { e.stopPropagation(); toggleFullscreen(); };
  $('#v14g-back').onclick = () => {
    if(_isFullscreen){ toggleFullscreen(); return; }
    if(window.V11ClinicHub && window.V11ClinicHub.open) window.V11ClinicHub.open();
    else if(window.ROUTES && window.ROUTES.hub) window.ROUTES.hub();
    else if(window.ROUTES && window.ROUTES.home) window.ROUTES.home();
    else history.back();
  };

  // 탭 클릭
  $$('.v14g-tab').forEach(b => {
    b.onclick = () => setActiveTab(b.dataset.tab);
  });

  // 키보드 단축키
  if(!window.__v14gKeyBound){
    window.__v14gKeyBound = true;
    window.addEventListener('keydown', (e) => {
      if(!document.getElementById('v14g-wrap')) return;
      // input/textarea에 포커스 있으면 무시
      const t = document.activeElement;
      if(t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA')) return;
      if(!_pz) return;
      if(e.key === '+' || e.key === '='){ e.preventDefault(); _pz.zoomIn(); }
      else if(e.key === '-' || e.key === '_'){ e.preventDefault(); _pz.zoomOut(); }
      else if(e.key === '0'){ e.preventDefault(); _pz.reset(); }
      else if(e.key === 'Escape' && _isFullscreen){ e.preventDefault(); toggleFullscreen(); }
      else if(e.key === 'f' || e.key === 'F'){ e.preventDefault(); toggleFullscreen(); }
    });
  }

  // 초기 탭
  if(initialTab && G[initialTab]){
    setActiveTab(initialTab);
  } else {
    updateZoomInfo(1);
  }
}

function open(initialTab){
  render(initialTab);
}

// ───────────────────────────────────────────────────────────────────────
// 4) 의서궁 / 방제학 home / 方鑑 안에 진입점 주입
// ───────────────────────────────────────────────────────────────────────
function injectBannerStyles(){
  if(document.getElementById('v14g-banner-style')) return;
  const s = document.createElement('style');
  s.id = 'v14g-banner-style';
  s.textContent = `
    .v14g-banner{
      background:linear-gradient(135deg,#2A7060 0%,#1A4030 100%);
      color:#E0FFF0;padding:13px 15px;border-radius:12px;margin:14px 0;
      cursor:pointer;display:flex;align-items:center;gap:12px;
      box-shadow:0 4px 14px rgba(42,112,96,.3);
      transition:transform .15s,box-shadow .15s;border:2px solid #5BC4A4;
      font-family:var(--font-body,'Noto Serif KR',serif);
    }
    .v14g-banner:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(42,112,96,.5)}
    .v14g-banner-lg{padding:17px 19px;margin:16px 0;border-width:3px;
      background:linear-gradient(135deg,#3A8A78 0%,#0E2820 50%,#236050 100%);
    }
    .v14g-banner .han{
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:36px;color:#A8FFD8;
      line-height:1;text-shadow:2px 2px 0 rgba(0,0,0,.4);min-width:60px;text-align:center;
    }
    .v14g-banner-lg .han{font-size:46px;min-width:78px}
    .v14g-banner .body{flex:1}
    .v14g-banner .ttl{font-size:16px;font-weight:700;color:#E0FFF0;letter-spacing:.05em}
    .v14g-banner-lg .ttl{font-size:19px}
    .v14g-banner .sub{font-size:11px;opacity:.88;margin-top:3px;color:#E0FFF0}
    .v14g-banner .arrow{margin-left:auto;font-size:22px;color:#A8FFD8;opacity:.7}
    .v14g-banner .badge{
      display:inline-block;background:#A8FFD8;color:#0E2820;font-size:9.5px;
      padding:2px 6px;border-radius:8px;font-weight:700;margin-left:6px;
      vertical-align:middle;letter-spacing:.05em;
    }

    /* 方鑑 헤더에 들어갈 「關係圖 보기」 작은 버튼 */
    .v14g-mini-btn{
      display:inline-flex;align-items:center;gap:5px;
      background:#2A7060;color:#E0FFF0;border:1.5px solid #5BC4A4;
      padding:6px 11px;border-radius:6px;font-family:inherit;font-size:12px;
      font-weight:600;cursor:pointer;margin-top:8px;
    }
    .v14g-mini-btn:hover{background:#1A4030;transform:translateY(-1px)}
    .v14g-mini-btn .han{font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:14px}
  `;
  document.head.appendChild(s);
}

function makeBanner(big){
  const banner = document.createElement('div');
  banner.className = 'v14g-banner' + (big?' v14g-banner-lg':'');
  banner.innerHTML = `
    <div class="han">關</div>
    <div class="body">
      <div class="ttl">關係圖 — 處方 Network <span class="badge">NEW v14</span></div>
      <div class="sub">3개 그래프 · 派生·포함·유사 관계 시각화 · 핀치/휠로 확대</div>
    </div>
    <div class="arrow">→</div>
  `;
  banner.onclick = () => open();
  return banner;
}

function injectInHub(){
  if(!window.V11ClinicHub || !window.V11ClinicHub.open) return;
  if(window.__v14gHubHooked) return;
  window.__v14gHubHooked = true;
  const orig = window.V11ClinicHub.open;
  window.V11ClinicHub.open = function(){
    orig.apply(this, arguments);
    setTimeout(() => {
      injectBannerStyles();
      const view = document.getElementById('view');
      if(!view) return;
      if(view.querySelector('.v14g-banner')) return;
      const banner = makeBanner(true);
      // 方鑑(v14) 배너 다음에 (방감 다음, 헬게이트도 그 위)
      const fjBanner = view.querySelector('.v14-banner');
      if(fjBanner && fjBanner.parentNode){
        fjBanner.parentNode.insertBefore(banner, fjBanner.nextSibling);
      } else {
        // 방감이 없으면 헬게이트 다음
        const hellBanner = view.querySelector('.hg-hellgate-banner');
        if(hellBanner && hellBanner.parentNode){
          hellBanner.parentNode.insertBefore(banner, hellBanner.nextSibling);
        } else {
          const grid = view.querySelector('[class*="subject"], [class*="rooms"], [class*="hall-grid"], .ch-grid, .grid');
          const placeBefore = grid || view.querySelector('.card') || view.firstChild;
          if(placeBefore && placeBefore.parentNode) placeBefore.parentNode.insertBefore(banner, placeBefore);
          else view.appendChild(banner);
        }
      }
    }, 90);  // v13(30ms), v14방감(60ms) 다음
  };
  if(window.ROUTES) window.ROUTES.hub = window.V11ClinicHub.open;
}

function injectInHome(){
  if(!window.ROUTES || !window.ROUTES.home) return;
  if(window.__v14gHomeHooked) return;
  window.__v14gHomeHooked = true;
  const orig = window.ROUTES.home;
  window.ROUTES.home = function(){
    orig.apply(this, arguments);
    setTimeout(() => {
      injectBannerStyles();
      const view = document.getElementById('view');
      if(!view) return;
      if(view.querySelector('.v14g-banner')) return;
      const banner = makeBanner(false);
      const fjBanner = view.querySelector('.v14-banner');
      if(fjBanner && fjBanner.parentNode){
        fjBanner.parentNode.insertBefore(banner, fjBanner.nextSibling);
      } else {
        const hellBanner = view.querySelector('.hg-hellgate-banner');
        if(hellBanner && hellBanner.parentNode){
          hellBanner.parentNode.insertBefore(banner, hellBanner.nextSibling);
        } else {
          const firstCard = view.querySelector('.card');
          if(firstCard && firstCard.parentNode) firstCard.parentNode.insertBefore(banner, firstCard.nextSibling);
          else view.appendChild(banner);
        }
      }
    }, 90);
  };
}

// 방감 화면 안에도 「關係圖 보기」 버튼 추가 (자연스러운 연결)
function injectInFangjian(){
  if(!window.V14PyoriBoMap || !window.V14PyoriBoMap.open) return;
  if(window.__v14gFjHooked) return;
  window.__v14gFjHooked = true;
  const orig = window.V14PyoriBoMap.open;
  window.V14PyoriBoMap.open = function(){
    orig.apply(this, arguments);
    setTimeout(() => {
      injectBannerStyles();
      const hdr = document.querySelector('.v14-hdr');
      if(!hdr) return;
      if(hdr.querySelector('.v14g-mini-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'v14g-mini-btn';
      btn.innerHTML = `<span class="han">關</span> 關係圖 보기 →`;
      btn.onclick = (e) => { e.stopPropagation(); open(); };
      // stamp 다음에 추가
      const stamp = hdr.querySelector('.stamp');
      if(stamp && stamp.parentNode){
        stamp.parentNode.insertBefore(btn, stamp.nextSibling);
      } else {
        hdr.appendChild(btn);
      }
    }, 50);
  };
  if(window.ROUTES) window.ROUTES.fangjian = window.V14PyoriBoMap.open;
}

// ───────────────────────────────────────────────────────────────────────
// 5) 부트스트랩
// ───────────────────────────────────────────────────────────────────────
let _bootTries = 0;
function boot(){
  if(window.ROUTES){
    window.ROUTES.graph = open;
  }
  try{ injectInHub();      }catch(_){}
  try{ injectInHome();     }catch(_){}
  try{ injectInFangjian(); }catch(_){}
  if(_bootTries++ < 30){
    setTimeout(boot, 300);
  }
}
setTimeout(boot, 250);

window.V14Graph = {
  open: open,
  render: render,
};

console.log('[v14 關係圖] graph viewer ready');

})();
