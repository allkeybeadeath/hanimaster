/* data-syndromes.js — 카드 對決 게임용 證·症狀 데이터 (v7)
 * ============================================================================
 * 26 처방 1:1 매핑된 證. 각 證은 4~5개 핵심 症狀을 가짐.
 *
 * 게임 규칙: 양측은 게임 시작 시 무작위 3개 證 후보를 받고 10초 안에 1개 선택.
 *          매 턴 자기 證의 症狀 중 하나를 골라 상대에게 공개.
 *          상대는 공개된 症狀들로 證을 추정하고, 보드의 本草를 조합해
 *          그 證에 맞는 處方(本방)을 구성하여 승리.
 *
 * 증명·증상은 各 處方의 indication 에서 추출하여 게임용으로 단축·정련.
 * ============================================================================ */

const SYNDROMES = [
  {
    id: 'syn-piwi-gihu',          formulaId: 'sagunja-tang',
    han: '脾胃氣虛證',              ko: '비위기허증',
    symptoms: ['面色萎白', '語聲低微', '氣短乏力', '食少便溏', '脈虛弱']
  },
  {
    id: 'syn-junggi-haham',         formulaId: 'bojung-iggi-tang',
    han: '中氣下陷證',              ko: '중기하함증',
    symptoms: ['脫肛子宮下垂', '久瀉', '氣虛發熱', '渴喜熱飮', '脈洪而虛無力']
  },
  {
    id: 'syn-pihu-seupseong',       formulaId: 'samryeong-baekchul-san',
    han: '脾虛濕盛證',              ko: '비허습성증',
    symptoms: ['飮食不化', '腸鳴泄瀉', '四肢乏力', '形體消瘦', '苔白膩']
  },
  {
    id: 'syn-yeonghyul-heoche',     formulaId: 'simul-tang',
    han: '營血虛滯證',              ko: '영혈허체증',
    symptoms: ['心悸眩暈', '面色無華', '月經不調', '臍腹疼痛', '脈細澁']
  },
  {
    id: 'syn-hyulheo-yangbu',       formulaId: 'danggwi-boheol-tang',
    han: '血虛陽浮發熱證',          ko: '혈허양부발열증',
    symptoms: ['肌熱面赤', '煩渴欲飮', '産後血虛發熱', '瘡瘍久不癒合', '脈洪大重按全無力']
  },
  {
    id: 'syn-gihyul-yangheo',       formulaId: 'paljin-tang',
    han: '氣血兩虛證',              ko: '기혈양허증',
    symptoms: ['面色蒼白萎黃', '頭暈眼花', '四肢倦怠', '心悸怔忡', '飮食減少']
  },
  {
    id: 'syn-gihyul-yangheo-yang',  formulaId: 'sipjeon-daebo-tang',
    han: '氣血兩虛兼陽虛證',        ko: '기혈양허겸양허증',
    symptoms: ['倦怠食少', '頭暈目眩', '自汗盜汗', '四肢不溫', '婦人崩漏癰疽潰後']
  },
  {
    id: 'syn-simbi-gihyul',         formulaId: 'guibi-tang',
    han: '心脾氣血兩虛證',          ko: '심비기혈양허증',
    symptoms: ['心悸怔忡', '健忘失眠', '盜汗虛熱', '便血皮下紫癜', '婦女崩漏量多色淡']
  },
  {
    id: 'syn-eumhyul-yangheo',      formulaId: 'jagamcho-tang',
    han: '陰血不足陽氣虛弱證',      ko: '음혈부족양기허약증',
    symptoms: ['脈結代', '心動悸', '虛羸少氣', '舌光少苔', '咳嗽涎唾多']
  },
  {
    id: 'syn-sineum-heo',           formulaId: 'yukmi-jihwang-hwan',
    han: '腎陰虛證',                ko: '신음허증',
    symptoms: ['腰膝痠軟', '耳鳴耳聾', '盜汗遺精', '骨蒸潮熱', '手足心熱舌紅少苔']
  },
  {
    id: 'syn-eumheo-hwawang',       formulaId: 'daebo-eum-hwan',
    han: '陰虛火旺證',              ko: '음허화왕증',
    symptoms: ['骨蒸潮熱', '盜汗遺精', '咳嗽咯血', '心煩易怒', '足膝疼熱痿軟尺脈數有力']
  },
  {
    id: 'syn-sinyang-bujok',        formulaId: 'singi-hwan',
    han: '腎陽不足證',              ko: '신양부족증',
    symptoms: ['腰痛脚軟', '身半以下冷感', '少腹拘急', '小便不利或反多', '痰飮水腫舌淡而胖']
  },
  {
    id: 'syn-eumbi',                formulaId: 'jihwang-eumja',
    han: '瘖痱證',                  ko: '음비증',
    symptoms: ['舌强不能言', '足廢不能用', '口乾不欲飮', '足冷面赤', '舌絳脈沈細弱']
  },
  {
    id: 'syn-piwi-heohan',          formulaId: 'ijung-hwan',
    han: '脾胃虛寒證',              ko: '비위허한증',
    symptoms: ['脘腹冷痛', '嘔吐泄瀉', '不渴腹滿', '食少', '舌淡苔白脈沈細']
  },
  {
    id: 'syn-heohan-guto',          formulaId: 'osuyu-tang',
    han: '虛寒嘔吐證',              ko: '허한구토증',
    symptoms: ['食穀欲嘔', '胃脘疼痛吞酸', '厥陰頭痛巓頂', '乾嘔吐涎沫', '手足逆冷']
  },
  {
    id: 'syn-heorogeup',            formulaId: 'sogeonjung-tang',
    han: '虛勞裏急證',              ko: '허로이급증',
    symptoms: ['腹中時痛喜溫喜按', '形體羸瘦', '心悸虛煩', '手足煩熱', '咽乾口燥脈細弦']
  },
  {
    id: 'syn-junggjojeo-heohan',    formulaId: 'daegeonjung-tang',
    han: '中焦虛弱陰寒內成證',      ko: '중초허약음한내성증',
    symptoms: ['心胸中大寒痛', '嘔不能食', '上沖皮起出見有頭足', '上下痛而不可觸近', '脈沈伏遲緊']
  },
  {
    id: 'syn-soeumbyeong-yangsoe',  formulaId: 'sayeok-tang',
    han: '少陰病陽衰陰盛證',        ko: '소음병양쇠음성증',
    symptoms: ['四肢厥逆', '惡寒蜷臥', '神衰欲寐', '面色蒼白下利', '脈微細']
  },
  {
    id: 'syn-hyulheo-hangwol',      formulaId: 'danggwi-sayeok-tang',
    han: '血虛寒厥證',              ko: '혈허한궐증',
    symptoms: ['手足厥寒', '腰股腿足骨節疼痛', '婦人經期腹痛', '男子寒疝', '脈沈細欲絶']
  },
  {
    id: 'syn-hyulbi',               formulaId: 'hwanggi-gyejigol-mul-tang',
    han: '血痺證',                  ko: '혈비증',
    symptoms: ['肌膚麻木不仁', '末梢神經病變', '脈微澁而緊', '肢體輕度疼痛', '汗出惡風(虛)']
  },
  {
    id: 'syn-soyang-yangmyeong',    formulaId: 'daesiho-tang',
    han: '少陽陽明合病',            ko: '소양양명합병',
    symptoms: ['往來寒熱', '胸脇苦滿', '嘔不止', '心下痞硬大便不解', '舌苔黃脈弦數有力']
  },
  {
    id: 'syn-pungyeol-pyori',       formulaId: 'bangpung-tongseong-san',
    han: '風熱壅盛表裏俱實證',      ko: '풍열옹성표리구실증',
    symptoms: ['憎寒壯熱', '頭目昏眩', '口苦咽乾喉嚨不利', '胸膈痞悶涕唾稠粘', '二便閉澁脈滑數']
  },
  {
    id: 'syn-pyo-mi-hae-yeolri',    formulaId: 'galgeun-hwanggeum-hwangryeon-tang',
    han: '表證未解邪熱入裏證',      ko: '표증미해사열입리증',
    symptoms: ['身熱下利臭穢', '肛門灼熱', '心下痞胸脘煩熱', '口乾作渴', '喘而汗出舌紅苔黃']
  },
  {
    id: 'syn-pyojeung-rinrye-chi',  formulaId: 'seokgo-tang',
    han: '傷寒表證未解裏熱已熾證',  ko: '상한표증미해리열이치증',
    symptoms: ['壯熱無汗', '身體拘急', '面赤目赤', '鼻乾口渴煩躁不眠', '神昏譫語脈滑數']
  },
  {
    id: 'syn-ojeok',                formulaId: 'ojeoksan',
    han: '五積證',                  ko: '오적증',
    symptoms: ['頭身痛惡寒無汗', '胸脘痞滿', '腹痛嘔逆', '泄瀉', '舌苔白膩脈沈遲弦']
  },
  {
    id: 'syn-piwiheo-pyo-mi-hae',   formulaId: 'gyeji-insam-tang',
    han: '脾胃虛寒表證未解證',      ko: '비위허한표증미해증',
    symptoms: ['惡寒發熱', '頭痛', '心下痞硬', '下利不止', '飮食不化舌淡苔白脈虛']
  },
];

// 게임에서 사용: 證 빠른 조회 by formulaId / id
const SYNDROME_BY_FORMULA = {};
const SYNDROME_BY_ID = {};
SYNDROMES.forEach(s => {
  SYNDROME_BY_FORMULA[s.formulaId] = s;
  SYNDROME_BY_ID[s.id] = s;
});
