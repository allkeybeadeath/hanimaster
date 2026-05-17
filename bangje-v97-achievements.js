/* bangje-v97-achievements.js — v9.7
 * ============================================================================
 * 업적(業績) 추적 — 카운터 누적 · 조건 평가 · 해제 토스트
 *
 *   • 상태:
 *     S.achievements    : string[] (해제된 업적 id)
 *     S.achStats        : { [counterName]: number }
 *     S.equippedSeals   : string[] (장착 업적 id, 최대 3개)
 *     S.battleStats     : {wins, losses, draws, bigWins(>=3), fateWins(>=4),
 *                          curStreak, bestStreak, attended}
 *     S.signatureStats  : {chapterFired, yipinFired, juexueFired, leelineFired}
 *
 *   • 공개 API:
 *     V97Ach.bumpCounter(name, by=1)   → 카운터 증가 + 즉시 평가
 *     V97Ach.recordBattle({outcome, betLevel}) → 對決 결과 기록
 *     V97Ach.recordSignature(kind)      → 시그니처 발동 기록
 *     V97Ach.recordChat()               → 채팅 게시
 *     V97Ach.recordCubeJoin()           → 큐브 참여
 *     V97Ach.recordChapterRight(chap)   → 章별 정답 (chap: 6/7/8 번호)
 *     V97Ach.recordCharacterRight(id)   → 캐릭터별 정답
 *     V97Ach.recordPerfectQuiz()        → 全 정답 1회
 *     V97Ach.recordPresencePeak(n)      → 온라인 동시접속 최대치 갱신
 *     V97Ach.recordWrongCleared()       → 오답함 비웠음
 *     V97Ach.evaluateAll()              → 전체 재평가 (강제)
 *     V97Ach.has(id)                    → 해제 여부
 *     V97Ach.equip(id) / V97Ach.unequip(id) / V97Ach.getEquipped()
 *
 * ─── 의존성 ──────────────────────────────────────────────────────────────
 *   • window.S, window.saveState   (app.js)
 *   • window.toast                 (app.js)
 *   • window.ACHIEVEMENTS, window.ACHIEVEMENT_BY_ID  (data-achievements.js)
 *   • window.PHYSICIAN_BY_ID, window.PHYSICIANS      (data-physicians.js)
 *   • window.EXAM_DATE_ISO 또는 EXAM_META            (app.js — 시험일)
 *
 * 의존성이 없어도 throw 하지 않음 (안전 가드).
 * ============================================================================ */

