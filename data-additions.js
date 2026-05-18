/* data-additions.js — 方劑學 v9.4 처방별 加減 데이터
 * ============================================================================
 * 19 처방의 加減法 (증상 → 가감약물) 구조화.
 *   ※ v10.0.8 — 6장 溫裏劑 7處方 加減 블록 제거 (2차 수시 범위 외).
 *
 * 출처: 강의 PDF [배오·가감] 항 + 22학번 기출 + 北京中醫藥大學 統編教材 加減法 절.
 *
 * 분류:
 *   - symptom: 증상/병기 (한문 원문) — 카드 앞면에 노출
 *   - symptomKo: 한글 해설 (학습 보조)
 *   - mod: 가감 요약 (한문, 예: '加桂枝', '去白朮加附子', '+陳皮 → 異功散')
 *   - herbs: 가감되는 본초 배열 (한자, 정답 채점용)
 *   - remove: 제거되는 본초 배열 (있을 때만)
 *   - target: 가감 후 새 처방명 (있을 때만, 派生方)
 *   - note: 가감 의의·機轉 (해설용)
 *   - kind: 'symptom'(증상 가감) | 'derive'(派生方) | 'compose'(構成변형)
 * ============================================================================ */

const FORMULA_ADDITIONS = {
  // ════════════════════ 8장 補益劑 ════════════════════
  'sagunja-tang': {
    items: [
      { symptom: '兼痰濕(脘悶·咳痰)', symptomKo: '담습을 겸함 (가슴이 답답하고 가래가 있음)',
        mod: '+陳皮 → 異功散', herbs: ['陳皮'], target: '異功散',
        kind: 'derive', note: '理氣化痰. 氣虛 + 氣滯의 兼證에' },
      { symptom: '兼痰濕嘔吐(脾胃氣虛痰濕)', symptomKo: '담습이 더 심해 구토까지 함',
        mod: '+陳皮·半夏 → 六君子湯', herbs: ['陳皮','半夏'], target: '六君子湯',
        kind: 'derive', note: '燥濕化痰·降逆止嘔. 異功散 + 半夏' },
      { symptom: '兼氣滯痰濕(脘腹脹滿·嘔逆)', symptomKo: '기체·담습으로 배가 빵빵하고 구역질',
        mod: '+陳皮·半夏·木香·砂仁 → 香砂六君子湯', herbs: ['陳皮','半夏','木香','砂仁'], target: '香砂六君子湯',
        kind: 'derive', note: '益氣化痰·行氣溫中. ★기출(22)' },
    ]
  },

  'bojung-iggi-tang': {
    items: [
      { symptom: '少陰人 體質(本方 升麻·柴胡 不耐)', symptomKo: '소음인 체질(이제마)',
        mod: '去 升麻·柴胡, 加 藿香·蘇葉', herbs: ['藿香','蘇葉'], remove: ['升麻','柴胡'],
        target: '少陰人補中益氣湯', kind: 'derive', note: '★기출(22). 이제마 加減 — 少陰人은 辛凉之味가 不適' },
      { symptom: '腹痛 偏盛', symptomKo: '복통이 두드러짐',
        mod: '加 白芍', herbs: ['白芍'], kind: 'symptom', note: '緩急止痛' },
      { symptom: '頭痛', symptomKo: '두통',
        mod: '加 蔓荊子·川芎(白芷)', herbs: ['蔓荊子','川芎'], kind: 'symptom', note: '祛風止痛, 升淸頭目' },
      { symptom: '咳嗽', symptomKo: '기침',
        mod: '加 五味子·麥門冬', herbs: ['五味子','麥門冬'], kind: 'symptom', note: '斂肺止咳·養陰' },
      { symptom: '兼氣滯(脘腹脹)', symptomKo: '氣滯로 인한 복부 팽만',
        mod: '加 木香·枳殼', herbs: ['木香','枳殼'], kind: 'symptom', note: '行氣寬中' },
    ]
  },

  'samryeong-baekchul-san': {
    items: [
      { symptom: '兼寒(腹冷·四肢不溫)', symptomKo: '한증이 겸함',
        mod: '加 乾薑·肉桂', herbs: ['乾薑','肉桂'], kind: 'symptom', note: '溫中散寒' },
      { symptom: '久瀉·脫肛', symptomKo: '오랜 설사·탈항',
        mod: '加 升麻·柴胡', herbs: ['升麻','柴胡'], kind: 'symptom', note: '升陽擧陷' },
      { symptom: '兼肺虛久咳', symptomKo: '폐허로 오랜 기침',
        mod: '加 紫菀·款冬花', herbs: ['紫菀','款冬花'], kind: 'symptom', note: '潤肺止咳. 培土生金' },
    ]
  },

  'simul-tang': {
    items: [
      { symptom: '血瘀經閉·瘀痛', symptomKo: '어혈로 인한 월경부조·통증',
        mod: '+桃仁·紅花 → 桃紅四物湯', herbs: ['桃仁','紅花'], target: '桃紅四物湯',
        kind: 'derive', note: '養血活血祛瘀. ★기출(22) 適應症: 經行腹痛·經行血塊' },
      { symptom: '氣血兩虛(出血後 등)', symptomKo: '기혈양허(실혈 후)',
        mod: '+人蔘·黃耆 → 聖愈湯', herbs: ['人蔘','黃耆'], target: '聖愈湯',
        kind: 'derive', note: '補氣攝血' },
      { symptom: '春 — 風邪 加感', symptomKo: '봄철 풍사 兼感',
        mod: '加 防風', herbs: ['防風'], kind: 'symptom', note: '계절가감 (강조 기출)' },
      { symptom: '夏 — 暑熱', symptomKo: '여름철 서열',
        mod: '加 黃芩', herbs: ['黃芩'], kind: 'symptom', note: '계절가감 (강조 기출)' },
      { symptom: '秋 — 燥', symptomKo: '가을철 조사',
        mod: '加 天門冬', herbs: ['天門冬'], kind: 'symptom', note: '계절가감 (강조 기출)' },
      { symptom: '冬 — 寒', symptomKo: '겨울철 한사',
        mod: '加 桂枝', herbs: ['桂枝'], kind: 'symptom', note: '계절가감 (강조 기출)' },
    ]
  },

  'danggwi-boheol-tang': {
    items: [
      { symptom: '婦人 經期·産後 血虛發熱', symptomKo: '부인 월경기·산후 혈허발열',
        mod: '加 生地黃·阿膠', herbs: ['生地黃','阿膠'], kind: 'symptom', note: '滋陰養血' },
      { symptom: '瘡瘍潰後 久不癒合', symptomKo: '창양이 곪은 후 오래 낫지 않음',
        mod: '加 銀花·連翹·皁角刺', herbs: ['銀花','連翹','皁角刺'], kind: 'symptom', note: '托毒生肌' },
    ]
  },

  'paljin-tang': {
    items: [
      { symptom: '兼陽虛(畏寒·四肢不溫)', symptomKo: '양허를 겸함',
        mod: '+黃耆·肉桂 → 十全大補湯', herbs: ['黃耆','肉桂'], target: '十全大補湯',
        kind: 'derive', note: '溫補氣血. ★기출(22)' },
      { symptom: '兼心神不寧·虛勞重證', symptomKo: '심신불안·허로 중증',
        mod: '+陳皮·遠志·五味子·肉桂 → 人蔘養榮湯', herbs: ['陳皮','遠志','五味子','肉桂'], target: '人蔘養榮湯',
        kind: 'derive', note: '十全大補湯 변형 — 養心安神 兼' },
    ]
  },

  'sipjeon-daebo-tang': {
    items: [
      { symptom: '虛勞 + 心神不寧', symptomKo: '허로에 심신불안',
        mod: '加 陳皮·遠志·五味子(除川芎) → 人蔘養榮湯', herbs: ['陳皮','遠志','五味子'], target: '人蔘養榮湯',
        kind: 'derive', note: '養心安神 強化' },
      { symptom: '癰疽不斂', symptomKo: '옹저가 아물지 않음',
        mod: '本方 그대로 사용 — 肉桂가 引火歸元', herbs: [], kind: 'symptom',
        note: '응용. 肉桂의 引火歸元 작용으로 收口' },
    ]
  },

  'guibi-tang': {
    items: [
      { symptom: '崩漏·月經量多 不止', symptomKo: '붕루·월경 다량',
        mod: '加 阿膠·艾葉', herbs: ['阿膠','艾葉'], kind: 'symptom', note: '止血固崩' },
      { symptom: '便血 鮮紅', symptomKo: '선홍색 변혈',
        mod: '加 地楡·槐花', herbs: ['地楡','槐花'], kind: 'symptom', note: '凉血止血' },
      { symptom: '兼鬱熱(口苦·心煩)', symptomKo: '울열을 겸함',
        mod: '加 牡丹皮·梔子 → 加味歸脾湯', herbs: ['牡丹皮','梔子'], target: '加味歸脾湯',
        kind: 'derive', note: '清肝瀉火. 思慮過度로 心肝鬱熱 兼한 경우' },
    ]
  },

  'jagamcho-tang': {
    items: [
      { symptom: '心陰虛·心火亢(虛煩失眠 重)', symptomKo: '심음허·심화항 — 허번불면 重',
        mod: '加 黃連·梔子', herbs: ['黃連','梔子'], kind: 'symptom', note: '清心除煩' },
      { symptom: '陰虛火旺(去 桂枝·生薑·清酒, 加 白芍·麥冬·五味子)', symptomKo: '온약 제거, 양음약 강화',
        mod: '→ 加減復脈湯 (吳鞠通)', herbs: ['白芍'], remove: ['桂枝','生薑'], target: '加減復脈湯',
        kind: 'derive', note: '吳鞠通 변방 — 純粹 滋陰. 溫病 후기 真陰欲竭' },
    ]
  },

  'yukmi-jihwang-hwan': {
    items: [
      { symptom: '陰虛火旺(骨蒸·盜汗)', symptomKo: '陰虛火旺 — 골증·도한',
        mod: '+知母·黃柏 → 知柏地黃丸', herbs: ['知母','黃柏'], target: '知柏地黃丸',
        kind: 'derive', note: '滋陰降火. ★錢氏加減 ① (기출 必出)' },
      { symptom: '肺腎陰虛(喘咳·盜汗)', symptomKo: '폐신음허 — 천식·도한',
        mod: '+麥門冬·五味子 → 麥味地黃丸', herbs: ['麥門冬','五味子'], target: '麥味地黃丸',
        kind: 'derive', note: '滋腎益肺. ★錢氏加減 ② (별명 八仙長壽丸)' },
      { symptom: '肝腎陰虛·目暗昏花', symptomKo: '간신음허 — 눈이 침침',
        mod: '+枸杞子·菊花 → 杞菊地黃丸', herbs: ['枸杞子','菊花'], target: '杞菊地黃丸',
        kind: 'derive', note: '滋腎養肝明目. ★錢氏加減 ③' },
      { symptom: '腎虛喘嗽·氣喘(腎不納氣)', symptomKo: '신허로 인한 천수·氣喘',
        mod: '+五味子 → 都氣丸', herbs: ['五味子'], target: '都氣丸',
        kind: 'derive', note: '納氣平喘. ★錢氏加減 ④' },
    ]
  },

  'daebo-eum-hwan': {
    items: [
      { symptom: '陰虛盜汗 重', symptomKo: '陰虛 도한이 심함',
        mod: '加 浮小麥·糯稻根·牡蠣', herbs: ['浮小麥','牡蠣'], kind: 'symptom', note: '斂汗' },
      { symptom: '咳血·咯血', symptomKo: '객혈·각혈',
        mod: '加 仙鶴草·白芨·阿膠', herbs: ['仙鶴草','阿膠'], kind: 'symptom', note: '凉血止血' },
      { symptom: '遺精不止', symptomKo: '유정이 그치지 않음',
        mod: '加 金櫻子·芡實·桑螵蛸', herbs: ['金櫻子','芡實'], kind: 'symptom', note: '固精止遺' },
    ]
  },

  'singi-hwan': {
    items: [
      { symptom: '腎虛水腫·小便不利', symptomKo: '신허 부종·소변불리',
        mod: '+牛膝·車前子 → 濟生腎氣丸', herbs: ['牛膝','車前子'], target: '濟生腎氣丸',
        kind: 'derive', note: '利水消腫. 嚴用和 변방' },
      { symptom: '腎陽虛重證(無陰虛火旺)', symptomKo: '신양허 重證 — 三補만 强化',
        mod: '本方 + 鹿角膠·杜仲·菟絲子·當歸·枸杞 등 → 右歸丸', herbs: ['鹿角膠','杜仲','菟絲子','當歸','枸杞子'], target: '右歸丸',
        kind: 'derive', note: '張介賓 변방. 純補無瀉 (三瀉 去). ★기출' },
    ]
  },

  'jihwang-eumja': {
    items: [
      { symptom: '痰火(舌苔黃·脈滑數)', symptomKo: '痰火 兼',
        mod: '去 附子·肉桂, 加 川貝·竹瀝', herbs: ['川貝母','竹瀝'], remove: ['附子','肉桂'],
        kind: 'symptom', note: '清化痰熱. 痰熱이 重하면 溫陽藥 去' },
      { symptom: '陰虛 偏盛(舌絳·脈細數)', symptomKo: '음허가 더 두드러짐',
        mod: '減 附子·肉桂, 加 玄蔘·麥冬', herbs: ['玄蔘','麥冬'], kind: 'symptom', note: '滋陰更强' },
    ]
  },

  // ════════════════════ 7장 表裏雙解劑 ════════════════════
  'daesiho-tang': {
    items: [
      { symptom: '黃疸(濕熱)', symptomKo: '습열 황달',
        mod: '加 茵蔯·梔子', herbs: ['茵蔯','梔子'], kind: 'symptom', note: '清熱利濕退黃' },
      { symptom: '胆石症 兼 脇下絞痛', symptomKo: '담석 兼 협하 교통',
        mod: '加 鬱金·金錢草', herbs: ['鬱金','金錢草'], kind: 'symptom', note: '利胆排石. 現代 응용' },
      { symptom: '原方 構成 派生(小柴胡湯에서)', symptomKo: '小柴胡湯 + 大黃·枳實·白芍, - 人蔘·甘草',
        mod: '小柴胡湯 + 大黃·枳實·白芍 - 人蔘·甘草', herbs: ['大黃','枳實','白芍'], remove: ['人蔘','甘草'], target: '大柴胡湯',
        kind: 'derive', note: '★기출(15 객, 22). 소시호 + 소승기 의미' },
    ]
  },

  'bangpung-tongseong-san': {
    items: [
      { symptom: '熱毒重·瘡瘍', symptomKo: '열독이 심함·창양',
        mod: '加 銀花·紫花地丁', herbs: ['銀花','紫花地丁'], kind: 'symptom', note: '清熱解毒' },
      { symptom: '裏熱 偏盛(無表證)', symptomKo: '裏熱 偏盛 — 표증 없음',
        mod: '減 麻黃·防風·荊芥, 加重 石膏·黃芩', herbs: [], remove: ['麻黃'], kind: 'symptom',
        note: '解表藥 減量. 表證이 없으면 발한 不必' },
      { symptom: '本方의 合方 出處', symptomKo: '본방의 기본 합방',
        mod: '麻黃湯 + 承氣湯 + 白虎湯 + 四物湯 + 桔梗湯 등 諸方 合', herbs: [], target: '防風通聖散',
        kind: 'compose', note: '★기출(19,20,22). 汗·下·清 三法 同時' },
    ]
  },

  'galgeun-hwanggeum-hwangryeon-tang': {
    items: [
      { symptom: '兼嘔(熱이 胃를 침범)', symptomKo: '구토 兼',
        mod: '加 半夏·竹茹', herbs: ['半夏','竹茹'], kind: 'symptom', note: '降逆止嘔' },
      { symptom: '腹痛 偏盛', symptomKo: '복통이 두드러짐',
        mod: '加 白芍·木香', herbs: ['白芍','木香'], kind: 'symptom', note: '緩急止痛' },
      { symptom: '構成 派生(葛根湯에서)', symptomKo: '葛根湯 변형',
        mod: '葛根湯 - 麻黃·桂枝·芍藥·生薑·大棗, + 黃芩·黃連', herbs: ['黃芩','黃連'],
        remove: ['麻黃','桂枝','芍藥','生薑','大棗'], target: '葛根黃芩黃連湯',
        kind: 'derive', note: '★서술기출(20,22). 解表 + 清裡로 변모' },
    ]
  },

  'seokgo-tang': {
    items: [
      { symptom: '神昏譫語 重(熱入心包)', symptomKo: '신혼섬어 — 熱入心包',
        mod: '加 安宮牛黃丸·紫雪丹(別法)', herbs: [], kind: 'symptom', note: '清心開竅. 救急用' },
      { symptom: '熱結便閉', symptomKo: '熱結便閉',
        mod: '加 大黃·芒硝', herbs: ['大黃','芒硝'], kind: 'symptom', note: '通腑泄熱' },
    ]
  },

  'ojeoksan': {
    items: [
      { symptom: '寒積 偏盛(冷痛 重)', symptomKo: '한적이 더 두드러짐',
        mod: '加 吳茱萸·附子', herbs: ['吳茱萸','附子'], kind: 'symptom', note: '溫陽散寒' },
      { symptom: '氣積(脘腹脹滿 重)', symptomKo: '기적 — 가슴·배 창만',
        mod: '加 香附·烏藥', herbs: ['香附','烏藥'], kind: 'symptom', note: '行氣解鬱' },
      { symptom: '血積(刺痛·瘀血)', symptomKo: '혈적 — 자통·어혈',
        mod: '加 桃仁·紅花', herbs: ['桃仁','紅花'], kind: 'symptom', note: '活血祛瘀' },
      { symptom: '痰積', symptomKo: '담적',
        mod: '加 南星·瓜蔞', herbs: ['南星','瓜蔞'], kind: 'symptom', note: '化痰' },
      { symptom: '食積', symptomKo: '식적',
        mod: '加 山楂·神麯·麥芽', herbs: ['山楂','神麯','麥芽'], kind: 'symptom', note: '消食導滯' },
    ]
  },

  'gyeji-insam-tang': {
    items: [
      { symptom: '原方 構成(理中湯에서)', symptomKo: '理中湯 + 桂枝',
        mod: '理中湯 + 桂枝', herbs: ['桂枝'], target: '桂枝人蔘湯',
        kind: 'derive', note: '解表(桂枝) + 溫裏(理中) 同時. 表裏俱寒虛' },
      { symptom: '惡寒重(表寒甚)', symptomKo: '오한이 심함',
        mod: '加重 桂枝, 加 生薑', herbs: ['生薑'], kind: 'symptom', note: '辛溫解表' },
      { symptom: '下利不止', symptomKo: '설사가 그치지 않음',
        mod: '加 茯苓·肉豆蔻', herbs: ['茯苓','肉豆蔻'], kind: 'symptom', note: '利水止瀉' },
    ]
  },
};

