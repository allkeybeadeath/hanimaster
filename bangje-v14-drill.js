/* bangje-v14-drill.js — v14.2 「原文 配列 드릴」 엔진
 * ============================================================================
 *  - 처방별 한문 원문을 무작위 토막으로 섞은 뒤 순서대로 재배열하는 드릴
 *  - 챕터 분리: 표리쌍해제 / 보익제
 *  - 처방별로 순차 진행 (1처방 끝나면 다음 처방으로)
 *  - 인터랙션: 토막 클릭으로 슬롯 채움 / 슬롯 클릭으로 되돌리기
 *  - 채점: 즉시 채점 (정답 위치 = 초록, 오답 = 빨강)
 *  - 진도 저장: localStorage에 마지막 위치 저장
 *
 *  외부 API: window.V14Drill = { open, render }
 *  라우트: ROUTES.drill
 * ============================================================================ */
(function(){
'use strict';

function $(s,r){ return (r||document).querySelector(s); }
function $$(s,r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ─────────────────────────────────────────────────────────────────────
// 상태
// ─────────────────────────────────────────────────────────────────────
const STATE = {
  chapter: 'pyori',     // pyori / boik
  index: 0,              // 현재 문제 index
  slots: [],             // 사용자가 채운 토막 인덱스 (null = 비어있음)
  pool: [],              // 토막 풀의 순서 (셔플된 원본 idx 배열)
  taken: new Set(),      // 이미 슬롯에 들어간 풀 인덱스
  graded: false,         // 채점 완료 여부
  showHint: false,       // 한글 해석 힌트 표시 여부
  // 통계
  correct: 0,
  tried: 0,
};

const LS_KEY = 'v14_drill_progress';
function saveProgress(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify({
      chapter: STATE.chapter,
      index: STATE.index,
      correct: STATE.correct,
      tried: STATE.tried,
    }));
  }catch(_){}
}
function loadProgress(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if(s.chapter) STATE.chapter = s.chapter;
    if(typeof s.index === 'number') STATE.index = s.index;
    if(typeof s.correct === 'number') STATE.correct = s.correct;
    if(typeof s.tried === 'number') STATE.tried = s.tried;
  }catch(_){}
}

