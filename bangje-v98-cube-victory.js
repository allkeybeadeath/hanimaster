/* bangje-v98-cube-victory.js — v9.8.1 큐브 승리 룰
 *
 * 변경 골자
 *   1) 234等 폐지 — 단일 승자만 기 획득
 *   2) 6축 보상 산출
 *      ① Base                  : +80
 *      ② 인원수 보너스         : (N − 2) × 20, max +40
 *      ③ 처방 난이도 보너스    : floor(formScore × 0.5), max +30  (v9.6 호환, cap만 30 으로 조정)
 *      ④ 본초 수 보너스        : floor(totalHerbsInMySets × 1.5), max +30  (新)
 *      ⑤ 콤보 보너스           : maxCombo × 5, max +30  (新)
 *      ⑥ 선출패 보너스         : 1st-meld=+20 · 2nd=+10 · else 0  (新)
 *
 * 트래킹 필드 (cube_rooms/{rid}/players/{uid}/...) — 자동 마이그레이션 (누락=0)
 *   - _setStreak           : 직전 (자신의) 턴 commit 여부 누계 (drawing turn → 0 리셋)
 *   - _maxCombo            : 게임 중 max streak
 *   - _firstCommitAt       : 최초 commit 의 timestamp (ms, null until first commit)
 *   - _totalHerbsInMySets  : 본인이 새 set 생성 + 기존 set 에 본초 추가한 총 herb 수
 *
 * 외부 의존 (silent skip if absent)
 *   - window.S, window.FB, window.esc, window.saveState, window.refreshHeader
 *   - bangje-cube.js 의 hook 3개:
 *       commitTurn  → V98CubeVictory.computeCommitUpdates({room, uid, newSetsByMe, herbDelta})
 *       draw(n=1)   → V98CubeVictory.computeDrawUpdates({room, uid})
 *       renderResult → V98CubeVictory.renderResult(rid, room, host) 가 존재하면 우선 호출
 *   - bangje-v96-part4.js 의 hook 2개:
 *       AI commit   → V98CubeVictory.applyAiCommit(_room, aiUid, setObj, isNewSet, addedHerbs)
 *       AI draw     → V98CubeVictory.applyAiDraw(_room, aiUid)
 */
