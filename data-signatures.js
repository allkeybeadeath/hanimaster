/* data-signatures.js — v9.7
 * ============================================================================
 * 캐릭터 시그니처 — 솔로 학습 전용, 멀티 무영향
 *
 * ─── 三段 효과 체계 ───────────────────────────────────────────────────────
 *
 *   章典 (zhang-dian, chapter mastery)
 *     트리거: 문제의 formula 가 캐릭터의 chapters 집합에 속함
 *     효과 : 솔로 +10% 氣 (해당 문제 1점이 11점이 되는 식이 아니라,
 *            퀴즈 종료 시 합산 +10% 보너스로 적용)
 *     시각 : 정답 직후 메달리온 코너에서 0.8초 등장 + seal 한자 도장
 *     소리 : 짧은 古琴 chord (sound: 'wood')
 *
 *   逸品 (yi-pin, signature formula)
 *     트리거: 문제의 formula.id 가 캐릭터의 signatures 배열에 포함
 *     효과 : 솔로 +25% 氣 (해당 문제 분만큼)
 *     시각 : 풀화면 한문 인용 1.6초 + 캐릭터 색 배경 광채
 *     소리 : 더 풍부한 chord (sound: 'gold' 등)
 *
 *   絕學 (jue-xue, master combo)
 *     트리거: 한 퀴즈 안에서 逸品 5회 연속 발동
 *     효과 : 추가 +50% (회당 1회만, 같은 퀴즈 내 중복 X)
 *     시각 : "絕學" 大印 2초 + 메달리온 360° 회전
 *
 * ─── 멀티 비활성 ─────────────────────────────────────────────────────────
 *
 *   對決(battles) / 카드對決(card_battles) / 큐브(cube_rooms):
 *     - 시그니처 효과 발동 시 점수 영향 없음 (보너스 0)
 *     - 시각 효과도 자기 화면에만 minimal 표시 (상대에게 안 보임)
 *     - 對決開始 인트로의 캐릭터 quote 는 기존 시스템 유지 (변경 없음)
 *
 * ─── 매핑 키 ─────────────────────────────────────────────────────────────
 *
 *   chapters     : string[] - formula.chapter 부분일치 시 章典 발동
 *                  e.g. ['補氣','補血'] → '8장 補益劑·補氣' 매칭
 *   signatures   : string[] - formula.id 정확 일치 시 逸品 발동
 *   keywords     : string[] - q.q/explanation/question 텍스트에 등장 시
 *                  章典 보조 트리거 (formula 정보가 없는 일반 문제용)
 *   color        : #hex   - 시그니처 색 (배경 광채·도장 배경)
 *   seal         : 1-2 char - 도장에 박힐 한자
 *   quote        : {han, ko, src} - 逸品 발동 시 풀화면 인용
 *   sound        : 'gold' | 'silver' | 'jade' | 'wood' | 'silk' (효과음 종류)
 *   line         : (옵션) 짧은 한국어 한 줄 — 캐릭터의 음성 같은 멘트
 *
 * 시그니처 미정의 캐릭터: 효과 비활성 (평범한 학습 흐름)
 * ============================================================================ */

