/* data-jindan-tongue.js — 진단학 설진 데이터셋 v1.0
 * ============================================================================
 * 48장 설진 사진 — 圖-1~圖-8 (한방진단학 교재).
 * 5/19 설체 시험·5/26 설질 시험 대비.
 *
 *  - 설체 (舌體) = 形態: 胖大·瘦薄·齒痕·點刺·芒刺·裂紋·鏡面·粗老·瘀斑·偏
 *  - 설질 (舌質) = 色 + 苔: 淡白·淡紅·紅·絳·紫紅·紫·暗紅 + 苔色苔質
 *
 *  각 사진:
 *   • test_body / test_quality — 어느 시험 범위에 해당하는지
 *   • body_features            — 설체 핵심 키워드
 *   • quality_features         — 설질 핵심 키워드
 *   • pattern                  — 변증 (시험 ★ 표시 항목)
 *   • page                     — 교재 페이지 참조
 * ============================================================================ */

const TONGUES = [
  // ─── 圖-1 (①~⑥) ───
  {
    id: 1, img: 't01.jpg',
    han: '正常舌', label_full: '正常舌(淡紅舌)',
    ko: '정상설(담홍설)',
    body_features: ['正常'],
    quality_features: ['淡紅', '薄白苔'],
    pattern: '정상', pattern_han: '正常',
    test_body: true, test_quality: true,
    page: '66',
    notes: '淡紅 + 薄白苔 — 健康人 의 표준',
  },
  {
    id: 2, img: 't02.jpg',
    han: '胖大舌·齒痕', label_full: '胖大(齒痕)·淡紅 [氣虛]',
    ko: '반대(치흔)·담홍',
    body_features: ['胖大', '齒痕'],
    quality_features: ['淡紅'],
    pattern: '기허', pattern_han: '氣虛',
    test_body: true, test_quality: true,
    page: '66,69',
    notes: '舌體 가 두꺼워 잇자국이 남음 — 氣虛·陽虛 의 전형',
  },
  {
    id: 3, img: 't03.jpg',
    han: '瘦薄舌', label_full: '瘦薄舌 [陰虛]',
    ko: '수박설',
    body_features: ['瘦薄'],
    quality_features: [],
    pattern: '음허', pattern_han: '陰虛',
    test_body: true, test_quality: false,
    page: '66,68',
    notes: '舌體 가 야위어 얇음 — 氣血兩虛 또는 陰虛火旺',
  },
  {
    id: 4, img: 't04.jpg',
    han: '舌尖紅·點刺', label_full: '舌尖·紅点(点刺) [心火盛]',
    ko: '설첨·홍점(점자)',
    body_features: ['點刺'],
    quality_features: ['尖紅'],
    pattern: '심화성', pattern_han: '心火盛',
    test_body: true, test_quality: true,
    page: '67',
    notes: '舌尖 의 紅点 = 點刺 — 心火上炎. 設邊은 肝膽火, 設中은 胃火.',
  },
  {
    id: 5, img: 't05.jpg',
    han: '皺紋(裂紋)', label_full: '皺紋(裂紋) [陰虛]',
    ko: '추문(열문)',
    body_features: ['裂紋', '皺紋'],
    quality_features: [],
    pattern: '음허', pattern_han: '陰虛',
    test_body: true, test_quality: false,
    page: '69',
    notes: '舌面 의 깊은 균열 — 陰液 부족·津傷',
  },
  {
    id: 6, img: 't06.jpg',
    han: '鏡面舌·淡白', label_full: '鏡面舌·淡白 [陽虛]',
    ko: '경면설·담백',
    body_features: ['鏡面'],
    quality_features: ['淡白', '無苔'],
    pattern: '양허', pattern_han: '陽虛',
    test_body: true, test_quality: true,
    page: '66,67,69',
    notes: '苔 가 완전 박락되어 거울 같은 면 — 胃陰大傷·陽虛 모두 가능',
  },

  // ─── 圖-2 (⑦~⑫) ───
  {
    id: 7, img: 't07.jpg',
    han: '淡紅薄滑舌', label_full: '淡紅舌·薄滑舌 [濕證]',
    ko: '담홍·박활설',
    body_features: [],
    quality_features: ['淡紅', '薄滑苔'],
    pattern: '습증', pattern_han: '濕證',
    test_body: false, test_quality: true,
    page: '66',
    notes: '舌面 이 미끌미끌 (滑) — 痰飲·水濕',
  },
  {
    id: 8, img: 't08.jpg',
    han: '紅舌', label_full: '紅舌 [熱證]',
    ko: '홍설',
    body_features: [],
    quality_features: ['紅'],
    pattern: '열증', pattern_han: '熱證',
    test_body: false, test_quality: true,
    page: '66',
    notes: '舌色 紅 — 實熱 또는 虛熱',
  },
  {
    id: 9, img: 't09.jpg',
    han: '尖辺紅舌', label_full: '尖辺紅舌 [心肝火旺]',
    ko: '첨변홍설',
    body_features: [],
    quality_features: ['尖紅', '邊紅'],
    pattern: '심간화왕', pattern_han: '心肝火旺',
    test_body: false, test_quality: true,
    page: '67',
    notes: '舌尖 = 心火, 舌邊 = 肝膽火',
  },
  {
    id: 10, img: 't10.jpg',
    han: '紫紅舌·白膩苔', label_full: '紫紅舌·白膩苔 [血瘀·食積]',
    ko: '자홍·백니태',
    body_features: [],
    quality_features: ['紫紅', '白膩苔'],
    pattern: '혈어식적', pattern_han: '血瘀·食積',
    test_body: false, test_quality: true,
    page: '68,72',
    notes: '紫紅 = 血瘀 / 白膩 = 食積·痰濕',
  },
  {
    id: 11, img: 't11.jpg',
    han: '深紅舌·光滑腐苔', label_full: '深紅舌·光滑·腐苔 [陰虛]',
    ko: '심홍·광활·부태',
    body_features: ['光滑'],
    quality_features: ['深紅', '腐苔'],
    pattern: '음허', pattern_han: '陰虛',
    test_body: true, test_quality: true,
    page: '67',
    notes: '深紅 + 腐苔 — 陰液 大傷',
  },
  {
    id: 12, img: 't12.jpg',
    han: '紫紅舌', label_full: '紫紅舌',
    ko: '자홍설',
    body_features: [],
    quality_features: ['紫紅'],
    pattern: '혈어 또는 열독', pattern_han: '血瘀/熱毒',
    test_body: false, test_quality: true,
    page: '68,72',
    notes: '紫紅 — 熱深·血瘀',
  },

  // ─── 圖-3 (⑬~⑱) ───
  {
    id: 13, img: 't13.jpg',
    han: '紫舌·白膩苔', label_full: '紫舌·白膩苔 [血瘀挾湿]',
    ko: '자설·백니태',
    body_features: [],
    quality_features: ['紫', '白膩苔'],
    pattern: '혈어협습', pattern_han: '血瘀挾濕',
    test_body: false, test_quality: true,
    page: '67,72',
    notes: '紫 = 寒凝/血瘀, 白膩 = 寒濕痰飲',
  },
  {
    id: 14, img: 't14.jpg',
    han: '暗紅舌·瘀斑·薄黃苔', label_full: '暗紅舌·舌辺에 瘀斑·薄黃苔 [血瘀]',
    ko: '암홍·어반·박황태',
    body_features: ['瘀斑'],
    quality_features: ['暗紅', '薄黃苔'],
    pattern: '혈어', pattern_han: '血瘀',
    test_body: true, test_quality: true,
    page: '73',
    notes: '舌邊 의 紫斑 = 瘀斑 — 血瘀 의 결정적 단서',
  },
  {
    id: 15, img: 't15.jpg',
    han: '滑苔', label_full: '滑苔 [濕証]',
    ko: '활태',
    body_features: [],
    quality_features: ['滑苔'],
    pattern: '습증', pattern_han: '濕證',
    test_body: false, test_quality: true,
    page: '',
    notes: '舌面 에 물기 — 痰飲·水濕',
  },
  {
    id: 16, img: 't16.jpg',
    han: '白厚苔', label_full: '白厚苔 [痰湿]',
    ko: '백후태',
    body_features: [],
    quality_features: ['白厚苔'],
    pattern: '담습', pattern_han: '痰濕',
    test_body: false, test_quality: true,
    page: '72',
    notes: '백색의 두꺼운 苔 — 寒濕·痰濁 내성',
  },
  {
    id: 17, img: 't17.jpg',
    han: '淡黃膩苔', label_full: '淡黃膩苔 [痰湿化熱]',
    ko: '담황니태',
    body_features: [],
    quality_features: ['淡黃膩苔'],
    pattern: '담습화열', pattern_han: '痰濕化熱',
    test_body: false, test_quality: true,
    page: '73',
    notes: '白苔 → 黃 변화는 화열의 신호',
  },
  {
    id: 18, img: 't18.jpg',
    han: '淡黃垢膩苔', label_full: '淡黃垢膩苔 [痰湿化熱·挟食]',
    ko: '담황구니태',
    body_features: [],
    quality_features: ['淡黃垢膩苔'],
    pattern: '담습화열·협식', pattern_han: '痰濕化熱·挾食',
    test_body: false, test_quality: true,
    page: '73',
    notes: '垢 = 더러움 / 食滯 + 痰濕 + 화열',
  },

  // ─── 圖-4 (⑲~㉔) ───
  {
    id: 19, img: 't19.jpg',
    han: '黃膩苔', label_full: '黃膩苔 [湿熱]',
    ko: '황니태',
    body_features: [],
    quality_features: ['黃膩苔'],
    pattern: '습열', pattern_han: '濕熱',
    test_body: false, test_quality: true,
    page: '74',
    notes: '黃 + 膩 의 결합 — 濕熱의 가장 흔한 표상',
  },
  {
    id: 20, img: 't20.jpg',
    han: '黃膩苔·剝苔', label_full: '黃膩苔·剝苔 [陰虛]',
    ko: '황니태·박태',
    body_features: [],
    quality_features: ['黃膩苔', '剝苔'],
    pattern: '음허', pattern_han: '陰虛',
    test_body: false, test_quality: true,
    page: '77',
    notes: '苔 가 부분적으로 박락 — 胃陰·肝陰 손상',
  },
  {
    id: 21, img: 't21.jpg',
    han: '半截剝苔', label_full: '半截剝苔 [肺胃陰虛]',
    ko: '반절박태',
    body_features: [],
    quality_features: ['半截剝苔'],
    pattern: '폐위음허', pattern_han: '肺胃陰虛',
    test_body: false, test_quality: true,
    page: '77,78',
    notes: '舌의 절반만 苔가 박락 — 부위에 따른 변증',
  },
  {
    id: 22, img: 't22.jpg',
    han: '花剝苔', label_full: '花剝苔 [気虛]',
    ko: '화박태',
    body_features: [],
    quality_features: ['花剝苔'],
    pattern: '기허', pattern_han: '氣虛',
    test_body: false, test_quality: true,
    page: '77',
    notes: '苔 가 꽃잎처럼 군데군데 박락 — 胃氣陰兩虛',
  },
  {
    id: 23, img: 't23.jpg',
    han: '花剝苔·滑苔', label_full: '花剝苔·滑苔 [気虛]',
    ko: '화박태·활태',
    body_features: [],
    quality_features: ['花剝苔', '滑苔'],
    pattern: '기허', pattern_han: '氣虛',
    test_body: false, test_quality: true,
    page: '77',
    notes: '花剝 + 滑 — 기허·습체 동시',
  },
  {
    id: 24, img: 't24.jpg',
    han: '地圖舌', label_full: '地図舌 [気虛]',
    ko: '지도설',
    body_features: [],
    quality_features: ['地圖苔'],
    pattern: '기허', pattern_han: '氣虛',
    test_body: false, test_quality: true,
    page: '77,78',
    notes: '苔 박락 부위가 지도처럼 — 花剝의 한 형태',
  },

  // ─── 圖-5 (㉕~㉚) ───
  {
    id: 25, img: 't25.jpg',
    han: '齒痕舌', label_full: '齒痕舌',
    ko: '치흔설',
    body_features: ['齒痕'],
    quality_features: [],
    pattern: '기허/양허', pattern_han: '氣虛/陽虛',
    test_body: true, test_quality: false,
    page: '66,69',
    notes: '잇자국 — 胖大 동반 多, 氣虛·陽虛',
  },
  {
    id: 26, img: 't26.jpg',
    han: '齒痕舌(肥大)', label_full: '齒痕舌(肥大)',
    ko: '치흔설(비대)',
    body_features: ['齒痕', '肥大'],
    quality_features: [],
    pattern: '기허', pattern_han: '氣虛',
    test_body: true, test_quality: false,
    page: '69',
    notes: '胖大 + 齒痕 — 氣虛·脾虛',
  },
  {
    id: 27, img: 't27.jpg',
    han: '齒痕舌(肥大)', label_full: '齒痕舌[肥大]',
    ko: '치흔설[비대]',
    body_features: ['齒痕', '肥大'],
    quality_features: [],
    pattern: '기허', pattern_han: '氣虛',
    test_body: true, test_quality: false,
    page: '69',
    notes: '심한 齒痕 + 肥大 — 脾陽虛',
  },
  {
    id: 28, img: 't28.jpg',
    han: '絳舌', label_full: '絳舌',
    ko: '강설',
    body_features: [],
    quality_features: ['絳'],
    pattern: '열입영혈', pattern_han: '熱入營血',
    test_body: false, test_quality: true,
    page: '67',
    notes: '紅 보다 더 짙은 색 — 營血分熱·陰虛火旺',
  },
  {
    id: 29, img: 't29.jpg',
    han: '絳舌', label_full: '絳舌',
    ko: '강설',
    body_features: [],
    quality_features: ['絳'],
    pattern: '열입영혈', pattern_han: '熱入營血',
    test_body: false, test_quality: true,
    page: '67',
    notes: '絳 + 裂紋 — 陰液 大傷',
  },
  {
    id: 30, img: 't30.jpg',
    han: '鏡面舌', label_full: '鏡面舌',
    ko: '경면설',
    body_features: ['鏡面'],
    quality_features: ['無苔'],
    pattern: '음허', pattern_han: '陰虛',
    test_body: true, test_quality: false,
    page: '67,69',
    notes: '苔 의 완전 박락 — 胃陰枯竭',
  },

  // ─── 圖-6 (㉛~㊱) ───
  {
    id: 31, img: 't31.jpg',
    han: '鏡面舌', label_full: '鏡面舌',
    ko: '경면설',
    body_features: ['鏡面'],
    quality_features: ['無苔'],
    pattern: '음허', pattern_han: '陰虛',
    test_body: true, test_quality: false,
    page: '67,69',
    notes: '심한 鏡面舌 — 危重 신호',
  },
  {
    id: 32, img: 't32.jpg',
    han: '紫紅舌', label_full: '紫紅舌',
    ko: '자홍설',
    body_features: [],
    quality_features: ['紫紅'],
    pattern: '열독/혈어', pattern_han: '熱毒/血瘀',
    test_body: false, test_quality: true,
    page: '67',
    notes: '진한 紫紅 — 熱毒·瘀血',
  },
  {
    id: 33, img: 't33.jpg',
    han: '紫紅舌', label_full: '紫紅舌',
    ko: '자홍설',
    body_features: ['裂紋'],
    quality_features: ['紫紅'],
    pattern: '열독·음허', pattern_han: '熱毒·陰虛',
    test_body: true, test_quality: true,
    page: '67',
    notes: '紫紅 + 裂紋 — 熱毒 + 陰傷',
  },
  {
    id: 34, img: 't34.jpg',
    han: '粗老舌', label_full: '粗老',
    ko: '조로설',
    body_features: ['粗老'],
    quality_features: [],
    pattern: '실증', pattern_han: '實證',
    test_body: true, test_quality: false,
    page: '68',
    notes: '舌質이 거칠고 늙어 보임 — 實證 / 실독',
  },
  {
    id: 35, img: 't35.jpg',
    han: '裂紋舌(紅絳)', label_full: '裂紋(紅絳)',
    ko: '열문(홍강)',
    body_features: ['裂紋'],
    quality_features: ['紅絳'],
    pattern: '음허화왕', pattern_han: '陰虛火旺',
    test_body: true, test_quality: true,
    page: '69',
    notes: '紅絳 + 裂紋 — 陰虛火旺·熱盛',
  },
  {
    id: 36, img: 't36.jpg',
    han: '裂紋舌(淡白)', label_full: '裂紋(淡白)',
    ko: '열문(담백)',
    body_features: ['裂紋'],
    quality_features: ['淡白'],
    pattern: '기혈양허', pattern_han: '氣血兩虛',
    test_body: true, test_quality: true,
    page: '69',
    notes: '淡白 + 裂紋 — 氣血 兩虛·營血 부족',
  },

  // ─── 圖-7 (㊲~㊷) ───
  {
    id: 37, img: 't37.jpg',
    han: '芒刺', label_full: '芒刺',
    ko: '망자',
    body_features: ['芒刺'],
    quality_features: [],
    pattern: '열성', pattern_han: '熱盛',
    test_body: true, test_quality: false,
    page: '69',
    notes: '점자가 융기되어 가시처럼 — 熱盛·心肝火 (영분 진입)',
  },
  {
    id: 38, img: 't38.jpg',
    han: '正常薄白苔', label_full: '正常舌의 薄白苔',
    ko: '정상박백태',
    body_features: [],
    quality_features: ['薄白苔'],
    pattern: '정상', pattern_han: '正常',
    test_body: false, test_quality: true,
    page: '72',
    notes: '얇고 균일한 백색 苔 — 정상',
  },
  {
    id: 39, img: 't39.jpg',
    han: '白厚腐苔', label_full: '白厚腐苔',
    ko: '백후부태',
    body_features: [],
    quality_features: ['白厚苔', '腐苔'],
    pattern: '식적/담탁', pattern_han: '食積/痰濁',
    test_body: false, test_quality: true,
    page: '72,77',
    notes: '두께운 백색 + 두부 같은 부태 — 食滯',
  },
  {
    id: 40, img: 't40.jpg',
    han: '白厚滑膩苔', label_full: '白厚滑膩苔',
    ko: '백후활니태',
    body_features: [],
    quality_features: ['白厚苔', '滑苔', '膩苔'],
    pattern: '한습', pattern_han: '寒濕',
    test_body: false, test_quality: true,
    page: '72,77',
    notes: '白 + 厚 + 滑 + 膩 — 寒濕困脾',
  },
  {
    id: 41, img: 't41.jpg',
    han: '白滑亮苔', label_full: '白滑亮苔',
    ko: '백활량태',
    body_features: [],
    quality_features: ['白滑苔'],
    pattern: '한습', pattern_han: '寒濕',
    test_body: false, test_quality: true,
    page: '72',
    notes: '白 + 윤기 — 陽虛水濕',
  },
  {
    id: 42, img: 't42.jpg',
    han: '黃薄乾苔', label_full: '黃薄乾苔',
    ko: '황박건태',
    body_features: [],
    quality_features: ['黃苔', '薄苔', '乾苔'],
    pattern: '열상진', pattern_han: '熱傷津',
    test_body: false, test_quality: true,
    page: '73',
    notes: '얇은 황색 + 건조 — 熱이 津을 상한 초기',
  },

  // ─── 圖-8 (㊸~㊽) ───
  {
    id: 43, img: 't43.jpg',
    han: '黃厚燥苔', label_full: '黃厚燥苔',
    ko: '황후조태',
    body_features: [],
    quality_features: ['黃苔', '厚苔', '燥苔'],
    pattern: '실열·열결', pattern_han: '實熱·熱結',
    test_body: false, test_quality: true,
    page: '73',
    notes: '두꺼운 황색 + 건조 — 陽明腑實/熱結',
  },
  {
    id: 44, img: 't44.jpg',
    han: '黃厚燥裂苔', label_full: '黃厚燥裂苔',
    ko: '황후조열태',
    body_features: ['裂紋'],
    quality_features: ['黃苔', '厚苔', '燥苔'],
    pattern: '열극상음', pattern_han: '熱極傷陰',
    test_body: true, test_quality: true,
    page: '73',
    notes: '두꺼운 황색 + 갈라짐 — 熱極·陰大傷',
  },
  {
    id: 45, img: 't45.jpg',
    han: '黑苔', label_full: '黑苔',
    ko: '흑태',
    body_features: [],
    quality_features: ['黑苔'],
    pattern: '열극/극한', pattern_han: '熱極/極寒',
    test_body: false, test_quality: true,
    page: '74',
    notes: '黑 — 燥黑은 熱極傷陰, 滑黑은 陽虛寒盛',
  },
  {
    id: 46, img: 't46.jpg',
    han: '黑苔', label_full: '黑苔',
    ko: '흑태',
    body_features: [],
    quality_features: ['黑苔'],
    pattern: '열극/극한', pattern_han: '熱極/極寒',
    test_body: false, test_quality: true,
    page: '74',
    notes: '黑苔 위중증의 신호',
  },
  {
    id: 47, img: 't47.jpg',
    han: '偏左白苔', label_full: '偏左白苔',
    ko: '편좌백태',
    body_features: ['偏左'],
    quality_features: ['白苔'],
    pattern: '편향', pattern_han: '偏盛',
    test_body: true, test_quality: true,
    page: '78',
    notes: '舌의 한쪽 (좌측) 에만 苔 — 좌측 邪盛',
  },
  {
    id: 48, img: 't48.jpg',
    han: '剝苔', label_full: '剝苔',
    ko: '박태',
    body_features: [],
    quality_features: ['剝苔'],
    pattern: '위음허', pattern_han: '胃陰虛',
    test_body: false, test_quality: true,
    page: '77',
    notes: '苔 의 박락 — 胃陰·胃氣 손상',
  },
];

