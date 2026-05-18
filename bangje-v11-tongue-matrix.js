/* bangje-v11-tongue-matrix.js — 對位 설질×설태 매트릭스 v1.0
 * ============================================================================
 *  5/26 설질 시험 대비 — 색(舌色) 과 태(舌苔) 를 동시에 학습.
 *
 *   가로축 (X): 舌色  — 淡白 · 淡紅 · 紅 · 絳 · 紫·暗
 *   세로축 (Y): 舌苔  — 無·剝 · 薄白 · 白厚·膩 · 黃 · 黑
 *
 *  動線:
 *   1. tray 에서 사진을 잡아 (pointer) 매트릭스 cell 로 끌어옴
 *   2. 정답 cell 에 놓으면 → 綠 효과 + 그 자리에 安着
 *   3. 오답 cell 에 놓으면 → 朱 효과 + 1.2초 후 tray 로 복귀 (시도 횟수 누적)
 *   4. 모두 배치 → 滿陣 카드 + 결과 통계 + 全 셀 라벨 공개
 *
 *  學習세트:
 *   ENTRIES 배열 — 각 설진 사진의 (color_idx, coating_idx, confidence) 매핑.
 *   confidence='explicit': quality_features 에 색·태 둘 다 명시
 *   confidence='inferred': 一方 명시 + 변증/notes 로 합리 추정
 *
 *  V11Matrix.open()  — 對位 모드 진입
 * ============================================================================ */

