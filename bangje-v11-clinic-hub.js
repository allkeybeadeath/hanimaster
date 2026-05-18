/* bangje-v11-clinic-hub.js — v11.0
 * ============================================================================
 * 醫書宮 (의서궁) 입구 — 8과목 hub
 *
 *   기존 방제학 PWA 를 다과목 학습 platform 으로 확장. 각 과목은 독립된 "방"
 *   이며, 표지 인물(마스코트)·시험 D-N·status 를 가진다. 공유 인프라(氣·등급·
 *   캐릭터·메달리온·인장 등) 는 모든 방에서 동일하게 작동.
 *
 *   • SUBJECTS              — 8 과목 메타데이터
 *   • renderClinicHub()     — 의서궁 입구 (ROUTES.hub)
 *   • renderDongmuHome()    — 진단학 skeleton (ROUTES.dongmu)
 *   • _openPlaceholder()    — placeholder 방 모달 (준비 중 안내)
 *   • _injectGungChip()     — 헤더에 宮 chip 자동 inject (MutationObserver)
 *   • 부트스트랩: ROUTES 등록, 첫 진입 시 init 호출
 *
 *   load 순서: 다른 모든 v9x/v10x 모듈 로드 후 (app.js · v98-bootstrap 의존).
 * ============================================================================ */

