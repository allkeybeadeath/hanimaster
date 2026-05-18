/* bangje-v11-jingxue-race.js — 경혈학 (舍巖之房) 오수혈 레이스 v2.0 (v12.0)
 * v12.0 변경: 公開房 모드 추가 — 모르는 사용자와 매칭 가능
 * ============================================================================
 *  사암지방 첫 모드: 五輸穴 레이스.
 *
 *  설계:
 *    • 15 경맥 (12 정경 + 任脈 + 督脈 + 帶脈) 가 랜덤 순서로 선택.
 *    • 각 경맥마다 그 경맥에서 사용 가능한 카테고리 중 1개를 랜덤 선택.
 *      카테고리: 井·榮·俞·經·合 (오수혈) + 原·絡·郄·募·背兪
 *      - 任·督·帶 은 일부 카테고리만 보유 (絡·募·帶脈穴 등)
 *    • 카드 형태로 「肺經 · 井穴 = ?」 와 같은 문항이 노출 → 4지 선택지에서 정답 클릭.
 *    • 정답 → 초록 플래시 + 진행 + 즉시 다음 경맥. 오답 → 빨강 플래시 + 1.5초 잠금.
 *    • 15경맥 모두 정답하면 완주. 가장 빠른 사람이 승.
 *
 *  싱글 플레이: 사용자 + AI 3봇 (난이도별 평균 응답속도). 시간 기반 점수 + 氣 보상.
 *  멀티 플레이: Firebase `jingxue_rooms/{rid}` 동기화 (방미큐브 패턴 차용).
 *
 *  HUD:
 *    • 상단 — 4 슬롯 각자 캐릭터 메달 + 진행도(0/15) + 진행 바
 *    • 중앙 — 현재 카드 (경맥명 + 카테고리)
 *    • 하단 — 4 지선다 + 정답 플래시
 *
 *  외부 API: window.V11Jingxue = { openHome, openRace, openMulti }
 *  라우트: setTab('saamdoin') · setTab('jingxue')
 * ============================================================================ */

