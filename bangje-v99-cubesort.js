/* bangje-v99-cubesort.js — v10.0.3
 * ============================================================================
 * 방미큐브 손패 「方劑順」 정렬 토글
 *
 *   손패의 본초 카드를 「처방을 만들 수 있는 가능성」 순으로 재배치.
 *   학습 모드 — 어떤 본초가 곧 처방으로 완성될 수 있는지 시각적으로 강조.
 *
 *   알고리즘:
 *     • 각 본초 X 에 대해 X 가 들어가는 처방 P 를 검색
 *     • P 의 본초 중 손패에 있는 비율 r = |P ∩ hand| / |P|
 *     • X.score = max(P 의 r) — 가장 가까운 처방의 완성도
 *     • r=1.0 (즉 손패만으로 완성 가능) 이면 +1.0 보너스 → score 2.0
 *   정렬: score desc, 같으면 한자 코드포인트 asc
 *
 *   토글:
 *     • S.cubeSortByFormula (default false — cube 기본 가나다순 유지)
 *     • #bc-hand 영역 헤더 옆에 chip 「方劑順 [ON/OFF]」 inject
 *
 *   동작:
 *     • ON 으로 toggle 시 즉시 정렬, 이후 손패 renderHand 후 자동 재정렬
 *     • OFF 시 다음 renderHand 부터 cube 기본 정렬로 복귀
 *     • 카드 element 를 직접 appendChild reorder — LOCAL.hand 데이터는 안 건드림
 *
 *   self-mutation 무한루프 방지:
 *     • idempotent — 이미 정렬되어 있으면 DOM 변경 없음
 *     • throttle 250ms
 *
 *   API: V99CubeSort.isOn()/.toggle()/.on()/.off()
 * ============================================================================ */
