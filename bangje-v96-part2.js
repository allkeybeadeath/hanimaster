/* bangje-v96 part 2 — Warrior2H (2시간의전사) */
(function(){
'use strict';

const $   = (q,r) => (r||document).querySelector(q);
const $$  = (q,r) => Array.from((r||document).querySelectorAll(q));
const esc_= (s) => (typeof esc === 'function') ? esc(s) : String(s||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const toast_ = (m,k) => { if(typeof toast === 'function') toast(m,k); };
const fb_ = () => (typeof FB !== 'undefined' && FB) || null;
const view_ = () => document.getElementById('view');
const now = () => Date.now();

const DUR_MS = 2 * 60 * 60 * 1000;
const REWARD_QI = 30;
let _sess = null;

function _pool(){
  const past = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const bulk = (typeof BULK_QUESTIONS !== 'undefined') ? BULK_QUESTIONS : [];
  return [...past, ...bulk].filter(q => q && q.id && Array.isArray(q.options));
}

async function _globalWrongs(){
  const f = fb_();
  if(!f) return {};
  try{
    const d = await f.get('stats/wrongs');
    return (d && typeof d === 'object') ? d : {};
  }catch(_){ return {}; }
}

async function start(){
  const pool = _pool();
  if(!pool.length){
    toast_('PAST_EXAMS / BULK_QUESTIONS 가 로드되지 않았습니다','red');
    return;
  }
  const globalW = await _globalWrongs();
  const personalW = new Set((typeof S !== 'undefined' && S && S.wrongIds) || []);
  const weights = {};
  for(const q of pool){
    let w = 1.0;
    if(personalW.has(q.id)) w *= 3.0;
    const gw = globalW[q.id] || 0;
    if(gw >= 5) w *= 2.0;
    else if(gw >= 2) w *= 1.5;
    weights[q.id] = w;
  }
  _sess = {
    pool, weights,
    attempts: 0, correct: 0,
    seen: {}, curQ: null, lastQid: '',
    started: now(), deadline: now() + DUR_MS,
    timerInterval: null, trail: [],
  };
  if(window.V96Activity) V96Activity.set('2시간의전사', '기출 반복 학습 중');
  _nextQ();
}

function _pickNext(){
  if(!_sess) return null;
  const pool = _sess.pool;
  const wts  = _sess.weights;
  const seen = _sess.seen;
  const adjusted = pool.map(q => {
    let w = wts[q.id] || 1.0;
    const s = seen[q.id];
    if(s){
      if(s.lastResult === 'wrong') w *= 4.0;
      else if(s.lastResult === 'correct') w *= 0.3;
      if((s.correct||0) + (s.wrong||0) >= 4) w *= 0.5;
    }
    if(q.id === _sess.lastQid) w *= 0.05;
    return { q, w };
  });
  const tot = adjusted.reduce((s,x) => s + x.w, 0);
  if(tot <= 0) return adjusted[Math.floor(Math.random()*adjusted.length)].q;
  let r = Math.random() * tot;
  for(const x of adjusted){ r -= x.w; if(r <= 0) return x.q; }
  return adjusted[adjusted.length-1].q;
}

function _nextQ(){
  if(!_sess) return;
  if(now() >= _sess.deadline){ return _finish('timeout'); }
  const q = _pickNext();
  if(!q){ _finish('empty'); return; }
  const correctTxt = q.options[q.answer||0];
  const shuf = q.options.slice().sort(()=>Math.random()-0.5);
  const ans = shuf.indexOf(correctTxt);
  _sess.curQ = { ...q, options: shuf, answer: ans };
  _sess.lastQid = q.id;
  _render();
}

function _render(){
  const v = view_(); if(!v) return;
  const s = _sess; if(!s || !s.curQ) return;
  const q = s.curQ;
  const seenN = (s.seen[q.id] && ((s.seen[q.id].correct||0) + (s.seen[q.id].wrong||0))) || 0;
  const remainMs = Math.max(0, s.deadline - now());
  const hh = Math.floor(remainMs / 3600000);
  const mm = Math.floor((remainMs % 3600000) / 60000);
  const ss = Math.floor((remainMs % 60000) / 1000);
  const timeStr = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  const past = (typeof PAST_EXAMS !== 'undefined') ? PAST_EXAMS : [];
  const isPast = past.some(x => x.id === q.id);
  const srcBadge = isPast
    ? '<span class="w2h-badge past">舊 기출</span>'
    : '<span class="w2h-badge new">新 자작</span>';

  v.innerHTML = `
    <div id="w2h-root">
      <h2 class="view-title fade-in"><span class="han">勇</span>2시간의 전사 <span style="font-size:13px;color:var(--gutong);font-weight:400;font-family:var(--font-body)">— 점수 없는 반복 학습</span></h2>

      <div class="w2h-sticky">
        <div class="w2h-panel-row">
          <div class="w2h-panel-cell">
            <div class="w2h-pl">남은 시간</div>
            <div class="w2h-pv" id="w2h-time" style="color:${remainMs<10*60*1000?'var(--zhusha-d)':'var(--mo)'}">${timeStr}</div>
          </div>
          <div class="w2h-panel-cell">
            <div class="w2h-pl">풀이</div>
            <div class="w2h-pv">${s.attempts}<span class="w2h-pv-sub">문</span></div>
          </div>
          <div class="w2h-panel-cell">
            <div class="w2h-pl">정답</div>
            <div class="w2h-pv" style="color:var(--feicui)">${s.correct}</div>
          </div>
          <div class="w2h-panel-cell">
            <div class="w2h-pl">이 문제</div>
            <div class="w2h-pv">${seenN}<span class="w2h-pv-sub">회차</span></div>
          </div>
        </div>
        <div style="text-align:right;margin-top:4px">
          <button class="btn btn-sm btn-o" type="button" id="w2h-stop">중단 (대청으로)</button>
        </div>
      </div>

      <div class="card imperial fade-in" style="margin-top:12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">
          ${srcBadge}
          ${q.difficulty ? `<span class="w2h-badge d${q.difficulty}">난도 ${q.difficulty}</span>` : ''}
          ${q.src ? `<span style="font-size:10.5px;color:var(--gutong)">${esc_(q.src)}</span>` : ''}
        </div>
        <div style="font-size:14.5px;color:var(--mo);line-height:1.7;margin-bottom:14px">${esc_(q.q||q.question||'?')}</div>
        ${(q.options||[]).map((opt, i) => `
          <button class="btn btn-o w2h-opt" type="button" style="display:block;width:100%;margin:6px 0;text-align:left;justify-content:flex-start" data-i="${i}">
            <span style="font-family:var(--font-display);color:var(--zhusha-d);margin-right:8px">${'甲乙丙丁戊'[i]||(i+1)}</span>${esc_(opt)}
          </button>
        `).join('')}
      </div>

      <div id="w2h-explain" style="margin-top:10px"></div>

      ${s.attempts > 0 ? `
      <div class="card fade-in" style="margin-top:12px">
        <div class="card-title"><span class="han">徑</span> 최근 풀이 흐름</div>
        <div class="w2h-trail" id="w2h-trail"></div>
      </div>` : ''}
    </div>
  `;
  $$('.w2h-opt').forEach(b => {
    b.addEventListener('click', () => _answer(+b.dataset.i, b));
  });
  const stopBtn = document.getElementById('w2h-stop');
  if(stopBtn) stopBtn.addEventListener('click', () => _finish('user-stop'));
  _renderTrail();
  _startTimer();
}

function _renderTrail(){
  const el = document.getElementById('w2h-trail');
  if(!el || !_sess) return;
  const trail = _sess.trail || [];
  if(!trail.length){ el.innerHTML = '<span style="color:var(--gutong);font-size:11px">아직 없음</span>'; return; }
  el.innerHTML = trail.slice(-12).map(t => {
    const cls = t.correct ? 'w2h-trail-ok' : 'w2h-trail-ng';
    const han = t.correct ? '○' : '✕';
    return `<span class="w2h-trail-dot ${cls}" title="${esc_(t.qid)}${t.repeat>1?' · '+t.repeat+'회차':''}">${han}</span>`;
  }).join('');
}

function _startTimer(){
  if(!_sess) return;
  if(_sess.timerInterval) clearInterval(_sess.timerInterval);
  _sess.timerInterval = setInterval(() => {
    if(!_sess) return;
    const t = document.getElementById('w2h-time');
    if(t){
      const remainMs = Math.max(0, _sess.deadline - now());
      const hh = Math.floor(remainMs / 3600000);
      const mm = Math.floor((remainMs % 3600000) / 60000);
      const ss = Math.floor((remainMs % 60000) / 1000);
      t.textContent = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
      if(remainMs < 10*60*1000) t.style.color = 'var(--zhusha-d)';
    }
    if(now() >= _sess.deadline){ _finish('timeout'); }
  }, 1000);
}

function _answer(idx, btn){
  if(!_sess || !_sess.curQ) return;
  const q = _sess.curQ;
  const correct = (idx === (q.answer||0));
  _sess.attempts += 1;
  if(correct) _sess.correct += 1;
  const rec = _sess.seen[q.id] || { correct:0, wrong:0, lastResult:'' };
  if(correct) rec.correct += 1; else rec.wrong += 1;
  rec.lastResult = correct ? 'correct' : 'wrong';
  rec.lastSeenAt = now();
  _sess.seen[q.id] = rec;
  _sess.trail.push({ qid:q.id, correct, repeat: (rec.correct + rec.wrong) });
  try{ correct ? bgm.sfxCorrect() : bgm.sfxWrong(); }catch(_){}
  $$('.w2h-opt').forEach(x => {
    x.disabled = true;
    const i = +x.dataset.i;
    if(i === (q.answer||0)) x.style.background = 'var(--feicui)';
    if(i === idx && !correct) x.style.background = 'var(--zhusha)';
    if(i === (q.answer||0) || (i === idx && !correct)){
      x.style.color = 'var(--mi-w)'; x.style.borderColor = 'transparent';
    }
  });
  if(!correct && typeof S !== 'undefined' && S){
    S.wrongIds = S.wrongIds || [];
    if(!S.wrongIds.includes(q.id)) S.wrongIds.push(q.id);
    if(typeof saveState === 'function') saveState();
    const f = fb_();
    if(f && rec.wrong === 1){
      f.get(`stats/wrongs/${q.id}`).then(c => f.put(`stats/wrongs/${q.id}`, (c||0)+1).catch(()=>{}));
    }
  }
  const ex = document.getElementById('w2h-explain');
  if(ex){
    const expTxt = q.explain || q.explanation || '';
    ex.innerHTML = `
      <div class="card ${correct?'gold':''}" style="padding:12px">
        <div style="font-family:var(--font-display);color:${correct?'var(--feicui)':'var(--zhusha-d)'};font-size:16px;margin-bottom:6px">
          ${correct ? '○ 정답' : '✕ 오답'}
          ${rec.wrong + rec.correct > 1 ? `<span style="font-size:11px;color:var(--gutong);font-family:var(--font-body);margin-left:6px">— ${rec.wrong + rec.correct}회차 (○${rec.correct} / ✕${rec.wrong})</span>` : ''}
        </div>
        ${expTxt ? `<div style="font-size:12.5px;color:var(--mo);line-height:1.7">${esc_(expTxt)}</div>` : ''}
        <div style="margin-top:10px;display:flex;gap:6px;justify-content:flex-end">
          <button class="btn btn-sm" id="w2h-next" type="button">다음 문제 →</button>
        </div>
      </div>
    `;
    const nx = document.getElementById('w2h-next');
    if(nx){ nx.addEventListener('click', () => _nextQ()); nx.focus(); }
  }
  _renderTrail();
}

function _finish(why){
  if(!_sess) return;
  if(_sess.timerInterval){ clearInterval(_sess.timerInterval); _sess.timerInterval = null; }
  const s = _sess;
  _sess = null;
  if(window.V96Activity) V96Activity.set('', '');
  let reward = 0;
  if(why === 'timeout' && s.attempts >= 20){
    reward = REWARD_QI;
    if(typeof S !== 'undefined' && S){
      S.qi = (S.qi||0) + reward;
      if(typeof saveState === 'function') saveState();
      if(typeof refreshHeader === 'function') refreshHeader();
    }
  }
  const elapsed = Math.floor((now() - s.started)/1000);
  const elH = Math.floor(elapsed/3600);
  const elM = Math.floor((elapsed%3600)/60);
  const distinctSeen = Object.keys(s.seen).length;
  const distinctMastered = Object.values(s.seen).filter(r => (r.correct||0) >= 2 && (r.wrong||0) === 0).length;
  const v = view_(); if(!v) return;
  const whyKo = ({
    'timeout':'2시간 완주',
    'user-stop':'중단',
    'empty':'문제 풀 없음',
  })[why] || why;
  v.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">畢</span>2시간의 전사 — ${esc_(whyKo)}</h2>
    <div class="card imperial fade-in" style="text-align:center;padding:24px 14px">
      <div class="han" style="font-size:48px;color:var(--zhusha-d);line-height:1">${s.attempts}<span style="font-size:24px;opacity:.6">문</span></div>
      <div style="font-size:13px;color:var(--mo-l);margin-top:8px">
        정답 <b style="color:var(--feicui)">${s.correct}</b> · 오답 <b style="color:var(--zhusha-d)">${s.attempts - s.correct}</b>
        · 풀린 문제 <b>${distinctSeen}</b>종 · 마스터(연속2회+)<b style="color:var(--huang-d)">${distinctMastered}</b>종
      </div>
      <div style="font-size:11.5px;color:var(--gutong);margin-top:6px">
        ${elH}시간 ${elM}분 학습
      </div>
      ${reward > 0 ? `
        <div style="margin-top:14px;display:inline-block;padding:8px 16px;background:var(--huang-l);border:1.5px solid var(--huang-d);border-radius:8px">
          <span class="seal" style="font-size:13px;color:var(--mo)">완주 보상</span>
          <b class="han" style="font-size:24px;color:var(--zhusha-d);margin-left:6px">+${reward}</b>
        </div>` : ''}
      <div style="margin-top:6px;font-size:10.5px;color:var(--gutong);font-style:italic">
        학습 자체가 보상입니다. 점수에 매이지 마세요.
      </div>
    </div>
    <div style="display:flex;gap:6px;justify-content:center;margin-top:14px">
      <button class="btn" type="button" onclick="V96Warrior2H.start()">다시 도전</button>
      <button class="btn btn-o" type="button" onclick="setTab('home')">대청으로</button>
    </div>
  `;
}

function isRunning(){ return !!_sess; }

window.V96Warrior2H = { start, isRunning };

window.V96RenderWarrior2H = function(){
  if(isRunning()){
    const ok = confirm('진행 중인 2시간의 전사 세션이 있습니다. 새로 시작할까요?\n(취소 시 현재 화면 유지)');
    if(!ok) return;
    if(_sess && _sess.timerInterval) clearInterval(_sess.timerInterval);
    _sess = null;
  }
  const v = view_(); if(!v) return;
  v.innerHTML = `
    <h2 class="view-title fade-in"><span class="han">勇</span>2시간의 전사</h2>
    <div class="view-sub">반복 학습으로 중요한 기출만 자기 것으로</div>

    <div class="card imperial fade-in" style="padding:18px 14px">
      <div style="font-family:var(--font-display);font-size:18px;color:var(--zhusha-d);margin-bottom:10px">
        무엇이 다른가
      </div>
      <ul style="font-size:13px;line-height:1.8;color:var(--mo);padding-left:18px;margin:0">
        <li><b>점수 없음</b> — 맞고 틀림에 매이지 말고 풀고 또 풀자</li>
        <li><b>기출 위주</b> — 22학번 진짜 기출 + 검증된 자작 문항만. 자동 생성 제외</li>
        <li><b>반복 우선</b> — 틀린 문제는 가중치 ×4 로 곧 다시 등장 · 맞춘 문제는 ×0.3</li>
        <li><b>개인·전체 오답 가중</b> — 내 오답함 ×3, 글로벌 빈출 오답 ×2</li>
        <li><b>2시간 타이머</b> — 끝나기 전까지 무한 풀이. 20문 이상 끝까지 풀면 氣 +30 작은 보상</li>
      </ul>
    </div>

    <div class="card fade-in" style="background:var(--mi);padding:12px">
      <div style="font-size:12.5px;color:var(--mo-l);line-height:1.7">
        <span class="han" style="color:var(--zhusha-d)">志</span> 본 모드는 <b>황제내경·上古天眞論</b> 의 「精神內守，病安從來」 ─
        외부 자극 (점수·경쟁) 을 차단하고, 잊어버린 기출을 묵묵히 되짚어 가는 학습 형식입니다.
        지치면 「중단 (대청으로)」 으로 언제든 빠져나오세요.
      </div>
    </div>

    <div style="display:flex;gap:6px;justify-content:center;margin-top:14px">
      <button class="btn btn-lg btn-gold" type="button" onclick="V96Warrior2H.start()"><span class="han" style="margin-right:6px">始</span>시작</button>
      <button class="btn btn-o" type="button" onclick="setTab('home')">취소</button>
    </div>
  `;
};

})();
