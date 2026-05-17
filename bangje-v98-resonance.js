/* bangje-v98-resonance.js — v9.8
 * ============================================================================
 * 印章 共鳴 — 장착 3개가 모두 동일 카테고리면 부가 효과
 *
 *   해석:
 *     • S.equippedSeals.length === 3 + 모두 cat 동일 → 共鳴 활성
 *     • 솔로 학습 baseEarned 에 +(category bonus) % 적용
 *         cat = '학습'   → +10%
 *         cat = '문답'   → +12%
 *         cat = '章典'   → +15%   (章典은 시험 직접 영역)
 *         cat = '氣博'   → +0% (멀티 영향 회피)
 *         cat = '流派'   → +8%
 *         cat = '時辰'   → +5%
 *         cat = '同學'   → +5%
 *         cat = '特技'   → +10%
 *
 *   • 보너스는 V97Sig.sessionBonus 와 별개로 합산 (별도 라인). cap은 동일하게
 *     baseEarned*0.5 (V97Sig 캡과 합쳐도 그대로 — overrun 가능하나 의도).
 *   • 매 퀴즈 종료 시 app.js startQuizSession 의 calc 가 호출하도록
 *     V98Resonance.bonusFor(baseEarned) 만 노출. 통합은 v98-bootstrap 에서
 *     monkey-patch 가능. 단순한 통합 가이드: app.js 의 earned 계산 라인 직후에
 *     `earned += V98Resonance.bonusFor(baseEarned).bonus;` 추가.
 *
 *   • 메달리온 옆 印章 3개 사이에 미세 connection line (CSS) 추가:
 *       V98Resonance.cssTrigger() — V97Profile.sealsHTML 으로 inject된
 *       .v97-seals 컨테이너 발견 시 ::after pseudo-glow class 토글.
 *
 *   • V98Resonance.isActive() → boolean
 *   • V98Resonance.activeCat() → '학습' | ... | ''
 *   • V98Resonance.bonusFor(baseEarned) → {bonus, pct, cat}
 * ============================================================================ */
(function(){
'use strict';

const CAT_PCT = {
  '학습': 0.10, '문답': 0.12, '章典': 0.15, '氣博': 0.00,
  '流派': 0.08, '時辰': 0.05, '同學': 0.05, '特技': 0.10,
};

function S(){ return window.S || null; }

function isActive(){
  const s = S(); if(!s) return false;
  const eq = s.equippedSeals || [];
  if(eq.length !== 3) return false;
  const byId = window.ACHIEVEMENT_BY_ID || {};
  const cats = new Set();
  for(const id of eq){
    const a = byId[id]; if(!a) return false;
    cats.add(a.cat);
  }
  return cats.size === 1;
}

function activeCat(){
  if(!isActive()) return '';
  const s = S();
  const a = (window.ACHIEVEMENT_BY_ID || {})[s.equippedSeals[0]];
  return a ? a.cat : '';
}

function bonusFor(baseEarned){
  if(!isActive()) return { bonus:0, pct:0, cat:'' };
  const cat = activeCat();
  const pct = CAT_PCT[cat] || 0;
  if(pct === 0) return { bonus:0, pct:0, cat };
  const bonus = Math.round((baseEarned||0) * pct);
  return { bonus, pct, cat };
}

// ─── 시각: 印章 컨테이너에 共鳴 클래스 토글 ────────────────────────────
function cssTrigger(){
  const sealsEls = document.querySelectorAll('.v97-seals');
  sealsEls.forEach(el => {
    if(isActive()){
      el.classList.add('v98-resonance-on');
      el.setAttribute('title', '印章 共鳴 — '+activeCat()+' '+(CAT_PCT[activeCat()]*100)+'% 보너스 (솔로)');
    } else {
      el.classList.remove('v98-resonance-on');
      el.removeAttribute('title');
    }
  });
}

// ─── CSS 자동 주입 ──────────────────────────────────────────────────────
function _injectCSS(){
  if(document.getElementById('v98-resonance-css')) return;
  const st = document.createElement('style');
  st.id = 'v98-resonance-css';
  st.textContent = `
    @keyframes v98ResonancePulse {
      0%, 100% { box-shadow: 0 0 4px rgba(201,162,39,.0); }
      50%     { box-shadow: 0 0 14px rgba(201,162,39,.65); }
    }
    .v98-resonance-on {
      position: relative;
      padding: 1px 3px;
      border-radius: 7px;
      background: linear-gradient(90deg, rgba(201,162,39,.12) 0%, rgba(156,48,48,.12) 50%, rgba(201,162,39,.12) 100%);
      animation: v98ResonancePulse 2.2s ease-in-out infinite;
    }
    .v98-resonance-on::after {
      content: '共';
      position: absolute;
      top: -8px; right: -6px;
      background: #9C3030; color: #FFE08A;
      font-size: 10px; font-family: 'ZCOOL XiaoWei', serif;
      width: 16px; height: 16px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 6px rgba(156,48,48,.6);
      border: 1px solid #FFE08A88;
    }
  `;
  document.head.appendChild(st);
}

// ─── MutationObserver — 印章 변경 감지 ────────────────────────────────
function _observe(){
  const obs = new MutationObserver(() => { try{ cssTrigger(); }catch(_){} });
  obs.observe(document.body, { childList:true, subtree:true });
  setTimeout(cssTrigger, 300);
}

if(document.readyState !== 'loading'){
  setTimeout(() => { _injectCSS(); _observe(); }, 500);
} else {
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => { _injectCSS(); _observe(); }, 500));
}

window.V98Resonance = { isActive, activeCat, bonusFor, cssTrigger, _CAT_PCT: CAT_PCT };
})();