// ─────────────────────────────────────────────────────────────────────
// 스타일 주입
// ─────────────────────────────────────────────────────────────────────
function injectStyles(){
  if(document.getElementById('v14d-style')) return;
  const s = document.createElement('style');
  s.id = 'v14d-style';
  s.textContent = `
    .v14d-wrap{
      max-width:680px;margin:0 auto;padding:12px 12px 90px;
      font-family:var(--font-body,'Noto Serif KR',serif);color:var(--mo,#1C140A);
    }
    .v14d-hdr{
      background:linear-gradient(180deg,#1C140A 0%,#3A2A18 100%);
      color:var(--huang-l,#FFE08A);padding:16px;border-radius:var(--r-lg,14px);
      border:2px solid var(--huang,#C9A227);position:relative;overflow:hidden;
      box-shadow:var(--sh-lg,0 8px 24px rgba(0,0,0,.32));
    }
    .v14d-hdr::before{
      content:'';position:absolute;top:-30px;right:-30px;width:120px;height:120px;
      background:radial-gradient(circle,rgba(184,82,26,.22) 0%,transparent 70%);
    }
    .v14d-hdr .seal{
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:28px;
      letter-spacing:.1em;color:var(--huang-l,#FFE08A);text-shadow:2px 2px 0 rgba(0,0,0,.4);
    }
    .v14d-hdr .sub{font-size:11.5px;opacity:.85;margin-top:4px;letter-spacing:.12em}
    .v14d-back{
      position:absolute;top:10px;right:12px;background:rgba(252,244,229,.12);
      border:1px solid var(--huang,#C9A227);color:var(--huang-l,#FFE08A);
      padding:5px 11px;border-radius:8px;font-size:11.5px;cursor:pointer;font-family:inherit;
    }
    .v14d-back:hover{background:rgba(252,244,229,.22)}

    /* 챕터 탭 */
    .v14d-chapters{display:flex;gap:6px;margin:14px 0 10px}
    .v14d-chap{
      flex:1;background:#FFF;border:1.5px solid var(--gutong,#876A36);
      padding:11px 10px;font-family:inherit;font-size:14px;cursor:pointer;
      border-radius:8px;font-weight:600;color:var(--mo,#1C140A);
      transition:all .15s;
    }
    .v14d-chap:hover{transform:translateY(-1px)}
    .v14d-chap.active{
      background:var(--zhusha,#9C3030);color:var(--huang-l,#FFE08A);
      border-color:var(--zhusha-d,#6E1818);box-shadow:0 2px 6px rgba(110,24,24,.3);
    }
    .v14d-chap.bo.active{background:var(--huang-d,#8C6818);border-color:#5A4008}
    .v14d-chap .n{font-size:11px;opacity:.7;margin-left:5px}

    /* 진도 바 */
    .v14d-progress{
      background:#FFF;border:1.5px solid var(--gutong,#876A36);border-radius:8px;
      padding:10px 12px;margin-bottom:14px;
      display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12.5px;
    }
    .v14d-progress .lbl{font-family:var(--font-display,'ZCOOL XiaoWei',serif);letter-spacing:.08em;color:var(--zhusha-d,#6E1818);font-weight:700}
    .v14d-progress .bar{flex:1;min-width:140px;height:8px;background:var(--mi-d,#E8D4B8);border-radius:4px;overflow:hidden;position:relative}
    .v14d-progress .bar-fill{position:absolute;top:0;left:0;height:100%;background:linear-gradient(90deg,var(--zhusha,#9C3030),var(--huang-d,#8C6818));transition:width .3s}
    .v14d-progress .stat{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--gutong,#876A36);font-weight:600}

    /* 문제 카드 */
    .v14d-card{
      background:var(--mi-w,#FCF4E5);border:2px solid var(--gutong,#876A36);
      border-radius:var(--r-lg,14px);padding:16px;
      box-shadow:var(--sh,0 3px 10px rgba(0,0,0,.22));margin-bottom:14px;
    }
    .v14d-card-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1.5px dashed var(--mi-d,#E8D4B8)}
    .v14d-rx{
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);
      font-size:24px;letter-spacing:.05em;color:var(--zhusha-d,#6E1818);
    }
    .v14d-rx .ko{font-size:12px;color:var(--gutong,#876A36);margin-left:6px;font-family:inherit;letter-spacing:0}
    .v14d-level{
      background:var(--zhusha,#9C3030);color:var(--huang-l,#FFE08A);
      padding:3px 8px;font-size:10.5px;border-radius:5px;letter-spacing:.1em;
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);
    }
    .v14d-level.lv2{background:var(--huang-d,#8C6818)}
    .v14d-level.lv3{background:#5D3A6E}
    .v14d-title{font-size:13px;font-weight:700;color:var(--mo,#1C140A);margin-bottom:3px}
    .v14d-source{font-size:11px;color:var(--gutong,#876A36);letter-spacing:.05em;margin-bottom:8px;font-family:var(--font-han,'Noto Serif SC',serif)}

    /* 슬롯 영역 (정답 자리) */
    .v14d-slots-label{
      font-size:11px;color:var(--zhusha-d,#6E1818);letter-spacing:.1em;
      font-weight:700;margin:4px 0 6px;
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);
    }
    .v14d-slots{
      display:flex;flex-wrap:wrap;gap:6px;
      min-height:60px;padding:10px;
      background:#FFFDF6;border:2px dashed var(--gutong,#876A36);
      border-radius:8px;margin-bottom:14px;
      font-family:var(--font-han,'Noto Serif SC',serif);
      line-height:1.7;
    }
    .v14d-slot{
      display:inline-flex;align-items:center;justify-content:center;
      min-width:54px;padding:6px 11px;font-size:15px;font-weight:700;
      border-radius:6px;cursor:pointer;
      border:2px solid transparent;transition:all .15s;
    }
    .v14d-slot.empty{
      background:transparent;border:2px dashed #C8B89A;color:#C8B89A;
      cursor:default;min-width:54px;
    }
    .v14d-slot.filled{
      background:var(--mi-d,#E8D4B8);color:var(--mo,#1C140A);
      border-color:var(--gutong,#876A36);
    }
    .v14d-slot.filled:hover:not(.graded){
      background:#F0DDB6;transform:translateY(-1px);
    }
    .v14d-slot.correct{
      background:#C8E6C9;color:#1B5E20;border-color:#2E6B48;
      box-shadow:0 1px 4px rgba(46,107,72,.3);
    }
    .v14d-slot.wrong{
      background:#FFCDD2;color:#7A1818;border-color:#A82828;
      animation:v14d-shake .4s;
    }
    @keyframes v14d-shake{
      0%,100%{transform:translateX(0)}
      25%{transform:translateX(-3px)}
      75%{transform:translateX(3px)}
    }
    .v14d-slot .num{
      font-size:9px;font-family:'JetBrains Mono',monospace;
      background:rgba(0,0,0,.1);padding:1px 4px;border-radius:3px;
      margin-right:5px;color:var(--zhusha-d,#6E1818);font-weight:700;
    }

    /* 토막 풀 (선택지) */
    .v14d-pool-label{
      font-size:11px;color:var(--gutong,#876A36);letter-spacing:.1em;
      font-weight:700;margin:6px 0;
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);
    }
    .v14d-pool{
      display:flex;flex-wrap:wrap;gap:6px;
      padding:10px;background:#FFF;border:1.5px solid var(--gutong,#876A36);
      border-radius:8px;
      font-family:var(--font-han,'Noto Serif SC',serif);
    }
    .v14d-tok{
      padding:8px 12px;font-size:15px;font-weight:700;
      background:#FFF8E8;border:1.5px solid var(--gutong,#876A36);
      border-radius:6px;cursor:pointer;color:var(--mo,#1C140A);
      transition:all .12s;user-select:none;-webkit-user-select:none;
      box-shadow:0 1px 3px rgba(0,0,0,.1);
    }
    .v14d-tok:hover{
      background:var(--huang-l,#FFE08A);transform:translateY(-1px);
      box-shadow:0 2px 6px rgba(140,104,24,.3);
    }
    .v14d-tok:active{transform:translateY(0)}
    .v14d-tok.used{
      background:#EEE;color:#BBB;cursor:not-allowed;
      box-shadow:none;border-color:#DDD;
    }
    .v14d-tok.used:hover{transform:none;background:#EEE}

    /* 컨트롤 버튼 */
    .v14d-ctrls{
      display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;
    }
    .v14d-btn{
      flex:1;min-width:90px;padding:11px 14px;border-radius:8px;
      font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;
      border:2px solid var(--gutong,#876A36);background:#FFF;
      color:var(--mo,#1C140A);transition:all .15s;letter-spacing:.05em;
    }
    .v14d-btn:hover{transform:translateY(-1px);box-shadow:0 3px 8px rgba(0,0,0,.15)}
    .v14d-btn:active{transform:translateY(0)}
    .v14d-btn.primary{
      background:var(--zhusha,#9C3030);color:var(--huang-l,#FFE08A);
      border-color:var(--zhusha-d,#6E1818);
    }
    .v14d-btn.primary:hover{background:var(--zhusha-d,#6E1818)}
    .v14d-btn.next{
      background:var(--feicui,#2A7060);color:#E0FFF0;
      border-color:#1A4030;
    }
    .v14d-btn.next:hover{background:#1A4030}
    .v14d-btn:disabled{
      opacity:.45;cursor:not-allowed;transform:none;
    }
    .v14d-btn:disabled:hover{transform:none;box-shadow:none}

    /* 해석 박스 */
    .v14d-hint-box{
      background:linear-gradient(135deg,#FFF6E0,var(--mi-w,#FCF4E5));
      border-left:5px solid var(--huang-d,#8C6818);
      padding:10px 13px;margin:10px 0;font-size:12.5px;line-height:1.7;
      border-radius:4px;color:var(--mo,#1C140A);
    }
    .v14d-hint-box .lab{
      display:inline-block;background:var(--huang-d,#8C6818);color:#FFF;
      padding:2px 7px;font-size:10px;letter-spacing:.1em;font-weight:700;
      margin-right:6px;border-radius:3px;
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);
    }

    /* 결과 메시지 */
    .v14d-result{
      margin-top:14px;padding:12px 14px;border-radius:8px;font-size:14px;
      font-weight:700;text-align:center;letter-spacing:.05em;
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);
    }
    .v14d-result.win{
      background:#E8F5E9;color:#1B5E20;border:2px solid #2E6B48;
    }
    .v14d-result.lose{
      background:#FFEBEE;color:#7A1818;border:2px solid #A82828;
    }

    /* 완료 화면 */
    .v14d-complete{
      text-align:center;padding:40px 20px;background:var(--mi-w,#FCF4E5);
      border:2px solid var(--huang,#C9A227);border-radius:var(--r-lg,14px);
      box-shadow:var(--sh-lg,0 8px 24px rgba(0,0,0,.32));
    }
    .v14d-complete .big{
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);
      font-size:48px;color:var(--zhusha-d,#6E1818);
      letter-spacing:.1em;margin-bottom:8px;
    }
    .v14d-complete .msg{font-size:14px;color:var(--gutong,#876A36);margin-bottom:16px}
    .v14d-complete .score{
      font-family:'JetBrains Mono',monospace;font-size:32px;font-weight:800;
      color:var(--huang-d,#8C6818);margin:12px 0;
    }

    @media(max-width:520px){
      .v14d-wrap{padding:10px 8px 90px}
      .v14d-rx{font-size:20px}
      .v14d-slot,.v14d-tok{font-size:14px;padding:6px 9px}
      .v14d-hdr .seal{font-size:22px}
    }
  `;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────
function shuffleIndices(n){
  // 절대 정답 순서가 나오지 않도록 셔플 (length>=2일 때)
  const arr = Array.from({length:n}, (_,i) => i);
  if(n < 2) return arr;
  do {
    for(let i = arr.length-1; i>0; i--){
      const j = Math.floor(Math.random() * (i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  } while(arr.every((v,i) => v===i));  // 정답 그대로면 다시
  return arr;
}

function getCurrentProblem(){
  const D = window.V14_DRILLS;
  if(!D || !D[STATE.chapter]) return null;
  const list = D[STATE.chapter];
  if(STATE.index < 0 || STATE.index >= list.length) return null;
  return list[STATE.index];
}

function getChapterTotal(){
  const D = window.V14_DRILLS;
  if(!D || !D[STATE.chapter]) return 0;
  return D[STATE.chapter].length;
}

// ─────────────────────────────────────────────────────────────────────
// 문제 초기화
// ─────────────────────────────────────────────────────────────────────
function initProblem(){
  const p = getCurrentProblem();
  if(!p){ STATE.slots = []; STATE.pool = []; return; }
  const n = p.tokens.length;
  STATE.slots = new Array(n).fill(null);
  STATE.pool = shuffleIndices(n);
  STATE.taken = new Set();
  STATE.graded = false;
}

// ─────────────────────────────────────────────────────────────────────
// 액션
// ─────────────────────────────────────────────────────────────────────
function placeToken(poolIdx){
  if(STATE.graded) return;
  if(STATE.taken.has(poolIdx)) return;
  // 첫 번째 비어있는 슬롯에 배치
  const slotIdx = STATE.slots.indexOf(null);
  if(slotIdx === -1) return;
  // 실제 토큰의 원본 인덱스 = STATE.pool[poolIdx]
  STATE.slots[slotIdx] = STATE.pool[poolIdx];
  STATE.taken.add(poolIdx);
  renderProblem();
}

function unplaceSlot(slotIdx){
  if(STATE.graded) return;
  const origIdx = STATE.slots[slotIdx];
  if(origIdx == null) return;
  // 어느 풀 인덱스인지 찾아서 taken에서 제거
  const poolIdx = STATE.pool.indexOf(origIdx);
  if(poolIdx !== -1) STATE.taken.delete(poolIdx);
  STATE.slots[slotIdx] = null;
  renderProblem();
}

function gradeProblem(){
  const p = getCurrentProblem();
  if(!p) return;
  // 모든 슬롯 채워졌는지
  if(STATE.slots.some(s => s == null)){
    alert('모든 빈 칸을 채워주세요!');
    return;
  }
  STATE.graded = true;
  const correct = STATE.slots.every((origIdx, i) => origIdx === i);
  STATE.tried++;
  if(correct) STATE.correct++;
  saveProgress();
  renderProblem();
}

function resetProblem(){
  initProblem();
  renderProblem();
}

function nextProblem(){
  STATE.index++;
  if(STATE.index >= getChapterTotal()){
    // 챕터 끝
    renderComplete();
    return;
  }
  initProblem();
  saveProgress();
  renderProblem();
}

function prevProblem(){
  if(STATE.index <= 0) return;
  STATE.index--;
  initProblem();
  saveProgress();
  renderProblem();
}

function changeChapter(ch){
  STATE.chapter = ch;
  STATE.index = 0;
  initProblem();
  saveProgress();
  renderProblem();
}

// ─────────────────────────────────────────────────────────────────────
// 렌더링
// ─────────────────────────────────────────────────────────────────────
function renderShell(){
  const view = document.getElementById('view');
  if(!view) return;
  injectStyles();

  const D = window.V14_DRILLS;
  if(!D){
    view.innerHTML = '<div style="padding:20px">드릴 데이터(data-v14-drill.js)가 로드되지 않았습니다.</div>';
    return;
  }
  const S = window.V14_DRILL_STATS || { pyori:0, boik:0 };

  view.innerHTML = `
    <div class="v14d-wrap" id="v14d-wrap">
      <div class="v14d-hdr">
        <button class="v14d-back" id="v14d-back">← 뒤로</button>
        <div class="seal">原文 配列 드릴</div>
        <div class="sub">족보 한문 원문을 토막내어 순서대로 배열 · 시험 대비 암기 훈련</div>
      </div>

      <div class="v14d-chapters">
        <button class="v14d-chap" data-ch="pyori">表裏雙解劑<span class="n">${S.pyori}</span></button>
        <button class="v14d-chap bo" data-ch="boik">補益劑<span class="n">${S.boik}</span></button>
      </div>

      <div class="v14d-progress">
        <span class="lbl">진도</span>
        <div class="bar"><div class="bar-fill" id="v14d-bar"></div></div>
        <span class="stat" id="v14d-stat">─</span>
      </div>

      <div id="v14d-body"></div>
    </div>
  `;

  $('#v14d-back').onclick = () => {
    if(window.V14PyoriBoMap && window.V14PyoriBoMap.open) window.V14PyoriBoMap.open();
    else if(window.V11ClinicHub && window.V11ClinicHub.open) window.V11ClinicHub.open();
    else if(window.ROUTES && window.ROUTES.hub) window.ROUTES.hub();
    else if(window.ROUTES && window.ROUTES.home) window.ROUTES.home();
    else history.back();
  };
  $$('.v14d-chap').forEach(b => {
    b.onclick = () => changeChapter(b.dataset.ch);
  });

  renderProblem();
}

function renderProblem(){
  const body = $('#v14d-body');
  if(!body) return;

  // 챕터 탭 활성화
  $$('.v14d-chap').forEach(b => {
    b.classList.toggle('active', b.dataset.ch === STATE.chapter);
  });

  const total = getChapterTotal();
  const p = getCurrentProblem();
  if(!p){
    body.innerHTML = '<div style="padding:20px;text-align:center">문제 없음.</div>';
    return;
  }

  // 진도 바
  const bar = $('#v14d-bar');
  const stat = $('#v14d-stat');
  if(bar) bar.style.width = ((STATE.index+1) / total * 100) + '%';
  if(stat){
    const acc = STATE.tried > 0 ? Math.round(STATE.correct/STATE.tried*100) : 0;
    stat.textContent = `${STATE.index+1}/${total} · 정답률 ${acc}% (${STATE.correct}/${STATE.tried})`;
  }

  // 정답 여부 (채점됐을 때)
  let resultBar = '';
  if(STATE.graded){
    const correct = STATE.slots.every((origIdx, i) => origIdx === i);
    if(correct){
      resultBar = `<div class="v14d-result win">✓ 正解! 잘 외우셨습니다.</div>`;
    } else {
      const cnt = STATE.slots.filter((v,i) => v===i).length;
      resultBar = `<div class="v14d-result lose">✗ ${cnt}/${STATE.slots.length} 정답. 색상으로 확인하세요.</div>`;
    }
  }

  // 슬롯 영역
  const slotsHtml = STATE.slots.map((origIdx, i) => {
    if(origIdx == null){
      return `<span class="v14d-slot empty">·</span>`;
    }
    let cls = 'v14d-slot filled';
    if(STATE.graded){
      cls += origIdx === i ? ' correct graded' : ' wrong graded';
    }
    const text = p.tokens[origIdx];
    return `<span class="${cls}" data-slot="${i}"><span class="num">${i+1}</span>${esc(text)}</span>`;
  }).join('');

  // 풀 영역
  const poolHtml = STATE.pool.map((origIdx, poolIdx) => {
    const used = STATE.taken.has(poolIdx);
    return `<span class="v14d-tok ${used?'used':''}" data-pool="${poolIdx}">${esc(p.tokens[origIdx])}</span>`;
  }).join('');

  const levelCls = p.level === 3 ? 'lv3' : (p.level === 2 ? 'lv2' : '');
  const levelLabel = p.level === 3 ? '上' : (p.level === 2 ? '中' : '初');

  // 해석 박스
  const hintHtml = STATE.showHint || STATE.graded
    ? `<div class="v14d-hint-box"><span class="lab">解</span>${esc(p.meaning || '')}</div>`
    : '';

  // 컨트롤
  const allFilled = STATE.slots.every(s => s != null);
  let ctrlsHtml = '';
  if(STATE.graded){
    ctrlsHtml = `
      <button class="v14d-btn" id="v14d-prev" ${STATE.index === 0 ? 'disabled' : ''}>← 이전</button>
      <button class="v14d-btn" id="v14d-retry">다시 풀기</button>
      <button class="v14d-btn next" id="v14d-next">${STATE.index === total-1 ? '완료 →' : '다음 →'}</button>
    `;
  } else {
    ctrlsHtml = `
      <button class="v14d-btn" id="v14d-prev" ${STATE.index === 0 ? 'disabled' : ''}>← 이전</button>
      <button class="v14d-btn" id="v14d-hint">${STATE.showHint ? '해석 숨기기' : '해석 보기'}</button>
      <button class="v14d-btn" id="v14d-reset">초기화</button>
      <button class="v14d-btn primary" id="v14d-grade" ${allFilled ? '' : 'disabled'}>채점 ✓</button>
    `;
  }

  body.innerHTML = `
    <div class="v14d-card">
      <div class="v14d-card-hd">
        <div>
          <div class="v14d-rx">${esc(p.rx)}<span class="ko">${esc(p.ko)}</span></div>
          <div class="v14d-title">${esc(p.title)}</div>
          <div class="v14d-source">出 · ${esc(p.source)}</div>
        </div>
        <span class="v14d-level ${levelCls}">${levelLabel}</span>
      </div>

      <div class="v14d-slots-label">▼ 정답 자리 (탭하면 되돌리기)</div>
      <div class="v14d-slots" id="v14d-slots">${slotsHtml}</div>

      <div class="v14d-pool-label">▼ 토막 (탭하여 채우기)</div>
      <div class="v14d-pool" id="v14d-pool">${poolHtml}</div>

      ${hintHtml}
      ${resultBar}

      <div class="v14d-ctrls">${ctrlsHtml}</div>
    </div>
  `;

  // 이벤트
  $$('#v14d-pool .v14d-tok').forEach(el => {
    el.onclick = () => {
      if(el.classList.contains('used')) return;
      const poolIdx = parseInt(el.dataset.pool, 10);
      placeToken(poolIdx);
    };
  });
  $$('#v14d-slots .v14d-slot.filled:not(.graded)').forEach(el => {
    el.onclick = () => {
      const slotIdx = parseInt(el.dataset.slot, 10);
      unplaceSlot(slotIdx);
    };
  });

  if($('#v14d-prev'))  $('#v14d-prev').onclick = prevProblem;
  if($('#v14d-grade')) $('#v14d-grade').onclick = gradeProblem;
  if($('#v14d-hint'))  $('#v14d-hint').onclick = () => { STATE.showHint = !STATE.showHint; renderProblem(); };
  if($('#v14d-reset')) $('#v14d-reset').onclick = resetProblem;
  if($('#v14d-retry')) $('#v14d-retry').onclick = resetProblem;
  if($('#v14d-next'))  $('#v14d-next').onclick = nextProblem;
}

function renderComplete(){
  const body = $('#v14d-body');
  if(!body) return;
  const total = getChapterTotal();
  const chTitle = STATE.chapter === 'pyori' ? '表裏雙解劑' : '補益劑';
  const acc = STATE.tried > 0 ? Math.round(STATE.correct/STATE.tried*100) : 0;
  body.innerHTML = `
    <div class="v14d-complete">
      <div class="big">完</div>
      <div class="msg">${esc(chTitle)} ${total}문제 완료!</div>
      <div class="score">${STATE.correct} / ${STATE.tried}</div>
      <div class="msg">정답률 ${acc}%</div>
      <div class="v14d-ctrls" style="margin-top:20px">
        <button class="v14d-btn" id="v14d-restart">${esc(chTitle)} 다시</button>
        <button class="v14d-btn primary" id="v14d-other">${STATE.chapter === 'pyori' ? '補益劑' : '表裏雙解劑'} 도전</button>
      </div>
    </div>
  `;
  $('#v14d-restart').onclick = () => {
    STATE.index = 0;
    STATE.correct = 0;
    STATE.tried = 0;
    initProblem();
    saveProgress();
    renderProblem();
  };
  $('#v14d-other').onclick = () => {
    changeChapter(STATE.chapter === 'pyori' ? 'boik' : 'pyori');
  };
}

// ─────────────────────────────────────────────────────────────────────
// 진입점
// ─────────────────────────────────────────────────────────────────────
function open(chapter){
  loadProgress();
  if(chapter && (chapter === 'pyori' || chapter === 'boik')){
    STATE.chapter = chapter;
    STATE.index = 0;
  }
  initProblem();
  renderShell();
}

// ─────────────────────────────────────────────────────────────────────
// 배너 주입 (의서궁/홈/방감)
// ─────────────────────────────────────────────────────────────────────
function injectBannerStyles(){
  if(document.getElementById('v14d-banner-style')) return;
  const s = document.createElement('style');
  s.id = 'v14d-banner-style';
  s.textContent = `
    .v14d-banner{
      background:linear-gradient(135deg,#B8521A 0%,#5A2810 100%);
      color:#FFE0CC;padding:13px 15px;border-radius:12px;margin:14px 0;
      cursor:pointer;display:flex;align-items:center;gap:12px;
      box-shadow:0 4px 14px rgba(184,82,26,.3);
      transition:transform .15s,box-shadow .15s;border:2px solid #F0A878;
      font-family:var(--font-body,'Noto Serif KR',serif);
    }
    .v14d-banner:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(184,82,26,.5)}
    .v14d-banner-lg{padding:17px 19px;margin:16px 0;border-width:3px;
      background:linear-gradient(135deg,#D06828 0%,#2E1408 50%,#A04818 100%);
    }
    .v14d-banner .han{
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:36px;color:#FFE0CC;
      line-height:1;text-shadow:2px 2px 0 rgba(0,0,0,.4);min-width:60px;text-align:center;
    }
    .v14d-banner-lg .han{font-size:46px;min-width:78px}
    .v14d-banner .body{flex:1}
    .v14d-banner .ttl{font-size:16px;font-weight:700;color:#FFE0CC;letter-spacing:.05em}
    .v14d-banner-lg .ttl{font-size:19px}
    .v14d-banner .sub{font-size:11px;opacity:.88;margin-top:3px;color:#FFE0CC}
    .v14d-banner .arrow{margin-left:auto;font-size:22px;color:#FFE0CC;opacity:.7}
    .v14d-banner .badge{
      display:inline-block;background:#FFE0CC;color:#5A2810;font-size:9.5px;
      padding:2px 6px;border-radius:8px;font-weight:700;margin-left:6px;
      vertical-align:middle;letter-spacing:.05em;
    }

    /* 방감 헤더의 미니 버튼 */
    .v14d-mini-btn{
      display:inline-flex;align-items:center;gap:5px;
      background:#B8521A;color:#FFE0CC;border:1.5px solid #F0A878;
      padding:6px 11px;border-radius:6px;font-family:inherit;font-size:12px;
      font-weight:600;cursor:pointer;margin-top:8px;margin-left:6px;
    }
    .v14d-mini-btn:hover{background:#5A2810;transform:translateY(-1px)}
    .v14d-mini-btn .han{font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:14px}
  `;
  document.head.appendChild(s);
}

function makeBanner(big){
  const banner = document.createElement('div');
  banner.className = 'v14d-banner' + (big?' v14d-banner-lg':'');
  banner.innerHTML = `
    <div class="han">配</div>
    <div class="body">
      <div class="ttl">原文 配列 드릴 <span class="badge">NEW v14.2</span></div>
      <div class="sub">족보 한문을 토막내어 순서대로 배열 · 표리쌍해제 13문 + 보익제 13문</div>
    </div>
    <div class="arrow">→</div>
  `;
  banner.onclick = () => open();
  return banner;
}

function injectInHub(){
  if(!window.V11ClinicHub || !window.V11ClinicHub.open) return;
  if(window.__v14dHubHooked) return;
  window.__v14dHubHooked = true;
  const orig = window.V11ClinicHub.open;
  window.V11ClinicHub.open = function(){
    orig.apply(this, arguments);
    setTimeout(() => {
      injectBannerStyles();
      const view = document.getElementById('view');
      if(!view) return;
      if(view.querySelector('.v14d-banner')) return;
      const banner = makeBanner(true);
      // 관계도 배너 다음에 (헬게이트 → 방감 → 관계도 → 드릴)
      const gbBanner = view.querySelector('.v14g-banner');
      if(gbBanner && gbBanner.parentNode){
        gbBanner.parentNode.insertBefore(banner, gbBanner.nextSibling);
        return;
      }
      const fjBanner = view.querySelector('.v14-banner');
      if(fjBanner && fjBanner.parentNode){
        fjBanner.parentNode.insertBefore(banner, fjBanner.nextSibling);
        return;
      }
      const hellBanner = view.querySelector('.hg-hellgate-banner');
      if(hellBanner && hellBanner.parentNode){
        hellBanner.parentNode.insertBefore(banner, hellBanner.nextSibling);
        return;
      }
      const grid = view.querySelector('[class*="subject"], [class*="rooms"], .ch-grid, .grid');
      const placeBefore = grid || view.querySelector('.card') || view.firstChild;
      if(placeBefore && placeBefore.parentNode) placeBefore.parentNode.insertBefore(banner, placeBefore);
      else view.appendChild(banner);
    }, 120);  // 관계도(90ms) 이후
  };
  if(window.ROUTES) window.ROUTES.hub = window.V11ClinicHub.open;
}

function injectInHome(){
  if(!window.ROUTES || !window.ROUTES.home) return;
  if(window.__v14dHomeHooked) return;
  window.__v14dHomeHooked = true;
  const orig = window.ROUTES.home;
  window.ROUTES.home = function(){
    orig.apply(this, arguments);
    setTimeout(() => {
      injectBannerStyles();
      const view = document.getElementById('view');
      if(!view) return;
      if(view.querySelector('.v14d-banner')) return;
      const banner = makeBanner(false);
      const gbBanner = view.querySelector('.v14g-banner');
      if(gbBanner && gbBanner.parentNode){
        gbBanner.parentNode.insertBefore(banner, gbBanner.nextSibling);
        return;
      }
      const fjBanner = view.querySelector('.v14-banner');
      if(fjBanner && fjBanner.parentNode){
        fjBanner.parentNode.insertBefore(banner, fjBanner.nextSibling);
        return;
      }
      const hellBanner = view.querySelector('.hg-hellgate-banner');
      if(hellBanner && hellBanner.parentNode){
        hellBanner.parentNode.insertBefore(banner, hellBanner.nextSibling);
        return;
      }
      const firstCard = view.querySelector('.card');
      if(firstCard && firstCard.parentNode) firstCard.parentNode.insertBefore(banner, firstCard.nextSibling);
      else view.appendChild(banner);
    }, 120);
  };
}

function injectInFangjian(){
  if(!window.V14PyoriBoMap || !window.V14PyoriBoMap.open) return;
  if(window.__v14dFjHooked) return;
  window.__v14dFjHooked = true;
  const orig = window.V14PyoriBoMap.open;
  window.V14PyoriBoMap.open = function(){
    orig.apply(this, arguments);
    setTimeout(() => {
      injectBannerStyles();
      const hdr = document.querySelector('.v14-hdr');
      if(!hdr) return;
      if(hdr.querySelector('.v14d-mini-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'v14d-mini-btn';
      btn.innerHTML = `<span class="han">配</span> 原文 드릴 →`;
      btn.onclick = (e) => { e.stopPropagation(); open(); };
      // stamp 다음, 관계도 버튼 다음에
      const grBtn = hdr.querySelector('.v14g-mini-btn');
      if(grBtn && grBtn.parentNode){
        grBtn.parentNode.insertBefore(btn, grBtn.nextSibling);
      } else {
        const stamp = hdr.querySelector('.stamp');
        if(stamp && stamp.parentNode) stamp.parentNode.insertBefore(btn, stamp.nextSibling);
        else hdr.appendChild(btn);
      }
    }, 80);
  };
  if(window.ROUTES) window.ROUTES.fangjian = window.V14PyoriBoMap.open;
}

// ─────────────────────────────────────────────────────────────────────
// 부트스트랩
// ─────────────────────────────────────────────────────────────────────
let _bootTries = 0;
function boot(){
  if(window.ROUTES){
    window.ROUTES.drill = open;
  }
  try{ injectInHub();      }catch(_){}
  try{ injectInHome();     }catch(_){}
  try{ injectInFangjian(); }catch(_){}
  if(_bootTries++ < 30){
    setTimeout(boot, 300);
  }
}
setTimeout(boot, 300);

window.V14Drill = {
  open: open,
  render: renderShell,
};

console.log('[v14.2 드릴] 엔진 ready');

})();
