/* data-physicians.js — v4
 * ============================================================================
 * 中醫史 50인 — 캐릭터·저작·명언 정전 데이터
 *
 * 구성:
 *   PHYSICIANS — 50인 배열, 시대순 (神階 → 朝鮮)
 *   PHYSICIAN_BY_ID — id 인덱스
 *   CHAR_PALETTES — 카테고리별 메달리온 팔레트 (9 카테고리)
 *
 * 카테고리(cat) — 메달리온 색·등급 분기:
 *   divine  神階 (5)  황제·신농·복희·여와·기백 — 구매에 氣 필요
 *   ancient 先秦~漢魏六朝 (10)
 *   tang    隋唐 (3)
 *   song    宋 (4)
 *   jinyuan 金元 (5) — 金元四大家 + 王好古
 *   ming    明 (7)
 *   qing    清 (9) — 溫病學派 중심 (섭천사·薛雪·吳鞠通 등)
 *   late    清末~民國 (5)
 *   korean  朝鮮 (2) — 허준·이제마
 *
 * 명언 출처:
 *   - 黃帝內經(素問·靈樞), 神農本草經, 史記 扁鵲倉公列傳
 *   - 傷寒論 序, 千金要方 大醫精誠, 脾胃論
 *   - 溫熱論, 溫病條辨 治病法論, 醫林改錯 序
 *   - 東醫寶鑑 集例, 東醫壽世保元 性命論
 *   각 인용은 한문 원전 표점본 기준. 葉天士(섭천사) 의 한국 한자음은
 *   성씨로 쓰일 때 '섭' 으로 표기 (한자 葉 의 한국 한자음: 일반 '엽' /
 *   성씨 '섭'). 시험 범위(보익·온경산한·표리쌍해) 와 직접 연관된 인용은
 *   학습 강화를 의도하여 우선 선정.
 *
 * 멀티 배틀 인트로 컷 ("對決開始"):
 *   상대·나 메달리온 + 캐릭터의 quote 가 말풍선에 한문/한글/출처 3행 표시.
 *   기존 Greek v60 의 "VS" 자리에는 한자 "對決開始" 표시.
 *
 * 神階 구매:
 *   기본 등급(빈의 賓醫) 에서는 神階 5인 잠금. 누적 氣 가 cost 이상 되면 잠금
 *   해제 가능. cost 는 절대 値 (학습 중 누적된 氣 — XP 와 동일 의미).
 * ============================================================================ */