(function(){
'use strict';

function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }

// ════════════════════════════════════════════════════════════════════
// 1. 데이터 — 15 경맥 × 카테고리 × 혈자리
// ════════════════════════════════════════════════════════════════════
//
// 五輸穴 五行歸經:
//   陰經 (LU·HT·PC·SP·LR·KI):  井(木) 榮(火) 俞(土) 經(金) 合(水)
//   陽經 (LI·SI·TE·ST·BL·GB):  井(金) 榮(水) 俞(木) 經(火) 合(土)
//
// 原穴: 陰經 == 俞穴, 陽經 별도
// 絡穴/郄穴/募穴/背兪穴 — 각 경맥 고유
//
// 任·督脈은 自의 絡穴만 (鳩尾·長強), 募穴은 각 장부의 모혈이 任脈 노선상 분포 (재포함 가능).
// 帶脈은 8기경맥 → 「帶脈穴」(GB26) 1혈 대표.

const MERIDIANS = [
  // ─── 手太陰肺經 ───
  { id:'LU', han:'手太陰肺經', ko:'폐경', short:'肺經', yinyang:'yin', color:'#D1B080',
    pts:{ jing:'少商', rong:'魚際', shu:'太淵', king:'經渠', he:'尺澤',
          yuan:'太淵', luo:'列缺', xi:'孔最', mu:'中府', beishu:'肺兪' } },
  // ─── 手陽明大腸經 ───
  { id:'LI', han:'手陽明大腸經', ko:'대장경', short:'大腸經', yinyang:'yang', color:'#D17A30',
    pts:{ jing:'商陽', rong:'二間', shu:'三間', king:'陽谿', he:'曲池',
          yuan:'合谷', luo:'偏歷', xi:'溫溜', mu:'天樞', beishu:'大腸兪' } },
  // ─── 足陽明胃經 ───
  { id:'ST', han:'足陽明胃經', ko:'위경', short:'胃經', yinyang:'yang', color:'#9C3030',
    pts:{ jing:'厲兌', rong:'內庭', shu:'陷谷', king:'解谿', he:'足三里',
          yuan:'衝陽', luo:'豐隆', xi:'梁丘', mu:'中脘', beishu:'胃兪' } },
  // ─── 足太陰脾經 ───
  { id:'SP', han:'足太陰脾經', ko:'비경', short:'脾經', yinyang:'yin', color:'#C9A227',
    pts:{ jing:'隱白', rong:'大都', shu:'太白', king:'商丘', he:'陰陵泉',
          yuan:'太白', luo:'公孫', xi:'地機', mu:'章門', beishu:'脾兪' } },
  // ─── 手少陰心經 ───
  { id:'HT', han:'手少陰心經', ko:'심경', short:'心經', yinyang:'yin', color:'#882020',
    pts:{ jing:'少衝', rong:'少府', shu:'神門', king:'靈道', he:'少海',
          yuan:'神門', luo:'通里', xi:'陰郄', mu:'巨闕', beishu:'心兪' } },
  // ─── 手太陽小腸經 ───
  { id:'SI', han:'手太陽小腸經', ko:'소장경', short:'小腸經', yinyang:'yang', color:'#7A1F1F',
    pts:{ jing:'少澤', rong:'前谷', shu:'後谿', king:'陽谷', he:'小海',
          yuan:'腕骨', luo:'支正', xi:'養老', mu:'關元', beishu:'小腸兪' } },
  // ─── 足太陽膀胱經 ───
  { id:'BL', han:'足太陽膀胱經', ko:'방광경', short:'膀胱經', yinyang:'yang', color:'#214966',
    pts:{ jing:'至陰', rong:'足通谷', shu:'束骨', king:'崑崙', he:'委中',
          yuan:'京骨', luo:'飛揚', xi:'金門', mu:'中極', beishu:'膀胱兪' } },
  // ─── 足少陰腎經 ───
  { id:'KI', han:'足少陰腎經', ko:'신경', short:'腎經', yinyang:'yin', color:'#1B3A55',
    pts:{ jing:'湧泉', rong:'然谷', shu:'太谿', king:'復溜', he:'陰谷',
          yuan:'太谿', luo:'大鍾', xi:'水泉', mu:'京門', beishu:'腎兪' } },
  // ─── 手厥陰心包經 ───
  { id:'PC', han:'手厥陰心包經', ko:'심포경', short:'心包經', yinyang:'yin', color:'#5C3060',
    pts:{ jing:'中衝', rong:'勞宮', shu:'大陵', king:'間使', he:'曲澤',
          yuan:'大陵', luo:'內關', xi:'郄門', mu:'膻中', beishu:'厥陰兪' } },
  // ─── 手少陽三焦經 ───
  { id:'TE', han:'手少陽三焦經', ko:'삼초경', short:'三焦經', yinyang:'yang', color:'#4A4A4A',
    pts:{ jing:'關衝', rong:'液門', shu:'中渚', king:'支溝', he:'天井',
          yuan:'陽池', luo:'外關', xi:'會宗', mu:'石門', beishu:'三焦兪' } },
  // ─── 足少陽膽經 ───
  { id:'GB', han:'足少陽膽經', ko:'담경', short:'膽經', yinyang:'yang', color:'#6B4FA8',
    pts:{ jing:'足竅陰', rong:'俠谿', shu:'足臨泣', king:'陽輔', he:'陽陵泉',
          yuan:'丘墟', luo:'光明', xi:'外丘', mu:'日月', beishu:'膽兪' } },
  // ─── 足厥陰肝經 ───
  { id:'LR', han:'足厥陰肝經', ko:'간경', short:'肝經', yinyang:'yin', color:'#2E5E3D',
    pts:{ jing:'大敦', rong:'行間', shu:'太衝', king:'中封', he:'曲泉',
          yuan:'太衝', luo:'蠡溝', xi:'中都', mu:'期門', beishu:'肝兪' } },
  // ─── 任脈 (奇經) — 自의 絡穴만 보유. 募穴은 各臟腑가 任脈상에 있어 학습용으로 포함 ───
  { id:'CV', han:'任脈', ko:'임맥', short:'任脈', yinyang:'extra', color:'#C8923A',
    pts:{ luo:'鳩尾', mu_xin:'巨闕', mu_xb:'膻中', mu_wei:'中脘', mu_xc:'關元', mu_sj:'石門', mu_pg:'中極' } },
  // ─── 督脈 (奇經) — 自의 絡穴 長強 ───
  { id:'GV', han:'督脈', ko:'독맥', short:'督脈', yinyang:'extra', color:'#3A2D14',
    pts:{ luo:'長強' } },
  // ─── 帶脈 (奇經) — 8기경맥의 하나. 帶脈穴(GB26) 대표 ───
  { id:'DM', han:'帶脈', ko:'대맥', short:'帶脈', yinyang:'extra', color:'#7A5C40',
    pts:{ daimai:'帶脈' } },
];

const MERIDIAN_BY_ID = {}; MERIDIANS.forEach(m => MERIDIAN_BY_ID[m.id] = m);

// 카테고리 라벨 — Race 카드에 표시될 한자명/한글명
const CATS = {
  jing:    { han:'井', ko:'정혈', desc:'井 (起點)' },
  rong:    { han:'榮', ko:'형혈', desc:'榮 (溜)' },
  shu:     { han:'俞', ko:'수혈', desc:'俞 (注)' },
  king:    { han:'經', ko:'경혈', desc:'經 (行)' },
  he:      { han:'合', ko:'합혈', desc:'合 (入)' },
  yuan:    { han:'原', ko:'원혈', desc:'原' },
  luo:     { han:'絡', ko:'락혈', desc:'絡' },
  xi:      { han:'郄', ko:'극혈', desc:'郄' },
  mu:      { han:'募', ko:'모혈', desc:'募 (前)' },
  beishu:  { han:'背兪', ko:'배수혈', desc:'背兪 (後)' },
  // 任脈 募 분기 (각 臟腑별 별도 모혈)
  mu_xin:  { han:'心 募', ko:'심 모혈', desc:'任脈 위 · 心의 募' },
  mu_xb:   { han:'心包 募', ko:'심포 모혈', desc:'任脈 위 · 心包의 募' },
  mu_wei:  { han:'胃 募', ko:'위 모혈', desc:'任脈 위 · 胃의 募' },
  mu_xc:   { han:'小腸 募', ko:'소장 모혈', desc:'任脈 위 · 小腸의 募' },
  mu_sj:   { han:'三焦 募', ko:'삼초 모혈', desc:'任脈 위 · 三焦의 募' },
  mu_pg:   { han:'膀胱 募', ko:'방광 모혈', desc:'任脈 위 · 膀胱의 募' },
  daimai:  { han:'帶脈', ko:'대맥혈', desc:'帶脈穴 (8 奇經)' },
};

// 모든 혈자리 한자명 풀 (오답 후보용)
function _allPointNames(){
  const set = new Set();
  MERIDIANS.forEach(m => Object.values(m.pts).forEach(p => set.add(p)));
  return Array.from(set);
}
const ALL_POINTS = _allPointNames();

// ════════════════════════════════════════════════════════════════════
// 2. 카드 빌더
// ════════════════════════════════════════════════════════════════════
function buildCard(meridian){
  const cats = Object.keys(meridian.pts);
  const catKey = cats[Math.floor(Math.random() * cats.length)];
  const correct = meridian.pts[catKey];
  // 오답 3개 — ALL_POINTS 에서 correct 제외 후 무작위
  const pool = ALL_POINTS.filter(p => p !== correct);
  const distr = [];
  while(distr.length < 3 && pool.length > 0){
    const i = Math.floor(Math.random() * pool.length);
    distr.push(pool.splice(i, 1)[0]);
  }
  const opts = [correct, ...distr];
  for(let i = opts.length-1; i > 0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return { mid: meridian.id, catKey, correct, opts };
}

// ════════════════════════════════════════════════════════════════════
// 3. AI 봇 (싱글 플레이) — 평균 응답시간 + 정확도 모델
// ════════════════════════════════════════════════════════════════════
const BOT_PROFILES = [
  // name·avatar·avgMs·sigmaMs·accuracy (정답률) — 본과 학습 수준 분포
  { id:'bot1', name:'許浚 弟子', mascot:'huangboon',  avgMs: 1900, sigmaMs: 700, acc: 0.86, color:'#7A3030' },
  { id:'bot2', name:'李濟馬 弟子', mascot:'leejema',  avgMs: 2400, sigmaMs: 900, acc: 0.78, color:'#9C3030' },
  { id:'bot3', name:'舍巖 弟子',   mascot:'saamdoin', avgMs: 1500, sigmaMs: 500, acc: 0.92, color:'#3A6A4A' },
];

// gaussian via Box-Muller
function _gauss(mu, sigma){
  const u1 = Math.max(1e-9, Math.random());
  const u2 = Math.random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ════════════════════════════════════════════════════════════════════
// 4. 사암지방 홈
// ════════════════════════════════════════════════════════════════════
function _medal(charId, size){
  if(typeof window._charPhotoMedallion === 'function') return window._charPhotoMedallion(charId, size);
  if(typeof window._charMedallion === 'function')      return window._charMedallion(charId, size);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#3A6A4A;display:flex;align-items:center;justify-content:center;font-family:'ZCOOL XiaoWei',serif;font-size:${Math.round(size*0.4)}px;color:#FFE08A">舍</div>`;
}

function _baseStyles(){
  return `<style>
    .sx-banner { background:linear-gradient(135deg,#3A6A4A,#1F3F2C); color:#E0F0D8; padding:14px; border-radius:10px; margin-bottom:12px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(20,40,28,.28); }
    .sx-banner-medal { width:60px; height:60px; border-radius:50%; overflow:hidden; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,.3); }
    .sx-banner-medal .cmedal, .sx-banner-medal img { width:100%; height:100%; }
    .sx-banner-title { font-family:'ZCOOL XiaoWei',serif; font-size:22px; letter-spacing:.05em; }
    .sx-banner-sub { font-size:11.5px; opacity:.9; margin-top:1px; letter-spacing:.04em; }
    .sx-back { background:transparent; border:1px solid #E0F0D8; color:#E0F0D8; padding:4px 9px; border-radius:6px; font-size:11px; cursor:pointer; margin-left:auto; }
    .sx-back:hover { background:rgba(224,240,216,.12); }
    .sx-modes { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
    .sx-mode-btn { background:#fff; border:1px solid #3A6A4A55; padding:14px 10px; border-radius:9px; text-align:center; cursor:pointer; font-family:inherit; color:var(--mo); transition:all .15s ease; }
    .sx-mode-btn:hover { background:#E8F0E0; border-color:#3A6A4A; transform:translateY(-1px); }
    .sx-mode-han { font-family:'Noto Serif SC',serif; font-size:16px; color:#1F3F2C; font-weight:700; }
    .sx-mode-ko { font-size:11.5px; color:var(--mo-l); margin-top:3px; }
    .sx-mode-btn.primary { background:linear-gradient(135deg,#FFF8E0,#E8DCB8); border-color:#C9A227; grid-column:1 / -1; padding:18px; }
    .sx-mode-btn.primary .sx-mode-han { color:#7C1818; font-size:20px; }
    .sx-info { background:#FAF5EC; border:1px solid #C9A22744; border-radius:9px; padding:11px 12px; font-size:11.5px; color:var(--mo); line-height:1.7; }
    .sx-info b.han { font-family:'Noto Serif SC',serif; font-weight:700; }

    /* 레이스 화면 */
    .sx-race-frame { display:flex; flex-direction:column; gap:9px; }
    .sx-hud { background:linear-gradient(135deg,#1F3F2C,#3A6A4A); padding:10px 11px; border-radius:9px; box-shadow:0 4px 12px rgba(20,40,28,.3); color:#E0F0D8; }
    .sx-hud-row { display:flex; gap:10px; align-items:center; }
    .sx-hud-title { font-family:'ZCOOL XiaoWei',serif; font-size:15px; letter-spacing:.05em; flex:1; }
    .sx-hud-meta { font-size:11px; opacity:.85; }
    .sx-hud-quit { background:transparent; border:1px solid #E0F0D8; color:#E0F0D8; padding:3px 8px; border-radius:5px; font-size:10.5px; cursor:pointer; }
    .sx-hud-quit:hover { background:rgba(224,240,216,.15); }
    .sx-players { display:grid; gap:5px; margin-top:8px; }
    .sx-pl-row { display:flex; align-items:center; gap:7px; padding:5px 6px; border-radius:6px; background:rgba(255,255,255,.07); }
    .sx-pl-row.is-me { background:rgba(255,224,138,.18); }
    .sx-pl-row.is-winner { background:linear-gradient(90deg,rgba(201,162,39,.5),rgba(201,162,39,.15)); }
    .sx-pl-medal { width:30px; height:30px; border-radius:50%; overflow:hidden; flex-shrink:0; box-shadow:0 1px 3px rgba(0,0,0,.3); }
    .sx-pl-medal .cmedal, .sx-pl-medal img { width:100%; height:100%; }
    .sx-pl-info { flex:1; min-width:0; }
    .sx-pl-name { font-size:11px; color:#FFE08A; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sx-pl-bar-wrap { background:rgba(0,0,0,.3); height:6px; border-radius:3px; overflow:hidden; margin-top:2px; }
    .sx-pl-bar { height:100%; background:linear-gradient(90deg,#C9A227,#FFE08A); transition:width .4s ease; }
    .sx-pl-row.is-me .sx-pl-bar { background:linear-gradient(90deg,#FFE08A,#FFF4C0); }
    .sx-pl-prog { font-family:'Noto Serif SC',serif; font-size:11px; min-width:38px; text-align:right; color:#FFE08A; }
    .sx-pl-row.is-bot .sx-pl-name { color:#D0E0C8; }
    .sx-pl-row.is-bot .sx-pl-prog { color:#D0E0C8; }

    /* 카드 */
    .sx-card { background:#FAF5EC; border:2px solid #3A6A4A; border-radius:11px; padding:16px 12px; text-align:center; box-shadow:0 4px 14px rgba(20,40,28,.18); transition:background .25s ease, border-color .25s ease, transform .15s ease; }
    .sx-card.correct { background:#D8F0CC; border-color:#2A7060; animation: sxFlashG .4s ease; }
    .sx-card.wrong   { background:#F8D0C8; border-color:#9C3030; animation: sxFlashR .4s ease; }
    @keyframes sxFlashG { 0%{transform:scale(1)} 50%{transform:scale(1.04)} 100%{transform:scale(1)} }
    @keyframes sxFlashR { 0%{transform:translateX(0)} 25%{transform:translateX(-6px)} 50%{transform:translateX(6px)} 75%{transform:translateX(-3px)} 100%{transform:translateX(0)} }
    .sx-card-mer { font-family:'Noto Serif SC',serif; font-size:24px; color:#1F3F2C; font-weight:700; letter-spacing:.03em; }
    .sx-card-mer-ko { font-size:11.5px; color:var(--mo-l); margin-top:2px; }
    .sx-card-dot { display:flex; align-items:center; justify-content:center; gap:7px; margin-top:11px; }
    .sx-card-cat { display:inline-block; font-family:'Noto Serif SC',serif; font-size:38px; color:#9C3030; font-weight:900; line-height:1; padding:3px 14px; border-bottom:3px solid #C9A227; }
    .sx-card-cat-ko { font-size:11px; color:var(--mo-l); margin-top:8px; letter-spacing:.05em; }
    .sx-card-q { font-family:'Noto Serif SC',serif; font-size:14px; color:#3A2014; margin-top:10px; }
    .sx-card-q .han { color:#7C1818; }

    /* 선택지 */
    .sx-opts { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:11px; }
    .sx-opt { background:#fff; border:1.5px solid #3A6A4A55; border-radius:8px; padding:13px 7px; font-family:inherit; cursor:pointer; transition:all .15s ease; text-align:center; color:var(--mo); }
    .sx-opt:hover { background:#F0F5E8; border-color:#3A6A4A; transform:translateY(-1px); }
    .sx-opt:disabled { cursor:default; opacity:.72; }
    .sx-opt .han { font-family:'Noto Serif SC',serif; font-size:19px; font-weight:700; }
    .sx-opt.correct { background:#B8E5A0; border-color:#2A7060; color:#1A4020; animation: sxOptOk .35s ease; }
    .sx-opt.wrong   { background:#F0BBAA; border-color:#9C3030; color:#5A1818; animation: sxOptNg .35s ease; }
    @keyframes sxOptOk { 0%{transform:scale(1)} 50%{transform:scale(1.07)} 100%{transform:scale(1)} }
    @keyframes sxOptNg { 0%{transform:translateX(0)} 50%{transform:translateX(-4px)} 100%{transform:translateX(0)} }

    /* 카운트다운 */
    .sx-countdown { position:fixed; left:0; right:0; top:38%; text-align:center; font-family:'ZCOOL XiaoWei',serif; font-size:120px; color:#9C3030; text-shadow:0 4px 12px rgba(0,0,0,.4); pointer-events:none; z-index:9000; animation: sxCount 1s ease forwards; }
    @keyframes sxCount { 0%{transform:scale(.4);opacity:0} 25%{transform:scale(1.1);opacity:1} 80%{transform:scale(1);opacity:.9} 100%{transform:scale(1.4);opacity:0} }

    /* 결과 */
    .sx-result { background:linear-gradient(135deg,#FFF8E0,#E8DCB8); border:2px solid #C9A227; border-radius:11px; padding:18px 13px; text-align:center; margin:14px 0; }
    .sx-result .place { font-family:'ZCOOL XiaoWei',serif; font-size:52px; color:#7C1818; line-height:1; }
    .sx-result .meta { font-size:12px; color:var(--mo); margin-top:6px; }
    .sx-result .reward { display:inline-block; margin-top:9px; padding:6px 14px; background:#9C3030; color:#FFE08A; border-radius:18px; font-family:'Noto Serif SC',serif; font-size:14px; }
    .sx-final-list { background:#FAF5EC; border:1px solid #C9A22744; border-radius:9px; padding:10px 12px; font-size:12px; margin-top:8px; }
    .sx-final-row { display:flex; align-items:center; gap:8px; padding:4px 0; border-bottom:1px dashed #C9A22744; }
    .sx-final-row:last-child { border-bottom:0; }
    .sx-final-row .pn { flex:1; }
    .sx-final-row .pt { font-family:'Noto Serif SC',serif; color:#7C1818; }

    /* 액션 */
    .sx-actions { display:flex; gap:6px; margin-top:11px; }
    .sx-actions .btn { flex:1; }
  </style>`;
}

function _bannerHTML(){
  const examPanel = '';  // 의서궁에서 통합 — 여기는 banner 만
  return `
    <div class="sx-banner">
      <div class="sx-banner-medal">${_medal('saamdoin', 60)}</div>
      <div style="flex:1">
        <div class="sx-banner-title">舍巖之房</div>
        <div class="sx-banner-sub">經穴學 · 경혈학 · 舍巖道人 主</div>
      </div>
      <button class="sx-back" type="button" id="sx-back">← 醫書宮</button>
    </div>
  `;
}
function _attachBanner(){
  const b = $('#sx-back');
  if(b) b.addEventListener('click', () => { if(typeof window.setTab === 'function') window.setTab('hub'); });
}

function renderSaamdoinHome(){
  const view = document.getElementById('view');
  if(!view) return;
  // v11.6: 헤더 컨텍스트 전환
  try{ if(typeof window.setHeaderContext === 'function') window.setHeaderContext('saamdoin'); }catch(_){}
  // v11.6: 활동 라벨 (의서궁 同學 표시용)
  try{
    if(window.V96Activity) window.V96Activity.set('舍巖之房', '경혈학 학습 중');
    if(typeof window.recordPresence === 'function') window.recordPresence();
  }catch(_){}
  view.innerHTML = _baseStyles() + _bannerHTML() + `
    <div class="sx-modes">
      <button class="sx-mode-btn primary" type="button" data-mode="solo">
        <div class="sx-mode-han">五輸穴 레이스 · 修行</div>
        <div class="sx-mode-ko">싱글 · 15 경맥 完走 · 對 AI 3봇</div>
      </button>
      <button class="sx-mode-btn" type="button" data-mode="multi">
        <div class="sx-mode-han">對決</div>
        <div class="sx-mode-ko">2~4인 멀티</div>
      </button>
      <button class="sx-mode-btn" type="button" data-mode="learn">
        <div class="sx-mode-han">習穴</div>
        <div class="sx-mode-ko">五輸穴 도표</div>
      </button>
    </div>
    <div class="sx-info">
      <div style="font-family:'Noto Serif SC',serif;font-size:13px;color:#1F3F2C;margin-bottom:5px"><b>學習 안내</b></div>
      <div><b class="han">15 經脈</b> · 十二正經 + 任脈·督脈·帶脈 이 무작위 순서로 등장</div>
      <div><b class="han">10 範疇</b> · 五輸穴 (井·榮·俞·經·合) + 原·絡·郄·募·背兪</div>
      <div>각 經脈마다 무작위 범주의 혈자리 카드가 나오면 <b style="color:#2A7060">4지선다</b> 로 정답 클릭</div>
      <div><b style="color:#C9A227">氣 보상</b> · 1등 +120氣 / 2등 +60 / 3등 +30 / 完走 +15 · 完美 +50氣</div>
      <div style="margin-top:6px;color:var(--mo-l);font-size:10.5px">정답 → 초록 · 오답 → 빨강 + 1.5초 잠금. 가장 빠른 사람이 승.</div>
    </div>
  `;
  _attachBanner();
  $$('.sx-mode-btn').forEach(b => {
    b.addEventListener('click', () => {
      const m = b.dataset.mode;
      if(m === 'solo')       openRaceSolo();
      else if(m === 'multi') openMulti();
      else if(m === 'learn') openLearn();
    });
  });
}
window.renderSaamdoinHome = renderSaamdoinHome;

// ════════════════════════════════════════════════════════════════════
// 5. 싱글 레이스 — 사용자 + AI 3봇
// ════════════════════════════════════════════════════════════════════

let RACE = null;  // 현재 진행 중 레이스 상태

function _newRace(mode){
  // 15 경맥 무작위 순서
  const seq = MERIDIANS.slice();
  for(let i = seq.length-1; i > 0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [seq[i], seq[j]] = [seq[j], seq[i]];
  }
  // 각 경맥에 대해 카드를 사전 생성 — 모든 플레이어가 같은 카드를 풀어야 공정
  const cards = seq.map(m => ({ meridian: m, card: buildCard(m) }));
  // 플레이어 슬롯
  const S = window.S || {};
  const me = {
    id: 'me', isMe: true, isBot: false,
    name: S.name || '我',
    mascot: S.character || 'shennong',
    idx: 0, finished: false, finishAt: 0, correctCount: 0, wrongCount: 0,
    color: '#C9A227',
  };
  const bots = (mode === 'solo') ? BOT_PROFILES.map(b => ({
    id: b.id, isMe: false, isBot: true,
    name: b.name, mascot: b.mascot,
    idx: 0, finished: false, finishAt: 0, correctCount: 0, wrongCount: 0,
    avgMs: b.avgMs, sigmaMs: b.sigmaMs, acc: b.acc,
    nextTickAt: 0,  // 다음 봇 액션 시점
    color: b.color,
  })) : [];
  return {
    mode,                   // 'solo' | 'multi'
    cards,                  // [{meridian, card}, ...] · length 15
    players: [me, ...bots], // me 가 항상 0번
    startedAt: 0,
    finishedRanks: [],      // [{playerId, finishedAt}, ...]
    locked: false,          // 오답시 1.5초 잠금
    lockUntil: 0,
    answered: false,
    countingDown: true,
  };
}

function openRaceSolo(){
  try{ if(window.V96Activity) window.V96Activity.set('五輸穴 레이스', '15 經脈 完走 · 對 AI 3봇'); }catch(_){}
  RACE = _newRace('solo'); _renderRace(); _startCountdown();
}

function _startCountdown(){
  // 「3 · 2 · 1 · 出發!」
  const seq = ['3','2','1','出發!'];
  let i = 0;
  const tick = () => {
    if(!RACE) return;
    const view = document.getElementById('view');
    if(!view) return;
    // 기존 countdown 제거
    const old = document.getElementById('sx-cd'); if(old) old.remove();
    if(i >= seq.length){
      RACE.countingDown = false;
      RACE.startedAt = Date.now();
      // 봇 첫 액션 예약
      RACE.players.forEach(p => {
        if(p.isBot) p.nextTickAt = Date.now() + Math.max(400, _gauss(p.avgMs, p.sigmaMs));
      });
      _renderRace();
      _scheduleBotLoop();
      return;
    }
    const el = document.createElement('div');
    el.id = 'sx-cd';
    el.className = 'sx-countdown';
    el.textContent = seq[i];
    document.body.appendChild(el);
    // 카운트다운 사운드 — bgm drum
    try{ if(window.bgm && window.bgm.sfxHerbPlace) window.bgm.sfxHerbPlace(); }catch(_){}
    setTimeout(() => el.remove(), 900);
    i++;
    setTimeout(tick, 1000);
  };
  tick();
}

function _renderRace(){
  if(!RACE) return;
  const view = document.getElementById('view');
  if(!view) return;
  // 헤더 컨텍스트 유지
  try{ if(typeof window.setHeaderContext === 'function') window.setHeaderContext('saamdoin'); }catch(_){}
  const me = RACE.players.find(p => p.isMe);
  if(!me) return;
  const cur = (me.idx < RACE.cards.length) ? RACE.cards[me.idx] : null;
  const N = RACE.cards.length;
  // 진행도 HUD
  const playersHTML = RACE.players.map(p => {
    const pct = (p.idx / N) * 100;
    const cls = `sx-pl-row${p.isMe?' is-me':''}${p.isBot?' is-bot':''}${(RACE.finishedRanks[0] && RACE.finishedRanks[0].playerId === p.id)?' is-winner':''}`;
    const rank = RACE.finishedRanks.findIndex(r => r.playerId === p.id);
    const rankBadge = (rank >= 0) ? `<span style="color:#FFE08A;font-family:Noto Serif SC,serif;font-size:14px;font-weight:700">${['①','②','③','④'][rank]||'·'}</span>` : '';
    return `
      <div class="${cls}" data-pid="${esc(p.id)}">
        <div class="sx-pl-medal">${_medal(p.mascot, 30)}</div>
        <div class="sx-pl-info">
          <div class="sx-pl-name">${esc(p.name)} ${rankBadge}</div>
          <div class="sx-pl-bar-wrap"><div class="sx-pl-bar" style="width:${pct.toFixed(1)}%"></div></div>
        </div>
        <div class="sx-pl-prog">${p.idx}/${N}</div>
      </div>`;
  }).join('');

  // 중앙 카드
  let cardHTML;
  if(me.finished){
    cardHTML = `<div class="sx-card"><div class="sx-card-mer">完走</div><div class="sx-card-mer-ko">기다리는 중…</div></div>`;
  } else if(cur){
    const m = cur.meridian;
    const c = cur.card;
    const cat = CATS[c.catKey];
    cardHTML = `
      <div class="sx-card" id="sx-card">
        <div class="sx-card-mer">${esc(m.short)}</div>
        <div class="sx-card-mer-ko">${esc(m.han)} · ${esc(m.ko)}</div>
        <div class="sx-card-dot">
          <span class="sx-card-cat">${esc(cat.han)}</span>
        </div>
        <div class="sx-card-cat-ko">${esc(cat.ko)} · ${esc(cat.desc)}</div>
        <div class="sx-card-q">이 經脈의 <span class="han">${esc(cat.han)}</span> 혈자리는?</div>
      </div>
      <div class="sx-opts" id="sx-opts">
        ${c.opts.map((p, i) => `<button class="sx-opt" type="button" data-opt="${esc(p)}" data-idx="${i}"><span class="han">${esc(p)}</span></button>`).join('')}
      </div>
    `;
  } else {
    cardHTML = `<div class="sx-card"><div class="sx-card-mer">…</div></div>`;
  }

  view.innerHTML = _baseStyles() + `
    <div class="sx-race-frame">
      <div class="sx-hud">
        <div class="sx-hud-row">
          <span class="sx-hud-title">五輸穴 레이스</span>
          <span class="sx-hud-meta">${me.idx}/${N} · ✓${me.correctCount} ✗${me.wrongCount}</span>
          <button class="sx-hud-quit" type="button" id="sx-quit">← 棄權</button>
        </div>
        <div class="sx-players">${playersHTML}</div>
      </div>
      ${cardHTML}
    </div>
  `;
  // 이벤트 바인딩
  const q = $('#sx-quit');
  if(q) q.addEventListener('click', _quitRace);
  $$('.sx-opt').forEach(b => b.addEventListener('click', () => _onMyAnswer(b.dataset.opt, b)));
}

function _onMyAnswer(chosen, btnEl){
  if(!RACE || RACE.countingDown) return;
  const me = RACE.players.find(p => p.isMe);
  if(!me || me.finished) return;
  if(RACE.locked && Date.now() < RACE.lockUntil) return;
  if(RACE.answered) return;
  const cur = RACE.cards[me.idx];
  if(!cur) return;
  const ok = (chosen === cur.card.correct);
  // 시각 피드백
  $$('.sx-opt').forEach(b => {
    b.disabled = true;
    if(b.dataset.opt === cur.card.correct) b.classList.add('correct');
    else if(b.dataset.opt === chosen && !ok) b.classList.add('wrong');
  });
  const card = $('#sx-card');
  if(card) card.classList.add(ok ? 'correct' : 'wrong');
  // SFX
  try{
    if(window.bgm){
      if(ok && window.bgm.sfxCorrect) window.bgm.sfxCorrect();
      else if(!ok && window.bgm.sfxWrong) window.bgm.sfxWrong();
    }
  }catch(_){}
  if(ok){
    me.correctCount++;
    me.idx++;
    if(me.idx >= RACE.cards.length){
      _onPlayerFinish(me);
      setTimeout(_renderRace, 350);
      return;
    }
    // 짧게 다음 카드로
    RACE.answered = true;
    setTimeout(() => {
      RACE.answered = false;
      _renderRace();
    }, 420);
  } else {
    me.wrongCount++;
    RACE.locked = true;
    RACE.lockUntil = Date.now() + 1500;
    RACE.answered = true;
    setTimeout(() => {
      RACE.locked = false;
      RACE.answered = false;
      // 같은 카드 다시 — 오답 시 강제 정답 보이기 후 다음 카드로 (학습 효과)
      me.idx++;
      if(me.idx >= RACE.cards.length){
        _onPlayerFinish(me);
      }
      _renderRace();
    }, 1500);
  }
}

function _onPlayerFinish(player){
  if(player.finished) return;
  player.finished = true;
  player.finishAt = Date.now();
  RACE.finishedRanks.push({ playerId: player.id, finishedAt: player.finishAt });
  // 모두 완주했으면 결과
  if(RACE.players.every(p => p.finished)){
    setTimeout(_renderRaceResult, 600);
  }
}

// 봇 시뮬레이션 — 100ms tick
let _botLoopHandle = null;
function _scheduleBotLoop(){
  if(_botLoopHandle) clearInterval(_botLoopHandle);
  _botLoopHandle = setInterval(_botTick, 120);
}
function _stopBotLoop(){
  if(_botLoopHandle){ clearInterval(_botLoopHandle); _botLoopHandle = null; }
}
function _botTick(){
  if(!RACE || RACE.countingDown) return;
  // v11.6: 사용자가 외부 탭으로 이탈한 경우 — 레이스 frame 이 DOM 에 없으면 정리.
  if(!document.querySelector('.sx-race-frame') && !document.querySelector('.sx-result')){
    _stopBotLoop();
    RACE = null;
    return;
  }
  const now = Date.now();
  let changed = false;
  for(const p of RACE.players){
    if(!p.isBot || p.finished) continue;
    if(now < p.nextTickAt) continue;
    // 봇 행동: acc 확률로 정답, 아니면 오답
    const cur = RACE.cards[p.idx];
    if(!cur){ p.finished = true; continue; }
    const ok = Math.random() < p.acc;
    if(ok){
      p.correctCount++;
      p.idx++;
      if(p.idx >= RACE.cards.length){
        _onPlayerFinish(p);
      } else {
        p.nextTickAt = now + Math.max(400, _gauss(p.avgMs, p.sigmaMs));
      }
    } else {
      p.wrongCount++;
      // 봇도 1.5초 잠금 후 다음 카드 (정답으로 처리하지 않고 같은 카드 다음 시도)
      // 학습 결과 시각화를 위해 봇도 오답시 같은 idx 유지 후 재도전.
      p.nextTickAt = now + 1500 + Math.max(200, _gauss(p.avgMs * 0.5, p.sigmaMs * 0.5));
    }
    changed = true;
  }
  if(changed){
    // HUD만 다시 그리기 (전체 re-render 비용 절약을 위해 진행도 row 만 patch)
    _patchHud();
    if(RACE.players.every(p => p.finished)){
      _stopBotLoop();
      setTimeout(_renderRaceResult, 600);
    }
  }
}
function _patchHud(){
  if(!RACE) return;
  const N = RACE.cards.length;
  RACE.players.forEach(p => {
    const row = document.querySelector(`.sx-pl-row[data-pid="${p.id}"]`);
    if(!row) return;
    const bar = row.querySelector('.sx-pl-bar');
    const prog = row.querySelector('.sx-pl-prog');
    if(bar) bar.style.width = `${(p.idx / N) * 100}%`;
    if(prog) prog.textContent = `${p.idx}/${N}`;
    // 순위 업데이트
    const rank = RACE.finishedRanks.findIndex(r => r.playerId === p.id);
    if(rank >= 0){
      const nameEl = row.querySelector('.sx-pl-name');
      if(nameEl && !nameEl.innerHTML.includes('font-family:Noto Serif SC')){
        nameEl.insertAdjacentHTML('beforeend', ` <span style="color:#FFE08A;font-family:Noto Serif SC,serif;font-size:14px;font-weight:700">${['①','②','③','④'][rank]||'·'}</span>`);
      }
    }
  });
}

function _renderRaceResult(){
  _stopBotLoop();
  if(!RACE) return;
  const view = document.getElementById('view');
  if(!view) return;
  const me = RACE.players.find(p => p.isMe);
  const N = RACE.cards.length;
  const myRank = RACE.finishedRanks.findIndex(r => r.playerId === 'me') + 1;
  const ranks = RACE.finishedRanks.map(r => RACE.players.find(p => p.id === r.playerId)).filter(Boolean);
  const dur = Math.round((me.finishAt - RACE.startedAt) / 1000);
  // 氣 보상
  const REWARDS_BY_RANK = [120, 60, 30, 15];  // 1~4위
  let qiBase = (myRank >= 1 && myRank <= 4) ? REWARDS_BY_RANK[myRank-1] : 10;
  // 완주 +15, 完美(wrongCount===0) +50
  let qiBonus = 15;
  let bonusLabels = ['完走 +15'];
  if(me.wrongCount === 0){ qiBonus += 50; bonusLabels.push('完美 +50'); }
  // 시간 보너스: 완주 60초 이내 +30, 90초 이내 +15
  if(dur <= 60){ qiBonus += 30; bonusLabels.push('神速 +30'); }
  else if(dur <= 90){ qiBonus += 15; bonusLabels.push('迅 +15'); }
  const totalQi = qiBase + qiBonus;
  try{
    const S = window.S;
    if(S){
      S.qi = (S.qi || 0) + totalQi;
      if(typeof window.saveState === 'function') window.saveState();
      if(typeof window.refreshHeader === 'function') window.refreshHeader();
    }
  }catch(_){}
  // 학습 통계 저장
  _saveRaceStat({ rank: myRank, correct: me.correctCount, wrong: me.wrongCount, dur, qi: totalQi, mode: RACE.mode });
  // 1위 chime
  try{
    if(myRank === 1 && window.bgm){
      if(window.bgm.sfxFormulaComplete) window.bgm.sfxFormulaComplete();
    }
  }catch(_){}

  const placeStr = ['①','②','③','④'][myRank-1] || `${myRank}`;
  const placeText = myRank === 1 ? '一等' : myRank === 2 ? '二等' : myRank === 3 ? '三等' : '四等';

  view.innerHTML = _baseStyles() + _bannerHTML() + `
    <div class="sx-result">
      <div class="place">${placeStr} <span style="font-size:24px">${placeText}</span></div>
      <div class="meta">${me.correctCount} 正 · ${me.wrongCount} 誤 · 소요 ${dur}초</div>
      <div class="reward">+${totalQi} 氣 (${qiBase} 順位 · ${qiBonus} 보너스)</div>
      <div style="font-size:11px;color:var(--mo-l);margin-top:6px">${bonusLabels.join(' · ')}</div>
    </div>
    <div class="sx-final-list">
      ${ranks.map((p, i) => `
        <div class="sx-final-row">
          <div class="sx-pl-medal">${_medal(p.mascot, 26)}</div>
          <span class="pn">${esc(p.name)}${p.isMe?' <b style="color:#C9A227">(我)</b>':''}</span>
          <span class="pt">${['①','②','③','④'][i]||'·'} · ${p.correctCount}正 ${p.wrongCount}誤</span>
        </div>
      `).join('')}
    </div>
    <div class="sx-actions">
      <button class="btn" type="button" id="sx-again">↻ 다시 修行</button>
      <button class="btn btn-o" type="button" id="sx-home">舍巖之房</button>
    </div>
  `;
  _attachBanner();
  $('#sx-again').addEventListener('click', () => { RACE = null; openRaceSolo(); });
  $('#sx-home').addEventListener('click', () => { RACE = null; renderSaamdoinHome(); });
}

function _quitRace(){
  if(!confirm('레이스를 중단할까요? 氣 보상은 받을 수 없습니다.')) return;
  _stopBotLoop();
  RACE = null;
  renderSaamdoinHome();
}

// ════════════════════════════════════════════════════════════════════
// 6. 학습 통계 저장
// ════════════════════════════════════════════════════════════════════
const RACE_STATS_KEY = 'bangje.jingxue.race.v1';
function _loadRaceStats(){
  try{ const raw = localStorage.getItem(RACE_STATS_KEY); if(raw) return JSON.parse(raw); }catch(_){}
  return { runs: [], best: { dur: Infinity, rank: 4, correct: 0 } };
}
function _saveRaceStat(stat){
  try{
    const all = _loadRaceStats();
    all.runs.push({ ...stat, ts: Date.now() });
    if(all.runs.length > 50) all.runs = all.runs.slice(-50);
    if(stat.rank === 1 && stat.dur < (all.best.dur || Infinity)){
      all.best = { dur: stat.dur, rank: stat.rank, correct: stat.correct, ts: Date.now() };
    }
    localStorage.setItem(RACE_STATS_KEY, JSON.stringify(all));
  }catch(_){}
}

// ════════════════════════════════════════════════════════════════════
// 7. 習穴 — 오수혈 도표 (학습 보조)
// ════════════════════════════════════════════════════════════════════
function openLearn(){
  const view = document.getElementById('view');
  if(!view) return;
  try{ if(typeof window.setHeaderContext === 'function') window.setHeaderContext('saamdoin'); }catch(_){}
  const cols = ['井','榮','俞','經','合','原','絡','郄','募','背兪'];
  const colKeys = ['jing','rong','shu','king','he','yuan','luo','xi','mu','beishu'];
  const meridiansFull = MERIDIANS.filter(m => m.yinyang !== 'extra');
  const meridiansExtra = MERIDIANS.filter(m => m.yinyang === 'extra');
  const rows = meridiansFull.map(m => `
    <tr>
      <td class="sx-tbl-mer ${m.yinyang}"><b>${esc(m.short)}</b><br><span style="font-size:10px;color:#888">${esc(m.ko)}</span></td>
      ${colKeys.map(k => `<td class="sx-tbl-pt"><span class="han">${esc(m.pts[k]||'·')}</span></td>`).join('')}
    </tr>
  `).join('');
  const extraRows = meridiansExtra.map(m => {
    const pts = Object.entries(m.pts).map(([k,v]) => `<span class="han" title="${esc(CATS[k]?CATS[k].han+'·'+CATS[k].ko:k)}">${esc(v)}</span><span style="font-size:9px;color:#888">(${esc(CATS[k]?CATS[k].han:k)})</span>`).join(' · ');
    return `
      <tr>
        <td class="sx-tbl-mer ${m.yinyang}"><b>${esc(m.short)}</b><br><span style="font-size:10px;color:#888">${esc(m.ko)}</span></td>
        <td colspan="10" class="sx-tbl-pt" style="text-align:left;padding-left:10px;font-size:11px">${pts}</td>
      </tr>
    `;
  }).join('');
  view.innerHTML = _baseStyles() + _bannerHTML() + `
    <style>
      .sx-tbl-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .sx-tbl { border-collapse:collapse; font-size:11.5px; width:100%; min-width:560px; background:#FAF5EC; border:1px solid #C9A22744; }
      .sx-tbl th, .sx-tbl td { border:1px solid #C9A22744; padding:6px 5px; text-align:center; }
      .sx-tbl th { background:#3A6A4A; color:#FFE08A; font-family:'Noto Serif SC',serif; font-size:13px; font-weight:700; }
      .sx-tbl-mer { background:#FFF8E0; font-family:'Noto Serif SC',serif; min-width:54px; }
      .sx-tbl-mer.yin  { color:#7C1818; }
      .sx-tbl-mer.yang { color:#1A4C7C; }
      .sx-tbl-mer.extra { color:#5C4070; background:#F0E0FF; }
      .sx-tbl-pt .han { font-family:'Noto Serif SC',serif; font-size:13px; }
      .sx-legend { background:#FAF5EC; border:1px solid #C9A22744; border-radius:8px; padding:9px 11px; font-size:11px; color:var(--mo); line-height:1.7; margin-top:8px; }
      .sx-legend b { font-family:'Noto Serif SC',serif; color:#1F3F2C; }
    </style>
    <div style="font-family:'Noto Serif SC',serif;font-size:14px;color:#1F3F2C;margin:6px 0 7px"><b>五輸·原·絡·郄·募·背兪</b> 도표</div>
    <div class="sx-tbl-wrap">
      <table class="sx-tbl">
        <thead>
          <tr><th rowspan="2">經脈</th><th colspan="5">五輸穴</th><th colspan="5">特定穴</th></tr>
          <tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
        </thead>
        <tbody>${rows}${extraRows}</tbody>
      </table>
    </div>
    <div class="sx-legend">
      <b>陰經</b> 五行 — 井(木) 榮(火) 俞(土) 經(金) 合(水) · <b>陽經</b> — 井(金) 榮(水) 俞(木) 經(火) 合(土)<br>
      <b>原穴</b>: 陰經 = 俞穴, 陽經은 별도. <b>絡穴</b>: 二經 연결. <b>郄穴</b>: 急症·裏症. <b>募穴</b>: 臟腑의 氣가 모이는 胸腹의 穴. <b>背兪穴</b>: 모두 足太陽膀胱經 위에 위치.
    </div>
    <div class="sx-actions">
      <button class="btn" type="button" id="sx-learn-back">← 舍巖之房</button>
    </div>
  `;
  _attachBanner();
  $('#sx-learn-back').addEventListener('click', () => renderSaamdoinHome());
}

// ════════════════════════════════════════════════════════════════════
// 8. 멀티 — Firebase 룸 기반 (2~4인). v1 은 라이트 버전.
//    각 플레이어 인덱스(idx)와 finished 만 동기화. 카드는 호스트가 생성·broadcast.
//    Firebase 룰 추가 필요: jingxue_rooms (cube_rooms 와 동일 구조).
// ════════════════════════════════════════════════════════════════════
function openMulti(){
  const FB = window.FB;
  if(!FB || !FB.get || !FB.put){
    toast('Firebase 미연결 — 멀티는 온라인 상태에서만','warn');
    return;
  }
  const view = document.getElementById('view');
  if(!view) return;
  try{ if(typeof window.setHeaderContext === 'function') window.setHeaderContext('saamdoin'); }catch(_){}
  view.innerHTML = _baseStyles() + _bannerHTML() + `
    <div class="sx-info" style="line-height:1.8">
      <div style="font-family:'Noto Serif SC',serif;font-size:14px;color:#1F3F2C;margin-bottom:6px"><b>對決 (멀티)</b></div>
      <div>v1.0 (v11.6) — 멀티는 다음 빌드에서 정식 출시 예정입니다.</div>
      <div>현재 빌드: 싱글 (對 AI 3봇) 모드만 지원. 동일 알고리즘·카드 풀로 학습 효율 동일.</div>
      <div style="margin-top:8px;color:var(--mo-l);font-size:10.5px">
        멀티는 Firebase 룰 (<b>jingxue_rooms/{rid}</b>) 추가 + 매칭 로비가 필요합니다.<br>
        다음 빌드에서 방미큐브와 동일한 패턴(host broadcast, 1.5s polling)으로 합류·동시 출발·실시간 진행도 표시가 들어갑니다.
      </div>
    </div>
    <div class="sx-actions">
      <button class="btn" type="button" id="sx-multi-solo">싱글로 對決</button>
      <button class="btn btn-o" type="button" id="sx-multi-back">← 舍巖之房</button>
    </div>
  `;
  _attachBanner();
  $('#sx-multi-solo').addEventListener('click', () => openRaceSolo());
  $('#sx-multi-back').addEventListener('click', () => renderSaamdoinHome());
}

// ════════════════════════════════════════════════════════════════════
// 9. 외부 노출 + 초기화
// ════════════════════════════════════════════════════════════════════
window.V11Jingxue = {
  MERIDIANS, MERIDIAN_BY_ID, CATS,
  openHome: renderSaamdoinHome,
  openRace: openRaceSolo,
  openMulti, openLearn,
};

// v11.6.1 FIX — V11Saam(신모듈)이 이 라우트를 점유해야 하므로 OLD 모듈의 등록을 비활성화한다.
//   기존 setTimeout(_registerRoute, 300) 이 NEW의 즉시 등록을 덮어쓰던 경합을 제거.
//   V11Jingxue API 객체는 그대로 유지 (외부 호환). 단 ROUTES 등록만 차단.
//   만약 신모듈이 끝까지 로드 실패할 경우에만 fallback 으로 OLD 라우트가 등록되도록 보호망 추가.
function _registerRouteIfMissing(){
  if(!window.ROUTES) return;
  // V11Saam 이 이미 등록했으면 절대 덮어쓰지 않음
  if(window.V11Saam && typeof window.V11Saam.openHome === 'function') return;
  // V11Saam 미로드 + ROUTES.saamdoin 미정의일 때만 OLD 로 fallback
  if(typeof window.ROUTES.saamdoin !== 'function'){
    window.ROUTES.saamdoin = renderSaamdoinHome;
    window.ROUTES.jingxue  = renderSaamdoinHome;
  }
}
// 5초 후에만 한 번 확인 — V11Saam 로드 충분히 기다린 뒤
setTimeout(_registerRouteIfMissing, 5000);


// v12.0: 公開房 지원 추가 (방 목록 공개 / 익명 사용자 매칭)
async function listPublicRaceRooms(){
  const f = (typeof FB!=='undefined' && FB) || null; if(!f) return [];
  const all = await f.get('jingxue_rooms');
  return Object.values(all||{}).filter(r=>r && r.isPublic && r.status==='waiting');
}
if(typeof window!=='undefined'){
  window.V11Jingxue = window.V11Jingxue || {};
  window.V11Jingxue.listPublicRooms = listPublicRaceRooms;
  window.V11Jingxue._v12_publicRooms = true;
}


// v12.0: 사암지방(경혈학房) 메뉴에 經穴 포커 진입점 + 公開房 오수혈 레이스 버튼
if(typeof window!=='undefined' && !window._v12SaamMenuHook){
  window._v12SaamMenuHook = true;
  const _saamObserver = new MutationObserver(()=>{
    // 경혈학 房 메인 화면에 진입한 직후 (route='saamdoin') 메뉴 패널 찾기
    const menu = document.querySelector('.saam-home, .jingxue-home, .v11-saam-menu');
    if(menu && !document.getElementById('v12-jxp-btn')){
      const btn = document.createElement('button');
      btn.id = 'v12-jxp-btn';
      btn.className = 'btn btn-gold';
      btn.innerHTML = '<span class="han">經穴 포커</span> <sup style="background:#9C3030;color:#fff;font-size:9px;padding:1px 4px;border-radius:6px;margin-left:4px">NEW</sup>';
      btn.style.cssText = 'margin-top:8px;display:block;width:100%;padding:10px';
      btn.addEventListener('click', ()=>{
        if(window.V12JxPoker && window.V12JxPoker.open) window.V12JxPoker.open();
        else if(window.toast) window.toast('經穴 포커 로딩…','info');
      });
      menu.appendChild(btn);
      // 오수혈 레이스 公開房 버튼
      const btn2 = document.createElement('button');
      btn2.id = 'v12-race-public-btn';
      btn2.className = 'btn';
      btn2.innerHTML = '오수혈 레이스 — 公開房 찾기';
      btn2.style.cssText = 'margin-top:6px;display:block;width:100%;padding:8px';
      btn2.addEventListener('click', async ()=>{
        if(!window.V11Jingxue || !window.V11Jingxue.listPublicRooms){
          if(window.toast) window.toast('公開房 기능 로딩 중','info');
          return;
        }
        const rooms = await window.V11Jingxue.listPublicRooms();
        if(!rooms.length){
          if(window.toast) window.toast('현재 公開房 없음 — 방 만들어 호스트해보세요','info');
          return;
        }
        const html = '<div class="modal-body"><h3>公開房 오수혈 레이스</h3>' +
          rooms.map(r=>{
            const n = Object.keys(r.players||{}).length;
            return `<div class="jxp-room" data-rid="${r.roomId}" style="cursor:pointer;padding:8px;border-bottom:1px solid #3A2010">
              <div class="han">${r.name||r.roomId}</div>
              <div style="font-size:11px;color:#888">${n}/${r.maxPlayers||4}人</div>
            </div>`;
          }).join('') + '</div>';
        if(window.openModal) window.openModal(html);
        setTimeout(()=>{
          document.querySelectorAll('.modal-body .jxp-room').forEach(el=>{
            el.addEventListener('click',()=>{
              if(window.closeModal) window.closeModal();
              if(window.V11Jingxue && window.V11Jingxue.openMulti) window.V11Jingxue.openMulti(el.dataset.rid);
            });
          });
        },50);
      });
      menu.appendChild(btn2);
    }
  });
  document.addEventListener('DOMContentLoaded',()=>{
    _saamObserver.observe(document.body,{childList:true,subtree:true});
  });
}


// ─── v12.0: 公開房 (open room) 헬퍼 ─────────────────────────────────────
async function _openPublicRoom(){
  const f = (typeof FB !== 'undefined' && FB) || null;
  if(!f){ try{ window.toast && window.toast('네트워크 없음','warn'); }catch(_){} return; }
  // 진행중인 공개방 검색
  const all = await f.get('jingxue_rooms');
  let room = null;
  if(all){
    for(const r of Object.values(all)){
      if(r && r.status === 'waiting' && r.isPublic && Object.keys(r.players||{}).length < (r.maxPlayers||4)){
        room = r; break;
      }
    }
  }
  if(room){
    // 입장
    if(typeof joinMultiRoom === 'function') return joinMultiRoom(room.roomId);
    if(window.V11Jingxue && window.V11Jingxue.joinRoom) return window.V11Jingxue.joinRoom(room.roomId);
  } else {
    // 새 공개방 생성
    if(window.V11Jingxue && window.V11Jingxue.createRoom){
      return window.V11Jingxue.createRoom({isPublic:true, name:'公開房'});
    }
  }
}
if(typeof window !== 'undefined'){
  window.V11Jingxue = window.V11Jingxue || {};
  window.V11Jingxue.openPublicRoom = _openPublicRoom;
}


// ─── v12.0: 公開房 (open room) 헬퍼 ─────────────────────────────────────
async function _openPublicRoom(){
  const f = (typeof FB !== 'undefined' && FB) || null;
  if(!f){ try{ window.toast && window.toast('네트워크 없음','warn'); }catch(_){} return; }
  // 진행중인 공개방 검색
  const all = await f.get('jingxue_rooms');
  let room = null;
  if(all){
    for(const r of Object.values(all)){
      if(r && r.status === 'waiting' && r.isPublic && Object.keys(r.players||{}).length < (r.maxPlayers||4)){
        room = r; break;
      }
    }
  }
  if(room){
    // 입장
    if(typeof joinMultiRoom === 'function') return joinMultiRoom(room.roomId);
    if(window.V11Jingxue && window.V11Jingxue.joinRoom) return window.V11Jingxue.joinRoom(room.roomId);
  } else {
    // 새 공개방 생성
    if(window.V11Jingxue && window.V11Jingxue.createRoom){
      return window.V11Jingxue.createRoom({isPublic:true, name:'公開房'});
    }
  }
}
if(typeof window !== 'undefined'){
  window.V11Jingxue = window.V11Jingxue || {};
  window.V11Jingxue.openPublicRoom = _openPublicRoom;
}

})();