(function(){
'use strict';

function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }

// ─── 0. 軸 정의 ─────────────────────────────────────────────────────────
const COLORS = [
  { idx:0, han:'淡白', ko:'담백', bg:'#F5DDC0', accent:'#A08060' },
  { idx:1, han:'淡紅', ko:'담홍', bg:'#F4B8A0', accent:'#C06860' },
  { idx:2, han:'紅',   ko:'홍',   bg:'#D85040', accent:'#9C2030' },
  { idx:3, han:'絳',   ko:'강',   bg:'#7A1818', accent:'#5C1010', dark:true },
  { idx:4, han:'紫·暗', ko:'자·암', bg:'#5C2C5C', accent:'#3C1C3C', dark:true },
];
const COATINGS = [
  { idx:0, han:'無·剝', ko:'무·박', bg:'#FFF2D8', accent:'#C9A227' },
  { idx:1, han:'薄白', ko:'박백',   bg:'#FAF6E8', accent:'#8C7858' },
  { idx:2, han:'白厚膩',ko:'백후·니',bg:'#E8E0C8', accent:'#7C6840' },
  { idx:3, han:'黃苔', ko:'황태',   bg:'#E8C040', accent:'#A08020' },
  { idx:4, han:'黑苔', ko:'흑태',   bg:'#2A2A2E', accent:'#1A1A1E', dark:true },
];

// ─── 1. 학습 매핑 ───────────────────────────────────────────────────────
// 각 tongue id 의 (color_idx, coating_idx).
// confidence: 'explicit' = 교재 라벨에 색·태 둘 다 명시.
//             'inferred' = 한 쪽 명시 + 변증/notes 로 표준 진단학 합리 추정.
//
// v11.6: 누락 24장 보강. 진단학 표준 (한방진단학·中医诊断学) 으로 색·태 좌표 추정.
//        근거는 각 entry 의 주석 (변증·notes·교과서 일반 분류).
const ENTRIES = [
  // 정상·氣虛계
  { tid: 1,  color:1, coating:1, conf:'explicit' },   // 淡紅·薄白苔 — 정상
  { tid: 2,  color:1, coating:1, conf:'inferred' },   // 淡紅 + 氣虛 → 薄白 standard
  { tid: 6,  color:0, coating:0, conf:'explicit' },   // 淡白·無苔 — 陽虛
  { tid:36, color:0, coating:1, conf:'inferred' },    // 淡白 + 氣血兩虛 → 薄白
  { tid:38, color:1, coating:1, conf:'inferred' },    // 薄白苔 + 정상 → 淡紅
  // v11.6 추가 (氣虛·陽虛·齒痕계 — 형태 위주 사진)
  { tid:25, color:0, coating:1, conf:'inferred' },    // 齒痕舌·氣虛/陽虛 → 淡白·薄白 standard
  { tid:26, color:0, coating:1, conf:'inferred' },    // 齒痕(肥大)·氣虛 → 淡白·薄白
  { tid:27, color:0, coating:1, conf:'inferred' },    // 齒痕(肥大)·氣虛 → 淡白·薄白
  // 濕證·寒濕
  { tid: 7,  color:1, coating:1, conf:'explicit' },   // 淡紅·薄滑苔 — 濕證
  { tid:40, color:0, coating:2, conf:'inferred' },    // 白厚滑膩 + 寒濕 → 淡白
  { tid:41, color:1, coating:2, conf:'inferred' },    // 白滑苔 + 痰濕 → 淡紅
  // v11.6 추가 (濕證·痰濕계 苔 명시)
  { tid:15, color:1, coating:2, conf:'inferred' },    // 滑苔·濕證 → 淡紅·白厚滑膩
  { tid:16, color:1, coating:2, conf:'inferred' },    // 白厚苔·痰濕 → 淡紅·白厚膩
  { tid:39, color:1, coating:2, conf:'inferred' },    // 白厚腐苔·食積/痰濁 → 淡紅·白厚膩 (腐苔는 食積)
  // 痰濕·寒濕 紫계
  { tid:10, color:4, coating:2, conf:'explicit' },    // 紫紅·白膩 — 痰濕
  { tid:13, color:4, coating:2, conf:'explicit' },    // 紫·白膩 — 寒濕
  // 熱證·濕熱 黃계
  { tid:11, color:2, coating:2, conf:'explicit' },    // 深紅·腐苔 — 濕熱
  { tid:17, color:1, coating:3, conf:'inferred' },    // 淡黃膩 + 痰濕化熱 → 淡紅
  { tid:18, color:2, coating:3, conf:'inferred' },    // 淡黃垢膩 + 濕熱 → 紅
  { tid:19, color:2, coating:3, conf:'inferred' },    // 黃膩 + 濕熱 → 紅
  { tid:42, color:2, coating:3, conf:'inferred' },    // 黃薄乾 + 熱盛 → 紅
  // v11.6 추가 (純 熱證·心肝火旺·實證계)
  { tid: 4,  color:1, coating:1, conf:'inferred' },   // 舌尖紅·점자·心火盛 → 전체 淡紅 + 薄白 (국소 발현)
  { tid: 8,  color:2, coating:3, conf:'inferred' },   // 紅舌·熱證 → 紅·黃苔 standard
  { tid: 9,  color:2, coating:3, conf:'inferred' },   // 尖邊紅·心肝火旺 → 紅·黃苔
  { tid:34, color:2, coating:3, conf:'inferred' },    // 粗老·實證 → 紅·黃苔 (實熱)
  { tid:37, color:2, coating:3, conf:'inferred' },    // 芒刺·熱盛 → 紅·黃苔
  { tid:20, color:2, coating:3, conf:'explicit' },    // 黃膩苔+剝·陰虛 → 紅·黃 (苔 explicit, 剝은 보조)
  // 熱入營血·熱極
  { tid:14, color:4, coating:3, conf:'explicit' },    // 暗紅·薄黃 — 熱入營血
  { tid:43, color:3, coating:3, conf:'inferred' },    // 黃厚燥 + 熱極 → 絳
  { tid:44, color:3, coating:3, conf:'inferred' },    // 黃厚燥裂 + 熱極傷陰 → 絳
  // v11.6 추가 (陰虛火旺 絳)
  { tid:35, color:3, coating:0, conf:'inferred' },    // 裂紋(紅絳)·陰虛火旺 → 絳·少苔
  // 陰虛·胃陰虛 (少苔系)
  { tid:22, color:2, coating:0, conf:'inferred' },    // 花剝苔 + 胃陰虛 → 紅
  { tid:30, color:2, coating:0, conf:'inferred' },    // 無苔 + 胃陰虛 → 紅
  { tid:48, color:2, coating:0, conf:'inferred' },    // 剝苔 + 胃陰虛 → 紅
  { tid:28, color:3, coating:0, conf:'inferred' },    // 絳 + 陰虛/熱入營 → 少苔
  { tid:29, color:3, coating:0, conf:'inferred' },    // 絳 + 陰虛 → 少苔
  // v11.6 추가 (陰虛·肺胃陰虛 少苔)
  { tid: 3,  color:2, coating:0, conf:'inferred' },   // 瘦薄·陰虛 → 紅·少苔 (陰虛火旺 표준)
  { tid: 5,  color:2, coating:0, conf:'inferred' },   // 裂紋·陰虛 → 紅·少苔
  { tid:21, color:2, coating:0, conf:'inferred' },    // 半截剝·肺胃陰虛 → 紅·少苔
  { tid:23, color:1, coating:0, conf:'inferred' },    // 花剝·氣虛 → 淡紅·少苔 (氣虛이므로 색 약함)
  { tid:24, color:1, coating:0, conf:'inferred' },    // 地圖苔·氣虛 → 淡紅·少苔 (地圖=花剝)
  { tid:31, color:2, coating:0, conf:'inferred' },    // 鏡面舌·陰虛 → 紅·無苔
  // 血瘀 紫系
  { tid:12, color:4, coating:1, conf:'inferred' },    // 紫紅 + 血瘀 → 薄白 default
  // v11.6 추가 (熱毒·血瘀 紫)
  { tid:32, color:4, coating:1, conf:'inferred' },    // 紫紅·熱毒/血瘀 → 紫·薄白
  { tid:33, color:4, coating:0, conf:'inferred' },    // 紫紅·熱毒·陰虛 → 紫·少苔 (陰虛 동반)
  // v11.6 추가 (黑苔·偏盛 — 危重/편향)
  { tid:45, color:2, coating:4, conf:'inferred' },    // 黑苔·熱極 → 紅·黑苔 (熱極 표준)
  { tid:46, color:2, coating:4, conf:'inferred' },    // 黑苔·熱極/極寒 → 紅·黑苔
  { tid:47, color:1, coating:1, conf:'inferred' },    // 偏左白苔·偏盛 → 淡紅·薄白 (편향은 형태 분류)
];

function _getTongueById(id){
  return (window.TONGUE_BY_ID && window.TONGUE_BY_ID[id]) || null;
}

// 매트릭스 셀 별로 entries 그룹화
function _cellEntries(){
  const cells = {};
  ENTRIES.forEach(e => {
    const key = e.color + ',' + e.coating;
    if(!cells[key]) cells[key] = [];
    cells[key].push(e);
  });
  return cells;
}

// ─── 2. 세션 상태 ───────────────────────────────────────────────────────
let _state = null;

function _newState(){
  return {
    mode: 'place',          // 'place' | 'study'
    placed: {},             // { tid: {x,y} }   정답에 안착된 것들
    attempts: {},           // { tid: number }  시도 횟수
    correctCount: 0,
    attemptCount: 0,
    startedAt: Date.now(),
    completed: false,
  };
}

// ─── 3. UI: 진입 ────────────────────────────────────────────────────────
function open(){
  if(!window.TONGUES || !window.TONGUE_BY_ID){
    toast('설진 데이터 미로드','warn');
    return;
  }
  _state = _newState();
  _render();
  // v11.6: 활동 라벨 갱신 → 의서궁의 同學 목록에 "舌診 對位" 가 표시됨.
  try{
    if(window.V96Activity) window.V96Activity.set('舌診 對位', '설질·설태 매트릭스 학습 중');
    if(typeof window.recordPresence === 'function') window.recordPresence();
  }catch(_){}
}

// v11.6.0 patched: 「전부다」 모드로 직접 진입 — 정답 매트릭스 일괄 표시
//   동무의 방 home 에서 「對位 · 전부다」 버튼이 호출.
//   drag-drop 없이 정답 5×5 가 즉시 펼쳐지므로 빠른 열람·복습용.
function openStudy(){
  if(!window.TONGUES || !window.TONGUE_BY_ID){
    toast('설진 데이터 미로드','warn');
    return;
  }
  _state = _newState();
  _state.mode = 'study';
  _render();
  try{
    if(window.V96Activity) window.V96Activity.set('舌診 對位', '전부다 (정답 일괄 표시)');
    if(typeof window.recordPresence === 'function') window.recordPresence();
  }catch(_){}
}

// ─── 4. UI: 메인 렌더 ───────────────────────────────────────────────────
function _render(){
  const view = document.getElementById('view');
  if(!view || !_state) return;
  // v11.6.0 patched: 매트릭스도 동무의 방 컨텍스트 — 헤더·하단 nav 진단학 정체성 유지
  try{ if(typeof window.setHeaderContext === 'function') window.setHeaderContext('dongmu'); }catch(_){}
  
  if(_state.mode === 'study'){
    return _renderStudy();
  }
  
  // place mode
  const remaining = ENTRIES.filter(e => !_state.placed[e.tid]);
  const total = ENTRIES.length;
  const placedN = total - remaining.length;
  
  view.innerHTML = _styleBlock() + _topBar(placedN, total) + _trayHTML(remaining) + _matrixHTML('place') + _controlBar();
  
  _attachTopBar();
  _attachDragSources();
  _attachControlBar();
  _attachCellTaps();   // 빈 셀 무시, 채워진 셀 tap 시 modal 로 라벨 표시
  
  if(placedN === total && !_state.completed){
    _state.completed = true;
    setTimeout(_showCompletionBanner, 350);
  }
}

function _styleBlock(){
  return `
    <style>
      .mx-top { display:flex; align-items:center; gap:8px; margin-bottom:8px; padding:8px 10px;
                background:linear-gradient(135deg,#9C3030,#6E1818); color:#FFE08A; border-radius:9px;
                box-shadow:0 3px 8px rgba(60,12,12,.22); }
      .mx-top .ttl { font-family:'ZCOOL XiaoWei',serif; font-size:20px; letter-spacing:.05em; }
      .mx-top .sub { font-size:10.5px; opacity:.85; margin-top:1px; }
      .mx-top .back { margin-left:auto; background:transparent; border:1px solid #FFE08A; color:#FFE08A;
                      padding:4px 9px; border-radius:6px; font-size:11px; cursor:pointer; }
      .mx-top .back:hover { background:rgba(255,224,138,.12); }
      .mx-progress { display:flex; gap:8px; align-items:center; font-size:11.5px; color:var(--mo);
                     padding:6px 10px; background:#FAF1E0; border:1px solid #C9A22744; border-radius:8px;
                     margin-bottom:8px; }
      .mx-progress .bar { flex:1; height:6px; background:#E8DCC0; border-radius:3px; overflow:hidden; position:relative; }
      .mx-progress .fill { position:absolute; left:0; top:0; bottom:0; background:linear-gradient(90deg,#C9A227,#9C3030);
                           transition:width .4s ease; border-radius:3px; }
      .mx-progress .stat { font-family:var(--font-display); color:var(--zhusha-d); }
      
      /* TRAY */
      .mx-tray-wrap { background:#FFF8E8; border:1px solid #C9A22744; border-radius:8px; padding:8px;
                       margin-bottom:10px; }
      .mx-tray-head { display:flex; gap:6px; align-items:center; font-size:11px; color:var(--mo-l);
                       margin-bottom:6px; }
      .mx-tray-head .han { font-family:'Noto Serif SC',serif; font-size:13px; color:var(--zhusha-d); font-weight:700; }
      .mx-tray { display:flex; gap:6px; overflow-x:auto; padding:2px; min-height:62px;
                  scrollbar-width:thin; }
      .mx-tray::-webkit-scrollbar { height:4px; }
      .mx-tray::-webkit-scrollbar-thumb { background:#C9A22788; border-radius:2px; }
      .mx-tile { width:52px; height:52px; border-radius:6px; flex-shrink:0; position:relative;
                  background:#fff; border:1.5px solid #C9A22755; overflow:hidden; cursor:grab;
                  touch-action:none; user-select:none; -webkit-user-select:none;
                  transition:transform .12s ease, box-shadow .12s ease; }
      .mx-tile:hover { transform:translateY(-1px); box-shadow:0 3px 7px rgba(60,30,10,.18); border-color:#9C3030; }
      .mx-tile:active { cursor:grabbing; }
      .mx-tile.dragging { opacity:.32; }
      .mx-tile img { width:100%; height:100%; object-fit:cover; display:block; pointer-events:none; }
      .mx-tile .tid { position:absolute; left:1px; top:1px; font-family:var(--font-display); font-size:9px;
                       color:#fff; background:rgba(0,0,0,.55); padding:0 3px; border-radius:2px;
                       text-shadow:0 1px 2px rgba(0,0,0,.6); pointer-events:none; }
      .mx-tile.inferred::after { content:'?'; position:absolute; right:1px; top:1px; font-size:8px;
                                  background:#C9A227; color:#3A2010; padding:0 3px; border-radius:2px;
                                  font-weight:700; pointer-events:none; }
      
      /* GHOST (dragging) */
      .mx-ghost { position:fixed; pointer-events:none; z-index:9999; width:52px; height:52px;
                   border-radius:6px; overflow:hidden; box-shadow:0 8px 18px rgba(0,0,0,.4);
                   border:2px solid #C9A227; transform:rotate(-3deg); opacity:.92; }
      .mx-ghost img { width:100%; height:100%; object-fit:cover; }
      
      /* MATRIX */
      .mx-grid-wrap { background:#fff; border:1px solid #C9A22755; border-radius:10px; padding:8px;
                       margin-bottom:10px; overflow:hidden; }
      .mx-axis-x-label { text-align:center; font-size:10.5px; color:var(--gutong); margin-bottom:3px; letter-spacing:.04em; }
      .mx-axis-x-label .han { font-family:'Noto Serif SC',serif; color:var(--zhusha-d); font-weight:700; font-size:11.5px; }
      .mx-grid { display:grid; grid-template-columns: 36px repeat(5, 1fr); gap:2px; }
      .mx-th { display:flex; flex-direction:column; align-items:center; justify-content:center;
                padding:5px 2px; font-size:9.5px; color:var(--mo-l); }
      .mx-th .han { font-family:'Noto Serif SC',serif; font-size:11.5px; font-weight:700; line-height:1.1; }
      .mx-th.x { background:linear-gradient(180deg,#FAF1E0,#F0E0C0); border-radius:5px 5px 0 0; }
      .mx-th.y { background:linear-gradient(90deg,#FAF1E0,#F0E0C0); border-radius:5px 0 0 5px; writing-mode:initial; }
      .mx-cell { aspect-ratio:1; background:#FFFBF0; border:1px dashed #C9A22755; border-radius:5px;
                  position:relative; display:flex; align-items:center; justify-content:center;
                  font-size:9px; color:var(--mo-l); padding:2px; min-height:46px;
                  transition:background .15s ease, border-color .15s ease, transform .15s ease; }
      .mx-cell.empty:hover { background:#FFF8E0; border-color:#C9A227; }
      .mx-cell.hover-target { background:#FFF0C0 !important; border:2px dashed #C9A227 !important; transform:scale(1.04); }
      .mx-cell.flash-correct { animation:mx-correct .8s ease; }
      .mx-cell.flash-wrong { animation:mx-wrong .8s ease; }
      @keyframes mx-correct {
        0%   { background:#2A7060; border-color:#2A7060; transform:scale(1); }
        40%  { background:#54B090; border-color:#54B090; transform:scale(1.10); }
        100% { background:#FFFBF0; border-color:#C9A22555; transform:scale(1); }
      }
      @keyframes mx-wrong {
        0%   { background:#9C3030; border-color:#9C3030; transform:scale(1); }
        20%  { background:#C03030; transform:translateX(-3px) scale(1.05); }
        40%  { transform:translateX(3px) scale(1.05); }
        60%  { transform:translateX(-2px); }
        100% { background:#FFFBF0; border-color:#C9A22555; transform:scale(1); }
      }
      .mx-cell-thumbs { display:flex; flex-wrap:wrap; gap:1px; width:100%; height:100%; align-content:flex-start; }
      .mx-cell-thumb { width:46%; aspect-ratio:1; border-radius:3px; overflow:hidden; cursor:pointer;
                        border:1px solid rgba(255,255,255,.5); }
      .mx-cell-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
      .mx-cell.count-1 .mx-cell-thumb { width:96%; }
      .mx-cell.count-2 .mx-cell-thumb { width:48%; }
      .mx-cell.count-3 .mx-cell-thumb, .mx-cell.count-4 .mx-cell-thumb { width:48%; }
      
      /* CONTROL */
      .mx-ctrl { display:flex; gap:6px; margin-top:4px; }
      .mx-ctrl button { flex:1; padding:9px 6px; font-size:12px; border-radius:7px; border:1px solid;
                         cursor:pointer; font-family:inherit; }
      .mx-ctrl .reset { background:#FFF8E0; border-color:#C9A22755; color:var(--zhusha-d); }
      .mx-ctrl .reset:hover { background:#FFE8B0; }
      .mx-ctrl .reveal { background:#9C3030; border-color:#9C3030; color:#FFE08A; }
      .mx-ctrl .reveal:hover { background:#6E1818; }
      .mx-ctrl .toggle { background:#FAF1E0; border-color:#C9A22755; color:var(--mo); }
      .mx-ctrl .toggle:hover { background:#FFE8B0; }
      
      /* COMPLETION BANNER */
      .mx-done {
        position:fixed; left:50%; top:34%; transform:translate(-50%,-50%) scale(.85); z-index:9998;
        background:linear-gradient(135deg,#9C3030,#6E1818); color:#FFE08A;
        padding:20px 26px; border-radius:14px; text-align:center; box-shadow:0 14px 34px rgba(60,12,12,.5);
        animation:mx-done-in .55s cubic-bezier(.16,1.2,.36,1) forwards;
        max-width:280px; pointer-events:auto;
      }
      .mx-done .han { font-family:'ZCOOL XiaoWei',serif; font-size:40px; letter-spacing:.08em; margin-bottom:6px; }
      .mx-done .ko { font-size:12px; opacity:.88; margin-bottom:10px; }
      .mx-done .stats { font-size:11.5px; opacity:.92; margin-bottom:12px; line-height:1.7; }
      .mx-done button { background:#FFE08A; color:#5C1010; border:0; padding:7px 16px; font-size:12px;
                         border-radius:6px; cursor:pointer; font-weight:700; }
      @keyframes mx-done-in {
        from { transform:translate(-50%,-50%) scale(.7); opacity:0; }
        to   { transform:translate(-50%,-50%) scale(1);   opacity:1; }
      }
      .mx-done-overlay { position:fixed; inset:0; background:rgba(20,8,4,.55); z-index:9997; }
      
      /* MODAL — 셀 상세 */
      .mx-modal-bg { position:fixed; inset:0; background:rgba(20,8,4,.55); z-index:9996; display:flex;
                      align-items:center; justify-content:center; padding:20px; }
      .mx-modal { background:#FFF8E8; border:1.5px solid #9C3030; border-radius:12px; padding:14px;
                   max-width:340px; max-height:80vh; overflow:auto; box-shadow:0 10px 28px rgba(60,12,12,.4); }
      .mx-modal h4 { margin:0 0 8px; font-family:'Noto Serif SC',serif; color:var(--zhusha-d); font-size:14px;
                      display:flex; gap:6px; align-items:center; }
      .mx-modal .pho { width:100%; max-height:240px; object-fit:cover; border-radius:6px; margin-bottom:8px; cursor:zoom-in; }
      .mx-modal .pho:hover { filter:brightness(1.06); }
      .mx-modal .row { font-size:11.5px; line-height:1.65; margin-bottom:4px; }
      .mx-modal .row b { color:var(--zhusha-d); font-family:'Noto Serif SC',serif; }
      .mx-modal .close { width:100%; margin-top:6px; padding:8px; background:var(--zhusha); color:#fff;
                          border:0; border-radius:6px; cursor:pointer; font-size:12px; }
      
      /* v11.6.0 patched — 라이트박스 (사진 클릭 확대) */
      .mx-lightbox-bg { position:fixed; inset:0; background:rgba(8,4,2,.94); z-index:10000;
                         display:flex; align-items:center; justify-content:center; padding:18px;
                         cursor:zoom-out; animation:mx-lb-in .18s ease; }
      .mx-lightbox-bg img { max-width:100%; max-height:92vh; object-fit:contain; border-radius:8px;
                              box-shadow:0 12px 38px rgba(0,0,0,.7); }
      .mx-lightbox-bg .mx-lb-cap { position:fixed; bottom:18px; left:50%; transform:translateX(-50%);
                                    background:rgba(20,8,4,.78); color:#FFE08A; padding:6px 14px;
                                    border-radius:18px; font-family:'Noto Serif SC',serif; font-size:13px;
                                    letter-spacing:.04em; max-width:88vw; text-align:center;
                                    pointer-events:none; }
      .mx-lightbox-bg .mx-lb-close { position:fixed; top:14px; right:14px; width:36px; height:36px;
                                       border-radius:50%; background:rgba(255,224,138,.18); border:1px solid #FFE08A;
                                       color:#FFE08A; font-size:18px; cursor:pointer; line-height:1; }
      @keyframes mx-lb-in { from { opacity:0; } to { opacity:1; } }
      
      /* tray 타일 long-press 힌트 (클릭 시 확대) */
      .mx-tile { position:relative; }
      .mx-tile-zoom { position:absolute; right:1px; bottom:1px; width:14px; height:14px;
                       border-radius:50%; background:rgba(0,0,0,.55); color:#fff;
                       font-size:9px; line-height:14px; text-align:center; pointer-events:auto;
                       cursor:zoom-in; z-index:2; }
    </style>
  `;
}

function _topBar(placed, total){
  return `
    <div class="mx-top">
      <div>
        <div class="ttl">舌色·舌苔 對位</div>
        <div class="sub">설질(色) × 설태(苔) 매트릭스 배치 학습</div>
      </div>
      <button class="back" type="button" id="mx-back">← 동무의 방</button>
    </div>
    <div class="mx-progress">
      <span class="stat">${placed} / ${total}</span>
      <div class="bar"><div class="fill" style="width:${(placed/total*100).toFixed(1)}%"></div></div>
      <span>시도 <b style="color:var(--zhusha-d)">${_state.attemptCount}</b></span>
    </div>
  `;
}

function _trayHTML(remaining){
  if(!remaining.length){
    return `<div class="mx-tray-wrap"><div class="mx-tray-head"><span class="han">滿陣</span> 모든 사진 배치 완료 ✨</div></div>`;
  }
  const tiles = remaining.map(e => {
    const t = _getTongueById(e.tid);
    if(!t) return '';
    const inf = e.conf === 'inferred' ? ' inferred' : '';
    // v11.6.0 patched: 우하단 ⤢ 버튼으로 확대 (drag 와 분리: button 은 pointerdown 시 stopPropagation)
    return `<div class="mx-tile draggable${inf}" data-tid="${e.tid}" title="${esc(t.han)}">
              <span class="tid">${('00'+e.tid).slice(-2)}</span>
              <img src="${esc(t.img)}" alt="">
              <div class="mx-tile-zoom" data-zoom-tid="${e.tid}" title="확대">⤢</div>
            </div>`;
  }).join('');
  return `
    <div class="mx-tray-wrap">
      <div class="mx-tray-head">
        <span class="han">待診</span> 미배치 ${remaining.length}장
        <span style="margin-left:auto;font-size:9.5px;color:var(--gutong)">⤢ 확대 · 사진을 끌어 매트릭스로</span>
      </div>
      <div class="mx-tray" id="mx-tray">${tiles}</div>
    </div>
  `;
}

function _matrixHTML(mode){
  const cells = _cellEntries();
  // header row: corner + 5 colors
  let html = `
    <div class="mx-grid-wrap">
      <div class="mx-axis-x-label"><span class="han">舌色</span> 설질 →</div>
      <div class="mx-grid">
        <div></div>
        ${COLORS.map(c => `<div class="mx-th x" style="background:${c.dark?c.bg:'linear-gradient(180deg,#FAF1E0,#F0E0C0)'};color:${c.dark?'#FFE08A':'var(--mo)'}">
          <div class="han" style="color:${c.dark?'#FFE08A':c.accent}">${esc(c.han)}</div>
          <div>${esc(c.ko)}</div>
        </div>`).join('')}
  `;
  // data rows
  for(let y = 0; y < COATINGS.length; y++){
    const co = COATINGS[y];
    html += `<div class="mx-th y" style="background:${co.dark?co.bg:'linear-gradient(90deg,#FAF1E0,#F0E0C0)'};color:${co.dark?'#FFE08A':'var(--mo)'}">
              <div class="han" style="color:${co.dark?'#FFE08A':co.accent}">${esc(co.han)}</div>
              <div>${esc(co.ko)}</div>
            </div>`;
    for(let x = 0; x < COLORS.length; x++){
      const key = x + ',' + y;
      const entries = cells[key] || [];
      const placedHere = entries.filter(e => _state.placed[e.tid]);
      const countCls = ' count-' + Math.min(placedHere.length, 4);
      const thumbs = placedHere.map(e => {
        const t = _getTongueById(e.tid);
        if(!t) return '';
        return `<div class="mx-cell-thumb" data-tid="${e.tid}"><img src="${esc(t.img)}" alt=""></div>`;
      }).join('');
      const inner = placedHere.length
        ? `<div class="mx-cell-thumbs">${thumbs}</div>`
        : (mode === 'study' && entries.length ? `<span style="opacity:.4">${entries.length}</span>` : '');
      html += `<div class="mx-cell${placedHere.length?' filled':' empty'}${countCls}" data-x="${x}" data-y="${y}">${inner}</div>`;
    }
  }
  html += `</div></div>`;
  return html;
}

function _controlBar(){
  return `
    <div class="mx-ctrl">
      <button class="reset" type="button" id="mx-reset">↻ 초기화</button>
      <button class="toggle" type="button" id="mx-toggle">${_state.mode === 'place' ? '學 학습 보기' : '配 배치 모드'}</button>
      <button class="reveal" type="button" id="mx-reveal">정답 펼치기</button>
    </div>
    <div style="font-size:10.5px;color:var(--gutong);text-align:center;margin-top:6px;line-height:1.6">
      <b style="color:#C9A227">?</b> 표시 사진 = 교재 라벨에 둘 중 하나만 있고 변증으로 추정한 것 (參考).
    </div>
  `;
}

// ─── 5. UI: 학습 모드 (전체 펼침) ────────────────────────────────────
function _renderStudy(){
  const view = document.getElementById('view');
  if(!view) return;
  // 임시로 모든 entries 를 placed 로 보이게 처리 (state 는 건드리지 않고 view 만 채워서 렌더)
  const savedPlaced = _state.placed;
  const allPlaced = {};
  ENTRIES.forEach(e => { allPlaced[e.tid] = {x:e.color, y:e.coating}; });
  _state.placed = allPlaced;
  view.innerHTML = _styleBlock() + `
    <div class="mx-top">
      <div>
        <div class="ttl">舌色·舌苔 學習</div>
        <div class="sub">정답 매트릭스 — 셀의 사진을 눌러 상세 보기</div>
      </div>
      <button class="back" type="button" id="mx-back">← 동무의 방</button>
    </div>
  ` + _matrixHTML('study') + _controlBar();
  _state.placed = savedPlaced;
  _attachTopBar();
  _attachControlBar();
  _attachCellTaps();
}

// ─── 6. 이벤트 부착 ─────────────────────────────────────────────────────
function _attachTopBar(){
  const back = $('#mx-back');
  if(back) back.addEventListener('click', _quit);
}
function _attachControlBar(){
  const r = $('#mx-reset');
  if(r) r.addEventListener('click', () => {
    if(_state.attemptCount > 0 && !confirm('지금까지의 배치를 초기화할까요?')) return;
    _state = _newState();
    _render();
  });
  const t = $('#mx-toggle');
  if(t) t.addEventListener('click', () => {
    _state.mode = _state.mode === 'place' ? 'study' : 'place';
    _render();
  });
  const rv = $('#mx-reveal');
  if(rv) rv.addEventListener('click', () => {
    // 모든 entries 를 placed 로 채우고 attempt count 는 그대로 유지
    ENTRIES.forEach(e => {
      if(!_state.placed[e.tid]) _state.placed[e.tid] = {x:e.color, y:e.coating};
    });
    _state.completed = true;
    _render();
    toast('정답 매트릭스 펼쳤습니다','gold');
  });
}

function _attachCellTaps(){
  // 셀에 안착된 thumb 를 tap 하면 modal 로 상세
  $$('.mx-cell-thumb').forEach(th => {
    th.addEventListener('click', (e) => {
      e.stopPropagation();
      const tid = parseInt(th.dataset.tid, 10);
      _openDetailModal(tid);
    });
  });
}

function _openDetailModal(tid){
  const t = _getTongueById(tid);
  if(!t) return;
  const entry = ENTRIES.find(e => e.tid === tid);
  const co = COLORS[entry.color];
  const ca = COATINGS[entry.coating];
  const bg = document.createElement('div');
  bg.className = 'mx-modal-bg';
  bg.innerHTML = `
    <div class="mx-modal">
      <h4>
        <span>${('00'+t.id).slice(-2)}.</span>
        <span style="font-family:'ZCOOL XiaoWei',serif;color:${co.accent}">${esc(co.han)}</span>
        <span style="color:#999">·</span>
        <span style="font-family:'ZCOOL XiaoWei',serif;color:${ca.accent}">${esc(ca.han)}</span>
      </h4>
      <img class="pho" src="${esc(t.img)}" alt="${esc(t.han)}" title="클릭하여 확대">
      <div class="row"><b>${esc(t.label_full || t.han)}</b></div>
      <div class="row" style="color:var(--mo-l)">${esc(t.ko || '')}</div>
      ${t.pattern_han ? `<div class="row">辨證 · <b style="color:var(--feicui)">${esc(t.pattern_han)}</b> · ${esc(t.pattern || '')}</div>` : ''}
      ${t.notes ? `<div class="row" style="background:#FFF0C0;padding:6px 8px;border-radius:5px;margin-top:6px">${esc(t.notes)}</div>` : ''}
      ${t.page ? `<div class="row" style="color:var(--gutong);font-size:10.5px">교재 P.${esc(t.page)}</div>` : ''}
      ${entry.conf === 'inferred' ? `<div class="row" style="font-size:10px;color:#C9A227;margin-top:6px;font-style:italic">※ 색·태 중 한쪽은 변증으로 추정한 좌표</div>` : ''}
      <button class="close" type="button">닫기</button>
    </div>
  `;
  bg.addEventListener('click', (e) => {
    if(e.target === bg || e.target.classList.contains('close')) bg.remove();
  });
  // v11.6.0 patched: 사진 클릭 시 라이트박스 확대
  const photoEl = bg.querySelector('.pho');
  if(photoEl) photoEl.addEventListener('click', (e) => {
    e.stopPropagation();
    const cap = `${('00'+t.id).slice(-2)}. ${co.han}·${ca.han} — ${t.label_full || t.han}`;
    _openLightbox(t.img, cap);
  });
  document.body.appendChild(bg);
}

// v11.6.0 patched: 라이트박스 (사진 풀스크린 확대)
function _openLightbox(src, caption){
  // 이미 열려있으면 교체 (다중 layer 방지)
  const ex = document.querySelector('.mx-lightbox-bg');
  if(ex) ex.remove();
  const bg = document.createElement('div');
  bg.className = 'mx-lightbox-bg';
  bg.innerHTML = `
    <button class="mx-lb-close" type="button" aria-label="닫기">×</button>
    <img src="${esc(src)}" alt="${esc(caption||'')}">
    ${caption ? `<div class="mx-lb-cap">${esc(caption)}</div>` : ''}
  `;
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => {
    // 사진 자체를 클릭해도 닫힘 (zoom-out cursor)
    if(e.target.tagName !== 'BUTTON' || e.target.classList.contains('mx-lb-close')) close();
  });
  // ESC 로도 닫기
  const esc_h = (e) => { if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', esc_h); } };
  document.addEventListener('keydown', esc_h);
  document.body.appendChild(bg);
}

// ─── 7. 드래그-드롭 (Pointer Events) ────────────────────────────────────
function _attachDragSources(){
  $$('.mx-tile.draggable').forEach(tile => {
    tile.addEventListener('pointerdown', (e) => {
      // v11.6.0 patched: 확대 버튼 클릭은 드래그로 시작되지 않게 가드
      if(e.target && e.target.classList && e.target.classList.contains('mx-tile-zoom')) return;
      _startDrag(e, tile);
    });
  });
  // v11.6.0 patched: 우하단 ⤢ 버튼 → 라이트박스로 확대
  $$('.mx-tile-zoom').forEach(zb => {
    zb.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const tid = parseInt(zb.dataset.zoomTid, 10);
      const t = _getTongueById(tid);
      if(!t) return;
      const entry = ENTRIES.find(en => en.tid === tid);
      let cap = `${('00'+t.id).slice(-2)}. ${t.label_full || t.han}`;
      if(entry){
        const co = COLORS[entry.color]; const ca = COATINGS[entry.coating];
        if(co && ca) cap = `${('00'+t.id).slice(-2)}. ${co.han}·${ca.han} — ${t.label_full || t.han}`;
      }
      _openLightbox(t.img, cap);
    });
    // pointerdown 도 막아 drag 가 시작되지 않게
    zb.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
  });
}

