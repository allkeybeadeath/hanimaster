/* data-acupoints.js — v11.6.0 (2026-05-18)
 * ============================================================================
 *  經穴學 (사암도인의 방) 五輸穴 레이스용 혈자리 데이터
 *
 *   • 12 정경 + 任·督·帶脈 (총 15 채널)
 *   • 각 정경 五輸穴 5개 (井-滎-輸-經-合) + 特定要穴 5개 (原-絡-郄-募-背輸)
 *     - 음경 五輸穴 五行: 木火土金水 (井=木)
 *     - 양경 五輸穴 五行: 金水木火土 (井=金)
 *     - 음경 原穴 = 輸穴 (동일 위치, 명칭만 다름) — 五輸穴 set 에 표시
 *   • 任·督·帶脈: 五輸穴/原락극모수 없음. 대표혈 5개를 신체 흐름순으로 학습.
 *
 *   외부 노출:
 *     window.ACUPOINT_DATA = { meridians:[...], byId:{...} }
 *     window.ACUPOINT_VERSION = '11.6.0'
 *
 *   각 meridian 객체:
 *     { id, han, ko, type:'yin'|'yang'|'vessel', pole, element,
 *       shu: [{name_han, name_ko, role_han, role_ko, role_label, element}],  // 五輸穴 5개 (정경) or 대표혈 5개 (기경)
 *       special: [{name_han, name_ko, role_han, role_ko, role_label}]         // 特定要穴 5개 (정경만)
 *     }
 *
 *   교재 근거: 韓醫科大學 經穴學 표준 (대한경혈학회) · 標準經穴 WHO 2008.
 * ============================================================================ */