const PHYSICIANS = [

  // ═══ 神階 (5) ════════════════════════════════════════════════════════════
  // 黃帝內經 의 화자·중국 신화 의약 시조. 구매에 일정 氣 필요.
  {
    id: 'huangdi', ko: '황제', han: '黃帝', py: 'Huángdì',
    era: '神話', cat: 'divine', init: '黃', cost: 1200,
    work_han: '黃帝內經', work_ko: '황제내경',
    ep: '中醫 의 시조 · 內經 의 화자',
    quote: {
      han: '上古之人，其知道者，法於陰陽，和於術數',
      ko: '상고의 사람들 중 도를 아는 자는 음양을 본받고 술수와 조화하였다',
      src: '素問·上古天眞論'
    }
  },
  {
    id: 'shennong', ko: '신농', han: '神農', py: 'Shénnóng',
    era: '神話', cat: 'divine', init: '農', cost: 1000,
    work_han: '神農本草經', work_ko: '신농본초경',
    ep: '本草學 의 시조 · 嘗百草',
    quote: {
      han: '藥有酸鹹甘苦辛五味，又有寒熱溫凉四氣',
      ko: '약에는 산·함·감·고·신 다섯 맛이 있고, 또 한·열·온·량의 네 기운이 있다',
      src: '神農本草經·序錄'
    }
  },
  {
    id: 'fuxi', ko: '복희', han: '伏羲', py: 'Fúxī',
    era: '神話', cat: 'divine', init: '羲', cost: 900,
    work_han: '八卦', work_ko: '팔괘',
    ep: '八卦 의 創製者 · 陰陽 의 始祖',
    quote: {
      han: '一陰一陽之謂道',
      ko: '한 번 음하고 한 번 양함을 일러 도라 한다',
      src: '易傳·繫辭上'
    }
  },
  {
    id: 'nvwa', ko: '여와', han: '女媧', py: 'Nǚwā',
    era: '神話', cat: 'divine', init: '媧', cost: 900,
    work_han: '補天造人', work_ko: '보천조인',
    ep: '創造의 女神 · 五色石 으로 蒼天 補修',
    quote: {
      han: '鍊五色石以補蒼天，斷鼇足以立四極',
      ko: '오색 돌을 단련하여 푸른 하늘을 깁고, 자라의 다리를 잘라 사방을 세웠다',
      src: '淮南子·覽冥訓'
    }
  },
  {
    id: 'qibo', ko: '기백', han: '岐伯', py: 'Qíbó',
    era: '神話', cat: 'divine', init: '岐', cost: 1100,
    work_han: '黃帝內經', work_ko: '황제내경',
    ep: '黃帝의 스승 · 內經 의 답변자',
    quote: {
      han: '上工治未病，不治已病，此之謂也',
      ko: '上工은 아직 병들지 않은 것을 다스리지, 이미 병든 것을 다스리지 않는다',
      src: '素問·四氣調神大論'
    }
  },

  // ═══ 先秦~漢魏六朝 (10) ═════════════════════════════════════════════════
  {
    id: 'leigong', ko: '뇌공', han: '雷公', py: 'Léigōng',
    era: '上古', cat: 'ancient', init: '雷',
    work_han: '雷公炮炙論', work_ko: '뇌공포자론',
    ep: '黃帝의 제자 · 炮炙學 의 시조',
    quote: {
      han: '請受道，諷誦用解',
      ko: '청컨대 도를 받아 외워 풀이하고자 합니다',
      src: '素問·著至教論'
    }
  },
  {
    id: 'bianque', ko: '편작', han: '扁鵲', py: 'Biǎnquè',
    era: '戰國', cat: 'ancient', init: '扁',
    work_han: '難經', work_ko: '난경',
    ep: '四診 의 시조 · 望聞問切',
    quote: {
      han: '病有六不治，驕恣不論於理一不治也',
      ko: '병에 여섯 가지 못 고치는 것이 있으니, 교만방자하여 이치를 따지지 않음이 그 첫째다',
      src: '史記·扁鵲倉公列傳'
    }
  },
  {
    id: 'canggong', ko: '창공', han: '倉公', py: 'Cānggōng',
    era: '前漢', cat: 'ancient', init: '倉',
    work_han: '診籍', work_ko: '진적',
    ep: '醫案 의 시조 · 淳于意',
    quote: {
      han: '意治病人，必先切其脈，乃治之',
      ko: '내가 병자를 다스릴 적엔 반드시 먼저 그 맥을 짚은 뒤에 다스린다',
      src: '史記·扁鵲倉公列傳'
    }
  },
  {
    id: 'zhongjing', ko: '장중경', han: '張仲景', py: 'Zhāng Zhòngjǐng',
    era: '東漢', cat: 'ancient', init: '仲',
    work_han: '傷寒雜病論', work_ko: '상한잡병론',
    ep: '醫聖 · 六經辨證 의 시조',
    quote: {
      han: '勤求古訓，博採衆方',
      ko: '옛 가르침을 부지런히 구하고, 뭇 처방을 널리 모았다',
      src: '傷寒論·序'
    }
  },
  {
    id: 'huatuo', ko: '화타', han: '華佗', py: 'Huà Tuó',
    era: '東漢', cat: 'ancient', init: '佗',
    work_han: '中藏經', work_ko: '중장경',
    ep: '外科 · 麻沸散 · 五禽戲',
    quote: {
      han: '人體欲得勞動，但不當使極爾',
      ko: '사람의 몸은 노동(움직임)을 얻고자 하나, 다만 극도에 이르게 해서는 안 된다',
      src: '後漢書·華佗傳'
    }
  },
  {
    id: 'wangshuhe', ko: '왕숙화', han: '王叔和', py: 'Wáng Shūhé',
    era: '魏晉', cat: 'ancient', init: '叔',
    work_han: '脈經', work_ko: '맥경',
    ep: '脈學 의 시조 · 仲景서 편집',
    quote: {
      han: '脈理精微，其體難辨',
      ko: '맥의 이치는 정미하여 그 본체를 분별하기 어렵다',
      src: '脈經·序'
    }
  },
  {
    id: 'huangfumi', ko: '황보밀', han: '皇甫謐', py: 'Huángfǔ Mì',
    era: '西晉', cat: 'ancient', init: '謐',
    work_han: '鍼灸甲乙經', work_ko: '침구갑을경',
    ep: '鍼灸學 의 集成者',
    quote: {
      han: '夫醫道所興，其來久矣',
      ko: '무릇 의도(醫道)의 일어남은 그 유래가 오래다',
      src: '鍼灸甲乙經·序'
    }
  },
  {
    id: 'gehong', ko: '갈홍', han: '葛洪', py: 'Gě Hóng',
    era: '東晉', cat: 'ancient', init: '葛',
    work_han: '肘後備急方', work_ko: '주후비급방',
    ep: '道家·急救醫 · 抱朴子',
    quote: {
      han: '古之初為道者，莫不兼修醫術',
      ko: '옛적에 처음 도를 닦은 자는 의술을 함께 닦지 않은 이가 없었다',
      src: '抱朴子·內篇'
    }
  },
  {
    id: 'taohongjing', ko: '도홍경', han: '陶弘景', py: 'Táo Hóngjǐng',
    era: '南朝', cat: 'ancient', init: '陶',
    work_han: '本草經集注', work_ko: '본초경집주',
    ep: '本草學 中興 · 神農本草經 정리',
    quote: {
      han: '藥性所主，當以識識相因',
      ko: '약성이 주관하는 바는 마땅히 분별을 따라 서로 인하여 안다',
      src: '本草經集注·序'
    }
  },
  {
    id: 'chaoyuanfang', ko: '소원방', han: '巢元方', py: 'Cháo Yuánfāng',
    era: '隋', cat: 'ancient', init: '巢',
    work_han: '諸病源候論', work_ko: '제병원후론',
    ep: '病因病機學 의 시조',
    quote: {
      han: '夫五臟者，藏精神血氣魂魄者也',
      ko: '무릇 오장이란 정·신·혈·기·혼·백을 간직하는 것이다',
      src: '諸病源候論'
    }
  },

  // ═══ 隋唐 (3) ════════════════════════════════════════════════════════════
  {
    id: 'sunsimiao', ko: '손사막', han: '孫思邈', py: 'Sūn Sīmiǎo',
    era: '唐', cat: 'tang', init: '邈',
    work_han: '備急千金要方', work_ko: '비급천금요방',
    ep: '藥王 · 大醫精誠 · 千金方',
    quote: {
      han: '凡大醫治病，必當安神定志，無欲無求',
      ko: '무릇 大醫가 병을 다스림에는 반드시 마음을 안정시키고 욕심과 구함이 없어야 한다',
      src: '千金要方·大醫精誠'
    }
  },
  {
    id: 'wangbing', ko: '왕빙', han: '王冰', py: 'Wáng Bīng',
    era: '唐', cat: 'tang', init: '冰',
    work_han: '重廣補注黃帝內經素問', work_ko: '중광보주황제내경소문',
    ep: '素問 의 注釋家 · 啓玄子',
    quote: {
      han: '夫釋縛脫艱，全眞導氣，拯黎元於仁壽',
      ko: '무릇 얽매임을 풀고 어려움을 벗어 진기를 온전히 하고 기를 인도하여 백성을 仁壽에 건진다',
      src: '重廣補注黃帝內經素問·序'
    }
  },
  {
    id: 'wangtao', ko: '왕도', han: '王燾', py: 'Wáng Tāo',
    era: '唐', cat: 'tang', init: '燾',
    work_han: '外台秘要', work_ko: '외대비요',
    ep: '當代 처방 集大成',
    quote: {
      han: '代傳醫方者，皆云三世',
      ko: '대를 이어 의방을 전하는 자는 모두 三世라 일컫는다',
      src: '外台秘要·序'
    }
  },

  // ═══ 宋 (4) ══════════════════════════════════════════════════════════════
  {
    id: 'qianyi', ko: '전을', han: '錢乙', py: 'Qián Yǐ',
    era: '北宋', cat: 'song', init: '乙',
    work_han: '小兒藥證直訣', work_ko: '소아약증직결',
    ep: '兒科의 聖手 · 六味地黃丸 創製',
    quote: {
      han: '小兒臟腑柔弱，易虛易實，易寒易熱',
      ko: '어린아이는 장부가 부드럽고 약하여 쉽게 허하고 쉽게 실하며, 쉽게 차고 쉽게 뜨겁다',
      src: '小兒藥證直訣'
    }
  },
  {
    id: 'chenziming', ko: '진자명', han: '陳自明', py: 'Chén Zìmíng',
    era: '南宋', cat: 'song', init: '陳',
    work_han: '婦人大全良方', work_ko: '부인대전양방',
    ep: '婦人科 의 集大成',
    quote: {
      han: '婦人之病，比男子十倍難療',
      ko: '부인의 병은 남자에 비해 열 배는 다스리기 어렵다',
      src: '婦人大全良方·序'
    }
  },
  {
    id: 'yanyonghe', ko: '엄용화', han: '嚴用和', py: 'Yán Yònghé',
    era: '南宋', cat: 'song', init: '嚴',
    work_han: '濟生方', work_ko: '제생방',
    ep: '歸脾湯 의 創製者',
    quote: {
      han: '夫疾病之來，雖有外感內傷之異',
      ko: '무릇 질병이 옴에는 外感과 內傷의 다름이 있다',
      src: '濟生方·序'
    }
  },
  {
    id: 'chenshiwen', ko: '진사문', han: '陳師文', py: 'Chén Shīwén',
    era: '北宋', cat: 'song', init: '師',
    work_han: '太平惠民和劑局方', work_ko: '태평혜민화제국방',
    ep: '官修 처방집 의 編者 · 局方',
    quote: {
      han: '凡合和湯藥，務在精誠',
      ko: '무릇 탕약을 짓고 합함에는 정성을 다함에 힘써야 한다',
      src: '太平惠民和劑局方'
    }
  },

  // ═══ 金元 (5) — 金元四大家 + 王好古 ═════════════════════════════════════
  {
    id: 'liuwansu', ko: '유완소', han: '劉完素', py: 'Liú Wánsù',
    era: '金', cat: 'jinyuan', init: '完',
    work_han: '素問玄機原病式', work_ko: '소문현기원병식',
    ep: '寒涼派 · 河間學派 의 宗師',
    quote: {
      han: '六氣皆從火化',
      ko: '여섯 가지 기운은 모두 火를 좇아 변한다',
      src: '素問玄機原病式'
    }
  },
  {
    id: 'zhangcongzheng', ko: '장종정', han: '張從正', py: 'Zhāng Cóngzhèng',
    era: '金', cat: 'jinyuan', init: '從',
    work_han: '儒門事親', work_ko: '유문사친',
    ep: '攻邪派 · 汗吐下 三法',
    quote: {
      han: '邪去則正安，攻邪已病即補虛',
      ko: '邪氣가 떠나면 正氣가 편안해지니, 사기를 쳐서 병을 그치게 함이 곧 허함을 보함이다',
      src: '儒門事親'
    }
  },
  {
    id: 'ligao', ko: '이고', han: '李杲', py: 'Lǐ Gǎo',
    era: '金元', cat: 'jinyuan', init: '杲',
    work_han: '脾胃論', work_ko: '비위론',
    ep: '補土派 · 東垣老人 · 補中益氣湯',
    quote: {
      han: '內傷脾胃，百病由生',
      ko: '비위가 안으로 상하면 온갖 병이 이로부터 생긴다',
      src: '脾胃論'
    }
  },
  {
    id: 'zhuzhenheng', ko: '주진형', han: '朱震亨', py: 'Zhū Zhènhēng',
    era: '元', cat: 'jinyuan', init: '丹',
    work_han: '格致餘論', work_ko: '격치여론',
    ep: '滋陰派 · 丹溪先生',
    quote: {
      han: '陽常有餘，陰常不足',
      ko: '양은 항상 남음이 있고, 음은 항상 부족하다',
      src: '格致餘論·陽有餘陰不足論'
    }
  },
  {
    id: 'wanghaogu', ko: '왕호고', han: '王好古', py: 'Wáng Hàogǔ',
    era: '元', cat: 'jinyuan', init: '好',
    work_han: '陰證略例', work_ko: '음증약례',
    ep: '李杲·張元素 의 제자 · 海藏老人',
    quote: {
      han: '陰證之傷，得於陽分',
      ko: '음증의 상함은 양분에서 얻어진다',
      src: '陰證略例'
    }
  },

  // ═══ 明 (7) ══════════════════════════════════════════════════════════════
  {
    id: 'xueji', ko: '설기', han: '薛己', py: 'Xuē Jǐ',
    era: '明', cat: 'ming', init: '己',
    work_han: '內科摘要', work_ko: '내과적요',
    ep: '溫補學派 의 先驅',
    quote: {
      han: '凡治雜病，必固脾胃',
      ko: '무릇 잡병을 다스림에는 반드시 비위를 굳건히 해야 한다',
      src: '內科摘要'
    }
  },
  {
    id: 'lishizhen', ko: '이시진', han: '李時珍', py: 'Lǐ Shízhēn',
    era: '明', cat: 'ming', init: '李',
    work_han: '本草綱目', work_ko: '본초강목',
    ep: '藥聖 · 본초학의 集大成者',
    quote: {
      han: '醫者貴在格物',
      ko: '의자는 사물의 이치를 궁구함을 귀하게 여긴다',
      src: '本草綱目·凡例'
    }
  },
  {
    id: 'gongtingxian', ko: '공정현', han: '龔廷賢', py: 'Gōng Tíngxián',
    era: '明', cat: 'ming', init: '廷',
    work_han: '萬病回春', work_ko: '만병회춘',
    ep: '醫林狀元 · 雲林山人',
    quote: {
      han: '醫者，仁術也',
      ko: '의(醫)란 어진(仁) 기술이다',
      src: '萬病回春'
    }
  },
  {
    id: 'zhangjingyue', ko: '장경악', han: '張景岳', py: 'Zhāng Jǐngyuè',
    era: '明', cat: 'ming', init: '景',
    work_han: '景岳全書', work_ko: '경악전서',
    ep: '溫補派 · 張介賓 · 陰常不足論',
    quote: {
      han: '陽非有餘，眞陰不足',
      ko: '양이 남음이 있는 것이 아니라, 참된 음이 부족한 것이다',
      src: '景岳全書·傳忠錄'
    }
  },
  {
    id: 'zhaoxianke', ko: '조헌가', han: '趙獻可', py: 'Zhào Xiànkě',
    era: '明', cat: 'ming', init: '獻',
    work_han: '醫貫', work_ko: '의관',
    ep: '命門學說 · 趙養葵',
    quote: {
      han: '命門爲十二經之主',
      ko: '명문(命門)이 십이경의 주재가 된다',
      src: '醫貫'
    }
  },
  {
    id: 'wuyouke', ko: '오우가', han: '吳又可', py: 'Wú Yòukě',
    era: '明末', cat: 'ming', init: '又',
    work_han: '瘟疫論', work_ko: '온역론',
    ep: '溫疫學 의 시조 · 戾氣 學說',
    quote: {
      han: '夫溫疫之爲病，非風非寒，非暑非濕',
      ko: '무릇 온역의 병됨은 風도 寒도 暑도 濕도 아니다',
      src: '瘟疫論·原病'
    }
  },
  {
    id: 'lichan', ko: '이천', han: '李梴', py: 'Lǐ Chān',
    era: '明', cat: 'ming', init: '梴',
    work_han: '醫學入門', work_ko: '의학입문',
    ep: '醫學入門 의 著者 · 朝鮮 의학에 큰 영향',
    quote: {
      han: '醫者意也，藥之治病，其妙在意',
      ko: '의란 뜻(意)이니, 약이 병을 다스리는 묘는 의(意)에 있다',
      src: '醫學入門'
    }
  },

  // ═══ 清 (9) — 溫病學派 ═════════════════════════════════════════════════
  {
    id: 'yujiayan', ko: '유가언', han: '喻嘉言', py: 'Yù Jiāyán',
    era: '清初', cat: 'qing', init: '喻',
    work_han: '醫門法律', work_ko: '의문법률',
    ep: '議病式 · 喻昌',
    quote: {
      han: '議病式，先議病後用藥',
      ko: '의병식(議病式)이란 먼저 병을 의논한 뒤에 약을 쓰는 것이다',
      src: '醫門法律'
    }
  },
  {
    id: 'zhanglu', ko: '장로', han: '張璐', py: 'Zhāng Lù',
    era: '清', cat: 'qing', init: '璐',
    work_han: '張氏醫通', work_ko: '장씨의통',
    ep: '清初 三大家 의 한 사람',
    quote: {
      han: '醫之為道，非精不能明其理',
      ko: '의(醫)의 도는 정심하지 않으면 그 이치를 밝힐 수 없다',
      src: '張氏醫通'
    }
  },
  {
    id: 'yetianshi', ko: '섭천사', han: '葉天士', py: 'Yè Tiānshì',
    era: '清', cat: 'qing', init: '葉',
    work_han: '溫熱論', work_ko: '온열론',
    ep: '溫病四大家 의 首席 · 衛氣營血 辨證',
    quote: {
      han: '溫邪上受，首先犯肺，逆傳心包',
      ko: '온사(溫邪)는 위로 받아져, 먼저 폐를 침범하고 거슬러 심포로 전한다',
      src: '溫熱論·第1條'
    }
  },
  {
    id: 'xuexue', ko: '설설', han: '薛雪', py: 'Xuē Xuě',
    era: '清', cat: 'qing', init: '雪',
    work_han: '濕熱條辨', work_ko: '습열조변',
    ep: '濕熱病 의 大家 · 薛生白',
    quote: {
      han: '濕熱之邪，從表傷者十之一二',
      ko: '습열의 사기가 表로부터 상하게 하는 것은 열에 한둘에 불과하다',
      src: '濕熱條辨'
    }
  },
  {
    id: 'wujutong', ko: '오국통', han: '吳鞠通', py: 'Wú Jūtōng',
    era: '清', cat: 'qing', init: '鞠',
    work_han: '溫病條辨', work_ko: '온병조변',
    ep: '三焦辨證 · 銀翹散·桑菊飲 創製',
    quote: {
      han: '治上焦如羽，非輕不舉；治下焦如權，非重不沉',
      ko: '상초를 다스림은 깃털과 같아 가볍지 않으면 들리지 않고, 하초를 다스림은 저울추와 같아 무겁지 않으면 가라앉지 않는다',
      src: '溫病條辨·治病法論'
    }
  },
  {
    id: 'wangmengying', ko: '왕맹영', han: '王孟英', py: 'Wáng Mèngyīng',
    era: '清', cat: 'qing', init: '孟',
    work_han: '溫熱經緯', work_ko: '온열경위',
    ep: '溫病四大家 의 마지막 · 王士雄',
    quote: {
      han: '溫熱二字，本屬一氣',
      ko: '溫과 熱 두 글자는 본디 한 기운에 속한다',
      src: '溫熱經緯'
    }
  },
  {
    id: 'wangqingren', ko: '왕청임', han: '王清任', py: 'Wáng Qīngrèn',
    era: '清', cat: 'qing', init: '清',
    work_han: '醫林改錯', work_ko: '의림개착',
    ep: '解剖學 의 開拓 · 血府逐瘀湯',
    quote: {
      han: '業醫診病，當先明臟腑',
      ko: '의를 업으로 삼아 병을 진단하려면, 마땅히 먼저 장부를 밝혀야 한다',
      src: '醫林改錯·序'
    }
  },
  {
    id: 'tangzonghai', ko: '당종해', han: '唐宗海', py: 'Táng Zōnghǎi',
    era: '清末', cat: 'qing', init: '宗',
    work_han: '血證論', work_ko: '혈증론',
    ep: '中西匯通 의 先驅 · 唐容川',
    quote: {
      han: '血者，水之屬也',
      ko: '혈이란 물(水)에 속하는 것이다',
      src: '血證論'
    }
  },
  {
    id: 'xudachun', ko: '서대춘', han: '徐大椿', py: 'Xú Dàchūn',
    era: '清', cat: 'qing', init: '椿',
    work_han: '醫學源流論', work_ko: '의학원류론',
    ep: '徐靈胎 · 用藥如用兵',
    quote: {
      han: '用藥如用兵，知己知彼',
      ko: '약을 씀은 군사를 부림과 같으니, 자기를 알고 상대를 알아야 한다',
      src: '醫學源流論·用藥如用兵論'
    }
  },

  // ═══ 清末~民國 (5) ═══════════════════════════════════════════════════════
  {
    id: 'chengguopeng', ko: '정국팽', han: '程國彭', py: 'Chéng Guópéng',
    era: '清', cat: 'late', init: '程',
    work_han: '醫學心悟', work_ko: '의학심오',
    ep: '八法 의 集大成 · 程鍾齡',
    quote: {
      han: '汗、和、下、消、吐、清、溫、補，八法盡之矣',
      ko: '한·화·하·소·토·청·온·보, 여덟 법으로 다할 수 있다',
      src: '醫學心悟·醫門八法'
    }
  },
  {
    id: 'zhangxichun', ko: '장석순', han: '張錫純', py: 'Zhāng Xīchún',
    era: '民國', cat: 'late', init: '錫',
    work_han: '醫學衷中參西錄', work_ko: '의학충중참서록',
    ep: '中西匯通派 의 巨匠',
    quote: {
      han: '醫者，貴乎活法',
      ko: '의자는 살아 있는 방법(活法)을 귀하게 여긴다',
      src: '醫學衷中參西錄'
    }
  },
  {
    id: 'zhengqinan', ko: '정흠안', han: '鄭欽安', py: 'Zhèng Qīn\u2019ān',
    era: '清末', cat: 'late', init: '欽',
    work_han: '醫理眞傳', work_ko: '의리진전',
    ep: '火神派 의 시조',
    quote: {
      han: '陽者陰之根也',
      ko: '양은 음의 뿌리이다',
      src: '醫理眞傳'
    }
  },
  {
    id: 'huangyuanyu', ko: '황원어', han: '黃元御', py: 'Huáng Yuányù',
    era: '清', cat: 'late', init: '元',
    work_han: '四聖心源', work_ko: '사성심원',
    ep: '一氣周流 學說',
    quote: {
      han: '中氣者，陰陽升降之樞軸',
      ko: '중기(中氣)는 음양이 오르내리는 지도리의 축이다',
      src: '四聖心源'
    }
  },
  {
    id: 'feibaixiong', ko: '비백웅', han: '費伯雄', py: 'Fèi Bóxióng',
    era: '清', cat: 'late', init: '費',
    work_han: '醫醇賸義', work_ko: '의순승의',
    ep: '孟河醫派 의 開祖',
    quote: {
      han: '天下無神奇之法，只有平淡之法',
      ko: '천하에 신기한 법은 없고, 다만 평담한 법이 있을 뿐이다',
      src: '醫醇賸義'
    }
  },

  // ═══ 朝鮮 (2) — 한국 의가 ════════════════════════════════════════════════
  {
    id: 'heojun', ko: '허준', han: '許浚', py: 'Heo Jun',
    era: '朝鮮', cat: 'korean', init: '浚',
    work_han: '東醫寶鑑', work_ko: '동의보감',
    ep: '東醫 의 鼻祖 · 內景·外形·雜病 體系',
    quote: {
      han: '聖人不治已病治未病',
      ko: '성인은 이미 든 병을 다스리지 않고, 아직 들지 않은 병을 다스린다',
      src: '東醫寶鑑·集例'
    }
  },
  {
    id: 'leejema', ko: '이제마', han: '李濟馬', py: 'Lee Jema',
    era: '朝鮮末', cat: 'korean', init: '濟',
    work_han: '東醫壽世保元', work_ko: '동의수세보원',
    ep: '四象醫學 의 創始者',
    quote: {
      han: '天稟之已定固無可論，重在反躬修身',
      ko: '하늘이 부여한 바탕은 이미 정해져 논할 것이 없고, 중요한 것은 자신을 돌이켜 닦는 데 있다',
      src: '東醫壽世保元·性命論'
    }
  },

  // ═══ 番外 (1) — 시트콤 客員 ═══════════════════════════════════════════
  // 거침없이 하이킥 (MBC, 2006-7) 의 이&박 여성전문한방병원 원장.
  // 멀티 배틀 시 quotes_pool 에서 매번 랜덤 어록 1개 출력 (특수 분기).
  // 사진: 시트콤 캡쳐 — leesoonjae-medallion.jpeg (local).
  {
    id: 'leesoonjae', ko: '이순재', han: '李純載', py: 'Lee Soon-jae',
    era: '시트콤', cat: 'gag', init: '純',
    work_han: '이순재여성전문한방병원', work_ko: '이순재여성전문한방병원',
    ep: '하이킥의 원장 · 야동순재',
    quote: {  // 폴백 (quotes_pool 없을 때 쓰임)
      han: '이 자식들을 그냥!',
      ko: '이 자식들을 그냥!',
      src: '거침없이 하이킥'
    },
    quotes_pool: [  // 매 배틀마다 랜덤 1개 선택
      { han:'요 놈의 자식들을 그냥!', ko:'요 놈의 자식들을 그냥!', src:'거침없이 하이킥' },
      { han:'요놈의 자식 이제 죽었다', ko:'요놈의 자식 이제 죽었다', src:'거침없이 하이킥' },
      { han:'이 자식아, 네 죄가 제일 커!', ko:'이 자식아, 네 죄가 제일 커!', src:'거침없이 하이킥' },
      { han:'너 이 자식, 오늘 딱 잡혔다!', ko:'너 이 자식, 오늘 딱 잡혔다!', src:'거침없이 하이킥' },
      { han:'우리집이 소방서인 줄 알아!?', ko:'우리집이 소방서인 줄 알아!?', src:'거침없이 하이킥' },
      { han:'이 자식이 누구 돈으로 인심을 써?', ko:'이 자식이 누구 돈으로 인심을 써?', src:'거침없이 하이킥' },
      { han:'위자료같은 소리하고 앉았네', ko:'위자료같은 소리하고 앉았네', src:'거침없이 하이킥' },
      { han:'이혼이 무슨 장난이야? 도장 찍었으면 끝이야 끝!', ko:'이혼이 무슨 장난이야? 도장 찍었으면 끝이야 끝!', src:'거침없이 하이킥' },
      { han:'다시란 말은 내 사전에 없어!', ko:'다시란 말은 내 사전에 없어!', src:'거침없이 하이킥' },
      { han:'복잡하긴 뭐가 복잡해? 당장 가서 집 찾아와!', ko:'복잡하긴 뭐가 복잡해? 당장 가서 집 찾아와!', src:'거침없이 하이킥' },
      { han:'너 또 빙신처럼 끌려 다니면 그냥 내 손에!!!', ko:'너 또 빙신처럼 끌려 다니면 그냥 내 손에!!!', src:'거침없이 하이킥' },
      { han:'아주 엉덩이 걸레될 줄 알아!!', ko:'아주 엉덩이 걸레될 줄 알아!!', src:'거침없이 하이킥' },
      { han:'부끄러운 줄도 모르고 춤을 춰 재끼고!', ko:'부끄러운 줄도 모르고 춤을 춰 재끼고!', src:'거침없이 하이킥' },
      { han:'다 늙어 그게 무슨 주책이야!', ko:'다 늙어 그게 무슨 주책이야!', src:'거침없이 하이킥' },
      { han:'걔가 먼저 잘못했다니까!', ko:'걔가 먼저 잘못했다니까!', src:'거침없이 하이킥' },
      { han:'이순재 여성...', ko:'이순재 여성... (생방송 자기소개 굴욕)', src:'거침없이 하이킥' },
      { han:'명의는 무슨 얼어 죽을 명의야!', ko:'명의는 무슨 얼어 죽을 명의야!', src:'거침없이 하이킥' },
      { han:'당장 가서 집 찾아와!', ko:'당장 가서 집 찾아와!', src:'거침없이 하이킥' }
    ]
  }
];