(function(){
'use strict';

// ─── 0. SUBJECTS 메타 ──────────────────────────────────────────────────
// status:
//   'active'      — 완전 기능 (방제학 v10.0.8 기존 UI 그대로)
//   'skeleton'    — 자체 home renderer 있음 (UI shell, 데이터는 부분/없음)
//   'placeholder' — "준비 중" 모달만
const SUBJECTS = [
  {
    id: 'shennong',
    room_han: '神農之房', room_ko: '신농의 방',
    subject_han: '方劑學', subject_ko: '방제학',
    mascot_id: 'shennong',
    status: 'active',
    route: 'home',                                          // 기존 renderHome
    examDate: '2026-05-20T00:00:00+09:00',
    examTitle: '2차 수시',
    desc: '處方·本草·君臣佐使·派生·加減',
    accent: '#C9A227',  // 帝王黃
  },
  {
    id: 'dongmu',
    room_han: '東武之房', room_ko: '동무의 방',
    subject_han: '診斷學', subject_ko: '진단학',
    mascot_id: 'leejema',
    status: 'skeleton',
    route: 'dongmu',
    examDate: null, examTitle: null,
    desc: '四象·辨證·望聞問切',
    accent: '#9C3030',  // 朝鮮赤
  },
  {
    id: 'zhongjing',
    room_han: '仲景之房', room_ko: '중경의 방',
    subject_han: '傷寒論', subject_ko: '상한론',
    mascot_id: 'zhongjing',
    status: 'placeholder',
    examDate: null,
    desc: '六經辨證·桂枝·麻黃·柴胡 系',
    accent: '#7A3D27',  // 古銅
  },
  {
    id: 'qibo',
    room_han: '岐伯之房', room_ko: '기백의 방',
    subject_han: '韓方病理學', subject_ko: '한방병리학',
    mascot_id: 'qibo',
    status: 'placeholder',
    examDate: null,
    desc: '陰陽五行·病機·邪正',
    accent: '#C9A227',
  },
  {
    id: 'huangdi',
    room_han: '黃帝之房', room_ko: '황제의 방',
    subject_han: '豫防醫學', subject_ko: '예방의학',
    mascot_id: 'huangdi',
    status: 'placeholder',
    examDate: null,
    desc: '上工治未病·養生·攝生',
    accent: '#C9A227',
  },
  {
    id: 'huatuo',
    room_han: '華佗之房', room_ko: '화타의 방',
    subject_han: '洋方病理學', subject_ko: '양방병리학',
    mascot_id: 'huatuo',
    status: 'placeholder',
    examDate: null,
    desc: '細胞·組織·病變 機轉',
    accent: '#B22222',  // 朱砂
  },
  {
    id: 'lindaoren',
    room_han: '道人之房', room_ko: '도인의 방',
    subject_han: '影像診斷學', subject_ko: '영상진단학',
    mascot_id: 'lindaoren',
    status: 'placeholder',
    examDate: null,
    desc: '骨格·X線·CT·MRI 讀影',
    accent: '#6A4C8C',  // 紫氣
  },
  {
    id: 'saamdoin',
    room_han: '舍巖之房', room_ko: '사암의 방',
    subject_han: '經穴學', subject_ko: '경혈학',
    mascot_id: 'saamdoin',
    status: 'placeholder',
    examDate: null,
    desc: '十二經·任督·361穴',
    accent: '#2A7060',  // 翡翠
  },
];

const SUBJECT_BY_ID = {};
SUBJECTS.forEach(s => { SUBJECT_BY_ID[s.id] = s; });

// ─── 1. 유틸 ───────────────────────────────────────────────────────────
function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }
function openModal(html){ try{ window.openModal && window.openModal(html); }catch(_){} }
function closeModal(){ try{ window.closeModal && window.closeModal(); }catch(_){} }

// 메달리온 — app.js 의 _charPhotoMedallion 사용 (없으면 fallback)
function _medal(charId, size){
  if(typeof window._charPhotoMedallion === 'function'){
    return window._charPhotoMedallion(charId, size);
  }
  if(typeof window._charMedallion === 'function'){
    return window._charMedallion(charId, size);
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#E8C8A0;display:flex;align-items:center;justify-content:center;font-family:'ZCOOL XiaoWei',serif;font-size:${Math.round(size*0.4)}px;color:#3A1810">人</div>`;
}

// 시험 D-N 계산
function _daysUntil(iso){
  if(!iso) return null;
  const d = (new Date(iso)).getTime();
  if(!isFinite(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}

// ─── 2. 醫書宮 입구 — renderClinicHub() ───────────────────────────────
function renderClinicHub(){
  const view = document.getElementById('view');
  if(!view) return;

  const S = window.S || {};
  const rk = (typeof window.getRank === 'function') ? window.getRank(S.qi||0) : {seal:'?', han:'', ko:'', color:'#7A3D27'};

  // 8 cards HTML
  const cards = SUBJECTS.map(s => {
    const dleft = _daysUntil(s.examDate);
    const ddayHtml = dleft !== null
      ? (dleft > 0
          ? `<span class="hub-dday" style="background:${s.accent}">D-${dleft}</span>`
          : (dleft === 0
              ? `<span class="hub-dday" style="background:#9C3030">D-Day</span>`
              : `<span class="hub-dday" style="background:#7A3D27">D+${-dleft}</span>`))
      : '';
    const statusBadge = s.status === 'active'   ? `<span class="hub-status hub-active">運營</span>`
                      : s.status === 'skeleton' ? `<span class="hub-status hub-skel">準備</span>`
                      :                           `<span class="hub-status hub-plc">未開</span>`;
    const dim = s.status === 'placeholder' ? ' hub-card-dim' : '';
    return `
      <button class="hub-card${dim}" type="button" data-subject="${esc(s.id)}" style="--accent:${s.accent}">
        <div class="hub-medal">${_medal(s.mascot_id, 72)}</div>
        <div class="hub-body">
          <div class="hub-room-han">${esc(s.room_han)}</div>
          <div class="hub-room-ko">${esc(s.room_ko)}</div>
          <div class="hub-subject"><span class="han">${esc(s.subject_han)}</span> · ${esc(s.subject_ko)}</div>
          <div class="hub-desc">${esc(s.desc)}</div>
          <div class="hub-meta">${statusBadge}${ddayHtml}</div>
        </div>
      </button>
    `;
  }).join('');

  view.innerHTML = `
    <style>
      .hub-title { font-family:'ZCOOL XiaoWei','Noto Serif KR',serif; font-size:32px; letter-spacing:.08em; color:var(--zhusha-d); text-align:center; margin:10px 0 4px; }
      .hub-sub { text-align:center; font-size:12.5px; color:var(--gutong); margin-bottom:14px; letter-spacing:.04em; }
      .hub-greet { display:flex; align-items:center; gap:10px; background:linear-gradient(135deg,#FFF8E0,#F0DCB8); border:1px solid #C9A22744; border-radius:10px; padding:10px 12px; margin-bottom:14px; }
      .hub-greet .gqi { margin-left:auto; font-family:var(--font-display); font-size:14px; color:var(--zhusha-d); }
      .hub-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:14px; }
      @media (min-width:560px){ .hub-grid{ grid-template-columns:repeat(3,1fr); } }
      .hub-card {
        position:relative; background:#FAF1E0; border:1px solid var(--accent); border-left:4px solid var(--accent);
        border-radius:10px; padding:12px 10px 10px; display:flex; flex-direction:column; align-items:center;
        gap:6px; cursor:pointer; transition:transform .15s ease, box-shadow .15s ease;
        font-family:inherit; text-align:center; color:var(--mo);
      }
      .hub-card:hover { transform:translateY(-2px); box-shadow:0 6px 14px rgba(60,30,10,.18); }
      .hub-card:active { transform:translateY(0); }
      .hub-card-dim { opacity:.62; }
      .hub-card-dim:hover { opacity:.85; transform:none; box-shadow:none; }
      .hub-medal { width:72px; height:72px; border-radius:50%; overflow:hidden; flex-shrink:0; box-shadow:0 2px 6px rgba(0,0,0,.15); }
      .hub-medal img, .hub-medal .cmedal { width:100%; height:100%; }
      .hub-body { width:100%; }
      .hub-room-han { font-family:'ZCOOL XiaoWei','Noto Serif SC',serif; font-size:18px; color:var(--accent); letter-spacing:.05em; }
      .hub-room-ko { font-size:12.5px; color:var(--mo); font-weight:600; margin-top:1px; }
      .hub-subject { font-size:10.5px; color:var(--gutong); margin-top:4px; line-height:1.4; }
      .hub-desc { font-size:10px; color:var(--mo-l); margin-top:2px; line-height:1.45; }
      .hub-meta { display:flex; gap:4px; justify-content:center; margin-top:6px; flex-wrap:wrap; }
      .hub-status { display:inline-block; font-size:9.5px; padding:1px 6px; border-radius:7px; color:#fff; font-weight:700; letter-spacing:.06em; }
      .hub-active { background:#2A7060; }
      .hub-skel { background:#C9A227; color:#2A1810; }
      .hub-plc { background:#7A3D27; }
      .hub-dday { display:inline-block; font-size:9.5px; padding:1px 6px; border-radius:7px; color:#fff; font-weight:700; letter-spacing:.04em; }
      .hub-foot { font-size:10.5px; color:var(--gutong); text-align:center; margin-top:8px; line-height:1.6; }
    </style>

    <div class="hub-title">醫書宮</div>
    <div class="hub-sub">의서궁 · 八房 學習</div>

    <div class="hub-greet">
      ${_medal(S.character || 'shennong', 44)}
      <div style="display:flex;flex-direction:column;line-height:1.2">
        <div style="font-size:13px;font-weight:700">${esc(S.name || '無名')} 입실</div>
        <div style="font-size:10.5px;color:var(--gutong)">방을 골라 學業에 든다</div>
      </div>
      <div class="gqi">${(S.qi||0).toLocaleString()} 氣</div>
    </div>

    <div class="hub-grid">${cards}</div>

    <div class="hub-foot">
      8 房 中 <b style="color:var(--feicui)">1</b> 운영 · <b style="color:var(--huang)">1</b> 준비 · <b style="color:var(--gutong)">6</b> 미개<br>
      운영 외 房은 자료 주입 대기 — 클릭 시 상세 안내
    </div>
  `;

  // 클릭 핸들러
  $$('.hub-card').forEach(b => {
    b.addEventListener('click', () => {
      const sid = b.dataset.subject;
      const s = SUBJECT_BY_ID[sid];
      if(!s) return;
      if(s.status === 'active'){
        // 神農之房 → 기존 방제학 home
        if(typeof window.setTab === 'function') window.setTab(s.route || 'home');
      } else if(s.status === 'skeleton'){
        // 東武之房 → 진단학 skeleton
        if(typeof window.setTab === 'function') window.setTab(s.route || 'dongmu');
      } else {
        _openPlaceholder(s);
      }
    });
  });
}
window.renderClinicHub = renderClinicHub;

// ─── 3. placeholder 모달 ──────────────────────────────────────────────
function _openPlaceholder(s){
  openModal(`
    <div style="text-align:center;padding:8px 4px;max-width:380px">
      <div style="display:flex;justify-content:center;margin-bottom:8px">
        ${_medal(s.mascot_id, 80)}
      </div>
      <h3 class="seal" style="margin:0 0 4px;color:${s.accent};font-size:22px">${esc(s.room_han)}</h3>
      <div style="font-size:13.5px;color:var(--mo);margin-bottom:8px">${esc(s.room_ko)} — <span class="han">${esc(s.subject_han)}</span> ${esc(s.subject_ko)}</div>
      <div style="font-size:12px;color:var(--mo-l);line-height:1.7;margin:10px 0;padding:10px;background:#FAF1E0;border-radius:8px;border-left:3px solid ${s.accent}">
        <div style="font-weight:700;color:${s.accent};margin-bottom:4px">未開房 · 準備 中</div>
        ${esc(s.desc)}<br>
        本 房 은 데이터 주입 대기 중. 강의 자료 (PDF · 족보 등) 가 준비되면 본격 구축.
      </div>
      <div style="font-size:11px;color:var(--gutong);margin-bottom:10px">
        그동안 다른 房 (방제학 · 진단학) 으로 進學 권장
      </div>
      <button class="btn" type="button" id="plc-close" style="width:100%">알겠습니다</button>
    </div>
  `);
  const c = document.getElementById('plc-close');
  if(c) c.addEventListener('click', () => closeModal());
}

// ─── 4. 동무의 방 — renderDongmuHome() ────────────────────────────────
// 진단학 1차 skeleton — UI shell + 콘텐츠 영역에 placeholder cards.
function renderDongmuHome(){
  const view = document.getElementById('view');
  if(!view) return;
  const s = SUBJECT_BY_ID['dongmu'];

  view.innerHTML = `
    <style>
      .dm-banner { background:linear-gradient(135deg,#9C3030,#6E1818); color:#FFE08A;
                   padding:16px 14px; border-radius:10px; margin-bottom:12px;
                   display:flex; align-items:center; gap:14px; box-shadow:0 4px 12px rgba(60,12,12,.3); }
      .dm-banner-medal { width:64px; height:64px; border-radius:50%; overflow:hidden;
                          box-shadow:0 2px 8px rgba(0,0,0,.3); flex-shrink:0; }
      .dm-banner-medal .cmedal, .dm-banner-medal img { width:100%; height:100%; }
      .dm-banner-title { font-family:'ZCOOL XiaoWei',serif; font-size:24px; letter-spacing:.06em; }
      .dm-banner-sub { font-size:11.5px; opacity:.88; margin-top:2px; letter-spacing:.04em; }
      .dm-back { background:transparent; border:1px solid #FFE08A; color:#FFE08A; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; margin-left:auto; }
      .dm-back:hover { background:#FFE08A22; }
      .dm-section { background:#FAF1E0; border:1px solid #9C303033; border-radius:10px; padding:12px; margin-bottom:10px; }
      .dm-stitle { font-family:var(--font-display); font-size:14px; color:var(--zhusha-d); margin-bottom:6px; display:flex; align-items:center; gap:6px; }
      .dm-stitle .han { font-family:'ZCOOL XiaoWei',serif; font-size:18px; }
      .dm-card-placeholder { padding:10px; background:#fff; border-radius:6px; border:1px dashed #9C303055; font-size:11.5px; color:var(--mo-l); margin-top:6px; line-height:1.6; }
      .dm-sasangs { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-top:8px; }
      .dm-sasang-card { background:#fff; border-radius:8px; padding:10px; text-align:center; border:1px solid; }
      .dm-sasang-han { font-family:'ZCOOL XiaoWei',serif; font-size:22px; letter-spacing:.05em; }
      .dm-sasang-ko { font-size:11px; color:var(--gutong); margin-top:2px; }
      .dm-sasang-desc { font-size:10.5px; color:var(--mo-l); margin-top:6px; line-height:1.5; }
    </style>

    <div class="dm-banner">
      <div class="dm-banner-medal">${_medal('leejema', 64)}</div>
      <div style="flex:1">
        <div class="dm-banner-title">${esc(s.room_han)}</div>
        <div class="dm-banner-sub"><span class="han">${esc(s.subject_han)}</span> · ${esc(s.subject_ko)} · 李濟馬 主</div>
      </div>
      <button class="dm-back" type="button" id="dm-to-hub">← 醫書宮</button>
    </div>

    <div class="dm-section">
      <div class="dm-stitle"><span class="han">四象</span> 사상의학 體質</div>
      <div style="font-size:11px;color:var(--mo-l);line-height:1.55;margin-bottom:6px">
        東武 李濟馬 의 「東醫壽世保元」 — 사람의 체질을 太陽人 · 少陽人 · 太陰人 · 少陰人 의 네 유형으로 분류.
      </div>
      <div class="dm-sasangs">
        <div class="dm-sasang-card" style="border-color:#9C3030">
          <div class="dm-sasang-han" style="color:#9C3030">太陽人</div>
          <div class="dm-sasang-ko">태양인</div>
          <div class="dm-sasang-desc">肺大肝小 · 上焦盛 · 진취·결단력</div>
        </div>
        <div class="dm-sasang-card" style="border-color:#C9A227">
          <div class="dm-sasang-han" style="color:#C9A227">少陽人</div>
          <div class="dm-sasang-ko">소양인</div>
          <div class="dm-sasang-desc">脾大腎小 · 中上焦熱 · 명민·열정</div>
        </div>
        <div class="dm-sasang-card" style="border-color:#2A7060">
          <div class="dm-sasang-han" style="color:#2A7060">太陰人</div>
          <div class="dm-sasang-ko">태음인</div>
          <div class="dm-sasang-desc">肝大肺小 · 下焦盛 · 침착·인내</div>
        </div>
        <div class="dm-sasang-card" style="border-color:#1A4C7C">
          <div class="dm-sasang-han" style="color:#1A4C7C">少陰人</div>
          <div class="dm-sasang-ko">소음인</div>
          <div class="dm-sasang-desc">腎大脾小 · 下焦寒 · 섬세·신중</div>
        </div>
      </div>
    </div>

    <div class="dm-section">
      <div class="dm-stitle"><span class="han">四診</span> 사진법 (望聞問切)</div>
      <div class="dm-card-placeholder">
        望診(망진) · 聞診(문진) · 問診(문진) · 切診(절진) — 진단학의 기본 4법.
        데이터·문항·시각화 콘텐츠는 강의 자료 주입 후 구축 예정.
      </div>
    </div>

    <div class="dm-section">
      <div class="dm-stitle"><span class="han">辨證</span> 변증 體系</div>
      <div class="dm-card-placeholder">
        八綱 · 氣血津液 · 臟腑 · 六經 · 衛氣營血 · 三焦 등.
        데이터 주입 대기 중.
      </div>
    </div>

    <div class="dm-section" style="border-color:#9C302055;background:#FFF8F0">
      <div class="dm-stitle"><span class="han">建</span> 1차 구축 알림</div>
      <div style="font-size:11.5px;color:var(--mo-l);line-height:1.7">
        본 房은 <b>v11.0 skeleton</b> 단계입니다. UI shell·체질 구조·四診/辨證 틀이 갖춰져 있으며,
        구체 콘텐츠(강의노트·기출·문항)는 자료 주입 후 본격 구축됩니다.<br>
        멀티 對決·플래시카드·SRS·메달리온·氣 시스템 등 <b>공유 인프라</b>는
        다른 房 진학 시 그대로 작동.
      </div>
    </div>
  `;

  const back = document.getElementById('dm-to-hub');
  if(back) back.addEventListener('click', () => {
    if(typeof window.setTab === 'function') window.setTab('hub');
  });
}
window.renderDongmuHome = renderDongmuHome;

// ─── 5. ROUTES 등록 ───────────────────────────────────────────────────
function _registerRoutes(){
  if(typeof window.ROUTES === 'undefined'){
    setTimeout(_registerRoutes, 200);  // ROUTES 가 아직 정의되기 전이면 대기
    return;
  }
  window.ROUTES.hub    = renderClinicHub;
  window.ROUTES.dongmu = renderDongmuHome;
}

// ─── 6. 헤더에 宮 chip inject — 어디서나 의서궁으로 복귀 ─────────────
function _injectGungChip(){
  if(document.getElementById('gung-chip')) return;
  const chips = document.querySelector('.head-chips');
  if(!chips) return;
  const chip = document.createElement('div');
  chip.id = 'gung-chip';
  chip.className = 'head-chip';
  chip.title = '醫書宮 — 8房 입구';
  chip.style.cssText = 'cursor:pointer; font-family:"ZCOOL XiaoWei",serif; font-size:15px; padding:4px 9px; background:linear-gradient(135deg,#C9A227,#A07020); color:#3C1810; border:1px solid #6E4810; font-weight:700; letter-spacing:.05em';
  chip.innerHTML = '宮';
  chip.addEventListener('click', () => {
    if(typeof window.setTab === 'function') window.setTab('hub');
  });
  // 맨 앞에 삽입 (rank-chip 앞)
  chips.insertBefore(chip, chips.firstChild);
}

// ─── 7. 첫 진입 — 신규 사용자만 hub 로 자동 진입 ──────────────────────
function _maybeOpenHubFirstTime(){
  try{
    const S = window.S || {};
    // S.seenHub 이 false 면 hub 가 한 번도 표시되지 않은 것 — 첫 진입 시 hub 로
    if(!S.seenHub){
      S.seenHub = true;
      if(typeof window.saveState === 'function') window.saveState();
      // 약간의 지연 후 hub 로 이동 (init 완료 후)
      setTimeout(() => {
        if(typeof window.setTab === 'function') window.setTab('hub');
      }, 600);
    }
  }catch(_){}
}

// ─── 8. 초기화 ────────────────────────────────────────────────────────
function _init(){
  _registerRoutes();
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(_injectGungChip, 300);
      setTimeout(_maybeOpenHubFirstTime, 800);
    });
  } else {
    setTimeout(_injectGungChip, 300);
    setTimeout(_maybeOpenHubFirstTime, 800);
  }
}
_init();

// ─── 9. 외부 API ──────────────────────────────────────────────────────
window.V11ClinicHub = {
  SUBJECTS,
  SUBJECT_BY_ID,
  open: renderClinicHub,
  openDongmu: renderDongmuHome,
};

})();