function _startDrag(e, tile){
  e.preventDefault();
  const tid = parseInt(tile.dataset.tid, 10);
  const rect = tile.getBoundingClientRect();
  
  // ghost 생성
  const ghost = document.createElement('div');
  ghost.className = 'mx-ghost';
  const img = tile.querySelector('img');
  ghost.innerHTML = `<img src="${img.src}" alt="">`;
  document.body.appendChild(ghost);
  
  const offX = e.clientX - rect.left;
  const offY = e.clientY - rect.top;
  const place = (cx, cy) => {
    ghost.style.left = (cx - offX) + 'px';
    ghost.style.top  = (cy - offY) + 'px';
  };
  place(e.clientX, e.clientY);
  
  tile.classList.add('dragging');
  
  let lastHoverCell = null;
  
  const onMove = (ev) => {
    ev.preventDefault();
    place(ev.clientX, ev.clientY);
    // hover cell 갱신
    ghost.style.display = 'none';
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    ghost.style.display = '';
    const cell = el && el.closest && el.closest('.mx-cell');
    if(cell !== lastHoverCell){
      if(lastHoverCell) lastHoverCell.classList.remove('hover-target');
      if(cell) cell.classList.add('hover-target');
      lastHoverCell = cell;
    }
  };
  const onUp = (ev) => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if(lastHoverCell) lastHoverCell.classList.remove('hover-target');
    tile.classList.remove('dragging');
    
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const cell = el && el.closest && el.closest('.mx-cell');
    
    // ghost 제거 (cell 위에 안 놓이면 부드럽게 fade-out, 놓이면 즉시)
    if(cell){
      ghost.remove();
      _attemptDrop(tid, cell);
    } else {
      // 매트릭스 밖 → ghost 가 원래 위치로 돌아가는 애니메이션
      ghost.style.transition = 'left .25s ease, top .25s ease, opacity .25s ease';
      ghost.style.left = rect.left + 'px';
      ghost.style.top  = rect.top + 'px';
      ghost.style.opacity = '0';
      setTimeout(() => ghost.remove(), 280);
    }
  };
  
  document.addEventListener('pointermove', onMove, {passive:false});
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