// 본초 동의어/표기 변이 — 한자 정식명 → 별칭 배열 (한글/이체자/약명변형)
const HERB_ALIASES = {
  '人蔘': ['인삼','人参'],
  '黃耆': ['황기','黃芪','黄耆','黄芪'],
  '白朮': ['백출','白术'],
  '蒼朮': ['창출','苍术'],
  '甘草': ['감초','炙甘草','甘草(炙)'],
  '山藥': ['산약','山药'],
  '大棗': ['대조','대추','大枣'],
  '熟地黃': ['숙지황','熟地','熟地黄'],
  '生地黃': ['생지황','生地','生地黄'],
  '當歸': ['당귀','当归'],
  '白芍': ['백작약','백작','白芍藥','白芍药','芍藥','芍药','작약'],
  '赤芍': ['적작약','적작','赤芍藥'],
  '川芎': ['천궁'],
  '阿膠': ['아교','阿胶'],
  '麥門冬': ['맥문동','麥冬','麦门冬','麦冬'],
  '五味子': ['오미자'],
  '枸杞子': ['구기자','枸杞'],
  '附子': ['부자','附子(炮)','附子(生)','炮附子','生附子'],
  '肉桂': ['육계'],
  '桂枝': ['계지','桂'],
  '鹿角膠': ['녹각교','鹿角胶'],
  '杜仲': ['두충'],
  '菟絲子': ['토사자','菟丝子'],
  '乾薑': ['건강','干姜'],
  '生薑': ['생강','生姜'],
  '吳茱萸': ['오수유','吴茱萸'],
  '細辛': ['세신'],
  '茯苓': ['복령'],
  '澤瀉': ['택사','泽泻'],
  '薏苡仁': ['의이인','薏仁','율무'],
  '滑石': ['활석'],
  '酸棗仁': ['산조인','酸枣仁'],
  '遠志': ['원지','远志'],
  '麻黃': ['마황','麻黄'],
  '防風': ['방풍','防风'],
  '荊芥': ['형개','荆芥'],
  '葛根': ['갈근'],
  '柴胡': ['시호'],
  '升麻': ['승마'],
  '薄荷': ['박하'],
  '白芷': ['백지'],
  '黃芩': ['황금','黄芩'],
  '黃連': ['황련','黄连'],
  '黃柏': ['황백','黄柏'],
  '梔子': ['치자','栀子'],
  '知母': ['지모'],
  '石膏': ['석고'],
  '牡丹皮': ['목단피','丹皮'],
  '連翹': ['연교','连翘'],
  '香豉': ['향시','淡豆豉','담두시'],
  '陳皮': ['진피','陈皮'],
  '半夏': ['반하'],
  '厚朴': ['후박'],
  '枳殼': ['지각','枳壳'],
  '枳實': ['지실','枳实'],
  '桔梗': ['길경'],
  '白扁豆': ['백편두','扁豆'],
  '蓮子肉': ['연자육','蓮子','莲子肉'],
  '砂仁': ['사인'],
  '木香': ['목향'],
  '大黃': ['대황','大黄'],
  '芒硝': ['망초'],
  '麻仁': ['마자인','麻子仁','火麻仁'],
  '蜂蜜': ['봉밀','꿀'],
  '藿香': ['곽향'],
  '蘇葉': ['소엽','紫蘇葉','자소엽'],
  '蔓荊子': ['만형자','蔓荆子'],
  '桃仁': ['도인'],
  '紅花': ['홍화'],
  '天門冬': ['천문동','天冬'],
  '艾葉': ['애엽','쑥'],
  '地楡': ['지유','地榆'],
  '槐花': ['괴화'],
  '紫菀': ['자완'],
  '款冬花': ['관동화'],
  '銀花': ['은화','金銀花','금은화','金银花'],
  '皁角刺': ['조각자','皂角刺'],
  '浮小麥': ['부소맥'],
  '牡蠣': ['모려','굴껍질','牡蛎'],
  '仙鶴草': ['선학초','仙鹤草'],
  '金櫻子': ['금앵자','金樱子'],
  '芡實': ['검실','芡实'],
  '牛膝': ['우슬'],
  '車前子': ['차전자','车前子'],
  '川貝母': ['천패모','貝母','川贝母'],
  '竹瀝': ['죽력','竹沥'],
  '玄蔘': ['현삼','元蔘','玄参'],
  '麥冬': ['맥동'],
  '茵蔯': ['인진','茵陳','茵陈'],
  '鬱金': ['울금','郁金'],
  '金錢草': ['금전초','金钱草'],
  '紫花地丁': ['자화지정'],
  '南星': ['남성','膽南星','담남성','天南星'],
  '瓜蔞': ['과루','瓜萎'],
  '山楂': ['산사','山查'],
  '神麯': ['신곡','神曲'],
  '麥芽': ['맥아'],
  '香附': ['향부','香附子'],
  '烏藥': ['오약','乌药'],
  '肉豆蔻': ['육두구','肉豆蔻仁'],
  '竹茹': ['죽여'],
  '菊花': ['국화'],
  // 처방명에 등장 (派生方에서 가끔 필요)
};

// 한글/별칭 → 한자 정식명 역인덱스 (한 본초 1개에 여러 별칭이 mapping → 정식 한자명 하나)
const HERB_NORM_INDEX = (() => {
  const idx = {};
  for(const [han, aliases] of Object.entries(HERB_ALIASES)){
    idx[han] = han;
    aliases.forEach(a => { idx[a] = han; });
  }
  return idx;
})();

if(typeof window !== 'undefined'){
  window.FORMULA_ADDITIONS = FORMULA_ADDITIONS;
  window.HERB_ALIASES = HERB_ALIASES;
  window.HERB_NORM_INDEX = HERB_NORM_INDEX;
}
