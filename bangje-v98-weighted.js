/* bangje-v98-weighted.js — v9.8
 * ============================================================================
 * 전 사용자 빈출 오답 가중 자동 출제
 *
 *   Firebase /stats/wrongs/{qid} 조회 → 오답 수 가중치로 PAST_EXAMS + BULK
 *   에서 N문항 샘플링.
 *
 *   • V98Weighted.start(opts)
 *       opts.n           — 문항 수 (default 10)
 *       opts.topK        — 상위 K개에서 가중 샘플 (default 50)
 *       opts.diffuse     — 보너스: 풀의 균등 mix 비율 (default 0.15)
 *
 *   가중치 계산: w_i = (wrongs_i + α) / Σ(wrongs + α), α=1.0 (additive smoothing)
 *   결과 화면은 기존 startQuizSession 결과 UI 재활용 위해 간단 자체 구현.
 * ============================================================================ */
(function(){
'use strict';

function $(s, r){ return (r||document).querySelector(s); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m, k); }catch(_){} }

async function _fetchWrongs(){
  if(!window.FB){ return {}; }
  try{
    const d = await window.FB.get('stats/wrongs');
    return (d && typeof d === 'object') ? d : {};
  }catch(_){ return {}; }
}

function _pool(){
  const past = (window.PAST_EXAMS || []);
  const bulk = (window.BULK_QUESTIONS || []);
  return [...past, ...bulk].filter(q => q && q.id && Array.isArray(q.options));
}

function _sample(weighted, n){
  const out = [];
  const arr = weighted.slice();
  for(let i = 0; i < n && arr.length; i++){
    const tot = arr.reduce((s, x) => s + x.w, 0);
    if(tot <= 0) break;
    let r = Math.random() * tot;
    for(let j = 0; j < arr.length; j++){
      r -= arr[j].w;
      if(r <= 0){ out.push(arr[j].q); arr.splice(j, 1); break; }
    }
  }
  return out;
}

async function start(opts){
  opts = Object.assign({ n: 10, topK: 50, diffuse: 0.15 }, opts || {});
  const pool = _pool();
  if(!pool.length){ toast('문제 풀 부재', 'red'); return; }
  toast('전역 오답 통계 조회 중…');
  const wrongs = await _fetchWrongs();
  // 각 문제 가중치 계산
  const all = pool.map(q => ({ q, w: (Number(wrongs[q.id])||0) + 1 }));
  // top-K만 가중 + 나머지는 diffuse 비율로 균등 가중
  all.sort((a, b) => b.w - a.w);
  const top = all.slice(0, opts.topK);
  const rest = all.slice(opts.topK).map(x => ({ q: x.q, w: 1 * opts.diffuse }));
  const weighted = top.concat(rest);
  const picked = _sample(weighted, opts.n);
  if(!picked.length){ toast('샘플 실패', 'warn'); return; }
  _runQuiz(picked);
}

function _runQuiz(pool){
  // 옵션 셔플
  pool = pool.map(q => {
    const correctTxt = q.options[q.answer||0];
    const shuf = q.options.slice().sort(() => Math.random()-0.5);
    return { ...q, options: shuf, answer: shuf.indexOf(correctTxt) };
  });
  let cur = 0, score = 0;
  const startedAt = Date.now();
  const v = $('#view'); if(!v) return;

  function show(){
    if(cur >= pool.length){
      const earned = score * 12;   // 빈출 가중치 보너스 (×1.2)
      if(window.S){ window.S.qi = (window.S.qi||0) + earned; window.saveState && window.saveState(); }
      try{ window.refreshHeader && window.refreshHeader(); }catch(_){}
      v.innerHTML = `
        <h2 class="view-title fade-in"><span class="han">畢</span>빈출 오답 모드 종료</h2>
        <div class="card imperial" style="text-align:center;padding:20px">
          <div class="seal" style="font-size:38px;color:var(--zhusha-d)">${score}/${pool.length}</div>
          <div style="margin-top:8px;font-size:13px;color:var(--feicui);font-weight:600">
            +${earned} 氣 <span style="font-size:11px;color:var(--gutong)">(전역 가중 모드 ×1.2)</span>
          </div>
          <div style="margin-top:6px;font-size:11px;color:var(--gutong)">${Math.round((Date.now()-startedAt)/1000)}초</div>
        </div>
        <div style="display:flex;gap:6px;justify-content:center;margin-top:14px">
          <button class="btn" type="button" onclick="V98Weighted.start()">다시</button>
          <button class="btn btn-o" type="button" onclick="setTab('home')">대청</button>
        </div>
      `;
      return;
    }
    const q = pool[cur];
    v.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span class="seal-stamp tiny" style="background:#9C3030;color:#FFE08A">頻</span>
        <span class="han" style="font-size:12.5px;color:#9C3030">빈출 오답</span>
        <span style="margin-left:auto;font-size:12px;color:var(--gutong)">${cur+1}/${pool.length}</span>
      </div>
      <div class="card imperial fade-in">
        <div style="font-size:14.5px;line-height:1.65;margin-bottom:12px">${esc(q.q||q.question||'?')}</div>
        ${(q.options||[]).map((opt, i) => `
          <button class="btn btn-o v98w-opt" type="button" style="display:block;width:100%;margin:6px 0;text-align:left;padding:10px 12px;white-space:normal;line-height:1.45" data-i="${i}">
            <span class="han" style="color:var(--zhusha-d);margin-right:8px;font-weight:700">${'甲乙丙丁戊'[i]||(i+1)}</span>${esc(opt)}
          </button>
        `).join('')}
        ${q.explanation?`<div id="expl" style="display:none;margin-top:14px;padding:10px;background:var(--mi);border-radius:6px;font-size:12.5px;color:var(--mo);line-height:1.5"><b style="color:var(--zhusha-d)">해설</b><br>${esc(q.explanation)}</div>`:''}
      </div>
      <div style="margin-top:8px;font-size:10.5px;color:var(--gutong);text-align:center">
        ${q.formula ? '연관 처방: <b>'+esc(q.formula)+'</b>' : ''}
      </div>
    `;
    v.querySelectorAll('.v98w-opt').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      const correct = i === (q.answer||0);
      if(correct) score++;
      try{ correct ? window.bgm && window.bgm.sfxCorrect && window.bgm.sfxCorrect() : window.bgm && window.bgm.sfxWrong && window.bgm.sfxWrong(); }catch(_){}
      v.querySelectorAll('.v98w-opt').forEach(x => {
        x.disabled = true;
        if(+x.dataset.i === (q.answer||0)){ x.style.background='var(--feicui)'; x.style.color='var(--mi-w)'; x.style.borderColor='transparent'; }
        if(+x.dataset.i === i && !correct){ x.style.background='var(--zhusha)'; x.style.color='var(--mi-w)'; x.style.borderColor='transparent'; }
      });
      const expl = $('#expl'); if(expl) expl.style.display='block';
      setTimeout(() => { cur++; show(); }, 1100);
    }));
  }
  show();
}

window.V98Weighted = { start };
})();