(function(){
'use strict';

// ─── 안전 헬퍼 ────────────────────────────────────────────────────────
function S(){ return window.S || null; }
function save(){ try{ window.saveState && window.saveState(); }catch(_){} }

function ensureFields(){
  const s = S(); if(!s) return null;
  if(!Array.isArray(s.achievements)) s.achievements = [];
  if(!Array.isArray(s.equippedSeals)) s.equippedSeals = [];
  if(!s.achStats || typeof s.achStats !== 'object') s.achStats = {};
  if(!s.battleStats || typeof s.battleStats !== 'object'){
    s.battleStats = { wins:0, losses:0, draws:0, bigWins:0, fateWins:0,
                      curStreak:0, bestStreak:0, attended:0 };
  }
  // legacy 보강
  ['wins','losses','draws','bigWins','fateWins','curStreak','bestStreak','attended'].forEach(k=>{
    if(typeof s.battleStats[k] !== 'number') s.battleStats[k] = 0;
  });
  if(!s.signatureStats || typeof s.signatureStats !== 'object'){
    s.signatureStats = { chapterFired:0, yipinFired:0, juexueFired:0, leelineFired:0 };
  }
  ['chapterFired','yipinFired','juexueFired','leelineFired'].forEach(k=>{
    if(typeof s.signatureStats[k] !== 'number') s.signatureStats[k] = 0;
  });
  return s;
}

// ─── 토스트 표시 (app.js 의 toast 없을 때 대체) ────────────────────────
function _toast(msg, kind){
  if(typeof window.toast === 'function'){
    try{ window.toast(msg, kind); return; }catch(_){}
  }
  // 대체: 간단 fallback
  try{
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `position:fixed;left:50%;top:80px;transform:translateX(-50%);
      background:#1C140A;color:#FFE08A;padding:8px 14px;border-radius:6px;
      box-shadow:0 4px 12px rgba(0,0,0,.4);z-index:9999;font-size:13px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }catch(_){}
}

// ─── 큰 해제 알림 (메달리온 + 업적명) ──────────────────────────────────
function _showUnlockOverlay(ach){
  try{
    const layer = (function(){
      let el = document.getElementById('v97-ach-layer');
      if(!el){
        el = document.createElement('div');
        el.id = 'v97-ach-layer';
        el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9100;overflow:hidden';
        document.body.appendChild(el);
      }
      return el;
    })();
    const tier = (window.TIER_META || {})[ach.tier] || { color:'#C9A227', glow:'rgba(201,162,39,.55)' };
    const card = document.createElement('div');
    card.style.cssText = `
      position:absolute; left:50%; bottom:90px;
      transform:translate(-50%, 30px);
      background:linear-gradient(180deg, #1C140A 0%, #2A1E10 100%);
      color:#FCF4E5;
      padding:12px 18px;
      border-radius:10px;
      box-shadow:0 8px 28px rgba(0,0,0,.5), 0 0 0 2px ${tier.color}, 0 0 40px ${tier.glow};
      font-family:'Noto Serif KR',serif;
      display:flex; align-items:center; gap:14px;
      max-width:min(90vw, 380px);
      opacity:0;
      transition:opacity .3s ease, transform .45s cubic-bezier(.2,.9,.3,1.3);
    `;
    card.innerHTML = `
      <div style="width:54px;height:54px;border-radius:8px;background:#9C3030;color:#FFE08A;
                  display:flex;align-items:center;justify-content:center;
                  font-family:'ZCOOL XiaoWei',serif;font-size:28px;
                  box-shadow:inset 0 0 0 2px ${tier.color}, 0 4px 12px rgba(0,0,0,.6);
                  transform:rotate(-6deg);flex-shrink:0">
        ${escapeHtml(ach.sealHan || '✓')}
      </div>
      <div style="min-width:0">
        <div style="font-family:'ZCOOL XiaoWei',serif;font-size:11px;color:${tier.color};letter-spacing:.16em;text-transform:uppercase">業績 解禁 · ${escapeHtml(tier.label || '')}</div>
        <div style="font-size:15.5px;color:#FFE08A;font-weight:700;margin-top:2px">${escapeHtml(ach.han)} · ${escapeHtml(ach.ko)}</div>
        <div style="font-size:11px;color:#C9A227;margin-top:1px">${escapeHtml(ach.desc)}</div>
      </div>
    `;
    layer.appendChild(card);
    requestAnimationFrame(() => {
      card.style.opacity = '1';
      card.style.transform = 'translate(-50%, 0)';
    });
    setTimeout(() => {
      card.style.opacity = '0';
      card.style.transform = 'translate(-50%, 30px)';
    }, 2600);
    setTimeout(() => { try{ card.remove(); }catch(_){ } }, 3000);
  }catch(_){}
}

function escapeHtml(s){
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── 조건 평가 ────────────────────────────────────────────────────────
function _evalCond(ach, ctx){
  const s = ctx.s;
  const c = ach.cond || {};
  switch(c.type){
    case 'counter_gte': {
      const v = (s.achStats && s.achStats[c.name]) || 0;
      // 가상 카운터 (런타임 합성)
      if(c.name === 'knownIdsCount') return (s.knownIds||[]).length >= c.threshold;
      if(c.name === 'flashRatedCount') return Object.keys(s.flashRated||{}).length >= c.threshold;
      if(c.name === 'battleAttended') return ((s.battleStats||{}).attended||0) >= c.threshold;
      if(c.name === 'maxRightByChar'){
        const map = (s.achStats && s.achStats._rightByChar) || {};
        const max = Object.values(map).reduce((a,b) => a>b?a:b, 0);
        return max >= c.threshold;
      }
      if(c.name && c.name.indexOf('rightByChapter:') === 0){
        const chap = c.name.split(':')[1];
        const map = (s.achStats && s.achStats._rightByChapter) || {};
        return (map[chap] || 0) >= c.threshold;
      }
      if(c.name && c.name.indexOf('rightByChar:') === 0){
        const ch = c.name.split(':')[1];
        const map = (s.achStats && s.achStats._rightByChar) || {};
        return (map[ch] || 0) >= c.threshold;
      }
      return v >= c.threshold;
    }
    case 'streak_gte':
      return (s.achStats && s.achStats.bestStreak || 0) >= c.threshold;
    case 'perfectQuiz':
      return (s.achStats && s.achStats.perfectQuiz || 0) >= c.threshold;
    case 'wrongCleared':
      return !!(s.achStats && s.achStats.wrongCleared);
    case 'battleWin':
      return (s.battleStats && s.battleStats.wins || 0) >= c.threshold;
    case 'battleStreak':
      return (s.battleStats && s.battleStats.bestStreak || 0) >= c.threshold;
    case 'battleBetLevel': {
      if(c.level === 3) return (s.battleStats && s.battleStats.bigWins || 0) >= c.threshold;
      if(c.level === 4) return (s.battleStats && s.battleStats.fateWins || 0) >= c.threshold;
      return false;
    }
    case 'characterCount': {
      // 사용한(정답 1회 이상) 캐릭터 카테고리 수
      const map = (s.achStats && s.achStats._rightByChar) || {};
      const byId = window.PHYSICIAN_BY_ID || {};
      const cats = new Set();
      Object.keys(map).forEach(id => {
        const p = byId[id];
        if(p && p.cat) cats.add(p.cat);
      });
      return cats.size >= c.threshold;
    }
    case 'characterDivine': {
      return (s.unlockedDivine || []).length >= c.threshold;
    }
    case 'signatureFired': {
      const k = c.kind;
      const m = s.signatureStats || {};
      const key = k === 'chapter' ? 'chapterFired'
                : k === 'formula' ? 'yipinFired'
                : k === 'juexue'  ? 'juexueFired'
                : k === 'leeline' ? 'leelineFired' : null;
      if(!key) return false;
      return (m[key] || 0) >= c.threshold;
    }
    case 'timeOfDay': {
      const now = new Date();
      const h = now.getHours();
      if(Array.isArray(c.hours)){
        // hours: [start, end] inclusive (자정 횡단도 처리)
        const [a, b] = c.hours;
        if(a <= b) return h >= a && h <= b;
        return h >= a || h <= b;
      }
      return false;
    }
    case 'daysToExam': {
      const iso = (window.EXAM_DATE_ISO || (window.EXAM_META && window.EXAM_META.dateISO));
      if(!iso) return false;
      const exam = new Date(iso).getTime();
      const days = Math.floor((exam - Date.now()) / (1000*60*60*24));
      return days === c.value;
    }
    case 'allChaptersCleared': {
      const map = (s.achStats && s.achStats._rightByChapter) || {};
      const six = (map['6']||0), seven = (map['7']||0), eight = (map['8']||0);
      return six >= 20 && seven >= 20 && eight >= 20;
    }
    case 'achievementCount':
      return (s.achievements || []).length >= c.threshold;
  }
  return false;
}

// ─── 평가 + 해제 ──────────────────────────────────────────────────────
function evaluateAll(silent){
  const s = ensureFields(); if(!s) return;
  const list = window.ACHIEVEMENTS || [];
  const have = new Set(s.achievements || []);
  const ctx = { s };
  let newly = [];
  list.forEach(ach => {
    if(have.has(ach.id)) return;
    if(_evalCond(ach, ctx)){
      s.achievements.push(ach.id);
      have.add(ach.id);
      newly.push(ach);
    }
  });
  if(newly.length){
    save();
    if(!silent){
      newly.forEach((ach, i) => {
        setTimeout(() => _showUnlockOverlay(ach), i * 400);
      });
    }
    // 메타 업적 (collector) 재평가
    list.forEach(ach => {
      if(have.has(ach.id)) return;
      if(ach.cond && ach.cond.type === 'achievementCount' && _evalCond(ach, ctx)){
        s.achievements.push(ach.id);
        have.add(ach.id);
        save();
        if(!silent) setTimeout(() => _showUnlockOverlay(ach), newly.length * 400);
      }
    });
  }
  return newly;
}

// ─── 카운터 조작 ──────────────────────────────────────────────────────
function bumpCounter(name, by){
  const s = ensureFields(); if(!s) return;
  by = (typeof by === 'number') ? by : 1;
  s.achStats[name] = (s.achStats[name] || 0) + by;
  save();
  evaluateAll();
}

function setCounter(name, val){
  const s = ensureFields(); if(!s) return;
  s.achStats[name] = val;
  save();
  evaluateAll();
}

function maxCounter(name, val){
  const s = ensureFields(); if(!s) return;
  if(!s.achStats[name] || val > s.achStats[name]){
    s.achStats[name] = val;
    save();
    evaluateAll();
  }
}

// ─── 도메인 헬퍼 ──────────────────────────────────────────────────────
function recordBattle({outcome, betLevel}){
  const s = ensureFields(); if(!s) return;
  s.battleStats.attended++;
  if(outcome === 'win'){
    s.battleStats.wins++;
    s.battleStats.curStreak++;
    if(s.battleStats.curStreak > s.battleStats.bestStreak){
      s.battleStats.bestStreak = s.battleStats.curStreak;
    }
    if(betLevel === 3) s.battleStats.bigWins++;
    if(betLevel === 4) s.battleStats.fateWins++;
  } else if(outcome === 'lose'){
    s.battleStats.losses++;
    s.battleStats.curStreak = 0;
  } else if(outcome === 'draw'){
    s.battleStats.draws++;
  }
  save();
  evaluateAll();
}

function recordSignature(kind){
  const s = ensureFields(); if(!s) return;
  const key = kind === 'chapter' ? 'chapterFired'
            : kind === 'formula' ? 'yipinFired'
            : kind === 'juexue'  ? 'juexueFired'
            : kind === 'leeline' ? 'leelineFired' : null;
  if(!key) return;
  s.signatureStats[key]++;
  save();
  evaluateAll();
}

function recordChat(){ bumpCounter('chatPosted', 1); }
function recordCubeJoin(){ bumpCounter('cubeJoined', 1); }

function recordChapterRight(chap){
  const s = ensureFields(); if(!s) return;
  if(!s.achStats._rightByChapter) s.achStats._rightByChapter = {};
  const k = String(chap);
  s.achStats._rightByChapter[k] = (s.achStats._rightByChapter[k] || 0) + 1;
  save();
  evaluateAll();
}

function recordCharacterRight(charId){
  const s = ensureFields(); if(!s) return;
  if(!s.achStats._rightByChar) s.achStats._rightByChar = {};
  s.achStats._rightByChar[charId] = (s.achStats._rightByChar[charId] || 0) + 1;
  save();
  evaluateAll();
}

function recordPerfectQuiz(){ bumpCounter('perfectQuiz', 1); }

function recordPresencePeak(n){ maxCounter('presencePeak', n); }

function recordStreak(n){ maxCounter('bestStreak', n); }

function recordWrongCleared(){
  const s = ensureFields(); if(!s) return;
  s.achStats.wrongCleared = true;
  save();
  evaluateAll();
}

// ─── 印章 장착 (프로필 꾸미기) ─────────────────────────────────────────
function getEquipped(){
  const s = ensureFields(); if(!s) return [];
  return Array.isArray(s.equippedSeals) ? s.equippedSeals.slice() : [];
}

function equip(id){
  const s = ensureFields(); if(!s) return false;
  if(!s.achievements.includes(id)) return false;
  if(!Array.isArray(s.equippedSeals)) s.equippedSeals = [];
  if(s.equippedSeals.includes(id)) return true;
  if(s.equippedSeals.length >= 3) return false;     // 최대 3개
  s.equippedSeals.push(id);
  save();
  return true;
}

function unequip(id){
  const s = ensureFields(); if(!s) return false;
  s.equippedSeals = (s.equippedSeals || []).filter(x => x !== id);
  save();
  return true;
}

function has(id){
  const s = ensureFields(); if(!s) return false;
  return (s.achievements || []).includes(id);
}

// ─── 전역 노출 ────────────────────────────────────────────────────────
window.V97Ach = {
  bumpCounter, setCounter, maxCounter,
  recordBattle, recordSignature, recordChat, recordCubeJoin,
  recordChapterRight, recordCharacterRight,
  recordPerfectQuiz, recordPresencePeak, recordStreak,
  recordWrongCleared,
  evaluateAll, has,
  equip, unequip, getEquipped,
  // 디버그용
  _ensureFields: ensureFields,
};

// 초기 평가 (시간대·등급 등 부팅 시점 평가)
function _initialEval(){
  if(!window.S){ setTimeout(_initialEval, 200); return; }
  ensureFields();
  evaluateAll();
}
if(document.readyState === 'complete' || document.readyState === 'interactive'){
  setTimeout(_initialEval, 600);
} else {
  document.addEventListener('DOMContentLoaded', () => setTimeout(_initialEval, 600));
}

})();
