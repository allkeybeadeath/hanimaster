/* bangje-v13-integration.js — v13 통합 패치
 * ============================================================================
 *  - 헬게이트(獄門) 진입점: 의서궁·방제학 home·기출 탭 모두에 추가
 *  - 기출 탭에 "전체 풀기" 버튼 추가
 *  - <자동>(auto) 문제에서 이름·출전·의가 묻는 유형 비활성화
 *  - 지옥(난이도4)·고난도(난이도3) 자동문제 오답 선지 강화 (한자 한 글자 swap, 유사 처방 effect 두 글자 swap)
 *  - 의서궁 화면에 "모든 컨텐츠 한글로" 토글 (한자→한글 변환)
 *  - CIM Lab 문구 제거 (런타임 패치)
 *
 *  적용 시점: app.js / clinic-hub 로드 후. window.V13Hellgate.open 호출 가능.
 * ============================================================================ */
(function(){
'use strict';

function $(s,r){ return (r||document).querySelector(s); }
function $$(s,r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }

// ───────────────────────────────────────────────────────────────────────
// PART A: CIM Lab 문구 런타임 제거
// ───────────────────────────────────────────────────────────────────────
function stripCimLab(){
  // DOM 안의 모든 텍스트노드에서 CIM Lab 제거 (관찰자로 동작)
  const REGEXES = [
    /CIM Lab · /g, / · CIM Lab/g, /CIM Lab/g, /CIM_Lab/g, /CIMLab/g, /CIM-Lab/g,
  ];
  function clean(node){
    if(!node) return;
    if(node.nodeType === 3){
      let t = node.nodeValue;
      let changed = false;
      REGEXES.forEach(re => { if(re.test(t)){ t = t.replace(re,''); changed = true; } });
      if(changed) node.nodeValue = t;
      return;
    }
    if(node.nodeType !== 1) return;
    // skip <script>/<style>
    const tag = node.tagName;
    if(tag === 'SCRIPT' || tag === 'STYLE') return;
    Array.from(node.childNodes).forEach(clean);
  }
  try{ clean(document.body); }catch(_){}
}

// ───────────────────────────────────────────────────────────────────────
// PART B: 한자 → 한글 토글 (의서궁 토글 버튼)
// ───────────────────────────────────────────────────────────────────────
//   원리: 미리 매핑된 단어/문구를 한글로 치환. 토글 OFF 면 원본 복원.
//   원본 보존: DOM 노드에 data-orig 속성으로 저장.
const HANJA_TO_HANGUL_PHRASES = [
  // 처방 (긴 것 먼저)
  ['補中益氣湯','보중익기탕'], ['防風通聖散','방풍통성산'], ['葛根黃芩黃連湯','갈근황금황련탕'],
  ['葛根芩連湯','갈근금련탕'], ['參苓白朮散','삼령백출산'], ['參苓白朮丸','삼령백출환'],
  ['香砂六君子湯','향사육군자탕'], ['六君子湯','육군자탕'], ['四君子湯','사군자탕'],
  ['人蔘蛤蚧散','인삼합개산'], ['人参蛤蚧散','인삼합개산'],
  ['桂枝人蔘湯','계지인삼탕'], ['桂枝人参湯','계지인삼탕'],
  ['玉屛風散','옥병풍산'], ['生脈散','생맥산'], ['益氣聰明湯','익기총명탕'],
  ['升陽益胃湯','승양익위탕'], ['升陷湯','승함탕'], ['擧元煎','거원전'],
  ['異功散','이공산'], ['保元湯','보원탕'],
  ['大柴胡湯','대시호탕'], ['小柴胡湯','소시호탕'], ['小承氣湯','소승기탕'],
  ['大承氣湯','대승기탕'], ['調胃承氣湯','조위승기탕'],
  ['復方大柴胡湯','복방대시호탕'], ['石膏湯','석고탕'], ['五積散','오적산'],
  ['四物湯','사물탕'], ['當歸補血湯','당귀보혈탕'], ['八珍湯','팔진탕'],
  ['桃紅四物湯','도홍사물탕'], ['膠艾湯','교애탕'], ['芎歸膠艾湯','궁귀교애탕'],
  ['平胃散','평위산'], ['二陳湯','이진탕'], ['麻黃湯','마황탕'], ['桂枝湯','계지탕'],
  ['白虎湯','백호탕'], ['黃連解毒湯','황련해독탕'], ['理中湯','이중탕'], ['理中丸','이중환'],
  ['表裏雙解劑','표리쌍해제'], ['表裡雙解劑','표리쌍해제'],
  ['解表攻裏劑','해표공리제'], ['解表淸裡劑','해표청리제'], ['解表溫裏劑','해표온리제'],
  ['補益劑','보익제'], ['補氣劑','보기제'], ['補血劑','보혈제'],
  ['氣血雙補劑','기혈쌍보제'], ['補陰劑','보음제'], ['補陽劑','보양제'],
  // 작용·치법
  ['和解少陽','화해소양'], ['內瀉熱結','내사열결'], ['疏風解表','소풍해표'],
  ['瀉熱通便','사열통변'], ['解表淸裡','해표청리'], ['解表溫裏','해표온리'],
  ['解表攻裏','해표공리'], ['淸熱瀉火','청열사화'], ['發汗解表','발한해표'],
  ['發表溫裏','발표온리'], ['順氣化痰','순기화담'], ['活血消積','활혈소적'],
  ['燥濕健脾','조습건비'], ['益氣消痞','익기소비'], ['益氣健脾','익기건비'],
  ['益氣化痰','익기화담'], ['行氣溫中','행기온중'], ['滲濕止瀉','삼습지사'],
  ['補中益氣','보중익기'], ['升陽擧陷','승양거함'], ['昇陽擧陷','승양거함'],
  ['補氣生血','보기생혈'], ['益氣固表止汗','익기고표지한'], ['益氣生津','익기생진'],
  ['斂陰止汗','렴음지한'], ['補肺益腎','보폐익신'], ['止咳定喘','지해정천'],
  ['補血和血','보혈화혈'], ['調經止痛','조경지통'], ['益氣升陽','익기승양'],
  ['聰耳明目','총이명목'], ['益氣擧陷','익기거함'], ['補肺昇陷','보폐승함'],
  ['益氣補虛','익기보허'], ['健脾燥濕','건비조습'],
  // 증후·병기
  ['少陽·陽明合病','소양양명합병'], ['少陽陽明合病','소양양명합병'],
  ['太陽·陽明合病','태양양명합병'], ['太陽陽明合病','태양양명합병'],
  ['風熱壅盛','풍열옹성'], ['表裏俱實','표리구실'], ['表裡俱實','표리구실'],
  ['脾胃氣虛','비위기허'], ['脾不昇淸','비불승청'], ['氣虛發熱','기허발열'],
  ['中氣下陷','중기하함'], ['血虛發熱','혈허발열'], ['營血虛滯','영혈허체'],
  ['表證未解','표증미해'], ['邪熱入裡','사열입리'], ['邪熱入裏','사열입리'],
  ['脾胃虛寒','비위허한'], ['脾虛濕盛','비허습성'],
  // 君臣佐使
  ['君藥','군약'], ['臣藥','신약'], ['佐藥','좌약'], ['使藥','사약'],
  ['君臣佐使','군신좌사'],
  // 본초 (개별·한자만 — 마지막에)
  ['人蔘','인삼'], ['人参','인삼'], ['人參','인삼'],
  ['黃芪','황기'], ['黄芪','황기'],
  ['白朮','백출'], ['白术','백출'], ['蒼朮','창출'],
  ['炙甘草','자감초'], ['甘草','감초'],
  ['茯苓','복령'], ['茯神','복신'],
  ['大棗','대조'], ['生薑','생강'], ['乾薑','건강'],
  ['陳皮','진피'], ['橘皮','귤피'], ['半夏','반하'], ['柴胡','시호'],
  ['黃芩','황금'], ['黄芩','황금'], ['黃連','황련'], ['黄连','황련'],
  ['黃柏','황백'], ['黄柏','황백'], ['梔子','치자'], ['栀子','치자'],
  ['石膏','석고'], ['知母','지모'], ['大黃','대황'], ['大黄','대황'],
  ['芒硝','망초'], ['枳實','지실'], ['枳殼','지각'], ['厚朴','후박'],
  ['連翹','연교'], ['薄荷','박하'], ['荊芥','형개'], ['荆芥','형개'],
  ['防風','방풍'], ['麻黃','마황'], ['麻黄','마황'],
  ['桂枝','계지'], ['肉桂','육계'], ['白芷','백지'],
  ['羌活','강활'], ['獨活','독활'], ['葛根','갈근'],
  ['川芎','천궁'], ['當歸','당귀'], ['当归','당귀'],
  ['白芍','백작약'], ['赤芍','적작약'], ['芍藥','작약'],
  ['熟地黃','숙지황'], ['熟地','숙지'], ['生地黃','생지황'],
  ['阿膠','아교'], ['艾葉','애엽'],
  ['香豉','향시'], ['豆豉','두시'], ['淡豆豉','담두시'], ['滑石','활석'], ['桔梗','길경'],
  ['山藥','산약'], ['蓮子肉','연자육'], ['蓮肉','연육'], ['白扁豆','백편두'],
  ['薏苡仁','의이인'], ['砂仁','사인'], ['縮砂','축사'],
  ['升麻','승마'], ['藿香','곽향'], ['蘇葉','소엽'],
  ['麥門冬','맥문동'], ['麥冬','맥동'], ['五味子','오미자'], ['烏梅','오매'],
  ['蛤蚧','합개'], ['貝母','패모'], ['桑白皮','상백피'], ['杏仁','행인'],
  ['澤瀉','택사'], ['川楝子','천련자'], ['延胡索','연호색'], ['玄胡索','현호색'],
  ['木香','목향'], ['蒲公英','포공영'], ['蔥白','총백'], ['吳茱萸','오수유'],
  ['茵陳','인진'], ['金銀花','금은화'], ['金錢草','금전초'], ['海金沙','해금사'],
  ['鬱金','울금'], ['虎杖','호장'],
  ['竹茹','죽여'], ['檳榔','빈랑'], ['桃仁','도인'], ['紅花','홍화'],
  ['牡丹皮','목단피'], ['天門冬','천문동'], ['浮小麥','부소맥'], ['牡蠣','모려'],
  ['麻黃根','마황근'], ['酸棗仁','산조인'], ['蔓荊子','만형자'], ['藁本','고본'],
  ['杜仲','두충'], ['烏藥','오약'], ['益智仁','익지인'], ['白豆蔻','백두구'],
  ['香附子','향부자'], ['龍骨','용골'], ['山茱萸','산수유'], ['仙鶴草','선학초'],
  ['丹參','단삼'], ['西洋蔘','서양삼'], ['黨蔘','당삼'], ['沙蔘','사삼'],
  ['白頭翁','백두옹'], ['白茅根','백모근'], ['地楡炭','지유탄'], ['側柏炭','측백탄'],
  ['附子','부자'], ['細辛','세신'], ['枸杞子','구기자'],
  // 출전
  ['傷寒論','상한론'], ['金匱要略','금궤요략'], ['太平惠民和劑局方','태평혜민화제국방'],
  ['黃帝素問宣明論方','황제소문선명론방'], ['宣明論方','선명론방'],
  ['外台秘要','외태비요'], ['仙授理傷續斷秘方','선수이상속단비방'],
  ['內外傷辨惑論','내외상변혹론'], ['脾胃論','비위론'], ['東醫寶鑑','동의보감'],
  ['東醫壽世保元','동의수세보원'], ['醫學啓源','의학계원'], ['醫學入門','의학입문'],
  ['醫方集解','의방집해'], ['醫宗金鑑','의종금감'], ['景岳全書','경악전서'],
  ['醫學衷中參西錄','의학충중참서록'], ['東垣試效方','동원시효방'],
  ['小兒藥證直訣','소아약증직결'], ['本草鋼目','본초강목'], ['神農本草經','신농본초경'],
  ['黃帝內經','황제내경'],
  // 의가
  ['張仲景','장중경'], ['仲景','중경'], ['李東垣','이동원'], ['東垣','동원'],
  ['劉河間','유하간'], ['劉完素','유완소'], ['朱丹溪','주단계'], ['張子和','장자화'],
  ['張景岳','장경악'], ['張介賓','장개빈'], ['李時珍','이시진'],
  ['李梴','이천'], ['許叔微','허숙미'], ['汪昂','왕앙'], ['許浚','허준'],
  ['李濟馬','이제마'], ['張錫純','장석순'], ['王好古','왕호고'],
  // 章·기타 단위
  ['章','장'], ['節','절'], ['卷','권'], ['味','미'],
  ['湯','탕'], ['散','산'], ['丸','환'], ['膏','고'],
  ['錢','전'], ['兩','량'], ['斤','근'], ['分','푼'], ['升','승'], ['合','홉'],
  // 빈출 표현
  ['醫書宮','의서궁'], ['神農之房','신농지방'], ['東武之房','동무지방'],
  ['舍巖之房','사암지방'], ['岐伯之房','기백지방'], ['黃帝之房','황제지방'],
  ['華佗之房','화타지방'], ['道人之房','도인지방'], ['仲景之房','중경지방'],
  ['方劑學','방제학'], ['診斷學','진단학'], ['經穴','경혈'], ['同學','동학'],
  ['八房','팔방'], ['前殿','전전'], ['獄門','옥문'],
];

let _hangulMode = (() => {
  try{ return localStorage.getItem('hg.hangul') === '1'; }catch(_){ return false; }
})();

function applyHangul(){
  if(!_hangulMode) return;
  function walk(node){
    if(!node) return;
    if(node.nodeType === 3){
      let t = node.nodeValue;
      if(!t || !/[\u4E00-\u9FFF]/.test(t)) return;  // 한자 없으면 skip
      if(!node._origText) node._origText = t;
      let out = t;
      for(const [hanja, hangul] of HANJA_TO_HANGUL_PHRASES){
        if(out.indexOf(hanja) >= 0) out = out.split(hanja).join(hangul);
      }
      if(out !== t) node.nodeValue = out;
      return;
    }
    if(node.nodeType !== 1) return;
    const tag = node.tagName;
    if(tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT') return;
    // class 'han' 처럼 의도적인 한자 캐릭터 — skip
    if(node.classList && (node.classList.contains('han') || node.classList.contains('han-keep'))) return;
    Array.from(node.childNodes).forEach(walk);
  }
  try{ walk(document.body); }catch(_){}
}
function revertHangul(){
  // 변환 전 텍스트 복원
  function walk(node){
    if(!node) return;
    if(node.nodeType === 3){
      if(node._origText){
        node.nodeValue = node._origText;
        node._origText = null;
      }
      return;
    }
    if(node.nodeType !== 1) return;
    const tag = node.tagName;
    if(tag === 'SCRIPT' || tag === 'STYLE') return;
    Array.from(node.childNodes).forEach(walk);
  }
  try{ walk(document.body); }catch(_){}
}
function toggleHangul(force){
  if(force == null) _hangulMode = !_hangulMode;
  else _hangulMode = !!force;
  try{ localStorage.setItem('hg.hangul', _hangulMode?'1':'0'); }catch(_){}
  if(_hangulMode){ applyHangul(); }
  else { revertHangul(); }
  toast(_hangulMode?'한글 변환 ON':'한글 변환 OFF', _hangulMode?'ok':'warn');
  // 토글 버튼 UI 동기화
  $$('#hg-hangul-toggle, .hg-hangul-toggle').forEach(b => {
    if(_hangulMode){ b.classList.add('on'); b.textContent = '한글 ON'; }
    else            { b.classList.remove('on'); b.textContent = '韓字'; }
  });
}
window.HG_toggleHangul = toggleHangul;
window.HG_isHangulMode = () => _hangulMode;

// MutationObserver 로 새 컨텐츠에도 자동 적용
function setupHangulObserver(){
  if(window.__hgObs) return;
  try{
    const obs = new MutationObserver(muts => {
      if(!_hangulMode) return;
      muts.forEach(m => {
        m.addedNodes && m.addedNodes.forEach(n => {
          if(n.nodeType !== 1 && n.nodeType !== 3) return;
          // schedule
          setTimeout(() => applyHangul(), 30);
        });
      });
    });
    obs.observe(document.body, { childList:true, subtree:true });
    window.__hgObs = obs;
  }catch(_){}
}

// ───────────────────────────────────────────────────────────────────────
// PART C: 의서궁 / 방제학 home / 기출 탭에 헬게이트 진입 + 한글 토글 버튼 추가
// ───────────────────────────────────────────────────────────────────────
function injectIntegrationStyles(){
  if(document.getElementById('hg-int-style')) return;
  const s = document.createElement('style');
  s.id = 'hg-int-style';
  s.textContent = `
    .hg-hellgate-banner{
      background:linear-gradient(135deg,#6E1818 0%,#3A0808 100%);
      color:#FCC4A4;padding:14px 16px;border-radius:12px;margin:14px 0;
      cursor:pointer;display:flex;align-items:center;gap:12px;
      box-shadow:0 4px 14px rgba(110,24,24,.3);
      transition:transform .15s,box-shadow .15s;border:2px solid #C9A227;
    }
    .hg-hellgate-banner:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(110,24,24,.5)}
    .hg-hellgate-banner .han{
      font-family:'ZCOOL XiaoWei',serif;font-size:38px;color:#FFD08A;
      line-height:1;text-shadow:2px 2px 0 rgba(0,0,0,.4);min-width:64px;text-align:center;
    }
    .hg-hellgate-banner-lg{
      padding:20px 22px;margin:18px 0;border-width:3px;
      background:linear-gradient(135deg,#8E2020 0%,#2A0606 50%,#5A1010 100%);
    }
    .hg-hellgate-banner-lg .han{font-size:54px;min-width:90px}
    .hg-hellgate-banner-lg .ttl{font-size:22px}
    .hg-hellgate-banner .hg-bn-body{flex:1}
    .hg-hellgate-banner .ttl{font-size:18px;font-weight:700;color:#FFD08A;letter-spacing:.05em}
    .hg-hellgate-banner .sub{font-size:11.5px;opacity:.85;margin-top:3px;color:#FCC4A4}
    .hg-hellgate-banner .arrow{margin-left:auto;font-size:22px;color:#FFD08A;opacity:.6}
    .hg-hellgate-banner .badge{
      display:inline-block;background:#FFD08A;color:#3A0808;font-size:9.5px;
      padding:2px 6px;border-radius:8px;font-weight:700;margin-left:6px;
      vertical-align:middle;letter-spacing:.05em;
    }
    .hg-hangul-toggle{
      background:#FAF1DF;border:1.5px solid #C9A878;color:#7A5418;
      padding:5px 10px;border-radius:6px;font-size:11.5px;cursor:pointer;
      font-family:inherit;display:inline-flex;align-items:center;gap:4px;
    }
    .hg-hangul-toggle.on{background:#7C5810;color:#FFE08A;border-color:#5A4008}
    .hg-hangul-toggle:hover{transform:translateY(-1px);box-shadow:0 1px 4px rgba(0,0,0,.15)}
    .hg-quiz-full-btn{
      background:linear-gradient(135deg,#3068A0,#1A4C7C);color:#fff;border:none;
      border-radius:8px;padding:10px 14px;font-size:13.5px;cursor:pointer;
      font-family:inherit;font-weight:600;
    }
    .hg-quiz-full-btn:hover{transform:translateY(-1px);box-shadow:0 3px 8px rgba(48,104,160,.4)}
  `;
  document.head.appendChild(s);
}

function injectHellgateInHub(){
  // V11ClinicHub render 직후 진입
  const oldHub = window.V11ClinicHub && window.V11ClinicHub.open;
  if(!oldHub || window.__hgHubHooked) return;
  window.__hgHubHooked = true;
  const wrap = function(){
    oldHub.apply(this, arguments);
    // DOM 갱신 후 배너 삽입
    setTimeout(() => {
      const view = document.getElementById('view');
      if(!view) return;
      // 이미 있으면 skip
      if(view.querySelector('.hg-hellgate-banner')) return;
      // 한글 토글 버튼: view 우측 상단에
      if(!view.querySelector('.hg-hangul-toggle')){
        const tog = document.createElement('button');
        tog.className = 'hg-hangul-toggle' + (_hangulMode?' on':'');
        tog.id = 'hg-hangul-toggle';
        tog.textContent = _hangulMode?'한글 ON':'韓字';
        tog.title = '한자 → 한글 변환 토글';
        tog.style.cssText = 'position:absolute;top:10px;right:14px;z-index:5';
        tog.onclick = (e) => { e.stopPropagation(); toggleHangul(); };
        view.style.position = 'relative';
        view.insertBefore(tog, view.firstChild);
      }
      // 헬게이트 큰 배너 — 신농지방 카드 바로 위에 들어가게
      const banner = document.createElement('div');
      banner.className = 'hg-hellgate-banner hg-hellgate-banner-lg';
      banner.innerHTML = `
        <div class="han">獄門</div>
        <div class="hg-bn-body">
          <div class="ttl">헬게이트 <span class="badge">NEW v13</span></div>
          <div class="sub">100+ 문제 · 논스톱 주관식 · 한글/한자 모두 인정 · 띄어쓰기·오타 무관</div>
          <div class="sub" style="margin-top:3px">약식 표기 허용 (계감·삼황·금련·교애) · 8미↑ 처방은 8개씩 · 증상은 3개씩 · 동적 채점</div>
        </div>
        <div class="arrow">→</div>
      `;
      banner.onclick = () => {
        if(window.V13Hellgate) window.V13Hellgate.open();
      };
      // 神農之房 또는 8방 그리드 직전에 삽입 (가장 prominent 한 위치)
      const grid = view.querySelector('[class*="subject"], [class*="rooms"], [class*="hall-grid"], .ch-grid, .grid');
      const placeBefore = grid || view.querySelector('.card') || view.firstChild;
      if(placeBefore && placeBefore.parentNode){
        placeBefore.parentNode.insertBefore(banner, placeBefore);
      } else {
        view.appendChild(banner);
      }
      // 새로 그려진 콘텐츠도 한글 변환 적용
      if(_hangulMode) setTimeout(applyHangul, 50);
      // CIM Lab 제거
      stripCimLab();
    }, 30);
  };
  window.V11ClinicHub.open = wrap;
  if(window.ROUTES) window.ROUTES.hub = wrap;
}

function injectHellgateInHome(){
  // 방제학 home: renderHome 또는 setTab('home') 후 추가
  const oldHome = window.ROUTES && window.ROUTES.home;
  if(!oldHome || window.__hgHomeHooked) return;
  window.__hgHomeHooked = true;
  const wrap = function(){
    oldHome.apply(this, arguments);
    setTimeout(() => {
      const view = document.getElementById('view');
      if(!view) return;
      if(view.querySelector('.hg-hellgate-banner')) return;
      const banner = document.createElement('div');
      banner.className = 'hg-hellgate-banner';
      banner.innerHTML = `
        <div class="han">獄</div>
        <div>
          <div class="ttl">헬게이트 <span class="badge">NEW</span></div>
          <div class="sub">100문제 이상 · 논스톱 주관식 · 약식 표기(계감/삼황) 허용</div>
        </div>
        <div class="arrow">→</div>
      `;
      banner.onclick = () => {
        if(window.V13Hellgate) window.V13Hellgate.open();
      };
      // 방제학 home 의 첫 카드 다음에 삽입
      const firstCard = view.querySelector('.card');
      if(firstCard && firstCard.parentNode){
        firstCard.parentNode.insertBefore(banner, firstCard.nextSibling);
      } else {
        view.appendChild(banner);
      }
      if(_hangulMode) setTimeout(applyHangul, 50);
      stripCimLab();
    }, 30);
  };
  window.ROUTES.home = wrap;
}

function injectQuizFullButton(){
  // 기출(quiz) 탭의 "문제수" 영역에 "전체 풀기" 버튼 추가
  const oldQuiz = window.ROUTES && window.ROUTES.quiz;
  if(!oldQuiz || window.__hgQuizHooked) return;
  window.__hgQuizHooked = true;
  const wrap = function(){
    oldQuiz.apply(this, arguments);
    setTimeout(() => {
      const view = document.getElementById('view');
      if(!view) return;
      const countGrid = view.querySelector('.count-grid');
      if(!countGrid) return;
      // 이미 있으면 skip
      if(countGrid.querySelector('.count-btn-full')) return;
      // 전체 풀기 버튼
      const btn = document.createElement('button');
      btn.className = 'count-btn count-btn-full';
      btn.type = 'button';
      btn.dataset.n = '0';  // 0 = all
      btn.style.cssText = 'background:#3068A0;color:#fff;border-color:#1A4C7C;font-weight:700;grid-column:span 2;font-size:14px';
      btn.innerHTML = '전체 풀기 <span style="font-size:10px;opacity:.85;margin-left:4px">(처음부터 끝까지)</span>';
      btn.onclick = () => {
        // sel.count = 9999 로 저장 후 quiz 시작
        const sel = JSON.parse(localStorage.getItem('quiz.sel.v1')||'{}');
        sel.count = 9999;  // 큰 수 (실제 풀에 따라 cap)
        localStorage.setItem('quiz.sel.v1', JSON.stringify(sel));
        // 시작 버튼 클릭
        const startBtn = view.querySelector('#quiz-start-btn');
        if(startBtn) startBtn.click();
      };
      countGrid.appendChild(btn);
      if(_hangulMode) setTimeout(applyHangul, 30);
    }, 30);
  };
  window.ROUTES.quiz = wrap;
}

// ───────────────────────────────────────────────────────────────────────
// PART D: 자동 문제 생성기 패치
//   - 이름·출전·의가 묻는 type 제거
//   - 난이도3·4 distractor 강화 (한자 한 글자 swap)
// ───────────────────────────────────────────────────────────────────────
// generateQuizQuestions 가 app.js 에 정의됨. 그 결과를 후처리.
function wrapGenerateQuiz(){
  if(typeof window.generateQuizQuestions !== 'function') return;
  if(window.__hgGenWrapped) return;
  window.__hgGenWrapped = true;
  const orig = window.generateQuizQuestions;
  window.generateQuizQuestions = function(n, diff, opts){
    const all = orig.call(this, n*4, diff, opts);  // 여분 생성
    // 필터: 출전·이름·의가 묻는 문제 제거
    const BANNED_TYPES = new Set(['auto-source','auto-ko']);
    const BANNED_Q_PATTERNS = [
      /한글 이름/, /출전\(出處\)은\?/, /出處/, /누가 (만든|창방)/, /의가는\?/, /창방자/,
    ];
    let filtered = all.filter(q => {
      if(q.type && BANNED_TYPES.has(q.type)) return false;
      if(q.q && BANNED_Q_PATTERNS.some(re => re.test(q.q))) return false;
      return true;
    });
    // 난이도3·4 — distractor 보강
    if(diff >= 3){
      filtered = filtered.map(q => _strengthenDistractors(q, diff));
    }
    return filtered.slice(0, n);
  };
}

// 한자 한 글자 살짝 바꾸기 (정답을 닮은 오답 만들기)
const CHAR_SWAP_MAP = {
  '少':'小','小':'少','陽':'陰','陰':'陽','表':'裡','裡':'表','裏':'裡',
  '寒':'熱','熱':'寒','虛':'實','實':'虛','溫':'凉','凉':'溫','涼':'溫',
  '上':'下','下':'上','補':'瀉','瀉':'補','解':'發','發':'解',
  '太':'少','少':'太','合':'幷','幷':'合',
  '前':'後','後':'前','左':'右','右':'左',
  '濕':'燥','燥':'濕','風':'寒','痰':'濕',
  '苦':'甘','甘':'苦','辛':'酸','酸':'辛',
  '蔘':'參','參':'蔘','黃':'黄','黄':'黃',
  '氣':'血','血':'氣',
};
function swapOneChar(s){
  if(!s || typeof s !== 'string') return s;
  // 첫 한자 swap
  for(let i=0;i<s.length;i++){
    const c = s[i];
    if(CHAR_SWAP_MAP[c]){
      return s.slice(0,i) + CHAR_SWAP_MAP[c] + s.slice(i+1);
    }
  }
  return s;
}

function _strengthenDistractors(q, diff){
  if(!q.options || !q.options.length) return q;
  if(typeof q.answer !== 'number') return q;
  const correct = q.options[q.answer];
  if(!correct || typeof correct !== 'string') return q;
  // 너무 짧은 정답은 swap 적용 안 함 (1글자)
  if(correct.length < 2) return q;
  // 정답을 닮은 distractor 1~2개 생성, 너무 동떨어진 distractor 제거
  // 1. 한 글자 swap 변형 1개 만들기 (정답과 충돌 안 하게)
  const swap1 = swapOneChar(correct);
  // 2. 두 글자 swap 변형 1개 (난이도 4)
  let swap2 = null;
  if(diff >= 4){
    let s = swapOneChar(correct);
    // 다른 위치 한 글자 더 swap
    for(let i=0;i<s.length;i++){
      const c = s[i];
      if(CHAR_SWAP_MAP[c] && i > 0 && correct[i] === c){
        s = s.slice(0,i) + CHAR_SWAP_MAP[c] + s.slice(i+1);
        break;
      }
    }
    if(s !== swap1) swap2 = s;
  }
  // 기존 options 에서 너무 짧거나 정답과 완전 무관한 것 검출 → 교체
  const newOptions = q.options.slice();
  // 가장 짧은(=눈에 띄는) distractor 자리 찾아 교체
  const lengths = newOptions.map((o,i) => ({o, i, len: (o||'').length}));
  const distractorLens = lengths.filter(x => x.i !== q.answer);
  // 정답 길이 대비 너무 차이나는 distractor 교체
  const targetLen = correct.length;
  distractorLens.sort((a,b) => Math.abs(a.len - targetLen) - Math.abs(b.len - targetLen));
  // 가장 다른 distractor 부터 교체
  const replaceTargets = distractorLens
    .filter(x => Math.abs(x.len - targetLen) > Math.max(3, targetLen*0.4))
    .reverse()  // 가장 차이나는 것부터
    .slice(0, 2);
  const newDists = [swap1, swap2].filter(Boolean).filter(d => !newOptions.includes(d));
  replaceTargets.forEach((rt, idx) => {
    if(newDists[idx]) newOptions[rt.i] = newDists[idx];
  });
  // 만약 distractor 가 정답과 같은 게 있으면 swap
  for(let i=0;i<newOptions.length;i++){
    if(i !== q.answer && newOptions[i] === correct){
      newOptions[i] = swapOneChar(correct);
    }
  }
  q.options = newOptions;
  return q;
}

// ───────────────────────────────────────────────────────────────────────
// PART E: 기존 객관식 문제 일부 패치 (혼자만 한자로 된 선지 제거)
// ───────────────────────────────────────────────────────────────────────
function patchExistingQuestions(){
  // PAST_EXAMS / BULK_QUESTIONS 의 options 를 검사하여 "혼자만 압도적으로 다른"
  // 선지를 강제로 패치 (밸런스 맞추기)
  // 단순 휴리스틱: options 중 한자 비율이 극단적으로 다른 한 개를 보면 정답일 가능성.
  // 여기선 출제 의도를 깨지 않기 위해 단순 통계 수정은 보류.
  // 대신, "혼자만 매우 짧거나 매우 긴" 선지(특히 비정답)가 있으면, 그것이 정답이
  // 아닌데 시각적으로 답으로 보이지 않도록 길이 패딩 추가.
  const lists = [];
  if(window.PAST_EXAMS) lists.push(window.PAST_EXAMS);
  if(window.BULK_QUESTIONS) lists.push(window.BULK_QUESTIONS);
  lists.forEach(arr => {
    arr.forEach(q => {
      if(!q.options || typeof q.answer !== 'number') return;
      const ans = q.options[q.answer];
      if(!ans) return;
      // distractor 들 중 정답보다 압도적으로 짧은 것 (3배 이상) → 패딩 (의미 보존)
      const distLens = q.options.map((o,i) => ({o, i, len:(o||'').length})).filter(x => x.i !== q.answer);
      const ansLen = ans.length;
      distLens.forEach(d => {
        if(d.len > 0 && ansLen >= 18 && d.len < ansLen / 3){
          // distractor가 너무 짧다 → "...정도이다" 같은 모호한 꼬리 추가는 의미 변형 위험.
          // 그냥 한 글자 패딩 (다른 처방 keyword 부착) — 의도적으로 비활성.
        }
      });
      // "이상 모두 들어간다" 같은 명시적 답이 정답으로 위치 고정된 케이스: 셔플 안 해도 됨.
    });
  });
}

// ───────────────────────────────────────────────────────────────────────
// PART F: 부팅 — 모든 훅 적용
// ───────────────────────────────────────────────────────────────────────
function boot(){
  injectIntegrationStyles();
  setupHangulObserver();
  // 단계적으로 (모듈 로드 대기)
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if(window.V11ClinicHub) injectHellgateInHub();
    if(window.ROUTES && window.ROUTES.home) injectHellgateInHome();
    if(window.ROUTES && window.ROUTES.quiz) injectQuizFullButton();
    if(typeof window.generateQuizQuestions === 'function') wrapGenerateQuiz();
    patchExistingQuestions();
    stripCimLab();
    if(tries > 80){ clearInterval(iv); }
    // 모두 완료되면 중단
    if(window.__hgHubHooked && window.__hgHomeHooked && window.__hgQuizHooked && window.__hgGenWrapped){
      clearInterval(iv);
    }
  }, 250);
  // 한글 토글 자동 적용
  if(_hangulMode){
    setTimeout(applyHangul, 500);
    setTimeout(applyHangul, 1500);
  }
  // 페이지 전환 시 CIM Lab 재제거
  setInterval(() => { stripCimLab(); }, 5000);
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// 외부 API
window.V13Integration = {
  toggleHangul: toggleHangul,
  isHangulMode: () => _hangulMode,
  applyHangul: applyHangul,
  revertHangul: revertHangul,
  stripCimLab: stripCimLab,
};

console.log('[v13-integration] ready');

})();