// ─── 인덱스·헬퍼 ─────────────────────────────────────────────────────────
const PHYSICIAN_BY_ID = {};
PHYSICIANS.forEach(p => { PHYSICIAN_BY_ID[p.id] = p; });

// 카테고리별 메달리온 팔레트 — 中華 帝王 색채 체계 + 番外(gag)
const CHAR_PALETTES = {
  divine:  { ring:'#C9A227', bg1:'#FFE08A', bg2:'#E0A030', fg:'#5C2C0C', initBg:'#5C2C0C', initFg:'#FFE08A' }, // 帝王黃
  ancient: { ring:'#7A3D27', bg1:'#E8C8A0', bg2:'#A87454', fg:'#3A1810', initBg:'#3A1810', initFg:'#F5E6D3' }, // 古銅
  tang:    { ring:'#B22222', bg1:'#F0C8B0', bg2:'#C04030', fg:'#2A0C08', initBg:'#2A0C08', initFg:'#F5E6D3' }, // 朱砂
  song:    { ring:'#4A6840', bg1:'#C8D8B8', bg2:'#688058', fg:'#1C2810', initBg:'#1C2810', initFg:'#E8E8C8' }, // 松柏
  jinyuan: { ring:'#6A4C8C', bg1:'#D0BCE8', bg2:'#8064A8', fg:'#28143C', initBg:'#28143C', initFg:'#E8DCF4' }, // 紫氣
  ming:    { ring:'#1A4C7C', bg1:'#A8C4DC', bg2:'#3068A0', fg:'#08203C', initBg:'#08203C', initFg:'#D8E4F0' }, // 靛靑
  qing:    { ring:'#2A7060', bg1:'#A8D0C0', bg2:'#48907C', fg:'#0C2820', initBg:'#0C2820', initFg:'#D8ECDC' }, // 翡翠
  late:    { ring:'#8C5028', bg1:'#E0C098', bg2:'#B06838', fg:'#341808', initBg:'#341808', initFg:'#F0DCC4' }, // 黃土
  korean:  { ring:'#9C3030', bg1:'#F0D0C0', bg2:'#C04848', fg:'#3C0C0C', initBg:'#3C0C0C', initFg:'#F8E8D8' }, // 朝鮮赤
  gag:     { ring:'#E84E80', bg1:'#FFCEDC', bg2:'#FF8FB0', fg:'#5C0828', initBg:'#5C0828', initFg:'#FFE0EC' }  // 핑크 (이순재 시트콤 색)
};