const CHAR_SIGNATURES = {

  // ═══ 神階 (5) ════════════════════════════════════════════════════════════
  huangdi: {
    chapters: [],
    signatures: [],
    keywords: ['內經','黃帝','素問','靈樞','上工治未病','上古天眞','陰陽應象'],
    color: '#C9A227', seal: '帝',
    quote: { han: '上工治未病，不治已病', ko: '상공은 병들기 전에 다스리니, 이미 든 병을 다스리지 않는다', src: '素問·四氣調神大論' },
    sound: 'jade',
    line: '朕이 일찍이 岐伯에게 물으니…',
  },
  shennong: {
    chapters: [],
    signatures: [],
    keywords: ['本草','嘗百草','五味','四氣','歸經','神農','黃耆','人蔘','甘草','當歸'],
    color: '#5C8F3A', seal: '農',
    quote: { han: '藥有酸鹹甘苦辛五味，又有寒熱溫凉四氣', ko: '약에는 다섯 맛이 있고, 또 네 기운이 있다', src: '神農本草經·序錄' },
    sound: 'wood',
    line: '草木 百種을 일찍이 맛보았노라.',
  },
  fuxi: {
    chapters: [], signatures: [],
    keywords: ['八卦','陰陽','卦','一陰一陽','繫辭'],
    color: '#6E5396', seal: '羲',
    quote: { han: '一陰一陽之謂道', ko: '한 번 음하고 한 번 양함을 일러 도라 한다', src: '易傳·繫辭上' },
    sound: 'silver',
    line: '陰陽이 갈리니 道가 비로소 서리라.',
  },
  nvwa: {
    chapters: [], signatures: [],
    keywords: ['五色','補天','造人'],
    color: '#C04848', seal: '媧',
    quote: { han: '鍊五色石以補蒼天', ko: '오색 돌을 단련하여 푸른 하늘을 깁다', src: '淮南子·覽冥訓' },
    sound: 'silver',
    line: '五色 돌이 빈 하늘을 메우리.',
  },
  qibo: {
    chapters: [], signatures: [],
    keywords: ['內經','岐伯','黃帝','素問','靈樞','治未病','四氣調神'],
    color: '#C9A227', seal: '岐',
    quote: { han: '虛邪賊風，避之有時；恬惔虛無，眞氣從之', ko: '허사적풍은 때를 피하고, 텅 비고 담박하면 진기가 따른다', src: '素問·上古天眞論' },
    sound: 'jade',
    line: '臣 岐伯, 對曰…',
  },

  // ═══ 先秦~漢魏六朝 (10) ═════════════════════════════════════════════════
  bianque: {
    chapters: [], signatures: [],
    keywords: ['四診','望聞問切','史記','虢太子','扁鵲'],
    color: '#2A7060', seal: '鵲',
    quote: { han: '人之所病，病疾多；醫之所病，病道少', ko: '사람의 병은 많고, 의가의 병은 道가 적다', src: '史記·扁鵲倉公列傳' },
    sound: 'wood',
  },
  zhongjing: {
    chapters: ['溫裏','溫中','溫經','回陽','表裏雙解','陰陽兼補'],
    signatures: [
      'jagamcho-tang','singi-hwan',
      'ijung-hwan','osuyu-tang','sogeonjung-tang','daegeonjung-tang',
      'sayeok-tang','danggwi-sayeok-tang','hwanggi-gyejigol-mul-tang',
      'daesiho-tang','galgeun-hwanggeum-hwangryeon-tang','gyeji-insam-tang',
    ],
    keywords: ['傷寒論','金匱要略','張仲景','仲景','桂枝','麻黃','少陰病','太陽病','陽明病'],
    color: '#9C3030', seal: '聖',
    quote: { han: '勤求古訓，博采衆方', ko: '옛 가르침을 부지런히 찾고, 여러 처방을 널리 모으다', src: '傷寒雜病論·序' },
    sound: 'gold',
    line: '勤求古訓하여 衆方을 모았노라.',
  },
  huatuo: {
    chapters: [], signatures: [],
    keywords: ['麻沸散','五禽戲','華佗','外科','刳腸'],
    color: '#2A7060', seal: '佗',
    quote: { han: '人體欲得勞動，但不當使極耳', ko: '몸은 움직이고자 하나 다만 지나치게 하지 말 것이다', src: '後漢書·華佗傳' },
    sound: 'wood',
  },
  wangshuhe: {
    chapters: [], signatures: [],
    keywords: ['脈經','二十四脈','王叔和'],
    color: '#876A36', seal: '脈',
    quote: { han: '脈理精微，其體難辨', ko: '맥의 이치는 정미하여 그 체를 분간하기 어렵다', src: '脈經·序' },
    sound: 'silver',
  },
  huangfumi: {
    chapters: [], signatures: [],
    keywords: ['鍼灸甲乙經','皇甫謐'],
    color: '#876A36', seal: '甲',
    quote: { han: '夫醫者非仁愛之士不可托', ko: '무릇 의자는 어진 자가 아니면 부탁할 수 없다', src: '鍼灸甲乙經·序' },
    sound: 'silver',
  },
  taohongjing: {
    chapters: [], signatures: [],
    keywords: ['本草經集注','陶弘景','歸經','藥性'],
    color: '#876A36', seal: '陶',
    quote: { han: '一物有一物之性', ko: '한 약은 한 약의 성품이 있다', src: '本草經集注' },
    sound: 'wood',
  },
  chaoyuanfang: {
    chapters: [], signatures: [],
    keywords: ['諸病源','病源','巢氏'],
    color: '#876A36', seal: '巢',
    quote: { han: '凡病之起，必有所因', ko: '무릇 병이 일어남에는 반드시 까닭이 있다', src: '諸病源候論' },
    sound: 'wood',
  },

  // ═══ 隋唐 (3) ═══════════════════════════════════════════════════════════
  sunsimiao: {
    chapters: [], signatures: [],
    keywords: ['千金','大醫精誠','孫思邈','備急'],
    color: '#C9A227', seal: '醫',
    quote: { han: '大醫精誠，無欲無求', ko: '큰 의원은 정성스럽고 진실하며 욕심도 구함도 없다', src: '備急千金要方·大醫精誠' },
    sound: 'jade',
    line: '大醫는 精하고 誠하여라.',
  },
  wangbing: {
    chapters: [], signatures: [],
    keywords: ['素問','王冰','次注','重廣補注','運氣七篇'],
    color: '#876A36', seal: '冰',
    quote: { han: '經文奧義，當以類求', ko: '경의 깊은 뜻은 마땅히 유추로써 구해야 한다', src: '重廣補注黃帝內經素問序' },
    sound: 'silver',
  },
  wangtao: {
    chapters: [], signatures: [],
    keywords: ['外台秘要','王燾'],
    color: '#876A36', seal: '燾',
    quote: { han: '集衆方之大成', ko: '여러 처방의 큰 성취를 모았다', src: '外台秘要' },
    sound: 'silver',
  },

  // ═══ 宋 (4) ═════════════════════════════════════════════════════════════
  qianyi: {
    chapters: [],
    signatures: ['yukmi-jihwang-hwan'],
    keywords: ['小兒','錢乙','六味','直訣'],
    color: '#2C2E48', seal: '乙',
    quote: { han: '小兒臟腑柔弱，易虛易實', ko: '소아는 장부가 유약하여 쉽게 허해지고 쉽게 실해진다', src: '小兒藥證直訣' },
    sound: 'silver',
    line: '소아의 體는 純陽이라.',
  },
  chenziming: {
    chapters: [], signatures: [],
    keywords: ['婦人大全','陳自明'],
    color: '#C04848', seal: '婦',
    quote: { han: '婦人之病，與男子十有九同，惟經孕産特異', ko: '부인의 병은 남자와 십중 아홉이 같고 경·임·산만 특이하다', src: '婦人大全良方' },
    sound: 'silk',
  },
  yanyonghe: {
    chapters: ['氣血雙補'],
    signatures: ['guibi-tang'],
    keywords: ['濟生方','嚴用和','歸脾'],
    color: '#C04848', seal: '濟',
    quote: { han: '思慮過度，勞傷心脾', ko: '생각이 지나치면 심비를 노상한다', src: '濟生方·健忘論治' },
    sound: 'silk',
    line: '思慮 過度함이 곧 病의 始라.',
  },
  chenshiwen: {
    chapters: [], signatures: [],
    keywords: ['和劑局方','陳師文'],
    color: '#876A36', seal: '局',
    quote: { han: '官修方書，惠及四方', ko: '관에서 처방서를 짓되 사방에 혜를 주다', src: '太平惠民和劑局方·序' },
    sound: 'silver',
  },

  // ═══ 金元四大家 + 王好古 (5) ════════════════════════════════════════════
  liuwansu: {
    chapters: ['表裏雙解','陰陽兼補','陰陽幷補'],
    signatures: ['bangpung-tongseong-san','jihwang-eumja'],
    keywords: ['河間','劉完素','宣明論','火熱','寒涼派'],
    color: '#C04848', seal: '河',
    quote: { han: '六氣皆從火化', ko: '六氣가 모두 火를 좇아 化하다', src: '素問玄機原病式' },
    sound: 'gold',
    line: '六氣皆從火化라.',
  },
  zhangcongzheng: {
    chapters: [], signatures: [],
    keywords: ['儒門事親','張子和','汗吐下','攻邪','子和'],
    color: '#9C3030', seal: '攻',
    quote: { han: '邪去則正自安', ko: '사기가 가면 정기는 절로 편안하다', src: '儒門事親' },
    sound: 'gold',
    line: '邪를 몰아내야 正이 편하리.',
  },
  ligao: {
    chapters: ['補氣','補血','補益'],
    signatures: ['bojung-iggi-tang','danggwi-boheol-tang'],
    keywords: ['脾胃論','東垣','李杲','補土','內傷','元氣','陰火'],
    color: '#876A36', seal: '垣',
    quote: { han: '內傷脾胃，百病由生', ko: '비위가 안으로 상하면 온갖 병이 이로부터 생긴다', src: '脾胃論' },
    sound: 'gold',
    line: '內傷脾胃하니 百病이 從生하라.',
  },
  zhuzhenheng: {
    chapters: ['補陰','補血'],
    signatures: ['daebo-eum-hwan'],
    keywords: ['丹溪','朱震亨','陽常有餘','陰常不足','滋陰','格致餘論'],
    color: '#2A7060', seal: '丹',
    quote: { han: '陽常有餘，陰常不足', ko: '양은 항상 남음이 있고, 음은 항상 부족하다', src: '格致餘論·陽有餘陰不足論' },
    sound: 'jade',
    line: '陽이 남고 陰이 모자라니 滋陰함이 옳다.',
  },
  wanghaogu: {
    chapters: [], signatures: [],
    keywords: ['海藏','王好古','陰證略例'],
    color: '#2C2E48', seal: '海',
    quote: { han: '陰證最爲難辨', ko: '음증은 가장 분별하기 어렵다', src: '陰證略例' },
    sound: 'silver',
  },

  // ═══ 明 (7) ═════════════════════════════════════════════════════════════
  xueji: {
    chapters: ['氣血雙補'],
    signatures: ['paljin-tang','guibi-tang'],
    keywords: ['薛己','立齋','正體類要','校注婦人良方','八珍'],
    color: '#C04848', seal: '薛',
    quote: { han: '凡治雜證，當以脾胃爲先', ko: '잡증을 다스림에는 마땅히 비위를 먼저 한다', src: '內科摘要' },
    sound: 'silk',
    line: '雜證 다스림에 脾胃를 먼저 살피라.',
  },
  lishizhen: {
    chapters: [], signatures: [],
    keywords: ['本草綱目','李時珍','綱目','時珍'],
    color: '#5C8F3A', seal: '綱',
    quote: { han: '醫者貴在格物', ko: '의자는 사물을 궁구함이 귀하다', src: '本草綱目·凡例' },
    sound: 'wood',
    line: '草木 千八百種, 한 칸에 모았노라.',
  },
  gongtingxian: {
    chapters: [], signatures: [],
    keywords: ['萬病回春','雲林','龔廷賢'],
    color: '#876A36', seal: '回',
    quote: { han: '萬病皆有回春之機', ko: '온갖 병에 봄을 되살릴 기틀이 있다', src: '萬病回春' },
    sound: 'silver',
  },
  zhangjingyue: {
    chapters: ['補陽','補陰','陰陽幷補'], signatures: [],
    keywords: ['景岳全書','張介賓','景岳','右歸','左歸'],
    color: '#2C2E48', seal: '岳',
    quote: { han: '善補陽者，必於陰中求陽', ko: '양을 잘 보하는 자는 반드시 음 가운데서 양을 구한다', src: '景岳全書·新方八略' },
    sound: 'jade',
    line: '陰中에서 陽을 求하라.',
  },
  zhaoxianke: {
    chapters: ['補陽','補陰'], signatures: [],
    keywords: ['醫貫','趙獻可','養葵','命門'],
    color: '#2C2E48', seal: '貫',
    quote: { han: '命門爲十二經之主', ko: '명문은 십이경의 주가 된다', src: '醫貫' },
    sound: 'jade',
  },
  wuyouke: {
    chapters: [], signatures: [],
    keywords: ['溫疫論','吳又可','戾氣','疫邪'],
    color: '#9C3030', seal: '疫',
    quote: { han: '夫溫疫之爲病，非風非寒非暑非濕，乃天地間別有一種異氣所感', ko: '온역의 병은 풍한서습이 아니라 천지 사이 별도의 한 가지 이기에 감수된 것이다', src: '溫疫論' },
    sound: 'gold',
  },
  lichan: {
    chapters: [], signatures: [],
    keywords: ['醫學入門','李梴','健齋'],
    color: '#876A36', seal: '入',
    quote: { han: '醫者，意也', ko: '의는 뜻이다', src: '醫學入門' },
    sound: 'silver',
  },

  // ═══ 清 (9) ═════════════════════════════════════════════════════════════
  yujiayan: {
    chapters: [], signatures: [],
    keywords: ['喻嘉言','喻昌','寓意草','秋燥論'],
    color: '#876A36', seal: '喻',
    quote: { han: '議病式，先議病，後用藥', ko: '의병식은 먼저 병을 의논하고 뒤에 약을 쓴다', src: '寓意草' },
    sound: 'silver',
  },
  zhanglu: {
    chapters: [], signatures: [],
    keywords: ['張璐','張氏醫通','石頑'],
    color: '#876A36', seal: '璐',
    quote: { han: '審證求因，治病必求其本', ko: '증을 살펴 원인을 구하니, 병 치료는 반드시 그 근본을 구한다', src: '張氏醫通' },
    sound: 'silver',
  },
  yetianshi: {
    chapters: [], signatures: [],
    keywords: ['葉天士','溫熱論','衛氣營血','溫病','三焦','香巖'],
    color: '#2A7060', seal: '葉',
    quote: { han: '溫邪上受，首先犯肺，逆傳心包', ko: '온사를 위에서 받으면 먼저 폐를 범하고 거꾸로 심포로 전한다', src: '溫熱論' },
    sound: 'jade',
    line: '溫邪 上受에 衛氣營血로 가르라.',
  },
  xuexue: {
    chapters: [], signatures: [],
    keywords: ['薛雪','生白','濕熱條辨'],
    color: '#2A7060', seal: '濕',
    quote: { han: '濕熱證，始惡寒，後但熱不寒', ko: '습열증은 처음 오한이 들고 뒤에는 다만 열만 나고 한이 없다', src: '濕熱條辨' },
    sound: 'jade',
  },
  wujutong: {
    chapters: [], signatures: [],
    keywords: ['吳鞠通','溫病條辨','三焦','銀翹','桑菊'],
    color: '#2A7060', seal: '鞠',
    quote: { han: '治上焦如羽，非輕不擧', ko: '상초를 다스림은 깃털처럼, 가볍지 않으면 일으키지 못한다', src: '溫病條辨·治病法論' },
    sound: 'jade',
    line: '上焦如羽, 中焦如衡, 下焦如權이라.',
  },
  wangmengying: {
    chapters: [], signatures: [],
    keywords: ['王孟英','士雄','溫熱經緯'],
    color: '#2A7060', seal: '孟',
    quote: { han: '葉氏溫熱論，實爲外感熱病之圭臬', ko: '섭씨 온열론은 실로 외감열병의 표준이다', src: '溫熱經緯' },
    sound: 'jade',
  },
  wangqingren: {
    chapters: [], signatures: [],
    keywords: ['王清任','醫林改錯','活血','逐瘀','血府'],
    color: '#9C3030', seal: '瘀',
    quote: { han: '業醫診病，當先明臟腑', ko: '의를 업으로 하여 병을 진찰함에는 마땅히 먼저 장부를 밝혀야 한다', src: '醫林改錯·序' },
    sound: 'gold',
    line: '臟腑를 알지 못하고 어찌 病을 다스리리.',
  },
  tangzonghai: {
    chapters: [], signatures: [],
    keywords: ['唐宗海','容川','血證論','中西匯通'],
    color: '#9C3030', seal: '宗',
    quote: { han: '止血爲第一要法', ko: '지혈이 제일의 요법이다', src: '血證論' },
    sound: 'gold',
  },
  xudachun: {
    chapters: [], signatures: [],
    keywords: ['徐大椿','靈胎','醫學源流論','蘭臺軌範'],
    color: '#876A36', seal: '徐',
    quote: { han: '一方有一方之治', ko: '한 처방에는 한 처방의 다스림이 있다', src: '醫學源流論' },
    sound: 'silver',
  },

  // ═══ 清末·民國 (5) ══════════════════════════════════════════════════════
  chengguopeng: {
    chapters: [], signatures: [],
    keywords: ['程國彭','鍾齡','醫學心悟','八法'],
    color: '#876A36', seal: '悟',
    quote: { han: '治病八法：汗和下消吐淸溫補', ko: '치료의 여덟 법은 한·화·하·소·토·청·온·보이다', src: '醫學心悟' },
    sound: 'silver',
    line: '八法 — 汗·和·下·消·吐·淸·溫·補.',
  },
  zhangxichun: {
    chapters: [], signatures: [],
    keywords: ['張錫純','壽甫','醫學衷中參西錄','鎭肝熄風'],
    color: '#2C2E48', seal: '參',
    quote: { han: '衷中參西，融會貫通', ko: '중을 좇아 서를 참고하여 융회관통한다', src: '醫學衷中參西錄' },
    sound: 'jade',
  },
  zhengqinan: {
    chapters: ['補陽','回陽'], signatures: [],
    keywords: ['鄭欽安','火神派','醫理眞傳','陽虛'],
    color: '#C04848', seal: '火',
    quote: { han: '陽者，陰之主也', ko: '양은 음의 주인이다', src: '醫理眞傳' },
    sound: 'gold',
    line: '萬病不離陽虛.',
  },
  huangyuanyu: {
    chapters: [], signatures: [],
    keywords: ['黃元御','玉楸','四聖心源','一氣周流'],
    color: '#876A36', seal: '玉',
    quote: { han: '一氣周流，土樞四象', ko: '한 기가 두루 흐르니 토가 사상의 추가 된다', src: '四聖心源' },
    sound: 'silver',
  },
  feibaixiong: {
    chapters: [], signatures: [],
    keywords: ['費伯雄','晉卿','醫醇剩義','孟河'],
    color: '#876A36', seal: '醇',
    quote: { han: '和緩之道，醇正之方', ko: '온화한 도리와 순정한 처방', src: '醫醇剩義' },
    sound: 'silver',
  },

  // ═══ 朝鮮 (2) ═══════════════════════════════════════════════════════════
  heojun: {
    chapters: [], signatures: [],
    keywords: ['東醫寶鑑','許浚','寶鑑','朝鮮','韓藥'],
    color: '#9C3030', seal: '東',
    quote: { han: '吾東方異於中國，當立其法以醫世', ko: '우리 동방은 중국과 달라 마땅히 그 법을 세워 세상을 다스려야 한다', src: '東醫寶鑑·集例' },
    sound: 'gold',
    line: '東醫寶鑑이 朝鮮의 醫法을 세웠노라.',
  },
  leejema: {
    chapters: [], signatures: [],
    keywords: ['四象','李濟馬','東醫壽世保元','太陽人','少陽人','太陰人','少陰人','東武'],
    color: '#C9A227', seal: '象',
    quote: { han: '人稟臟理有四不同', ko: '사람의 장부 이치를 받음에는 네 가지 다름이 있다', src: '東醫壽世保元·性命論' },
    sound: 'jade',
    line: '四象이 갈리니 體質에 따라 治하라.',
  },

  // ═══ 番外 ══════════════════════════════════════════════════════════════
  // 이순재 — 평소 조용. 정답 시 10% 확률로 어록 한 줄이 뜸 (밈)
  //          runtime 에서 별도 처리 (signatures/chapters 비움)
  leesoonjae: {
    chapters: [], signatures: [],
    keywords: [],
    color: '#C9A227', seal: '재',
    quote: { han: '하이킥', ko: '뭐 그딴 게 다 있어!', src: '거침없이 하이킥 (MBC 2006)' },
    sound: 'silk',
    randomChance: 0.10,   // 10% on correct
    // 어록 풀은 runtime 에서 사용 (별도 변수)
  },
};

