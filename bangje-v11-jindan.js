/* bangje-v11-jindan.js — 진단학 설진 학습 도구 v1.0
 * ============================================================================
 * 5/19 설체 시험·5/26 설질 시험 대비 — 사진 기반 문제 풀이.
 *
 *  학습 모드:
 *   • 객관식 (4지선다) — 사진 보고 변증/특징 선택
 *   • 주관식 — 한자/한글 직접 입력
 *   • 드릴 — 빠른 반복, 점수 X
 *   • 사진첩 — 48장 전체 펼쳐 보기 (라벨 토글)
 *
 *  시험 범위:
 *   • body (설체)  — 形態: 胖大·瘦薄·齒痕·點刺·芒刺·裂紋·鏡面·粗老·瘀斑·偏
 *   • quality (설질) — 色 + 苔
 *   • both (통합) — 모두
 *
 *  V11Jindan.start(mode, range)         — 모드별 학습 세션 시작
 *  V11Jindan.openGallery()              — 사진첩 모드
 *  V11Jindan.expand()                   — 동무의 방 home 에 inject
 * ============================================================================ */

(function(){
'use strict';

function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function shuffle(arr){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }

// ─── 0. 색·苔 풀 (distractor 용) ────────────────────────────────────────
const COLOR_POOL = ['淡白', '淡紅', '紅', '絳', '紫紅', '紫', '暗紅'];
const COATING_POOL = ['薄白苔', '白厚苔', '白滑苔', '白膩苔', '白厚腐苔', '黃薄苔', '黃膩苔', '黃厚燥苔', '黑苔', '無苔', '剝苔', '花剝苔', '半截剝苔', '地圖苔', '滑苔'];
const BODY_POOL = ['正常', '胖大', '瘦薄', '齒痕', '點刺', '芒刺', '裂紋', '鏡面', '粗老', '瘀斑', '偏左', '光滑', '肥大'];
const PATTERN_POOL = ['정상', '기허', '음허', '양허', '기혈양허', '심화성', '심간화왕', '습증', '습열', '담습', '담습화열', '혈어', '혈어식적', '혈어협습', '열입영혈', '열성', '열독', '실증', '음허화왕', '폐위음허', '위음허', '열극상음'];

// ─── 1. 문제 생성 ────────────────────────────────────────────────────────
// 사진 → 질문 유형: 변증·설질·설체·특징·완전라벨
function _generateQuestion(tongue, mode){
  // mode: 'body' | 'quality' | 'both'
  const types = [];
  if(mode === 'body' || mode === 'both'){
    if(tongue.body_features && tongue.body_features.length){
      types.push('body_feature');
    }
  }
  if(mode === 'quality' || mode === 'both'){
    if(tongue.quality_features && tongue.quality_features.length){
      types.push('quality_feature');
    }
  }
  if(mode === 'both' || (mode === 'body' && tongue.test_body) || (mode === 'quality' && tongue.test_quality)){
    types.push('pattern');
  }
  if(!types.length) types.push('pattern');

  const type = types[Math.floor(Math.random() * types.length)];

  if(type === 'body_feature'){
    const correct = tongue.body_features[0];
    const wrong = shuffle(BODY_POOL.filter(x => !tongue.body_features.includes(x))).slice(0, 3);
    return {
      question: '이 사진의 設體(설체) 특징은?',
      correct,
      options: shuffle([correct, ...wrong]),
      type: 'body_feature',
    };
  } else if(type === 'quality_feature'){
    const correct = tongue.quality_features[0];
    const pool = correct.includes('苔') ? COATING_POOL : COLOR_POOL;
    const wrong = shuffle(pool.filter(x => !tongue.quality_features.includes(x))).slice(0, 3);
    return {
      question: correct.includes('苔') ? '이 사진의 설태(舌苔)는?' : '이 사진의 舌色은?',
      correct,
      options: shuffle([correct, ...wrong]),
      type: 'quality_feature',
    };
  } else { // pattern
    const correct = tongue.pattern_han;
    const wrong = shuffle(PATTERN_POOL.map(p => {
      // pattern_han 형식으로 변환
      const mapping = {'정상':'正常','기허':'氣虛','음허':'陰虛','양허':'陽虛','기혈양허':'氣血兩虛',
        '심화성':'心火盛','심간화왕':'心肝火旺','습증':'濕證','습열':'濕熱','담습':'痰濕','담습화열':'痰濕化熱',
        '혈어':'血瘀','혈어식적':'血瘀·食積','혈어협습':'血瘀挾濕','열입영혈':'熱入營血',
        '열성':'熱盛','열독':'熱毒/血瘀','실증':'實證','음허화왕':'陰虛火旺','폐위음허':'肺胃陰虛',
        '위음허':'胃陰虛','열극상음':'熱極傷陰',
      };
      return mapping[p] || p;
    }).filter(x => x !== correct)).slice(0, 3);
    return {
      question: '이 사진의 辨證은?',
      correct,
      options: shuffle([correct, ...wrong]),
      type: 'pattern',
    };
  }
}

// ─── 2. 메인 학습 세션 ──────────────────────────────────────────────────
let _session = null;

function start(modeStudy, modeRange){
  // modeStudy: 'mcq' | 'subjective' | 'drill'
  // modeRange: 'body' | 'quality' | 'both'
  const pool = (typeof window.tonguesForMode === 'function')
    ? window.tonguesForMode(modeRange)
    : (window.TONGUES || []);
  if(!pool.length){ toast('데이터셋 미로드','warn'); return; }
  const cards = shuffle(pool);
  _session = {
    modeStudy, modeRange, cards, idx: 0,
    correct: 0, wrong: 0, history: [],
    startedAt: Date.now(),
  };
  _renderQuestion();
}

function _renderQuestion(){
  const view = document.getElementById('view');
  if(!view || !_session) return;
  if(_session.idx >= _session.cards.length){
    _renderResults();
    return;
  }
  const t = _session.cards[_session.idx];
  const q = _generateQuestion(t, _session.modeRange);
  _session.currentQ = q;
  _session.currentT = t;

  const progress = `${_session.idx+1} / ${_session.cards.length}`;
  const acc = (_session.correct + _session.wrong)
    ? `${Math.round(_session.correct/(_session.correct+_session.wrong)*100)}%`
    : '0%';
  const modeKo = _session.modeStudy === 'mcq' ? '객관식'
    : _session.modeStudy === 'subjective' ? '주관식' : '드릴';
  const rangeKo = _session.modeRange === 'body' ? '설체'
    : _session.modeRange === 'quality' ? '설질' : '통합';

  view.innerHTML = `
    <style>
      .jd-bar { display:flex; gap:6px; align-items:center; margin-bottom:10px; padding:6px 10px; background:#FAF1E0; border-radius:8px; font-size:11.5px; }
      .jd-bar .lab { color:var(--zhusha-d); font-weight:600; }
      .jd-bar .sep { color:var(--gutong); }
      .jd-photo-wrap { background:#fff; border:1px solid #C9A22744; border-radius:10px; padding:10px; margin-bottom:10px; text-align:center; }
      .jd-photo { max-width:100%; max-height:300px; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,.15); }
      .jd-question { font-size:14px; color:var(--zhusha-d); font-weight:600; text-align:center; margin:8px 0; }
      .jd-options { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px; }
      @media (max-width:480px){ .jd-options{ grid-template-columns:1fr; } }
      .jd-opt { background:#fff; border:1px solid #C9A22755; padding:10px 12px; border-radius:8px; font-size:13px; cursor:pointer; text-align:center; font-family:'Noto Serif SC',serif; }
      .jd-opt:hover:not(:disabled) { background:#FFF0D0; border-color:#C9A227; }
      .jd-opt.correct { background:#2A7060; color:#fff; border-color:#2A7060; }
      .jd-opt.wrong { background:#9C3030; color:#fff; border-color:#9C3030; }
      .jd-opt:disabled { cursor:default; opacity:.7; }
      .jd-input { width:100%; padding:10px; font-size:14px; border:1px solid #C9A22755; border-radius:8px; font-family:'Noto Serif SC',serif; margin-bottom:6px; box-sizing:border-box; }
      .jd-submit { width:100%; background:var(--zhusha); color:#fff; border:0; padding:10px; font-size:13px; border-radius:8px; cursor:pointer; font-weight:600; }
      .jd-explain { background:#FFF8E0; border-left:3px solid var(--huang); padding:8px 10px; border-radius:6px; font-size:11.5px; line-height:1.65; margin:10px 0; }
      .jd-explain .lab { font-weight:700; color:var(--zhusha-d); }
      .jd-explain .han { font-family:'Noto Serif SC',serif; color:#5C2C0C; }
      .jd-next { display:none; width:100%; background:var(--feicui); color:#fff; border:0; padding:11px; font-size:13px; border-radius:8px; cursor:pointer; font-weight:600; margin-top:8px; }
      .jd-quit { background:transparent; border:1px solid var(--gutong); color:var(--gutong); padding:6px 10px; font-size:11px; border-radius:6px; cursor:pointer; }
    </style>

    <div class="jd-bar">
      <span class="lab">${esc(modeKo)} · ${esc(rangeKo)}</span>
      <span class="sep">|</span>
      <span>${esc(progress)}</span>
      <span class="sep">|</span>
      <span>정답률 <b style="color:var(--feicui)">${esc(acc)}</b></span>
      <span style="margin-left:auto"><button class="jd-quit" type="button" id="jd-quit">← 동무의 방</button></span>
    </div>

    <div class="jd-photo-wrap">
      <img class="jd-photo" src="${esc(t.img)}" alt="설진">
    </div>

    <div class="jd-question">${esc(q.question)}</div>

    ${_session.modeStudy === 'subjective'
      ? `<input class="jd-input" type="text" id="jd-input" placeholder="한자 또는 한글 (예: 氣虛 또는 기허)" autocomplete="off">
         <button class="jd-submit" type="button" id="jd-submit">제출</button>`
      : `<div class="jd-options">${q.options.map((o, i) => `<button class="jd-opt" type="button" data-i="${i}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div>`
    }

    <div class="jd-explain" id="jd-explain" style="display:none">
      <div class="lab" id="jd-explain-head"></div>
      <div style="margin-top:4px">
        <span class="han">${esc(t.label_full)}</span> — ${esc(t.ko)}<br>
        <span style="color:var(--mo-l)">${esc(t.notes || '')}</span>
        ${t.page ? `<br><span style="color:var(--gutong);font-size:10.5px">교재 P.${esc(t.page)}</span>` : ''}
      </div>
    </div>

    <button class="jd-next" type="button" id="jd-next">다음 →</button>
  `;

  $('#jd-quit').addEventListener('click', () => {
    _session = null;
    if(window.renderDongmuHome) window.renderDongmuHome();
    else if(window.setTab) window.setTab('dongmu');
  });

  if(_session.modeStudy === 'subjective'){
    const inp = $('#jd-input');
    const btn = $('#jd-submit');
    inp.focus();
    const submit = () => _checkSubjective(inp.value);
    btn.addEventListener('click', submit);
    inp.addEventListener('keydown', e => { if(e.key === 'Enter') submit(); });
  } else {
    $$('.jd-opt').forEach(b => {
      b.addEventListener('click', () => _checkMCQ(b.dataset.val, b));
    });
  }

  const next = $('#jd-next');
  if(next) next.addEventListener('click', () => {
    _session.idx++;
    _renderQuestion();
  });
}

function _showExplanation(isCorrect, userAns){
  const exp = $('#jd-explain');
  const head = $('#jd-explain-head');
  if(!exp || !head) return;
  if(isCorrect){
    head.innerHTML = `<span style="color:var(--feicui)">✓ 정답</span>`;
  } else {
    head.innerHTML = `<span style="color:var(--zhusha-d)">✗ 오답</span> · 정답: <b>${esc(_session.currentQ.correct)}</b>${userAns?` · 입력: ${esc(userAns)}`:''}`;
  }
  exp.style.display = 'block';
  const next = $('#jd-next');
  if(next) next.style.display = 'block';
}

function _checkMCQ(val, btn){
  const correct = val === _session.currentQ.correct;
  $$('.jd-opt').forEach(b => {
    b.disabled = true;
    if(b.dataset.val === _session.currentQ.correct) b.classList.add('correct');
    else if(b === btn) b.classList.add('wrong');
  });
  if(correct){ _session.correct++; }
  else { _session.wrong++; }
  _session.history.push({tongueId: _session.currentT.id, correct, type: _session.currentQ.type});
  _showExplanation(correct);
  // 드릴 모드는 자동 다음 (1.4초)
  if(_session.modeStudy === 'drill'){
    setTimeout(() => { _session.idx++; _renderQuestion(); }, correct ? 800 : 1800);
  }
}

function _checkSubjective(val){
  const v = (val || '').trim();
  if(!v){ toast('답 입력','warn'); return; }
  const correct = _session.currentQ.correct;
  // 채점: 한자 정확 일치 OR 한글 매칭 OR 키워드 일치
  const norm = s => String(s).replace(/\s+/g,'').toLowerCase();
  const vn = norm(v);
  const cn = norm(correct);
  const t = _session.currentT;
  let isCorrect = false;
  if(vn === cn) isCorrect = true;
  // 한글 정답 (label / ko / pattern) 매칭
  if(!isCorrect){
    const koAns = norm(t.pattern || '');
    if(koAns && vn.includes(koAns)) isCorrect = true;
  }
  // 한자 fragment 일치 (예: '기허' 답 → 정답 '氣虛' 의 한글 '기허')
  if(!isCorrect){
    const mapping = {'기허':'氣虛','음허':'陰虛','양허':'陽虛','기혈양허':'氣血兩虛',
      '심화성':'心火盛','심간화왕':'心肝火旺','습증':'濕證','습열':'濕熱','담습':'痰濕',
      '혈어':'血瘀','열입영혈':'熱入營血','열성':'熱盛','실증':'實證','음허화왕':'陰虛火旺',
      '폐위음허':'肺胃陰虛','위음허':'胃陰虛'};
    if(mapping[vn] === correct) isCorrect = true;
  }
  if(isCorrect){ _session.correct++; }
  else { _session.wrong++; }
  _session.history.push({tongueId: t.id, correct: isCorrect, type: _session.currentQ.type});
  // 입력란 disable
  const inp = $('#jd-input'); if(inp) inp.disabled = true;
  const btn = $('#jd-submit'); if(btn) btn.disabled = true;
  _showExplanation(isCorrect, v);
}

function _renderResults(){
  const view = document.getElementById('view');
  if(!view || !_session) return;
  const total = _session.correct + _session.wrong;
  const acc = total ? Math.round(_session.correct/total*100) : 0;
  const dur = Math.round((Date.now() - _session.startedAt) / 1000);
  const min = Math.floor(dur / 60), sec = dur % 60;

  // 가장 자주 틀린 사진
  const wrongHistory = _session.history.filter(h => !h.correct);
  const wrongIds = wrongHistory.map(h => h.tongueId);
  const wrongTongues = [...new Set(wrongIds)].map(id => window.TONGUE_BY_ID && window.TONGUE_BY_ID[id]).filter(Boolean);

  view.innerHTML = `
    <style>
      .jd-result-card { background:linear-gradient(135deg,#9C3030,#6E1818); color:#FFE08A; padding:18px; border-radius:12px; margin-bottom:12px; text-align:center; box-shadow:0 6px 16px rgba(60,12,12,.3); }
      .jd-result-acc { font-family:'ZCOOL XiaoWei',serif; font-size:52px; line-height:1; margin:8px 0; }
      .jd-result-stats { display:flex; justify-content:center; gap:14px; font-size:12px; opacity:.92; margin-top:6px; }
      .jd-wrong-list { background:#fff; border:1px solid #C9A22755; border-radius:10px; padding:10px; }
      .jd-wrong-list h4 { margin:0 0 8px; font-size:13px; color:var(--zhusha-d); }
      .jd-wrong-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
      @media (max-width:480px){ .jd-wrong-grid { grid-template-columns:repeat(3,1fr); } }
      .jd-wrong-cell { background:#FFF0D0; border-radius:6px; padding:4px; text-align:center; font-size:9.5px; }
      .jd-wrong-cell img { width:100%; height:80px; object-fit:cover; border-radius:4px; }
    </style>

    <div class="jd-result-card">
      <div style="font-size:14px;opacity:.88">學業 結算</div>
      <div class="jd-result-acc">${acc}<span style="font-size:30px">%</span></div>
      <div style="font-size:13px">${_session.correct} / ${total} 정답</div>
      <div class="jd-result-stats">
        <span>틀린 문항 ${_session.wrong}</span>
        <span>·</span>
        <span>${min}분 ${sec}초</span>
      </div>
    </div>

    ${wrongTongues.length ? `
      <div class="jd-wrong-list">
        <h4>틀린 사진 (${wrongTongues.length}장) — 복습 권장</h4>
        <div class="jd-wrong-grid">
          ${wrongTongues.map(t => `
            <div class="jd-wrong-cell">
              <img src="${esc(t.img)}" alt="${esc(t.han)}">
              <div style="margin-top:3px"><b>${esc(t.han)}</b></div>
              <div style="color:var(--mo-l)">${esc(t.pattern_han || '')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : `<div style="text-align:center;padding:14px;color:var(--feicui);font-size:14px">滿點! 完璧 — 한 장도 안 틀렸습니다 ✨</div>`}

    <div style="display:flex;gap:6px;margin-top:12px">
      <button class="btn" type="button" id="jd-result-retry" style="flex:1">다시 풀기</button>
      <button class="btn btn-o" type="button" id="jd-result-back" style="flex:1">동무의 방</button>
    </div>
  `;

  $('#jd-result-retry').addEventListener('click', () => {
    start(_session.modeStudy, _session.modeRange);
  });
  $('#jd-result-back').addEventListener('click', () => {
    _session = null;
    if(window.renderDongmuHome) window.renderDongmuHome();
    else if(window.setTab) window.setTab('dongmu');
  });
}

// ─── 3. 사진첩 (gallery) ────────────────────────────────────────────────
function openGallery(modeRange){
  const view = document.getElementById('view');
  if(!view) return;
  const pool = (typeof window.tonguesForMode === 'function')
    ? window.tonguesForMode(modeRange || 'both') : (window.TONGUES || []);
  let revealed = false;
  function render(){
    view.innerHTML = `
      <style>
        .jg-bar { display:flex; gap:6px; align-items:center; margin-bottom:10px; }
        .jg-bar .ttl { font-family:var(--font-display); font-size:16px; color:var(--zhusha-d); }
        .jg-toggle { background:#FAF1E0; border:1px solid #C9A22755; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; margin-left:auto; }
        .jg-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        @media (min-width:560px){ .jg-grid{ grid-template-columns:repeat(4,1fr); } }
        .jg-card { background:#fff; border:1px solid #C9A22744; border-radius:8px; overflow:hidden; }
        .jg-card img { width:100%; height:110px; object-fit:cover; display:block; }
        .jg-label { padding:5px 6px; font-size:10px; line-height:1.4; }
        .jg-label .num { color:var(--gutong); }
        .jg-label .han { font-family:'Noto Serif SC',serif; color:var(--zhusha-d); font-weight:600; font-size:11px; }
        .jg-label .pat { color:var(--feicui); font-size:9.5px; margin-top:1px; }
      </style>

      <div class="jg-bar">
        <span class="ttl">舌診 사진첩 (${pool.length}장)</span>
        <button class="jg-toggle" type="button" id="jg-toggle">${revealed ? '라벨 숨기기' : '라벨 보기'}</button>
        <button class="jg-toggle" type="button" id="jg-back">← 동무의 방</button>
      </div>

      <div class="jg-grid">
        ${pool.map(t => `
          <div class="jg-card">
            <img src="${esc(t.img)}" alt="설진 ${t.id}">
            <div class="jg-label">
              <div class="num">${('00'+t.id).slice(-2)}</div>
              ${revealed ? `<div class="han">${esc(t.han)}</div><div class="pat">${esc(t.pattern_han || t.pattern || '')}</div>` : `<div style="color:var(--gutong)">─ ?</div>`}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    $('#jg-toggle').addEventListener('click', () => { revealed = !revealed; render(); });
    $('#jg-back').addEventListener('click', () => {
      if(window.renderDongmuHome) window.renderDongmuHome();
      else if(window.setTab) window.setTab('dongmu');
    });
  }
  render();
}

// ─── 4. 동무의 방 — 확장된 home (D-N + 학습 모드 버튼) ──────────────────
function expandDongmuHome(){
  const view = document.getElementById('view');
  if(!view) return;

  const exams = window.JINDAN_EXAMS || [];
  function dleft(iso){
    const d = (new Date(iso)).getTime();
    if(!isFinite(d)) return null;
    return Math.ceil((d - Date.now()) / 86400000);
  }

  // 사진첩 카운트
  const total = (window.TONGUES || []).length;
  const bodyN = (window.tonguesForMode ? window.tonguesForMode('body').length : 0);
  const qualN = (window.tonguesForMode ? window.tonguesForMode('quality').length : 0);

  view.innerHTML = `
    <style>
      .dm-banner { background:linear-gradient(135deg,#9C3030,#6E1818); color:#FFE08A;
                    padding:14px; border-radius:10px; margin-bottom:10px;
                    display:flex; align-items:center; gap:14px; box-shadow:0 4px 12px rgba(60,12,12,.3); }
      .dm-banner-medal { width:64px; height:64px; border-radius:50%; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.3); flex-shrink:0; }
      .dm-banner-medal .cmedal, .dm-banner-medal img { width:100%; height:100%; }
      .dm-banner-title { font-family:'ZCOOL XiaoWei',serif; font-size:22px; letter-spacing:.06em; }
      .dm-banner-sub { font-size:11.5px; opacity:.88; margin-top:2px; }
      .dm-back { background:transparent; border:1px solid #FFE08A; color:#FFE08A; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; margin-left:auto; }
      .dm-exam-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
      @media (max-width:480px){ .dm-exam-row { grid-template-columns:1fr; } }
      .dm-exam-card { background:#FFF8E0; border:2px solid; border-radius:10px; padding:10px 12px; text-align:center; }
      .dm-exam-han { font-family:'ZCOOL XiaoWei',serif; font-size:18px; letter-spacing:.05em; }
      .dm-exam-dday { font-family:var(--font-display); font-size:32px; line-height:1; margin:6px 0; }
      .dm-exam-meta { font-size:10.5px; color:var(--gutong); }
      .dm-section { background:#FAF1E0; border:1px solid #9C303033; border-radius:10px; padding:12px; margin-bottom:10px; }
      .dm-stitle { font-family:var(--font-display); font-size:14px; color:var(--zhusha-d); margin-bottom:6px; display:flex; align-items:center; gap:6px; }
      .dm-stitle .han { font-family:'ZCOOL XiaoWei',serif; font-size:18px; }
      .dm-modes { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:8px; }
      .dm-mode-btn { background:#fff; border:1px solid #9C303055; padding:10px 6px; border-radius:8px; text-align:center; cursor:pointer; font-size:12px; }
      .dm-mode-btn:hover { background:#FFF0D0; border-color:#9C3030; }
      .dm-mode-han { font-family:'Noto Serif SC',serif; font-size:14px; color:var(--zhusha-d); font-weight:700; }
      .dm-mode-ko { font-size:10.5px; color:var(--mo-l); margin-top:2px; }
      .dm-mode-btn.duiwei { background:linear-gradient(135deg,#FFF8E8,#FFE0B0); border-color:#C9A227; }
      .dm-mode-btn.duiwei .dm-mode-han { color:#7C1818; }
      .dm-range-tabs { display:flex; gap:4px; margin-bottom:8px; background:#fff; padding:4px; border-radius:8px; border:1px solid #C9A22744; }
      .dm-range-tab { flex:1; padding:7px 4px; text-align:center; font-size:11.5px; cursor:pointer; border-radius:5px; border:0; background:transparent; color:var(--mo); font-weight:600; }
      .dm-range-tab.active { background:#9C3030; color:#FFE08A; }
      .dm-range-tab .han { font-family:'Noto Serif SC',serif; font-size:13px; }
      .dm-tip { font-size:10.5px; color:var(--gutong); margin-top:4px; line-height:1.6; }
    </style>

    <div class="dm-banner">
      <div class="dm-banner-medal">${_medal('leejema', 64)}</div>
      <div style="flex:1">
        <div class="dm-banner-title">東武之房</div>
        <div class="dm-banner-sub"><span class="han">診斷學</span> · 진단학 · 李濟馬 主</div>
      </div>
      <button class="dm-back" type="button" id="dm-to-hub">← 醫書宮</button>
    </div>

    <div class="dm-exam-row">
      ${exams.map(e => {
        const d = dleft(e.date);
        const ddText = d > 0 ? `D-${d}` : (d === 0 ? 'D-Day' : `D+${-d}`);
        const urgent = d !== null && d >= 0 && d <= 3;
        return `
          <div class="dm-exam-card" style="border-color:${e.accent}">
            <div class="dm-exam-han" style="color:${e.accent}">${esc(e.han)}試驗</div>
            <div class="dm-exam-dday" style="color:${urgent ? '#9C3030' : e.accent}">${ddText}</div>
            <div class="dm-exam-meta">${esc(e.label)} · ${esc(e.range)}</div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="dm-section">
      <div class="dm-stitle"><span class="han">舌診</span> 설진 학습 — ${total}장 사진</div>
      <div class="dm-tip">아래 범위 선택 후 학습 모드를 선택. <b style="color:#9C3030">5/19 設體</b> 시험은 形態(齒痕·裂紋·鏡面 등) 위주, <b style="color:#2A7060">5/26 設質</b> 시험은 色·苔 위주.</div>

      <div class="dm-range-tabs" id="dm-range-tabs">
        <button class="dm-range-tab active" type="button" data-range="body"><span class="han">舌體</span> 설체 (${bodyN}장)</button>
        <button class="dm-range-tab" type="button" data-range="quality"><span class="han">舌質</span> 설질 (${qualN}장)</button>
        <button class="dm-range-tab" type="button" data-range="both">통합 (${total}장)</button>
      </div>

      <div class="dm-modes">
        <button class="dm-mode-btn duiwei" type="button" data-mode="duiwei" style="grid-column:1 / -1">
          <div class="dm-mode-han">對位 · 設色×設苔 매트릭스</div>
          <div class="dm-mode-ko">색·태를 좌표로 끌어다 놓는 학습세트 (5/26 對備)</div>
        </button>
        <button class="dm-mode-btn" type="button" data-mode="mcq">
          <div class="dm-mode-han">客觀</div>
          <div class="dm-mode-ko">객관식 4지선다</div>
        </button>
        <button class="dm-mode-btn" type="button" data-mode="subjective">
          <div class="dm-mode-han">主觀</div>
          <div class="dm-mode-ko">주관식 직접 입력</div>
        </button>
        <button class="dm-mode-btn" type="button" data-mode="drill">
          <div class="dm-mode-han">速習</div>
          <div class="dm-mode-ko">드릴 (자동 진행)</div>
        </button>
        <button class="dm-mode-btn" type="button" data-mode="gallery" style="grid-column:1 / -1">
          <div class="dm-mode-han">圖鑑</div>
          <div class="dm-mode-ko">사진첩 (라벨 토글)</div>
        </button>
      </div>
    </div>
  `;

  let currentRange = 'body';  // 시험 임박 (5/19) 이라 설체 default
  $$('#dm-range-tabs .dm-range-tab').forEach(b => {
    b.addEventListener('click', () => {
      currentRange = b.dataset.range;
      $$('#dm-range-tabs .dm-range-tab').forEach(x => x.classList.toggle('active', x === b));
    });
  });
  $$('.dm-mode-btn').forEach(b => {
    b.addEventListener('click', () => {
      const m = b.dataset.mode;
      if(m === 'gallery'){
        openGallery(currentRange);
      } else if(m === 'duiwei'){
        // v11.4: 對位 — 설색×설태 매트릭스 (별도 모듈)
        if(window.V11Matrix && typeof window.V11Matrix.open === 'function'){
          window.V11Matrix.open();
        } else {
          toast('對位 모듈 미로드','warn');
        }
      } else {
        start(m, currentRange);
      }
    });
  });

  $('#dm-to-hub').addEventListener('click', () => {
    if(window.setTab) window.setTab('hub');
  });
}

// ─── 메달리온 helper (app.js 의 함수 활용) ─────────────────────────────
function _medal(id, size){
  if(typeof window._charPhotoMedallion === 'function') return window._charPhotoMedallion(id, size);
  if(typeof window._charMedallion === 'function') return window._charMedallion(id, size);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#E8C8A0"></div>`;
}

// 기존 renderDongmuHome 을 새 expandDongmuHome 으로 교체
if(typeof window !== 'undefined'){
  window.renderDongmuHome = expandDongmuHome;
}

window.V11Jindan = {
  start, openGallery, expand: expandDongmuHome,
};

})();
