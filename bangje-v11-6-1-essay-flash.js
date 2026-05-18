/* bangje-v11-6-1-essay-flash.js — 서술형 기출 플래시카드 v1.0 (v11.6.1)
 * ============================================================================
 *  4년치 (22·21·20·19·18학번) 서술형 기출을 플래시카드로 풀어보는 모드.
 *  시험 범위: 7장 表裏雙解劑 + 8장 補益劑 (補氣劑·補血劑까지)
 *
 *  UX:
 *    1) 문제 화면 — 문제만 보여주고 학생이 머리로 답안을 구성
 *    2) 「답안 보기」 버튼 → 핵심 키워드 리스트 + 모범 답안 펼침
 *    3) 자가 평가: 익숙/보통/다시 — 진행도 saveState
 *    4) 범위 필터: 전체 / 7장 / 8장 / 처방별 / 학번별
 *
 *  외부 API: window.V11EssayFlash = { open, getProgress }
 *  플래시 허브 (renderFlashHub) 에서 「서술형 기출」 타일 클릭 → V11EssayFlash.open()
 * ============================================================================ */
(function(){
'use strict';

function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }
function saveState(){ try{ window.saveState && window.saveState(); }catch(_){} }

// ─── 진행도 저장 키 ────────────────────────────────────────────────────
function _getProgress(){
  const S = window.S || {};
  if(!S.essayFlashRated) S.essayFlashRated = {};
  return S.essayFlashRated;
}
function _setProgress(id, rating){
  const p = _getProgress();
  p[id] = rating;
  saveState();
}

// ─── 스타일 주입 (1회) ─────────────────────────────────────────────────
let _stylesInjected = false;
function _injectStyles(){
  if(_stylesInjected) return;
  _stylesInjected = true;
  const css = `
    .ef-back{display:inline-flex;align-items:center;gap:5px;background:transparent;border:1px solid var(--mi-d);color:var(--mo);padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;margin-bottom:10px}
    .ef-back:hover{background:var(--mi-l)}
    .ef-banner{background:linear-gradient(135deg,#7C5810,#5A4008);color:#FFE08A;padding:13px 14px;border-radius:9px;margin-bottom:10px;box-shadow:0 3px 10px rgba(40,25,5,.25)}
    .ef-banner-ttl{font-family:'ZCOOL XiaoWei',serif;font-size:20px;letter-spacing:.06em}
    .ef-banner-sub{font-size:11px;opacity:.85;margin-top:2px}
    .ef-scope-tabs{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:9px}
    .ef-scope-tab{padding:6px 11px;border-radius:14px;border:1px solid var(--mi-d);background:var(--mi-w);color:var(--mo);font-size:11.5px;cursor:pointer;font-family:inherit}
    .ef-scope-tab.on{background:#7C5810;color:#FFE08A;border-color:#5A4008}
    .ef-progress-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:11.5px;color:var(--mo)}
    .ef-progress-bar{flex:1;height:7px;background:var(--mi-d);border-radius:4px;overflow:hidden}
    .ef-progress-fill{height:100%;background:linear-gradient(90deg,#7C5810,#C9A227);transition:width .25s}
    .ef-card{background:var(--mi-w);border:1px solid var(--mi-d);border-radius:11px;padding:14px;margin-bottom:11px;box-shadow:var(--sh-sm)}
    .ef-meta{font-size:10.5px;color:var(--gutong);margin-bottom:6px;letter-spacing:.03em}
    .ef-meta .src{background:#FFE08A;color:#3A1810;padding:1.5px 6px;border-radius:9px;font-weight:600;margin-right:5px}
    .ef-meta .ch{background:#E5F0E0;color:#1A4030;padding:1.5px 6px;border-radius:9px;margin-right:5px}
    .ef-meta .fm{color:var(--zhusha-d);font-weight:600}
    .ef-q{font-size:14.5px;color:var(--mo);line-height:1.7;margin-bottom:11px;padding:11px;background:#FAF1E0;border-left:3px solid #7C5810;border-radius:0 6px 6px 0}
    .ef-q b{color:#7C5810}
    .ef-reveal-btn{display:block;width:100%;padding:11px;background:linear-gradient(135deg,#7C5810,#5A4008);color:#FFE08A;border:none;border-radius:7px;font-family:'ZCOOL XiaoWei',serif;font-size:14px;letter-spacing:.07em;cursor:pointer;transition:transform .12s}
    .ef-reveal-btn:hover{transform:translateY(-1px);box-shadow:0 3px 9px rgba(60,30,5,.25)}
    .ef-answer{margin-top:13px;padding-top:13px;border-top:1px dashed var(--mi-d)}
    .ef-kp-ttl{font-family:'ZCOOL XiaoWei',serif;font-size:13px;color:#7C5810;margin-bottom:6px}
    .ef-kp-list{list-style:none;padding:0;margin:0 0 11px}
    .ef-kp-list li{padding:5px 8px 5px 22px;font-size:12.5px;line-height:1.55;color:var(--mo);background:#FAF1E0;border-radius:5px;margin-bottom:3px;position:relative}
    .ef-kp-list li::before{content:'✓';position:absolute;left:7px;top:5px;color:#3A6A4A;font-weight:700}
    .ef-model-ttl{font-family:'ZCOOL XiaoWei',serif;font-size:13px;color:var(--zhusha-d);margin-bottom:6px}
    .ef-model{font-size:12.5px;line-height:1.8;color:var(--mo);padding:10px 12px;background:#FFF;border:1px solid var(--mi-d);border-radius:6px}
    .ef-rate-row{display:flex;gap:6px;margin-top:11px}
    .ef-rate-btn{flex:1;padding:9px;border-radius:6px;border:1px solid var(--mi-d);background:var(--mi-w);font-family:'ZCOOL XiaoWei',serif;font-size:12.5px;cursor:pointer;transition:all .12s}
    .ef-rate-easy{color:#3A6A4A;border-color:#3A6A4A}
    .ef-rate-easy:hover,.ef-rate-easy.on{background:#3A6A4A;color:#FFE08A}
    .ef-rate-mid{color:#7C5810;border-color:#7C5810}
    .ef-rate-mid:hover,.ef-rate-mid.on{background:#7C5810;color:#FFE08A}
    .ef-rate-again{color:#9C3030;border-color:#9C3030}
    .ef-rate-again:hover,.ef-rate-again.on{background:#9C3030;color:#FFE08A}
    .ef-nav-row{display:flex;justify-content:space-between;align-items:center;margin-top:9px;gap:8px}
    .ef-nav-btn{padding:8px 14px;border-radius:6px;border:1px solid var(--mi-d);background:var(--mi-w);color:var(--mo);font-size:12.5px;cursor:pointer}
    .ef-nav-btn:hover{background:var(--mi-l)}
    .ef-nav-btn:disabled{opacity:.4;cursor:not-allowed}
    .ef-empty{text-align:center;padding:30px;color:var(--gutong);font-size:13px}
    .ef-status-pill{display:inline-block;padding:1.5px 6px;border-radius:9px;font-size:10px;margin-left:5px}
    .ef-status-easy{background:#3A6A4A;color:#FFE08A}
    .ef-status-mid{background:#7C5810;color:#FFE08A}
    .ef-status-again{background:#9C3030;color:#FFE08A}
  `;
  const s = document.createElement('style'); s.id='ef-styles'; s.textContent=css;
  document.head.appendChild(s);
}

// ─── 범위 필터 ─────────────────────────────────────────────────────────
function _filterByScope(scope){
  const all = window.ESSAY_EXAMS || [];
  if(!scope || scope === 'all') return all;
  if(scope === 'ch7') return all.filter(e => String(e.chapter).startsWith('7'));
  if(scope === 'ch8') return all.filter(e => String(e.chapter).startsWith('8'));
  if(scope === 'weak'){
    const p = _getProgress();
    return all.filter(e => p[e.id] === 'again' || p[e.id] === 'mid');
  }
  if(scope === 'unrated'){
    const p = _getProgress();
    return all.filter(e => !p[e.id]);
  }
  return all;
}

// ─── 상태 ──────────────────────────────────────────────────────────────
let SES = null;  // { cards, idx, revealed, scope }

// ─── 메인 화면 ─────────────────────────────────────────────────────────
function open(scope){
  _injectStyles();
  scope = scope || (SES && SES.scope) || 'all';
  const cards = _filterByScope(scope);
  if(!cards.length){
    const view = document.getElementById('view');
    view.innerHTML = `
      <button class="ef-back" type="button" id="ef-back">← 플래시 허브</button>
      <div class="ef-banner">
        <div class="ef-banner-ttl">서술형 기출</div>
        <div class="ef-banner-sub">22·21·20·19·18학번 4년치 · 7장 표리쌍해제 + 8장 보익제 (보혈제까지)</div>
      </div>
      <div class="ef-card ef-empty">
        <div style="font-family:'ZCOOL XiaoWei',serif;font-size:22px;color:#7C5810;margin-bottom:6px">無</div>
        <div>해당 범위에 카드가 없습니다.<br>전체 보기로 돌아가세요.</div>
        <button class="ef-nav-btn" type="button" id="ef-empty-all" style="margin-top:14px">전체 카드</button>
      </div>
    `;
    $('#ef-back') && $('#ef-back').addEventListener('click', _backToHub);
    $('#ef-empty-all') && $('#ef-empty-all').addEventListener('click', () => open('all'));
    return;
  }
  SES = { cards, idx: 0, revealed: false, scope };
  _render();
}

function _backToHub(){
  if(typeof window.renderFlashHub === 'function') window.renderFlashHub();
  else if(typeof window.setTab === 'function') window.setTab('flash');
}

function _render(){
  if(!SES) return;
  const view = document.getElementById('view');
  if(!view) return;
  const c = SES.cards[SES.idx];
  const total = SES.cards.length;
  const prog = _getProgress();
  // 진행도 통계
  let rEasy=0, rMid=0, rAgain=0, rUnrated=0;
  SES.cards.forEach(card => {
    const r = prog[card.id];
    if(r === 'easy') rEasy++;
    else if(r === 'mid') rMid++;
    else if(r === 'again') rAgain++;
    else rUnrated++;
  });
  const pctEasy = total > 0 ? Math.round((rEasy / total) * 100) : 0;
  
  // 범위 탭
  const scopes = [
    { k:'all',     lb:'전체',          n: (window.ESSAY_EXAMS||[]).length },
    { k:'ch7',     lb:'7장 表裏雙解',   n: _filterByScope('ch7').length },
    { k:'ch8',     lb:'8장 補益',       n: _filterByScope('ch8').length },
    { k:'weak',    lb:'다시 보기',      n: _filterByScope('weak').length },
    { k:'unrated', lb:'미평가',         n: _filterByScope('unrated').length },
  ];
  const tabsHTML = scopes.map(s => `<button class="ef-scope-tab ${SES.scope === s.k ? 'on' : ''}" type="button" data-s="${s.k}">${esc(s.lb)} (${s.n})</button>`).join('');
  
  // 현재 카드 평가 상태
  const curRating = prog[c.id];
  const statusPill = curRating === 'easy' ? `<span class="ef-status-pill ef-status-easy">익숙</span>`
                  : curRating === 'mid'   ? `<span class="ef-status-pill ef-status-mid">보통</span>`
                  : curRating === 'again' ? `<span class="ef-status-pill ef-status-again">다시</span>`
                  : '';
  
  // 답안 영역
  const answerHTML = SES.revealed ? `
    <div class="ef-answer">
      <div class="ef-kp-ttl">★ 채점 핵심 키워드</div>
      <ul class="ef-kp-list">
        ${(c.keypoints||[]).map(k => `<li>${esc(k)}</li>`).join('')}
      </ul>
      <div class="ef-model-ttl">📝 모범 답안</div>
      <div class="ef-model">${esc(c.model)}</div>
      <div class="ef-rate-row">
        <button class="ef-rate-btn ef-rate-easy ${curRating==='easy'?'on':''}" type="button" data-rate="easy">익숙</button>
        <button class="ef-rate-btn ef-rate-mid ${curRating==='mid'?'on':''}" type="button" data-rate="mid">보통</button>
        <button class="ef-rate-btn ef-rate-again ${curRating==='again'?'on':''}" type="button" data-rate="again">다시</button>
      </div>
    </div>
  ` : `
    <button class="ef-reveal-btn" type="button" id="ef-reveal">★ 답안 보기 (스스로 떠올린 뒤 비교)</button>
  `;
  
  view.innerHTML = `
    <button class="ef-back" type="button" id="ef-back">← 플래시 허브</button>
    <div class="ef-banner">
      <div class="ef-banner-ttl">서술형 기출 · ${SES.idx+1} / ${total}</div>
      <div class="ef-banner-sub">22·21·20·19·18학번 4년치 · 시험 범위 (표리쌍해제 + 보익제 보혈제까지)</div>
    </div>
    <div class="ef-scope-tabs" id="ef-scope-tabs">${tabsHTML}</div>
    <div class="ef-progress-row">
      <span style="color:#3A6A4A">익숙 <b>${rEasy}</b></span>
      <span style="color:#7C5810">보통 <b>${rMid}</b></span>
      <span style="color:#9C3030">다시 <b>${rAgain}</b></span>
      <span style="color:var(--gutong)">미평 <b>${rUnrated}</b></span>
      <div class="ef-progress-bar"><div class="ef-progress-fill" style="width:${pctEasy}%"></div></div>
      <span style="font-weight:700">${pctEasy}%</span>
    </div>
    <div class="ef-card">
      <div class="ef-meta">
        <span class="src">${esc(c.src)}</span>
        <span class="ch">${esc(c.chapter)}</span>
        <span class="fm">${esc(c.formula)}</span>
        ${statusPill}
      </div>
      <div class="ef-q"><b>Q.</b> ${esc(c.q)}</div>
      ${answerHTML}
    </div>
    <div class="ef-nav-row">
      <button class="ef-nav-btn" type="button" id="ef-prev" ${SES.idx===0?'disabled':''}>← 이전</button>
      <span style="font-size:11px;color:var(--gutong)">${SES.idx+1} / ${total}</span>
      <button class="ef-nav-btn" type="button" id="ef-next" ${SES.idx===total-1?'disabled':''}>다음 →</button>
    </div>
  `;
  
  // 이벤트 바인딩
  $('#ef-back').addEventListener('click', _backToHub);
  $$('#ef-scope-tabs .ef-scope-tab').forEach(b => b.addEventListener('click', () => {
    open(b.dataset.s);
  }));
  const rv = $('#ef-reveal');
  if(rv) rv.addEventListener('click', () => { SES.revealed = true; _render(); });
  $$('.ef-rate-btn').forEach(b => b.addEventListener('click', () => {
    _setProgress(c.id, b.dataset.rate);
    toast(`평가: ${b.textContent}`, 'gold');
    // 자동으로 다음 카드
    setTimeout(() => {
      if(SES.idx < total - 1){ SES.idx++; SES.revealed = false; _render(); }
      else { toast('마지막 카드 완료', 'gold'); _render(); }
    }, 400);
  }));
  $('#ef-prev').addEventListener('click', () => {
    if(SES.idx > 0){ SES.idx--; SES.revealed = false; _render(); }
  });
  $('#ef-next').addEventListener('click', () => {
    if(SES.idx < total - 1){ SES.idx++; SES.revealed = false; _render(); }
  });
}

// ─── 외부 노출 ─────────────────────────────────────────────────────────
window.V11EssayFlash = {
  open,
  getProgress: _getProgress,
};

})();