// 이순재 어록 (랜덤 1개 출력)
const LEESOONJAE_QUOTES = [
  '뭐 그딴 게 다 있어!',
  '내 인생에 이런 굴욕이!',
  '꼴랑 그거 하나 맞췄다고?',
  '잘했다 자식아',
  '으이그 내가 너 같은 손주를…',
  '야 너 의대 다닌다며?',
  '나가 죽어!',
  '하이고 의사 났네 의사 났어',
  '시끄러 이놈아',
  '거 누구 마음대로!',
];

// ───── 도우미 함수 ─────────────────────────────────────────────────────────

/**
 * 문제에서 매칭되는 처방을 찾는다.
 *   - q.formula 명시 (past_xxx, hell_xxx 류) → 1순위
 *   - q 텍스트에서 한자/한글명 부분 일치 (긴 이름 우선)
 *   - 못 찾으면 null
 * @param {object} q 문제 객체
 * @returns {object|null} FORMULAS 中 매칭된 처방, 없으면 null
 */
function findFormulaForQuestion(q){
  if(!q || typeof FORMULAS === 'undefined' || !Array.isArray(FORMULAS)) return null;
  // 1. 직접 명시
  if(q.formula){
    const f = FORMULAS.find(x => x.ko === q.formula || x.han === q.formula);
    if(f) return f;
  }
  // 2. 텍스트 매칭 (긴 이름 우선)
  const blob = (q.q||q.question||'') + ' ' + (q.explanation||'');
  if(!blob) return null;
  const candidates = FORMULAS.slice().sort((a,b) => (b.han||'').length - (a.han||'').length);
  for(const f of candidates){
    if(f.han && blob.includes(f.han)) return f;
    if(f.ko && blob.includes(f.ko)) return f;
  }
  return null;
}

