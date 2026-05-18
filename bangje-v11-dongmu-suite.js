/* bangje-v11-dongmu-suite.js — 동무의 방 풀스택 v11.5
 * ============================================================================
 *  방제학(神農之房) 의 tile-grid 동선을 진단학(東武之房) 에 그대로 이식.
 *
 *   • DongmuStats           — localStorage 누적 통계 (세션·변증별·오답)
 *   • renderDongmuSuite()   — 방제학 home 스타일 카드 그리드 (頂層 진입)
 *   • renderStatsAnalytics() — 析究 페이지 (정답률·오답·변증·세션 history)
 *   • renderFlashcards()    — 暗誦 플래시카드 (뒤집기 + 어려움 평가)
 *   • renderPlaceholder()   — 體質·辨證·業績 (구축 예정)
 *
 *  통계 후크: jindan.js 의 _renderResults / matrix.js 의 _showCompletionBanner
 *    가 호출할 수 있도록 window.DongmuStats.record(...) 외부 API.
 *
 *  Hub 등록: window.renderDongmuHome 을 본 모듈로 덮어씀 (jindan 의 expandDongmuHome
 *    위에). 「← 동무의 방」 백 버튼 클릭 시 다시 본 home 으로 회귀.
 * ============================================================================ */

(function(){
'use strict';

function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }

// ════ 0. STATS 데이터 레이어 ══════════════════════════════════════════════
const STATS_KEY = 'dongmu.stats.v1';

function _statsEmpty(){
  return {
    sessions: [],                   // [{mode, range, total, correct, dur, ts}]  최근 100개
    wrong:    {},                   // { [tid]: {count, lastTs} }
    byPattern:{},                   // { [pat_han]: {asked, correct} }
    byMode:   {},                   // { [mode]: {asked, correct, sessions} }
    days:     {},                   // { [YYYYMMDD]: {asked, correct} }  학습일 추적
    firstTs:  Date.now(),
  };
}
function _statsLoad(){
  try{
    const raw = localStorage.getItem(STATS_KEY);
    if(!raw) return _statsEmpty();
    const d = JSON.parse(raw);
    // 누락 필드 보강 (스키마 추가/마이그레이션 대비)
    const e = _statsEmpty();
    return Object.assign(e, d || {});
  }catch(_){ return _statsEmpty(); }
}
function _statsSave(d){
  try{ localStorage.setItem(STATS_KEY, JSON.stringify(d)); }catch(_){}
}
function _ymdKey(ts){
  const dt = new Date(ts);
  return dt.getFullYear() + String(dt.getMonth()+1).padStart(2,'0') + String(dt.getDate()).padStart(2,'0');
}

/**
 * 세션 결과 기록.
 *   mode  : 'mcq' | 'subjective' | 'drill' | 'duiwei' | 'flash'
 *   range : 'body' | 'quality' | 'all' | (matrix는 미지정)
 *   total, correct : 정답 카운트
 *   wrongDetails  : [{tongueId, correct, ...}] — pattern 집계용 (선택)
 *   dur   : 소요 초 (선택)
 */
function statsRecord(mode, range, total, correct, wrongDetails, dur){
  if(!total) return;
  const d = _statsLoad();
  const ts = Date.now();
  d.sessions.unshift({mode, range: range||'all', total, correct, dur: dur||0, ts});
  if(d.sessions.length > 200) d.sessions.length = 200;
  // by mode
  d.byMode[mode] = d.byMode[mode] || {asked:0, correct:0, sessions:0};
  d.byMode[mode].asked    += total;
  d.byMode[mode].correct  += correct;
  d.byMode[mode].sessions += 1;
  // by day
  const dk = _ymdKey(ts);
  d.days[dk] = d.days[dk] || {asked:0, correct:0};
  d.days[dk].asked   += total;
  d.days[dk].correct += correct;
  // by pattern + wrong tracking
  if(Array.isArray(wrongDetails)){
    wrongDetails.forEach(h => {
      const t = (window.TONGUE_BY_ID || {})[h.tongueId];
      const pat = t && t.pattern_han;
      if(pat){
        d.byPattern[pat] = d.byPattern[pat] || {asked:0, correct:0};
        d.byPattern[pat].asked++;
        if(h.correct) d.byPattern[pat].correct++;
      }
      if(!h.correct){
        d.wrong[h.tongueId] = d.wrong[h.tongueId] || {count:0, lastTs:0};
        d.wrong[h.tongueId].count++;
        d.wrong[h.tongueId].lastTs = ts;
      }
    });
  }
  _statsSave(d);
}
function statsReset(){
  if(!confirm('진단학 통계를 모두 초기화할까요? (오답 추적·세션 기록 全 삭제)')) return;
  _statsSave(_statsEmpty());
  toast('통계 초기화 완료','gold');
}

window.DongmuStats = {
  record: statsRecord,
  reset:  statsReset,
  load:   _statsLoad,
};

// ════ 1. 시험 D-N 계산 ════════════════════════════════════════════════════
const EXAMS = [
  { han:'設體', ko:'설체', iso:'2026-05-19T00:00:00+09:00', range:'body',
    desc:'形·態 — 胖大·瘦薄·齒痕·點刺·裂紋·偏·鏡面·瘀斑' },
  { han:'設質', ko:'설질', iso:'2026-05-26T00:00:00+09:00', range:'quality',
    desc:'神色 + 苔 — 淡白·紅·絳·紫 / 苔色苔質' },
];
function _daysUntil(iso){
  const d = (new Date(iso)).getTime();
  if(!isFinite(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}

// ════ 2. HOME — 방제학 tile-grid 그대로 ═══════════════════════════════════
function renderDongmuSuite(){
  const view = document.getElementById('view');
  if(!view) return;
  
  const stats = _statsLoad();
  const totAsked = Object.values(stats.byMode).reduce((s,m)=>s+(m.asked||0), 0);
  const totCorr  = Object.values(stats.byMode).reduce((s,m)=>s+(m.correct||0), 0);
  const accuracy = totAsked ? Math.round(totCorr/totAsked*100) : null;
  const ndays = Object.keys(stats.days).length;
  
  // 시험 D-N 카드 (1순위)
  const examCards = EXAMS.map(e => {
    const d = _daysUntil(e.iso);
    const urgent = d !== null && d >= 0 && d <= 3;
    const past   = d !== null && d < 0;
    const bg = past   ? 'linear-gradient(135deg,#7A4A40,#5C2828)'
            : urgent ? 'linear-gradient(135deg,#9C3030,#6E1818)'
            :          'linear-gradient(135deg,#A85838,#7A2828)';
    const ddayTxt = d === null ? '?' : (d > 0 ? `D-${d}` : (d === 0 ? 'D-Day' : `D+${-d}`));
    return `
      <div class="dms-exam" style="background:${bg}">
        <div class="dms-exam-l">
          <div class="dms-exam-han">${esc(e.han)}</div>
          <div class="dms-exam-ko">${esc(e.ko)} 試</div>
        </div>
        <div class="dms-exam-c">
          <div class="dms-exam-desc">${esc(e.desc)}</div>
        </div>
        <div class="dms-exam-r">
          <div class="dms-exam-dday">${ddayTxt}</div>
        </div>
      </div>
    `;
  }).join('');
  
  // 누적 통계 미니 카드
  const summary = totAsked > 0 ? `
    <div class="dms-summary">
      <div class="dms-sum-item"><div class="v">${accuracy}<span>%</span></div><div class="k">정답률</div></div>
      <div class="dms-sum-item"><div class="v">${totAsked}</div><div class="k">총 문항</div></div>
      <div class="dms-sum-item"><div class="v">${ndays}</div><div class="k">학습 일수</div></div>
      <div class="dms-sum-item"><div class="v">${Object.keys(stats.wrong).length}</div><div class="k">오답 사진</div></div>
    </div>
  ` : `
    <div class="dms-summary dms-empty">
      <div style="text-align:center;flex:1;color:#FFE08A;font-size:11.5px;padding:8px 0">
        아직 학습 기록이 없습니다. 對位·問答·暗誦 어느 카드든 진입하여 시작 →
      </div>
    </div>
  `;
  
  view.innerHTML = `
    <style>
      .dms-banner {
        background:linear-gradient(135deg,#9C3030,#6E1818);
        color:#FFE08A; padding:14px 14px 12px; border-radius:11px; margin-bottom:10px;
        display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(60,12,12,.3);
      }
      .dms-banner-medal { width:60px; height:60px; border-radius:50%; overflow:hidden; flex-shrink:0;
                          box-shadow:0 2px 8px rgba(0,0,0,.32); }
      .dms-banner-medal .cmedal, .dms-banner-medal img { width:100%; height:100%; }
      .dms-banner-title { font-family:'ZCOOL XiaoWei',serif; font-size:22px; letter-spacing:.06em; }
      .dms-banner-sub { font-size:11px; opacity:.88; margin-top:2px; letter-spacing:.04em; }
      .dms-back { background:transparent; border:1px solid #FFE08A; color:#FFE08A;
                  padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; margin-left:auto; }
      .dms-back:hover { background:rgba(255,224,138,.12); }
      
      .dms-exams { display:grid; grid-template-columns:1fr; gap:6px; margin-bottom:10px; }
      .dms-exam { display:flex; align-items:center; padding:9px 12px; border-radius:9px; color:#FFE08A;
                  box-shadow:0 3px 8px rgba(60,12,12,.22); gap:10px; }
      .dms-exam-l { text-align:center; flex-shrink:0; }
      .dms-exam-han { font-family:'ZCOOL XiaoWei',serif; font-size:22px; line-height:1; letter-spacing:.05em; }
      .dms-exam-ko { font-size:10px; opacity:.82; margin-top:2px; }
      .dms-exam-c { flex:1; font-size:10.5px; opacity:.92; line-height:1.45; padding:0 4px; }
      .dms-exam-desc { font-size:10.5px; }
      .dms-exam-r { font-family:var(--font-display); font-size:18px; font-weight:700; flex-shrink:0;
                    padding:4px 8px; background:rgba(255,224,138,.16); border-radius:6px; letter-spacing:.04em; }
      
      .dms-summary { display:grid; grid-template-columns:repeat(4,1fr); gap:5px;
                      background:linear-gradient(135deg,#3A1810,#2A1008); padding:10px 8px;
                      border-radius:9px; margin-bottom:12px; }
      .dms-summary.dms-empty { display:flex; padding:4px 8px; }
      .dms-sum-item { text-align:center; }
      .dms-sum-item .v { font-family:'ZCOOL XiaoWei',serif; color:#FFE08A; font-size:21px; line-height:1; }
      .dms-sum-item .v span { font-size:13px; opacity:.78; }
      .dms-sum-item .k { font-size:10px; color:#C9A227; margin-top:3px; letter-spacing:.04em; }
      
      .dms-group-title { font-family:var(--font-display); font-size:12.5px; color:var(--zhusha-d);
                          margin:14px 0 6px; display:flex; align-items:center; gap:6px; letter-spacing:.04em; }
      .dms-group-title:before, .dms-group-title:after {
        content:''; flex:1; height:1px; background:linear-gradient(to right, transparent, #9C303055, transparent); }
      
      /* 카드 — 방제학 .tile 활용, 진단학 강조색 (朱砂赤) */
      .dms-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:9px; margin-bottom:10px; }
      .dms-tile {
        position:relative; background:var(--mi-w); border:1px solid #C9A22755;
        border-left:3px solid #9C3030;
        border-radius:9px; padding:11px 11px 10px; cursor:pointer; transition:transform .14s ease, box-shadow .14s ease;
        font-family:inherit; text-align:left; color:var(--mo);
        display:flex; flex-direction:column;
      }
      .dms-tile:hover { transform:translateY(-1px); box-shadow:0 5px 12px rgba(60,12,12,.18); }
      .dms-tile:active { transform:translateY(0); }
      .dms-tile .han { font-family:'Noto Serif SC',serif; font-size:18px; color:#9C3030; letter-spacing:.05em; font-weight:700; }
      .dms-tile .ttl { font-size:13px; font-weight:700; color:var(--mo); margin-top:1px; }
      .dms-tile .desc { font-size:11px; color:var(--mo-l); margin-top:3px; line-height:1.42; }
      .dms-tile.featured {
        background:linear-gradient(135deg,#FFF8E0,#FFE0B0);
        border-color:#C9A227; border-left:3px solid #C9A227;
        grid-column:1 / -1;
      }
      .dms-tile.featured .han { color:#7A1818; font-size:20px; }
      .dms-tile.placeholder {
        opacity:.62; border-left-color:#7A4A40; background:#FAF1E0;
      }
      .dms-tile .new-badge {
        display:inline-block; font-size:9px; background:#C9A227; color:#3A1810;
        padding:1px 5px; border-radius:3px; font-weight:800; margin-left:5px; letter-spacing:.04em;
        vertical-align:middle;
      }
      .dms-tile .preparing {
        position:absolute; right:7px; top:7px; font-size:9px; background:#7A4A40; color:#FFE08A;
        padding:1px 5px; border-radius:3px; letter-spacing:.04em;
      }
    </style>
    
    <!-- 배너 -->
    <div class="dms-banner">
      <div class="dms-banner-medal">${_medalSafe('leejema', 60)}</div>
      <div style="flex:1">
        <div class="dms-banner-title">東武之房</div>
        <div class="dms-banner-sub"><span style="font-family:'Noto Serif SC',serif">診斷學</span> · 진단학 · 李濟馬 主</div>
      </div>
      <button class="dms-back" type="button" id="dms-back">← 醫書宮</button>
    </div>
    
    <!-- 시험 D-N -->
    <div class="dms-exams">${examCards}</div>
    
    <!-- 누적 통계 -->
    ${summary}
    
    <!-- 학습 카드 -->
    <div class="dms-group-title">學 · 학습 도구</div>
    <div class="dms-grid">
      <button class="dms-tile featured" type="button" data-act="duiwei">
        <span class="han">對位 · 設色×設苔 매트릭스<span class="new-badge">★ 5/26</span></span>
        <span class="ttl">설질·설태 좌표 끌어다 학습세트</span>
        <span class="desc">5×5 매트릭스에 사진을 끌어다 놓아 색·태 동시 학습. 24장 ENTRIES.</span>
      </button>
      <button class="dms-tile" type="button" data-act="mcq">
        <span class="han">問答</span>
        <span class="ttl">객관식 4지선다</span>
        <span class="desc">사진 보고 設體/舌色/苔/辨證 — 즉시 채점 + 해설</span>
      </button>
      <button class="dms-tile" type="button" data-act="flash">
        <span class="han">暗誦<span class="new-badge">NEW</span></span>
        <span class="ttl">플래시카드</span>
        <span class="desc">사진 → 라벨 뒤집기. 어려움/보통/쉬움 평가로 노출 빈도 조정</span>
      </button>
      <button class="dms-tile" type="button" data-act="subjective">
        <span class="han">主觀</span>
        <span class="ttl">주관식 직접 입력</span>
        <span class="desc">한자/한글 모두 인정. 시험 직전 한자 표기 연습용</span>
      </button>
      <button class="dms-tile" type="button" data-act="drill">
        <span class="han">速習</span>
        <span class="ttl">드릴 (자동 진행)</span>
        <span class="desc">객관식 + 빠른 진행. 노출 빈도 우선</span>
      </button>
      <button class="dms-tile" type="button" data-act="gallery">
        <span class="han">圖鑑</span>
        <span class="ttl">사진첩 (48장)</span>
        <span class="desc">라벨 토글로 처음엔 가린 채 추측 → 검증</span>
      </button>
    </div>
    
    <!-- 분석·기타 -->
    <div class="dms-group-title">析 · 분석 / 기타</div>
    <div class="dms-grid">
      <button class="dms-tile" type="button" data-act="stats">
        <span class="han">析究<span class="new-badge">NEW</span></span>
        <span class="ttl">통계·분석</span>
        <span class="desc">모드별·변증별 정답률 · 자주 틀리는 사진 · 세션 history</span>
      </button>
      <button class="dms-tile placeholder" type="button" data-act="prep-cheju">
        <span class="han">體質<span class="preparing">準備</span></span>
        <span class="ttl">사상의학 체질</span>
        <span class="desc">太陽·少陽·太陰·少陰人 — 4체질 진단·처방 (구축 예정)</span>
      </button>
      <button class="dms-tile placeholder" type="button" data-act="prep-byeon">
        <span class="han">辨證<span class="preparing">準備</span></span>
        <span class="ttl">변증 체계</span>
        <span class="desc">八綱·氣血津液·臟腑·六經·衛氣營血 — 변증 학습 (구축 예정)</span>
      </button>
      <button class="dms-tile placeholder" type="button" data-act="prep-yeop">
        <span class="han">業績<span class="preparing">準備</span></span>
        <span class="ttl">진단학 업적·인장</span>
        <span class="desc">진단학 전용 업적 (방제학과 별도). 시험 후 출시.</span>
      </button>
    </div>
    
    <div style="font-size:10.5px;color:var(--mo-l);text-align:center;margin:10px 0 4px;line-height:1.6">
      구축 단계 — v11.5 (1차 풀스택). 시험 후 멀티 對決·SRS 본격 추가.
    </div>
  `;
  
  // 이벤트 부착
  const back = $('#dms-back');
  if(back) back.addEventListener('click', () => { if(window.setTab) window.setTab('hub'); });
  $$('.dms-tile').forEach(b => {
    b.addEventListener('click', () => _route(b.dataset.act));
  });
}

// 라우터 — 카드 클릭 핸들
function _route(act){
  switch(act){
    case 'duiwei':
      if(window.V11Matrix && window.V11Matrix.open) window.V11Matrix.open();
      else toast('對位 모듈 미로드','warn');
      break;
    case 'mcq': case 'subjective': case 'drill':
      _askRange(act);
      break;
    case 'gallery':
      _askRange('gallery');
      break;
    case 'flash':
      _askRange('flash');
      break;
    case 'stats':
      renderStatsAnalytics();
      break;
    case 'prep-cheju':
      _placeholderModal('體質', '사상의학 체질', '東武 李濟馬 — 太陽·少陽·太陰·少陰人 4체질 진단·처방 시스템. 강의 자료 주입 후 1차 구축 예정.');
      break;
    case 'prep-byeon':
      _placeholderModal('辨證', '변증 체계', '八綱·氣血津液·臟腑·六經·衛氣營血·三焦 — 변증별 사진 매핑·문항 시스템. 5/26 설질 시험 후 본격 구축.');
      break;
    case 'prep-yeop':
      _placeholderModal('業績', '진단학 업적', '진단학 전용 업적·인장 (방제학과 별도 추적). 시험 후 출시 예정.');
      break;
  }
}

// 범위 선택 모달 → 모드 시작
function _askRange(mode){
  const examMap = { body:'5/19 設體', quality:'5/26 設質', all:'통합 (48장)' };
  const html = `
    <div style="background:#FAF1E0;padding:16px;border-radius:10px;max-width:300px">
      <h3 style="margin:0 0 10px;font-family:'Noto Serif SC',serif;color:var(--zhusha-d);font-size:15px">
        ${esc(_modeHan(mode))} · 범위 선택
      </h3>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${['body','quality','all'].map(r => `
          <button class="btn" type="button" data-r="${r}" style="text-align:left;padding:9px 11px">
            <b>${examMap[r]}</b>
            <div style="font-size:10.5px;color:var(--mo-l);margin-top:2px">${_rangeCount(r)}장</div>
          </button>
        `).join('')}
        <button class="btn btn-o" type="button" id="dms-range-cancel" style="margin-top:4px">취소</button>
      </div>
    </div>
  `;
  _openSimpleModal(html, (root) => {
    root.querySelectorAll('button[data-r]').forEach(b => {
      b.addEventListener('click', () => {
        const r = b.dataset.r;
        _closeSimpleModal();
        _launchMode(mode, r);
      });
    });
    const cx = root.querySelector('#dms-range-cancel');
    if(cx) cx.addEventListener('click', _closeSimpleModal);
  });
}
function _modeHan(m){ return ({mcq:'問答', subjective:'主觀', drill:'速習', gallery:'圖鑑', flash:'暗誦'})[m] || m; }
function _rangeCount(r){
  if(!window.tonguesForMode) return 48;
  try{ return window.tonguesForMode(r).length; }catch(_){ return 48; }
}

function _launchMode(mode, range){
  if(mode === 'gallery'){
    if(window.V11Jindan && window.V11Jindan.openGallery) window.V11Jindan.openGallery(range);
    return;
  }
  if(mode === 'flash'){
    renderFlashcards(range);
    return;
  }
  if(window.V11Jindan && window.V11Jindan.start){
    window.V11Jindan.start(mode, range);
  } else {
    toast('jindan 모듈 미로드','warn');
  }
}

// 가벼운 modal 헬퍼 (app.js 의 openModal 이 있으면 그것, 없으면 자체 구현)
let _dmsModal = null;
function _openSimpleModal(html, onMount){
  _closeSimpleModal();
  const bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;background:rgba(20,8,4,.55);z-index:9994;display:flex;align-items:center;justify-content:center;padding:20px';
  bg.addEventListener('click', (e) => { if(e.target === bg) _closeSimpleModal(); });
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  bg.appendChild(wrap);
  document.body.appendChild(bg);
  _dmsModal = bg;
  if(onMount) setTimeout(() => onMount(wrap), 10);
}
function _closeSimpleModal(){
  if(_dmsModal){ _dmsModal.remove(); _dmsModal = null; }
}
function _placeholderModal(han, ko, body){
  _openSimpleModal(`
    <div style="background:#FAF1E0;padding:16px;border-radius:10px;max-width:300px;border:1px solid #7A4A40">
      <h3 style="margin:0 0 4px;font-family:'Noto Serif SC',serif;color:#7A4A40;font-size:18px">${esc(han)}</h3>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:8px">${esc(ko)}</div>
      <div style="font-size:11.5px;color:var(--mo);line-height:1.65;margin-bottom:10px">${esc(body)}</div>
      <button class="btn" type="button" id="dms-plc-close" style="width:100%">알겠습니다</button>
    </div>
  `, (root) => {
    const cx = root.querySelector('#dms-plc-close');
    if(cx) cx.addEventListener('click', _closeSimpleModal);
  });
}

function _medalSafe(id, size){
  if(typeof window._charPhotoMedallion === 'function') return window._charPhotoMedallion(id, size);
  if(typeof window._charMedallion === 'function') return window._charMedallion(id, size);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#9C3030;color:#FFE08A;display:flex;align-items:center;justify-content:center;font-family:'ZCOOL XiaoWei',serif">李</div>`;
}

// ════ 3. 析究 (통계·분석) 페이지 ══════════════════════════════════════════
function renderStatsAnalytics(){
  const view = document.getElementById('view');
  if(!view) return;
  const d = _statsLoad();
  
  const totAsked = Object.values(d.byMode).reduce((s,m)=>s+(m.asked||0), 0);
  const totCorr  = Object.values(d.byMode).reduce((s,m)=>s+(m.correct||0), 0);
  const totSess  = Object.values(d.byMode).reduce((s,m)=>s+(m.sessions||0), 0);
  const accuracy = totAsked ? Math.round(totCorr/totAsked*100) : 0;
  const ndays = Object.keys(d.days).length;
  
  // 모드별 정답률 막대
  const modeLabels = {mcq:'問答', subjective:'主觀', drill:'速習', duiwei:'對位', flash:'暗誦'};
  const modeRows = Object.entries(d.byMode)
    .filter(([k,v]) => v.asked > 0)
    .sort((a,b) => b[1].asked - a[1].asked)
    .map(([k,v]) => {
      const acc = Math.round(v.correct/v.asked*100);
      return `
        <div class="dms-bar-row">
          <div class="dms-bar-lbl"><span class="han">${esc(modeLabels[k]||k)}</span> <span class="ko">${esc(k)}</span></div>
          <div class="dms-bar"><div class="dms-bar-fill" style="width:${acc}%"></div></div>
          <div class="dms-bar-pct">${acc}<small>%</small></div>
          <div class="dms-bar-n">${v.correct}/${v.asked}</div>
        </div>
      `;
    }).join('');
  
  // 변증별 정답률 (asked >= 3 인 것만)
  const patternRows = Object.entries(d.byPattern)
    .filter(([k,v]) => v.asked >= 3)
    .sort((a,b) => (a[1].correct/a[1].asked) - (b[1].correct/b[1].asked))
    .slice(0, 8)
    .map(([k,v]) => {
      const acc = Math.round(v.correct/v.asked*100);
      const isWeak = acc < 60;
      return `
        <div class="dms-bar-row">
          <div class="dms-bar-lbl"><span class="han" style="${isWeak?'color:#9C3030':''}">${esc(k)}</span></div>
          <div class="dms-bar"><div class="dms-bar-fill" style="width:${acc}%; background:${isWeak?'linear-gradient(90deg,#9C3030,#6E1818)':'linear-gradient(90deg,#C9A227,#A07020)'}"></div></div>
          <div class="dms-bar-pct">${acc}<small>%</small></div>
          <div class="dms-bar-n">${v.correct}/${v.asked}</div>
        </div>
      `;
    }).join('');
  
  // 자주 틀리는 사진 top 8
  const wrongList = Object.entries(d.wrong)
    .sort((a,b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([tid, w]) => {
      const t = (window.TONGUE_BY_ID || {})[tid];
      if(!t) return '';
      return `
        <div class="dms-wcell" data-tid="${esc(tid)}">
          <img src="${esc(t.img)}" alt="">
          <div class="dms-wcnt">×${w.count}</div>
          <div class="dms-wlbl">${esc(t.han || ('t'+tid))}</div>
          <div class="dms-wpat">${esc(t.pattern_han || '')}</div>
        </div>
      `;
    }).join('');
  
  // 최근 세션 10개
  const sessRows = d.sessions.slice(0, 10).map(s => {
    const acc = Math.round(s.correct/s.total*100);
    const dt = new Date(s.ts);
    const lbl = `${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    return `
      <div class="dms-sess-row">
        <span class="dms-sess-han">${esc(modeLabels[s.mode]||s.mode)}</span>
        <span class="dms-sess-rng">${esc(({body:'設體',quality:'設質',all:'全'})[s.range]||s.range||'')}</span>
        <span class="dms-sess-acc" style="color:${acc>=80?'#2A7060':acc>=60?'#C9A227':'#9C3030'}">${acc}%</span>
        <span class="dms-sess-n">${s.correct}/${s.total}</span>
        <span class="dms-sess-ts">${lbl}</span>
      </div>
    `;
  }).join('');
  
  view.innerHTML = `
    <style>
      .dms-st-top { display:flex; align-items:center; gap:8px; margin-bottom:10px; padding:9px 11px;
                     background:linear-gradient(135deg,#9C3030,#6E1818); color:#FFE08A; border-radius:9px;
                     box-shadow:0 3px 8px rgba(60,12,12,.22); }
      .dms-st-top .han { font-family:'ZCOOL XiaoWei',serif; font-size:22px; letter-spacing:.06em; }
      .dms-st-top .sub { font-size:10.5px; opacity:.85; margin-top:1px; }
      .dms-st-top .back { margin-left:auto; background:transparent; border:1px solid #FFE08A; color:#FFE08A;
                          padding:4px 9px; border-radius:6px; font-size:11px; cursor:pointer; }
      .dms-st-top .reset { background:#FFE08A22; border:1px solid #FFE08A55; color:#FFE08A;
                            padding:4px 9px; border-radius:6px; font-size:10.5px; cursor:pointer; }
      
      .dms-st-summary { display:grid; grid-template-columns:repeat(4,1fr); gap:5px;
                         background:#FAF1E0; padding:11px 8px; border-radius:9px; margin-bottom:12px;
                         border:1px solid #C9A22755; }
      .dms-st-sum-item { text-align:center; }
      .dms-st-sum-item .v { font-family:'ZCOOL XiaoWei',serif; color:var(--zhusha-d); font-size:24px; line-height:1; }
      .dms-st-sum-item .v span { font-size:14px; opacity:.78; }
      .dms-st-sum-item .k { font-size:10px; color:var(--mo-l); margin-top:3px; letter-spacing:.04em; }
      
      .dms-st-block { background:#fff; border:1px solid #C9A22755; border-radius:9px; padding:11px;
                       margin-bottom:10px; }
      .dms-st-block h4 { margin:0 0 8px; font-family:'Noto Serif SC',serif; font-size:13.5px;
                          color:var(--zhusha-d); display:flex; align-items:center; gap:5px; }
      .dms-st-block h4 small { font-size:10.5px; color:var(--mo-l); font-weight:normal; }
      .dms-st-empty { font-size:11px; color:var(--mo-l); padding:14px 0; text-align:center; font-style:italic; }
      
      .dms-bar-row { display:grid; grid-template-columns:64px 1fr 36px 56px; gap:6px;
                      align-items:center; padding:3px 0; font-size:11px; }
      .dms-bar-lbl .han { font-family:'Noto Serif SC',serif; font-weight:700; color:var(--zhusha-d); font-size:13px; }
      .dms-bar-lbl .ko { color:var(--mo-l); font-size:9.5px; }
      .dms-bar { height:8px; background:#F0E0C8; border-radius:4px; overflow:hidden; }
      .dms-bar-fill { height:100%; background:linear-gradient(90deg,#C9A227,#9C3030); border-radius:4px; }
      .dms-bar-pct { font-family:var(--font-display); font-weight:700; color:var(--zhusha-d); font-size:12px; text-align:right; }
      .dms-bar-pct small { font-size:9.5px; opacity:.75; }
      .dms-bar-n { font-size:10px; color:var(--mo-l); text-align:right; }
      
      .dms-wgrid { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; }
      @media (max-width:480px){ .dms-wgrid { grid-template-columns:repeat(3,1fr); } }
      .dms-wcell { background:#FFF8E8; border:1px solid #9C303033; border-radius:6px; padding:4px;
                    text-align:center; cursor:pointer; position:relative; }
      .dms-wcell:hover { background:#FFF0D0; border-color:#9C3030; }
      .dms-wcell img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:4px; }
      .dms-wcnt { position:absolute; top:5px; right:5px; background:#9C3030; color:#FFE08A;
                   font-family:var(--font-display); font-size:10px; padding:1px 5px; border-radius:3px; font-weight:700; }
      .dms-wlbl { font-family:'Noto Serif SC',serif; font-weight:700; font-size:11px; margin-top:3px;
                   white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .dms-wpat { font-size:9.5px; color:var(--mo-l); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      
      .dms-sess-row { display:grid; grid-template-columns:42px 32px 38px 50px 1fr;
                       gap:5px; align-items:center; padding:4px 0; font-size:11px;
                       border-bottom:1px dashed #C9A22744; }
      .dms-sess-row:last-child { border-bottom:0; }
      .dms-sess-han { font-family:'Noto Serif SC',serif; font-weight:700; color:var(--zhusha-d); font-size:13px; }
      .dms-sess-rng { font-family:'Noto Serif SC',serif; font-size:10.5px; color:var(--gutong); }
      .dms-sess-acc { font-family:var(--font-display); font-weight:700; text-align:right; }
      .dms-sess-n { font-size:10px; color:var(--mo-l); text-align:right; }
      .dms-sess-ts { font-size:10px; color:var(--mo-l); text-align:right; }
    </style>
    
    <div class="dms-st-top">
      <div>
        <div class="han">析究</div>
        <div class="sub">진단학 학습 통계·분석</div>
      </div>
      <button class="reset" type="button" id="dms-st-reset">↻ 초기화</button>
      <button class="back" type="button" id="dms-st-back">← 동무의 방</button>
    </div>
    
    ${totAsked > 0 ? `
      <div class="dms-st-summary">
        <div class="dms-st-sum-item"><div class="v">${accuracy}<span>%</span></div><div class="k">정답률</div></div>
        <div class="dms-st-sum-item"><div class="v">${totAsked}</div><div class="k">총 문항</div></div>
        <div class="dms-st-sum-item"><div class="v">${totSess}</div><div class="k">세션</div></div>
        <div class="dms-st-sum-item"><div class="v">${ndays}</div><div class="k">학습 일수</div></div>
      </div>
      
      <div class="dms-st-block">
        <h4>모드별 정답률</h4>
        ${modeRows || '<div class="dms-st-empty">기록 없음</div>'}
      </div>
      
      <div class="dms-st-block">
        <h4>변증별 정답률 <small>(시도 3+ · 약한 변증 우선)</small></h4>
        ${patternRows || '<div class="dms-st-empty">변증 추적 데이터 부족 (객관식·주관식·드릴 진행 시 자동 수집)</div>'}
      </div>
      
      <div class="dms-st-block">
        <h4>자주 틀린 사진 <small>top ${Object.keys(d.wrong).length > 8 ? 8 : Object.keys(d.wrong).length}</small></h4>
        ${wrongList ? `<div class="dms-wgrid">${wrongList}</div>` : '<div class="dms-st-empty">오답 없음 ✨</div>'}
      </div>
      
      <div class="dms-st-block">
        <h4>최근 세션 <small>(${d.sessions.length > 10 ? '10/' : ''}${d.sessions.length})</small></h4>
        ${sessRows || '<div class="dms-st-empty">세션 기록 없음</div>'}
      </div>
    ` : `
      <div class="dms-st-block" style="text-align:center;padding:30px 14px">
        <div style="font-family:'ZCOOL XiaoWei',serif;font-size:36px;color:var(--mo-l);margin-bottom:8px">空</div>
        <div style="font-size:13px;color:var(--mo)">아직 학습 기록이 없습니다.</div>
        <div style="font-size:11px;color:var(--mo-l);margin-top:5px">問答 · 主觀 · 速習 · 對位 · 暗誦 어느 모드든 진행하면 통계가 쌓입니다.</div>
      </div>
    `}
  `;
  
  $('#dms-st-back').addEventListener('click', renderDongmuSuite);
  $('#dms-st-reset').addEventListener('click', () => {
    statsReset();
    renderStatsAnalytics();
  });
  $$('.dms-wcell').forEach(c => {
    c.addEventListener('click', () => {
      const tid = parseInt(c.dataset.tid, 10);
      _showTongueDetail(tid);
    });
  });
}

function _showTongueDetail(tid){
  const t = (window.TONGUE_BY_ID || {})[tid];
  if(!t) return;
  _openSimpleModal(`
    <div style="background:#FFF8E8;border:1.5px solid #9C3030;border-radius:11px;padding:14px;max-width:320px">
      <h3 style="margin:0 0 6px;font-family:'Noto Serif SC',serif;font-size:15px;color:var(--zhusha-d)">
        ${esc(('00'+(t.id||tid)).slice(-2))}. ${esc(t.han || '')}
      </h3>
      <img src="${esc(t.img)}" alt="" style="width:100%;max-height:240px;object-fit:cover;border-radius:6px;margin-bottom:8px">
      <div style="font-size:11.5px;line-height:1.65">
        <div><b style="color:var(--zhusha-d)">${esc(t.label_full || t.han || '')}</b></div>
        <div style="color:var(--mo-l);margin-bottom:4px">${esc(t.ko || '')}</div>
        ${t.pattern_han ? `<div>辨證 · <b style="color:var(--feicui)">${esc(t.pattern_han)}</b> · ${esc(t.pattern || '')}</div>` : ''}
        ${t.notes ? `<div style="background:#FFF0C0;padding:6px 8px;border-radius:5px;margin-top:6px">${esc(t.notes)}</div>` : ''}
        ${t.page ? `<div style="color:var(--gutong);font-size:10.5px;margin-top:4px">교재 P.${esc(t.page)}</div>` : ''}
      </div>
      <button class="btn" type="button" id="dms-td-close" style="width:100%;margin-top:8px">닫기</button>
    </div>
  `, (root) => {
    const cx = root.querySelector('#dms-td-close');
    if(cx) cx.addEventListener('click', _closeSimpleModal);
  });
}

// ════ 4. 暗誦 — 플래시카드 ════════════════════════════════════════════════
let _flashState = null;

function renderFlashcards(range){
  const tongues = (window.tonguesForMode ? window.tonguesForMode(range) : (window.TONGUES || [])).slice();
  if(!tongues.length){
    toast('데이터 없음','warn');
    return renderDongmuSuite();
  }
  // 셔플
  for(let i = tongues.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [tongues[i], tongues[j]] = [tongues[j], tongues[i]];
  }
  _flashState = {
    range, queue: tongues, idx: 0, flipped: false,
    ratings: { hard:0, ok:0, easy:0, skip:0 },
    startedAt: Date.now(),
    wrongDetails: [],   // 어려움/패스 항목 통계 후크용
  };
  _renderFlashCard();
}

function _renderFlashCard(){
  const view = document.getElementById('view');
  if(!view || !_flashState) return;
  const s = _flashState;
  if(s.idx >= s.queue.length){
    return _renderFlashResults();
  }
  const t = s.queue[s.idx];
  const pos = s.idx + 1;
  const total = s.queue.length;
  const prog = pos / total * 100;
  
  view.innerHTML = `
    <style>
      .dms-fc-top { display:flex; align-items:center; gap:8px; margin-bottom:10px; padding:9px 11px;
                     background:linear-gradient(135deg,#9C3030,#6E1818); color:#FFE08A; border-radius:9px; }
      .dms-fc-top .han { font-family:'ZCOOL XiaoWei',serif; font-size:22px; letter-spacing:.06em; }
      .dms-fc-top .sub { font-size:10.5px; opacity:.85; margin-top:1px; }
      .dms-fc-top .back { margin-left:auto; background:transparent; border:1px solid #FFE08A; color:#FFE08A;
                          padding:4px 9px; border-radius:6px; font-size:11px; cursor:pointer; }
      .dms-fc-prog { display:flex; align-items:center; gap:8px; margin-bottom:10px; padding:6px 11px;
                      background:#FAF1E0; border:1px solid #C9A22744; border-radius:8px; font-size:11px; }
      .dms-fc-prog .bar { flex:1; height:6px; background:#E8DCC0; border-radius:3px; overflow:hidden; position:relative; }
      .dms-fc-prog .fill { position:absolute; left:0; top:0; bottom:0; background:linear-gradient(90deg,#C9A227,#9C3030);
                            transition:width .4s ease; }
      
      .dms-fc-card { background:#fff; border:1.5px solid #9C3030; border-radius:14px; padding:16px;
                      box-shadow:0 6px 18px rgba(60,12,12,.18); }
      .dms-fc-photo { width:100%; max-height:340px; object-fit:cover; border-radius:8px; margin-bottom:10px;
                       cursor:pointer; user-select:none; }
      .dms-fc-flip-hint { text-align:center; font-size:11px; color:var(--mo-l); margin-top:-4px; font-style:italic; }
      
      .dms-fc-back { padding:6px 0 0; animation:dms-fc-in .3s ease; }
      @keyframes dms-fc-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      .dms-fc-han { font-family:'Noto Serif SC',serif; font-size:24px; color:var(--zhusha-d); text-align:center;
                     line-height:1.3; margin-bottom:4px; letter-spacing:.05em; }
      .dms-fc-ko { text-align:center; color:var(--mo-l); font-size:13px; margin-bottom:8px; }
      .dms-fc-meta { font-size:11.5px; line-height:1.65; margin-bottom:8px; }
      .dms-fc-meta b { color:var(--zhusha-d); font-family:'Noto Serif SC',serif; }
      .dms-fc-notes { background:#FFF0C0; padding:8px 10px; border-radius:6px; font-size:11px;
                       line-height:1.6; margin-bottom:8px; }
      .dms-fc-rates { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-top:10px; }
      .dms-fc-rate { padding:11px 4px; border-radius:8px; font-size:11.5px; cursor:pointer; border:1.5px solid;
                      font-family:inherit; text-align:center; }
      .dms-fc-rate .han { font-family:'Noto Serif SC',serif; font-size:15px; font-weight:700; display:block; }
      .dms-fc-rate .ko { font-size:10px; margin-top:2px; display:block; }
      .dms-fc-rate.hard { background:#FFF0EC; border-color:#9C3030; color:#9C3030; }
      .dms-fc-rate.hard:hover { background:#9C3030; color:#FFE08A; }
      .dms-fc-rate.ok   { background:#FFF8E8; border-color:#C9A227; color:#7A5810; }
      .dms-fc-rate.ok:hover { background:#C9A227; color:#3A2010; }
      .dms-fc-rate.easy { background:#EAF5EE; border-color:#2A7060; color:#1E5040; }
      .dms-fc-rate.easy:hover { background:#2A7060; color:#fff; }
      .dms-fc-rate.skip { background:#F0E8D8; border-color:#7A6850; color:#5A4830; }
      .dms-fc-rate.skip:hover { background:#7A6850; color:#fff; }
    </style>
    
    <div class="dms-fc-top">
      <div>
        <div class="han">暗誦</div>
        <div class="sub">플래시카드 · 사진 → 라벨 뒤집기</div>
      </div>
      <button class="back" type="button" id="dms-fc-back">← 종료</button>
    </div>
    
    <div class="dms-fc-prog">
      <span style="font-family:var(--font-display);color:var(--zhusha-d)"><b>${pos}</b> / ${total}</span>
      <div class="bar"><div class="fill" style="width:${prog}%"></div></div>
      <span>${esc({body:'設體',quality:'設質',all:'通'}[s.range]||s.range)}</span>
    </div>
    
    <div class="dms-fc-card">
      <img class="dms-fc-photo" id="dms-fc-photo" src="${esc(t.img)}" alt="">
      ${s.flipped ? `
        <div class="dms-fc-back">
          <div class="dms-fc-han">${esc(t.label_full || t.han || '')}</div>
          ${t.ko ? `<div class="dms-fc-ko">${esc(t.ko)}</div>` : ''}
          <div class="dms-fc-meta">
            ${t.pattern_han ? `<div>辨證 · <b>${esc(t.pattern_han)}</b> · ${esc(t.pattern||'')}</div>` : ''}
            ${t.page ? `<div style="color:var(--gutong);font-size:10.5px;margin-top:3px">교재 P.${esc(t.page)}</div>` : ''}
          </div>
          ${t.notes ? `<div class="dms-fc-notes">${esc(t.notes)}</div>` : ''}
          <div class="dms-fc-rates">
            <button class="dms-fc-rate hard" type="button" data-r="hard">
              <span class="han">難</span><span class="ko">어려움</span>
            </button>
            <button class="dms-fc-rate ok" type="button" data-r="ok">
              <span class="han">普</span><span class="ko">보통</span>
            </button>
            <button class="dms-fc-rate easy" type="button" data-r="easy">
              <span class="han">易</span><span class="ko">쉬움</span>
            </button>
            <button class="dms-fc-rate skip" type="button" data-r="skip">
              <span class="han">過</span><span class="ko">패스</span>
            </button>
          </div>
        </div>
      ` : `
        <div class="dms-fc-flip-hint">사진을 누르면 라벨이 펼쳐집니다 →</div>
      `}
    </div>
  `;
  
  const back = $('#dms-fc-back');
  if(back) back.addEventListener('click', () => {
    if(confirm('暗誦 세션을 종료할까요?')){
      _flashState = null;
      renderDongmuSuite();
    }
  });
  
  const photo = $('#dms-fc-photo');
  if(photo && !s.flipped){
    photo.addEventListener('click', () => { s.flipped = true; _renderFlashCard(); });
  }
  
  $$('.dms-fc-rate').forEach(b => {
    b.addEventListener('click', () => _rateAndNext(b.dataset.r));
  });
}

function _rateAndNext(rating){
  const s = _flashState;
  if(!s) return;
  const t = s.queue[s.idx];
  s.ratings[rating] = (s.ratings[rating] || 0) + 1;
  // 어려움·패스는 오답으로 통계에 기록 (학습 진단용)
  const isWrong = (rating === 'hard' || rating === 'skip');
  s.wrongDetails.push({ tongueId: t.id, correct: !isWrong });
  // 어려움 → queue 끝에 다시 (재노출)
  if(rating === 'hard'){
    s.queue.push(t);
  }
  s.idx++;
  s.flipped = false;
  _renderFlashCard();
}

function _renderFlashResults(){
  const s = _flashState;
  if(!s) return;
  const view = document.getElementById('view');
  if(!view) return;
  const total = s.ratings.hard + s.ratings.ok + s.ratings.easy + s.ratings.skip;
  const learned = s.ratings.ok + s.ratings.easy;
  const acc = total ? Math.round(learned/total*100) : 0;
  const dur = Math.round((Date.now() - s.startedAt) / 1000);
  const m = Math.floor(dur/60), sec = dur%60;
  
  // 통계 후크
  statsRecord('flash', s.range, total, learned, s.wrongDetails, dur);
  
  view.innerHTML = `
    <style>
      .dms-fcr-card { background:linear-gradient(135deg,#9C3030,#6E1818); color:#FFE08A;
                       padding:20px 16px; border-radius:12px; text-align:center; margin-bottom:12px;
                       box-shadow:0 6px 16px rgba(60,12,12,.3); }
      .dms-fcr-acc { font-family:'ZCOOL XiaoWei',serif; font-size:50px; line-height:1; margin:8px 0; }
      .dms-fcr-acc small { font-size:24px; opacity:.8; }
      .dms-fcr-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-top:12px; }
      .dms-fcr-cell { background:rgba(255,224,138,.14); border-radius:6px; padding:8px 4px; }
      .dms-fcr-cell .v { font-family:'ZCOOL XiaoWei',serif; font-size:22px; line-height:1; }
      .dms-fcr-cell .k { font-size:9.5px; opacity:.82; margin-top:3px; }
    </style>
    <div class="dms-fcr-card">
      <div style="font-size:13px;opacity:.88">暗誦 結算</div>
      <div class="dms-fcr-acc">${acc}<small>%</small></div>
      <div style="font-size:12px;opacity:.92">${learned} / ${total} 학습 (易+普) · ${m}분 ${sec}초</div>
      <div class="dms-fcr-grid">
        <div class="dms-fcr-cell"><div class="v">${s.ratings.hard}</div><div class="k">難 어려움</div></div>
        <div class="dms-fcr-cell"><div class="v">${s.ratings.ok}</div><div class="k">普 보통</div></div>
        <div class="dms-fcr-cell"><div class="v">${s.ratings.easy}</div><div class="k">易 쉬움</div></div>
        <div class="dms-fcr-cell"><div class="v">${s.ratings.skip}</div><div class="k">過 패스</div></div>
      </div>
    </div>
    <div style="display:flex;gap:6px">
      <button class="btn" type="button" id="dms-fcr-again" style="flex:1">다시 풀기</button>
      <button class="btn btn-o" type="button" id="dms-fcr-back" style="flex:1">동무의 방</button>
    </div>
  `;
  
  $('#dms-fcr-again').addEventListener('click', () => renderFlashcards(s.range));
  $('#dms-fcr-back').addEventListener('click', () => {
    _flashState = null;
    renderDongmuSuite();
  });
}

// ════ 5. renderDongmuHome 덮어쓰기 (jindan 의 expandDongmuHome 위에) ══════
window.renderDongmuHome = renderDongmuSuite;

window.V11DongmuSuite = {
  open: renderDongmuSuite,
  openStats: renderStatsAnalytics,
  openFlash: renderFlashcards,
};

})();