(function(){
'use strict';

// ─── 五輸穴 역할 라벨 ──────────────────────────────────────────────────
// 음경: 井(木) → 滎(火) → 輸(土) → 經(金) → 合(水)
// 양경: 井(金) → 滎(水) → 輸(木) → 經(火) → 合(土)
const SHU_ROLES_YIN  = [
  { role_han:'井', role_ko:'정', element:'木' },
  { role_han:'滎', role_ko:'형', element:'火' },
  { role_han:'輸', role_ko:'수', element:'土' },  // 輸 = 原 (음경)
  { role_han:'經', role_ko:'경', element:'金' },
  { role_han:'合', role_ko:'합', element:'水' },
];
const SHU_ROLES_YANG = [
  { role_han:'井', role_ko:'정', element:'金' },
  { role_han:'滎', role_ko:'형', element:'水' },
  { role_han:'輸', role_ko:'수', element:'木' },
  { role_han:'經', role_ko:'경', element:'火' },
  { role_han:'合', role_ko:'합', element:'土' },
];

// 特定要穴 5종 (정경 학습 표준 순서: 原 → 絡 → 郄 → 募 → 背輸)
const SPECIAL_ROLES = [
  { role_han:'原',   role_ko:'원',   role_label:'원혈' },
  { role_han:'絡',   role_ko:'락',   role_label:'락혈' },
  { role_han:'郄',   role_ko:'극',   role_label:'극혈' },
  { role_han:'募',   role_ko:'모',   role_label:'모혈' },
  { role_han:'背輸', role_ko:'배수', role_label:'배수혈' },
];

// ─── 12 정경 五輸穴 (한자명 5개 · 음경 順 정-형-수-경-합) ────────────────
//  yin/yang 구분으로 五行 자동 부여.
//  음경 yin: LU SP HT KI PC LR
//  양경 yang: LI ST SI BL TE GB
const SHU_RAW = {
  // 手太陰肺經 (yin) — 少商→魚際→太淵→經渠→尺澤
  LU: ['少商','魚際','太淵','經渠','尺澤'],
  // 手陽明大腸經 (yang) — 商陽→二間→三間→陽谿→曲池
  LI: ['商陽','二間','三間','陽谿','曲池'],
  // 足陽明胃經 (yang) — 厲兌→內庭→陷谷→解谿→足三里
  ST: ['厲兌','內庭','陷谷','解谿','足三里'],
  // 足太陰脾經 (yin) — 隱白→大都→太白→商丘→陰陵泉
  SP: ['隱白','大都','太白','商丘','陰陵泉'],
  // 手少陰心經 (yin) — 少衝→少府→神門→靈道→少海
  HT: ['少衝','少府','神門','靈道','少海'],
  // 手太陽小腸經 (yang) — 少澤→前谷→後谿→陽谷→小海
  SI: ['少澤','前谷','後谿','陽谷','小海'],
  // 足太陽膀胱經 (yang) — 至陰→足通谷→束骨→崑崙→委中
  BL: ['至陰','足通谷','束骨','崑崙','委中'],
  // 足少陰腎經 (yin) — 湧泉→然谷→太谿→復溜→陰谷
  KI: ['湧泉','然谷','太谿','復溜','陰谷'],
  // 手厥陰心包經 (yin) — 中衝→勞宮→大陵→間使→曲澤
  PC: ['中衝','勞宮','大陵','間使','曲澤'],
  // 手少陽三焦經 (yang) — 關衝→液門→中渚→支溝→天井
  TE: ['關衝','液門','中渚','支溝','天井'],
  // 足少陽膽經 (yang) — 足竅陰→俠谿→足臨泣→陽輔→陽陵泉
  GB: ['足竅陰','俠谿','足臨泣','陽輔','陽陵泉'],
  // 足厥陰肝經 (yin) — 大敦→行間→太衝→中封→曲泉
  LR: ['大敦','行間','太衝','中封','曲泉'],
};

// ─── 12 정경 特定要穴 (原-絡-郄-募-背輸) ────────────────────────────────
const SPECIAL_RAW = {
  // [원, 락, 극, 모, 배수]
  LU: ['太淵','列缺','孔最','中府',  '肺兪'],
  LI: ['合谷','偏歷','溫溜','天樞',  '大腸兪'],
  ST: ['衝陽','豐隆','梁丘','中脘',  '胃兪'],
  SP: ['太白','公孫','地機','章門',  '脾兪'],
  HT: ['神門','通里','陰郄','巨闕',  '心兪'],
  SI: ['腕骨','支正','養老','關元',  '小腸兪'],
  BL: ['京骨','飛揚','金門','中極',  '膀胱兪'],
  KI: ['太谿','大鍾','水泉','京門',  '腎兪'],
  PC: ['大陵','內關','郄門','膻中',  '厥陰兪'],
  TE: ['陽池','外關','會宗','石門',  '三焦兪'],
  GB: ['丘墟','光明','外丘','日月',  '膽兪'],
  LR: ['太衝','蠡溝','中都','期門',  '肝兪'],
};

// ─── 12 정경 메타 ──────────────────────────────────────────────────────
const REG_META = [
  { id:'LU', han:'手太陰肺經',   ko:'수태음폐경',   type:'yin',  pole:'太陰', accent:'#D1B080' },
  { id:'LI', han:'手陽明大腸經', ko:'수양명대장경', type:'yang', pole:'陽明', accent:'#D17A30' },
  { id:'ST', han:'足陽明胃經',   ko:'족양명위경',   type:'yang', pole:'陽明', accent:'#9C3030' },
  { id:'SP', han:'足太陰脾經',   ko:'족태음비경',   type:'yin',  pole:'太陰', accent:'#C9A227' },
  { id:'HT', han:'手少陰心經',   ko:'수소음심경',   type:'yin',  pole:'少陰', accent:'#882020' },
  { id:'SI', han:'手太陽小腸經', ko:'수태양소장경', type:'yang', pole:'太陽', accent:'#7A1F1F' },
  { id:'BL', han:'足太陽膀胱經', ko:'족태양방광경', type:'yang', pole:'太陽', accent:'#214966' },
  { id:'KI', han:'足少陰腎經',   ko:'족소음신경',   type:'yin',  pole:'少陰', accent:'#1B3A55' },
  { id:'PC', han:'手厥陰心包經', ko:'수궐음심포경', type:'yin',  pole:'厥陰', accent:'#5C3060' },
  { id:'TE', han:'手少陽三焦經', ko:'수소양삼초경', type:'yang', pole:'少陽', accent:'#4A4A4A' },
  { id:'GB', han:'足少陽膽經',   ko:'족소양담경',   type:'yang', pole:'少陽', accent:'#6B4FA8' },
  { id:'LR', han:'足厥陰肝經',   ko:'족궐음간경',   type:'yin',  pole:'厥陰', accent:'#2E5E3D' },
];

// ─── 任·督·帶脈 (奇經) 대표혈 5개 (캐노니컬 신체 흐름순) ────────────────
// 任脈 (CV) — 下 → 上: 關元 → 氣海 → 神闕 → 中脘 → 膻中
// 督脈 (GV) — 下 → 上: 長強 → 命門 → 大椎 → 百會 → 水溝
// 帶脈 (대맥) — 腰部 횡주: 京門 → 章門 → 帶脈 → 五樞 → 維道
//   (帶脈 자체는 GB에 속하는 3혈 + 章門(LR13)·京門(GB25) 학습 표준)
const VESSEL_META = [
  {
    id:'CV', han:'任脈', ko:'임맥', type:'vessel', pole:'任', accent:'#C8923A',
    shu:[
      { name_han:'關元', name_ko:'관원', role_han:'CV4',  role_ko:'下',   role_label:'下腹' },
      { name_han:'氣海', name_ko:'기해', role_han:'CV6',  role_ko:'下',   role_label:'下腹' },
      { name_han:'神闕', name_ko:'신궐', role_han:'CV8',  role_ko:'臍',   role_label:'臍中' },
      { name_han:'中脘', name_ko:'중완', role_han:'CV12', role_ko:'中',   role_label:'胃脘' },
      { name_han:'膻中', name_ko:'전중', role_han:'CV17', role_ko:'胸',   role_label:'兩乳中' },
    ],
  },
  {
    id:'GV', han:'督脈', ko:'독맥', type:'vessel', pole:'督', accent:'#3A2D14',
    shu:[
      { name_han:'長強', name_ko:'장강', role_han:'GV1',  role_ko:'尾',   role_label:'尾骶' },
      { name_han:'命門', name_ko:'명문', role_han:'GV4',  role_ko:'腰',   role_label:'腰背' },
      { name_han:'大椎', name_ko:'대추', role_han:'GV14', role_ko:'頸',   role_label:'頸下' },
      { name_han:'百會', name_ko:'백회', role_han:'GV20', role_ko:'頂',   role_label:'頭頂' },
      { name_han:'水溝', name_ko:'수구', role_han:'GV26', role_ko:'面',   role_label:'人中' },
    ],
  },
  {
    id:'DM', han:'帶脈', ko:'대맥', type:'vessel', pole:'帶', accent:'#7A5C40',
    shu:[
      { name_han:'京門', name_ko:'경문', role_han:'GB25', role_ko:'季肋', role_label:'腎募' },
      { name_han:'章門', name_ko:'장문', role_han:'LR13', role_ko:'脇',   role_label:'脾募' },
      { name_han:'帶脈', name_ko:'대맥', role_han:'GB26', role_ko:'腰',   role_label:'帶脈穴' },
      { name_han:'五樞', name_ko:'오추', role_han:'GB27', role_ko:'腰',   role_label:'腰側' },
      { name_han:'維道', name_ko:'유도', role_han:'GB28', role_ko:'腰',   role_label:'腰側' },
    ],
  },
];

// ─── 한국 한자음 hint ──────────────────────────────────────────────────
const KO_HINT = {
  '少商':'소상','魚際':'어제','太淵':'태연','經渠':'경거','尺澤':'척택',
  '商陽':'상양','二間':'이간','三間':'삼간','陽谿':'양계','曲池':'곡지',
  '厲兌':'여태','內庭':'내정','陷谷':'함곡','解谿':'해계','足三里':'족삼리',
  '隱白':'은백','大都':'대도','太白':'태백','商丘':'상구','陰陵泉':'음릉천',
  '少衝':'소충','少府':'소부','神門':'신문','靈道':'영도','少海':'소해',
  '少澤':'소택','前谷':'전곡','後谿':'후계','陽谷':'양곡','小海':'소해',
  '至陰':'지음','足通谷':'족통곡','束骨':'속골','崑崙':'곤륜','委中':'위중',
  '湧泉':'용천','然谷':'연곡','太谿':'태계','復溜':'부류','陰谷':'음곡',
  '中衝':'중충','勞宮':'노궁','大陵':'대릉','間使':'간사','曲澤':'곡택',
  '關衝':'관충','液門':'액문','中渚':'중저','支溝':'지구','天井':'천정',
  '足竅陰':'족규음','俠谿':'협계','足臨泣':'족임읍','陽輔':'양보','陽陵泉':'양릉천',
  '大敦':'대돈','行間':'행간','太衝':'태충','中封':'중봉','曲泉':'곡천',
  '列缺':'열결','孔最':'공최','中府':'중부','肺兪':'폐유',
  '合谷':'합곡','偏歷':'편력','溫溜':'온류','天樞':'천추','大腸兪':'대장유',
  '衝陽':'충양','豐隆':'풍륭','梁丘':'양구','中脘':'중완','胃兪':'위유',
  '公孫':'공손','地機':'지기','章門':'장문','脾兪':'비유',
  '通里':'통리','陰郄':'음극','巨闕':'거궐','心兪':'심유',
  '腕骨':'완골','支正':'지정','養老':'양로','關元':'관원','小腸兪':'소장유',
  '京骨':'경골','飛揚':'비양','金門':'금문','中極':'중극','膀胱兪':'방광유',
  '大鍾':'대종','水泉':'수천','京門':'경문','腎兪':'신유',
  '內關':'내관','郄門':'극문','膻中':'전중','厥陰兪':'궐음유',
  '陽池':'양지','外關':'외관','會宗':'회종','石門':'석문','三焦兪':'삼초유',
  '丘墟':'구허','光明':'광명','外丘':'외구','日月':'일월','膽兪':'담유',
  '蠡溝':'여구','中都':'중도','期門':'기문','肝兪':'간유',
  '關元':'관원','氣海':'기해','神闕':'신궐','膻中':'전중',
  '長強':'장강','命門':'명문','大椎':'대추','百會':'백회','水溝':'수구',
  '帶脈':'대맥','五樞':'오추','維道':'유도',
};
function _ko(han){ return KO_HINT[han] || ''; }

// ─── parse ─────────────────────────────────────────────────────────────
const MERIDIANS = [];
const BY_ID = {};

REG_META.forEach(m => {
  const isYin = m.type === 'yin';
  const shuRoles = isYin ? SHU_ROLES_YIN : SHU_ROLES_YANG;
  const shuPts = (SHU_RAW[m.id] || []).map((han, i) => ({
    name_han: han,
    name_ko:  _ko(han),
    role_han: shuRoles[i].role_han,
    role_ko:  shuRoles[i].role_ko,
    role_label: shuRoles[i].role_han + '穴',
    element:  shuRoles[i].element,
  }));
  const specPts = (SPECIAL_RAW[m.id] || []).map((han, i) => ({
    name_han: han,
    name_ko:  _ko(han),
    role_han: SPECIAL_ROLES[i].role_han,
    role_ko:  SPECIAL_ROLES[i].role_ko,
    role_label: SPECIAL_ROLES[i].role_label,
  }));
  const obj = { ...m, shu: shuPts, special: specPts };
  MERIDIANS.push(obj);
  BY_ID[m.id] = obj;
});

VESSEL_META.forEach(v => {
  const shu = v.shu.map(p => ({ ...p, name_ko: p.name_ko || _ko(p.name_han) }));
  const obj = { ...v, shu, special: [] };  // 기경은 特定要穴 없음
  MERIDIANS.push(obj);
  BY_ID[v.id] = obj;
});

// ─── 노출 ──────────────────────────────────────────────────────────────
window.ACUPOINT_DATA = { meridians: MERIDIANS, byId: BY_ID };
window.ACUPOINT_VERSION = '11.6.0';

})();