/**
 * 시그니처 등급 산정
 * @param {object} sig CHAR_SIGNATURES[charId]
 * @param {object|null} formula findFormulaForQuestion 결과
 * @param {object} q 문제 객체
 * @returns {'formula' | 'chapter' | null}  null = 발동 안 함
 */
function getSignatureTier(sig, formula, q){
  if(!sig) return null;
  // 番外 — 이순재의 randomChance (확률 발동)
  if(sig.randomChance && Math.random() < sig.randomChance){
    return 'chapter';   // 가벼운 등급으로 표시
  }
  // 1. 시그니처 처방 (逸品)
  if(formula && Array.isArray(sig.signatures) && sig.signatures.length && sig.signatures.includes(formula.id)){
    return 'formula';
  }
  // 2. 章 일치 (章典)
  if(formula && Array.isArray(sig.chapters) && sig.chapters.length){
    const ch = String(formula.chapter || '');
    if(sig.chapters.some(c => ch.includes(c))) return 'chapter';
  }
  // 3. 키워드 매칭 (章典 보조)
  if(Array.isArray(sig.keywords) && sig.keywords.length){
    const blob = [
      q && (q.q || q.question) || '',
      q && q.explanation || '',
      formula && formula.han || '',
      formula && formula.ko || '',
      formula && formula.indication || '',
      formula && formula.source || '',
    ].join(' ');
    if(sig.keywords.some(k => k && blob.includes(k))) return 'chapter';
  }
  return null;
}

/**
 * 시그니처 등급별 氣 보너스 배율 (솔로 한정)
 * @param {string} tier 'formula' | 'chapter' | 'jue-xue' | null
 * @returns {number} 0 = 보너스 없음, 0.10 / 0.25 / 0.50
 */
function getSignatureMultiplier(tier){
  if(tier === 'formula') return 0.25;
  if(tier === 'chapter') return 0.10;
  if(tier === 'jue-xue') return 0.50;
  return 0;
}

if(typeof window !== 'undefined'){
  window.CHAR_SIGNATURES = CHAR_SIGNATURES;
  window.LEESOONJAE_QUOTES = LEESOONJAE_QUOTES;
  window.findFormulaForQuestion = findFormulaForQuestion;
  window.getSignatureTier = getSignatureTier;
  window.getSignatureMultiplier = getSignatureMultiplier;
}
