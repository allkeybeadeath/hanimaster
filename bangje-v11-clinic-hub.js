/* bangje-v11-clinic-hub.js — 醫書宮 (의서궁) v2.0 (v11.5)
 * ============================================================================
 *  과목 hub 의 통합 대청. 다음을 한 화면에:
 *    1. 시험 D-N 패널 (모든 과목·시험)
 *    2. 인사말 + 프로필 (이름·진영·캐릭터 변경)
 *    3. 도구 4종 (印·譽·方米·對決)
 *    4. 8房 그리드
 *    5. 同學 (현재 학습자 · presence)
 *    6. 명예의 전당 미리보기
 *    7. 黃帝內經 명언
 *    8. 建議 (건의사항)
 *    9. 업데이트 내역
 *
 *  외부 API: window.V11ClinicHub = { open, openDongmu, SUBJECTS, CHANGELOG_ENTRIES }
 * ============================================================================ */

(function(){
'use strict';

function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }
function openModal(html){ try{ window.openModal && window.openModal(html); }catch(_){} }
function closeModal(){ try{ window.closeModal && window.closeModal(); }catch(_){} }

// ─── SUBJECTS ─────────────────────────────────────────────── v12.0 ──
//   黃帝 → 預防醫學, 岐伯 → 病理學, 華佗 → 洋方病理學, 道人(lindaoren) → 影像診斷學
//   經穴포커 (jxpoker) 신설 — 방미큐브 옆에 NEW 표시
const SUBJECTS = [
  { id:'shennong',  room_han:'神農之房', subject_han:'方劑學', subject_ko:'방제학',   mascot_id:'shennong',  status:'active',      route:'home',   accent:'#C9A227', desc:'處方·本草·君臣佐使', badge:'方米큐브 最終 v1.1' },
  { id:'jxpoker',   room_han:'卦象之房', subject_han:'經穴포커', subject_ko:'경혈포커', mascot_id:'bianque',   status:'active',      route:'jxpoker', accent:'#D4AF37', desc:'361穴 카드 · 14단계 족보 · 최대 8人', isNew:true },
  { id:'dongmu',    room_han:'東武之房', subject_han:'診斷學', subject_ko:'진단학',   mascot_id:'leejema',   status:'active',      route:'dongmu', accent:'#9C3030', desc:'設診·四象·辨證' },
  { id:'zhongjing', room_han:'仲景之房', subject_han:'傷寒論', subject_ko:'상한론',   mascot_id:'zhongjing', status:'placeholder', route:null,     accent:'#1A4C7C', desc:'六經辨證·經方' },
  { id:'qibo',      room_han:'岐伯之房', subject_han:'病理學',   subject_ko:'병리학',     mascot_id:'qibo',      status:'active', route:null,     accent:'#2A7060', desc:'臟象·經絡·病機 — 內經 病理' },
  { id:'huangdi',   room_han:'黃帝之房', subject_han:'預防醫學', subject_ko:'예방의학',     mascot_id:'huangdi',   status:'active', route:null,     accent:'#7C5810', desc:'上工治未病·攝生·三因制宜' },
  { id:'huatuo',    room_han:'華佗之房', subject_han:'洋方病理', subject_ko:'양방병리학',     mascot_id:'huatuo',    status:'active', route:null,     accent:'#7A3030', desc:'세포·조직·종양·염증 — 현대 病理' },
  { id:'lindaoren', room_han:'道人之房', subject_han:'影像診斷', subject_ko:'영상진단학', mascot_id:'lindaoren', status:'active', route:null,     accent:'#5C4070', desc:'X-ray·CT·MRI·초음파 판독' },
  { id:'saamdoin',  room_han:'舍巖之房', subject_han:'經穴',   subject_ko:'경혈학',   mascot_id:'saamdoin',  status:'active',      route:'saamdoin', accent:'#3A6A4A', desc:'舍巖鍼法·經絡·五輸穴' },
];
const SUBJECT_BY_ID = {}; SUBJECTS.forEach(s => SUBJECT_BY_ID[s.id] = s);

// ─── CHANGELOG ─────────────────────────────────────────────────────────
const CHANGELOG_ENTRIES = [
  { id:'v12.0', label:'v12.0', date:'2026-05-18', title:'經穴 포커 大신설 · 의서궁 八房 재편 · 멀티 컷 統一', body:
    '經穴 포커 (jingxue-poker) 신규 — 361穴 카드덱 124장 / 14단계 족보 (확률 정확계산) / 최대 8人 멀티 + AI 봇 / ' +
    '베팅 (콜·체크·하프·쿼터·올인·폴드) · 최소 판돈 참여자 평균 氣 1/100. ' +
    '모드: 五札引換(드로우)·七札對局(세븐)·德州式(홀덤)·隨機(랜덤). ' +
    '의서궁 八房 재편: 黃帝→預防醫學, 岐伯→病理學, 華佗→洋方病理學, 道人→影像診斷學. ' +
    '모든 멀티 게임(방제 對決·방미큐브·경혈 포커·오수혈 레이스) 시작 컷 統一. ' +
    '오수혈 레이스 公開房 추가. 각 방 좌상단 마스코트 아이콘. ' +
    '방미큐브는 v2.0 (게임시간 ≤10분) 으로 最終 업데이트 — 이후 추가 없음. ' +
    'HERB_ALIASES dead alias 20종 제거.' },
  { id:'v11.6.0', label:'v11.6.0', date:'2026-05-18', title:'경혈학 정식 통합 · 과목별 하단nav 분리 · 對位 사진 확대 · 「전부다」 분리', body:
    '경혈학 (舍巖之房) — V11Saam 신규 모듈 정식 편입 (五輸穴·特定要穴 + 멀티 fully implemented). 의서궁 타일에서 바로 진입. ' +
    '하단 nav 가 房별로 교체됨 — 방제학은 處方·약재·암기·기출·통계·명예, 진단학은 圖鑑·對位·問答·速習·析究, 경혈학은 五輸·멀티. ' +
    '동무의 방: 「對位 · 기존(끌어다 놓기)」 + 「對位 · 전부다(정답 일괄 표시)」 두 버튼으로 분리. ' +
    '對位 매트릭스 사진 클릭 시 풀스크린 라이트박스 확대 (tray ⤢ 버튼 / 셀 상세 모달의 .pho 모두 동작, ESC 또는 사진 클릭으로 닫기).' },
  { id:'v11.6', label:'v11.6', date:'2026-05-18', title:'醫書宮 同學 활동상태 통합 · 설진 對位 48장 完備 · 參考書', body:
    '의서궁 同學 목록의 activity 객체 렌더 버그 픽스 (이전: [object Object] / 빈 라벨 → 안 보임). ' +
    '진단학·경혈학·설진 등 八房 전 과목 진입 시 V96Activity.set 자동 호출 → 의서궁에서 어디서 학습 중인지 실시간 표시. ' +
    'hub 화면 머무는 동안 25초마다 同學/명전 자동 새로고침. ' +
    '本人 항상 상단 + 「(나)」 배지. ' +
    '對位 매트릭스: 48 설진 사진 全 매핑 완료 (이전 24/48 → 48/48). 누락된 형태계·黑苔·偏盛계 24장 추가. ' +
    '진단학 동무대청에 표준 참고서적 7종 패널 (한방진단학·동의진단학·中医舌诊图谱·Kirschbaum·Maciocia·Schnorrenberger·진단학회지).' },
  { id:'v11.5', label:'v11.5', date:'2026-05-18', title:'醫書宮 통합 hub · 진단학 풀 구축', body:
    '醫書宮 첫 진입 시 모든 과목 시험 D-N · 프로필 변경 · 同學 · 명예의 전당 · 黃帝內經 명언 · 건의사항 · 업뎃 내역을 한 화면에. ' +
    '진단학을 방제학과 동일한 형식으로 재구축: 圖鑑·問答·主觀·速習·析究·對位 6 모드. 48 설진 사진을 사용자 규칙 (苔 글자 기준) 으로 재분류 — 舌質 24장 · 舌苔 20장 · 兼 4장. ' +
    '방제학 home 중복 카드 (譽·對決 / 業績·印) 제거.' },
  { id:'v11.4', label:'v11.4', date:'2026-05-18', title:'醫書宮 진입 라우팅 정상화 · 對位 매트릭스', body:
    'window.ROUTES 노출 + setTab 래퍼로 hub/dongmu 라우팅 픽스. 5×5 설색×설태 매트릭스 끌어다 놓기 학습 (對位).' },
  { id:'v11.3', label:'v11.3', date:'2026-05-18', title:'강제 hub 첫 진입 + bottom nav 숨김', body:'醫書宮 시작 시 bottom nav 숨김.' },
  { id:'v11.2', label:'v11.2', date:'2026-05-18', title:'醫書宮 첫 진입 고정 + 도구 4종 + 업뎃 패널', body:'첫 화면 항상 醫書宮. 도구 4종 (印·譽·方米·對決).' },
  { id:'v11.1', label:'v11.1', date:'2026-05-18', title:'동무의 방 1차 — 설진 학습', body:'48장 설진 사진 + 4가지 학습 모드.' },
  { id:'v11.0', label:'v11.0', date:'2026-05-17', title:'醫書宮 입구 — 다과목 hub', body:'神農之房 외 7방 추가 (skeleton).' },
];

// ─── Helpers ───────────────────────────────────────────────────────────
function _medal(charId, size){
  if(typeof window._charPhotoMedallion === 'function') return window._charPhotoMedallion(charId, size);
  if(typeof window._charMedallion === 'function')      return window._charMedallion(charId, size);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#E8C8A0;display:flex;align-items:center;justify-content:center;font-family:'ZCOOL XiaoWei',serif;font-size:${Math.round(size*0.4)}px;color:#3A1810">人</div>`;
}
function _daysUntil(iso){
  if(!iso) return null;
  const d = new Date(iso).getTime();
  if(!isFinite(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}

// 통합 시험 목록 — 등록된 모든 과목·시험
function _collectExams(){
  const list = [];
  const meta = window.EXAM_META, iso = window.EXAM_DATE_ISO;
  if(meta && iso){
    list.push({ subjectId:'shennong', subject_han:'方劑學', label:meta.examTitle||'시험', date:iso, han:'方劑', accent:'#C9A227', range:meta.rangeKR||'' });
  }
  if(window.JINDAN_EXAMS && Array.isArray(window.JINDAN_EXAMS)){
    window.JINDAN_EXAMS.forEach(e => {
      list.push({ subjectId:'dongmu', subject_han:'診斷學', label:e.label, date:e.date, han:e.han, accent:e.accent||'#9C3030', range:e.desc||'' });
    });
  }
  list.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return list;
}

// ─── 1. renderClinicHub ────────────────────────────────────────────────
function renderClinicHub(){
  const view = document.getElementById('view');
  if(!view) return;
  const S = window.S || {};
  const rk = (typeof window.getRank === 'function') ? window.getRank(S.qi||0) : {seal:'?', han:'', ko:'', color:'#7A3D27'};
  const fac = (typeof window.getFaction === 'function') ? window.getFaction(S.faction||'taeyang') : {han:'', han2:'?', color:'#7A3D27', ko:''};
  const charMeta = (window.PHYSICIAN_BY_ID || {})[S.character||'shennong'] || {};
  const exams = _collectExams();
  
  // 시험 D-N pill 들
  const examPills = exams.map(e => {
    const d = _daysUntil(e.date);
    if(d === null) return '';
    const txt = d > 0 ? `D-${d}` : (d === 0 ? 'D-Day' : `D+${-d}`);
    const past = d < 0;
    const urgent = !past && d <= 3;
    const bg = past ? 'transparent' : (urgent ? '#9C3030' : e.accent);
    const fg = past ? '#7A5C40' : '#fff';
    const border = past ? '1px solid #C9A22755' : '0';
    return `<button class="hub-exam-pill" type="button" data-subject="${esc(e.subjectId)}" style="background:${bg};color:${fg};border:${border};opacity:${past?'.6':'1'}" title="${esc(e.subject_han)} · ${esc(e.range)}">
      <span class="han">${esc(e.han)}</span>
      <span class="lbl">${esc(e.label)}</span>
      <b class="dn">${txt}</b>
    </button>`;
  }).join('');
  
  // 8房 (v12: NEW 배지 + 방미큐브 最終 배지 표시)
  const cards = SUBJECTS.map(s => {
    const dim = s.status === 'placeholder' ? ' hub-card-dim' : '';
    const statusBadge = s.status === 'active'   ? `<span class="hub-status hub-active">運營</span>`
                      : s.status === 'skeleton' ? `<span class="hub-status hub-skel">準備</span>`
                      :                           `<span class="hub-status hub-plc">未開</span>`;
    const newBadge = s.isNew ? `<span class="hub-new-flag" style="position:absolute;top:6px;right:6px;background:linear-gradient(135deg,#FF6B35,#E55934);color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px;letter-spacing:1px;box-shadow:0 2px 8px rgba(229,89,52,0.5);animation:hubNewPulse 1.6s ease-in-out infinite">NEW</span>` : '';
    const extraBadge = s.badge ? `<div class="hub-extra-badge" style="font-size:10px;color:#C9A227;margin-top:4px;letter-spacing:1px">${esc(s.badge)}</div>` : '';
    return `
      <button class="hub-card${dim}" type="button" data-subject="${esc(s.id)}" style="--accent:${s.accent};position:relative">
        ${newBadge}
        <div class="hub-medal">${_medal(s.mascot_id, 60)}</div>
        <div class="hub-room-han">${esc(s.room_han)}</div>
        <div class="hub-subject"><span class="han">${esc(s.subject_han)}</span> · ${esc(s.subject_ko)}</div>
        <div class="hub-desc">${esc(s.desc)}</div>
        ${extraBadge}
        <div class="hub-meta">${statusBadge}</div>
      </button>
    `;
  }).join('');
  // NEW 배지 펄스 애니메이션 한 번만 주입
  if(!document.getElementById('v12-hub-newflag-style')){
    const st = document.createElement('style');
    st.id = 'v12-hub-newflag-style';
    st.textContent = '@keyframes hubNewPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}';
    document.head.appendChild(st);
  }
  
  // changelog
  const seenList = (S.seenChangelogs || []);
  const newCount = CHANGELOG_ENTRIES.filter(c => !seenList.includes(c.id)).length;
  const changelogsHtml = CHANGELOG_ENTRIES.map((c, idx) => {
    const isNew = !seenList.includes(c.id);
    const expanded = idx < 1 || (isNew && idx < 2);
    return `
      <details class="hub-cl-entry" ${expanded?'open':''} data-cl-id="${esc(c.id)}">
        <summary>
          <span class="hub-cl-v">${esc(c.label)}</span>
          <span class="hub-cl-date">${esc(c.date)}</span>
          ${isNew ? `<span class="hub-cl-new">NEW</span>` : ''}
          <span class="hub-cl-title">${esc(c.title)}</span>
        </summary>
        <div class="hub-cl-body">${c.body}</div>
      </details>
    `;
  }).join('');
  
  // 황제내경
  let neijingCard = '';
  if(typeof window.pickDailyAphorism === 'function'){
    try{
      const ap = window.pickDailyAphorism();
      if(ap){
        const ko = (ap.ko && ap.ko !== ap.han) ? `<div class="hub-nj-ko">${esc(ap.ko)}</div>` : '';
        neijingCard = `
          <div class="hub-section hub-neijing">
            <div class="hub-section-title"><span class="han">每日</span> 오늘의 黃帝內經</div>
            <div class="hub-nj-han han">${esc(ap.han)}</div>
            ${ko}
            <div class="hub-nj-src">— ${esc(ap.src||'')}</div>
          </div>`;
      }
    }catch(_){}
  }
  
  view.innerHTML = `
    <style>
      .hub-title { font-family:'ZCOOL XiaoWei','Noto Serif KR',serif; font-size:28px; letter-spacing:.08em; color:var(--zhusha-d); text-align:center; margin:6px 0 1px; }
      .hub-subtitle { text-align:center; font-size:11px; color:var(--gutong); margin-bottom:10px; letter-spacing:.05em; }
      
      /* 시험 D-N 패널 */
      .hub-exam-panel { background:linear-gradient(135deg,#FFF8E0,#F5DCB8); border:1px solid #C9A227; border-radius:10px; padding:10px 11px; margin-bottom:12px; box-shadow:0 3px 7px rgba(60,30,10,.12); }
      .hub-exam-panel-title { font-family:var(--font-display); font-size:11.5px; color:var(--zhusha-d); margin-bottom:7px; letter-spacing:.05em; display:flex; align-items:center; gap:5px; }
      .hub-exam-panel-title .han { font-family:'Noto Serif SC',serif; font-size:14px; font-weight:700; }
      .hub-exam-pills { display:flex; flex-wrap:wrap; gap:6px; }
      .hub-exam-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 11px; border-radius:13px; font-size:11px; cursor:pointer; font-family:inherit; transition:transform .15s ease, box-shadow .15s ease; }
      .hub-exam-pill:hover { transform:translateY(-1px); box-shadow:0 3px 7px rgba(0,0,0,.15); }
      .hub-exam-pill .han { font-family:'Noto Serif SC',serif; font-size:12px; font-weight:700; }
      .hub-exam-pill .lbl { font-size:10.5px; opacity:.9; }
      .hub-exam-pill .dn { font-family:var(--font-display); font-size:12px; }
      .hub-exam-empty { color:var(--mo-l); font-size:11px; text-align:center; padding:6px; }
      
      /* 인사말 */
      .hub-greet { display:flex; align-items:center; gap:11px; background:linear-gradient(135deg,#FFF8E0,#F0DCB8); border:1px solid #C9A22755; border-radius:10px; padding:10px 12px; margin-bottom:10px; }
      .hub-greet .gmedal { width:54px; height:54px; border-radius:50%; overflow:hidden; flex-shrink:0; cursor:pointer; }
      .hub-greet .gmedal img, .hub-greet .gmedal .cmedal { width:100%; height:100%; }
      .hub-greet .ginfo { flex:1; min-width:0; }
      .hub-greet .gname-row { display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:4px; }
      .hub-greet .gseal { font-family:'Noto Serif SC',serif; font-size:11px; font-weight:700; color:#fff; padding:1.5px 6px; border-radius:3px; }
      .hub-greet .gname { font-family:'Noto Serif KR',serif; font-size:15px; color:var(--mo); font-weight:600; }
      .hub-greet .gfac { font-family:'Noto Serif SC',serif; font-size:11px; color:#fff; padding:1px 7px; border-radius:9px; }
      .hub-greet .grank { font-size:10.5px; color:var(--gutong); font-family:'Noto Serif SC',serif; }
      .hub-greet .gqi { font-size:11px; color:var(--mo-l); margin-top:1px; }
      .hub-greet .gqi b { color:var(--zhusha-d); font-family:var(--font-display); }
      .hub-greet .gchar { font-size:10px; color:var(--gutong); margin-top:1px; }
      .hub-greet .gchar .han { font-family:'Noto Serif SC',serif; color:var(--zhusha-d); font-weight:600; }
      .hub-greet .gedit { background:transparent; border:1px solid #C9A22788; color:var(--mo); padding:5px 10px; border-radius:6px; font-size:11px; cursor:pointer; margin-left:auto; font-family:inherit; align-self:flex-start; }
      .hub-greet .gedit:hover { background:#FFE8B0; }
      
      /* 도구 4종 */
      .hub-tools { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:12px; }
      .hub-tool-btn { background:#FFF8E0; border:1px solid #C9A22755; padding:8px 4px; border-radius:8px; text-align:center; cursor:pointer; font-family:inherit; color:var(--mo); transition:all .12s; }
      .hub-tool-btn:hover { background:#FFE8B0; border-color:#C9A227; transform:translateY(-1px); }
      .hub-tool-han { font-family:'Noto Serif SC',serif; font-size:16px; color:var(--zhusha-d); font-weight:700; line-height:1; }
      .hub-tool-ko { font-size:10px; color:var(--mo-l); margin-top:3px; line-height:1.2; }
      
      /* 8房 그리드 */
      .hub-grid-title { font-family:var(--font-display); font-size:12.5px; color:var(--zhusha-d); margin:8px 0 6px; display:flex; align-items:center; gap:6px; }
      .hub-grid-title:before, .hub-grid-title:after { content:''; flex:1; height:1px; background:linear-gradient(to right, transparent, #C9A22755, transparent); }
      .hub-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:7px; margin-bottom:12px; }
      @media (min-width:540px) { .hub-grid { grid-template-columns:repeat(3,1fr); } }
      .hub-card { position:relative; background:#FAF1E0; border:1px solid var(--accent); border-left:4px solid var(--accent); border-radius:9px; padding:9px 7px 8px; display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; transition:transform .15s ease, box-shadow .15s ease; font-family:inherit; text-align:center; color:var(--mo); }
      .hub-card:hover { transform:translateY(-2px); box-shadow:0 5px 12px rgba(60,30,10,.18); }
      .hub-card-dim { opacity:.62; }
      .hub-medal { width:60px; height:60px; border-radius:50%; overflow:hidden; }
      .hub-medal img, .hub-medal .cmedal { width:100%; height:100%; }
      .hub-room-han { font-family:'Noto Serif SC',serif; font-size:14px; font-weight:700; color:var(--zhusha-d); }
      .hub-subject { font-size:10.5px; color:var(--mo); margin-top:1px; }
      .hub-subject .han { font-family:'Noto Serif SC',serif; font-weight:700; }
      .hub-desc { font-size:9.5px; color:var(--mo-l); margin-top:2px; line-height:1.4; }
      .hub-meta { display:flex; gap:4px; margin-top:3px; }
      .hub-status { font-size:9.5px; padding:1px 5px; border-radius:3px; font-family:var(--font-display); }
      .hub-active { background:#2A7060; color:#FFE08A; }
      .hub-skel   { background:#C9A227; color:#3A1810; }
      .hub-plc    { background:#7A5C40; color:#FFE08A; }
      
      /* sections */
      .hub-section { background:#FAF1E0; border:1px solid #C9A22744; border-radius:9px; padding:11px 12px; margin-bottom:10px; }
      .hub-section-title { font-family:var(--font-display); font-size:12px; color:var(--zhusha-d); margin-bottom:7px; letter-spacing:.04em; display:flex; align-items:center; gap:6px; }
      .hub-section-title .han { font-family:'Noto Serif SC',serif; font-size:14px; font-weight:700; }
      .hub-section-title .more { margin-left:auto; font-size:10.5px; color:var(--gutong); cursor:pointer; background:transparent; border:0; font-family:inherit; }
      .hub-section-title .more:hover { color:var(--zhusha); }
      
      /* presence */
      .hub-presence-list { display:flex; flex-wrap:wrap; gap:5px; min-height:28px; }
      .hub-presence-item { display:flex; align-items:center; gap:5px; background:#fff; border:1px solid #C9A22744; border-radius:18px; padding:3px 8px 3px 4px; font-size:11px; }
      .hub-presence-medal { width:22px; height:22px; border-radius:50%; overflow:hidden; flex-shrink:0; }
      .hub-presence-medal img, .hub-presence-medal .cmedal { width:100%; height:100%; }
      .hub-presence-name { font-family:'Noto Serif KR',serif; color:var(--mo); font-weight:600; }
      .hub-presence-act { font-size:9.5px; color:var(--mo-l); }
      .hub-presence-empty { font-size:11px; color:var(--mo-l); padding:4px 0; }
      
      /* 명전 미리보기 */
      .hub-hall-list { display:flex; flex-direction:column; gap:4px; }
      .hub-hall-row { display:flex; align-items:center; gap:7px; padding:5px 8px; background:#fff; border:1px solid #C9A22744; border-radius:7px; font-size:11.5px; }
      .hub-hall-rank { font-family:var(--font-display); font-size:12px; color:var(--zhusha-d); width:18px; text-align:center; }
      .hub-hall-medal { width:24px; height:24px; border-radius:50%; overflow:hidden; flex-shrink:0; }
      .hub-hall-medal img, .hub-hall-medal .cmedal { width:100%; height:100%; }
      .hub-hall-name { flex:1; font-family:'Noto Serif KR',serif; color:var(--mo); }
      .hub-hall-qi { font-family:var(--font-display); color:var(--zhusha-d); font-size:11px; }
      .hub-hall-qi b { color:var(--zhusha); }
      
      /* 황제내경 */
      .hub-neijing { background:linear-gradient(135deg,#FFFCE8,#F8E8C0); border-color:#C9A22788; }
      .hub-nj-han { font-family:'ZCOOL XiaoWei','Noto Serif SC',serif; font-size:17px; color:var(--zhusha-d); line-height:1.5; text-align:center; margin:2px 0 4px; letter-spacing:.04em; }
      .hub-nj-ko { font-size:11.5px; color:var(--mo); text-align:center; line-height:1.55; margin-bottom:4px; }
      .hub-nj-src { font-size:10px; color:var(--gutong); text-align:right; font-style:italic; }
      
      /* 건의사항 */
      .hub-fb-form { display:flex; flex-direction:column; gap:6px; }
      .hub-fb-form textarea { width:100%; min-height:60px; padding:8px; font-size:12px; border:1px solid #C9A22755; border-radius:6px; font-family:inherit; resize:vertical; background:#fff; }
      .hub-fb-form textarea:focus { outline:none; border-color:#9C3030; }
      .hub-fb-form-row { display:flex; gap:6px; justify-content:flex-end; }
      .hub-fb-btn { padding:6px 12px; font-size:11.5px; border-radius:6px; cursor:pointer; font-family:inherit; }
      .hub-fb-btn.primary { background:#9C3030; color:#FFE08A; border:0; }
      .hub-fb-btn.secondary { background:transparent; color:var(--mo); border:1px solid #C9A22788; }
      .hub-fb-list { margin-top:9px; display:flex; flex-direction:column; gap:5px; max-height:200px; overflow-y:auto; }
      .hub-fb-item { background:#fff; border:1px solid #C9A22744; border-radius:6px; padding:7px 10px; font-size:11.5px; line-height:1.55; }
      .hub-fb-item .who { font-size:10px; color:var(--gutong); font-family:'Noto Serif SC',serif; }
      .hub-fb-item .ts { font-size:9.5px; color:var(--mo-l); margin-left:6px; }
      
      /* changelog */
      .hub-cl-entry { background:#fff; border:1px solid #C9A22744; border-radius:6px; padding:0; margin-bottom:5px; overflow:hidden; }
      .hub-cl-entry summary { padding:7px 10px; cursor:pointer; list-style:none; display:flex; align-items:center; gap:6px; font-size:11.5px; user-select:none; }
      .hub-cl-entry summary::-webkit-details-marker { display:none; }
      .hub-cl-entry summary::before { content:'▸'; transition:transform .15s; color:#9C3030; }
      .hub-cl-entry[open] summary::before { transform:rotate(90deg); }
      .hub-cl-v { font-family:var(--font-display); color:var(--zhusha-d); font-weight:700; }
      .hub-cl-date { font-size:10px; color:var(--gutong); }
      .hub-cl-new { font-size:9px; background:#9C3030; color:#FFE08A; padding:1px 4px; border-radius:2px; font-weight:700; }
      .hub-cl-title { color:var(--mo); flex:1; }
      .hub-cl-body { padding:6px 12px 11px; font-size:11px; color:var(--mo); line-height:1.65; border-top:1px solid #C9A22733; }
    </style>
    
    <div class="hub-title">醫書宮</div>
    <div class="hub-subtitle">의서궁 · 八房 입구</div>
    
    <!-- 시험 D-N 패널 -->
    <div class="hub-exam-panel">
      <div class="hub-exam-panel-title"><span class="han">試</span> 시험 일정 · 全 과목</div>
      ${examPills ? `<div class="hub-exam-pills">${examPills}</div>` : '<div class="hub-exam-empty">등록된 시험 없음</div>'}
    </div>
    
    <!-- 인사말 + 프로필 -->
    <div class="hub-greet">
      <div class="gmedal" id="hub-pick-medal">${_medal(S.character || 'shennong', 54)}</div>
      <div class="ginfo">
        <div class="gname-row">
          <span class="gseal" style="background:${rk.color||'#7A3D27'}">${esc(rk.seal||'?')}</span>
          <span class="gname">${esc(S.name||'?')}</span>
          <span class="gfac" style="background:${esc(fac.color||'#7A3D27')}">${esc(fac.han2||fac.han||'?')}</span>
        </div>
        <div class="grank">${esc(rk.han||'')} · ${esc(rk.ko||'')}</div>
        <div class="gqi">누적 <b>${(S.qi||0).toLocaleString()}</b> 氣</div>
        <div class="gchar">캐릭터 · <span class="han">${esc(charMeta.han||'?')}</span> · ${esc(charMeta.ko||'')}</div>
      </div>
      <button class="gedit" type="button" id="hub-profile-edit">編 변경</button>
    </div>
    
    <!-- 도구 4종 -->
    <div class="hub-tools" data-v12-poker-target="1">
      <button class="hub-tool-btn" type="button" id="hub-tool-prof"><div class="hub-tool-han">印·業</div><div class="hub-tool-ko">프로필·업적</div></button>
      <button class="hub-tool-btn" type="button" id="hub-tool-hall"><div class="hub-tool-han">譽</div><div class="hub-tool-ko">명예의 전당</div></button>
      <button class="hub-tool-btn" type="button" id="hub-tool-cube"><div class="hub-tool-han">方米</div><div class="hub-tool-ko">방미큐브</div><span class="hub-final-badge">最終</span></button>
      <button class="hub-tool-btn is-new" type="button" id="hub-tool-poker"><div class="hub-tool-han">經穴</div><div class="hub-tool-ko">포커</div><span class="hub-new-badge">NEW</span></button>
      <button class="hub-tool-btn" type="button" id="hub-tool-duel"><div class="hub-tool-han">對決</div><div class="hub-tool-ko">멀티 入場</div></button>
    </div>
    
    <!-- 8房 -->
    <div class="hub-grid-title"><span class="han">八房</span> 과목</div>
    <div class="hub-grid">${cards}</div>
    
    <!-- 同學 (presence) -->
    <div class="hub-section">
      <div class="hub-section-title">
        <span class="han">同學</span> 현재 학습 중
        <span style="font-size:11px;color:var(--feicui);font-weight:700" id="hub-pres-count">…</span>
      </div>
      <div class="hub-presence-list" id="hub-pres-list">
        <span class="hub-presence-empty">불러오는 중…</span>
      </div>
    </div>
    
    <!-- 명전 미리보기 -->
    <div class="hub-section">
      <div class="hub-section-title">
        <span class="han">譽</span> 명예의 전당 · Top
        <button class="more" type="button" id="hub-hall-more">전체 →</button>
      </div>
      <div class="hub-hall-list" id="hub-hall-list">
        <div class="hub-presence-empty">불러오는 중…</div>
      </div>
    </div>
    
    <!-- 황제내경 -->
    ${neijingCard}
    
    <!-- 건의사항 -->
    <div class="hub-section">
      <div class="hub-section-title"><span class="han">建議</span> 건의사항·피드백</div>
      <div style="font-size:10.5px;color:var(--mo-l);margin-bottom:6px">버그·개선 의견·요청 자유롭게.</div>
      <div class="hub-fb-form">
        <textarea id="hub-fb-msg" placeholder="자유롭게 적어주세요…" maxlength="500"></textarea>
        <div class="hub-fb-form-row">
          <button class="hub-fb-btn secondary" type="button" id="hub-fb-refresh">새로고침</button>
          <button class="hub-fb-btn primary" type="button" id="hub-fb-send">보내기</button>
        </div>
      </div>
      <div class="hub-fb-list" id="hub-fb-list">
        <div class="hub-presence-empty">불러오는 중…</div>
      </div>
    </div>
    
    <!-- 업뎃 -->
    <div class="hub-section">
      <div class="hub-section-title">
        <span class="han">改</span> 업데이트 내역
        ${newCount > 0 ? `<span style="font-size:10px;background:#9C3030;color:#FFE08A;padding:1px 5px;border-radius:3px;font-weight:700">NEW ${newCount}</span>` : ''}
      </div>
      ${changelogsHtml}
    </div>
    
    <!-- 버전 -->
    <div style="text-align:center;font-size:10px;color:var(--gutong);margin-top:14px;padding-bottom:14px">
      ${esc(window.APP_VERSION||'')} · 醫書宮 v2.0
    </div>
  `;
  
  _wireHub();
  _loadPresence();
  _loadHallPreview();
  _loadFeedback();
  
  // changelog 펼침 → seen 기록
  $$('.hub-cl-entry').forEach(d => {
    d.addEventListener('toggle', () => {
      if(d.open){
        const id = d.dataset.clId;
        S.seenChangelogs = S.seenChangelogs || [];
        if(!S.seenChangelogs.includes(id)){
          S.seenChangelogs.push(id);
          if(typeof window.saveState === 'function') window.saveState();
        }
      }
    });
  });
}

// ─── 2. 이벤트 와이어링 ────────────────────────────────────────────────
function _wireHub(){
  // 시험 pill → 해당 과목 방으로
  $$('.hub-exam-pill').forEach(p => p.addEventListener('click', () => {
    const sid = p.dataset.subject;
    _enterSubject(sid);
  }));
  
  // 8房 카드
  $$('.hub-card').forEach(c => c.addEventListener('click', () => {
    const sid = c.dataset.subject;
    _enterSubject(sid);
  }));
  
  // 프로필 메달 클릭 → 캐릭터 픽
  const med = $('#hub-pick-medal');
  if(med) med.addEventListener('click', () => {
    if(typeof window.openCharacterPicker === 'function'){ window.openCharacterPicker(); return; }
    // fallback: hash로 character 영역 안내
    toast('캐릭터 선택은 「印·業」 또는 본 방제학에서','gold');
  });
  
  // 프로필 편집
  const edit = $('#hub-profile-edit');
  if(edit) edit.addEventListener('click', _openProfileEdit);
  
  // 도구 4종
  const prof = $('#hub-tool-prof');
  if(prof) prof.addEventListener('click', () => {
    if(window.V97Profile && window.V97Profile.openGallery) window.V97Profile.openGallery();
    else toast('프로필 모듈 미로드','warn');
  });
  const hall = $('#hub-tool-hall');
  if(hall) hall.addEventListener('click', () => { if(typeof window.setTab === 'function') window.setTab('hall'); });
  const cube = $('#hub-tool-cube');
  if(cube) cube.addEventListener('click', () => { if(typeof window.setTab === 'function') window.setTab('cube'); });
  const poker = $('#hub-tool-poker');
  if(poker) poker.addEventListener('click', () => {
    if(window.V12Poker && window.V12Poker.openHome) window.V12Poker.openHome();
    else if(typeof window.setTab === 'function') window.setTab('jingxue-poker');
  });
  const duel = $('#hub-tool-duel');
  if(duel) duel.addEventListener('click', () => {
    if(typeof window.setTab === 'function') window.setTab('hall');
    toast('명예의 전당 → 對決區 에서 매칭','gold');
  });
  
  // 명전 전체
  const hm = $('#hub-hall-more');
  if(hm) hm.addEventListener('click', e => { e.stopPropagation(); if(typeof window.setTab === 'function') window.setTab('hall'); });
  
  // 건의
  const send = $('#hub-fb-send');
  if(send) send.addEventListener('click', _sendFeedback);
  const refresh = $('#hub-fb-refresh');
  if(refresh) refresh.addEventListener('click', _loadFeedback);
}

// 과목 방 진입 (시험 pill 또는 房 카드 클릭)
function _enterSubject(sid){
  const s = SUBJECT_BY_ID[sid];
  if(!s) return;
  if(s.status === 'placeholder') return _openPlaceholder(s);
  if(s.route && typeof window.setTab === 'function') return window.setTab(s.route);
}

function _openPlaceholder(s){
  openModal(`
    <div style="text-align:center;padding:14px 6px">
      <div style="width:70px;height:70px;margin:0 auto 10px;border-radius:50%;overflow:hidden">${_medal(s.mascot_id, 70)}</div>
      <div style="font-family:'ZCOOL XiaoWei',serif;font-size:22px;color:var(--zhusha-d);letter-spacing:.05em">${esc(s.room_han)}</div>
      <div style="font-size:12px;color:var(--mo-l);margin-top:3px"><span class="han">${esc(s.subject_han)}</span> · ${esc(s.subject_ko)}</div>
      <div style="font-size:11.5px;color:var(--mo);margin-top:11px;line-height:1.65;padding:10px;background:#FAF1E0;border-radius:7px">
        본 房은 <b>준비 중</b>입니다.<br>강의노트·자료 주입 후 본격 개관 예정.
      </div>
      <button class="btn" type="button" id="plc-close" style="width:100%;margin-top:11px">알겠습니다</button>
    </div>
  `);
  const c = document.getElementById('plc-close');
  if(c) c.addEventListener('click', () => closeModal());
}

// 프로필 편집 모달 — 이름·진영
function _openProfileEdit(){
  const S = window.S || {};
  const FACTIONS = window.FACTIONS || [];
  const facOpts = FACTIONS.map(f => {
    const sel = (S.faction === f.id) ? ' selected' : '';
    return `<option value="${esc(f.id)}"${sel}>${esc(f.han)} · ${esc(f.ko)}</option>`;
  }).join('');
  openModal(`
    <div style="padding:8px 4px">
      <div style="font-family:'Noto Serif SC',serif;font-size:16px;color:var(--zhusha-d);margin-bottom:11px"><b>編 · 프로필 변경</b></div>
      <div style="font-size:11.5px;color:var(--mo);margin-bottom:5px">이름</div>
      <input type="text" id="ed-name" value="${esc(S.name||'')}" maxlength="20" style="width:100%;padding:9px 10px;font-size:13px;border:1.5px solid #C9A22755;border-radius:6px;font-family:inherit;background:#fff;margin-bottom:11px">
      <div style="font-size:11.5px;color:var(--mo);margin-bottom:5px">진영 (passive 능력)</div>
      <select id="ed-fac" style="width:100%;padding:9px 10px;font-size:13px;border:1.5px solid #C9A22755;border-radius:6px;font-family:inherit;background:#fff;margin-bottom:14px">
        ${facOpts}
      </select>
      <div style="font-size:10.5px;color:var(--mo-l);margin-bottom:11px;line-height:1.6">캐릭터 변경은 메달 사진을 탭하거나 「印·業」 에서.</div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-o" type="button" id="ed-cancel" style="flex:1">취소</button>
        <button class="btn" type="button" id="ed-save" style="flex:1">저장</button>
      </div>
    </div>
  `);
  const cancel = document.getElementById('ed-cancel');
  if(cancel) cancel.addEventListener('click', () => closeModal());
  const save = document.getElementById('ed-save');
  if(save) save.addEventListener('click', () => {
    const nameEl = document.getElementById('ed-name');
    const facEl = document.getElementById('ed-fac');
    const nm = String(nameEl ? nameEl.value : '').trim().slice(0, 20);
    const fc = facEl ? facEl.value : null;
    if(nm) S.name = nm;
    const FACTION_BY_ID = window.FACTION_BY_ID || {};
    if(fc && FACTION_BY_ID[fc]) S.faction = fc;
    if(typeof window.saveState === 'function') window.saveState();
    if(typeof window.refreshHeader === 'function') window.refreshHeader();
    closeModal();
    toast('프로필 저장','gold');
    renderClinicHub();
  });
}

// ─── 3. presence 로드 ───────────────────────────────────────────────
async function _loadPresence(){
  const list = $('#hub-pres-list');
  const cnt = $('#hub-pres-count');
  if(!list) return;
  const FB = window.FB;
  if(!FB || !FB.get){
    list.innerHTML = '<span class="hub-presence-empty">서버 연결 없음</span>';
    if(cnt) cnt.textContent = '0';
    return;
  }
  try{
    const data = await FB.get('presence');
    const FRESH = 90 * 1000;
    const now = Date.now();
    const active = [];
    if(data && typeof data === 'object'){
      Object.keys(data).forEach(uid => {
        const p = data[uid];
        if(!p || !p.ts) return;
        if(now - p.ts > FRESH) return;
        active.push({ uid, ...p });
      });
    }
    // v11.6: 최근 활동 우선 (방제학 home 과 동일하게 ts 기준).
    // 본인은 항상 최상단으로 끌어올려 “안 보임”으로 오인되지 않도록.
    const meUid = (typeof S !== 'undefined' && S && S.userId) ? S.userId : '';
    active.sort((a,b) => {
      if(meUid && a.uid === meUid) return -1;
      if(meUid && b.uid === meUid) return  1;
      return (b.ts||0) - (a.ts||0);
    });
    if(cnt) cnt.textContent = String(active.length);
    if(active.length === 0){
      list.innerHTML = '<span class="hub-presence-empty">아무도 없습니다.</span>';
      return;
    }
    const top = active.slice(0, 12);
    list.innerHTML = top.map(p => {
      // v11.6: activity 는 {label, sub, ts} 객체. 방제학 app.js 처리와 동일하게 label 만 표시.
      //        (이전: esc(p.activity) → "[object Object]" 또는 빈 라벨 → 안 보이던 문제 수정)
      const act = (p.activity && typeof p.activity === 'object') ? p.activity : null;
      const actLabel = act && act.label ? String(act.label) : '';
      const actSub   = act && act.sub   ? String(act.sub)   : '';
      const actHtml  = actLabel
        ? `<span class="hub-presence-act" title="${esc(actSub)}">· ${esc(actLabel)}</span>`
        : '';
      const isMe = meUid && p.uid === meUid;
      return `
        <div class="hub-presence-item" ${isMe?'style="background:#FFF2D8;border-color:#C9A227aa"':''}>
          <div class="hub-presence-medal">${_medal(p.character||'qibo', 22)}</div>
          <span class="hub-presence-name">${esc(p.name||'?')}${isMe?' <span style="font-size:9px;color:#9C3030">(나)</span>':''}</span>
          ${actHtml}
        </div>
      `;
    }).join('') + (active.length > 12 ? `<span class="hub-presence-empty">+${active.length-12}</span>` : '');
  }catch(e){
    list.innerHTML = '<span class="hub-presence-empty">불러오기 실패</span>';
  }
}

// ─── 4. 명전 미리보기 ──────────────────────────────────────────────
async function _loadHallPreview(){
  const list = $('#hub-hall-list');
  if(!list) return;
  const FB = window.FB;
  if(!FB || !FB.get){
    list.innerHTML = '<div class="hub-presence-empty">서버 연결 없음</div>';
    return;
  }
  try{
    // presence 데이터에서 qi 순 정렬 (명전 데이터를 받기 어려운 경우 fallback)
    const data = await FB.get('presence');
    if(!data || typeof data !== 'object'){
      list.innerHTML = '<div class="hub-presence-empty">데이터 없음</div>';
      return;
    }
    const all = Object.keys(data).map(uid => ({ uid, ...data[uid] }));
    all.sort((a,b) => (b.qi||0) - (a.qi||0));
    const top = all.slice(0, 5);
    list.innerHTML = top.map((p, i) => `
      <div class="hub-hall-row">
        <span class="hub-hall-rank">${i+1}</span>
        <div class="hub-hall-medal">${_medal(p.character||'qibo', 24)}</div>
        <span class="hub-hall-name">${esc(p.name||'?')}</span>
        <span class="hub-hall-qi"><b>${(p.qi||0).toLocaleString()}</b> 氣</span>
      </div>
    `).join('');
  }catch(e){
    list.innerHTML = '<div class="hub-presence-empty">불러오기 실패</div>';
  }
}

// ─── 5. 건의사항 ───────────────────────────────────────────────────
async function _loadFeedback(){
  const list = $('#hub-fb-list');
  if(!list) return;
  const FB = window.FB;
  if(!FB || !FB.get){
    list.innerHTML = '<div class="hub-presence-empty">서버 연결 없음</div>';
    return;
  }
  try{
    const data = await FB.get('feedback');
    if(!data || typeof data !== 'object'){
      list.innerHTML = '<div class="hub-presence-empty">아직 건의사항이 없습니다.</div>';
      return;
    }
    const items = Object.keys(data).map(k => ({ k, ...data[k] }))
                        .filter(x => x && x.msg)
                        .sort((a,b) => (b.ts||0) - (a.ts||0))
                        .slice(0, 15);
    if(items.length === 0){
      list.innerHTML = '<div class="hub-presence-empty">아직 건의사항이 없습니다.</div>';
      return;
    }
    list.innerHTML = items.map(it => {
      const dt = it.ts ? new Date(it.ts) : null;
      const dtStr = dt ? `${dt.getMonth()+1}/${dt.getDate()} ${('0'+dt.getHours()).slice(-2)}:${('0'+dt.getMinutes()).slice(-2)}` : '';
      return `<div class="hub-fb-item">
        <span class="who">${esc(it.name||'익명')}</span><span class="ts">${esc(dtStr)}</span>
        <div style="margin-top:2px;white-space:pre-wrap">${esc(it.msg)}</div>
      </div>`;
    }).join('');
  }catch(e){
    list.innerHTML = '<div class="hub-presence-empty">불러오기 실패</div>';
  }
}

async function _sendFeedback(){
  const ta = $('#hub-fb-msg');
  if(!ta) return;
  const msg = ta.value.trim();
  if(!msg){ toast('내용을 입력해주세요','warn'); return; }
  const S = window.S || {};
  const FB = window.FB;
  if(!FB || !FB.push){ toast('서버 연결 없음','warn'); return; }
  try{
    await FB.push('feedback', { name: S.name||'익명', msg, ts: Date.now() });
    ta.value = '';
    toast('건의 전송 완료','gold');
    _loadFeedback();
  }catch(e){
    toast('전송 실패','warn');
  }
}

// ─── 6. setTab 래퍼 + 라우팅 ────────────────────────────────────────
function _registerRoutes(){
  if(window.ROUTES){
    window.ROUTES.hub    = renderClinicHub;
    // v11.6.1 FIX: renderDongmuHome 는 jindan 모듈이 더 늦게 로드되므로 fallback 처리.
    //   이 함수가 여러 시점에 재호출되므로 jindan 로드 후 정확한 함수가 잡힘.
    window.ROUTES.dongmu = (window.renderDongmuHome || renderClinicHub);
  }
}
// v11.6.1 FIX: jindan 로드 완료 후 dongmu 라우트 재등록 (초기 _init 시점엔 미정의일 수 있음)
setTimeout(_registerRoutes, 100);
setTimeout(_registerRoutes, 500);
setTimeout(_registerRoutes, 1500);
function _injectGungChip(){
  if(document.getElementById('gung-chip')) return;
  const chips = document.querySelector('.head-chips');
  if(!chips) return;
  const chip = document.createElement('div');
  chip.id = 'gung-chip';
  chip.className = 'head-chip';
  chip.title = '醫書宮 — 8房 입구';
  chip.style.cssText = 'cursor:pointer;font-family:"ZCOOL XiaoWei",serif;font-size:15px;padding:4px 9px;background:linear-gradient(135deg,#C9A227,#A07020);color:#3C1810;border:1px solid #6E4810;font-weight:700;letter-spacing:.05em';
  chip.innerHTML = '宮';
  chip.addEventListener('click', () => { if(typeof window.setTab === 'function') window.setTab('hub'); });
  chips.insertBefore(chip, chips.firstChild);
}

function _wrapSetTab(){
  if(typeof window.setTab !== 'function' || window._v11SetTabWrapped) return;
  const original = window.setTab;
  window._v11SetTabWrapped = true;
  window.setTab = function(name){
    // v11.6.1 FIX: body class 토글은 setHeaderContext (app.js) 가 중앙 관리.
    //   원래 여기서 'on-hub' 만 토글했지만, 이제 on-dongmu/on-saam 도 함께 토글되어야 하므로 위임.
    const ret = original.apply(this, arguments);
    // v11.6: 의서궁 / 다른 과목 진입 시 활동 라벨을 명확히 설정 (방제학 setTab labels 에는 없는 키 보완).
    //        → 의서궁의 同學 목록에 "醫書宮 둘러보는 중" / "東武之房 진단학" 등이 표시됨.
    try{
      if(window.V96Activity){
        const HUB_LABELS = {
          hub:    { label:'醫書宮',     sub:'八房 입구를 둘러보는 중' },
          dongmu: { label:'東武之房',   sub:'진단학 학습 중' },
          jingxue:{ label:'舍巖之房',   sub:'경혈학 학습 중' },
          tongue: { label:'舌診 對位',  sub:'설질·설태 매트릭스' },
        };
        const m = HUB_LABELS[name];
        if(m) window.V96Activity.set(m.label, m.sub);
      }
    }catch(_){}
    // hub/dongmu 라우트 fallback (ROUTES 미등록 시)
    const view = document.getElementById('view');
    if(view){
      if(name === 'hub' && typeof renderClinicHub === 'function'){
        view.innerHTML = '';
        try{ renderClinicHub(); }catch(e){ console.error('hub render fail', e); }
      } else if(name === 'dongmu' && typeof window.renderDongmuHome === 'function'){
        view.innerHTML = '';
        try{ window.renderDongmuHome(); }catch(e){ console.error('dongmu render fail', e); }
      }
    }
    // v11.6: 의서궁 진입 시 본인 presence 즉시 push (label 갱신을 다른 사람도 빨리 보도록)
    if(name === 'hub'){
      try{ if(typeof window.recordPresence === 'function') window.recordPresence(); }catch(_){}
      // 의서궁 화면에 머물 때 同學 목록도 주기적으로 새로고침
      _startHubAutoRefresh();
    } else {
      _stopHubAutoRefresh();
    }
    return ret;
  };
}

// v11.6: 의서궁 화면에 머무는 동안 同學 / 명전 / 피드백 주기 새로고침
let _hubRefreshTimer = null;
function _startHubAutoRefresh(){
  if(_hubRefreshTimer) return;
  _hubRefreshTimer = setInterval(() => {
    if(!document.getElementById('hub-pres-list')){
      _stopHubAutoRefresh();
      return;
    }
    try{ _loadPresence();     }catch(_){}
    try{ _loadHallPreview();  }catch(_){}
  }, 25 * 1000);  // 25초마다 (presence FRESH 90초 의 약 1/3 주기)
}
function _stopHubAutoRefresh(){
  if(_hubRefreshTimer){ clearInterval(_hubRefreshTimer); _hubRefreshTimer = null; }
}

function _forceHubOnFreshSession(){
  if(typeof window.setTab !== 'function'){
    return setTimeout(_forceHubOnFreshSession, 50);
  }
  _registerRoutes();
  _wrapSetTab();
  const KEY = 'v11_session_init';
  if(sessionStorage.getItem(KEY)) return;
  sessionStorage.setItem(KEY, '1');
  const hash = (location.hash||'').toLowerCase().slice(1);
  const direct = ['admin','home','hall','cube','flash','quiz','formula','herb','stats','dongmu'];
  if(direct.includes(hash)) return;
  setTimeout(() => window.setTab('hub'), 150);
}

function _init(){
  _registerRoutes();
  const tryWrap = () => {
    if(typeof window.setTab === 'function') _wrapSetTab();
    else setTimeout(tryWrap, 30);
  };
  tryWrap();
  const startup = () => {
    setTimeout(_injectGungChip, 200);
    setTimeout(_forceHubOnFreshSession, 100);
    setTimeout(_forceHubOnFreshSession, 800);
  };
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', startup);
  } else {
    startup();
  }
}
_init();

window.V11ClinicHub = {
  SUBJECTS, SUBJECT_BY_ID, CHANGELOG_ENTRIES,
  open: renderClinicHub,
  openDongmu: () => { if(typeof window.renderDongmuHome === 'function') window.renderDongmuHome(); },
};

})();



