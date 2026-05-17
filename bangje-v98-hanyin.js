/* bangje-v98-hanyin.js — v9.8
 * ============================================================================
 * 한자→한글(한자음) 자동 노출
 *
 *   `.han` 클래스 element 위에 hover (데스크) 또는 long-press (모바일)
 *   하면 작은 fly-over tooltip에 한국 한자음 표시.
 *
 *   매핑 소스:
 *     1) HERBS.han → HERBS.ko (e.g. 人蔘 → 인삼)
 *     2) FORMULAS.han → FORMULAS.ko (e.g. 四君子湯 → 사군자탕)
 *     3) 부분 매칭 (예: '當歸補血湯' 안의 '當歸' → '당귀')
 *     4) hardcoded 보조 사전 (BANGJE_HANYIN) — 자주 쓰는 한자
 *
 *   • S.hanyinHover : boolean — 사용자 토글 (기본 true)
 *   • V98Hanyin.toggle() / .enable() / .disable() / .lookup(han)
 *
 *   퍼포먼스: 단일 document.body listener (이벤트 위임).
 * ============================================================================ */
(function(){
'use strict';

// 한자 1자 보조 사전 — HERBS/FORMULAS 에 단독으로 등재되지 않는 한자
const HANYIN_FALLBACK = {
  '湯':'탕', '丸':'환', '散':'산', '飮':'음', '飲':'음', '膏':'고',
  '君':'군', '臣':'신', '佐':'좌', '使':'사',
  '寒':'한', '熱':'열', '溫':'온', '凉':'량', '涼':'량',
  '虛':'허', '實':'실', '補':'보', '瀉':'사',
  '氣':'기', '血':'혈', '陰':'음', '陽':'양',
  '心':'심', '肝':'간', '脾':'비', '肺':'폐', '腎':'신',
  '甘':'감', '酸':'산', '苦':'고', '辛':'신', '鹹':'함', '淡':'담',
  '經':'경', '絡':'락', '臟':'장', '腑':'부',
  '草':'초', '本':'본', '末':'말', '主':'주', '客':'객',
  '上':'상', '下':'하', '中':'중', '內':'내', '外':'외',
  '太':'태', '少':'소', '陽明':'양명', '厥':'궐',
  '邪':'사', '正':'정', '風':'풍', '濕':'습', '燥':'조',
  '攻':'공', '解':'해', '表':'표', '裏':'리',
  '證':'증', '症':'증', '病':'병', '治':'치', '方':'방', '劑':'제',
};

let _enabled = true;
let _tip = null;
let _hideTimer = null;
let _herbMap = null, _formulaMap = null;

function _buildMaps(){
  if(_herbMap) return;
  _herbMap = {};
  _formulaMap = {};
  (window.HERBS || []).forEach(h => {
    if(h.han && h.ko) _herbMap[h.han] = h.ko;
  });
  (window.FORMULAS || []).concat(window.FORMULAS_EXTRA || []).forEach(f => {
    if(f.han && f.ko) _formulaMap[f.han] = f.ko;
  });
}

function lookup(text){
  if(!text) return '';
  _buildMaps();
  const t = String(text).trim();
  // 1) 정확 매치 (처방 → 본초 순)
  if(_formulaMap[t]) return _formulaMap[t];
  if(_herbMap[t]) return _herbMap[t];
  // 2) 부분 매치 — 본초 한자가 안에 포함된 경우 (예: '當歸補血湯' 에서 '當歸')
  let parts = [];
  let i = 0;
  while(i < t.length){
    let matched = false;
    for(let L = Math.min(5, t.length - i); L >= 1; L--){
      const sub = t.substr(i, L);
      const v = _herbMap[sub] || _formulaMap[sub] || HANYIN_FALLBACK[sub];
      if(v){
        parts.push(v);
        i += L;
        matched = true;
        break;
      }
    }
    if(!matched){
      // 한자 1자에 대해 HANYIN_FALLBACK 미정의면 그대로 추가
      const c = t[i];
      parts.push(/[\u4e00-\u9fff]/.test(c) ? '?' : c);
      i += 1;
    }
  }
  const joined = parts.join('');
  // ?만 가득하면 ''
  if(joined.replace(/[^?]/g, '').length === joined.length) return '';
  return joined;
}

function _ensureTip(){
  if(_tip) return _tip;
  _tip = document.createElement('div');
  _tip.id = 'v98-hanyin-tip';
  _tip.style.cssText = `
    position:fixed; z-index:9500; pointer-events:none;
    background:#1C140A; color:#FFE08A;
    padding:4px 10px; border-radius:5px;
    font-family:'Noto Serif KR',serif; font-size:12px;
    border:1px solid #876A36; box-shadow:0 4px 12px rgba(0,0,0,.5);
    opacity:0; transition:opacity .15s ease;
    max-width:220px;
  `;
  document.body.appendChild(_tip);
  return _tip;
}

function _showTip(text, x, y){
  const tip = _ensureTip();
  tip.textContent = text;
  // 위치: target 위쪽 우선
  const rect = { width: 200, height: 24 };
  const px = Math.max(6, Math.min(window.innerWidth - rect.width - 6, x - rect.width/2));
  const py = Math.max(6, y - rect.height - 8);
  tip.style.left = px + 'px';
  tip.style.top = py + 'px';
  tip.style.opacity = '1';
  clearTimeout(_hideTimer);
  _hideTimer = setTimeout(_hideTip, 2500);
}

function _hideTip(){
  if(_tip) _tip.style.opacity = '0';
}

// ─── 이벤트 위임 ───────────────────────────────────────────────────────
function _onMouseOver(e){
  if(!_enabled) return;
  const t = e.target;
  if(!t || !t.classList || !t.classList.contains('han')) return;
  const txt = (t.textContent || '').trim();
  if(!txt || txt.length > 12) return;
  // 모든 문자가 한자/구분자가 아닌 경우 skip
  if(!/[\u4e00-\u9fff]/.test(txt)) return;
  const yin = lookup(txt);
  if(!yin || yin === txt) return;
  const r = t.getBoundingClientRect();
  _showTip(yin, r.left + r.width/2, r.top);
}
function _onMouseOut(e){ _hideTip(); }

// 모바일 long-press (550ms)
let _pressTimer = null, _pressEl = null;
function _onTouchStart(e){
  if(!_enabled) return;
  const t = e.target;
  if(!t || !t.classList || !t.classList.contains('han')) return;
  _pressEl = t;
  _pressTimer = setTimeout(() => {
    const txt = (t.textContent || '').trim();
    if(!txt || txt.length > 12) return;
    if(!/[\u4e00-\u9fff]/.test(txt)) return;
    const yin = lookup(txt);
    if(!yin || yin === txt) return;
    const r = t.getBoundingClientRect();
    _showTip(yin, r.left + r.width/2, r.top);
  }, 550);
}
function _onTouchEnd(){ clearTimeout(_pressTimer); _pressEl = null; }

function _attach(){
  document.addEventListener('mouseover', _onMouseOver, true);
  document.addEventListener('mouseout', _onMouseOut, true);
  document.addEventListener('touchstart', _onTouchStart, true);
  document.addEventListener('touchend', _onTouchEnd, true);
  document.addEventListener('touchcancel', _onTouchEnd, true);
  document.addEventListener('scroll', _hideTip, true);
}

// ─── 사용자 토글 ───────────────────────────────────────────────────────
function _loadFromState(){
  const s = window.S;
  if(s){
    if(typeof s.hanyinHover === 'boolean') _enabled = s.hanyinHover;
    else { s.hanyinHover = true; _enabled = true; }
  }
}
function _saveToState(){
  try{
    if(window.S){ window.S.hanyinHover = _enabled; window.saveState && window.saveState(); }
  }catch(_){}
}

function enable(){ _enabled = true; _saveToState(); try{window.toast && window.toast('한자음 hover ON','gold');}catch(_){}}
function disable(){ _enabled = false; _saveToState(); _hideTip(); try{window.toast && window.toast('한자음 hover OFF');}catch(_){}}
function toggle(){ _enabled ? disable() : enable(); }
function isEnabled(){ return _enabled; }

if(document.readyState !== 'loading'){
  setTimeout(() => { _loadFromState(); _attach(); }, 300);
} else {
  document.addEventListener('DOMContentLoaded', () => { _loadFromState(); _attach(); });
}

window.V98Hanyin = { enable, disable, toggle, isEnabled, lookup };
})();
