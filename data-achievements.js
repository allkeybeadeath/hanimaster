/* data-achievements.js — v9.7
 * ============================================================================
 * 업적(業績) 정의 — 印章(seal) 보상 → 프로필 꾸미기 시스템
 *
 * ─── 구조 ────────────────────────────────────────────────────────────────
 *
 *   ACHIEVEMENTS : 업적 배열 (각: id, han, ko, cat, desc, cond, sealHan, color, tier)
 *     id       : 영구 ID (S.achievements 배열에 저장됨)
 *     han      : 한자 명칭 (2-3자)
 *     ko       : 한글 명칭
 *     cat      : 카테고리 (학습/문답/章典/氣博/流派/時辰/同學/特技)
 *     desc     : 해제 조건 설명 (사용자 표시용)
 *     cond     : { type, ... } — 런타임 조건 평가 객체
 *     sealHan  : 印章에 박힐 한자 1-2자
 *     color    : 印章 색
 *     tier     : 'bronze'|'silver'|'gold'|'jade' (희귀도)
 *
 * ─── 조건 type ───────────────────────────────────────────────────────────
 *
 *   counter_gte    : 카운터(name)가 threshold 이상
 *                    e.g. {type:'counter_gte', name:'totalAnswered', threshold:50}
 *   streak_gte     : 연속 정답(streakBest) ≥ threshold
 *   perfectQuiz    : 全 정답 퀴즈 횟수 ≥ threshold
 *   battleWin      : 對決 승수 ≥ threshold
 *   battleStreak   : 對決 연승(최고) ≥ threshold
 *   battleBetLevel : 특정 베팅 레벨에서 승리 ≥ threshold
 *                    e.g. {type:'battleBetLevel', level:3, threshold:5}  // 大博 5승
 *   characterCount : 사용한 캐릭터 카테고리 수 ≥ threshold
 *   characterDivine: 神階 N인 해금
 *   signatureFired : 시그니처 효과 누적 발동 ≥ threshold
 *   timeOfDay      : 특정 시간대(localHour in range)에 학습
 *                    e.g. {type:'timeOfDay', from:0, to:6}
 *   examDay        : D-Day(시험 당일) 학습
 *   chapterClear   : 한 章의 모든 문제 정답 (chapter 키워드 매칭)
 *   wrongCleared   : S.wrongIds 가 0개 (오답함 비움)
 *   chatPosted     : 채팅에 메시지 N회 게시
 *   cubeJoined     : 큐브 對局 N회 참여
 *   custom         : (배포 후 추가용 — 코드에서 직접 awardAchievement 호출)
 *
 * ─── 카테고리(cat) 색상 (UI에서 사용) ────────────────────────────────────
 *   '학습'   : #876A36 (gutong)
 *   '문답'   : #9C3030 (zhusha)
 *   '章典'   : #C9A227 (huang)
 *   '氣博'   : #2A7060 (feicui)
 *   '流派'   : #6E5396 (xuan-violet)
 *   '時辰'   : #2C2E48 (xuan)
 *   '同學'   : #C04848 (zhusha-l)
 *   '特技'   : #5C8F3A (옅은 녹)
 * ============================================================================ */

