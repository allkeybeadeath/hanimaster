/* bangje-v99-sichen-clock.js — v10.0
 * ============================================================================
 * 大廳 시진(時辰) 시계 — 자축인묘 + 분단위
 *
 *   • hello-card 옆에 작은 chip 으로 inject
 *   • 형식: `子時(자) · 23:47`
 *   • 매 분 정각 (분 경계 재계산) 자동 갱신 — drift 없음
 *   • 子時는 23:00 + 0:00 모두 포함 (자정 통과 케이스)
 *   • chip 클릭 시 12지지 시진표 + 12경맥 子午流注 매핑 popup
 *
 *   子午流注 (시진별 流注 경맥):
 *     寅→肺·卯→大腸·辰→胃·巳→脾·午→心·未→小腸·申→膀胱·酉→腎·
 *     戌→心包·亥→三焦·子→膽·丑→肝
 *
 *   • V99Sichen.now()        — { han, ko, idx, h, m, elapsedMin, timeStr }
 *   • V99Sichen.format()     — '子時 23:47' 문자열
 *   • V99Sichen.openTable()  — 12지지 popup 직접 호출
 *
 *   외부 의존: 없음 (toast, openModal 은 선택적)
 * ============================================================================ */
(function(){
'use strict';

const SICHEN_HAN = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const SICHEN_KO  = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
// 子午流注 — 시진 idx 별 활성 경맥
const LIUZHU = [
  '膽',   // 子 23-01
  '肝',   // 丑 01-03
  '肺',   // 寅 03-05
  '大腸', // 卯 05-07
  '胃',   // 辰 07-09
  '脾',   // 巳 09-11
  '心',   // 午 11-13
  '小腸', // 未 13-15
  '膀胱', // 申 15-17
  '腎',   // 酉 17-19
  '心包', // 戌 19-21
  '三焦', // 亥 21-23
];
// 시진별 시간 범위 텍스트
const SICHEN_RANGE = [
  '23–01','01–03','03–05','05–07','07–09','09–11',
  '11–13','13–15','15–17','17–19','19–21','21–23',
];

function _now(){
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes();
  // 子時(23-01)는 23시와 0시 모두 포함
  let idx;
  if(h === 23 || h === 0) idx = 0;
  else idx = Math.floor((h + 1) / 2);
  // 시진 내 경과 분 (0-119)
  let elapsedMin;
  if(idx === 0){
    elapsedMin = (h === 23) ? m : (60 + m);
  } else {
    const startH = idx * 2 - 1;
    elapsedMin = (h - startH) * 60 + m;
  }
  return {
    han: SICHEN_HAN[idx],
    ko: SICHEN_KO[idx],
    meridian: LIUZHU[idx],
    range: SICHEN_RANGE[idx],
    idx, h, m,
    elapsedMin,
    timeStr: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`,
  };
}

function format(){
  const t = _now();
  return `${t.han}時 ${t.timeStr}`;
}

function _injectCSS(){
  if(document.getElementById('v99-sichen-css')) return;
  const st = document.createElement('style');
  st.id = 'v99-sichen-css';
  st.textContent = `
    .v99-sichen-chip {
      display: inline-flex; align-items: baseline; gap: 4px;
      padding: 3px 9px; border-radius: 11px;
      background: rgba(28, 20, 10, 0.05);
      border: 1px solid rgba(135, 106, 54, 0.28);
      font-family: 'Noto Serif KR', serif;
      font-size: 11px; color: var(--mo-l, #4A3520);
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      user-select: none;
      white-space: nowrap;
    }
    .v99-sichen-chip:hover {
      background: rgba(28, 20, 10, 0.09);
      border-color: rgba(135, 106, 54, 0.5);
    }
    .v99-sichen-chip .han {
      font-family: 'ZCOOL XiaoWei', 'Ma Shan Zheng', serif;
      font-size: 13.5px; color: var(--zhusha-d, #6E1818);
      font-weight: 700;
      line-height: 1;
    }
    .v99-sichen-chip .ko-paren {
      font-size: 10px; color: var(--gutong, #876A36);
    }
    .v99-sichen-chip .min {
      font-size: 10.5px; color: var(--mo, #2A1E10);
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.01em;
    }
    .v99-sichen-chip .sep { color: var(--gutong, #876A36); opacity: 0.4; }

    .v99-sichen-table {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
      margin-top: 8px;
    }
    .v99-sichen-cell {
      padding: 6px 4px; text-align: center;
      background: var(--mi, #F5EBD7); border-radius: 5px;
      border: 1px solid rgba(135, 106, 54, 0.2);
      font-family: 'Noto Serif KR', serif; font-size: 11px;
    }
    .v99-sichen-cell.active {
      background: linear-gradient(135deg, #9C3030 0%, #6E1818 100%);
      color: #FFE08A;
      border-color: #FFE08A;
      box-shadow: 0 0 8px rgba(156,48,48,0.4);
    }
    .v99-sichen-cell .han {
      font-family: 'ZCOOL XiaoWei', serif; font-size: 14px;
      font-weight: 700; display: block; line-height: 1.1;
    }
    .v99-sichen-cell.active .han { color: #FFE08A; }
    .v99-sichen-cell .rng { font-size: 9.5px; color: var(--gutong, #876A36); display: block; margin-top: 2px; }
    .v99-sichen-cell.active .rng { color: #FFE08A; opacity: 0.8; }
    .v99-sichen-cell .mer { font-size: 9.5px; color: var(--feicui-d, #1F5040); display: block; margin-top: 1px; font-weight: 600; }
    .v99-sichen-cell.active .mer { color: #FFE08A; }
  `;
  document.head.appendChild(st);
}

function _renderChip(){
  const t = _now();
  return `
    <span class="han">${t.han}時</span>
    <span class="ko-paren">(${t.ko})</span>
    <span class="sep">·</span>
    <span class="min">${t.timeStr}</span>
  `;
}

function _inject(){
  // 大廳(home) 의 hello-card 옆에 inject
  const hello = document.getElementById('hello-card');
  if(!hello) return;
  let chip = document.getElementById('v99-sichen-chip');
  if(!chip){
    chip = document.createElement('div');
    chip.id = 'v99-sichen-chip';
    chip.className = 'v99-sichen-chip';
    chip.setAttribute('title', '시진(時辰) 클릭 — 12지지 + 子午流注');
    chip.addEventListener('click', openTable);
    // hello-card 위(앞)에 작은 줄로 배치
    hello.parentNode.insertBefore(chip, hello);
  }
  chip.innerHTML = _renderChip();
}

function openTable(){
  _injectCSS();
  const t = _now();
  const cells = SICHEN_HAN.map((han, i) => {
    const isActive = i === t.idx;
    return `
      <div class="v99-sichen-cell${isActive ? ' active' : ''}">
        <span class="han">${han}</span>
        <span class="rng">${SICHEN_RANGE[i]}</span>
        <span class="mer">${LIUZHU[i]}</span>
      </div>
    `;
  }).join('');
  const html = `
    <h3 style="margin:0;font-family:'ZCOOL XiaoWei',serif;color:var(--zhusha-d);font-size:18px">
      <span class="han">時辰 · 子午流注</span>
    </h3>
    <div style="font-size:11px;color:var(--gutong);margin-top:1px">
      현재 <b class="han" style="color:var(--zhusha-d)">${t.han}時</b>
      <span style="margin-left:4px">${t.timeStr}</span>
      · 流注 <b class="han" style="color:var(--feicui-d)">${t.meridian}經</b>
    </div>
    <div class="v99-sichen-table">${cells}</div>
    <div style="margin-top:10px;font-size:10.5px;color:var(--mo-l);line-height:1.55">
      <b class="han" style="color:var(--zhusha-d)">子午流注</b> — 12시진 별로 氣血이 흘러 들어가는 경맥.
      현 시진의 활성 경맥은 該當 시간대에 가장 旺盛한다고 본다 (영추·자오류주설).
    </div>
    <div style="margin-top:6px;font-size:10px;color:var(--gutong);text-align:center">
      <span class="han">寅→肺·卯→大腸·辰→胃·巳→脾·午→心·未→小腸·申→膀胱·酉→腎·戌→心包·亥→三焦·子→膽·丑→肝</span>
    </div>
  `;
  if(window.openModal) window.openModal(html);
}

// ─── 분 경계 정밀 갱신 ────────────────────────────────────────────────
// setInterval(60000) 은 drift 발생 → 매 분마다 다음 분까지 ms 계산.
let _timer = null;
function _schedule(){
  if(_timer){ clearTimeout(_timer); _timer = null; }
  const now = Date.now();
  // 다음 분 정각까지 ms (60000 - 현재 ms within minute)
  const ms = 60000 - (now % 60000) + 50;  // +50ms 안전 마진
  _timer = setTimeout(() => {
    try{ _inject(); }catch(_){}
    _schedule();
  }, ms);
}

// 탭 visibility 변경 시 즉시 갱신
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible'){
    try{ _inject(); }catch(_){}
    _schedule();
  }
});

function _observe(){
  const v = document.getElementById('view');
  if(!v){ setTimeout(_observe, 400); return; }
  _injectCSS();
  const obs = new MutationObserver(() => { try{ _inject(); }catch(_){} });
  obs.observe(v, { childList: true, subtree: true });
  setTimeout(() => { _inject(); _schedule(); }, 300);
}

if(document.readyState !== 'loading') setTimeout(_observe, 500);
else document.addEventListener('DOMContentLoaded', () => setTimeout(_observe, 500));

window.V99Sichen = {
  now: _now,
  format,
  openTable,
  _MERIDIAN_FLOW: LIUZHU,
  _SICHEN: SICHEN_HAN,
};
})();