// ─── 보조 인덱스 ───────────────────────────────────────────────────────
const TONGUE_BY_ID = {};
TONGUES.forEach(t => { TONGUE_BY_ID[t.id] = t; });

// 시험 모드별 사진 필터
function tonguesForMode(mode){
  // v11.5: 새 분류 (사용자 규칙 — 라벨에 "苔" 있으면 설태, 없으면 설질, 둘 다 있으면 복합)
  // mode: 'jilji' (설질) | 'seoltai' (설태) | 'both' (전체) | 'body'·'quality' (legacy)
  if(mode === 'jilji')   return TONGUES.filter(t => t.category === 'jilji' || t.category === 'both');
  if(mode === 'seoltai') return TONGUES.filter(t => t.category === 'seoltai' || t.category === 'both');
  if(mode === 'body')    return TONGUES.filter(t => t.test_body);      // legacy
  if(mode === 'quality') return TONGUES.filter(t => t.test_quality);   // legacy
  return TONGUES;
}

// ─── v11.5 분류 patch — 사용자 규칙 「苔 = 설태, 아니면 설질, 둘 다 = 복합」 ───
// (기존 데이터 객체에 category 필드 주입. 사진 라벨/변증/notes 는 그대로 유지.)
// v11.5.1: 38 (正常舌의 薄白苔) → 설태로 이전 (사용자 결정 — 사진 본질이 苔 학습).
const _CAT_SEOLTAI = new Set([15,16,17,18,19,20,21,22,23,38,39,40,41,42,43,44,45,46,47,48]);
const _CAT_BOTH    = new Set([10,11,13,14]);
// 나머지 (24장): jilji
TONGUES.forEach(t => {
  if(_CAT_BOTH.has(t.id))         t.category = 'both';
  else if(_CAT_SEOLTAI.has(t.id)) t.category = 'seoltai';
  else                            t.category = 'jilji';
});

