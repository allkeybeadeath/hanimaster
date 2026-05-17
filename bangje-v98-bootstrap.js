/* bangje-v98-bootstrap.js — v9.8
 * ============================================================================
 * 기존 app.js / v97 시스템과의 통합 (monkey-patch 방식 — 원본 무수정)
 *
 *   1. V97Sig.sessionBonus 핫픽스 (검수 A-1)
 *      • 발동당 fixed 비율을 baseEarned/문항수 로 정규화 → 발동 횟수에 비례
 *        하지만 폭주하지 않는 적절한 스케일.
 *      • 원본 함수가 사용 가능하면 보존하고, 보강된 wrapper 로 덮어씀.
 *
 *   2. V98Resonance 보너스를 V97Sig.sessionBonus 결과에 합산
 *      (별도 라인으로 reporting — breakdown.resonance 추가)
 *
 *   3. V98Leeline.fire — 정답시 호출.
 *      V97Sig.fireEffect 를 wrap 해서 evaluate가 tier !== null 일 때
 *      fire 를 시도 (50% 확률, throttle 은 모듈 내부).
 *      이는 캐릭터 시그니처가 발동한 인상적인 정답 순간에만 broadcast.
 *
 *   load 순서: 다른 v98 모듈 + v97 모듈 모두 로드 후 마지막.
 * ============================================================================ */
(function(){
'use strict';

// ─── 1+2: V97Sig.sessionBonus 핫픽스 + Resonance 합산 ────────────────
function _patchSignatureBonus(){
  if(!window.V97Sig || typeof window.V97Sig.sessionBonus !== 'function') return false;
  const orig = window.V97Sig.sessionBonus;

  window.V97Sig.sessionBonus = function(baseEarned){
    let r;
    // ── 핫픽스: 발동당 비율을 baseEarned 자체가 아니라 baseEarned/totalEvents
    //   로 정규화한다. 즉 1 발동 = baseEarned × pct × (1/N) 가 아니라,
    //   '문항당 평균 baseEarned' 에 pct 곱하기. 따라서 발동 5번이면
    //   baseEarned×pct×5/N 가 됨 (N=총 정답 수, 추정).
    try{
      const sess = (typeof window.V97Sig.getSession === 'function') ? window.V97Sig.getSession() : null;
      if(sess && (sess.totalChapter || sess.totalYipin || sess.juexueFired)){
        // 추정: 총 정답 수 = totalChapter + totalYipin + 기타.
        // V97Sig 가 정답 수를 추적 안 함 → '발동 횟수 ≤ 정답 수' 사용:
        //   per-event base = baseEarned / max(totalChapter + totalYipin, 1)
        // 보너스는 per-event base × pct × count. 발동 안 한 정답은 보너스 없음.
        const evN = Math.max(1, (sess.totalChapter||0) + (sess.totalYipin||0));
        const perEv = (baseEarned || 0) / evN;
        const ch = Math.round(perEv * 0.10) * (sess.totalChapter||0);
        const yp = Math.round(perEv * 0.25) * (sess.totalYipin||0);
        const jx = sess.juexueFired ? Math.round((baseEarned||0) * 0.50) : 0;
        const raw = ch + yp + jx;
        const cap = Math.round((baseEarned||0) * 0.50);
        const bonus = Math.min(raw, cap);
        r = { bonus, capped: raw > cap, breakdown: { chapter:ch, yipin:yp, juexue:jx, raw, cap } };
      } else {
        r = orig.call(this, baseEarned);
      }
    } catch(_){
      r = orig.call(this, baseEarned);
    }

    // V98Resonance 보너스 합산 (별도 라인)
    try{
      if(window.V98Resonance){
        const res = window.V98Resonance.bonusFor(baseEarned);
        if(res && res.bonus){
          r.bonus = (r.bonus||0) + res.bonus;
          r.breakdown = r.breakdown || {};
          r.breakdown.resonance = res.bonus;
          r.breakdown.resonance_cat = res.cat;
          r.breakdown.resonance_pct = res.pct;
        }
      }
    }catch(_){}

    return r;
  };
  return true;
}

// ─── 3: V97Sig.fireEffect wrap → leeline.fire ────────────────────────
function _patchFireEffect(){
  if(!window.V97Sig || typeof window.V97Sig.fireEffect !== 'function') return false;
  const orig = window.V97Sig.fireEffect;
  window.V97Sig.fireEffect = function(charId, sigData){
    try{ orig.call(this, charId, sigData); }catch(_){}
    // 시그니처가 발동한 정답일 때 50% 확률로 broadcast 후보
    try{
      if(!sigData || !sigData.tier) return;
      if(window.V97Sig.getMode && window.V97Sig.getMode() === 'multi') return;
      if(Math.random() > 0.5) return;
      const f = (sigData.quote && sigData.quote.src) || sigData.line || '';
      if(window.V98Leeline) window.V98Leeline.fire(f);
    }catch(_){}
  };
  return true;
}

// ─── 부팅 — V97 로드 후 시도 (지연 + retry) ───────────────────────────
let _tries = 0;
function _try(){
  if(_tries++ > 30) return;
  let ok = true;
  if(!_patchSignatureBonus()) ok = false;
  if(!_patchFireEffect()) ok = false;
  if(!ok) setTimeout(_try, 200);
}
if(document.readyState !== 'loading') setTimeout(_try, 800);
else document.addEventListener('DOMContentLoaded', () => setTimeout(_try, 800));
})();
