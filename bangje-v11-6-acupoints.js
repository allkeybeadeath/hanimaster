/* bangje-v11-6-acupoints.js — 經穴學 (舍巖之房) v1.0 (v11.6.0)
 * ============================================================================
 *  사암도인의 방. 12 정경 + 任·督·帶脈 五輸穴 + 特定要穴 학습 게임.
 *
 *  포함 모드:
 *    1) 五輸穴 레이스 (싱글) — 15맥 무작위순, 정→형→수→경→합 순서 클릭
 *    2) 五輸穴 레이스 (멀티) — 최대 4인, 룸 생성/입장, 동시 진행 실시간 표시
 *    3) (확장) 特定要穴 모드 — 원→락→극→모→배수 순서 클릭
 *
 *  점수:
 *    • 정답 클릭: +10점, 全 5혈 정답 시 보너스 +20점
 *    • 오답 클릭: 0점, 빨강 깜빡, 카드 슬롯 reset (다시 첫 카드부터)
 *    • 한 맥 완료마다 진척 1/15 갱신
 *    • 게임 종료 후 누적 점수의 1/10 만큼 氣 적립 (최대 100氣)
 *
 *  멀티:
 *    • FB.subscribe('saam_rooms/{rid}') 로 실시간 동기화
 *    • 각자 자기 진척만 push, 상대 진척은 snapshot 수신
 *    • 룸 lifecycle: lobby → racing → finished
 *
 *  외부 API: window.V11Saam = { openHome, openSingle, openMulti }
 * ============================================================================ */