const ACHIEVEMENTS = [

  // ═══ 學徒 (학습 진도) — 9 ═══════════════════════════════════════════════
  { id:'first_step',     han:'初步',   ko:'첫걸음',         cat:'학습', sealHan:'初', color:'#876A36', tier:'bronze',
    desc:'첫 문제 풀이 완료',
    cond:{type:'counter_gte', name:'totalAnswered', threshold:1} },
  { id:'study_10',       han:'學徒',   ko:'學徒 — 10문',     cat:'학습', sealHan:'徒', color:'#876A36', tier:'bronze',
    desc:'누적 10문제 풀이',
    cond:{type:'counter_gte', name:'totalAnswered', threshold:10} },
  { id:'study_50',       han:'醫工',   ko:'醫工 — 50문',     cat:'학습', sealHan:'工', color:'#876A36', tier:'silver',
    desc:'누적 50문제 풀이',
    cond:{type:'counter_gte', name:'totalAnswered', threshold:50} },
  { id:'study_100',      han:'醫師',   ko:'醫師 — 100문',    cat:'학습', sealHan:'師', color:'#876A36', tier:'silver',
    desc:'누적 100문제 풀이',
    cond:{type:'counter_gte', name:'totalAnswered', threshold:100} },
  { id:'study_300',      han:'良醫',   ko:'良醫 — 300문',    cat:'학습', sealHan:'良', color:'#C9A227', tier:'gold',
    desc:'누적 300문제 풀이',
    cond:{type:'counter_gte', name:'totalAnswered', threshold:300} },
  { id:'study_1000',     han:'大醫',   ko:'大醫 — 1,000문',  cat:'학습', sealHan:'大', color:'#C9A227', tier:'gold',
    desc:'누적 1,000문제 풀이',
    cond:{type:'counter_gte', name:'totalAnswered', threshold:1000} },
  { id:'master_5',       han:'通方',   ko:'5처방 마스터',     cat:'학습', sealHan:'通', color:'#876A36', tier:'silver',
    desc:'5개 처방 마스터 (knownIds 길이)',
    cond:{type:'counter_gte', name:'knownIdsCount', threshold:5} },
  { id:'master_15',      han:'熟方',   ko:'15처방 마스터',    cat:'학습', sealHan:'熟', color:'#C9A227', tier:'gold',
    desc:'15개 처방 마스터',
    cond:{type:'counter_gte', name:'knownIdsCount', threshold:15} },
  { id:'flash_50',       han:'暗誦',   ko:'플래시 50',       cat:'학습', sealHan:'誦', color:'#876A36', tier:'silver',
    desc:'플래시카드 50회 풀이',
    cond:{type:'counter_gte', name:'flashRatedCount', threshold:50} },

  // ═══ 問答 (퀴즈) — 7 ═══════════════════════════════════════════════════
  { id:'streak_5',       han:'連中',   ko:'5연속 정답',       cat:'문답', sealHan:'連', color:'#9C3030', tier:'bronze',
    desc:'한 퀴즈 내 5문제 연속 정답',
    cond:{type:'streak_gte', threshold:5} },
  { id:'streak_10',      han:'十連',   ko:'10연속 정답',      cat:'문답', sealHan:'十', color:'#9C3030', tier:'silver',
    desc:'한 퀴즈 내 10문제 연속 정답',
    cond:{type:'streak_gte', threshold:10} },
  { id:'streak_20',      han:'廿連',   ko:'20연속 정답',      cat:'문답', sealHan:'廿', color:'#C9A227', tier:'gold',
    desc:'한 퀴즈 내 20문제 연속 정답',
    cond:{type:'streak_gte', threshold:20} },
  { id:'perfect_1',      han:'完璧',   ko:'첫 全 정답',       cat:'문답', sealHan:'璧', color:'#C9A227', tier:'silver',
    desc:'한 퀴즈에서 全 정답 1회',
    cond:{type:'perfectQuiz', threshold:1} },
  { id:'perfect_5',      han:'五璧',   ko:'全 정답 5회',      cat:'문답', sealHan:'五', color:'#C9A227', tier:'gold',
    desc:'全 정답 누적 5회',
    cond:{type:'perfectQuiz', threshold:5} },
  { id:'perfect_10',     han:'十全',   ko:'全 정답 10회',     cat:'문답', sealHan:'十', color:'#2A7060', tier:'jade',
    desc:'全 정답 누적 10회 — 十全大補',
    cond:{type:'perfectQuiz', threshold:10} },
  { id:'wrong_clear',    han:'知過',   ko:'오답함 비움',      cat:'문답', sealHan:'過', color:'#9C3030', tier:'silver',
    desc:'오답함을 비워본 적 있음',
    cond:{type:'wrongCleared'} },

  // ═══ 章典 (章별 마스터) — 3 ═══════════════════════════════════════════
  { id:'chap_buik',      han:'補益',   ko:'補益章 通',         cat:'章典', sealHan:'補', color:'#C9A227', tier:'gold',
    desc:'8장 補益劑 문제 30개 정답',
    cond:{type:'counter_gte', name:'rightByChapter:8', threshold:30} },
  { id:'chap_biaoli',    han:'雙解',   ko:'表裏雙解章 通',     cat:'章典', sealHan:'雙', color:'#C9A227', tier:'gold',
    desc:'7장 表裏雙解劑 문제 20개 정답',
    cond:{type:'counter_gte', name:'rightByChapter:7', threshold:20} },
  { id:'chap_three',     han:'兩章',   ko:'兩章 貫通',         cat:'章典', sealHan:'貫', color:'#2A7060', tier:'jade',
    desc:'7·8장 모두 각 20문제 이상 정답',
    cond:{type:'allChaptersCleared'} },
  // v10.0.8: 6장 溫裏劑 章典(chap_wenli) 제거 — 2차 수시 범위 외. chap_three는 兩章(7+8) 기준으로 갱신.

  // ═══ 氣博 (멀티 對決) — 6 ════════════════════════════════════════════
  { id:'battle_1',       han:'初戰',   ko:'첫 對決',           cat:'氣博', sealHan:'初', color:'#2A7060', tier:'bronze',
    desc:'對決 1회 참여',
    cond:{type:'counter_gte', name:'battleAttended', threshold:1} },
  { id:'battle_win_5',   han:'五勝',   ko:'5승',              cat:'氣博', sealHan:'勝', color:'#2A7060', tier:'silver',
    desc:'對決 누적 5승',
    cond:{type:'battleWin', threshold:5} },
  { id:'battle_win_20',  han:'廿勝',   ko:'20승',             cat:'氣博', sealHan:'廿', color:'#C9A227', tier:'gold',
    desc:'對決 누적 20승',
    cond:{type:'battleWin', threshold:20} },
  { id:'streak_3w',      han:'三連勝', ko:'3연승',             cat:'氣博', sealHan:'連', color:'#2A7060', tier:'silver',
    desc:'對決 3연승',
    cond:{type:'battleStreak', threshold:3} },
  { id:'streak_10w',     han:'不敗',   ko:'10연승',            cat:'氣博', sealHan:'敗', color:'#2A7060', tier:'jade',
    desc:'對決 10연승 — 不敗',
    cond:{type:'battleStreak', threshold:10} },
  { id:'big_bet_win',    han:'大博',   ko:'大博 승리',          cat:'氣博', sealHan:'博', color:'#C9A227', tier:'gold',
    desc:'大博(베팅 3단계)에서 승리',
    cond:{type:'battleBetLevel', level:3, threshold:1} },
  { id:'fate_bet_win',   han:'賭命',   ko:'賭命 승리',          cat:'氣博', sealHan:'命', color:'#9C3030', tier:'jade',
    desc:'賭命(베팅 4단계)에서 승리 — 50% 베팅 도박',
    cond:{type:'battleBetLevel', level:4, threshold:1} },

  // ═══ 流派 (캐릭터 사용) — 5 ════════════════════════════════════════════
  { id:'char_8cats',     han:'流派',   ko:'8 流派 涉獵',        cat:'流派', sealHan:'派', color:'#6E5396', tier:'gold',
    desc:'8개 카테고리 캐릭터를 모두 사용',
    cond:{type:'characterCount', threshold:8} },
  { id:'divine_1',       han:'神階',   ko:'神階 1인 해금',       cat:'流派', sealHan:'神', color:'#C9A227', tier:'silver',
    desc:'神階 캐릭터 1인 해금',
    cond:{type:'characterDivine', threshold:1} },
  { id:'divine_all',     han:'神格',   ko:'全 神階 해금',        cat:'流派', sealHan:'帝', color:'#C9A227', tier:'jade',
    desc:'神階 5인 모두 해금',
    cond:{type:'characterDivine', threshold:5} },
  { id:'master_with',    han:'行家',   ko:'한 캐릭터 100문',      cat:'流派', sealHan:'行', color:'#6E5396', tier:'gold',
    desc:'동일 캐릭터로 100문제 정답',
    cond:{type:'counter_gte', name:'maxRightByChar', threshold:100} },
  { id:'meme',           han:'番外',   ko:'이순재 사용',          cat:'流派', sealHan:'番', color:'#C9A227', tier:'silver',
    desc:'이순재로 문제 1개 정답',
    cond:{type:'counter_gte', name:'rightByChar:leesoonjae', threshold:1} },

  // ═══ 時辰 (시간) — 5 ══════════════════════════════════════════════════
  { id:'time_zi',        han:'子時',   ko:'子時 학습 (23-1시)',  cat:'時辰', sealHan:'子', color:'#2C2E48', tier:'silver',
    desc:'子時(23-01시) 학습',
    cond:{type:'timeOfDay', hours:[23,0]} },
  { id:'time_yin',       han:'寅時',   ko:'寅時 학습 (3-5시)',   cat:'時辰', sealHan:'寅', color:'#2C2E48', tier:'silver',
    desc:'寅時(03-05시) 학습',
    cond:{type:'timeOfDay', hours:[3,4]} },
  { id:'time_wu',        han:'午時',   ko:'午時 학습 (11-13시)', cat:'時辰', sealHan:'午', color:'#C9A227', tier:'bronze',
    desc:'午時(11-13시) 학습',
    cond:{type:'timeOfDay', hours:[11,12]} },
  { id:'eve_exam',       han:'前夜',   ko:'試驗前夜',            cat:'時辰', sealHan:'夜', color:'#9C3030', tier:'gold',
    desc:'시험 D-1 학습',
    cond:{type:'daysToExam', value:1} },
  { id:'exam_day',       han:'臨試',   ko:'D-Day 학습',          cat:'時辰', sealHan:'試', color:'#9C3030', tier:'jade',
    desc:'시험 당일 학습',
    cond:{type:'daysToExam', value:0} },

  // ═══ 同學 (커뮤니티) — 3 ═══════════════════════════════════════════════
  { id:'chat_first',     han:'發言',   ko:'첫 채팅',              cat:'同學', sealHan:'言', color:'#C04848', tier:'bronze',
    desc:'채팅 1회 게시',
    cond:{type:'counter_gte', name:'chatPosted', threshold:1} },
  { id:'cube_join',      han:'方剋',   ko:'큐브 對局',             cat:'同學', sealHan:'剋', color:'#C04848', tier:'silver',
    desc:'큐브 對局 1회 참여',
    cond:{type:'counter_gte', name:'cubeJoined', threshold:1} },
  { id:'presence_5',     han:'同學',   ko:'同學 5인 동석',         cat:'同學', sealHan:'同', color:'#C04848', tier:'silver',
    desc:'온라인 동시 학습자 5인 이상 목격',
    cond:{type:'counter_gte', name:'presencePeak', threshold:5} },

  // ═══ 特技 (시그니처·숨김 업적) — 6 ════════════════════════════════════
  { id:'sig_first',      han:'章典',   ko:'첫 章典 발동',          cat:'特技', sealHan:'章', color:'#5C8F3A', tier:'bronze',
    desc:'시그니처 章典 효과 첫 발동',
    cond:{type:'signatureFired', kind:'chapter', threshold:1} },
  { id:'sig_yipin_1',    han:'逸品',   ko:'첫 逸品 발동',          cat:'特技', sealHan:'逸', color:'#5C8F3A', tier:'silver',
    desc:'시그니처 逸品(逐方) 첫 발동',
    cond:{type:'signatureFired', kind:'formula', threshold:1} },
  { id:'sig_yipin_25',   han:'家門',   ko:'逸品 25회',             cat:'特技', sealHan:'家', color:'#5C8F3A', tier:'gold',
    desc:'시그니처 逸品 누적 25회',
    cond:{type:'signatureFired', kind:'formula', threshold:25} },
  { id:'sig_juexue',     han:'絕學',   ko:'絕學 발동',             cat:'特技', sealHan:'絕', color:'#C9A227', tier:'jade',
    desc:'絕學(5연속 逸品) 발동 1회',
    cond:{type:'signatureFired', kind:'juexue', threshold:1} },
  { id:'leeline',        han:'雜談',   ko:'이순재 어록',           cat:'特技', sealHan:'재', color:'#C9A227', tier:'bronze',
    desc:'이순재 어록 출현 (랜덤 10%)',
    cond:{type:'signatureFired', kind:'leeline', threshold:1} },
  { id:'collector',      han:'印章',   ko:'印章 收藏家',           cat:'特技', sealHan:'藏', color:'#876A36', tier:'gold',
    desc:'15개 이상 업적 해제',
    cond:{type:'achievementCount', threshold:15} },

];

