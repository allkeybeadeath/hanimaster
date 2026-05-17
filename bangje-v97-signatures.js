/* bangje-v97-signatures.js — v9.7
 * ============================================================================
 * 캐릭터 시그니처 효과 런타임 — 솔로 학습 전용
 *
 *   • 평가:     V97Sig.evaluate(charId, q, formula) → {tier, color, seal, quote, sound, line, bonusMult}
 *               tier: null | 'chapter' | 'formula'
 *               bonusMult: 0 / 0.10 / 0.25 (절학 추가는 별도)
 *
 *   • 시각/사운드: V97Sig.fireEffect({tier, ...}) → DOM overlay + Web Audio cue
 *
 *   • 멀티 모드:   V97Sig.setMode('multi') → fireEffect no-op (시각·점수 모두 차단)
 *                  V97Sig.setMode('solo')  → 정상 작동 (기본값)
 *
 *   • 절학(絕學):  V97Sig.tickSession(tier) — 동일 퀴즈 내 'formula' 5연속이면
 *                  juexue 발동 신호를 awardAchievement 와 함께 emit.
 *                  새 퀴즈 시작 시 V97Sig.resetSession() 호출 필요.
 *
 * ─── 의존성 ──────────────────────────────────────────────────────────────
 *   • window.CHAR_SIGNATURES         (data-signatures.js)
 *   • window.LEESOONJAE_QUOTES       (data-signatures.js)
 *   • window.bgm (선택)              (app.js 의 Web Audio engine)
 *   • window.PHYSICIAN_BY_ID         (data-physicians.js)
 *   • window.CHARACTER_IMAGES        (data-physicians.js)
 *   • window.FORMULAS                (data-formulas.js, 선택)
 *
 * 모든 의존성은 optional 로 가드되어 있어 단독 로드되어도 안전.
 * ============================================================================ */