function _attemptDrop(tid, cell){
  const entry = ENTRIES.find(e => e.tid === tid);
  if(!entry) return;
  const x = parseInt(cell.dataset.x, 10);
  const y = parseInt(cell.dataset.y, 10);
  _state.attemptCount++;
  const correct = (x === entry.color && y === entry.coating);
  if(correct){
    _state.correctCount++;
    _state.placed[tid] = {x, y};
    cell.classList.remove('flash-correct'); void cell.offsetWidth; cell.classList.add('flash-correct');
    // 햅틱
    try{ navigator.vibrate && navigator.vibrate(15); }catch(_){}
    setTimeout(() => _render(), 480);
  } else {
    _state.attempts[tid] = (_state.attempts[tid] || 0) + 1;
    cell.classList.remove('flash-wrong'); void cell.offsetWidth; cell.classList.add('flash-wrong');
    // 정답 cell hint (1.5초 후 잠시 깜빡)
    setTimeout(() => {
      const target = $(`.mx-cell[data-x="${entry.color}"][data-y="${entry.coating}"]`);
      if(target){
        target.classList.remove('flash-correct'); void target.offsetWidth; target.classList.add('flash-correct');
      }
    }, 820);
    try{ navigator.vibrate && navigator.vibrate([30, 50, 30]); }catch(_){}
  }
}