const CAT_LABELS = {
  divine:'神階', ancient:'上古·漢魏', tang:'隋唐', song:'宋', jinyuan:'金元',
  ming:'明', qing:'清', late:'清末·民國', korean:'朝鮮', gag:'番外'
};

if(typeof window !== 'undefined'){
  window.PHYSICIANS = PHYSICIANS;
  window.PHYSICIAN_BY_ID = PHYSICIAN_BY_ID;
  window.CHAR_PALETTES = CHAR_PALETTES;
  window.CAT_LABELS = CAT_LABELS;
}

// ─── CHARACTER_IMAGES — v9.7: 캐릭터 사진을 images/characters/ 폴더로 격리 ─
// v9.7 변경: PWA 루트가 캐릭터 사진들로 어수선해지는 것을 막기 위해
//             images/characters/{id}.{ext} 로 이동. 루트에는 PWA 아이콘만.
// (v5 회귀: 한때 폴더를 폐지했으나 사진 갯수가 늘면서 다시 폴더화)
//
// 設計:
//   • url        : 로컬 파일 (images/characters/{id}.{ext}).
//   • fallback   : Wikimedia URL. url 로드 실패 시 시도.
//   • fallback도 실패하면 CSS init 메달리온이 자동 노출 (안전망).
//
// 새 사진 추가 시:
//   1. images/characters/{id}.jpg (또는 .png/.jpeg) 로 저장
//   2. 캐싱 위해 sw.js의 STATIC 목록에 경로 추가 권장
//
// 검증 출처:
//   ✓ Wellcome L0039312–L0039324 (14인): 1601 明 萬曆刊 本草蒙筌 卷首
//                                          「歷代名醫畫姓氏」 — 唐 甘伯宗 그림.
//                                          CC BY 4.0. 직접 listing 확인.
//   ✓ Tao_Hongjing.jpg, Li_Shizhen.JPG, Ye_Tianshi.jpg, Tang_Zonghai.jpg:
//      Wikimedia Commons 에서 직접 listing 확인.
//   ? 그 외 fallback URL은 추정 또는 미검증 — 작동 안 할 수 있음.
//      해당 인물은 로컬에 사진을 추가하는 것을 권장.
//
// 한 이미지에 한 인물 사진만. 이순재 (게임 캐릭터) 는 로컬 jpeg.
const _W = (n) => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + n + '?width=320';
const _LOCAL = (id, ext='jpg') => 'images/characters/' + id + '.' + ext;
const CHARACTER_IMAGES = {
  // ═ 神階 (5인) ═ Wellcome 의가 시리즈 (검증됨) + 女媧 (한대 백화)
  huangdi:     { url: _LOCAL('huangdi'),     fallback: _W('Chinese_woodcut,_Famous_medical_figures;_The_Yellow_Emperor_Wellcome_L0039314.jpg'), caption: '黃帝 — Wellcome 의가 시리즈 (1601)', license: 'CC BY 4.0' },
  shennong:    { url: _LOCAL('shennong','png'), fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Shen_Nong_Wellcome_L0039313.jpg'),         caption: '神農 — Wellcome 의가 시리즈',         license: 'CC BY 4.0' },
  fuxi:        { url: _LOCAL('fuxi'),        fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Emperor_Fuxi_Wellcome_L0039312.jpg'),      caption: '伏羲 — Wellcome 의가 시리즈',         license: 'CC BY 4.0' },
  nvwa:        { url: _LOCAL('nvwa'),        fallback: _W('Anonymous-Fuxi_and_N%C3%BCwa3.jpg'),                                                  caption: '女媧 (伏羲女媧圖) — 唐 阿斯塔那 출토', license: 'PD-old' },
  qibo:        { url: _LOCAL('qibo'),        fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Portrait_of_Qibo_Wellcome_L0039315.jpg'),   caption: '岐伯 — Wellcome 의가 시리즈',         license: 'CC BY 4.0' },

  // ═ 先秦~漢魏六朝 (10인) ═ Wellcome 9인 (검증) + 陶弘景
  leigong:     { url: _LOCAL('leigong'),     fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Portrait_of_Lei_Gong_Wellcome_L0039316.jpg'),  caption: '雷公 — Wellcome 의가 시리즈',           license: 'CC BY 4.0' },
  bianque:     { url: _LOCAL('bianque'),     fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Portrait_of_Bian_Que_Wellcome_L0039317.jpg'),  caption: '扁鵲 — Wellcome 의가 시리즈',           license: 'CC BY 4.0' },
  canggong:    { url: _LOCAL('canggong'),    fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Chunyu_Yi_Wellcome_L0039318.jpg'),            caption: '倉公(淳于意) — Wellcome 의가 시리즈',   license: 'CC BY 4.0' },
  zhongjing:   { url: _LOCAL('zhongjing'),   fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Zhang_Zhongjing_Wellcome_L0039319.jpg'),      caption: '張仲景 — Wellcome 의가 시리즈',         license: 'CC BY 4.0' },
  huatuo:      { url: _LOCAL('huatuo'),      fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Portrait_of_Hua_Tuo_Wellcome_L0039320.jpg'),  caption: '華佗 — Wellcome 의가 시리즈',           license: 'CC BY 4.0' },
  wangshuhe:   { url: _LOCAL('wangshuhe'),   fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Wang_Shuhe_Wellcome_L0039321.jpg'),           caption: '王叔和 — Wellcome 의가 시리즈',         license: 'CC BY 4.0' },
  huangfumi:   { url: _LOCAL('huangfumi'),   fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Huangfu_Mi_Wellcome_L0039322.jpg'),           caption: '皇甫謐 — Wellcome 의가 시리즈',         license: 'CC BY 4.0' },
  gehong:      { url: _LOCAL('gehong'),      fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Portrait_of_Ge_Hong_Wellcome_L0039323.jpg'),  caption: '葛洪 — Wellcome 의가 시리즈',           license: 'CC BY 4.0' },
  taohongjing: { url: _LOCAL('taohongjing'), fallback: _W('Tao_Hongjing.jpg'),                                                                     caption: '陶弘景 — 三才圖會 (1607)',              license: 'PD-old' },
  chaoyuanfang:{ url: _LOCAL('chaoyuanfang'),fallback: _W('Chao_Yuanfang.jpg'),                                                                    caption: '巢元方 — 歷代名醫圖贊 (추정)',          license: 'PD-old' },

  // ═ 隋唐 (3인) ═
  sunsimiao:   { url: _LOCAL('sunsimiao'),   fallback: _W('Chinese_woodcut,_Famous_medical_figures;_Sun_Simiao_Wellcome_L0039324.jpg'),           caption: '孫思邈 — Wellcome 의가 시리즈',         license: 'CC BY 4.0' },
  wangbing:    { url: _LOCAL('wangbing'),    fallback: _W('Wang_Bing.jpg'),                                                                        caption: '王冰 — 歷代名醫圖贊 (추정)',            license: 'PD-old' },
  wangtao:     { url: _LOCAL('wangtao'),     fallback: _W('Wang_Tao.jpg'),                                                                         caption: '王燾 — 歷代名醫圖贊 (추정)',            license: 'PD-old' },

  // ═ 宋 (4인) ═
  qianyi:      { url: _LOCAL('qianyi'),      fallback: _W('Qian_Yi.jpg'),                                                                          caption: '錢乙 — 歷代名醫圖贊 (추정)',            license: 'PD-old' },
  chenziming:  { url: _LOCAL('chenziming'),  fallback: '',                                                                                          caption: '陳自明 — 婦人大全良方 著者 (사용자 제공)', license: 'PD-old' },
  yanyonghe:   { url: _LOCAL('yanyonghe'),   fallback: _W('Yan_Yonghe.jpg'),                                                                       caption: '嚴用和 — 歷代名醫圖贊 (추정)',          license: 'PD-old' },
  chenshiwen:  { url: _LOCAL('chenshiwen'),  fallback: _W('Chen_Shiwen.jpg'),                                                                      caption: '陳師文 — 歷代名醫圖贊 (추정)',          license: 'PD-old' },

  // ═ 金元四大家 + 王好古 (5인) ═
  liuwansu:    { url: _LOCAL('liuwansu'),    fallback: _W('Liu_Wansu.jpg'),                                                                        caption: '劉完素 (河間) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },
  zhangcongzheng:{url:_LOCAL('zhangcongzheng'),fallback:_W('Zhang_Congzheng.jpg'),                                                                  caption: '張從正 (子和) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },
  ligao:       { url: _LOCAL('ligao'),       fallback: _W('Li_Gao.jpg'),                                                                           caption: '李杲 (東垣) — 歷代名醫圖贊 (추정)',     license: 'PD-old' },
  zhuzhenheng: { url: _LOCAL('zhuzhenheng'), fallback: _W('Zhu_Zhenheng.jpg'),                                                                     caption: '朱震亨 (丹溪) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },
  wanghaogu:   { url: _LOCAL('wanghaogu'),   fallback: _W('Wang_Haogu.jpg'),                                                                       caption: '王好古 (海藏) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },

  // ═ 明 (7인) ═
  xueji:       { url: _LOCAL('xueji'),       fallback: _W('Xue_Ji.jpg'),                                                                           caption: '薛己 (立齋) — 歷代名醫圖贊 (추정)',     license: 'PD-old' },
  lishizhen:   { url: _LOCAL('lishizhen'),   fallback: _W('Li_Shizhen.JPG'),                                                                       caption: '李時珍 — 北京大學 醫學部 동상',         license: 'PD-self' },
  gongtingxian:{ url: _LOCAL('gongtingxian'),fallback: _W('Gong_Tingxian.jpg'),                                                                    caption: '龔廷賢 (雲林) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },
  zhangjingyue:{ url: _LOCAL('zhangjingyue'),fallback: _W('Zhang_Jingyue.jpg'),                                                                    caption: '張景岳 (介賓) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },
  zhaoxianke:  { url: _LOCAL('zhaoxianke'),  fallback: _W('Zhao_Xianke.jpg'),                                                                      caption: '趙獻可 (養葵) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },
  wuyouke:     { url: _LOCAL('wuyouke'),     fallback: _W('Wu_Youke.jpg'),                                                                         caption: '吳又可 — 歷代名醫圖贊 (추정)',          license: 'PD-old' },
  lichan:      { url: _LOCAL('lichan'),      fallback: _W('Li_Chan.jpg'),                                                                          caption: '李梴 (健齋) — 醫學入門 卷首 (추정)',    license: 'PD-old' },

  // ═ 清 (9인) ═
  yujiayan:    { url: _LOCAL('yujiayan'),    fallback: _W('Yu_Chang.jpg'),                                                                         caption: '喻嘉言(喻昌) — 歷代名醫圖贊 (추정)',    license: 'PD-old' },
  zhanglu:     { url: _LOCAL('zhanglu'),     fallback: '',                                                                                          caption: '張璐 — 局部肖像 (清初, 사용자 제공)',  license: 'PD-old' },
  yetianshi:   { url: _LOCAL('yetianshi'),   fallback: _W('Ye_Tianshi.jpg'),                                                                       caption: '葉天士 — 歷代名醫圖贊',                 license: 'PD-old' },
  xuexue:      { url: _LOCAL('xuexue'),      fallback: _W('Xue_Xue.jpg'),                                                                          caption: '薛雪 (生白) — 歷代名醫圖贊 (추정)',     license: 'PD-old' },
  wujutong:    { url: _LOCAL('wujutong'),    fallback: _W('Wu_Jutong.jpg'),                                                                        caption: '吳鞠通 — 歷代名醫圖贊 (추정)',          license: 'PD-old' },
  wangmengying:{ url: _LOCAL('wangmengying'),fallback: _W('Wang_Mengying.jpg'),                                                                    caption: '王孟英 (士雄) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },
  wangqingren: { url: _LOCAL('wangqingren'), fallback: _W('Wang_Qingren.jpg'),                                                                     caption: '王清任 — 歷代名醫圖贊 (추정)',          license: 'PD-old' },
  tangzonghai: { url: _LOCAL('tangzonghai'), fallback: _W('Tang_Zonghai.jpg'),                                                                     caption: '唐宗海 (容川) — 歷代名醫圖贊',          license: 'PD-old' },
  xudachun:    { url: _LOCAL('xudachun'),    fallback: _W('Xu_Dachun.jpg'),                                                                        caption: '徐大椿 (靈胎) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },

  // ═ 清末·民國 (5인) ═
  chengguopeng:{ url: _LOCAL('chengguopeng'),fallback: _W('Cheng_Guopeng.jpg'),                                                                    caption: '程國彭 (鍾齡) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },
  zhangxichun: { url: _LOCAL('zhangxichun','png'), fallback: _W('Zhang_Xichun.jpg'),                                                                     caption: '張錫純 (壽甫) — 民國 사진 (추정)',      license: 'PD-old' },
  zhengqinan:  { url: _LOCAL('zhengqinan'),  fallback: _W('Zheng_Qinan.jpg'),                                                                      caption: '鄭欽安 (火神派 시조) — 歷代名醫圖贊 (추정)', license: 'PD-old' },
  huangyuanyu: { url: _LOCAL('huangyuanyu'), fallback: _W('Huang_Yuanyu.jpg'),                                                                     caption: '黃元御 (玉楸) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },
  feibaixiong: { url: _LOCAL('feibaixiong'), fallback: _W('Fei_Boxiong.jpg'),                                                                      caption: '費伯雄 (晉卿) — 歷代名醫圖贊 (추정)',   license: 'PD-old' },

  // ═ 朝鮮 (2인) ═
  heojun:      { url: _LOCAL('heojun'),      fallback: _W('Heo_Jun-Choi_Gwang-su.jpg'),                                                            caption: '許浚 — 최광수 그림 (1989) 표준영정',    license: 'PD/공용' },
  leejema:     { url: _LOCAL('leejema'),     fallback: _W('Lee_Je-ma.jpg'),                                                                        caption: '李濟馬 — 표준영정',                     license: 'PD-old' },

  // ═ 番外 (시트콤) ═
  leesoonjae:  { url: 'images/characters/leesoonjae-medallion.jpeg',                                                                                caption: '이순재 — 거침없이 하이킥 (MBC 2006)',   license: 'fair-use, 개인 학습용' }
};

if(typeof window !== 'undefined'){
  window.CHARACTER_IMAGES = CHARACTER_IMAGES;
}