(function(){
'use strict';

let _mode = 'solo';                 // 'solo' | 'multi'
let _session = {                    // 퀴즈 단위 세션
  yipinStreak: 0,                   // 逸品 연속
  juexueFired: false,                // 이 퀴즈에서 絕學 발동 여부
  totalChapter: 0,
  totalYipin: 0,
  bonusPercent: 0,                  // 퀴즈 종료 시 합산 보너스 (0.10/0.25 누적합)
  juexueBonus: 0,                   // 별도 0.50
};

function setMode(m){ _mode = (m === 'multi') ? 'multi' : 'solo'; }
function getMode(){ return _mode; }

function resetSession(){
  _session = { yipinStreak:0, juexueFired:false, totalChapter:0, totalYipin:0, bonusPercent:0, juexueBonus:0 };
}

function getSession(){ return Object.assign({}, _session); }

// ─── 평가: 정답 문제 + 캐릭터 → tier ───────────────────────────────────
//   q: 문제 객체 (q, options, answer, explanation, formula? — id/han/ko)
//   formula: (선택) 매칭된 처방 객체 (id, han, ko, chapter)
//
//   tier 결정:
//     1) signatures 배열에 formula.id 있으면 → 'formula' (+25%)
//     2) chapters 배열 중 어느 것이 formula.chapter 부분일치 → 'chapter' (+10%)
//     3) keywords 중 q 텍스트(질문+해설)에 등장 → 'chapter' (+10%)
//     4) 캐릭터가 이순재 + randomChance 통과 → 'leeline' (보너스 0, 어록만)
//     5) 그 외 → null
function evaluate(charId, q, formula){
  const sig = (window.CHAR_SIGNATURES || {})[charId];
  if(!sig) return { tier:null };

  // 이순재 특수: 보너스 없음, 시각만
  if(charId === 'leesoonjae'){
    const ch = (typeof sig.randomChance === 'number') ? sig.randomChance : 0.10;
    if(Math.random() < ch){
      const pool = window.LEESOONJAE_QUOTES || ['뭐 그딴 게 다 있어!'];
      const line = pool[Math.floor(Math.random() * pool.length)];
      return {
        tier: 'leeline', bonusMult: 0,
        color: sig.color, seal: sig.seal,
        quote: { han:'', ko:line, src:sig.quote && sig.quote.src || '' },
        sound: sig.sound || 'silk',
        line,
      };
    }
    return { tier:null };
  }

  const formulaId = formula && formula.id;
  const formulaCh = (formula && formula.chapter) || '';
  const txt = String((q && (q.q || q.question || ''))) + ' ' + String((q && q.explanation) || '');

  // 1) 시그니처 처방 직접 매칭 (逸品)
  if(formulaId && Array.isArray(sig.signatures) && sig.signatures.includes(formulaId)){
    return {
      tier: 'formula', bonusMult: 0.25,
      color: sig.color, seal: sig.seal,
      quote: sig.quote || null, sound: sig.sound || 'gold',
      line: sig.line || '',
    };
  }

  // 2) 章 부분일치 (章典)
  if(formulaCh && Array.isArray(sig.chapters)){
    for(const c of sig.chapters){
      if(c && formulaCh.indexOf(c) >= 0){
        return {
          tier: 'chapter', bonusMult: 0.10,
          color: sig.color, seal: sig.seal,
          quote: sig.quote || null, sound: sig.sound || 'wood',
          line: '',
        };
      }
    }
  }

  // 3) 키워드 보조 (章典)
  if(Array.isArray(sig.keywords) && sig.keywords.length){
    for(const k of sig.keywords){
      if(k && txt.indexOf(k) >= 0){
        return {
          tier: 'chapter', bonusMult: 0.10,
          color: sig.color, seal: sig.seal,
          quote: sig.quote || null, sound: sig.sound || 'wood',
          line: '',
        };
      }
    }
  }

  return { tier:null };
}

// ─── 세션 카운팅 & 절학 평가 ───────────────────────────────────────────
// tier 'formula' 5회 연속이면 juexue 1회 발동
function tickSession(tier){
  const fired = { juexue:false };
  if(tier === 'formula'){
    _session.yipinStreak++;
    _session.totalYipin++;
    _session.bonusPercent += 0.25;
    if(_session.yipinStreak >= 5 && !_session.juexueFired){
      _session.juexueFired = true;
      _session.juexueBonus = 0.50;
      fired.juexue = true;
    }
  } else if(tier === 'chapter'){
    _session.yipinStreak = 0;          // streak 끊김
    _session.totalChapter++;
    _session.bonusPercent += 0.10;
  } else {
    _session.yipinStreak = 0;
  }
  return fired;
}

// 퀴즈 종료 시 합산 보너스 (multi 모드에선 0)
function sessionBonus(baseEarned){
  if(_mode === 'multi') return { bonus:0, breakdown:null };
  const ch  = Math.round(baseEarned * 0.10) * _session.totalChapter;
  const yp  = Math.round(baseEarned * 0.25) * _session.totalYipin;
  const jx  = _session.juexueFired ? Math.round(baseEarned * 0.50) : 0;
  // 보너스 base 는 "퀴즈 1문제당 평균 점수" 로 단순 산정하지 않고,
  // 퀴즈 전체 baseEarned 에 비례한 백분율로 적용.
  // 다만 totalChapter/totalYipin 이 많으면 보너스가 폭발할 수 있으므로
  // 캐릭터 보너스는 baseEarned 의 50% 까지로 캡.
  const raw = ch + yp + jx;
  const cap = Math.round(baseEarned * 0.50);
  const bonus = Math.min(raw, cap);
  return {
    bonus, capped: raw > cap,
    breakdown: { chapter:ch, yipin:yp, juexue:jx, raw, cap },
  };
}

// ─── 시각 효과: 코너 메달리온 (章典) ───────────────────────────────────
function _ensureLayer(){
  let el = document.getElementById('v97-sig-layer');
  if(!el){
    el = document.createElement('div');
    el.id = 'v97-sig-layer';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden';
    document.body.appendChild(el);
  }
  return el;
}

function _imgFor(charId){
  const img = ((window.CHARACTER_IMAGES || {})[charId] || {}).url;
  return img || '';
}

function _charKo(charId){
  const p = (window.PHYSICIAN_BY_ID || {})[charId];
  return p ? (p.ko || p.han || charId) : charId;
}

function _showChapterEffect(charId, sigData){
  if(_mode === 'multi') return;
  const layer = _ensureLayer();
  const img = _imgFor(charId);
  const color = sigData.color || '#C9A227';
  const seal = sigData.seal || '✓';

  const card = document.createElement('div');
  card.className = 'v97-sig-corner';
  card.style.cssText = `
    position:absolute; right:14px; top:74px;
    display:flex; align-items:center; gap:8px;
    background:linear-gradient(135deg, rgba(28,20,10,.92) 0%, ${color}E6 100%);
    color:#FCF4E5; padding:8px 12px 8px 8px;
    border-radius:24px 8px 8px 24px;
    box-shadow:0 6px 20px rgba(0,0,0,.4), 0 0 0 2px ${color}66, 0 0 24px ${color}99;
    font-family:'Noto Serif KR',serif; font-size:13px;
    opacity:0; transform:translateX(40px);
    transition:opacity .25s ease, transform .35s cubic-bezier(.2,.9,.3,1.2);
    max-width:280px;
  `;
  card.innerHTML = `
    ${img ? `<div style="width:42px;height:42px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid ${color};background:#1C140A">
      <img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">
    </div>` : ''}
    <div style="display:flex;flex-direction:column;line-height:1.15;min-width:0">
      <div style="font-family:'ZCOOL XiaoWei','Ma Shan Zheng',serif; font-size:14px; letter-spacing:.06em">
        <span style="color:#FFE08A">章典</span>
        <span style="opacity:.9">·</span>
        <span style="color:#FFF7DC">${_charKo(charId)}</span>
      </div>
      <div style="font-size:10.5px; opacity:.85; letter-spacing:.02em">+10% 氣 보너스 (솔로)</div>
    </div>
    <div style="margin-left:auto;width:30px;height:30px;border-radius:6px;background:#9C3030;color:#FFE08A;
                display:flex;align-items:center;justify-content:center;
                font-family:'ZCOOL XiaoWei',serif;font-size:18px;
                box-shadow:inset 0 0 0 1px #FFE08A66, 0 2px 6px rgba(0,0,0,.5);
                transform:rotate(-6deg);flex-shrink:0">
      ${seal}
    </div>
  `;
  layer.appendChild(card);
  requestAnimationFrame(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateX(0)';
  });
  setTimeout(() => {
    card.style.opacity = '0';
    card.style.transform = 'translateX(40px)';
  }, 1400);
  setTimeout(() => { try{ card.remove(); }catch(_){ } }, 1800);
}

// ─── 시각 효과: 풀화면 인용 (逸品) ─────────────────────────────────────
function _showFormulaEffect(charId, sigData){
  if(_mode === 'multi') return;
  const layer = _ensureLayer();
  const img = _imgFor(charId);
  const color = sigData.color || '#C9A227';
  const seal = sigData.seal || '✓';
  const q = sigData.quote || {};
  const line = sigData.line || '';

  // 풀화면 광채 + 인용 카드
  const burst = document.createElement('div');
  burst.style.cssText = `
    position:absolute; inset:0;
    background:radial-gradient(ellipse at center, ${color}33 0%, transparent 60%);
    opacity:0; transition:opacity .35s ease;
  `;
  const card = document.createElement('div');
  card.className = 'v97-sig-yipin';
  card.style.cssText = `
    position:absolute; left:50%; top:50%;
    transform:translate(-50%, -50%) scale(.9);
    background:linear-gradient(180deg, #1C140A 0%, #2A1E10 100%);
    color:#FCF4E5;
    padding:20px 26px;
    border-radius:14px;
    box-shadow:0 12px 40px rgba(0,0,0,.6), 0 0 0 2px ${color}, 0 0 60px ${color}AA;
    font-family:'Noto Serif KR',serif;
    text-align:center;
    max-width:min(90vw, 480px);
    opacity:0;
    transition:opacity .3s ease, transform .45s cubic-bezier(.2,.9,.3,1.4);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:12px">
      ${img ? `<div style="width:60px;height:60px;border-radius:50%;overflow:hidden;border:3px solid ${color};background:#1C140A;box-shadow:0 0 24px ${color}99">
        <img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">
      </div>` : ''}
      <div style="width:46px;height:46px;border-radius:8px;background:#9C3030;color:#FFE08A;
                  display:flex;align-items:center;justify-content:center;
                  font-family:'ZCOOL XiaoWei',serif;font-size:26px;
                  box-shadow:inset 0 0 0 2px #FFE08A88, 0 4px 12px rgba(0,0,0,.6);
                  transform:rotate(-8deg)">
        ${seal}
      </div>
    </div>
    <div style="font-family:'ZCOOL XiaoWei',serif;font-size:15px;color:${color};letter-spacing:.1em;margin-bottom:8px">
      逸品 · ${_charKo(charId)}
    </div>
    ${q.han ? `<div style="font-family:'Noto Serif SC','Noto Serif KR',serif;font-size:19px;line-height:1.55;color:#FFE08A;margin-bottom:6px">${escapeHtml(q.han)}</div>` : ''}
    ${q.ko  ? `<div style="font-size:12.5px;color:#E8D4B8;line-height:1.5;margin-bottom:8px">${escapeHtml(q.ko)}</div>` : ''}
    ${q.src ? `<div style="font-size:10.5px;color:#876A36;font-style:italic">— ${escapeHtml(q.src)}</div>` : ''}
    ${line  ? `<div style="margin-top:10px;padding-top:8px;border-top:1px dashed #876A3666;font-size:12px;color:#C9A227">「${escapeHtml(line)}」</div>` : ''}
    <div style="margin-top:10px;font-size:11px;color:#2A7060;font-weight:600">+25% 氣 보너스 (솔로)</div>
  `;
  layer.appendChild(burst);
  layer.appendChild(card);
  requestAnimationFrame(() => {
    burst.style.opacity = '1';
    card.style.opacity = '1';
    card.style.transform = 'translate(-50%, -50%) scale(1)';
  });
  setTimeout(() => {
    burst.style.opacity = '0';
    card.style.opacity = '0';
    card.style.transform = 'translate(-50%, -50%) scale(1.05)';
  }, 1600);
  setTimeout(() => { try{ burst.remove(); card.remove(); }catch(_){ } }, 2000);
}

// ─── 시각 효과: 絕學 大印 ──────────────────────────────────────────────
function fireJuexueEffect(charId, sigData){
  if(_mode === 'multi') return;
  const layer = _ensureLayer();
  const color = (sigData && sigData.color) || '#C9A227';
  const big = document.createElement('div');
  big.style.cssText = `
    position:absolute; left:50%; top:50%;
    transform:translate(-50%, -50%) scale(.3) rotate(-30deg);
    width:240px;height:240px;border-radius:18px;
    background:radial-gradient(circle, #9C3030 0%, #6E1818 100%);
    color:#FFE08A;
    display:flex;align-items:center;justify-content:center;
    font-family:'ZCOOL XiaoWei',serif; font-size:120px; font-weight:900;
    letter-spacing:-.08em;
    box-shadow:0 0 80px ${color}DD, inset 0 0 0 6px #FFE08A88, 0 20px 60px rgba(0,0,0,.6);
    opacity:0; transition:opacity .3s ease, transform .6s cubic-bezier(.2,.9,.3,1.6);
  `;
  big.textContent = '絕學';
  layer.appendChild(big);
  requestAnimationFrame(() => {
    big.style.opacity = '1';
    big.style.transform = 'translate(-50%, -50%) scale(1) rotate(-6deg)';
  });
  setTimeout(() => {
    big.style.opacity = '0';
    big.style.transform = 'translate(-50%, -50%) scale(1.3) rotate(-6deg)';
  }, 1700);
  setTimeout(() => { try{ big.remove(); }catch(_){ } }, 2100);

  _playSound('jade-juexue');
}

// ─── HTML 안전 ─────────────────────────────────────────────────────────
function escapeHtml(s){
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── 사운드: Web Audio Oscillator (BGM 시스템과 별개) ──────────────────
// app.js 의 bgm 객체는 sfxCorrect/sfxWrong 만 노출. 별도 톤 합성.
let _ac = null;
function _audioCtx(){
  if(_ac) return _ac;
  try{ _ac = new (window.AudioContext || window.webkitAudioContext)(); }catch(_){ _ac = null; }
  return _ac;
}

// 시그니처 음색 (五聲音階 기반 짧은 화음)
//  gold   : 5도(C-G)·옥타브 (鐘)
//  silver : 4도(C-F)·옥타브 (磬)
//  jade   : 5음 분산 (C-D-E-G-A)
//  wood   : 단음 D (魚)
//  silk   : C·E·G 삼화음
function _playSound(kind){
  if(_mode === 'multi') return;
  const ctx = _audioCtx(); if(!ctx) return;
  const now = ctx.currentTime;
  const G = ctx.createGain();
  G.gain.value = 0;
  G.connect(ctx.destination);

  const playTone = (freq, t0, dur, type, peak) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, now + t0);
    g.gain.linearRampToValueAtTime(peak || 0.12, now + t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
    o.connect(g); g.connect(G);
    o.start(now + t0); o.stop(now + t0 + dur + 0.05);
  };

  const base = 261.63; // C4
  const D = base*9/8, E = base*5/4, F = base*4/3, G2 = base*3/2, A = base*5/3, C5 = base*2;

  switch(kind){
    case 'gold':
      playTone(base, 0,    0.6, 'sine',     0.10);
      playTone(G2,   0.06, 0.6, 'sine',     0.10);
      playTone(C5,   0.12, 0.55,'triangle', 0.08);
      break;
    case 'silver':
      playTone(base, 0,    0.55,'sine',     0.10);
      playTone(F,    0.05, 0.5, 'triangle', 0.09);
      break;
    case 'jade':
      playTone(base, 0.00, 0.30,'sine',     0.08);
      playTone(D,    0.10, 0.30,'sine',     0.08);
      playTone(E,    0.20, 0.30,'sine',     0.08);
      playTone(G2,   0.30, 0.30,'sine',     0.08);
      playTone(A,    0.40, 0.45,'sine',     0.10);
      break;
    case 'wood':
      playTone(D,    0,    0.20,'triangle', 0.10);
      break;
    case 'silk':
      playTone(base, 0,    0.6, 'sine',     0.07);
      playTone(E,    0.02, 0.55,'sine',     0.07);
      playTone(G2,   0.04, 0.5, 'sine',     0.07);
      break;
    case 'jade-juexue':
      // 큰 화려한 화음
      [base, E, G2, C5, base*3].forEach((f,i) => playTone(f, i*0.06, 1.2, i<3?'sine':'triangle', 0.10));
      break;
    default:
      playTone(base, 0, 0.3, 'sine', 0.08);
  }
}

// ─── 공개 API: 효과 발사 ───────────────────────────────────────────────
function fireEffect(charId, sigData){
  if(!sigData || !sigData.tier) return;
  if(_mode === 'multi') return;
  if(sigData.tier === 'formula' || sigData.tier === 'leeline'){
    _showFormulaEffect(charId, sigData);
    _playSound(sigData.sound || 'gold');
  } else if(sigData.tier === 'chapter'){
    _showChapterEffect(charId, sigData);
    _playSound(sigData.sound || 'wood');
  }
}

// ─── 전역 노출 ────────────────────────────────────────────────────────
window.V97Sig = {
  evaluate, fireEffect, fireJuexueEffect,
  setMode, getMode,
  tickSession, resetSession, getSession, sessionBonus,
};

})();