// ─── 시험 일정 ────────────────────────────────────────────────────────
// v11.5: 사용자 명명 그대로 — 5/19 「설체」 시험, 5/26 「설질」 시험.
//   진단학적으로 「설체 = 설질」 (舌體 ≡ 舌質) 이나 강의 용어 존중.
//   학습은 분류 (jilji / seoltai) 로 진행되며 시험 일정은 D-N 표시 용도.
const JINDAN_EXAMS = [
  { id:'tongue1', subject:'진단학', label:'설진 1차', date:'2026-05-19T10:00:00+09:00', han:'舌體', accent:'#9C3030', desc:'중간 성적' },
  { id:'tongue2', subject:'진단학', label:'설진 2차', date:'2026-05-26T10:00:00+09:00', han:'舌質', accent:'#2A7060', desc:'기말 성적' },
];

if(typeof window !== 'undefined'){
  window.TONGUES = TONGUES;
  window.TONGUE_BY_ID = TONGUE_BY_ID;
  window.tonguesForMode = tonguesForMode;
  window.JINDAN_EXAMS = JINDAN_EXAMS;
  window.TONGUE_REFERENCES = TONGUE_REFERENCES;
}

// ─── 참고서적 ────────────────────────────────────────────────────────
// v11.6.1 UPDATE: 한의대 표준교재 (현행) 로 보강·교체.
//   기존 「한방진단학 (대성출판사)」 → 「한의진단학 진찰편·진단편 (군자출판사)」로 정확화.
//   Maciocia 본은 2021년 3판 (사진 175장) 으로 업데이트.
//   국내 임상가용 컬러 아틀라스·실습서·중의진단학 통합본 추가.
//
//   각 entry:
//     name_ko / name_han  — 한글·한자 제목
//     authors             — 저자
//     pub                 — 출판사
//     year                — 출판연도
//     lang                — 'ko' | 'en' | 'zh'
//     pages               — 사진/색표 약 수
//     why                 — 본 PWA 학습에 어떻게 활용 가능한지 (한 줄)
//     standard            — 한국 한의대 표준교재 여부
const TONGUE_REFERENCES = [
  {
    name_ko:'한의진단학 — 진찰편', name_han:'韓醫診斷學 — 診察篇',
    authors:'한의진단학 편찬위원회 (대한한의진단학회)',
    pub:'군자출판사', year:'2019 (전면개정)', lang:'ko',
    pages:'설진 章 본문 + 컬러 도판 약 50',
    why:'대한한의진단학회 공식 교재. 望診(설진 포함) 전반의 체계적 분류. 시험 출제 표준.',
    standard:true,
  },
  {
    name_ko:'한의진단학 — 진단편', name_han:'韓醫診斷學 — 診斷篇',
    authors:'한의진단학 편찬위원회 (대한한의진단학회)',
    pub:'군자출판사', year:'2019', lang:'ko',
    pages:'변증·진단 체계',
    why:'진찰편의 자매편. 변증 논리 (설진 → 변증 연결). 설진 단원과 별도 학습.',
    standard:true,
  },
  {
    name_ko:'한의진단학 실습', name_han:'韓醫診斷學 實習',
    authors:'대한한의진단학회 / 한의진단학실습 편찬위원회',
    pub:'군자출판사', year:'2020', lang:'ko',
    pages:'실습 매뉴얼 + 사진',
    why:'한의과대학 진단 실습 지도용. 실제 환자 사진·소견 작성 양식 수록. 설진 임상 적용 강화.',
    standard:true,
  },
  {
    name_ko:'동의진단학', name_han:'東醫診斷學',
    authors:'이봉교 외',
    pub:'성보사', year:'1985 (1版) · 이후 重刷',
    lang:'ko',
    pages:'설진 도판 약 30',
    why:'1세대 표준교재. 韓醫 전통 관점의 설진 분류 + 변증 연계. 군자판과 비교 학습 권장.',
    standard:true,
  },
  {
    name_ko:'중의진단학 (한역)', name_han:'中醫診斷學',
    authors:'홍순석 譯',
    pub:'군자출판사', year:'2014',
    lang:'ko',
    pages:'설진 章 단독 + 컬러 도판',
    why:'중의약대학 統編教材 한역본. 한국 교재보다 설진 항목이 세분화 (淡白舌·淡紅舌·紅舌·絳舌·紫舌 별도 章). 깊이 학습용.',
    standard:false,
  },
  {
    name_ko:'설진 임상증례집 — 컬러 아틀라스',
    name_han:'舌診 臨床症例集',
    authors:'한의학 임상연구회 編',
    pub:'한미의학', year:'2008',
    lang:'ko',
    pages:'환자 사진 + 임상 case 200+',
    why:'증례 중심으로 「혀 소견 → 변증·처방」 흐름. 시험 후 임상 단계에서 유용.',
    standard:false,
  },
  {
    name_ko:'중의설진도보', name_han:'中醫舌診圖譜',
    authors:'人民衛生出版社 編',
    pub:'人民衛生出版社', year:'2010~ (개정 다수)',
    lang:'zh',
    pages:'컬러 사진 200+',
    why:'설질·설태 조합별 대표 사진 풍부. 對位 매트릭스 셀별 사진 보강에 최적.',
    standard:false,
  },
  {
    name_ko:'Atlas of Chinese Tongue Diagnosis',
    name_han:'(중국 설진 아틀라스)',
    authors:'Barbara Kirschbaum',
    pub:'Eastland Press (US)', year:'2010 (2nd ed.)',
    lang:'en',
    pages:'컬러 사진 320+',
    why:'서양인 환자 사진 多. 五臟 別 (肺·脾胃·腎·心·肝) 정리. 임상 case 풍부.',
    standard:false,
  },
  {
    name_ko:'Tongue Diagnosis in Chinese Medicine (Maciocia)',
    name_han:'(설진학)',
    authors:'Giovanni Maciocia',
    pub:'Eastland Press', year:'2021 (3rd ed., 신간)',
    lang:'en',
    pages:'컬러 사진 175 (3판 기준, 100 점이 신규)',
    why:'영문 표준 텍스트 30년 베스트. 設形·色·苔 체계 + 六經·四分·三焦 변증 연계. 본 PWA 변증 해설 보강의 기준.',
    standard:false,
  },
  {
    name_ko:'Pocket Atlas of Tongue Diagnosis (Schnorrenberger)',
    name_han:'(포켓 설진 아틀라스)',
    authors:'Claus C. Schnorrenberger',
    pub:'Thieme', year:'2011 (2nd ed.)',
    lang:'en',
    pages:'컬러 도판 + 침구·처방·식이',
    why:'휴대용 아틀라스. 설진 → 침구·처방·식이 통합 가이드. 임상 빠른 참조용.',
    standard:false,
  },
  {
    name_ko:'대한한의진단학회지', name_han:'大韓韓醫診斷學會誌',
    authors:'대한한의진단학회',
    pub:'대한한의진단학회', year:'분기 발행 (KCI 등재)',
    lang:'ko',
    pages:'논문',
    why:'설진 정량화·디지털 설진기·AI 분석 등 최신 연구. KCI 검색 가능.',
    standard:false,
  },
  {
    name_ko:'국가한의임상정보포털 (NCKM)',
    name_han:'(NCKM)',
    authors:'한국한의학연구원',
    pub:'https://nikom.or.kr/nckm', year:'운영중',
    lang:'ko',
    pages:'웹 DB',
    why:'한의 임상 표준 정보 (변증·처방·진단 기준) 공식 포털. 임상가 표준 참조.',
    standard:false,
  },
];