// 카테고리별 컬러 (UI 헬퍼)
const ACHIEVEMENT_CAT_COLORS = {
  '학습': '#876A36',
  '문답': '#9C3030',
  '章典': '#C9A227',
  '氣博': '#2A7060',
  '流派': '#6E5396',
  '時辰': '#2C2E48',
  '同學': '#C04848',
  '特技': '#5C8F3A',
};

// tier 별 시각 효과 (UI 헬퍼)
const TIER_META = {
  bronze: { label:'銅', color:'#876A36', glow:'rgba(135,106,54,.45)' },
  silver: { label:'銀', color:'#7A8B92', glow:'rgba(122,139,146,.55)' },
  gold:   { label:'金', color:'#C9A227', glow:'rgba(201,162,39,.65)' },
  jade:   { label:'翠', color:'#2A7060', glow:'rgba(42,112,96,.65)' },
};

// 빠른 조회
const ACHIEVEMENT_BY_ID = {};
ACHIEVEMENTS.forEach(a => { ACHIEVEMENT_BY_ID[a.id] = a; });

if(typeof window !== 'undefined'){
  window.ACHIEVEMENTS = ACHIEVEMENTS;
  window.ACHIEVEMENT_BY_ID = ACHIEVEMENT_BY_ID;
  window.ACHIEVEMENT_CAT_COLORS = ACHIEVEMENT_CAT_COLORS;
  window.TIER_META = TIER_META;
}