(function(){
'use strict';

// ──────────────────────────────────────────────
// 상수 — 모두 노출, 향후 튜닝 용이
// ──────────────────────────────────────────────
const VER             = '9.8.1';
const BASE_WIN        = 80;
const PLAYER_RATE     = 20;
const PLAYER_CAP      = 40;
const DIFF_RATE       = 0.5;
const DIFF_CAP        = 30;
const HERB_RATE       = 1.5;
const HERB_CAP        = 30;
const COMBO_RATE      = 5;
const COMBO_CAP       = 30;
const FIRST_OUT_TIER  = [20, 10, 0];   // index by # preceding committers

const FB_NODE = 'cube_rooms';

// ──────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────
function nowMs(){ return Date.now(); }
function esc_(s){
  return (typeof window.esc === 'function')
    ? window.esc(s)
    : String(s||'').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
}
function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }
function getQi(){ return (typeof window.S === 'object' && window.S) ? (window.S.qi || 0) : 0; }
function persist(){
  try{ if(typeof window.saveState === 'function') window.saveState(); }catch(_){}
  try{ if(typeof window.refreshHeader === 'function') window.refreshHeader(); }catch(_){}
}

// ──────────────────────────────────────────────
// commitTurn 훅 — RTDB 에 쓸 추가 path patches 반환
//   ctx = { room, uid, newSetsByMe (count), herbDelta }
//     newSetsByMe : 이번 commit 으로 새로 만든 set 의 개수 (≥0)
//     herbDelta   : 이번 commit 으로 내가 추가한 본초 수 (새 set 본초 + 기존 set 추가분)
//
// 룰: 1턴에 한 번 이상 commit 했으면 streak += 1.
//      newSetsByMe 가 0 이어도 (기존 set 에 본초만 추가) commit 행위로 인정.
// ──────────────────────────────────────────────
function computeCommitUpdates(ctx){
  const out = {};
  if(!ctx || !ctx.room || !ctx.uid) return out;
  const { room, uid, herbDelta } = ctx;
  const me = (room.players && room.players[uid]) || {};
  const prevStreak = me._setStreak || 0;
  const newStreak = prevStreak + 1;
  const prevMax = me._maxCombo || 0;
  out[`players/${uid}/_setStreak`] = newStreak;
  if(newStreak > prevMax) out[`players/${uid}/_maxCombo`] = newStreak;
  if(!me._firstCommitAt){
    out[`players/${uid}/_firstCommitAt`] = nowMs();
  }
  if(herbDelta > 0){
    const prevHerbs = me._totalHerbsInMySets || 0;
    out[`players/${uid}/_totalHerbsInMySets`] = prevHerbs + herbDelta;
  }
  return out;
}

// ──────────────────────────────────────────────
// draw(n=1) 훅 — 턴 종료 (드로우) 시 streak 리셋
// ──────────────────────────────────────────────
function computeDrawUpdates(ctx){
  const out = {};
  if(!ctx || !ctx.uid) return out;
  out[`players/${ctx.uid}/_setStreak`] = 0;
  return out;
}

// ──────────────────────────────────────────────
// AI commit 훅 — bangje-v96-part4.js 에서 직접 _room 변이
// ──────────────────────────────────────────────
function applyAiCommit(_room, aiUid, setObj, isNewSet, addedHerbs){
  if(!_room || !aiUid) return;
  _room.players = _room.players || {};
  const p = _room.players[aiUid] = _room.players[aiUid] || {};
  const prevStreak = p._setStreak || 0;
  p._setStreak = prevStreak + 1;
  if(p._setStreak > (p._maxCombo || 0)) p._maxCombo = p._setStreak;
  if(!p._firstCommitAt) p._firstCommitAt = nowMs();
  const dh = (typeof addedHerbs === 'number') ? addedHerbs
              : (isNewSet ? (setObj && setObj.herbs ? setObj.herbs.length : 0) : 0);
  if(dh > 0) p._totalHerbsInMySets = (p._totalHerbsInMySets || 0) + dh;
}

function applyAiDraw(_room, aiUid){
  if(!_room || !aiUid) return;
  _room.players = _room.players || {};
  const p = _room.players[aiUid] = _room.players[aiUid] || {};
  p._setStreak = 0;
}

// ──────────────────────────────────────────────
// 보상 산출
// ──────────────────────────────────────────────
function computeReward(room, winnerUid){
  const ps = (room && room.players) || {};
  const order = (room && room.turnOrder) || Object.keys(ps);
  const N = order.length || Object.keys(ps).length || 1;
  const w = ps[winnerUid] || {};

  // ② 인원수
  const playerBonus = clamp((N - 2) * PLAYER_RATE, 0, PLAYER_CAP);
  // ③ 난이도
  const formScore = w._formulationScore || 0;
  const diffBonus = clamp(Math.floor(formScore * DIFF_RATE), 0, DIFF_CAP);
  // ④ 본초 수
  const herbs = w._totalHerbsInMySets || 0;
  const herbBonus = clamp(Math.floor(herbs * HERB_RATE), 0, HERB_CAP);
  // ⑤ 콤보
  const combo = w._maxCombo || 0;
  const comboBonus = clamp(combo * COMBO_RATE, 0, COMBO_CAP);
  // ⑥ 선출패 — 승자보다 먼저 commit 한 다른 player 수
  const winnerFirstAt = w._firstCommitAt || Infinity;
  let preceding = 0;
  for(const [uid, p] of Object.entries(ps)){
    if(uid === winnerUid) continue;
    const t = p._firstCommitAt;
    if(typeof t === 'number' && t < winnerFirstAt) preceding++;
  }
  const firstOutBonus = FIRST_OUT_TIER[Math.min(FIRST_OUT_TIER.length - 1, preceding)] || 0;

  const total = BASE_WIN + playerBonus + diffBonus + herbBonus + comboBonus + firstOutBonus;
  return {
    total,
    parts: {
      base:      { label: '기본',      value: BASE_WIN,       meta: '승리 기본' },
      players:   { label: '인원수',    value: playerBonus,    meta: `${N}人 對局` },
      difficult: { label: '처방 난이도', value: diffBonus,    meta: `난이도 점수 ${formScore} pt` },
      herbs:     { label: '본초 수',   value: herbBonus,      meta: `누적 본초 ${herbs} 미` },
      combo:     { label: '콤보',      value: comboBonus,     meta: `max ${combo} 연속` },
      firstOut:  { label: '선출패',    value: firstOutBonus,  meta: preceding === 0 ? '첫 出牌' : (preceding === 1 ? '2번째 出牌' : `${preceding+1}번째 出牌`) },
    },
    stats: { N, formScore, herbs, combo, preceding },
  };
}

// ──────────────────────────────────────────────
// 결과 화면 (단일 승자 + 패자 점수표 + 보드)
// ──────────────────────────────────────────────
const _settled = {};

function renderResult(rid, room /*, hostCtx */){
  const v = document.getElementById('view'); if(!v) return false;

  const u = (typeof window.S === 'object' && window.S) ? window.S.userId : null;
  const winnerId = (room && room.result && room.result.winnerId) || '';
  const ps = (room && room.players) || {};
  const winner = ps[winnerId] || {};
  const isWin = (winnerId === u);

  const rew = computeReward(room, winnerId);

  // 정산 (한 번만 — 본 클라가 승자일 때만 氣 가산)
  let granted = 0;
  if(!_settled[rid]){
    _settled[rid] = true;
    if(isWin && rew.total > 0 && typeof window.S === 'object' && window.S){
      window.S.qi = (window.S.qi || 0) + rew.total;
      granted = rew.total;
      persist();
    }
    // history 기록
    if(typeof window.S === 'object' && window.S){
      window.S.cubeHistory = window.S.cubeHistory || [];
      window.S.cubeHistory.unshift({
        ts: nowMs(),
        roomId: rid,
        win: isWin,
        deltaQi: isWin ? rew.total : 0,
        formulationScore: (ps[u]||{})._formulationScore || 0,
        herbs: (ps[u]||{})._totalHerbsInMySets || 0,
        maxCombo: (ps[u]||{})._maxCombo || 0,
        opponents: Math.max(0, Object.keys(ps).length - 1),
        boardSets: ((room||{}).board || []).length,
        ver: VER,
      });
      if(window.S.cubeHistory.length > 20) window.S.cubeHistory = window.S.cubeHistory.slice(0, 20);
      persist();
    }
  }

  // 보드 요약 (matchSet 노출 안되면 herbs 만 표시)
  const finalBoard = ((room||{}).board || []).map(s => {
    let top = null;
    if(typeof window.BC === 'object' && window.BC && typeof window.BC.matchSet === 'function'){
      const ms = window.BC.matchSet(s.herbs);
      top = (ms.find(x => x.type==='base') || ms[0] || null);
    }
    return {
      label: top ? top.label : (s.label || '?'),
      han:   top ? (top.han || '') : (s.han || ''),
      type:  top ? top.type : (s.type || '?'),
      herbs: s.herbs || [],
    };
  });

  // 패자 점수표 (승자 제외, 처방 점수 desc)
  const losers = Object.entries(ps).filter(([uid]) => uid !== winnerId)
    .map(([uid, p]) => ({uid, ...p, _formulationScore: p._formulationScore || 0, _totalHerbsInMySets: p._totalHerbsInMySets || 0, _maxCombo: p._maxCombo || 0}))
    .sort((a, b) => (b._formulationScore - a._formulationScore));

  const winnerPart = rew.parts;
  v.innerHTML = `
    <div id="bc-result-root">
      <div class="view-title"><span class="han">${isWin ? '勝' : '終'}</span> 對局 종료</div>

      <!-- 결과 카드 -->
      <div class="card imperial fade-in" style="text-align:center;padding:18px 12px">
        <div style="font-size:48px;font-family:var(--font-display);color:${isWin ? 'var(--zhusha-d)' : 'var(--gutong)'};line-height:1;letter-spacing:.1em">
          ${isWin ? '勝' : '敗'}
        </div>
        <div style="font-size:14px;color:var(--mo-l);margin-top:8px">
          ${isWin
            ? '<b style="color:var(--zhusha-d)">당신의 승리입니다</b>'
            : `승자: <b>${esc_(winner.name||'?')}</b>`}
        </div>
      </div>

      ${isWin ? `
        <!-- 보상 breakdown -->
        <div class="card fade-in">
          <div class="card-title"><span class="han">賞</span> 획득 氣 · 6축 산출</div>
          <div style="text-align:center;margin:8px 0">
            <b class="han" style="font-size:42px;color:var(--zhusha-d);letter-spacing:.04em">+${rew.total}</b>
            <div style="font-size:11px;color:var(--gutong);margin-top:2px">현재 氣: ${getQi()}</div>
          </div>
          <div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">
            ${Object.entries(winnerPart).map(([k, p]) => {
              const dim = p.value === 0 ? 'opacity:.45' : '';
              return `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--mi);border-radius:5px;${dim}">
                  <span style="flex:0 0 90px;font-size:12px;color:var(--mo);font-weight:600">${esc_(p.label)}</span>
                  <span style="flex:1;font-size:10.5px;color:var(--gutong)">${esc_(p.meta)}</span>
                  <span style="font-size:13.5px;color:${p.value>0?'var(--feicui)':'var(--gutong)'};font-weight:700;min-width:46px;text-align:right">${p.value>0?'+':''}${p.value}</span>
                </div>
              `;
            }).join('')}
          </div>
          <div style="font-size:10px;color:var(--gutong);margin-top:8px;font-style:italic;line-height:1.5">
            v9.8 단일승자 룰 · Base 80 · 인원수 (N−2)×20 cap 40 · 난이도 score×0.5 cap 30 ·
            본초 수 ×1.5 cap 30 · 콤보 ×5 cap 30 · 선출패 1st +20 / 2nd +10
          </div>
        </div>
      ` : `
        <!-- 패자 — 본인 통계 -->
        <div class="card fade-in">
          <div class="card-title"><span class="han">記</span> 본인 처방 기록 (氣 변동 없음)</div>
          <div style="margin-top:6px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
            <div style="text-align:center;padding:8px;background:var(--mi);border-radius:5px">
              <div style="font-size:18px;color:var(--feicui);font-weight:700">${(ps[u]||{})._formulationScore || 0}</div>
              <div style="font-size:10.5px;color:var(--gutong)">난이도 점수</div>
            </div>
            <div style="text-align:center;padding:8px;background:var(--mi);border-radius:5px">
              <div style="font-size:18px;color:var(--feicui);font-weight:700">${(ps[u]||{})._totalHerbsInMySets || 0}</div>
              <div style="font-size:10.5px;color:var(--gutong)">기여 본초</div>
            </div>
            <div style="text-align:center;padding:8px;background:var(--mi);border-radius:5px">
              <div style="font-size:18px;color:var(--feicui);font-weight:700">${(ps[u]||{})._maxCombo || 0}</div>
              <div style="font-size:10.5px;color:var(--gutong)">max 콤보</div>
            </div>
          </div>
        </div>
      `}

      <!-- 참가자 처방 기록 -->
      <div class="card fade-in">
        <div class="card-title"><span class="han">榜</span> 참가자 處方 기록</div>
        <div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">
          <!-- 승자 row -->
          <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--huang-l);border-radius:5px;border:1.5px solid var(--huang-d)">
            <span style="font-size:14px;flex:0 0 24px;text-align:center">🥇</span>
            <span style="flex:1;font-size:13px;color:var(--mo);font-weight:700">
              ${esc_(winner.name||'?')}${winnerId === u ? ' <span style="font-size:10px;color:var(--zhusha-d)">(나)</span>' : ''}
            </span>
            <span style="font-size:10.5px;color:var(--gutong)" title="처방 난이도 점수">${winner._formulationScore || 0}pt</span>
            <span style="font-size:10.5px;color:var(--gutong)" title="기여 본초 수">${winner._totalHerbsInMySets || 0}本</span>
            <span style="font-size:10.5px;color:var(--gutong)" title="max 콤보">×${winner._maxCombo || 0}</span>
          </div>
          ${losers.map(L => `
            <div style="display:flex;align-items:center;gap:8px;padding:7px 8px;background:${L.uid === u ? 'rgba(156,48,48,.06)' : 'var(--mi)'};border-radius:5px;${L.uid === u ? 'border:1px solid var(--zhusha-d)' : ''}">
              <span style="font-size:12px;flex:0 0 24px;text-align:center;color:var(--gutong)">—</span>
              <span style="flex:1;font-size:12.5px;color:var(--mo)">
                ${esc_(L.name||'?')}${L.uid === u ? ' <span style="font-size:10px;color:var(--zhusha-d)">(나)</span>' : ''}
              </span>
              <span style="font-size:10.5px;color:var(--gutong)" title="처방 난이도 점수">${L._formulationScore}pt</span>
              <span style="font-size:10.5px;color:var(--gutong)" title="기여 본초 수">${L._totalHerbsInMySets}本</span>
              <span style="font-size:10.5px;color:var(--gutong)" title="max 콤보">×${L._maxCombo}</span>
              <span style="font-size:10px;color:var(--mo-l);min-width:36px;text-align:right">${L.handCount || 0}장</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 최종 보드 -->
      <div class="card fade-in">
        <div class="card-title"><span class="han">局面</span> 최종 보드 (${finalBoard.length} set)</div>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
          ${finalBoard.length ? finalBoard.map(s => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--mi);border-radius:6px;border-left:3px solid ${s.type==='base'?'var(--zhusha)':s.type==='derive'?'var(--huang-d)':'var(--feicui)'}">
              <div style="flex:0 0 auto;min-width:90px">
                <div class="han" style="font-size:13px;color:var(--zhusha-d);font-weight:600">${esc_(s.han)}</div>
                <div style="font-size:11px;color:var(--mo-l)">${esc_(s.label)}</div>
              </div>
              <div style="flex:1;font-size:11.5px;color:var(--mo)" class="han">${(s.herbs||[]).map(esc_).join(' · ')}</div>
            </div>
          `).join('') : '<div style="text-align:center;padding:14px;color:var(--gutong);font-size:12px">보드 비어 있음</div>'}
        </div>
      </div>

      <div class="card fade-in" style="display:flex;gap:6px;justify-content:center">
        <button class="btn btn-gold" id="bc-again" type="button"><span class="han">再</span>&nbsp;새 對局</button>
        <button class="btn btn-o" id="bc-home" type="button">로비로</button>
      </div>

      <div id="bc-chat-host-result"></div>
    </div>
  `;

  // 채팅 이동 (v9.6 동작 보존)
  try{
    if(window._v96CurrentCubeChatCtx){
      const host = document.getElementById('bc-chat-host-result');
      const ex = document.querySelector(`.chat-card[data-cid="${window._v96CurrentCubeChatCtx.id}"]`);
      if(host && ex){ host.appendChild(ex); }
    }
  }catch(_){}

  // 버튼 핸들러 (BC 내부 함수에 위임)
  const again = document.getElementById('bc-again');
  if(again){
    again.addEventListener('click', () => {
      if(window.BC && typeof window.BC.exitToLobby === 'function') window.BC.exitToLobby();
    });
  }
  const home = document.getElementById('bc-home');
  if(home){
    home.addEventListener('click', () => {
      if(window.BC && typeof window.BC.exitToLobby === 'function') window.BC.exitToLobby();
    });
  }

  return true;   // signal "handled" to bangje-cube.js
}

function resetSettled(rid){
  if(rid && _settled[rid]) delete _settled[rid];
}

// ──────────────────────────────────────────────
// 노출
// ──────────────────────────────────────────────
window.V98CubeVictory = {
  VERSION: VER,
  computeCommitUpdates,
  computeDrawUpdates,
  applyAiCommit,
  applyAiDraw,
  computeReward,
  renderResult,
  resetSettled,
  // 상수 노출 (디버깅 / 외부 표시용)
  CONST: { BASE_WIN, PLAYER_RATE, PLAYER_CAP, DIFF_RATE, DIFF_CAP, HERB_RATE, HERB_CAP, COMBO_RATE, COMBO_CAP, FIRST_OUT_TIER },
};

})();