(function(){
'use strict';

function S(){ return window.S || null; }
function save(){ try{ window.saveState && window.saveState(); }catch(_){} }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function isOn(){ const s=S(); if(!s) return false; return !!s.cubeSortByFormula; }
function _set(v){ const s=S(); if(!s) return; s.cubeSortByFormula = !!v; save(); }
function on()  { _set(true);  _refreshBtn(); _sort(); toast('손패 方劑順 정렬 ON', 'gold'); }
function off() { _set(false); _refreshBtn(); toast('손패 정렬 OFF — 다음 갱신 시 기본 順으로 복귀', null); }
function toggle(){ isOn() ? off() : on(); }

function _herbName(it){
  const s = String(it||'').trim();
  const m = s.match(/^([\u4E00-\u9FFF]+)/);
  return m ? m[1] : s;
}

// 본초 X 의 score 계산: 손패와 함께 형성 가능한 처방 완성도 중 최댓값
function _scoreFor(han, handSet){
  const all = (window.FORMULAS || []).concat(window.FORMULAS_EXTRA || []);
  let best = 0;
  for(const f of all){
    if(!f.composition || !f.composition.length) continue;
    const herbs = f.composition.map(_herbName);
    if(!herbs.some(h => h === han || h.startsWith(han) || han.startsWith(h))) continue;
    let inHand = 0;
    for(const h of herbs){
      // 손패에 정확 일치 또는 부분 일치
      if(handSet.has(h)) { inHand++; continue; }
      // 변종 (예: 손패의 '炙甘草' 가 처방 '甘草' 와 매칭)
      let m = false;
      for(const hh of handSet){ if(hh.startsWith(h) || h.startsWith(hh)){ m = true; break; } }
      if(m) inHand++;
    }
    const ratio = inHand / herbs.length;
    if(ratio > best) best = ratio;
    if(inHand === herbs.length) best = Math.max(best, ratio + 1.0);  // 완성 가능 보너스
  }
  return best;
}

// 손패 카드 정렬
let _lastSig = '';
function _sort(){
  if(!isOn()) return;
  const hand = document.getElementById('bc-hand');
  if(!hand) return;
  const cards = Array.from(hand.querySelectorAll('.bc-card'));
  if(cards.length === 0) return;
  const handHans = cards.map(c => c.dataset && c.dataset.han).filter(Boolean);
  const handSet = new Set(handHans);
  const scored = cards.map(c => ({
    el: c,
    han: (c.dataset && c.dataset.han) || '',
    score: _scoreFor((c.dataset && c.dataset.han) || '', handSet),
  }));
  scored.sort((a,b) => {
    if(b.score !== a.score) return b.score - a.score;
    return a.han < b.han ? -1 : a.han > b.han ? 1 : 0;
  });
  // idempotent — 이미 정렬되어 있으면 skip
  const targetSig = scored.map(s => s.han).join('|');
  const currentSig = cards.map(c => (c.dataset && c.dataset.han) || '').join('|');
  if(targetSig === currentSig) return;
  _lastSig = targetSig;
  // appendChild 로 reorder — 카드의 click listener·data 유지
  scored.forEach(s => hand.appendChild(s.el));
  // score badge inject (optional, 학습 보조)
  _injectScoreBadges(scored);
}

function _injectScoreBadges(scored){
  scored.forEach(s => {
    let badge = s.el.querySelector('.v99-cube-score');
    if(s.score >= 1.5){
      // 완성 가능 — 황금 별
      if(!badge){
        badge = document.createElement('span');
        badge.className = 'v99-cube-score complete';
        badge.textContent = '★';
        badge.title = '손패만으로 완성 가능한 처방이 있습니다';
        s.el.appendChild(badge);
      }
      badge.className = 'v99-cube-score complete';
    } else if(s.score >= 0.6){
      // 거의 완성 — 작은 표시
      if(!badge){
        badge = document.createElement('span');
        badge.className = 'v99-cube-score partial';
        s.el.appendChild(badge);
      }
      badge.textContent = (s.score * 100).toFixed(0) + '%';
      badge.title = '가장 가까운 처방 완성도';
      badge.className = 'v99-cube-score partial';
    } else {
      if(badge) badge.remove();
    }
  });
}

// ─── 토글 버튼 inject ──────────────────────────────────────────────────
function _injectCSS(){
  if(document.getElementById('v99-cubesort-css')) return;
  const st = document.createElement('style');
  st.id = 'v99-cubesort-css';
  st.textContent = `
    .v99-cubesort-btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 11px;
      font-family: 'Noto Serif KR', serif; font-size: 11px;
      cursor: pointer; user-select: none; border: 1px solid;
      margin-left: 6px; transition: all .15s;
      white-space: nowrap;
    }
    .v99-cubesort-btn.on {
      background: linear-gradient(135deg, #2A7060 0%, #1F5040 100%);
      border-color: #C9A227; color: #FFE08A;
    }
    .v99-cubesort-btn.off {
      background: rgba(28,20,10,.04);
      border-color: rgba(135,106,54,.32);
      color: var(--gutong, #876A36);
    }
    .v99-cubesort-btn .han { font-family: 'ZCOOL XiaoWei', serif; font-size: 13px; font-weight: 700; line-height: 1; }
    .v99-cubesort-btn .state { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 7px; background: rgba(255,224,138,.18); }
    .v99-cubesort-btn.off .state { background: rgba(135,106,54,.13); }
    .v99-cubesort-btn:hover { filter: brightness(1.1); }

    .bc-card { position: relative; }
    .v99-cube-score {
      position: absolute; top: 1px; right: 2px;
      font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 6px;
      pointer-events: none; z-index: 2;
      font-family: 'Noto Serif KR', serif;
    }
    .v99-cube-score.complete {
      background: linear-gradient(135deg, #C9A227, #FFE08A);
      color: #1C140A;
      font-size: 11px; padding: 0 4px;
      box-shadow: 0 0 5px #FFE08A99;
    }
    .v99-cube-score.partial {
      background: rgba(42, 112, 96, .85);
      color: #FCF4E5;
    }
  `;
  document.head.appendChild(st);
}

let _lastBtnHtml = '';
function _injectBtn(){
  // bc-handcnt (손패 카운터) 가 있는 라인 옆에 inject
  const handCnt = document.getElementById('bc-handcnt');
  if(!handCnt) return;
  const parent = handCnt.parentNode;
  let btn = document.getElementById('v99-cubesort-btn');
  if(!btn){
    btn = document.createElement('span');
    btn.id = 'v99-cubesort-btn';
    btn.className = 'v99-cubesort-btn ' + (isOn() ? 'on' : 'off');
    btn.title = '손패를 「처방 완성 가능성」 순으로 정렬';
    btn.addEventListener('click', toggle);
    parent.appendChild(btn);
  }
  btn.className = 'v99-cubesort-btn ' + (isOn() ? 'on' : 'off');
  const next = `<span class="han">方劑順</span><span class="state">${isOn() ? 'ON' : 'OFF'}</span>`;
  if(next !== _lastBtnHtml){ btn.innerHTML = next; _lastBtnHtml = next; }
}
function _refreshBtn(){ _lastBtnHtml=''; try{ _injectBtn(); }catch(_){} }

// ─── 부팅 ──────────────────────────────────────────────────────────────
function _observe(){
  const v = document.getElementById('view');
  if(!v){ setTimeout(_observe, 400); return; }
  _injectCSS();
  let _t = null;
  const obs = new MutationObserver(records => {
    let external = false;
    for(const r of records){
      const tgt = r.target;
      if(!tgt) continue;
      if(tgt.id === 'v99-cubesort-btn' || tgt.closest?.('#v99-cubesort-btn')) continue;
      if(tgt.classList && tgt.classList.contains('v99-cube-score')) continue;
      external = true; break;
    }
    if(!external) return;
    if(_t) return;
    _t = setTimeout(() => {
      _t = null;
      try{ _injectBtn(); _sort(); }catch(_){}
    }, 250);
  });
  obs.observe(v, { childList: true, subtree: true });
  setTimeout(() => { _injectCSS(); _injectBtn(); _sort(); }, 500);
}

if(document.readyState !== 'loading') setTimeout(_observe, 700);
else document.addEventListener('DOMContentLoaded', () => setTimeout(_observe, 700));

window.V99CubeSort = { isOn, toggle, on, off, _sort };
})();