// ─── 8. 완료 배너 ───────────────────────────────────────────────────────
function _showCompletionBanner(){
  const dur = Math.round((Date.now() - _state.startedAt) / 1000);
  const m = Math.floor(dur / 60), s = dur % 60;
  const efficiency = _state.attemptCount > 0
    ? Math.round(_state.correctCount / _state.attemptCount * 100)
    : 100;
  
  // v11.5: 통계 후크 — 매트릭스 완료 시 DongmuStats 에 기록.
  //   total = 시도 횟수, correct = 정답 안착 수. wrongDetails 는 ENTRIES 별로
  //   시도 카운트 기반으로 합성 (오답을 정확히 추적하지 않으므로 단순 표현).
  try{
    if(window.DongmuStats && window.DongmuStats.record){
      const wrongDetails = [];
      Object.entries(_state.attempts).forEach(([tid, attempts]) => {
        // attempts 횟수만큼 오답 push (변증별 weakness 집계용)
        for(let i = 0; i < attempts; i++) wrongDetails.push({tongueId: parseInt(tid,10), correct: false});
      });
      // 정답 안착도 push
      Object.keys(_state.placed).forEach(tid => {
        wrongDetails.push({tongueId: parseInt(tid,10), correct: true});
      });
      window.DongmuStats.record('duiwei', 'all', _state.attemptCount, _state.correctCount, wrongDetails, dur);
    }
  }catch(e){ console.warn('matrix stats fail', e); }
  
  const overlay = document.createElement('div');
  overlay.className = 'mx-done-overlay';
  const card = document.createElement('div');
  card.className = 'mx-done';
  card.innerHTML = `
    <div class="han">滿陣</div>
    <div class="ko">전 매트릭스 배치 완료</div>
    <div class="stats">
      배치 ${_state.correctCount}장 · 시도 ${_state.attemptCount}회<br>
      정확도 <b style="color:#fff">${efficiency}%</b> · ${m}분 ${s}초
    </div>
    <button type="button" id="mx-done-close">계속 보기</button>
  `;
  const close = () => { overlay.remove(); card.remove(); };
  overlay.addEventListener('click', close);
  document.body.appendChild(overlay);
  document.body.appendChild(card);
  setTimeout(() => {
    const b = document.getElementById('mx-done-close');
    if(b) b.addEventListener('click', close);
  }, 50);
}

function _quit(){
  _state = null;
  if(typeof window.renderDongmuHome === 'function') window.renderDongmuHome();
  else if(typeof window.setTab === 'function') window.setTab('dongmu');
}

// ─── 9. 외부 API ────────────────────────────────────────────────────────
window.V11Matrix = {
  open,
  openStudy,    // v11.6.0 patched: 「전부다」 (정답 매트릭스 일괄 표시)
  ENTRIES,
  COLORS,
  COATINGS,
};

})();