// ─── v12.0: 좌상단 과목 아이콘 헬퍼 (각 房 진입 시 호출) ──────────────────
// 사용: V11Hub.renderSubjectIcon('saamdoin') → string HTML
function _renderSubjectIcon(subjectId, size){
  size = size || 56;
  const sub = SUBJECT_BY_ID[subjectId];
  if(!sub) return '';
  const charId = sub.mascot_id;
  const photo = (window.V12Intro && V12Intro.charPhoto)
    ? V12Intro.charPhoto(charId, size, {allowEgg:false})
    : _medal(charId, size);
  return `
    <div class="v12-subject-icon" data-subject="${subjectId}" title="${esc(sub.room_han)} · ${esc(sub.subject_ko)}">
      ${photo}
      <div class="v12-subject-icon-label han">${esc(sub.subject_han)}</div>
    </div>`;
}
if(!document.getElementById('v12-subject-icon-style')){
  const st = document.createElement('style');
  st.id = 'v12-subject-icon-style';
  st.textContent = `
    .v12-subject-icon{position:fixed;top:12px;left:12px;z-index:50;
      background:rgba(255,248,232,.95);border:1.5px solid #C9A227;border-radius:8px;
      padding:6px;display:flex;flex-direction:column;align-items:center;gap:4px;
      box-shadow:0 2px 6px rgba(0,0,0,.15);pointer-events:none}
    .v12-subject-icon-label{font-family:'ZCOOL XiaoWei',serif;font-size:11px;color:#7C4E10}
    @media (max-width:540px){
      .v12-subject-icon{top:8px;left:8px;padding:4px}
      .v12-subject-icon-label{font-size:9px}
    }
  `;
  document.head.appendChild(st);
}

// v12 hub badges style inject
if(typeof document!=="undefined" && !document.getElementById("v12-hub-badges-style")){
  const _vs=document.createElement("style"); _vs.id="v12-hub-badges-style"; _vs.textContent=`
/* v12.0 — hub home NEW / 最終 배지 */
.hub-tool-btn{position:relative}
.hub-new-badge{position:absolute;top:-6px;right:-6px;background:#C33;color:#fff;
  font-size:10px;padding:2px 6px;border-radius:8px;font-weight:bold;letter-spacing:.5px;
  box-shadow:0 1px 4px rgba(0,0,0,.25)}
.hub-final-badge{position:absolute;top:-6px;left:-6px;background:#7C4E10;color:#FFD89A;
  font-size:10px;padding:2px 6px;border-radius:8px;font-weight:bold;font-family:'ZCOOL XiaoWei',serif;
  box-shadow:0 1px 4px rgba(0,0,0,.25)}
`; document.head.appendChild(_vs); }