(function(){
'use strict';

function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }
function shuffle(a){ const x=a.slice(); for(let i=x.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [x[i],x[j]]=[x[j],x[i]]; } return x; }

// ─── 상수 ──────────────────────────────────────────────────────────────
const PT_CORRECT  = 10;
const PT_PERFECT  = 20;
const QI_DIVISOR  = 10;
const QI_MAX      = 100;
const MAX_PLAYERS = 4;
const POLL_MS     = 1500;

// ─── 모드 정의 ─────────────────────────────────────────────────────────
const MODES = [
  { id:'shu',     han:'五輸穴',    ko:'정형수경합',
    desc:'정·형·수·경·합 순서로 5혈 클릭', cardsKey:'shu',
    appliesToVessels:true,
    helpText:'음경 井(木) 滎(火) 輸(土) 經(金) 合(水) / 양경 井(金) 滎(水) 輸(木) 經(火) 合(土)' },
  { id:'special', han:'特定要穴',  ko:'원락극모수',
    desc:'원·락·극·모·배수 순서로 5혈 클릭', cardsKey:'special',
    appliesToVessels:false,
    helpText:'12 정경에만 적용 (奇經은 特定要穴 무) — 任·督·帶脈 제외 12개 맥' },
];
const MODE_BY_ID = {}; MODES.forEach(m => MODE_BY_ID[m.id] = m);

// ─── 캐릭터 메달 ───────────────────────────────────────────────────────
function _medal(charId, size){
  if(typeof window._charPhotoMedallion === 'function') return window._charPhotoMedallion(charId, size);
  if(typeof window._charMedallion === 'function')      return window._charMedallion(charId, size);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#E8C8A0;display:flex;align-items:center;justify-content:center;font-family:'ZCOOL XiaoWei',serif;font-size:${Math.round(size*0.4)}px;color:#3A1810">人</div>`;
}

// ─── 공통 스타일 ───────────────────────────────────────────────────────
function _styles(){
  return `<style>
    .saam-banner{background:linear-gradient(135deg,#3A6A4A,#1F4530);color:#FFE08A;padding:14px;border-radius:10px;margin-bottom:10px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 12px rgba(20,50,30,.3)}
    .saam-banner-medal{width:60px;height:60px;border-radius:50%;overflow:hidden;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.3)}
    .saam-banner-medal .cmedal,.saam-banner-medal img{width:100%;height:100%}
    .saam-banner-title{font-family:'ZCOOL XiaoWei',serif;font-size:22px;letter-spacing:.05em}
    .saam-banner-sub{font-size:11.5px;opacity:.9;margin-top:1px;letter-spacing:.04em}
    .saam-back{background:transparent;border:1px solid #FFE08A;color:#FFE08A;padding:4px 9px;border-radius:6px;font-size:11px;cursor:pointer;margin-left:auto}
    .saam-back:hover{background:rgba(255,224,138,.12)}
    .saam-card{background:var(--mi-w);border:1px solid var(--mi-d);border-radius:10px;padding:13px;margin-bottom:10px;box-shadow:var(--sh-sm)}
    .saam-card-title{font-family:'ZCOOL XiaoWei',serif;font-size:15px;color:#1F4530;margin-bottom:8px;letter-spacing:.04em}
    .saam-mode-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
    .saam-mode-btn{padding:13px 10px;border-radius:10px;border:1.5px solid #3A6A4A;background:linear-gradient(135deg,#F0F7F1,#E0EEDA);color:#1A4030;cursor:pointer;font-family:'ZCOOL XiaoWei',serif;text-align:left;transition:all .15s}
    .saam-mode-btn:hover{background:#3A6A4A;color:#FFE08A}
    .saam-mode-btn .han{font-size:16px;font-weight:600}
    .saam-mode-btn .ko{font-size:11.5px;margin-top:2px;opacity:.85}
    .saam-mode-btn .desc{font-size:10.5px;margin-top:5px;opacity:.7;line-height:1.4}
    .saam-tool-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .saam-tool-btn{padding:14px 10px;border-radius:10px;border:1.5px solid #3A6A4A;background:linear-gradient(135deg,#FFF8E0,#FFEFC0);color:#3A1810;cursor:pointer;font-family:'ZCOOL XiaoWei',serif;text-align:center;transition:all .15s;font-size:15px}
    .saam-tool-btn:hover{background:#FFE08A}
    .saam-tool-btn .ic{font-size:18px;margin-bottom:3px;display:block}
    .saam-tool-btn .lb{font-size:11px;opacity:.7;margin-top:4px}

    /* 레이스 트랙 */
    .saam-track-wrap{background:var(--mi-w);border:1px solid var(--mi-d);border-radius:10px;padding:10px;margin-bottom:10px;box-shadow:var(--sh-sm)}
    .saam-players{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
    .saam-player{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border-radius:8px;background:#F5EDD5;border:1px solid #E0D4B0;position:relative}
    .saam-player.me{border-color:#3A6A4A;background:#E5F0E0;box-shadow:0 0 0 2px rgba(58,106,74,.15)}
    .saam-player.done{background:#FFE08A;border-color:#C9A227}
    .saam-player-medal{width:36px;height:36px;border-radius:50%;overflow:hidden}
    .saam-player-medal .cmedal,.saam-player-medal img{width:100%;height:100%}
    .saam-player-name{font-size:10.5px;color:#3A1810;font-weight:600;max-width:80px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%}
    .saam-player-bar{width:100%;height:7px;background:#E0D4B0;border-radius:4px;overflow:hidden;margin-top:2px}
    .saam-player-bar .fill{height:100%;background:linear-gradient(90deg,#3A6A4A,#5A9A6A);transition:width .25s ease}
    .saam-player.done .saam-player-bar .fill{background:linear-gradient(90deg,#C9A227,#FFE08A)}
    .saam-player-score{font-size:10px;color:#3A6A4A;font-weight:600}
    .saam-player.done .saam-player-score{color:#9C3030}
    .saam-player-badge{position:absolute;top:-4px;right:-4px;background:#9C3030;color:#FFE08A;font-size:9px;padding:2px 5px;border-radius:8px;font-weight:600}

    /* 진척 */
    .saam-progress{text-align:center;margin:8px 0 12px;font-size:12px;color:var(--mo-l)}
    .saam-progress b{color:#3A6A4A;font-size:13px}

    /* 현재 맥 */
    .saam-meridian{text-align:center;margin:12px 0;padding:10px;border-radius:10px;background:linear-gradient(135deg,#1F4530,#3A6A4A);color:#FFE08A;box-shadow:0 2px 8px rgba(20,50,30,.2)}
    .saam-meridian-han{font-family:'ZCOOL XiaoWei',serif;font-size:22px;letter-spacing:.05em}
    .saam-meridian-ko{font-size:12px;opacity:.85;margin-top:2px}
    .saam-meridian-mode{font-size:11px;margin-top:4px;background:rgba(0,0,0,.18);display:inline-block;padding:2px 9px;border-radius:10px}

    /* 슬롯 (정답 진척 표시) */
    .saam-slots{display:flex;gap:5px;justify-content:center;margin:10px 0 14px}
    .saam-slot{width:38px;height:46px;border-radius:6px;border:1.5px dashed #B0A080;display:flex;align-items:center;justify-content:center;font-family:'Noto Serif SC',serif;font-size:14px;color:#7A6040;background:#F5EDD5;font-weight:600;transition:all .2s}
    .saam-slot.filled{background:linear-gradient(135deg,#3A6A4A,#5A9A6A);color:#FFE08A;border:1.5px solid #2A5030;box-shadow:0 2px 6px rgba(58,106,74,.3)}
    .saam-slot.current{border-color:#9C3030;background:#FFE0D0;color:#9C3030;animation:saam-pulse 1s ease-in-out infinite}
    @keyframes saam-pulse{0%,100%{box-shadow:0 0 0 0 rgba(156,48,48,.4)}50%{box-shadow:0 0 0 4px rgba(156,48,48,0)}}

    /* 카드 그리드 */
    .saam-cards{display:grid;grid-template-columns:repeat(5, 1fr);gap:7px;margin-bottom:14px}
    .saam-card-btn{aspect-ratio:3/4;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 3px;border-radius:8px;border:1.5px solid var(--gutong);background:linear-gradient(180deg,#FFFCF0,#F5E6D3);color:#3A1810;cursor:pointer;font-family:'Noto Serif SC',serif;transition:all .15s;position:relative;overflow:hidden;-webkit-tap-highlight-color:transparent}
    .saam-card-btn:hover{transform:translateY(-2px);box-shadow:0 4px 10px rgba(0,0,0,.15)}
    .saam-card-btn:active{transform:translateY(0)}
    .saam-card-btn .name{font-size:13px;font-weight:700;letter-spacing:.02em;line-height:1.1;text-align:center}
    .saam-card-btn .ko{font-size:9.5px;color:#7A5C40;margin-top:2px}
    .saam-card-btn.flash-green{animation:saam-green .6s ease}
    .saam-card-btn.flash-red{animation:saam-red .5s ease}
    .saam-card-btn.used{opacity:.35;background:#E8E0CC;border-color:#B0A080;cursor:default;pointer-events:none}
    @keyframes saam-green{0%{background:#3A6A4A;color:#FFE08A;transform:scale(1.08);box-shadow:0 0 18px rgba(58,160,74,.6)} 100%{background:#E0EEDA;color:#1A4030;transform:scale(1);box-shadow:none}}
    @keyframes saam-red{0%,40%{background:#9C3030;color:#FFE08A;transform:translateX(-3px);box-shadow:0 0 18px rgba(200,40,40,.55)} 20%,60%{transform:translateX(3px)} 100%{transform:translateX(0);background:linear-gradient(180deg,#FFFCF0,#F5E6D3);color:#3A1810;box-shadow:none}}

    /* 안내 */
    .saam-instr{text-align:center;font-size:12px;color:#3A6A4A;margin:8px 0;font-weight:600}
    .saam-instr .han{font-size:14px;letter-spacing:.04em}

    /* 결과 */
    .saam-result{text-align:center;padding:18px 12px;background:linear-gradient(135deg,#FFE08A,#C9A227);border-radius:12px;margin-bottom:14px;box-shadow:0 4px 14px rgba(140,100,20,.25)}
    .saam-result-han{font-family:'ZCOOL XiaoWei',serif;font-size:30px;color:#3A1810;letter-spacing:.08em}
    .saam-result-pct{font-size:14px;color:#3A1810;margin-top:4px}
    .saam-result-meta{font-size:11.5px;color:#5A3010;margin-top:6px}

    /* 룸 리스트 */
    .saam-room{display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:8px;background:#F5EDD5;border:1px solid #E0D4B0;margin-bottom:6px;cursor:pointer;transition:all .12s}
    .saam-room:hover{background:#FFF8E0;border-color:#C9A227}
    .saam-room-han{font-family:'ZCOOL XiaoWei',serif;font-size:14px;color:#3A1810;flex:1}
    .saam-room-meta{font-size:10.5px;color:#7A5C40}
    .saam-room-pill{font-size:10px;padding:2px 7px;border-radius:8px;background:#3A6A4A;color:#FFE08A;font-weight:600}
    .saam-room-pill.racing{background:#9C3030}
    .saam-room-pill.full{background:#7A5C40}

    .saam-input-row{display:flex;gap:6px;margin:8px 0}
    .saam-input-row input{flex:1;padding:8px 10px;border-radius:6px;border:1px solid var(--mi-d);background:#fff;font-family:var(--font-body);font-size:13px}
    .saam-input-row button{padding:8px 14px;border-radius:6px;background:#3A6A4A;color:#FFE08A;border:1px solid #1F4530;cursor:pointer;font-weight:600}

    .saam-empty{text-align:center;color:var(--mo-l);font-size:12px;padding:14px 8px;font-style:italic}
    .saam-row{display:flex;gap:6px;justify-content:center;margin:10px 0;flex-wrap:wrap}
  </style>`;
}

// ─── SFX (혈자리 클릭 효과음) — 큐브의 sfxHerbTap 재활용 ──────────────
function _sfxOk(){ try{ window.bgm && window.bgm.sfxHerbPlace && window.bgm.sfxHerbPlace(); }catch(_){} }
function _sfxNo(){ try{ window.bgm && window.bgm.sfxWrong  && window.bgm.sfxWrong();      }catch(_){} }
function _sfxTap(){ try{ window.bgm && window.bgm.sfxHerbTap  && window.bgm.sfxHerbTap();  }catch(_){} }

// ─── HOME ──────────────────────────────────────────────────────────────
function _backToHub(){
  if(typeof window.setTab === 'function') window.setTab('hub');
  else if(typeof window.V11ClinicHub !== 'undefined' && window.V11ClinicHub.open) window.V11ClinicHub.open();
}

function openHome(){
  const view = document.getElementById('view');
  if(!view) return;
  document.body.classList.remove('on-hub');
  document.body.classList.add('on-saam');
  // v11.6.0 patched: 헤더 컨텍스트 갱신 → 상·하단 모두 경혈학 정체성으로 전환
  try{ if(typeof window.setHeaderContext === 'function') window.setHeaderContext('saamdoin'); }catch(_){}
  view.innerHTML = _styles() + `
    <div class="saam-banner">
      <div class="saam-banner-medal">${_medal('saamdoin', 60)}</div>
      <div>
        <div class="saam-banner-title">舍巖之房 — 經穴學</div>
        <div class="saam-banner-sub">舍巖鍼法·14經脈·361穴 · 五輸穴 레이스</div>
      </div>
      <button class="saam-back" type="button" id="saam-back">← 醫書宮</button>
    </div>
    <div class="saam-card">
      <div class="saam-card-title">五輸穴 레이스</div>
      <div style="font-size:12px;color:var(--mo-l);margin-bottom:9px;line-height:1.5">
        12 정경 + 任·督·帶脈이 무작위 순서로 등장. 각 맥의 5혈을 <b style="color:#3A6A4A">정→형→수→경→합</b> 순서로 빠르게 클릭. 순서 틀리면 <b style="color:#9C3030">빨강</b>, 맞으면 <b style="color:#3A6A4A">초록</b>. 끝까지 도달한 사람이 승.
      </div>
      <div class="saam-tool-row">
        <button class="saam-tool-btn" type="button" id="saam-single"><span class="ic">獨</span>싱글 레이스<div class="lb">혼자 기록 도전</div></button>
        <button class="saam-tool-btn" type="button" id="saam-multi"><span class="ic">群</span>멀티 對決<div class="lb">최대 4인 동시</div></button>
      </div>
    </div>
    <div class="saam-card">
      <div class="saam-card-title">모드 선택</div>
      <div class="saam-mode-row">
        ${MODES.map(m => `
          <button class="saam-mode-btn" type="button" data-mode="${esc(m.id)}">
            <div class="han">${esc(m.han)}</div>
            <div class="ko">${esc(m.ko)}</div>
            <div class="desc">${esc(m.desc)}</div>
          </button>
        `).join('')}
      </div>
      <div style="font-size:10.5px;color:var(--gutong);margin-top:6px;line-height:1.5">
        <b>오수혈</b>: 음경 木火土金水 / 양경 金水木火土 — 15맥 모두 적용.<br>
        <b>특정요혈</b>: 12 정경만 (奇經은 特定要穴 無).
      </div>
    </div>
    <div class="saam-card">
      <div class="saam-card-title">규칙</div>
      <div style="font-size:11.5px;color:var(--mo-l);line-height:1.65">
        • 정답 ${PT_CORRECT}점, 한 맥 완료 보너스 +${PT_PERFECT}점.<br>
        • 오답 시 현재 맥 슬롯 reset — 처음부터 다시 클릭.<br>
        • 게임 종료 후 누적 점수의 <b>1/${QI_DIVISOR}</b> 만큼 氣 적립 (최대 ${QI_MAX}氣).<br>
        • 멀티: 최대 ${MAX_PLAYERS}인. 가장 먼저 모든 맥 완주 시 즉시 승.
      </div>
    </div>
  `;
  $('#saam-back').addEventListener('click', _backToHub);
  let pickedMode = 'shu';
  $$('.saam-mode-btn').forEach(b => {
    b.addEventListener('click', () => {
      pickedMode = b.dataset.mode;
      $$('.saam-mode-btn').forEach(x => x.style.boxShadow = '');
      b.style.boxShadow = '0 0 0 3px rgba(58,106,74,.4)';
      toast(`모드: ${MODE_BY_ID[pickedMode].han}`, 'gold');
    });
  });
  // 기본 모드 표시
  const def = $$('.saam-mode-btn').find(b => b.dataset.mode === pickedMode);
  if(def) def.style.boxShadow = '0 0 0 3px rgba(58,106,74,.4)';
  $('#saam-single').addEventListener('click', () => openSingle(pickedMode));
  $('#saam-multi').addEventListener('click', () => openMultiLobby(pickedMode));
}

// ─── 게임 세션 빌드 ────────────────────────────────────────────────────
function _buildSession(modeId){
  const mode = MODE_BY_ID[modeId] || MODE_BY_ID.shu;
  const all = (window.ACUPOINT_DATA && window.ACUPOINT_DATA.meridians) || [];
  let pool = all.slice();
  if(!mode.appliesToVessels){
    pool = pool.filter(m => m.type !== 'vessel');
  }
  // 무작위 순서
  pool = shuffle(pool);
  // 각 맥별로 카드 배열 (정답순)
  const stages = pool.map(m => {
    const cards = (m[mode.cardsKey] || []).slice();
    return {
      meridianId: m.id,
      han: m.han, ko: m.ko, type: m.type, accent: m.accent,
      cards,                              // 정답 순서
      shuffled: shuffle(cards),           // 화면 표시 순서
      correctIdx: 0,                       // 다음 클릭해야 할 카드 idx (정답 배열 기준)
      usedShuffledIdx: new Set(),         // 이미 맞춘 shuffled idx
      perfect: false,
    };
  });
  return {
    mode: mode.id,
    modeHan: mode.han,
    stages,
    stageIdx: 0,
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    startedAt: Date.now(),
    finishedAt: null,
  };
}

function _stageProgress(stage){
  return stage.correctIdx / Math.max(1, stage.cards.length);
}

function _sessionProgress(sess){
  if(!sess) return 0;
  const total = sess.stages.length;
  const done = sess.stageIdx;
  const cur = sess.stages[sess.stageIdx];
  const sub = cur ? _stageProgress(cur) : 0;
  return Math.min(1, (done + sub) / total);
}

// ─── 싱글 모드 ─────────────────────────────────────────────────────────
let _singleSess = null;

function openSingle(modeId){
  _singleSess = _buildSession(modeId);
  _renderSinglePlay();
}

function _renderSinglePlay(){
  const view = document.getElementById('view');
  if(!view || !_singleSess) return;
  const sess = _singleSess;
  if(sess.stageIdx >= sess.stages.length){
    return _renderResult(sess, false);
  }
  const stage = sess.stages[sess.stageIdx];
  const mode = MODE_BY_ID[sess.mode];

  // 슬롯 (정답 진척)
  const slots = stage.cards.map((c, i) => {
    const filled = i < stage.correctIdx;
    const current = i === stage.correctIdx;
    const cls = filled ? 'filled' : (current ? 'current' : '');
    const label = filled ? c.role_han : (current ? c.role_han : c.role_han);
    return `<div class="saam-slot ${cls}">${esc(label)}</div>`;
  }).join('');

  // 카드 (셔플 순서)
  const cards = stage.shuffled.map((c, i) => {
    const used = stage.usedShuffledIdx.has(i);
    return `<button class="saam-card-btn ${used?'used':''}" type="button" data-i="${i}" data-name="${esc(c.name_han)}">
      <span class="name">${esc(c.name_han)}</span>
      ${c.name_ko ? `<span class="ko">${esc(c.name_ko)}</span>` : ''}
    </button>`;
  }).join('');

  view.innerHTML = _styles() + `
    <div class="saam-banner">
      <div class="saam-banner-medal">${_medal('saamdoin', 60)}</div>
      <div>
        <div class="saam-banner-title">五輸穴 레이스 · 獨</div>
        <div class="saam-banner-sub">${esc(mode.han)} · ${esc(mode.ko)}</div>
      </div>
      <button class="saam-back" type="button" id="saam-back">← 나가기</button>
    </div>
    <div class="saam-track-wrap">
      <div class="saam-players">
        <div class="saam-player me">
          <div class="saam-player-medal">${_medal((window.S&&window.S.character)||'huatuo', 36)}</div>
          <div class="saam-player-name">${esc((window.S&&window.S.name)||'我')}</div>
          <div class="saam-player-bar"><div class="fill" style="width:${(_sessionProgress(sess)*100).toFixed(1)}%"></div></div>
          <div class="saam-player-score">${sess.score}점</div>
        </div>
      </div>
      <div class="saam-progress">맥 진척: <b>${sess.stageIdx + 1} / ${sess.stages.length}</b> · 누적 ${sess.score}점</div>
    </div>
    <div class="saam-meridian" style="background:linear-gradient(135deg,${esc(stage.accent||'#3A6A4A')},#1F4530)">
      <div class="saam-meridian-han">${esc(stage.han)}</div>
      <div class="saam-meridian-ko">${esc(stage.ko)}</div>
      <div class="saam-meridian-mode">${esc(mode.han)} · ${esc(mode.ko)}</div>
    </div>
    <div class="saam-instr">현재 슬롯의 <span class="han">${esc(stage.cards[stage.correctIdx].role_han)}</span> (${esc(stage.cards[stage.correctIdx].role_ko)}) 혈을 찾아 클릭</div>
    <div class="saam-slots">${slots}</div>
    <div class="saam-cards" id="saam-cards">${cards}</div>
    <div class="saam-row">
      <button class="btn btn-o btn-sm" type="button" id="saam-skip">맥 건너뛰기 (실점)</button>
    </div>
  `;
  $('#saam-back').addEventListener('click', () => {
    if(confirm('레이스를 중단하시겠습니까? 진행 점수는 저장되지 않습니다.')){
      _singleSess = null;
      openHome();
    }
  });
  $('#saam-skip').addEventListener('click', () => {
    sess.wrongCount += (stage.cards.length - stage.correctIdx);
    sess.stageIdx++;
    _renderSinglePlay();
  });
  $$('.saam-card-btn').forEach(b => {
    b.addEventListener('click', () => _onCardClick(parseInt(b.dataset.i, 10), b));
  });
}

function _onCardClick(shuffledIdx, btnEl){
  const sess = _singleSess;
  if(!sess) return;
  const stage = sess.stages[sess.stageIdx];
  if(!stage || stage.usedShuffledIdx.has(shuffledIdx)) return;
  const picked = stage.shuffled[shuffledIdx];
  const expected = stage.cards[stage.correctIdx];
  const ok = picked.name_han === expected.name_han;
  if(ok){
    // 정답
    sess.score += PT_CORRECT;
    sess.correctCount++;
    stage.usedShuffledIdx.add(shuffledIdx);
    stage.correctIdx++;
    btnEl.classList.add('flash-green');
    _sfxOk();
    setTimeout(() => {
      if(stage.correctIdx >= stage.cards.length){
        // 한 맥 완료
        stage.perfect = (sess.wrongCount === sess._wrongAtStageStart);  // not used currently
        sess.score += PT_PERFECT;
        sess.stageIdx++;
        if(sess.stageIdx >= sess.stages.length){
          sess.finishedAt = Date.now();
          _renderResult(sess, false);
        } else {
          _renderSinglePlay();
        }
      } else {
        _renderSinglePlay();
      }
    }, 350);
  } else {
    // 오답 — 슬롯 리셋
    sess.wrongCount++;
    btnEl.classList.add('flash-red');
    _sfxNo();
    // 진척 reset
    setTimeout(() => {
      stage.correctIdx = 0;
      stage.usedShuffledIdx.clear();
      stage.shuffled = shuffle(stage.cards);  // 카드 재셔플
      _renderSinglePlay();
    }, 700);
  }
}

function _renderResult(sess, isMulti){
  const view = document.getElementById('view');
  if(!view) return;
  const dur = Math.round(((sess.finishedAt || Date.now()) - sess.startedAt) / 1000);
  const m = Math.floor(dur/60), s = dur%60;
  const total = sess.correctCount + sess.wrongCount;
  const acc = total > 0 ? Math.round(sess.correctCount / total * 100) : 0;
  const qiGain = Math.min(QI_MAX, Math.floor(sess.score / QI_DIVISOR));
  // 氣 적립
  if(qiGain > 0 && window.S && typeof window.S.qi === 'number'){
    window.S.qi += qiGain;
    try{ window.saveState && window.saveState(); }catch(_){}
    try{ window.refreshHeader && window.refreshHeader(); }catch(_){}
  }
  view.innerHTML = _styles() + `
    <div class="saam-banner">
      <div class="saam-banner-medal">${_medal('saamdoin', 60)}</div>
      <div>
        <div class="saam-banner-title">滿陣 · 레이스 완주</div>
        <div class="saam-banner-sub">${esc(sess.modeHan)} · ${sess.stages.length}맥</div>
      </div>
      <button class="saam-back" type="button" id="saam-back">← 사암의 방</button>
    </div>
    <div class="saam-result">
      <div class="saam-result-han">${sess.score}점</div>
      <div class="saam-result-pct">정답 ${sess.correctCount} · 오답 ${sess.wrongCount} · 정답률 ${acc}%</div>
      <div class="saam-result-meta">소요 ${m}분 ${s}초 · <b>+${qiGain}氣</b> 적립</div>
    </div>
    <div class="saam-row">
      <button class="btn" type="button" id="saam-retry">↻ 다시 도전</button>
      <button class="btn btn-o" type="button" id="saam-home">사암의 방</button>
    </div>
  `;
  $('#saam-back').addEventListener('click', openHome);
  $('#saam-home').addEventListener('click', openHome);
  $('#saam-retry').addEventListener('click', () => openSingle(sess.mode));
  _singleSess = null;
}

// ═══════════════════════════════════════════════════════════════════════
// 멀티 (방 생성 / 입장 / 레이스)
// ═══════════════════════════════════════════════════════════════════════

let _multiState = null;   // { roomId, isHost, mode, sub, sess, snapshot }
let _multiSub = null;

function _myId(){ return (window.S && window.S.userId) || 'anon'; }
function _myName(){ return (window.S && window.S.name) || '익명'; }
function _myChar(){ return (window.S && window.S.character) || 'huatuo'; }
function _hasFB(){ return !!(window.FB && window.FB.put && window.FB.get && window.FB.subscribe); }

function openMultiLobby(modeId){
  const view = document.getElementById('view');
  if(!view) return;
  view.innerHTML = _styles() + `
    <div class="saam-banner">
      <div class="saam-banner-medal">${_medal('saamdoin', 60)}</div>
      <div>
        <div class="saam-banner-title">五輸穴 레이스 · 對決</div>
        <div class="saam-banner-sub">최대 ${MAX_PLAYERS}인 · ${esc((MODE_BY_ID[modeId]||MODES[0]).han)}</div>
      </div>
      <button class="saam-back" type="button" id="saam-back">← 사암의 방</button>
    </div>
    <div class="saam-card">
      <div class="saam-card-title">새 방 만들기</div>
      <div style="font-size:11.5px;color:var(--mo-l);margin-bottom:7px">방 이름을 입력하면 모드 <b>${esc((MODE_BY_ID[modeId]||MODES[0]).han)}</b> 로 방이 생성됩니다.</div>
      <div class="saam-input-row">
        <input type="text" id="saam-room-name" placeholder="예: 신농 8反 對決" maxlength="20">
        <button type="button" id="saam-create">개설</button>
      </div>
    </div>
    <div class="saam-card">
      <div class="saam-card-title">참가할 방</div>
      <div class="saam-input-row" style="margin-bottom:8px">
        <input type="text" id="saam-room-id" placeholder="방 ID 직접 입력" maxlength="20">
        <button type="button" id="saam-join">참가</button>
      </div>
      <div id="saam-rooms"><div class="saam-empty">로딩 중…</div></div>
      <div style="text-align:center;margin-top:6px"><button class="btn btn-o btn-sm" type="button" id="saam-refresh">↻ 새로고침</button></div>
    </div>
  `;
  $('#saam-back').addEventListener('click', openHome);
  $('#saam-create').addEventListener('click', () => {
    const name = ($('#saam-room-name').value || '').trim() || `${_myName()}의 방`;
    _createRoom(name, modeId);
  });
  $('#saam-join').addEventListener('click', () => {
    const rid = ($('#saam-room-id').value || '').trim();
    if(!rid){ toast('방 ID 입력','warn'); return; }
    _joinRoom(rid);
  });
  $('#saam-refresh').addEventListener('click', () => _loadRoomList());
  _loadRoomList();
}

async function _loadRoomList(){
  const el = $('#saam-rooms');
  if(!el) return;
  if(!_hasFB()){
    el.innerHTML = '<div class="saam-empty">서버 연결 없음 — 싱글 모드만 가능</div>';
    return;
  }
  try{
    const all = (await window.FB.get('saam_rooms')) || {};
    const list = Object.keys(all).map(k => ({ id:k, ...all[k] }))
      .filter(r => r && r.createdAt && (Date.now() - r.createdAt) < 60*60*1000)  // 1시간 이내
      .sort((a,b) => (b.createdAt||0) - (a.createdAt||0))
      .slice(0, 12);
    if(list.length === 0){
      el.innerHTML = '<div class="saam-empty">현재 방이 없습니다. 새 방을 만들어보세요.</div>';
      return;
    }
    el.innerHTML = list.map(r => {
      const pCount = Object.keys(r.players||{}).length;
      const st = r.status || 'lobby';
      const pillCls = st === 'racing' ? 'racing' : (pCount >= MAX_PLAYERS ? 'full' : '');
      const pillTxt = st === 'racing' ? '對決中' : (pCount >= MAX_PLAYERS ? '滿員' : '入場 可');
      const modeHan = (MODE_BY_ID[r.mode]||MODES[0]).han;
      return `<div class="saam-room" data-rid="${esc(r.id)}">
        <div class="saam-room-han">${esc(r.name||'무명')}</div>
        <div class="saam-room-meta">${esc(modeHan)} · ${pCount}/${MAX_PLAYERS}</div>
        <span class="saam-room-pill ${pillCls}">${pillTxt}</span>
      </div>`;
    }).join('');
    $$('.saam-room', el).forEach(r => {
      r.addEventListener('click', () => _joinRoom(r.dataset.rid));
    });
  }catch(e){
    el.innerHTML = '<div class="saam-empty">방 목록 로딩 실패</div>';
  }
}

async function _createRoom(name, modeId){
  if(!_hasFB()){ toast('서버 연결 없음','warn'); return; }
  const rid = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const sess = _buildSession(modeId);
  // 시드 공유 — 모든 참가자가 동일 sequence/shuffle 을 보도록 stage 정의 push
  const stageDefs = sess.stages.map(st => ({
    meridianId: st.meridianId,
    han: st.han, ko: st.ko, type: st.type, accent: st.accent,
    cards: st.cards,         // 정답 순서
    shuffled: st.shuffled,   // 표시 순서 (모두 동일)
  }));
  const room = {
    id: rid,
    name: name,
    mode: modeId,
    status: 'lobby',
    createdAt: Date.now(),
    hostId: _myId(),
    stages: stageDefs,
    players: {
      [_myId()]: {
        id: _myId(), name: _myName(), char: _myChar(),
        stageIdx: 0, correctIdx: 0, score: 0, correctCount:0, wrongCount:0,
        finished: false, joinedAt: Date.now(),
      }
    },
  };
  try{
    await window.FB.put(`saam_rooms/${rid}`, room);
    _enterRoom(rid, true);
  }catch(e){
    toast('방 생성 실패','warn');
  }
}

async function _joinRoom(rid){
  if(!_hasFB()){ toast('서버 연결 없음','warn'); return; }
  try{
    const room = await window.FB.get(`saam_rooms/${rid}`);
    if(!room){ toast('방을 찾을 수 없음','warn'); return; }
    if(room.status === 'racing'){ toast('이미 對決 중인 방','warn'); return; }
    const players = room.players || {};
    if(!players[_myId()] && Object.keys(players).length >= MAX_PLAYERS){
      toast('滿員 — 입장 불가','warn'); return;
    }
    if(!players[_myId()]){
      await window.FB.put(`saam_rooms/${rid}/players/${_myId()}`, {
        id: _myId(), name: _myName(), char: _myChar(),
        stageIdx: 0, correctIdx: 0, score: 0, correctCount:0, wrongCount:0,
        finished: false, joinedAt: Date.now(),
      });
    }
    _enterRoom(rid, room.hostId === _myId());
  }catch(e){
    toast('입장 실패','warn');
  }
}

function _enterRoom(rid, isHost){
  _multiState = { roomId: rid, isHost, snapshot: null, sess: null, mode: null };
  if(_multiSub){ try{ _multiSub.close(); }catch(_){} _multiSub = null; }
  _multiSub = window.FB.subscribe(`saam_rooms/${rid}`, snap => {
    if(!_multiState || _multiState.roomId !== rid) return;
    if(!snap){
      toast('방이 사라졌습니다','warn');
      _leaveRoom();
      return;
    }
    _multiState.snapshot = snap;
    if(snap.status === 'lobby'){
      _renderMultiLobby();
    } else if(snap.status === 'racing'){
      // 처음 racing 진입 시 로컬 세션 빌드
      if(!_multiState.sess){
        _multiState.sess = _buildSessionFromRoom(snap);
      }
      _renderMultiPlay();
    } else if(snap.status === 'finished'){
      _renderMultiResult();
    }
  }, { pollMs: POLL_MS });
}

function _buildSessionFromRoom(room){
  // room.stages 를 그대로 사용 — 모든 참가자가 동일 순서/카드
  const stages = (room.stages||[]).map(st => ({
    meridianId: st.meridianId,
    han: st.han, ko: st.ko, type: st.type, accent: st.accent,
    cards: st.cards.slice(),
    shuffled: st.shuffled.slice(),
    correctIdx: 0,
    usedShuffledIdx: new Set(),
  }));
  return {
    mode: room.mode,
    modeHan: (MODE_BY_ID[room.mode]||MODES[0]).han,
    stages, stageIdx: 0, score: 0,
    correctCount:0, wrongCount:0,
    startedAt: Date.now(), finishedAt: null,
  };
}

function _renderMultiLobby(){
  const view = document.getElementById('view');
  const room = _multiState && _multiState.snapshot;
  if(!view || !room) return;
  const players = Object.keys(room.players||{}).map(k => room.players[k]);
  const me = room.players && room.players[_myId()];
  const isHost = room.hostId === _myId();
  const modeMeta = MODE_BY_ID[room.mode] || MODES[0];
  view.innerHTML = _styles() + `
    <div class="saam-banner">
      <div class="saam-banner-medal">${_medal('saamdoin', 60)}</div>
      <div>
        <div class="saam-banner-title">${esc(room.name||'무명')}</div>
        <div class="saam-banner-sub">${esc(modeMeta.han)} · ${esc(modeMeta.ko)} · ${players.length}/${MAX_PLAYERS}</div>
      </div>
      <button class="saam-back" type="button" id="saam-back">← 나가기</button>
    </div>
    <div class="saam-card">
      <div class="saam-card-title">참가자 (${players.length}/${MAX_PLAYERS})</div>
      <div class="saam-players">
        ${players.map(p => `
          <div class="saam-player ${p.id === _myId() ? 'me' : ''}">
            <div class="saam-player-medal">${_medal(p.char||'huatuo', 36)}</div>
            <div class="saam-player-name">${esc(p.name)}</div>
            ${p.id === room.hostId ? `<div class="saam-player-badge">主</div>` : ''}
          </div>
        `).join('')}
      </div>
      <div style="text-align:center;font-size:11px;color:var(--mo-l);margin-top:6px">방 ID: <code style="user-select:all;background:#F5EDD5;padding:1px 6px;border-radius:3px">${esc(room.id)}</code></div>
    </div>
    <div class="saam-row">
      ${isHost ? `<button class="btn" type="button" id="saam-start" ${players.length<1?'disabled':''}>對決 開始 (${players.length}인)</button>` : `<div style="font-size:12px;color:var(--mo-l)">방장(${esc((room.players[room.hostId]||{}).name||'?')})이 開始 시 자동 진입</div>`}
    </div>
  `;
  $('#saam-back').addEventListener('click', _leaveRoom);
  if(isHost){
    const sb = $('#saam-start');
    if(sb) sb.addEventListener('click', async () => {
      try{
        await window.FB.put(`saam_rooms/${_multiState.roomId}/status`, 'racing');
        await window.FB.put(`saam_rooms/${_multiState.roomId}/startedAt`, Date.now());
      }catch(e){ toast('시작 실패','warn'); }
    });
  }
}

function _renderMultiPlay(){
  const view = document.getElementById('view');
  const room = _multiState && _multiState.snapshot;
  const sess = _multiState && _multiState.sess;
  if(!view || !room || !sess) return;

  // 최종 도달 여부 — 모든 stage 끝
  if(sess.stageIdx >= sess.stages.length && !sess.finishedAt){
    sess.finishedAt = Date.now();
    // 서버에 finished 마킹
    try{
      window.FB.put(`saam_rooms/${_multiState.roomId}/players/${_myId()}`, {
        ..._multiState.snapshot.players[_myId()],
        stageIdx: sess.stages.length, correctIdx: 0,
        score: sess.score, correctCount: sess.correctCount, wrongCount: sess.wrongCount,
        finished: true, finishedAt: sess.finishedAt,
      });
    }catch(_){}
    // 우승자 결정 (모든 stages 완료한 가장 빠른 사람)
    const players = Object.keys(room.players||{}).map(k => room.players[k]);
    const finishedPlayers = players.filter(p => p.finished);
    if(finishedPlayers.length > 0){
      // 호스트가 status 를 finished 로 마킹
      if(room.hostId === _myId()){
        try{ window.FB.put(`saam_rooms/${_multiState.roomId}/status`, 'finished'); }catch(_){}
      }
    }
  }

  const stage = sess.stages[sess.stageIdx];
  if(!stage){
    // 내 게임 끝났지만 다른 참가자 기다림
    return _renderMultiWaiting();
  }
  const mode = MODE_BY_ID[sess.mode];
  const playersList = Object.keys(room.players||{}).map(k => room.players[k]);
  const totalStages = sess.stages.length;

  // 슬롯
  const slots = stage.cards.map((c, i) => {
    const filled = i < stage.correctIdx;
    const current = i === stage.correctIdx;
    const cls = filled ? 'filled' : (current ? 'current' : '');
    return `<div class="saam-slot ${cls}">${esc(c.role_han)}</div>`;
  }).join('');
  // 카드
  const cards = stage.shuffled.map((c, i) => {
    const used = stage.usedShuffledIdx.has(i);
    return `<button class="saam-card-btn ${used?'used':''}" type="button" data-i="${i}">
      <span class="name">${esc(c.name_han)}</span>
      ${c.name_ko ? `<span class="ko">${esc(c.name_ko)}</span>` : ''}
    </button>`;
  }).join('');
  // 플레이어 트랙
  const playersHTML = playersList.map(p => {
    const isMe = p.id === _myId();
    const myProg = isMe ? _sessionProgress(sess) : ((p.stageIdx||0) + ((p.correctIdx||0) / Math.max(1, totalStages > 0 ? (sess.stages[Math.min(p.stageIdx||0, totalStages-1)]||{cards:[]}).cards.length || 5 : 5)) ) / totalStages;
    const pct = Math.min(100, Math.max(0, myProg * 100));
    const done = !!p.finished;
    return `<div class="saam-player ${isMe?'me':''} ${done?'done':''}">
      <div class="saam-player-medal">${_medal(p.char||'huatuo', 36)}</div>
      <div class="saam-player-name">${esc(p.name)}</div>
      <div class="saam-player-bar"><div class="fill" style="width:${pct.toFixed(1)}%"></div></div>
      <div class="saam-player-score">${isMe?sess.score:(p.score||0)}점${done?' · 完':''}</div>
    </div>`;
  }).join('');

  view.innerHTML = _styles() + `
    <div class="saam-banner">
      <div class="saam-banner-medal">${_medal('saamdoin', 60)}</div>
      <div>
        <div class="saam-banner-title">${esc(room.name||'對決')}</div>
        <div class="saam-banner-sub">${esc(mode.han)} · ${esc(mode.ko)} · ${playersList.length}인</div>
      </div>
      <button class="saam-back" type="button" id="saam-back">← 포기</button>
    </div>
    <div class="saam-track-wrap">
      <div class="saam-players">${playersHTML}</div>
      <div class="saam-progress">맥 진척: <b>${sess.stageIdx + 1} / ${sess.stages.length}</b> · 내 점수 ${sess.score}점</div>
    </div>
    <div class="saam-meridian" style="background:linear-gradient(135deg,${esc(stage.accent||'#3A6A4A')},#1F4530)">
      <div class="saam-meridian-han">${esc(stage.han)}</div>
      <div class="saam-meridian-ko">${esc(stage.ko)}</div>
      <div class="saam-meridian-mode">${esc(mode.han)} · ${esc(mode.ko)}</div>
    </div>
    <div class="saam-instr">현재 <span class="han">${esc(stage.cards[stage.correctIdx].role_han)}</span> (${esc(stage.cards[stage.correctIdx].role_ko)}) 혈을 클릭</div>
    <div class="saam-slots">${slots}</div>
    <div class="saam-cards" id="saam-cards">${cards}</div>
  `;
  $('#saam-back').addEventListener('click', () => {
    if(confirm('對決을 포기하시겠습니까?')) _leaveRoom();
  });
  $$('.saam-card-btn').forEach(b => {
    b.addEventListener('click', () => _onMultiCardClick(parseInt(b.dataset.i, 10), b));
  });
}

function _onMultiCardClick(shuffledIdx, btnEl){
  const sess = _multiState && _multiState.sess;
  if(!sess) return;
  const stage = sess.stages[sess.stageIdx];
  if(!stage || stage.usedShuffledIdx.has(shuffledIdx)) return;
  const picked = stage.shuffled[shuffledIdx];
  const expected = stage.cards[stage.correctIdx];
  const ok = picked.name_han === expected.name_han;
  if(ok){
    sess.score += PT_CORRECT;
    sess.correctCount++;
    stage.usedShuffledIdx.add(shuffledIdx);
    stage.correctIdx++;
    btnEl.classList.add('flash-green');
    _sfxOk();
    _pushMultiProgress();
    setTimeout(() => {
      if(stage.correctIdx >= stage.cards.length){
        sess.score += PT_PERFECT;
        sess.stageIdx++;
        _pushMultiProgress();
        _renderMultiPlay();
      } else {
        _renderMultiPlay();
      }
    }, 350);
  } else {
    sess.wrongCount++;
    btnEl.classList.add('flash-red');
    _sfxNo();
    _pushMultiProgress();
    setTimeout(() => {
      stage.correctIdx = 0;
      stage.usedShuffledIdx.clear();
      stage.shuffled = shuffle(stage.cards);
      _renderMultiPlay();
    }, 700);
  }
}

function _pushMultiProgress(){
  const st = _multiState;
  const sess = st && st.sess;
  if(!st || !sess || !_hasFB()) return;
  const stage = sess.stages[sess.stageIdx];
  const correctIdx = stage ? stage.correctIdx : 0;
  try{
    window.FB.put(`saam_rooms/${st.roomId}/players/${_myId()}`, {
      id: _myId(), name: _myName(), char: _myChar(),
      stageIdx: sess.stageIdx, correctIdx: correctIdx,
      score: sess.score, correctCount: sess.correctCount, wrongCount: sess.wrongCount,
      finished: sess.stageIdx >= sess.stages.length,
      finishedAt: sess.finishedAt || null,
      joinedAt: (st.snapshot && st.snapshot.players && st.snapshot.players[_myId()] && st.snapshot.players[_myId()].joinedAt) || Date.now(),
    });
  }catch(_){}
}

function _renderMultiWaiting(){
  const view = document.getElementById('view');
  const room = _multiState && _multiState.snapshot;
  const sess = _multiState && _multiState.sess;
  if(!view || !room || !sess) return;
  const playersList = Object.keys(room.players||{}).map(k => room.players[k]);
  const totalStages = sess.stages.length;
  const playersHTML = playersList.map(p => {
    const isMe = p.id === _myId();
    const done = !!p.finished;
    const stageCardCount = totalStages > 0 ? (sess.stages[Math.min(p.stageIdx||0, totalStages-1)]||{cards:[]}).cards.length || 5 : 5;
    const myProg = (((p.stageIdx||0) + ((p.correctIdx||0) / stageCardCount)) / totalStages);
    const pct = Math.min(100, Math.max(0, myProg * 100));
    return `<div class="saam-player ${isMe?'me':''} ${done?'done':''}">
      <div class="saam-player-medal">${_medal(p.char||'huatuo', 36)}</div>
      <div class="saam-player-name">${esc(p.name)}</div>
      <div class="saam-player-bar"><div class="fill" style="width:${pct.toFixed(1)}%"></div></div>
      <div class="saam-player-score">${p.score||0}점${done?' · 完':''}</div>
    </div>`;
  }).join('');
  view.innerHTML = _styles() + `
    <div class="saam-banner">
      <div class="saam-banner-medal">${_medal('saamdoin', 60)}</div>
      <div>
        <div class="saam-banner-title">완주!</div>
        <div class="saam-banner-sub">다른 참가자 완주 대기 중…</div>
      </div>
      <button class="saam-back" type="button" id="saam-back">← 나가기</button>
    </div>
    <div class="saam-track-wrap">
      <div class="saam-players">${playersHTML}</div>
      <div class="saam-progress">내 점수 <b>${sess.score}점</b> · 정답 ${sess.correctCount} · 오답 ${sess.wrongCount}</div>
    </div>
    <div style="text-align:center;color:var(--mo-l);font-size:12px;padding:14px 0">대기 중… 모두 완주 시 결과 화면이 자동 표시됩니다.</div>
  `;
  $('#saam-back').addEventListener('click', _leaveRoom);
}

function _renderMultiResult(){
  const view = document.getElementById('view');
  const room = _multiState && _multiState.snapshot;
  const sess = _multiState && _multiState.sess;
  if(!view || !room) return;
  const players = Object.keys(room.players||{}).map(k => room.players[k]);
  // 정렬: finished 먼저 (finishedAt 빠른 순) → score 높은 순
  players.sort((a,b) => {
    if(a.finished && !b.finished) return -1;
    if(!a.finished && b.finished) return 1;
    if(a.finished && b.finished) return (a.finishedAt||0) - (b.finishedAt||0);
    return (b.score||0) - (a.score||0);
  });
  const winner = players[0];
  const me = players.find(p => p.id === _myId());
  const myRank = players.findIndex(p => p.id === _myId()) + 1;
  // 氣 적립 (1등 추가 보너스)
  if(me && sess && !sess._qiAwarded){
    sess._qiAwarded = true;
    const baseQi = Math.min(QI_MAX, Math.floor((me.score||0) / QI_DIVISOR));
    const bonusQi = myRank === 1 ? 30 : (myRank === 2 ? 15 : 0);
    const totalQi = baseQi + bonusQi;
    if(totalQi > 0 && window.S && typeof window.S.qi === 'number'){
      window.S.qi += totalQi;
      try{ window.saveState && window.saveState(); }catch(_){}
      try{ window.refreshHeader && window.refreshHeader(); }catch(_){}
    }
    sess._qiTotal = totalQi;
  }
  const qiTotal = sess && sess._qiTotal || 0;
  view.innerHTML = _styles() + `
    <div class="saam-banner">
      <div class="saam-banner-medal">${_medal('saamdoin', 60)}</div>
      <div>
        <div class="saam-banner-title">對決 종료</div>
        <div class="saam-banner-sub">${esc(room.name||'對決')} · 우승: ${esc(winner?winner.name:'?')}</div>
      </div>
      <button class="saam-back" type="button" id="saam-back">← 사암의 방</button>
    </div>
    <div class="saam-result">
      <div class="saam-result-han">第 ${myRank} 位</div>
      <div class="saam-result-pct">내 점수 ${me?(me.score||0):0}점 · 정답 ${me?(me.correctCount||0):0} · 오답 ${me?(me.wrongCount||0):0}</div>
      <div class="saam-result-meta">+${qiTotal}氣 적립 ${myRank===1?'(우승 보너스 +30氣)':myRank===2?'(2위 보너스 +15氣)':''}</div>
    </div>
    <div class="saam-card">
      <div class="saam-card-title">최종 순위</div>
      ${players.map((p, i) => `
        <div class="saam-room ${p.id===_myId()?'':''}" style="cursor:default;${p.id===_myId()?'border-color:#3A6A4A;background:#E5F0E0':''}">
          <div style="width:24px;height:24px;border-radius:50%;background:${i===0?'#FFE08A':i===1?'#D0D0D0':i===2?'#D2A070':'#F5EDD5'};color:#3A1810;display:flex;align-items:center;justify-content:center;font-family:'ZCOOL XiaoWei',serif;font-weight:700">${i+1}</div>
          <div class="saam-player-medal" style="width:30px;height:30px">${_medal(p.char||'huatuo', 30)}</div>
          <div class="saam-room-han">${esc(p.name)}</div>
          <div class="saam-room-meta">${p.score||0}점 · 정답 ${p.correctCount||0}</div>
          ${p.finished ? `<span class="saam-room-pill">完走</span>` : `<span class="saam-room-pill full">未完</span>`}
        </div>
      `).join('')}
    </div>
    <div class="saam-row">
      <button class="btn" type="button" id="saam-rematch">다시 對決</button>
      <button class="btn btn-o" type="button" id="saam-home">사암의 방</button>
    </div>
  `;
  $('#saam-back').addEventListener('click', _leaveRoom);
  $('#saam-home').addEventListener('click', _leaveRoom);
  $('#saam-rematch').addEventListener('click', () => {
    const m = room.mode;
    _leaveRoom();
    setTimeout(() => openMultiLobby(m), 100);
  });
}

async function _leaveRoom(){
  const st = _multiState;
  if(_multiSub){ try{ _multiSub.close(); }catch(_){} _multiSub = null; }
  if(st && st.roomId && _hasFB()){
    try{
      // 내 player 제거
      await window.FB.put(`saam_rooms/${st.roomId}/players/${_myId()}`, null);
      // 방장 떠남 + 다른 참가자 없음 → 방 삭제
      const room = await window.FB.get(`saam_rooms/${st.roomId}`);
      if(room){
        const remaining = Object.keys(room.players||{}).filter(k => !!room.players[k]);
        if(remaining.length === 0){
          await window.FB.put(`saam_rooms/${st.roomId}`, null);
        } else if(room.hostId === _myId() && remaining.length > 0){
          // 방장 이양
          await window.FB.put(`saam_rooms/${st.roomId}/hostId`, remaining[0]);
        }
      }
    }catch(_){}
  }
  _multiState = null;
  openHome();
}

// ─── 외부 노출 ─────────────────────────────────────────────────────────
window.V11Saam = {
  openHome,
  openSingle,
  openMulti: openMultiLobby,
  MODES,
};

// v11.6.1 FIX: 라우트 재등록 (구버전 jingxue-race.js 의 등록을 덮어씀) — 더 강력한 잠금
//   — 구버전은 multi 가 placeholder. 신버전 V11Saam 이 정식 구현체.
//   — 즉시 + 100ms + 500ms + 1500ms 4단계로 재등록하여 어떤 경합도 이김.
//   — V11Saam.openHome 이 함수임을 ROUTES.saamdoin === openHome 으로 확정 보장.
if(typeof window !== 'undefined'){
  const _lock = () => {
    if(!window.ROUTES) return false;
    window.ROUTES.saamdoin = openHome;
    window.ROUTES.jingxue  = openHome;  // 백워드 호환 (구 라우트 이름)
    return true;
  };
  const _tryLock = (delay) => setTimeout(() => {
    if(!_lock()){ setTimeout(_tryLock.bind(null, 100), 50); }
  }, delay);
  // 즉시 + 100ms + 500ms + 1500ms 4단계 잠금 시도
  _tryLock(0);
  _tryLock(100);
  _tryLock(500);
  _tryLock(1500);
}

})();
