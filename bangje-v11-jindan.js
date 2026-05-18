/* bangje-v11-jindan.js — 진단학 (東武之房) 학습 시스템 v2.0 (v11.5)
 * ============================================================================
 *  방제학 home 과 동일한 형식의 탭 구조:
 *
 *    동무대청 (홈)
 *    ├── 圖鑑 (사진첩)       — 라벨 토글, 분류 필터
 *    ├── 問答 (객관식 퀴즈)   — 4지선다, 즉시 정답·해설
 *    ├── 主觀 (주관식 입력)   — 직접 입력 채점
 *    ├── 速習 (드릴)         — 자동 진행
 *    ├── 析究 (통계)         — 정답률·범위별 진도
 *    └── 對位 (매트릭스)     — 설색×설태 끌어다 놓기
 *
 *  분류 (v11.5):
 *    JILJI    설질 (24장)  — 색·형·태 (苔 글자 없는 라벨)
 *    SEOLTAI  설태 (19장)  — 苔色·苔質
 *    BOTH     복합 (5장)   — 라벨에 舌+苔 모두
 *
 *  외부 API: window.V11Jindan = {
 *    openHome, openGallery, openMcq, openSubj, openDrill, openStats, openMatrix
 *  }
 * ============================================================================ */

(function(){
'use strict';

function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }

const CATEGORIES = [
  { id:'all',     han:'全',   ko:'전체', accent:'#7C3030', desc:'48 장 전체' },
  { id:'jilji',   han:'舌質', ko:'설질', accent:'#9C3030', desc:'色·形·態 (苔 글자 없는 라벨)' },
  { id:'seoltai', han:'舌苔', ko:'설태', accent:'#2A7060', desc:'苔色·苔質 (라벨에 苔)' },
  { id:'both',    han:'兼',   ko:'복합', accent:'#C9A227', desc:'설질+설태 동시 명시' },
];
const CATEGORY_BY_ID = {}; CATEGORIES.forEach(c => CATEGORY_BY_ID[c.id] = c);

function _tonguesIn(catId){
  const T = window.TONGUES || [];
  if(catId === 'all')     return T.slice();
  if(catId === 'jilji')   return T.filter(t => t.category === 'jilji'   || t.category === 'both');
  if(catId === 'seoltai') return T.filter(t => t.category === 'seoltai' || t.category === 'both');
  if(catId === 'both')    return T.filter(t => t.category === 'both');
  return T;
}

function _daysUntil(iso){
  if(!iso) return null;
  const d = new Date(iso).getTime();
  if(!isFinite(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}
function _examPillHTML(exam){
  const d = _daysUntil(exam.date);
  if(d === null) return '';
  const txt = d > 0 ? `D-${d}` : (d === 0 ? 'D-Day' : `D+${-d}`);
  const urgent = d >= 0 && d <= 3;
  const bg = urgent ? '#9C3030' : (d < 0 ? '#7A5C40' : exam.accent);
  return `<span class="dm-exam-pill" style="background:${bg}"><span class="han">${esc(exam.han||'')}</span> ${esc(exam.label)} · <b>${txt}</b></span>`;
}

function _medal(charId, size){
  if(typeof window._charPhotoMedallion === 'function') return window._charPhotoMedallion(charId, size);
  if(typeof window._charMedallion === 'function')      return window._charMedallion(charId, size);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#E8C8A0;display:flex;align-items:center;justify-content:center;font-family:'ZCOOL XiaoWei',serif;font-size:${Math.round(size*0.4)}px;color:#3A1810">人</div>`;
}

function _baseStyles(){
  return `
    <style>
      .dm-banner { background:linear-gradient(135deg,#9C3030,#6E1818); color:#FFE08A; padding:14px; border-radius:10px; margin-bottom:10px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(60,12,12,.3); }
      .dm-banner-medal { width:60px; height:60px; border-radius:50%; overflow:hidden; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,.3); }
      .dm-banner-medal .cmedal, .dm-banner-medal img { width:100%; height:100%; }
      .dm-banner-title { font-family:'ZCOOL XiaoWei',serif; font-size:22px; letter-spacing:.05em; }
      .dm-banner-sub { font-size:11.5px; opacity:.88; margin-top:1px; letter-spacing:.04em; }
      .dm-back { background:transparent; border:1px solid #FFE08A; color:#FFE08A; padding:4px 9px; border-radius:6px; font-size:11px; cursor:pointer; margin-left:auto; }
      .dm-back:hover { background:rgba(255,224,138,.12); }
      .dm-exam-row { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
      .dm-exam-pill { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:11px; color:#FFE08A; font-size:11px; }
      .dm-exam-pill .han { font-family:'Noto Serif SC',serif; font-size:12px; }
      .dm-modes { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:10px; }
      .dm-mode-btn { background:#fff; border:1px solid #9C303055; padding:11px 6px; border-radius:8px; text-align:center; cursor:pointer; font-size:12px; font-family:inherit; color:var(--mo); transition:all .15s ease; }
      .dm-mode-btn:hover { background:#FFF0D0; border-color:#9C3030; transform:translateY(-1px); }
      .dm-mode-han { font-family:'Noto Serif SC',serif; font-size:15px; color:var(--zhusha-d); font-weight:700; }
      .dm-mode-ko { font-size:10.5px; color:var(--mo-l); margin-top:2px; }
      .dm-mode-btn.duiwei { background:linear-gradient(135deg,#FFF8E8,#FFE0B0); border-color:#C9A227; }
      .dm-mode-btn.duiwei .dm-mode-han { color:#7C1818; }
      .dm-cat-tabs { display:flex; gap:4px; background:#FAF1E0; border-radius:8px; padding:4px; margin-bottom:10px; border:1px solid #C9A22744; }
      .dm-cat-tab { flex:1; padding:7px 6px; background:transparent; border:0; border-radius:5px; font-size:11.5px; cursor:pointer; font-family:inherit; color:var(--mo-l); display:flex; flex-direction:column; align-items:center; gap:1px; }
      .dm-cat-tab .han { font-family:'Noto Serif SC',serif; font-size:13px; color:var(--mo-l); font-weight:600; }
      .dm-cat-tab.active { background:#9C3030; color:#FFE08A; }
      .dm-cat-tab.active .han { color:#FFE08A; }
      .dm-cat-tab .ct { font-size:9.5px; opacity:.75; }
      .dm-progress { display:flex; gap:8px; align-items:center; font-size:11.5px; color:var(--mo); padding:7px 11px; background:#FAF1E0; border:1px solid #C9A22744; border-radius:8px; margin-bottom:10px; }
      .dm-progress .bar { flex:1; height:6px; background:#E8DCC0; border-radius:3px; overflow:hidden; position:relative; }
      .dm-progress .fill { position:absolute; left:0; top:0; bottom:0; background:linear-gradient(90deg,#C9A227,#9C3030); transition:width .4s ease; border-radius:3px; }
      .dm-progress .stat { font-family:var(--font-display); color:var(--zhusha-d); }
      .dm-sub-header { display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:9px 11px; background:linear-gradient(135deg,#9C3030,#6E1818); color:#FFE08A; border-radius:9px; }
      .dm-sub-header .ttl { font-family:'ZCOOL XiaoWei',serif; font-size:18px; letter-spacing:.05em; }
      .dm-sub-header .sub { font-size:10.5px; opacity:.85; margin-top:1px; }
      .dm-sub-header .back { margin-left:auto; background:transparent; border:1px solid #FFE08A; color:#FFE08A; padding:4px 9px; border-radius:6px; font-size:11px; cursor:pointer; }
      .dm-sub-header .back:hover { background:rgba(255,224,138,.12); }
      .dm-card-q { background:#FFF8E8; border:1px solid #C9A22744; border-radius:10px; padding:12px; margin-bottom:10px; }
      .dm-img { width:100%; max-width:320px; aspect-ratio:1; object-fit:cover; border-radius:8px; display:block; margin:0 auto 10px; border:2px solid #9C303033; }
      .dm-q-text { font-size:13.5px; color:var(--mo); margin-bottom:10px; text-align:center; line-height:1.55; }
      .dm-q-text .han { font-family:'Noto Serif SC',serif; color:var(--zhusha-d); font-weight:700; }
      .dm-opts { display:grid; gap:6px; margin-bottom:8px; }
      .dm-opt-btn { background:#fff; border:1.5px solid #C9A22755; padding:9px 11px; border-radius:7px; text-align:left; font-size:12.5px; cursor:pointer; font-family:inherit; color:var(--mo); transition:all .12s ease; line-height:1.5; }
      .dm-opt-btn:hover { border-color:#9C3030; background:#FFF8E0; }
      .dm-opt-btn.correct { background:#E8F5E8; border-color:#2A7060; color:#1A5A3A; }
      .dm-opt-btn.wrong   { background:#FDE8E8; border-color:#9C3030; color:#7A2424; }
      .dm-opt-btn.disabled { pointer-events:none; opacity:.7; }
      .dm-opt-btn .han { font-family:'Noto Serif SC',serif; color:var(--zhusha-d); font-weight:600; }
      .dm-feedback { padding:9px 11px; border-radius:6px; font-size:12px; line-height:1.65; margin-top:6px; }
      .dm-feedback.ok { background:#E8F5E8; color:#1A5A3A; border-left:3px solid #2A7060; }
      .dm-feedback.no { background:#FDE8E8; color:#7A2424; border-left:3px solid #9C3030; }
      .dm-feedback .han { font-family:'Noto Serif SC',serif; font-weight:700; }
      .dm-gal-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; }
      @media (min-width:520px) { .dm-gal-grid { grid-template-columns:repeat(4,1fr); } }
      .dm-gal-card { position:relative; aspect-ratio:1; border-radius:7px; overflow:hidden; cursor:pointer; border:1px solid #C9A22755; background:#fff; }
      .dm-gal-card img { width:100%; height:100%; object-fit:cover; display:block; }
      .dm-gal-card:hover img { transform:scale(1.04); transition:transform .2s; }
      .dm-gal-num { position:absolute; left:2px; top:2px; background:rgba(0,0,0,.55); color:#FFE08A; font-family:var(--font-display); font-size:9.5px; padding:1px 4px; border-radius:3px; }
      .dm-gal-cat { position:absolute; right:2px; top:2px; padding:1px 4px; border-radius:3px; font-size:9px; font-family:'Noto Serif SC',serif; font-weight:700; }
      .dm-gal-cat.jilji   { background:#9C3030; color:#FFE08A; }
      .dm-gal-cat.seoltai { background:#2A7060; color:#FFE08A; }
      .dm-gal-cat.both    { background:#C9A227; color:#3A1810; }
      .dm-gal-label { position:absolute; left:0; right:0; bottom:0; background:linear-gradient(to top,rgba(0,0,0,.82),transparent); color:#FFE08A; font-size:9.5px; padding:14px 4px 4px; text-align:center; line-height:1.25; font-family:'Noto Serif SC',serif; }
      .dm-gal-card.hide-label .dm-gal-label { display:none; }
      .dm-result { background:linear-gradient(135deg,#FFF8E0,#FFE0B0); border:1.5px solid #C9A227; border-radius:10px; padding:16px; margin-bottom:12px; text-align:center; }
      .dm-result .pct { font-family:'ZCOOL XiaoWei',serif; font-size:50px; color:#9C3030; line-height:1; }
      .dm-result .meta { font-size:12px; color:var(--mo); margin-top:6px; }
      .dm-stat-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:8px 0; }
      .dm-stat-card { background:#FAF1E0; border:1px solid #C9A22755; border-radius:8px; padding:10px; text-align:center; }
      .dm-stat-card .v { font-family:'ZCOOL XiaoWei',serif; font-size:24px; color:#9C3030; line-height:1; }
      .dm-stat-card .l { font-size:10.5px; color:var(--mo-l); margin-top:4px; }
      .dm-bar-row { display:flex; align-items:center; gap:7px; font-size:11.5px; margin:5px 0; }
      .dm-bar-row .name { width:62px; font-family:'Noto Serif SC',serif; color:var(--zhusha-d); }
      .dm-bar-row .barOuter { flex:1; height:8px; background:#E8DCC0; border-radius:4px; overflow:hidden; }
      .dm-bar-row .barFill { height:100%; background:linear-gradient(90deg,#C9A227,#9C3030); border-radius:4px; transition:width .4s; }
      .dm-bar-row .num { font-family:var(--font-display); color:var(--zhusha-d); min-width:56px; text-align:right; }
      .dm-modal-bg { position:fixed; inset:0; background:rgba(20,8,4,.55); z-index:9996; display:flex; align-items:center; justify-content:center; padding:18px; }
      .dm-modal { background:#FFF8E8; border:1.5px solid #9C3030; border-radius:12px; padding:14px; max-width:360px; max-height:88vh; overflow:auto; box-shadow:0 10px 28px rgba(60,12,12,.4); }
      .dm-modal h4 { margin:0 0 8px; font-family:'Noto Serif SC',serif; color:var(--zhusha-d); font-size:15px; display:flex; gap:6px; align-items:center; }
      .dm-modal .pho { width:100%; max-height:280px; object-fit:cover; border-radius:6px; margin-bottom:8px; }
      .dm-modal .row { font-size:12px; line-height:1.7; margin-bottom:4px; }
      .dm-modal .row b { color:var(--zhusha-d); font-family:'Noto Serif SC',serif; }
      .dm-modal .close { width:100%; margin-top:8px; padding:8px; background:var(--zhusha); color:#fff; border:0; border-radius:6px; cursor:pointer; font-size:12px; }
      .dm-input-row { display:flex; gap:6px; }
      .dm-input-row input { flex:1; padding:9px 10px; font-size:13px; border:1.5px solid #C9A22755; border-radius:6px; font-family:inherit; background:#fff; }
      .dm-input-row input:focus { outline:none; border-color:#9C3030; }
      .dm-input-row button { background:#9C3030; color:#FFE08A; border:0; padding:9px 14px; border-radius:6px; font-size:12.5px; cursor:pointer; font-family:inherit; }
    </style>
  `;
}

function _bannerHTML(){
  const exams = (window.JINDAN_EXAMS || []);
  const pills = exams.map(_examPillHTML).join('');
  return `
    <div class="dm-banner">
      <div class="dm-banner-medal">${_medal('leejema', 60)}</div>
      <div style="flex:1">
        <div class="dm-banner-title">東武之房</div>
        <div class="dm-banner-sub">診斷學 · 진단학 · 李濟馬 主</div>
        ${pills ? `<div class="dm-exam-row">${pills}</div>` : ''}
      </div>
      <button class="dm-back" type="button" id="dm-to-hub">← 醫書宮</button>
    </div>
  `;
}
function _attachBanner(){
  const b = $('#dm-to-hub');
  if(b) b.addEventListener('click', () => {
    if(typeof window.setTab === 'function') window.setTab('hub');
  });
}

let SES = null;
function _newSession(mode, catId){
  const pool = _tonguesIn(catId);
  const order = pool.slice();
  for(let i = order.length-1; i > 0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  SES = { mode, catId, pool, order, idx:0, correct:0, wrong:0, wrongIds:[], answered:false, startedAt:Date.now() };
}

function renderDongmuHome(){
  const view = document.getElementById('view');
  if(!view) return;
  // v11.6.0 patched: 헤더 + 하단 nav 컨텍스트 전환 (방제학 탭이 그대로 떠 있던 버그 픽스)
  try{ if(typeof window.setHeaderContext === 'function') window.setHeaderContext('dongmu'); }catch(_){}
  // v11.6: 활동 라벨 갱신 (의서궁 同學 표시용).
  try{
    if(window.V96Activity) window.V96Activity.set('東武之房', '진단학 동무대청');
    if(typeof window.recordPresence === 'function') window.recordPresence();
  }catch(_){}
  view.innerHTML = _baseStyles() + _bannerHTML() + `
    <div class="dm-modes">
      <button class="dm-mode-btn duiwei" type="button" data-mode="duiwei">
        <div class="dm-mode-han">對位 · 기존</div>
        <div class="dm-mode-ko">하나씩 끌어다 놓기</div>
      </button>
      <button class="dm-mode-btn duiwei" type="button" data-mode="duiwei-all">
        <div class="dm-mode-han">對位 · 전부다</div>
        <div class="dm-mode-ko">정답 매트릭스 일괄 표시</div>
      </button>
      <button class="dm-mode-btn" type="button" data-mode="gallery">
        <div class="dm-mode-han">圖鑑</div>
        <div class="dm-mode-ko">사진첩 · 라벨 토글</div>
      </button>
      <button class="dm-mode-btn" type="button" data-mode="mcq">
        <div class="dm-mode-han">問答</div>
        <div class="dm-mode-ko">4지선다</div>
      </button>
      <button class="dm-mode-btn" type="button" data-mode="subj">
        <div class="dm-mode-han">主觀</div>
        <div class="dm-mode-ko">주관식 입력</div>
      </button>
      <button class="dm-mode-btn" type="button" data-mode="drill">
        <div class="dm-mode-han">速習</div>
        <div class="dm-mode-ko">드릴·자동 진행</div>
      </button>
      <button class="dm-mode-btn" type="button" data-mode="stats">
        <div class="dm-mode-han">析究</div>
        <div class="dm-mode-ko">통계·분석</div>
      </button>
    </div>
    <div style="background:#FAF1E0;border:1px solid #C9A22744;border-radius:9px;padding:11px 12px;font-size:11.5px;color:var(--mo);line-height:1.7">
      <div style="font-family:'Noto Serif SC',serif;font-size:13px;color:var(--zhusha-d);margin-bottom:5px"><b>學習 안내</b></div>
      <div><b style="color:#9C3030">舌質 (설질)</b> · 24장 — 색·형·태 (苔 글자 없는 라벨)</div>
      <div><b style="color:#2A7060">舌苔 (설태)</b> · 20장 — 苔色·苔質</div>
      <div><b style="color:#C9A227">兼 (복합)</b> · 4장 — 舌+苔 동시 명시 (양쪽 set 에 모두 포함)</div>
      <div style="margin-top:6px;color:var(--mo-l);font-size:10.5px">시험 일정은 醫書宮 상단 D-N 패널에 통합 표시.</div>
    </div>
    
    <!-- v11.6: 참고서적 패널 -->
    <details class="dm-ref-panel" style="margin-top:10px;background:#FAF6E8;border:1px solid #C9A22755;border-radius:9px;padding:0 12px">
      <summary style="cursor:pointer;padding:10px 0;font-family:'Noto Serif SC',serif;font-size:13px;color:var(--zhusha-d)">
        <b>參考 · 설진 표준 서적 ${(window.TONGUE_REFERENCES||[]).length}종</b>
        <span style="font-size:11px;color:var(--mo-l);font-weight:normal">— 사진 매칭 보강용</span>
      </summary>
      <div style="padding-bottom:12px;font-size:11.5px;line-height:1.65">
        ${((window.TONGUE_REFERENCES||[])).map(r => `
          <div style="border-top:1px dashed #C9A22744;padding:8px 0">
            <div style="font-family:'Noto Serif SC',serif;font-size:12.5px">
              <span style="color:${r.standard?'#9C3030':'#2A7060'};font-weight:700">${r.standard?'★ 表':'  '}</span>
              <span class="han" style="font-weight:700">${esc(r.name_han)}</span>
              <span style="color:var(--mo-l)">· ${esc(r.name_ko)}</span>
              <span style="font-size:9.5px;background:#C9A22733;color:#7C5810;padding:1px 5px;border-radius:3px;margin-left:4px">${esc(r.lang.toUpperCase())}</span>
            </div>
            <div style="color:var(--mo-l);font-size:10.5px;margin-top:2px">${esc(r.authors)} · ${esc(r.pub)} · ${esc(r.year)}</div>
            <div style="color:var(--mo);font-size:10.5px;margin-top:2px">사진/도판: ${esc(r.pages)}</div>
            <div style="color:#7C5810;font-size:10.5px;margin-top:3px;font-style:italic">→ ${esc(r.why)}</div>
          </div>
        `).join('')}
        <div style="margin-top:8px;padding:6px 8px;background:#FFF2D8;border-radius:5px;font-size:10px;color:var(--mo-l);line-height:1.55">
          ★ 表 = 한국 한의대 표준 교재. 추가 사진을 對位 매트릭스에 통합하려면<br>
          ① 사진을 t49.jpg ~ 형식으로 저장 → ② data-jindan-tongue.js TONGUES 배열에 항목 추가 →<br>
          ③ bangje-v11-tongue-matrix.js ENTRIES 에 (color, coating, conf) 추가.
        </div>
      </div>
    </details>
  `;
  _attachBanner();
  $$('.dm-mode-btn').forEach(b => {
    b.addEventListener('click', () => {
      const m = b.dataset.mode;
      if(m === 'gallery')      openGallery();
      else if(m === 'mcq')     openMcq();
      else if(m === 'subj')    openSubj();
      else if(m === 'drill')   openDrill();
      else if(m === 'stats')   openStats();
      else if(m === 'duiwei'){
        if(window.V11Matrix && window.V11Matrix.open) window.V11Matrix.open();
        else toast('對位 모듈 미로드','warn');
      }
      else if(m === 'duiwei-all'){
        if(window.V11Matrix && window.V11Matrix.openStudy) window.V11Matrix.openStudy();
        else if(window.V11Matrix && window.V11Matrix.open){
          // fallback: 일반 open 후 toggle 클릭 시뮬레이션
          window.V11Matrix.open();
          setTimeout(() => { const t=document.getElementById('mx-toggle'); if(t) t.click(); }, 80);
        }
        else toast('對位 모듈 미로드','warn');
      }
    });
  });
}
window.renderDongmuHome = renderDongmuHome;

let GAL_STATE = { catId:'all', showLabels:true };
function openGallery(){
  try{ if(window.V96Activity) window.V96Activity.set('圖鑑 · 설진', '동무대청 사진첩'); }catch(_){}
  _renderGallery();
}
function _renderGallery(){
  const view = document.getElementById('view');
  if(!view) return;
  const T = _tonguesIn(GAL_STATE.catId);
  const cards = T.map(t => {
    const catBadge = `<span class="dm-gal-cat ${esc(t.category||'jilji')}">${esc(CATEGORY_BY_ID[t.category]?.han || '?')}</span>`;
    return `
      <div class="dm-gal-card ${GAL_STATE.showLabels?'':'hide-label'}" data-tid="${t.id}">
        <img src="${esc(t.img)}" alt="${esc(t.han)}" loading="lazy">
        <span class="dm-gal-num">${('00'+t.id).slice(-2)}</span>
        ${catBadge}
        <div class="dm-gal-label"><b>${esc(t.han)}</b><br>${esc(t.pattern_han||'-')}</div>
      </div>
    `;
  }).join('');
  view.innerHTML = _baseStyles() + `
    <div class="dm-sub-header">
      <div><div class="ttl">圖鑑 · 사진첩</div><div class="sub">${T.length}장 · 라벨 토글로 자가 검증</div></div>
      <button class="back" type="button" id="dm-sub-back">← 동무의 방</button>
    </div>
    ${_catTabsHTML(GAL_STATE.catId)}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:7px 11px;background:#FAF1E0;border:1px solid #C9A22744;border-radius:8px">
      <span style="font-size:11.5px;color:var(--mo)">사진 탭 → 상세 보기</span>
      <label style="font-size:11.5px;color:var(--mo);cursor:pointer;user-select:none;display:flex;align-items:center;gap:4px">
        <input type="checkbox" id="dm-gal-toggle" ${GAL_STATE.showLabels?'checked':''}> 라벨 표시
      </label>
    </div>
    <div class="dm-gal-grid">${cards}</div>
  `;
  $('#dm-sub-back').addEventListener('click', renderDongmuHome);
  $$('.dm-cat-tab').forEach(b => b.addEventListener('click', () => { GAL_STATE.catId = b.dataset.cat; _renderGallery(); }));
  $('#dm-gal-toggle').addEventListener('change', e => { GAL_STATE.showLabels = e.target.checked; _renderGallery(); });
  $$('.dm-gal-card').forEach(c => c.addEventListener('click', () => _openDetailModal(parseInt(c.dataset.tid, 10))));
}

function _catTabsHTML(activeId){
  return `<div class="dm-cat-tabs">
    ${CATEGORIES.map(c => {
      const n = _tonguesIn(c.id).length;
      return `<button class="dm-cat-tab${c.id===activeId?' active':''}" data-cat="${c.id}">
        <span class="han">${esc(c.han)}</span>
        <span>${esc(c.ko)}</span>
        <span class="ct">${n}장</span>
      </button>`;
    }).join('')}
  </div>`;
}

function _openDetailModal(tid){
  const t = (window.TONGUE_BY_ID || {})[tid];
  if(!t) return;
  const cat = CATEGORY_BY_ID[t.category] || CATEGORY_BY_ID.jilji;
  const bg = document.createElement('div');
  bg.className = 'dm-modal-bg';
  bg.innerHTML = `
    <div class="dm-modal">
      <h4>
        <span>${('00'+t.id).slice(-2)}.</span>
        <span style="font-family:'ZCOOL XiaoWei',serif">${esc(t.han)}</span>
        <span class="dm-gal-cat ${esc(t.category)}" style="margin-left:auto;font-size:10px">${esc(cat.han)}</span>
      </h4>
      <img class="pho" src="${esc(t.img)}" alt="">
      ${t.label_full ? `<div class="row"><b>${esc(t.label_full)}</b></div>` : ''}
      ${t.ko ? `<div class="row" style="color:var(--mo-l)">${esc(t.ko)}</div>` : ''}
      ${(t.body_features||[]).length ? `<div class="row"><b>形態</b> · ${(t.body_features||[]).map(esc).join(' · ')}</div>` : ''}
      ${(t.quality_features||[]).length ? `<div class="row"><b>色苔</b> · ${(t.quality_features||[]).map(esc).join(' · ')}</div>` : ''}
      ${t.pattern_han ? `<div class="row">辨證 · <b style="color:var(--feicui)">${esc(t.pattern_han)}</b> · ${esc(t.pattern||'')}</div>` : ''}
      ${t.notes ? `<div class="row" style="background:#FFF0C0;padding:6px 8px;border-radius:5px;margin-top:6px">${esc(t.notes)}</div>` : ''}
      ${t.page ? `<div class="row" style="color:var(--gutong);font-size:10.5px">교재 P.${esc(t.page)}</div>` : ''}
      <button class="close" type="button">닫기</button>
    </div>
  `;
  bg.addEventListener('click', e => { if(e.target === bg || e.target.classList.contains('close')) bg.remove(); });
  document.body.appendChild(bg);
}

function openMcq(){
  try{ if(window.V96Activity) window.V96Activity.set('問答 · 설진', '4지선다 객관식'); }catch(_){}
  _renderQuizPickRange('mcq',   '問答 · 객관식 4지선다', '범위 탭 → 시작.');
}
function openSubj(){
  try{ if(window.V96Activity) window.V96Activity.set('主觀 · 설진', '주관식 입력'); }catch(_){}
  _renderQuizPickRange('subj',  '主觀 · 주관식 입력',   '한자/한글 직접 입력.');
}
function openDrill(){
  try{ if(window.V96Activity) window.V96Activity.set('速習 · 설진', '드릴 자동 진행'); }catch(_){}
  _renderQuizPickRange('drill', '速習 · 드릴',          '4지선다 자동 진행.');
}
function _renderQuizPickRange(mode, title, sub){
  const view = document.getElementById('view');
  if(!view) return;
  view.innerHTML = _baseStyles() + `
    <div class="dm-sub-header">
      <div><div class="ttl">${esc(title)}</div><div class="sub">${esc(sub)}</div></div>
      <button class="back" type="button" id="dm-sub-back">← 동무의 방</button>
    </div>
    <div style="font-size:12px;color:var(--mo);margin-bottom:8px">범위 선택 (탭하면 즉시 시작):</div>
    ${_catTabsHTML('')}
  `;
  $('#dm-sub-back').addEventListener('click', renderDongmuHome);
  $$('.dm-cat-tab').forEach(b => b.addEventListener('click', () => { _newSession(mode, b.dataset.cat); _renderQuestion(); }));
}

function _buildMcqQ(t){
  // v11.6.1 FIX: 변증(pattern) axis 제거 — 설진 시험 범위는 설체·설태만.
  //   사용자 시험 정책: 변증(辨證)은 진단학 다른 단원에서 별도 출제되므로
  //   설진 단원 시험 (5/19·5/26) 에서는 설체 形態(body_features) 와 설태 色苔(quality_features),
  //   그리고 한자 라벨(han) 만 묻는다.
  const axes = [];
  if(t.han)                          axes.push('han');
  if((t.body_features||[]).length)   axes.push('body');
  if((t.quality_features||[]).length) axes.push('quality');
  const axis = axes[Math.floor(Math.random() * axes.length)] || 'han';
  let q, correct;
  const pool = window.TONGUES || [];
  if(axis === 'han'){ q = '이 사진의 <span class="han">舌象</span> 한자 라벨은?'; correct = t.han || '?'; }
  else if(axis === 'body'){ q = '이 사진의 <span class="han">形態</span> 특징은?'; correct = (t.body_features||[])[0] || '?'; }
  else { q = '이 사진의 <span class="han">色苔</span>는?'; correct = (t.quality_features||[])[0] || '?'; }
  const distrSet = new Set();
  pool.forEach(o => {
    if(o.id === t.id) return;
    let v;
    if(axis === 'han')       v = o.han;
    else if(axis === 'body') v = (o.body_features||[])[0];
    else                     v = (o.quality_features||[])[0];
    if(v && v !== correct) distrSet.add(v);
  });
  const distr = Array.from(distrSet);
  for(let i = distr.length-1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [distr[i], distr[j]] = [distr[j], distr[i]]; }
  const opts = [correct, ...distr.slice(0, 3)];
  for(let i = opts.length-1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return { q, axis, correct, opts };
}

function _renderQuestion(){
  const view = document.getElementById('view');
  if(!view || !SES) return;
  if(SES.idx >= SES.order.length) return _renderResult();
  const t = SES.order[SES.idx];
  const cat = CATEGORY_BY_ID[SES.catId] || CATEGORY_BY_ID.all;
  const progress = SES.idx / SES.order.length;
  if(SES.mode === 'subj') return _renderSubjQ(t, cat, progress);
  const q = _buildMcqQ(t);
  SES._currentQ = q;
  view.innerHTML = _baseStyles() + `
    <div class="dm-sub-header">
      <div><div class="ttl">${SES.mode==='drill'?'速習':'問答'} · <span class="han">${esc(cat.han)}</span></div><div class="sub">${SES.idx+1} / ${SES.order.length}</div></div>
      <button class="back" type="button" id="dm-sub-back">← 종료</button>
    </div>
    <div class="dm-progress">
      <span class="stat">${SES.correct} / ${SES.idx}</span>
      <div class="bar"><div class="fill" style="width:${(progress*100).toFixed(1)}%"></div></div>
      <span>오답 <b style="color:#9C3030">${SES.wrong}</b></span>
    </div>
    <div class="dm-card-q">
      <img class="dm-img" src="${esc(t.img)}" alt="">
      <div class="dm-q-text">${q.q}</div>
      <div class="dm-opts" id="dm-opts">
        ${q.opts.map((o, i) => `<button class="dm-opt-btn" data-opt="${esc(o)}" data-idx="${i}"><span class="han">${esc(o)}</span></button>`).join('')}
      </div>
      <div id="dm-feedback"></div>
    </div>
  `;
  $('#dm-sub-back').addEventListener('click', () => { SES = null; renderDongmuHome(); });
  $$('.dm-opt-btn').forEach(b => b.addEventListener('click', () => _handleAnswer(b.dataset.opt, t, q)));
}

function _handleAnswer(chosen, t, q){
  if(SES.answered) return;
  SES.answered = true;
  const ok = chosen === q.correct;
  if(ok){ SES.correct++; } else { SES.wrong++; SES.wrongIds.push(t.id); }
  $$('.dm-opt-btn').forEach(b => {
    b.classList.add('disabled');
    if(b.dataset.opt === q.correct) b.classList.add('correct');
    else if(b.dataset.opt === chosen && !ok) b.classList.add('wrong');
  });
  const fb = $('#dm-feedback');
  if(fb){
    fb.className = 'dm-feedback ' + (ok ? 'ok' : 'no');
    fb.innerHTML = `
      <div><b>${ok ? '正答' : '誤答'}</b> · <span class="han">${esc(t.han)}</span> · ${esc(t.label_full || '')}</div>
      ${t.pattern_han ? `<div>辨證: <span class="han">${esc(t.pattern_han)}</span> · ${esc(t.pattern||'')}</div>` : ''}
      ${t.notes ? `<div style="margin-top:4px">${esc(t.notes)}</div>` : ''}
      ${t.page ? `<div style="margin-top:3px;font-size:10.5px;color:var(--gutong)">교재 P.${esc(t.page)}</div>` : ''}
      ${SES.mode==='drill' ? '' : `<div style="margin-top:7px;text-align:right"><button class="btn btn-sm" type="button" id="dm-next">다음 →</button></div>`}
    `;
  }
  _saveStat(t.id, ok);
  if(SES.mode === 'drill'){
    setTimeout(() => { SES.answered = false; SES.idx++; _renderQuestion(); }, ok ? 800 : 1800);
  } else {
    setTimeout(() => {
      const nx = $('#dm-next');
      if(nx) nx.addEventListener('click', () => { SES.answered = false; SES.idx++; _renderQuestion(); });
    }, 30);
  }
}

function _renderSubjQ(t, cat, progress){
  const view = document.getElementById('view');
  view.innerHTML = _baseStyles() + `
    <div class="dm-sub-header">
      <div><div class="ttl">主觀 · <span class="han">${esc(cat.han)}</span></div><div class="sub">${SES.idx+1} / ${SES.order.length}</div></div>
      <button class="back" type="button" id="dm-sub-back">← 종료</button>
    </div>
    <div class="dm-progress">
      <span class="stat">${SES.correct} / ${SES.idx}</span>
      <div class="bar"><div class="fill" style="width:${(progress*100).toFixed(1)}%"></div></div>
      <span>오답 <b style="color:#9C3030">${SES.wrong}</b></span>
    </div>
    <div class="dm-card-q">
      <img class="dm-img" src="${esc(t.img)}" alt="">
      <div class="dm-q-text">이 사진의 <span class="han">舌象 라벨</span> 또는 <span class="han">形態</span>·<span class="han">色苔</span>를 입력 (한자/한글):</div>
      <div class="dm-input-row">
        <input type="text" id="dm-subj-input" placeholder="예: 紅舌  /  胖大  /  黃膩苔">
        <button type="button" id="dm-subj-submit">확인</button>
      </div>
      <div id="dm-feedback"></div>
    </div>
  `;
  $('#dm-sub-back').addEventListener('click', () => { SES = null; renderDongmuHome(); });
  const input = $('#dm-subj-input'); const submit = $('#dm-subj-submit');
  input.focus();
  const fire = () => _handleSubjAnswer(input.value, t);
  submit.addEventListener('click', fire);
  input.addEventListener('keydown', e => { if(e.key === 'Enter') fire(); });
}
function _handleSubjAnswer(raw, t){
  if(SES.answered) return;
  const v = String(raw||'').trim().replace(/\s+/g,'').toLowerCase();
  if(!v) return;
  const cand = [];
  // v11.6.1 FIX: 변증(pattern/pattern_han) 은 시험 범위 외 — 정답 후보에서 제외.
  //   설체 형태(body_features) + 설태 색태(quality_features) + 한자 라벨(han/label_full/ko) 만 인정.
  [t.han, t.label_full, t.ko].forEach(x => { if(x) cand.push(x); });
  (t.body_features||[]).forEach(x => cand.push(x));
  (t.quality_features||[]).forEach(x => cand.push(x));
  const norm = s => String(s||'').replace(/\s+/g,'').toLowerCase();
  const ok = cand.some(c => {
    const nc = norm(c);
    if(!nc || nc.length < 2) return false;
    return nc.includes(v) || v.includes(nc);
  });
  SES.answered = true;
  if(ok){ SES.correct++; } else { SES.wrong++; SES.wrongIds.push(t.id); }
  const fb = $('#dm-feedback');
  fb.className = 'dm-feedback ' + (ok ? 'ok' : 'no');
  fb.innerHTML = `
    <div><b>${ok?'正答':'誤答'}</b> · 입력: <span class="han">${esc(raw)}</span></div>
    <div>정답: <span class="han">${esc(t.han)}</span> · ${esc(t.label_full||'')}</div>
    ${t.pattern_han ? `<div>辨證: <span class="han">${esc(t.pattern_han)}</span> · ${esc(t.pattern||'')}</div>` : ''}
    ${t.notes ? `<div style="margin-top:4px">${esc(t.notes)}</div>` : ''}
    <div style="margin-top:7px;text-align:right"><button class="btn btn-sm" type="button" id="dm-next">다음 →</button></div>
  `;
  $('#dm-subj-input').disabled = true;
  $('#dm-subj-submit').disabled = true;
  _saveStat(t.id, ok);
  setTimeout(() => {
    const nx = $('#dm-next');
    if(nx) nx.addEventListener('click', () => { SES.answered = false; SES.idx++; _renderQuestion(); });
  }, 30);
}

function _renderResult(){
  const view = document.getElementById('view');
  if(!view || !SES) return;
  const total = SES.correct + SES.wrong;
  const pct = total > 0 ? Math.round(SES.correct / total * 100) : 0;
  const dur = Math.round((Date.now() - SES.startedAt) / 1000);
  const m = Math.floor(dur/60), s = dur%60;
  const cat = CATEGORY_BY_ID[SES.catId] || CATEGORY_BY_ID.all;
  const wrongCards = SES.wrongIds.map(id => {
    const t = (window.TONGUE_BY_ID || {})[id];
    if(!t) return '';
    return `<div class="dm-gal-card" data-tid="${t.id}"><img src="${esc(t.img)}" alt="" loading="lazy"><span class="dm-gal-num">${('00'+t.id).slice(-2)}</span><div class="dm-gal-label"><b>${esc(t.han)}</b><br>${esc(t.pattern_han||'-')}</div></div>`;
  }).join('');
  view.innerHTML = _baseStyles() + `
    <div class="dm-sub-header">
      <div><div class="ttl">滿陣 · 결과</div><div class="sub">${SES.mode==='subj'?'주관식':SES.mode==='drill'?'속습':'객관식'} · <span class="han">${esc(cat.han)}</span></div></div>
      <button class="back" type="button" id="dm-sub-back">← 동무의 방</button>
    </div>
    <div class="dm-result"><div class="pct">${pct}%</div><div class="meta">${SES.correct} / ${total} · 소요 ${m}분 ${s}초</div></div>
    <div style="display:flex;gap:6px;margin-bottom:12px">
      <button class="btn" style="flex:1" type="button" id="dm-retry">↻ 다시 풀기</button>
      <button class="btn btn-o" style="flex:1" type="button" id="dm-home">동무의 방</button>
    </div>
    ${SES.wrongIds.length > 0 ? `
      <div style="font-family:'Noto Serif SC',serif;color:var(--zhusha-d);font-size:13px;margin:14px 0 6px"><b>誤答 復習</b> · ${SES.wrongIds.length}장</div>
      <div class="dm-gal-grid">${wrongCards}</div>
    ` : '<div style="text-align:center;color:#2A7060;font-family:Noto Serif SC,serif;font-size:14px;margin-top:10px">無誤答 · 완벽한 회차입니다.</div>'}
  `;
  $('#dm-sub-back').addEventListener('click', () => { SES = null; renderDongmuHome(); });
  $('#dm-retry').addEventListener('click', () => { const mode = SES.mode, catId = SES.catId; _newSession(mode, catId); _renderQuestion(); });
  $('#dm-home').addEventListener('click', () => { SES = null; renderDongmuHome(); });
  $$('.dm-gal-card').forEach(c => c.addEventListener('click', () => _openDetailModal(parseInt(c.dataset.tid, 10))));
}

const STATS_KEY = 'bangje.jindan.stats.v1';
function _loadStats(){
  try{ const raw = localStorage.getItem(STATS_KEY); if(raw) return JSON.parse(raw); }catch(_){}
  return { perTongue:{}, totals:{correct:0, wrong:0, sessions:0} };
}
function _saveStats(s){ try{ localStorage.setItem(STATS_KEY, JSON.stringify(s)); }catch(_){} }
function _saveStat(tid, ok){
  const s = _loadStats();
  if(!s.perTongue[tid]) s.perTongue[tid] = { c:0, w:0 };
  if(ok){ s.perTongue[tid].c++; s.totals.correct++; }
  else  { s.perTongue[tid].w++; s.totals.wrong++; }
  _saveStats(s);
}

function openStats(){
  const view = document.getElementById('view');
  if(!view) return;
  const s = _loadStats();
  const total = s.totals.correct + s.totals.wrong;
  const pct = total > 0 ? Math.round(s.totals.correct / total * 100) : 0;
  const byCat = { jilji:{c:0,w:0,n:0,seen:0}, seoltai:{c:0,w:0,n:0,seen:0}, both:{c:0,w:0,n:0,seen:0} };
  const T = window.TONGUES || [];
  T.forEach(t => {
    const cat = t.category || 'jilji';
    byCat[cat].n++;
    const st = s.perTongue[t.id];
    if(st){ byCat[cat].c += st.c; byCat[cat].w += st.w; if(st.c + st.w > 0) byCat[cat].seen++; }
  });
  const weak = T.map(t => {
    const st = s.perTongue[t.id] || {c:0,w:0};
    const tot = st.c + st.w;
    const wpct = tot > 0 ? st.w / tot : 0;
    return { t, tot, wpct, w:st.w };
  }).filter(x => x.w > 0).sort((a,b) => b.w - a.w || b.wpct - a.wpct).slice(0, 6);
  view.innerHTML = _baseStyles() + `
    <div class="dm-sub-header">
      <div><div class="ttl">析究 · 통계·분석</div><div class="sub">로컬 저장 · 사진별 정답률</div></div>
      <button class="back" type="button" id="dm-sub-back">← 동무의 방</button>
    </div>
    <div class="dm-result"><div class="pct">${pct}%</div><div class="meta">전체 정답률 · ${s.totals.correct} 正 / ${s.totals.wrong} 誤 (총 ${total}회)</div></div>
    <div class="dm-stat-row">
      <div class="dm-stat-card"><div class="v">${byCat.jilji.seen}/${byCat.jilji.n}</div><div class="l"><span class="han" style="color:#9C3030">舌質</span> 본 사진</div></div>
      <div class="dm-stat-card"><div class="v">${byCat.seoltai.seen}/${byCat.seoltai.n}</div><div class="l"><span class="han" style="color:#2A7060">舌苔</span> 본 사진</div></div>
      <div class="dm-stat-card"><div class="v">${byCat.both.seen}/${byCat.both.n}</div><div class="l"><span class="han" style="color:#C9A227">兼</span> 본 사진</div></div>
    </div>
    <div class="dm-card-q">
      <div style="font-family:'Noto Serif SC',serif;color:var(--zhusha-d);font-size:13px;margin-bottom:6px"><b>分類別 正答率</b></div>
      ${Object.keys(byCat).map(k => {
        const x = byCat[k]; const tot = x.c + x.w;
        const p = tot > 0 ? Math.round(x.c / tot * 100) : 0;
        const c = CATEGORY_BY_ID[k] || {};
        return `<div class="dm-bar-row">
          <div class="name">${esc(c.han||k)}</div>
          <div class="barOuter"><div class="barFill" style="width:${p}%"></div></div>
          <div class="num">${p}% (${x.c}/${tot})</div>
        </div>`;
      }).join('')}
    </div>
    ${weak.length > 0 ? `
      <div style="font-family:'Noto Serif SC',serif;color:var(--zhusha-d);font-size:13px;margin:14px 0 6px"><b>取弱 · 자주 틀리는 사진</b></div>
      <div class="dm-gal-grid">${weak.map(x => `
        <div class="dm-gal-card" data-tid="${x.t.id}">
          <img src="${esc(x.t.img)}" alt="" loading="lazy">
          <span class="dm-gal-num">${('00'+x.t.id).slice(-2)}</span>
          <span class="dm-gal-cat ${esc(x.t.category)}">${esc((CATEGORY_BY_ID[x.t.category]||{}).han||'?')}</span>
          <div class="dm-gal-label"><b>${esc(x.t.han)}</b><br>오답 ${x.w}회</div>
        </div>
      `).join('')}</div>
    ` : '<div style="text-align:center;color:var(--mo-l);font-size:11.5px;margin:14px 0">아직 학습 기록이 없습니다. 객관식·주관식·드릴을 풀면 사진별 정답률이 누적됩니다.</div>'}
    ${total > 0 ? `<div style="margin-top:14px;text-align:center"><button class="btn btn-sm btn-o" type="button" id="dm-stat-reset">통계 초기화</button></div>` : ''}
  `;
  $('#dm-sub-back').addEventListener('click', renderDongmuHome);
  const rb = $('#dm-stat-reset');
  if(rb) rb.addEventListener('click', () => {
    if(confirm('진단학 학습 통계를 모두 초기화할까요?')){
      try{ localStorage.removeItem(STATS_KEY); }catch(_){}
      toast('통계 초기화 완료','gold'); openStats();
    }
  });
  $$('.dm-gal-card').forEach(c => c.addEventListener('click', () => _openDetailModal(parseInt(c.dataset.tid, 10))));
}

window.V11Jindan = {
  openHome: renderDongmuHome,
  openGallery, openMcq, openSubj, openDrill, openStats,
  openMatrix: () => (window.V11Matrix && window.V11Matrix.open && window.V11Matrix.open()),
  CATEGORIES,
};

})();
