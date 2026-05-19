/* bangje-v13-hellgate.js — 헬게이트(獄門) 엔진
 * ============================================================================
 *  - 100문제 이상의 주관식·서술형 전용 모드
 *  - 모든 답안: 띄어쓰기 무관·오타 1글자 감안·한글/한자 모두 인정
 *  - 동적 채점:
 *      • composition: 8미 넘는 처방은 8개까지만 적게 → 그 회차에 맞춘 약재는
 *        다음 회차 채점기준에서 제외. 모두 적으면 채점기준 롤백(전체 복원).
 *      • symptoms: 3개만 적게 → 같은 방식 동적 갱신.
 *  - 2시간 전사 모드: 논스톱 무한 반복.
 *
 *  외부 API: window.V13Hellgate = { open, getProgress, resetProgress }
 *  라우트 등록: ROUTES.hellgate = open
 * ============================================================================ */
(function(){
'use strict';

// ─── 기본 헬퍼 ────────────────────────────────────────────────────────────
function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }

// ─── localStorage 상태 키 ──────────────────────────────────────────────────
const LS_PROGRESS = 'hg.progress.v1';
const LS_STATE    = 'hg.session.v1';

/* progress 구조:
 *   {
 *     [questionId]: {
 *       solved:       (composition/symptoms에서 그 회차 맞춘 토큰들)
 *       totalAttempts: 시도횟수
 *       totalCorrect:  완전정답 횟수
 *     }
 *   }
 *
 * composition·symptoms 의 dynamic state:
 *   solved 가 전체와 같아지면 → "롤백" → solved=[]
 *   solved 부분집합이면 → 다음 회차에서 그 토큰들은 채점기준에서 제외
 */
function loadProgress(){
  try{ return JSON.parse(localStorage.getItem(LS_PROGRESS)||'{}'); }
  catch(_){ return {}; }
}
function saveProgress(p){
  try{ localStorage.setItem(LS_PROGRESS, JSON.stringify(p)); }catch(_){}
}
function getQProgress(qid){
  const p = loadProgress();
  return p[qid] || { solved:[], totalAttempts:0, totalCorrect:0 };
}
function setQProgress(qid, qp){
  const p = loadProgress();
  p[qid] = qp;
  saveProgress(p);
}

// ─── 텍스트 정규화 ────────────────────────────────────────────────────────
//   - 모든 공백·구두점 제거
//   - 한자→한자 그대로, 한글→한글 그대로 (양쪽 같은 정규화로 비교)
function normText(s){
  // ':' 는 비율 답안(예 5:1)에 의미가 있으므로 보존
  return String(s||'').toLowerCase()
    .replace(/[\s·,()/\-\[\]{}<>·。、，．\.！？!?'";]+/g,'')
    .replace(/[ㆍ]/g,'');
}

// 1글자 오타 감안 — Levenshtein ≤ 1
function levenshtein1(a, b){
  if(a === b) return true;
  if(Math.abs(a.length - b.length) > 1) return false;
  // 길이 같음 → 한 자리 다름 허용
  if(a.length === b.length){
    let d = 0;
    for(let i=0;i<a.length;i++){
      if(a[i] !== b[i]){ d++; if(d>1) return false; }
    }
    return d <= 1;
  }
  // 길이 1 차이 → 1개 삽입/삭제 허용
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  let i=0, j=0, edits=0;
  while(i < s.length && j < l.length){
    if(s[i] === l[j]){ i++; j++; }
    else { j++; edits++; if(edits>1) return false; }
  }
  return true;
}

// ─── 입력 → 토큰 분할 ─────────────────────────────────────────────────────
//   ',' '/' ' ' '·' '、' '+' 등으로 구분. compound 표기는 그대로 1토큰.
//   띄어쓰기/구분자 없는 한 덩어리도 받아서 sub-herb-scan 으로 약재를 추출.
function tokenize(input){
  if(!input) return [];
  return String(input)
    .replace(/[、，·+]/g, ',')
    .split(/[,/\s]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

// 큰 한 덩어리 문자열 안에서 별칭 longest-match 로 약재들을 추출
function scanHerbsInString(s){
  if(!s) return [];
  // 모든 별칭(원본 표기) + compound 키를 하나의 리스트로
  const aliasMap = window.HG_HERB_ALIASES || {};
  const compounds = window.HG_HERB_COMPOUNDS || {};
  const candidates = [];  // [{token, herbs[]}]
  for(const key in aliasMap){
    aliasMap[key].forEach(a => candidates.push({ token:a, herbs:[key] }));
  }
  for(const k in compounds){
    candidates.push({ token:k, herbs:compounds[k].slice() });
  }
  // longest first 로 매칭
  candidates.sort((a,b) => b.token.length - a.token.length);
  // 공백·구두점 제거한 정규화 입력
  let cur = String(s).replace(/[\s·,()/\-。、，．\.！？!?'":;]+/g,'').toLowerCase();
  const found = [];
  let safety = 200;
  while(cur.length > 0 && safety-- > 0){
    let matched = false;
    for(const c of candidates){
      const tok = c.token.toLowerCase();
      if(cur.startsWith(tok)){
        c.herbs.forEach(h => { if(!found.includes(h)) found.push(h); });
        cur = cur.slice(tok.length);
        matched = true;
        break;
      }
    }
    if(!matched){
      // 한 글자 건너뛰기
      cur = cur.slice(1);
    }
  }
  return found;
}

// ─── 약재 토큰 정규화 + compound 확장 ───────────────────────────────────
//   먼저 토큰별 expand → 매칭 안 되는 큰 한 덩어리는 scanHerbsInString 으로 추출
function tokensToHerbs(tokens, originalInput){
  const expand = window.HG_expandHerbToken;
  const out = [];
  const unresolved = [];
  tokens.forEach(t => {
    const arr = expand ? expand(t) : [t];
    // arr 결과가 [t] 그대로면 (정규화 실패) → unresolved
    if(arr.length === 1 && arr[0] === t.replace(/[\s·,()/\-]+/g,'')){
      unresolved.push(t);
    } else {
      arr.forEach(h => { if(!out.includes(h)) out.push(h); });
    }
  });
  // unresolved 토큰을 scan 으로 한 번 더 분석
  unresolved.forEach(t => {
    scanHerbsInString(t).forEach(h => { if(!out.includes(h)) out.push(h); });
  });
  // originalInput 이 있고 결과가 부족하면 전체 입력 자체를 scan
  if(originalInput && out.length < 3){
    scanHerbsInString(originalInput).forEach(h => { if(!out.includes(h)) out.push(h); });
  }
  return out;
}

// ─── 일반 키워드 매칭 (1글자 오타·별칭 허용) ─────────────────────────────
function matchKeyword(input, kw){
  if(!input || !kw) return false;
  const a = normText(input), b = normText(kw);
  if(!a || !b) return false;
  if(a.includes(b)) return true;
  if(b.includes(a) && a.length >= 2) return true;
  // 1글자 오타 — 길이 2 이상 토큰만
  if(a.length >= 3 && b.length >= 3){
    // sliding window over a
    for(let i=0;i<=a.length-b.length+1 && i<a.length;i++){
      const slice = a.slice(i, i+b.length);
      if(levenshtein1(slice, b)) return true;
    }
  }
  return false;
}

// 토큰 단위로 입력에 있는지 확인 (개별 토큰 vs keyword)
function anyTokenMatches(tokens, kw){
  if(tokens.some(t => matchKeyword(t, kw))) return true;
  // 전체 입력문자열 vs kw 도 시도 (서술형 답안에서 한 줄로 적은 경우)
  const joined = tokens.join('');
  return matchKeyword(joined, kw);
}

// ─── 채점 함수들 ──────────────────────────────────────────────────────────
/* composition 채점
 *   formula.composition: ['인삼','백출',...]
 *   qp.solved: 이전에 맞춘 토큰들 (이번 회차에서 제외)
 *   maxAnswer: 8 (이상 처방) 또는 전체 (8미 이하 처방)
 *
 *   반환: { correct, newlySolved, missed, alreadySolved, total, target, allDone }
 */
function gradeComposition(formula, input, qp){
  const total = formula.composition.slice();           // 정답 전체
  const alreadySolved = qp.solved || [];               // 이전에 맞춘 것
  const remaining = total.filter(h => !alreadySolved.includes(h));  // 이번 채점 대상
  const target = Math.min(8, remaining.length);        // 이번 회차 요구치
  // 입력 → 약재 정규화
  const tokens = tokenize(input);
  const inputHerbs = tokensToHerbs(tokens, input);
  // remaining 과 매칭
  const newlySolved = [];
  inputHerbs.forEach(ih => {
    if(remaining.includes(ih) && !newlySolved.includes(ih)) newlySolved.push(ih);
  });
  const missed = remaining.filter(h => !newlySolved.includes(h));
  // 완전정답 기준: target 개 이상
  const correct = newlySolved.length >= target;
  // allSolved: 이번 정답 후 전체와 같아지면 롤백
  const totalSolvedAfter = alreadySolved.concat(newlySolved);
  const allDone = total.every(h => totalSolvedAfter.includes(h));
  return { correct, newlySolved, missed, alreadySolved, total, target, allDone, inputHerbs };
}

/* symptoms 채점
 *   formula.symptoms: ['왕래한열','흉협고만',...]
 *   qp.solved: 이전 회차 맞춘 증상
 *   target: 항상 3개 (단, 남은 게 3개 미만이면 남은 수)
 */
function gradeSymptoms(formula, input, qp){
  const total = formula.symptoms.slice();
  const alreadySolved = qp.solved || [];
  const remaining = total.filter(s => !alreadySolved.includes(s));
  const target = Math.min(3, remaining.length);
  const tokens = tokenize(input);
  const newlySolved = [];
  remaining.forEach(sym => {
    if(tokens.some(t => matchKeyword(t, sym)) || matchKeyword(input, sym)){
      if(!newlySolved.includes(sym)) newlySolved.push(sym);
    }
  });
  const correct = newlySolved.length >= target;
  const totalSolvedAfter = alreadySolved.concat(newlySolved);
  const allDone = total.every(s => totalSolvedAfter.includes(s));
  return { correct, newlySolved, alreadySolved, total, target, allDone };
}

/* action / indication 채점 — 별칭 중 하나라도 매칭되면 정답 */
function gradeAlias(aliases, input){
  if(!Array.isArray(aliases) || !aliases.length) return { correct:false, matched:null };
  for(const a of aliases){
    if(matchKeyword(input, a)) return { correct:true, matched:a };
  }
  return { correct:false, matched:null };
}

/* gagam 채점 — 조건에 맞는 가/감 약재 모두 입력해야 정답 */
function gradeGagam(formula, cond, input){
  const entry = (formula.gagam||[]).find(g => g.cond === cond);
  if(!entry) return { correct:false, expected:[], found:[] };
  const expected = [].concat(entry.add||[], entry.remove||[], (entry.replace||[]).flat(), entry.remove_half||[], entry.reduce||[]);
  if(entry.emphasize) expected.push(...entry.emphasize);
  const tokens = tokenize(input);
  const inputHerbs = tokensToHerbs(tokens, input);
  const found = expected.filter(h => inputHerbs.includes(h));
  const correct = expected.length > 0 && expected.every(h => inputHerbs.includes(h));
  return { correct, expected, found, note:entry.note||'' };
}

/* free / baeoh / compare 채점
 *   keywords 중 requireMin 개 이상 (기본 절반)
 *   requireAll === true 면 전체
 */
function gradeKeywords(q, input){
  const kws = q.keywords || [];
  if(!kws.length) return { correct:false, found:[], expected:kws, required:0 };
  const tokens = tokenize(input);
  const found = kws.filter(kw => anyTokenMatches(tokens, kw));
  let required = q.requireMin || Math.ceil(kws.length / 2);
  if(q.requireAll) required = kws.length;
  if(q.type === 'baeoh' && !q.requireMin) required = Math.min(3, kws.length);
  const correct = found.length >= required;
  return { correct, found, expected:kws, required };
}

/* dose / accept 채점 — accept[] 각 그룹에서 1개씩 매칭 */
function gradeAccept(q, input){
  const groups = q.accept || [];
  if(!groups.length) return { correct:false, perGroup:[] };
  const perGroup = groups.map(group => {
    const matched = group.find(opt => matchKeyword(input, opt));
    return { matched: matched || null, group };
  });
  const correct = perGroup.every(g => g.matched != null);
  return { correct, perGroup };
}

/* 통합 채점 디스패처 */
function gradeAnswer(q, input){
  const fm = q.formulaId ? window.HG_findFormula(q.formulaId) : null;
  const qp = getQProgress(q.id);
  qp.totalAttempts = (qp.totalAttempts||0) + 1;
  let result = { correct:false };
  switch(q.type){
    case 'composition':
      if(!fm) break;
      result = gradeComposition(fm, input, qp);
      result.kind = 'composition';
      // 진행 갱신
      if(result.allDone){
        qp.solved = [];  // 롤백
        result.rolledBack = true;
      } else {
        qp.solved = (result.alreadySolved||[]).concat(result.newlySolved);
      }
      break;
    case 'symptoms':
      if(!fm) break;
      result = gradeSymptoms(fm, input, qp);
      result.kind = 'symptoms';
      if(result.allDone){
        qp.solved = [];
        result.rolledBack = true;
      } else {
        qp.solved = (result.alreadySolved||[]).concat(result.newlySolved);
      }
      break;
    case 'action':
      if(!fm) break;
      result = gradeAlias(fm.actionAliases || [fm.action], input);
      result.kind = 'action';
      result.expected = fm.action;
      break;
    case 'indication':
      if(!fm) break;
      result = gradeAlias(fm.indicationAliases || [fm.indication], input);
      result.kind = 'indication';
      result.expected = fm.indication;
      break;
    case 'gagam':
      if(!fm) break;
      result = gradeGagam(fm, q.gagamCond, input);
      result.kind = 'gagam';
      break;
    case 'dose':
      result = gradeAccept(q, input);
      result.kind = 'dose';
      break;
    case 'baeoh':
    case 'compare':
    case 'free':
      // accept 가 있으면 accept 채점, 없으면 keyword 채점
      // baeoh 에서 q.keywords 미정의면 formula.baeohKeywords 를 사용
      if(q.accept && q.accept.length){
        result = gradeAccept(q, input);
      } else {
        let kws = q.keywords;
        if((!kws || !kws.length) && q.type === 'baeoh' && fm && fm.baeohKeywords){
          kws = fm.baeohKeywords;
        }
        const qWithKws = Object.assign({}, q, { keywords: kws || [] });
        result = gradeKeywords(qWithKws, input);
      }
      result.kind = q.type;
      result.expected = q.keywords || (fm && q.type==='baeoh' ? fm.baeohKeywords : null) || (q.accept?q.accept.flat():[]);
      break;
    default:
      result = { correct:false, kind:'unknown' };
  }
  if(result.correct) qp.totalCorrect = (qp.totalCorrect||0) + 1;
  setQProgress(q.id, qp);
  return result;
}

// ─── 세션 상태 (논스톱 모드) ─────────────────────────────────────────────
let SESSION = null;
function newSession(filterMode){
  SESSION = {
    mode: filterMode || 'all',
    queue: shuffleQuestions(filterMode),
    idx: 0,
    correct: 0,
    wrong: 0,
    startedAt: Date.now(),
  };
  saveSession();
}
function saveSession(){
  try{ localStorage.setItem(LS_STATE, JSON.stringify(SESSION)); }catch(_){}
}
function loadSession(){
  try{ return JSON.parse(localStorage.getItem(LS_STATE)||'null'); }catch(_){ return null; }
}
function shuffleQuestions(mode){
  const all = window.HG_QUESTIONS || [];
  let pool = all.slice();
  // mode 필터 (확장용 — 현재는 'all' 만)
  // 셔플 후 ID 배열만 저장 (논스톱이므로 다시 셔플)
  pool.sort(()=>Math.random()-0.5);
  return pool.map(q => q.id);
}

function getCurrentQ(){
  if(!SESSION) return null;
  if(SESSION.idx >= SESSION.queue.length){
    // 끝났으면 셔플 후 재시작 (논스톱)
    SESSION.queue = shuffleQuestions(SESSION.mode);
    SESSION.idx = 0;
    saveSession();
  }
  const qid = SESSION.queue[SESSION.idx];
  return (window.HG_QUESTIONS||[]).find(q => q.id === qid) || null;
}

function nextQ(){
  if(!SESSION) return;
  SESSION.idx++;
  saveSession();
}

// ─── 렌더 ────────────────────────────────────────────────────────────────
function renderHellgate(){
  const view = document.getElementById('view');
  if(!view) return;
  // 세션 없으면 시작
  if(!SESSION){
    const saved = loadSession();
    if(saved && saved.queue && saved.idx != null){
      SESSION = saved;
    } else {
      newSession('all');
    }
  }
  _injectStyle();
  const q = getCurrentQ();
  if(!q){
    view.innerHTML = `<div class="hg-empty">문제가 없습니다. 데이터 파일을 확인해주세요.</div>`;
    return;
  }
  const fm = q.formulaId ? window.HG_findFormula(q.formulaId) : null;
  const qp = getQProgress(q.id);
  // composition / symptoms 의 동적 채점 안내
  let hint = '';
  if(q.type === 'composition' && fm){
    const total = fm.composition;
    const solved = qp.solved || [];
    const remaining = total.filter(h => !solved.includes(h));
    const target = Math.min(8, remaining.length);
    if(solved.length > 0){
      hint = `<div class="hg-hint">이전 회차에 맞춘 약재(${solved.length}개)는 채점 기준에서 제외. 남은 ${remaining.length}개 중 <b>${target}개</b>만 적으세요.</div>`;
    } else if(total.length > 8){
      hint = `<div class="hg-hint">전체 ${total.length}味 중 <b>8개</b>만 적으세요. (반복 시 채점기준 갱신, 모두 적으면 롤백)</div>`;
    }
  } else if(q.type === 'symptoms' && fm){
    const total = fm.symptoms || [];
    const solved = qp.solved || [];
    const remaining = total.filter(s => !solved.includes(s));
    const target = Math.min(3, remaining.length);
    if(solved.length > 0){
      hint = `<div class="hg-hint">이전 회차에 맞춘 증상(${solved.length}개)은 제외. 남은 ${remaining.length}개 중 <b>${target}개</b>만 적으세요.</div>`;
    } else {
      hint = `<div class="hg-hint">전체 증상 ${total.length}개 중 <b>3개</b>만 적으세요. (반복 시 갱신, 모두 적으면 롤백)</div>`;
    }
  }
  const elapsed = Math.floor((Date.now() - SESSION.startedAt) / 60000);
  view.innerHTML = `
    <div class="hg-wrap">
      <div class="hg-header">
        <div class="hg-titlebox">
          <div class="hg-han">獄門</div>
          <div class="hg-title">헬게이트 <span class="hg-sub">— 논스톱 주관식</span></div>
        </div>
        <div class="hg-stats">
          <div class="hg-stat"><span class="lbl">진행</span><span class="val">${SESSION.idx+1}/${SESSION.queue.length}</span></div>
          <div class="hg-stat hg-ok"><span class="lbl">정</span><span class="val">${SESSION.correct}</span></div>
          <div class="hg-stat hg-no"><span class="lbl">오</span><span class="val">${SESSION.wrong}</span></div>
          <div class="hg-stat"><span class="lbl">분</span><span class="val">${elapsed}</span></div>
        </div>
      </div>
      <div class="hg-card">
        <div class="hg-type">${_typeLabel(q.type)}${fm?` · <b>${esc(fm.han)}(${esc(fm.ko)})</b>`:''}</div>
        <div class="hg-q">${esc(q.q)}</div>
        ${hint}
        <textarea class="hg-input" id="hg-input" placeholder="답안 입력 (한글/한자 모두 허용, 띄어쓰기 무관)" rows="3" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
        <div class="hg-row">
          <button class="hg-btn hg-btn-sub" id="hg-skip">건너뛰기</button>
          <button class="hg-btn hg-btn-main" id="hg-submit">제출 (Ctrl+Enter)</button>
        </div>
        <div class="hg-result" id="hg-result" style="display:none"></div>
      </div>
      <div class="hg-foot">
        <button class="hg-btn hg-btn-sub" id="hg-reset-sess">세션 리셋</button>
        <button class="hg-btn hg-btn-sub" id="hg-reset-prog">진행도 초기화</button>
        <button class="hg-btn hg-btn-sub" id="hg-back">← 의서궁</button>
      </div>
    </div>
  `;
  const inp = $('#hg-input');
  if(inp) setTimeout(()=>inp.focus(), 50);
  const submit = () => _onSubmit(q, fm);
  $('#hg-submit').onclick = submit;
  $('#hg-skip').onclick = () => { nextQ(); renderHellgate(); };
  if(inp){
    inp.addEventListener('keydown', e => {
      if((e.ctrlKey||e.metaKey) && e.key === 'Enter'){ e.preventDefault(); submit(); }
    });
  }
  $('#hg-reset-sess').onclick = () => {
    if(!confirm('현재 세션(점수·진행)을 리셋합니다. 계속?')) return;
    newSession('all'); renderHellgate();
  };
  $('#hg-reset-prog').onclick = () => {
    if(!confirm('전체 진행도(맞춘 약재·증상 기록)를 초기화합니다. 계속?')) return;
    saveProgress({});
    toast('진행도 초기화 완료', 'ok');
    renderHellgate();
  };
  $('#hg-back').onclick = () => {
    if(window.V11ClinicHub && window.V11ClinicHub.open) window.V11ClinicHub.open();
    else if(window.setTab) window.setTab('hub');
  };
}

function _onSubmit(q, fm){
  const inp = $('#hg-input');
  if(!inp) return;
  const input = inp.value.trim();
  if(!input){ toast('답을 입력하세요','warn'); return; }
  const r = gradeAnswer(q, input);
  if(r.correct){ SESSION.correct++; }
  else { SESSION.wrong++; }
  saveSession();
  _renderResult(q, fm, r, input);
}

function _renderResult(q, fm, r, input){
  const box = $('#hg-result');
  if(!box) return;
  box.style.display = '';
  let html = '';
  if(r.correct){
    html += `<div class="hg-ok-row">✓ <b>정답</b></div>`;
  } else {
    html += `<div class="hg-no-row">✗ <b>오답</b></div>`;
  }
  // 종류별 부가 안내
  switch(r.kind){
    case 'composition': {
      html += `<div class="hg-detail">
        <div>입력에서 인식한 약재: <b>${r.inputHerbs.length?r.inputHerbs.map(h=>esc(h)).join('·'):'(없음)'}</b></div>
        <div>이번 회차 맞춘 약재: <b style="color:#2A7060">${r.newlySolved.length?r.newlySolved.map(h=>esc(h)).join('·'):'(0)'}</b></div>
        <div>이번 회차 요구치: ${r.target}개</div>
        <div>전체 구성: ${r.total.map(h => r.alreadySolved.includes(h)?`<s style="opacity:.5">${esc(h)}</s>`:esc(h)).join('·')}</div>
        ${r.rolledBack?`<div class="hg-rollback">★ 전체 모두 맞춰 채점 기준 롤백!</div>`:''}
      </div>`;
      break;
    }
    case 'symptoms': {
      html += `<div class="hg-detail">
        <div>이번 회차 맞춘 증상: <b style="color:#2A7060">${r.newlySolved.length?r.newlySolved.map(h=>esc(h)).join(' / '):'(0)'}</b></div>
        <div>전체 증상: ${r.total.map(s => r.alreadySolved.includes(s)?`<s style="opacity:.5">${esc(s)}</s>`:esc(s)).join(' / ')}</div>
        ${r.rolledBack?`<div class="hg-rollback">★ 전체 모두 맞춰 채점 기준 롤백!</div>`:''}
      </div>`;
      break;
    }
    case 'action':
    case 'indication':
      html += `<div class="hg-detail">정답: <b>${esc(r.expected||'')}</b></div>`;
      break;
    case 'gagam':
      html += `<div class="hg-detail">
        <div>요구 약재: <b>${r.expected.map(h=>esc(h)).join('·')}</b></div>
        <div>인식한 약재: <b style="color:#2A7060">${r.found.length?r.found.map(h=>esc(h)).join('·'):'(0)'}</b></div>
        ${r.note?`<div class="hg-note">의의: ${esc(r.note)}</div>`:''}
      </div>`;
      break;
    case 'dose':
      html += `<div class="hg-detail">
        ${r.perGroup.map((g,i)=>`<div>그룹 ${i+1}: ${g.matched?`<b style="color:#2A7060">${esc(g.matched)}</b>`:'<b style="color:#9C3030">(미인식)</b>'} <span style="color:#888;font-size:11px">(예: ${g.group.slice(0,3).map(esc).join(', ')}...)</span></div>`).join('')}
      </div>`;
      break;
    case 'baeoh':
    case 'compare':
    case 'free':
      if(r.expected){
        html += `<div class="hg-detail">
          <div>요구 키워드 ${r.required}개 이상: ${r.expected.map(k => r.found.includes(k)?`<b style="color:#2A7060">${esc(k)}</b>`:`<span style="color:#888">${esc(k)}</span>`).join(' · ')}</div>
        </div>`;
      }
      break;
  }
  // 처방 출전·해설 (오답일 때 더 자세히)
  if(!r.correct && fm){
    html += `<div class="hg-explain">
      <div class="ex-title">${esc(fm.han)}(${esc(fm.ko)}) — 출전: ${esc(fm.source||'?')}</div>
      <div>작용: <b>${esc(fm.action)}</b></div>
      <div>주치: ${esc(fm.indication)}</div>
      <div>구성(${fm.composition.length}味): ${fm.composition.map(esc).join('·')}</div>
      ${fm.baeoh?`<div style="margin-top:6px;font-size:11.5px;color:#666">배오: ${esc(fm.baeoh)}</div>`:''}
    </div>`;
  }
  html += `<div class="hg-row" style="margin-top:10px">
    <button class="hg-btn hg-btn-main" id="hg-next">다음 문제 → (Enter)</button>
  </div>`;
  box.innerHTML = html;
  const goNext = () => { nextQ(); renderHellgate(); };
  $('#hg-next').onclick = goNext;
  // Enter 한번 더 누르면 다음
  document.addEventListener('keydown', _enterNextHandler);
  function _enterNextHandler(e){
    if(e.key === 'Enter' && !(e.ctrlKey||e.metaKey||e.shiftKey)){
      e.preventDefault();
      document.removeEventListener('keydown', _enterNextHandler);
      goNext();
    }
  }
}

function _typeLabel(t){
  return {
    composition:'<span class="han">構成</span> 구성',
    action:'<span class="han">作用</span> 작용',
    indication:'<span class="han">主治</span> 주치',
    symptoms:'<span class="han">證</span> 증상',
    baeoh:'<span class="han">配伍</span> 배오원리',
    gagam:'<span class="han">加減</span> 가감',
    dose:'<span class="han">用量</span> 용량',
    compare:'<span class="han">比較</span> 비교',
    free:'<span class="han">論</span> 서술',
  }[t] || t;
}

// ─── 스타일 ──────────────────────────────────────────────────────────────
function _injectStyle(){
  if(document.getElementById('hg-style')) return;
  const s = document.createElement('style');
  s.id = 'hg-style';
  s.textContent = `
    .hg-wrap{max-width:760px;margin:0 auto;padding:12px}
    .hg-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;padding:8px 4px;border-bottom:2px solid #6E1818}
    .hg-titlebox{display:flex;align-items:baseline;gap:10px}
    .hg-han{font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:34px;color:#6E1818;line-height:1;text-shadow:1px 1px 0 #FCC4A4}
    .hg-title{font-size:20px;font-weight:700;color:#3A1810}
    .hg-sub{font-size:12px;font-weight:400;color:#888;margin-left:4px}
    .hg-stats{display:flex;gap:6px;font-family:var(--font-display,'ZCOOL XiaoWei',serif)}
    .hg-stat{background:#FAF1DF;border:1.5px solid #C9A878;border-radius:8px;padding:4px 8px;text-align:center;min-width:46px}
    .hg-stat .lbl{display:block;font-size:9.5px;color:#7A5418}
    .hg-stat .val{display:block;font-size:16px;font-weight:700;color:#3A1810}
    .hg-stat.hg-ok{border-color:#2A7060;background:#E6F1EA}
    .hg-stat.hg-ok .val{color:#1F3F2C}
    .hg-stat.hg-no{border-color:#9C3030;background:#F5DEDE}
    .hg-stat.hg-no .val{color:#6E1818}
    .hg-card{background:#FCF8EE;border:1.5px solid #C9A878;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(110,24,24,.07)}
    .hg-type{font-size:11.5px;color:#7A5418;margin-bottom:4px}
    .hg-type .han{font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:14px;color:#6E1818;margin-right:3px}
    .hg-q{font-size:15.5px;font-weight:600;color:#2A1810;line-height:1.5;margin-bottom:8px;white-space:pre-wrap}
    .hg-hint{background:#FFF6E0;border-left:3px solid #C9A227;padding:6px 10px;font-size:12px;color:#7A5418;border-radius:4px;margin-bottom:10px}
    .hg-input{width:100%;font-size:15px;padding:10px;border:1.5px solid #C9A878;border-radius:8px;font-family:inherit;background:#fff;box-sizing:border-box;resize:vertical}
    .hg-input:focus{outline:none;border-color:#6E1818;box-shadow:0 0 0 2px rgba(110,24,24,.18)}
    .hg-row{display:flex;gap:8px;margin-top:8px}
    .hg-btn{font-family:inherit;font-size:14px;padding:9px 14px;border-radius:8px;border:1.5px solid #C9A878;background:#fff;cursor:pointer;transition:all .15s;flex:1}
    .hg-btn:hover{transform:translateY(-1px);box-shadow:0 2px 6px rgba(0,0,0,.1)}
    .hg-btn-main{background:#6E1818;color:#FCF4E5;border-color:#6E1818;font-weight:600}
    .hg-btn-sub{background:#fff;color:#3A1810}
    .hg-result{margin-top:12px;padding:10px;border-radius:8px;background:#fff;border:1px solid #DCC8A4}
    .hg-ok-row{font-size:18px;color:#1F3F2C;font-weight:700;margin-bottom:8px}
    .hg-no-row{font-size:18px;color:#6E1818;font-weight:700;margin-bottom:8px}
    .hg-detail{font-size:12.5px;color:#3A1810;line-height:1.6}
    .hg-detail > div{margin-bottom:3px}
    .hg-rollback{margin-top:6px;background:#FFE2C0;border:1px solid #C9A227;border-radius:6px;padding:5px 8px;color:#7A4818;font-weight:600}
    .hg-explain{margin-top:10px;padding:8px 10px;background:#FAF1DF;border-left:3px solid #6E1818;border-radius:4px;font-size:12px;color:#3A1810;line-height:1.5}
    .hg-explain .ex-title{font-weight:700;color:#6E1818;margin-bottom:3px}
    .hg-note{font-size:11.5px;color:#7A5418;margin-top:3px;font-style:italic}
    .hg-foot{display:flex;gap:6px;margin-top:14px;padding:0 4px}
    .hg-foot .hg-btn{flex:1;font-size:12px;padding:7px 10px}
    .hg-empty{padding:40px;text-align:center;color:#888}
    @media (max-width:560px){
      .hg-header{flex-wrap:wrap;gap:8px}
      .hg-stats{order:2;width:100%}
      .hg-stat{flex:1}
      .hg-han{font-size:28px}
      .hg-title{font-size:17px}
    }
  `;
  document.head.appendChild(s);
}

// ─── 외부 API ────────────────────────────────────────────────────────────
function openHellgate(){
  // 메인 진입 — 세션 없으면 자동 시작
  if(!SESSION){
    const saved = loadSession();
    if(saved && saved.queue && saved.queue.length){
      SESSION = saved;
    } else {
      newSession('all');
    }
  }
  renderHellgate();
}

function resetProgress(){ saveProgress({}); }
function getProgress(){ return loadProgress(); }

window.V13Hellgate = {
  open: openHellgate,
  render: renderHellgate,
  resetProgress: resetProgress,
  getProgress: getProgress,
  newSession: newSession,
  // debug/test
  _gradeAnswer: gradeAnswer,
  _tokensToHerbs: tokensToHerbs,
  _scanHerbsInString: scanHerbsInString,
};

// ROUTES 에 등록 (앱이 로드된 후 시도) — 최대 20회(약 6초) 시도
let _routeRegTries = 0;
function _registerRoute(){
  if(window.ROUTES){
    window.ROUTES.hellgate = openHellgate;
  } else if(_routeRegTries++ < 20){
    setTimeout(_registerRoute, 300);
  }
}
_registerRoute();

console.log('[Hellgate] engine ready · questions:', (window.HG_QUESTIONS||[]).length);

})();
