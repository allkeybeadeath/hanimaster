'use strict';

const STATE_KEY = 'bangje.state.v1';
let S = {
  bookmarks: [], wrongIds: [], lastFcIdx: 0,
  fcMode: 'action', quizScope: 'all', lastTab: 'home', knownIds: []
};
try {
  const saved = localStorage.getItem(STATE_KEY);
  if (saved) Object.assign(S, JSON.parse(saved));
} catch (e) {}
function saveState() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(S)); } catch (e) {}
}
function $(sel, root) { return (root || document).querySelector(sel); }
function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === 'className') e.className = attrs[k];
      else if (k === 'onClick') e.addEventListener('click', attrs[k]);
      else if (k === 'innerHTML') e.innerHTML = attrs[k];
      else if (k === 'dataset') Object.assign(e.dataset, attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
  }
  if (children) {
    if (typeof children === 'string') e.textContent = children;
    else if (Array.isArray(children)) children.forEach(c => {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    else if (children instanceof Node) e.appendChild(children);
    else e.textContent = String(children);
  }
  return e;
}
function toast(msg, type) {
  const t = el('div', { className: 'toast' + (type ? ' ' + type : '') }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
function escapeHtml(s) {
  return String(s || '').replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function updateCountdown() {
  const examDate = new Date('2026-05-20T09:00:00+09:00');
  const now = new Date();
  const diffMs = examDate - now;
  const cd = $('#countdown');
  if (!cd) return;
  if (diffMs <= 0) { cd.textContent = '시험 진행중'; cd.classList.add('urgent'); return; }
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  if (days > 1) {
    cd.textContent = 'D-' + days + '일 ' + hours + 'h';
    cd.classList.toggle('urgent', days <= 1);
  } else if (days === 1) {
    cd.textContent = 'D-1 · ' + hours + 'h'; cd.classList.add('urgent');
  } else {
    cd.textContent = 'D-day · ' + hours + 'h'; cd.classList.add('urgent');
  }
}
function setTab(tab) {
  S.lastTab = tab; saveState();
  document.querySelectorAll('nav.tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  window.scrollTo(0, 0);
  const view = $('#view'); view.innerHTML = '';
  const renderers = {
    home: renderHome, formulas: renderFormulas, flashcard: renderFlashcard,
    quiz: renderQuiz, past: renderPast, compare: renderCompare,
    herbs: renderHerbs, srs: renderSRS
  };
  (renderers[tab] || renderHome)(view);
}
function renderHome(root) {
  const examDate = new Date('2026-05-20T00:00:00+09:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const daysLeft = Math.max(0, Math.ceil((examDate - now) / 86400000));
  let activeIdx;
  if (daysLeft >= 3) activeIdx = 0;
  else if (daysLeft === 2) activeIdx = 1;
  else if (daysLeft === 1) activeIdx = 2;
  else activeIdx = 3;
  root.appendChild(el('div', { className: 'card accent' }, [
    el('h2', null, EXAM_META.course),
    el('div', { className: 'meta' }, '시험일: ' + EXAM_META.date + ' 화요일 · ' + EXAM_META.school),
    el('p', null, '범위: ' + EXAM_META.scope),
    el('p', { className: 'text-small' },
      '총 ' + FORMULAS.length + ' 처방 · ' + HERBS.length + ' 약재 · 작년 기출 ' + PAST_EXAMS.length + '문 (범위 일치만)')
  ]));
  if (activeIdx >= 0 && activeIdx < STUDY_PLAN.length) {
    const today = STUDY_PLAN[activeIdx];
    const card = el('div', { className: 'card success' });
    card.appendChild(el('div', { className: 'meta' }, '⚡ 오늘의 작업'));
    card.appendChild(el('h2', null, today.day + ' · ' + today.label));
    const ul = el('ul', null);
    today.goals.forEach(g => ul.appendChild(el('li', null, g)));
    card.appendChild(ul);
    const row = el('div', { className: 'row' });
    today.tasks.forEach(t => {
      const btn = el('button', {
        className: 'btn primary',
        onClick: () => {
          if (t.mode === 'flashcard') setTab('flashcard');
          else if (t.mode === 'quiz') { S.quizScope = 'all'; setTab('quiz'); }
          else if (t.mode === 'past') { S.quizScope = 'past'; setTab('quiz'); }
          else if (t.mode === 'srs') setTab('srs');
          else if (t.mode === 'compare') setTab('compare');
          else if (t.mode === 'cat') setTab('formulas');
          else if (t.mode === 'pitfalls') renderPitfalls();
          else setTab('formulas');
        }
      }, '▶ ' + t.title);
      row.appendChild(btn);
    });
    card.appendChild(row);
    root.appendChild(card);
  }
  const planCard = el('div', { className: 'card' });
  planCard.appendChild(el('h2', null, '📅 4일 단계별 학습 계획'));
  STUDY_PLAN.forEach((p, idx) => {
    const dayDiv = el('div', {
      className: 'plan-day' + (idx === activeIdx ? ' today' : '') + (idx < activeIdx ? ' past' : '')
    });
    dayDiv.appendChild(el('div', { className: 'day-tag' }, p.day));
    dayDiv.appendChild(el('div', { className: 'label' }, p.label));
    const ul = el('ul', null);
    p.goals.forEach(g => ul.appendChild(el('li', null, g)));
    dayDiv.appendChild(ul);
    planCard.appendChild(dayDiv);
  });
  root.appendChild(planCard);
  root.appendChild(el('div', { className: 'card' }, [
    el('h3', null, '빠른 진입'),
    el('div', { className: 'row' }, [
      el('button', { className: 'btn', onClick: () => setTab('formulas') }, '📖 처방 24개'),
      el('button', { className: 'btn', onClick: () => setTab('flashcard') }, '🎴 암기카드'),
      el('button', { className: 'btn', onClick: () => { S.quizScope = 'all'; setTab('quiz'); } }, '✏️ 객관식'),
      el('button', { className: 'btn', onClick: () => setTab('past') }, '📋 기출'),
      el('button', { className: 'btn', onClick: () => setTab('compare') }, '⚖️ 비교'),
      el('button', { className: 'btn', onClick: () => setTab('srs') }, '🔁 오답함 (' + S.wrongIds.length + ')'),
      el('button', { className: 'btn primary', onClick: () => renderPitfalls() }, '⚠️ 함정 카드')
    ])
  ]));
  const pit = el('div', { className: 'card urgent' });
  pit.appendChild(el('h3', null, '⚠️ 빈출 함정 (D-day 필독)'));
  const pitUl = el('ul', null);
  ['자감초탕에 麻黃 없음 — 桂枝(○) / 麻黃(×)',
   '대시호탕 = 少陽·陽明 합병 (太陽 아님)',
   '오적산 五積 = 氣·血·濕(食)·痰·寒 (風 아님)',
   '당귀보혈탕 황기:당귀 = 5:1, 작용 = 補氣生血',
   '보중익기탕 + 길경(桔梗) = 기하함·내장하수 보강',
   '당귀사역탕의 通草 = 오늘날 木通(목통)'].forEach(t => pitUl.appendChild(el('li', null, t)));
  pit.appendChild(pitUl);
  pit.appendChild(el('button', { className: 'btn small', onClick: () => renderPitfalls() }, '함정 카드 전체 →'));
  root.appendChild(pit);
}
function renderPitfalls() {
  const root = $('#view'); root.innerHTML = '';
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
  root.appendChild(el('button', { className: 'btn small', style: 'margin-bottom:10px', onClick: () => setTab('home') }, '← 홈으로'));
  root.appendChild(el('div', { className: 'card urgent' }, [
    el('h2', null, '⚠️ 시험 직전 함정 모음'),
    el('p', null, '시험 직전 30분 — 이것만 반복'),
  ]));
  const pitfalls = [
    ['자감초탕(炙甘草湯=復脈湯)','마황 들어가는지 묻는 문제','마황은 들지 않음. 桂枝(○) / 麻黃(×)','18·19·20·21'],
    ['대시호탕','太陽·陽明 합병이라 표기된 선지','少陽·陽明 합병이 정답','15 객·22-1학기'],
    ['도홍사물탕','적응증으로 白帶증다 포함','白帶증다는 적응증 아님','22-1차'],
    ['오적산','五積에 風積 포함된 선지','五積 = 氣·血·濕(食)·痰·寒. 風積 아님','14~21'],
    ['오적산','기적 치료에 궁귀탕·작약감초탕','틀린 답 — 기적과 짝짓기 X','16'],
    ['당귀보혈탕','당귀가 많아 보일 비율','황기 5 : 당귀 1. 작용 = 補氣生血','18~21'],
    ['당귀사역탕','구성을 通草로 적기','시험엔 "목통(木通)"으로','15~19'],
    ['보중익기탕','기하함·내장하수 시 어느 약 추가','桔梗(길경) — 載藥上行','20·21'],
    ['보중익기탕','이제마 소음인 보중익기탕 차이','升麻·柴胡 빼고 藿香·蘇葉 추가, 황기 重用','18·20·21'],
    ['귀비탕','적응증으로 설광소진·인건구조','陰虛 양상이라 귀비탕 아님','22-1차'],
    ['팔진탕','적응증으로 脈細而數(맥세이삭)','팔진탕 맥은 細弱. 數은 熱','22-1차'],
    ['사군자탕','구성에 황기 포함된 선지','사군자 = 인삼·백출·복령·감초. 황기는 보중익기탕 君','18·19·21'],
    ['향사육군자탕','작용 묻는 문제','益氣化痰·行氣溫中','19·20·21'],
    ['사물탕','유래 처방','膠艾湯 (거기서 阿膠·艾葉·甘草 제거)','18·19·22-1차'],
    ['대시호탕','소시호·소승기와 약량 차이','대시호: 지실 4매·대황 2량·생강 5량 / 소승기: 지실 3매·대황 4량 / 소시호: 생강 3량','19'],
    ['방풍통성산','기본방 아닌 것','곽향정기산 아님','22-1학기'],
    ['석고탕','구성·배오 패턴','석고·삼황·치자 + 마황·향시 = 表裏分消','15·16·21'],
    ['삼령백출산','적응증 아닌 것','심계불면 X (그것은 귀비탕/자감초탕)','19·20·21'],
    ['계지인삼탕','구성에 계지인지 계피인지','시험엔 계지(桂枝)로','22-1학기 강의']
  ];
  const card = el('div', { className: 'card' });
  const tbl = el('table', { className: 'compare-table' });
  tbl.appendChild(el('thead', null, el('tr', null, [
    el('th', null, '처방'), el('th', null, '함정'),
    el('th', null, '정답'), el('th', null, '출처')
  ])));
  const tb = el('tbody');
  pitfalls.forEach(p => {
    const tr = el('tr', null, [
      el('td', null, p[0]),
      el('td', null, p[1]),
      el('td', { innerHTML: '<b style="color:#3d5826">' + escapeHtml(p[2]) + '</b>' }),
      el('td', { className: 'text-small' }, p[3])
    ]);
    tb.appendChild(tr);
  });
  tbl.appendChild(tb);
  card.appendChild(tbl);
  root.appendChild(card);
}
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('nav.tabs button').forEach(b => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  });
  updateCountdown();
  setInterval(updateCountdown, 60000);
  setTab(S.lastTab || 'home');
});

// ===================================================================
// ============ FORMULAS LIST & DETAIL ===============================
// ===================================================================
function renderFormulas(root) {
  const chapters = [...new Set(FORMULAS.map(f => f.chapter))];
  const filterState = { chapter: 'all', search: '' };
  const filterCard = el('div', { className: 'card muted' });
  const searchEl = el('input', {
    className: 'search-input',
    placeholder: '🔍 처방·약재·작용 검색 (예: 사군자, 황기, 補氣)',
    type: 'text'
  });
  filterCard.appendChild(searchEl);
  const chipRow = el('div', { className: 'chips' });
  chipRow.appendChild(el('div', {
    className: 'chip active',
    onClick: () => { filterState.chapter = 'all'; doFilter(); }
  }, '전체 (' + FORMULAS.length + ')'));
  chapters.forEach(c => {
    const count = FORMULAS.filter(f => f.chapter === c).length;
    chipRow.appendChild(el('div', {
      className: 'chip',
      onClick: () => { filterState.chapter = c; doFilter(); }
    }, c + ' (' + count + ')'));
  });
  filterCard.appendChild(chipRow);
  root.appendChild(filterCard);
  const listCard = el('div', { className: 'formula-list' });
  root.appendChild(listCard);

  function doFilter() {
    filterCard.querySelectorAll('.chip').forEach(c => {
      const isAll = (filterState.chapter === 'all' && c.textContent.startsWith('전체'));
      const isMatch = c.textContent.startsWith(filterState.chapter);
      c.classList.toggle('active', isAll || isMatch);
    });
    const term = filterState.search.toLowerCase();
    const filtered = FORMULAS.filter(f => {
      if (filterState.chapter !== 'all' && f.chapter !== filterState.chapter) return false;
      if (!term) return true;
      const hay = [
        f.ko, f.han, f.alias || '', f.action,
        Array.isArray(f.indication) ? f.indication.join(' ') : f.indication,
        (f.composition || []).join(' '),
        (f.keyPoints || []).join(' ')
      ].join(' ').toLowerCase();
      return hay.includes(term);
    });
    listCard.innerHTML = '';
    if (filtered.length === 0) {
      listCard.appendChild(el('div', { className: 'card muted' }, '검색 결과 없음'));
      return;
    }
    const groups = {};
    filtered.forEach(f => {
      const key = f.chapter + ' · ' + f.section;
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    Object.keys(groups).forEach(g => {
      listCard.appendChild(el('h3', {
        className: 'text-small',
        style: 'margin:14px 0 6px;color:#7d4e2d;font-weight:700;font-size:13px'
      }, g));
      groups[g].forEach(f => {
        const item = el('div', { className: 'formula-item', onClick: () => showFormulaDetail(f.id) });
        const head = el('div');
        head.appendChild(el('span', { className: 'ko' }, f.ko));
        head.appendChild(el('span', { className: 'han hanja' }, f.han));
        if (f.alias) head.appendChild(el('span', { className: 'text-small', style: 'margin-left:6px' }, '· ' + f.alias));
        item.appendChild(head);
        item.appendChild(el('div', { className: 'action-mini' }, '▸ ' + f.action));
        const ind = Array.isArray(f.indication) ? f.indication.join(' / ') : f.indication;
        item.appendChild(el('div', { className: 'sub' },
          ind.slice(0, 100) + (ind.length > 100 ? '…' : '')));
        listCard.appendChild(item);
      });
    });
  }
  searchEl.addEventListener('input', e => { filterState.search = e.target.value; doFilter(); });
  doFilter();
}

function showFormulaDetail(id) {
  const f = FORMULAS.find(x => x.id === id);
  if (!f) return;
  const root = $('#view'); root.innerHTML = '';
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
  const tabBtn = document.querySelector('nav.tabs button[data-tab="formulas"]');
  if (tabBtn) tabBtn.classList.add('active');
  root.appendChild(el('button', {
    className: 'btn small', style: 'margin-bottom:10px',
    onClick: () => setTab('formulas')
  }, '← 처방 목록'));
  const card = el('div', { className: 'card formula-detail accent' });
  const titleRow = el('div', {
    style: 'display:flex;align-items:baseline;gap:10px;margin-bottom:6px;flex-wrap:wrap'
  });
  titleRow.appendChild(el('span', { style: 'font-size:24px;font-weight:800;color:#1a1411' }, f.ko));
  titleRow.appendChild(el('span', { className: 'han hanja', style: 'font-size:22px;color:#7d4e2d' }, f.han));
  if (f.alias) titleRow.appendChild(el('span', { className: 'text-small' }, '· ' + f.alias));
  card.appendChild(titleRow);
  card.appendChild(el('div', { className: 'meta' }, f.chapter + ' · ' + f.section));
  const actSec = el('div', { className: 'section' });
  actSec.appendChild(el('h3', null, '작용 (治法)'));
  actSec.appendChild(el('div', { style: 'font-size:18px;color:#3d5826;font-weight:700' }, f.action));
  card.appendChild(actSec);
  const indSec = el('div', { className: 'section' });
  indSec.appendChild(el('h3', null, '적응증 (主治)'));
  const ind = Array.isArray(f.indication) ? f.indication.join(' / ') : f.indication;
  indSec.appendChild(el('div', null, ind));
  card.appendChild(indSec);
  const compSec = el('div', { className: 'section' });
  compSec.appendChild(el('h3', null, '구성약물 (' + f.composition.length + '味)'));
  const compList = el('div', { className: 'composition-list' });
  f.composition.forEach(c => {
    compList.appendChild(el('span', {
      className: 'herb-token',
      onClick: () => {
        const m = c.match(/([가-힣]+)/);
        if (!m) { toast(c); return; }
        const ko = m[1];
        const h = HERBS.find(x => x.ko === ko || x.ko.includes(ko) || ko.includes(x.ko));
        if (h) toast(h.ko + ' (' + h.han + '): ' + h.meaning);
        else toast(c);
      }
    }, c));
  });
  compSec.appendChild(compList);
  card.appendChild(compSec);
  if (f.monarch_minister) {
    const mmSec = el('div', { className: 'section' });
    mmSec.appendChild(el('h3', null, '君臣佐使 (군신좌사)'));
    const grid = el('div', { className: 'mm-grid' });
    for (const role in f.monarch_minister) {
      grid.appendChild(el('div', { className: 'role' }, role));
      grid.appendChild(el('div', null, f.monarch_minister[role]));
    }
    mmSec.appendChild(grid);
    card.appendChild(mmSec);
  }
  if (f.baseFormula) {
    const bfSec = el('div', { className: 'section' });
    bfSec.appendChild(el('h3', null, '기본방 분석'));
    bfSec.appendChild(el('div', null, f.baseFormula));
    card.appendChild(bfSec);
  }
  if (f.keyPoints && f.keyPoints.length) {
    const kpSec = el('div', { className: 'section' });
    kpSec.appendChild(el('h3', null, '핵심 포인트 (시험 빈출)'));
    const ul = el('ul', null);
    f.keyPoints.forEach(p => ul.appendChild(el('li', null, p)));
    kpSec.appendChild(ul);
    card.appendChild(kpSec);
  }
  if (f.addRules && f.addRules.length) {
    const arSec = el('div', { className: 'section add-rules' });
    arSec.appendChild(el('h3', null, '가감법 (加減法)'));
    const tbl = el('table'); const tb = el('tbody');
    f.addRules.forEach(r => {
      tb.appendChild(el('tr', null, [el('td', null, r[0]), el('td', null, r[1])]));
    });
    tbl.appendChild(tb); arSec.appendChild(tbl);
    card.appendChild(arSec);
  }
  if (f.derived) {
    const dSec = el('div', { className: 'section' });
    dSec.appendChild(el('h3', null, '파생·가감 처방'));
    for (const name in f.derived) {
      const d = el('details');
      d.appendChild(el('summary', null, name));
      d.appendChild(el('div', { style: 'padding:4px 0 8px 14px;font-size:14px' }, f.derived[name]));
      dSec.appendChild(d);
    }
    card.appendChild(dSec);
  }
  if (f.past && f.past.length) {
    const pSec = el('div', { className: 'section' });
    pSec.appendChild(el('h3', null, '⚡ 기출 포인트'));
    const ul = el('ul', null);
    f.past.forEach(p => ul.appendChild(el('li', null, p)));
    pSec.appendChild(ul);
    card.appendChild(pSec);
  }
  root.appendChild(card);
  const related = PAST_EXAMS.filter(e => {
    if (!e.formula) return false;
    return e.formula.includes(f.ko) || (f.han && e.formula.includes(f.han));
  });
  if (related.length) {
    const relCard = el('div', { className: 'card' });
    relCard.appendChild(el('h3', null, '🎯 이 처방의 작년 기출 ' + related.length + '문제'));
    related.forEach(q => {
      const d = el('details');
      d.appendChild(el('summary', null, '[' + q.src + '] ' + q.q.slice(0, 50) + (q.q.length > 50 ? '…' : '')));
      const body = el('div', { style: 'padding:6px 0 10px 14px;font-size:14px' });
      body.appendChild(el('p', null, q.q));
      q.options.forEach((o, j) => {
        body.appendChild(el('div', {
          style: 'margin:2px 0' + (j === q.answer ? ';color:#3d5826;font-weight:600' : '')
        }, o + (j === q.answer ? ' ✓' : '')));
      });
      body.appendChild(el('div', { className: 'explanation', style: 'margin-top:6px' }, q.explanation));
      d.appendChild(body);
      relCard.appendChild(d);
    });
    root.appendChild(relCard);
  }
  root.appendChild(el('div', { className: 'card muted' }, [
    el('h3', null, '학습 액션'),
    el('div', { className: 'row' }, [
      el('button', {
        className: 'btn',
        onClick: () => {
          if (!S.knownIds.includes(f.id)) S.knownIds.push(f.id);
          saveState();
          toast('✓ 안다 — 진행 ' + S.knownIds.length + '/' + FORMULAS.length, 'success');
        }
      }, '✓ 안다'),
      el('button', {
        className: 'btn',
        onClick: () => {
          if (!S.wrongIds.includes('fc:' + f.id)) S.wrongIds.push('fc:' + f.id);
          saveState();
          toast('✗ 오답함에 추가됨', 'error');
        }
      }, '✗ 오답함 추가'),
      el('button', { className: 'btn', onClick: () => setTab('flashcard') }, '🎴 암기카드'),
      el('button', { className: 'btn', onClick: () => setTab('compare') }, '⚖️ 비교표'),
    ])
  ]));
}

// ===================================================================
// ============ COMPARE ==============================================
// ===================================================================
function renderCompare(root) {
  const pairs = [
    { title: '사군자탕 ↔ 향사육군자탕', rows: [
      ['구성', '인삼·백출·복령·감초 (4味)', '사군자 + 진피·반하 + 목향·사인 (8味)'],
      ['작용', '익기건비', '익기화담·행기온중'],
      ['적응증', '단순 비위기허', '비위기허 + 痰濕 + 氣滯腹脹']
    ]},
    { title: '보중익기탕 ↔ 귀비탕 (보기보혈제 비교)', rows: [
      ['공통', '익기보혈 (보기 + 보혈)', ''],
      ['보중익기탕', '升麻·柴胡 → 승양거함 두드러짐', '진피로 막힘 풂'],
      ['귀비탕', '遠志·龍眼肉·酸棗仁 → 안신 두드러짐', '목향으로 막힘 풂'],
      ['핵심 차이', '中氣下陷 (탈항·자궁탈수)', '心脾兩虛 (심계·건망·실면)']
    ]},
    { title: '백호탕증 ↔ 당귀보혈탕증 (虛實 감별)', rows: [
      ['병기', '邪熱熾盛 (實熱)', '血虛生熱 (虛熱)'],
      ['脈', '洪大有力', '洪大無力(중취 약함)'],
      ['口渴', '심함, 冷飮 좋아함', '渴喜熱飮'],
      ['치법', '청열사화', '보기생혈']
    ]},
    { title: '자감초탕 ↔ 생맥산', rows: [
      ['병기', '陰血陽氣 兩虛, 心脈失養', '氣陰兩虛'],
      ['주증', '脈結代·心動悸·虛羸少氣', '乾咳·短氣·汗多·咽乾'],
      ['공통', '맥문동·인삼 사용', ''],
      ['차이', '阿膠·桂枝·생지황·자감초·마인 추가', '오미자로 斂陰']
    ]},
    { title: '대시호탕 ↔ 소시호탕 ↔ 소승기탕 (시호제 3종)', rows: [
      ['치료', '少陽+陽明合病', '少陽病', '陽明腑實 가벼움'],
      ['生薑', '5량 (해표 강화)', '3량', '-'],
      ['枳實', '4매', '-', '3매(큰 것)'],
      ['大黃', '2량 (절반)', '-', '4량'],
      ['人參·甘草', '×', '○', '×']
    ]},
    { title: '계지탕 가감 가족 (5처방 가족)', rows: [
      ['계지탕(원방)', '계지·작약·감초·생강·대조'],
      ['당귀사역탕', '계지탕 - 생강 + 당귀·세신·목통, 대조 12→25'],
      ['황기계지오물탕', '계지탕 - 감초 + 황기, 생강 重用'],
      ['소건중탕', '계지탕 + 작약 重用 + 飴糖 (溫中補虛)'],
      ['계지인삼탕', '계지 + 이중탕(백출·인삼·건강·감초)']
    ]},
    { title: '오적산 ↔ 방풍통성산 (3대 통치방)', rows: [
      ['本(근본)', '本寒 — 풍한·한습', '本熱 — 풍열·조열·습열'],
      ['味數', '17味', '18味'],
      ['특징', '氣·血·濕(食)·痰·寒 五積 치료', '풍열을 表裏 두루'],
      ['공통', '여러 기본방의 합방', '여러 기본방의 합방'],
      ['세번째', '본허(本虛) → 二陰煎', '']
    ]},
    { title: '팔진탕 ↔ 십전대보탕 ↔ 인삼양영탕 (기혈쌍보 3단계)', rows: [
      ['공통', '사군자(보기) + 사물(보혈) 합방', ''],
      ['팔진탕', '+ 생강·대조. 기혈양허 기초', ''],
      ['십전대보탕', '팔진 + 황기·육계 → 溫補. 虛寒 추가', ''],
      ['인삼양영탕', '십전 - 천궁 + 五味子·遠志·陳皮 → 養心安神', '신경정신 증상']
    ]},
    { title: '석고탕 ↔ 갈근황금황련탕 (해표청리 2종)', rows: [
      ['치법', '청열사화 + 발한해표', '해표청리'],
      ['표·이', '表證未解·裏熱已熾', '表證未解·邪熱入裡 (下利)'],
      ['味數', '7味', '4味'],
      ['주증', '壯熱無汗·神昏譫語', '身熱下利·胸脘煩熱']
    ]},
    { title: '사물탕 가감 가족', rows: [
      ['사물탕(원방)', '숙지황·작약·당귀·천궁 → 補血和血'],
      ['도홍사물탕', '사물탕 + 桃仁·紅花 → 活血祛瘀. 경행복통·혈괴'],
      ['교애탕', '사물탕 + 阿膠·艾葉·甘草 → 補血止血·安胎 (사물탕의 母方)'],
      ['이열탕', '사물탕 - 숙지황 + 甘草']
    ]}
  ];
  root.appendChild(el('div', { className: 'card accent' }, [
    el('h2', null, '⚖️ 처방 비교 (시험 빈출)'),
    el('p', { className: 'text-small' }, '서로 헷갈리는 처방·합방 관계 정리. 모든 표가 작년 기출에서 출제 패턴 빈출.')
  ]));
  pairs.forEach(p => {
    const card = el('div', { className: 'card' });
    card.appendChild(el('h3', null, p.title));
    const tbl = el('table', { className: 'compare-table' });
    const tb = el('tbody');
    p.rows.forEach(r => {
      tb.appendChild(el('tr', null, r.map(c => el('td', null, c || ''))));
    });
    tbl.appendChild(tb);
    card.appendChild(tbl);
    root.appendChild(card);
  });
}

// ===================================================================
// ============ FLASHCARD ============================================
// ===================================================================
function renderFlashcard(root) {
  root.appendChild(el('div', { className: 'card' }, [
    el('h2', null, '🎴 암기카드'),
    el('p', { className: 'text-small' },
      '카드 클릭 → 뒤집기. "안다" 카운트, "모른다"는 오답함에 추가됨.'),
    el('div', { className: 'chips' }, [
      el('div', { className: 'chip' + (S.fcMode === 'action' ? ' active' : ''),
        onClick: () => { S.fcMode = 'action'; saveState(); renderFlashcardInner(); } }, '작용(治法) 위주'),
      el('div', { className: 'chip' + (S.fcMode === 'composition' ? ' active' : ''),
        onClick: () => { S.fcMode = 'composition'; saveState(); renderFlashcardInner(); } }, '구성약물 위주'),
      el('div', { className: 'chip' + (S.fcMode === 'indication' ? ' active' : ''),
        onClick: () => { S.fcMode = 'indication'; saveState(); renderFlashcardInner(); } }, '적응증 위주')
    ])
  ]));
  const holder = el('div', { id: 'fc-holder' });
  root.appendChild(holder);

  function renderFlashcardInner() {
    holder.innerHTML = '';
    const total = FORMULAS.length;
    let idx = S.lastFcIdx || 0;
    if (idx >= total || idx < 0) idx = 0;
    const prog = el('div', { className: 'fc-progress' }, '');
    holder.appendChild(prog);
    const cont = el('div', { className: 'fc-container' });
    const card = el('div', { className: 'fc-card' });
    card.addEventListener('click', () => card.classList.toggle('flipped'));
    cont.appendChild(card);
    holder.appendChild(cont);

    function paint() {
      card.innerHTML = '';
      card.classList.remove('flipped');
      const f = FORMULAS[idx];
      const knownMark = S.knownIds.includes(f.id) ? ' ✓' : '';
      prog.textContent = (idx + 1) + ' / ' + total + knownMark + ' · ' + f.chapter + ' ' + f.section;
      const front = el('div', { className: 'fc-face fc-front' });
      front.appendChild(el('div', { className: 'ko' }, f.ko));
      front.appendChild(el('div', { className: 'han hanja' }, f.han));
      if (f.alias) front.appendChild(el('div', { className: 'text-small' }, '· ' + f.alias));
      let hint = '';
      if (S.fcMode === 'action') hint = '작용은?';
      else if (S.fcMode === 'composition') hint = '구성약물은? (' + f.composition.length + '味)';
      else hint = '적응증은?';
      front.appendChild(el('div', { className: 'hint' }, '↕ 클릭해서 뒤집기 — ' + hint));
      const back = el('div', { className: 'fc-face fc-back' });
      back.appendChild(el('h3', null, f.ko + ' ' + f.han));
      const ind = Array.isArray(f.indication) ? f.indication.join(' / ') : f.indication;
      if (S.fcMode === 'action') {
        back.appendChild(el('div', { className: 'action' }, '▸ ' + f.action));
        back.appendChild(el('div', { className: 'indication' }, '主治: ' + ind));
      } else if (S.fcMode === 'composition') {
        back.appendChild(el('div', { className: 'action' }, '▸ ' + f.action));
        back.appendChild(el('div', { className: 'composition' }, '구성: ' + f.composition.join(' · ')));
        if (f.baseFormula) back.appendChild(el('div', {
          className: 'text-small',
          style: 'margin-top:8px;text-align:left;width:100%'
        }, '기본방: ' + f.baseFormula));
      } else {
        back.appendChild(el('div', { className: 'indication', style: 'font-size:13px' }, ind));
        back.appendChild(el('div', { className: 'action' }, '▸ ' + f.action));
      }
      card.appendChild(front);
      card.appendChild(back);
      S.lastFcIdx = idx; saveState();
    }
    paint();
    const ctrl = el('div', { className: 'fc-controls' });
    ctrl.appendChild(el('button', { className: 'btn small',
      onClick: () => { idx = (idx - 1 + total) % total; paint(); } }, '←'));
    ctrl.appendChild(el('button', { className: 'btn small green',
      onClick: () => {
        const f = FORMULAS[idx];
        if (!S.knownIds.includes(f.id)) S.knownIds.push(f.id);
        saveState();
        toast('✓ 안다 (' + S.knownIds.length + '/' + total + ')', 'success');
        idx = (idx + 1) % total; paint();
      } }, '✓ 안다'));
    ctrl.appendChild(el('button', { className: 'btn small',
      onClick: () => {
        const f = FORMULAS[idx];
        if (!S.wrongIds.includes('fc:' + f.id)) S.wrongIds.push('fc:' + f.id);
        S.knownIds = S.knownIds.filter(x => x !== f.id);
        saveState();
        const cnt = S.wrongIds.filter(x => x.startsWith('fc:')).length;
        toast('✗ 오답함 추가 (' + cnt + ')', 'error');
        idx = (idx + 1) % total; paint();
      } }, '✗ 모른다'));
    ctrl.appendChild(el('button', { className: 'btn small',
      onClick: () => { idx = (idx + 1) % total; paint(); } }, '→'));
    holder.appendChild(ctrl);
    const tools = el('div', { className: 'row', style: 'margin-top:10px' });
    tools.appendChild(el('button', { className: 'btn small',
      onClick: () => { idx = Math.floor(Math.random() * total); paint(); } }, '🎲 랜덤'));
    tools.appendChild(el('button', { className: 'btn small',
      onClick: () => showFormulaDetail(FORMULAS[idx].id) }, '📖 상세 보기'));
    tools.appendChild(el('button', { className: 'btn small',
      onClick: () => {
        S.lastFcIdx = 0; S.knownIds = []; saveState();
        toast('진척 초기화', 'success'); paint();
      } }, '🔄 진척 초기화'));
    holder.appendChild(tools);
    const known = S.knownIds.length;
    holder.appendChild(el('div', { className: 'card muted', style: 'margin-top:12px' }, [
      el('h3', null, '암기 진척 — ' + known + ' / ' + total),
      el('div', { className: 'quiz-progress' }, [
        el('div', { className: 'bar' },
          el('div', { style: 'width:' + (known / total * 100) + '%' }))
      ])
    ]));
  }
  renderFlashcardInner();
}

// ===================================================================
// ============ QUIZ =================================================
// ===================================================================
function buildQuestionPool(scope) {
  let pool = [];
  if (scope === 'past') {
    pool = PAST_EXAMS.map((e, i) => ({
      qid: 'past:' + i, q: '[' + e.src + '] ' + e.q,
      options: e.options, answer: e.answer, explanation: e.explanation,
      source: e.src + (e.formula ? ' · ' + e.formula : '')
    }));
  } else if (scope === 'wrong') {
    pool = S.wrongIds.filter(id => id.startsWith('past:')).map(id => {
      const i = parseInt(id.split(':')[1]);
      const e = PAST_EXAMS[i];
      if (!e) return null;
      return { qid: id, q: '[' + e.src + '] ' + e.q,
        options: e.options, answer: e.answer, explanation: e.explanation,
        source: e.src + ' · ' + (e.formula || '') };
    }).filter(Boolean);
  } else {
    pool = PAST_EXAMS.map((e, i) => ({
      qid: 'past:' + i, q: '[' + e.src + '] ' + e.q,
      options: e.options, answer: e.answer, explanation: e.explanation,
      source: e.src + ' · ' + (e.formula || '')
    }));
    FORMULAS.forEach(f => {
      const others = FORMULAS.filter(x => x.id !== f.id && x.action !== f.action);
      const distractors = shuffle(others).slice(0, 4).map(x => x.action);
      const options = shuffle([f.action, ...distractors]);
      pool.push({
        qid: 'auto-act:' + f.id,
        q: '"' + f.ko + ' (' + f.han + ')"의 작용으로 옳은 것은?',
        options, answer: options.indexOf(f.action),
        explanation: f.ko + '의 작용: ' + f.action + '. 적응증: ' +
          (Array.isArray(f.indication) ? f.indication.join(' / ') : f.indication).slice(0, 120),
        source: 'auto'
      });
    });
    FORMULAS.forEach(f => {
      const ind = Array.isArray(f.indication) ? f.indication.join(' / ') : f.indication;
      const indShort = ind.split('—')[0].split('(')[0].trim().slice(0, 50);
      if (indShort.length < 5) return;
      const others = shuffle(FORMULAS.filter(x => x.id !== f.id)).slice(0, 4)
        .map(x => x.ko + ' ' + x.han);
      const correct = f.ko + ' ' + f.han;
      const opts = shuffle([correct, ...others]);
      pool.push({
        qid: 'auto-ind:' + f.id,
        q: '"' + indShort + '" 증에 가장 적합한 처방은?',
        options: opts, answer: opts.indexOf(correct),
        explanation: f.ko + '의 적응증: ' + ind.slice(0, 150),
        source: 'auto'
      });
    });
    FORMULAS.forEach(f => {
      if (f.composition.length < 3) return;
      const allHerbs = HERBS.map(h => h.ko);
      const inF = f.composition.map(c => {
        const m = c.match(/([가-힣]+)/); return m ? m[1] : c;
      });
      const notIn = allHerbs.filter(h => !inF.some(x => x.includes(h) || h.includes(x)));
      if (notIn.length < 1) return;
      const wrongHerb = notIn[Math.floor(Math.random() * notIn.length)];
      const correct = inF.slice(0, 4);
      const opts = shuffle([...correct.slice(0, 4), wrongHerb]);
      pool.push({
        qid: 'auto-comp:' + f.id,
        q: '"' + f.ko + '"의 구성약물이 아닌 것은?',
        options: opts, answer: opts.indexOf(wrongHerb),
        explanation: f.ko + ' 구성: ' + f.composition.join(' · '),
        source: 'auto'
      });
    });
  }
  return pool;
}

function renderQuiz(root) {
  root.appendChild(el('div', { className: 'card' }, [
    el('h2', null, '✏️ 객관식 퀴즈'),
    el('p', { className: 'text-small' },
      '작년 기출 + 자동 생성 (작용·적응증·구성 매칭). 한 세션 최대 30문제.'),
    el('div', { className: 'chips' }, [
      el('div', { className: 'chip' + (S.quizScope === 'all' ? ' active' : ''),
        onClick: () => { S.quizScope = 'all'; saveState(); setTab('quiz'); } }, '전체 (자동 + 기출)'),
      el('div', { className: 'chip' + (S.quizScope === 'past' ? ' active' : ''),
        onClick: () => { S.quizScope = 'past'; saveState(); setTab('quiz'); } }, '작년 기출만 (' + PAST_EXAMS.length + ')'),
      el('div', { className: 'chip' + (S.quizScope === 'wrong' ? ' active' : ''),
        onClick: () => { S.quizScope = 'wrong'; saveState(); setTab('quiz'); } }, '오답함만 (' + S.wrongIds.filter(x => x.startsWith('past:')).length + ')')
    ])
  ]));
  const pool = buildQuestionPool(S.quizScope);
  if (pool.length === 0) {
    root.appendChild(el('div', { className: 'card muted' }, '문제가 없습니다. 다른 범위를 선택하세요.'));
    return;
  }
  const questions = shuffle(pool).slice(0, Math.min(30, pool.length));
  let qIdx = 0; let correct = 0;
  const startTime = Date.now();
  const card = el('div', { className: 'card' });
  root.appendChild(card);

  function paintQuestion() {
    card.innerHTML = '';
    if (qIdx >= questions.length) { paintResult(); return; }
    const q = questions[qIdx];
    const prog = el('div', { className: 'quiz-progress' }, [
      el('span', null, (qIdx + 1) + ' / ' + questions.length),
      el('div', { className: 'bar' },
        el('div', { style: 'width:' + ((qIdx + 1) / questions.length * 100) + '%' })),
      el('span', { className: 'text-small' }, '정답 ' + correct + '/' + qIdx)
    ]);
    card.appendChild(prog);
    card.appendChild(el('div', { className: 'quiz-q' }, q.q));
    const opts = el('div', { className: 'quiz-options' });
    q.options.forEach((opt, i) => {
      const b = el('button', null, opt);
      b.addEventListener('click', () => {
        opts.querySelectorAll('button').forEach(x => { x.classList.add('disabled'); x.disabled = true; });
        const isCorrect = (i === q.answer);
        if (isCorrect) {
          b.classList.add('correct'); correct++;
          S.wrongIds = S.wrongIds.filter(x => x !== q.qid);
        } else {
          b.classList.add('wrong');
          opts.children[q.answer].classList.add('correct');
          if (!S.wrongIds.includes(q.qid)) S.wrongIds.push(q.qid);
        }
        saveState();
        const exp = el('div', { className: 'explanation' }, [
          el('b', null, isCorrect ? '✓ 정답' : '✗ 오답'),
          el('div', { style: 'margin-top:6px' }, q.explanation),
          el('div', { className: 'text-small', style: 'margin-top:4px' }, '출처: ' + q.source)
        ]);
        card.appendChild(exp);
        const nextBtn = el('button', {
          className: 'btn primary', style: 'margin-top:8px',
          onClick: () => { qIdx++; paintQuestion(); }
        }, qIdx + 1 < questions.length ? '다음 →' : '결과 보기 →');
        card.appendChild(nextBtn);
      });
      opts.appendChild(b);
    });
    card.appendChild(opts);
  }

  function paintResult() {
    card.innerHTML = '';
    const pct = Math.round(correct / questions.length * 100);
    const dt = Math.round((Date.now() - startTime) / 1000);
    card.appendChild(el('h2', null, '🎯 결과'));
    card.appendChild(el('div', {
      style: 'font-size:32px;font-weight:800;color:' +
        (pct >= 80 ? '#3d5826' : pct >= 60 ? '#b8893a' : '#9a2c2c') +
        ';margin:14px 0'
    }, correct + ' / ' + questions.length + ' (' + pct + '%)'));
    card.appendChild(el('p', null, '소요 시간: ' + dt + '초 · 평균 ' + (dt / questions.length).toFixed(1) + '초/문항'));
    if (pct >= 90) card.appendChild(el('p', { style: 'color:#3d5826;font-weight:600' }, '🏅 우수! 시험 준비 양호'));
    else if (pct >= 70) card.appendChild(el('p', { style: 'color:#b8893a;font-weight:600' }, '⚙️ 양호. 오답 한 번 더 확인'));
    else card.appendChild(el('p', { style: 'color:#9a2c2c;font-weight:600' }, '⚠️ 더 학습 필요. 오답함에서 복습'));
    card.appendChild(el('div', { className: 'row', style: 'margin-top:14px' }, [
      el('button', { className: 'btn primary', onClick: () => setTab('quiz') }, '다시 풀기'),
      el('button', { className: 'btn', onClick: () => setTab('srs') }, '오답함 보기'),
      el('button', { className: 'btn', onClick: () => setTab('home') }, '홈으로')
    ]));
  }
  paintQuestion();
}

// ===================================================================
// ============ PAST EXAMS ===========================================
// ===================================================================
function renderPast(root) {
  root.appendChild(el('div', { className: 'card accent' }, [
    el('h2', null, '📋 작년 기출 (22학번)'),
    el('p', { className: 'text-small' },
      '작년 보익제~고삽제 1차수시 + 1학기 기말 4장~7장 기출 중, 올해 시험 범위(8장·6장·7장)와 겹치는 ' +
      PAST_EXAMS.length + '문 수록.'),
    el('p', { className: 'text-small' },
      '범위에 들지 않는 처방(육미지황·우귀환·고삽제·청장부열제 등)은 의도적 제외.'),
    el('button', { className: 'btn primary',
      onClick: () => { S.quizScope = 'past'; setTab('quiz'); } }, '▶ 기출 셔플 시험')
  ]));
  const groups = {};
  PAST_EXAMS.forEach((e, i) => {
    const key = e.formula || '기타';
    if (!groups[key]) groups[key] = [];
    groups[key].push({ ...e, idx: i });
  });
  for (const fname in groups) {
    const card = el('div', { className: 'card' });
    card.appendChild(el('h3', null, fname + ' (' + groups[fname].length + '문)'));
    groups[fname].forEach(q => {
      const d = el('details');
      d.appendChild(el('summary', null,
        '[' + q.src + '] ' + q.q.slice(0, 60) + (q.q.length > 60 ? '…' : '')));
      const body = el('div', { style: 'padding:8px 0 12px 12px' });
      body.appendChild(el('p', { style: 'font-weight:600' }, q.q));
      q.options.forEach((o, k) => {
        body.appendChild(el('div', {
          style: 'margin:3px 0' + (k === q.answer ? ';color:#3d5826;font-weight:700' : '')
        }, o + (k === q.answer ? ' ✓' : '')));
      });
      body.appendChild(el('div', { className: 'explanation' }, q.explanation));
      d.appendChild(body);
      card.appendChild(d);
    });
    root.appendChild(card);
  }
}

// ===================================================================
// ============ HERBS ================================================
// ===================================================================
function renderHerbs(root) {
  root.appendChild(el('div', { className: 'card accent' }, [
    el('h2', null, '🌿 약재 ' + HERBS.length + '종'),
    el('p', { className: 'text-small' },
      '시험 범위 24 처방에 등장하는 약재 효능. 클릭 시 그 약재가 들어간 처방 표시.')
  ]));
  const filterCard = el('div', { className: 'card muted' });
  const input = el('input', { className: 'search-input',
    placeholder: '🔍 약재 검색 (한글·한자·효능)', type: 'text' });
  filterCard.appendChild(input);
  root.appendChild(filterCard);
  const listCard = el('div'); root.appendChild(listCard);

  function paintList() {
    listCard.innerHTML = '';
    const term = (input.value || '').toLowerCase();
    HERBS.filter(h => {
      if (!term) return true;
      return (h.ko + ' ' + h.han + ' ' + h.meaning).toLowerCase().includes(term);
    }).forEach(h => {
      const card = el('div', { className: 'card' });
      const usage = FORMULAS.filter(f => f.composition.some(c => {
        return c.includes(h.ko) || c.includes(h.han) ||
          (h.ko.split('(')[0] && c.includes(h.ko.split('(')[0]));
      }));
      card.appendChild(el('div', null, [
        el('span', { style: 'font-weight:700;font-size:16px' }, h.ko),
        el('span', { className: 'han hanja', style: 'margin-left:8px;color:#7d4e2d' }, h.han),
        el('span', { className: 'badge gold', style: 'margin-left:8px' }, usage.length + '처방')
      ]));
      card.appendChild(el('div', { style: 'font-size:14px;color:#3d5826;margin-top:4px' }, h.meaning));
      if (usage.length) {
        const list = el('div', { className: 'text-small', style: 'margin-top:6px' });
        list.appendChild(document.createTextNode('사용 처방: '));
        usage.forEach((u, i) => {
          if (i > 0) list.appendChild(document.createTextNode(' · '));
          const link = el('span', { style: 'cursor:pointer;text-decoration:underline;color:#7d4e2d' }, u.ko);
          link.addEventListener('click', () => showFormulaDetail(u.id));
          list.appendChild(link);
        });
        card.appendChild(list);
      }
      listCard.appendChild(card);
    });
  }
  input.addEventListener('input', paintList);
  paintList();
}

// ===================================================================
// ============ SRS / WRONG ==========================================
// ===================================================================
function renderSRS(root) {
  const fcWrong = S.wrongIds.filter(x => x.startsWith('fc:'));
  const pastWrong = S.wrongIds.filter(x => x.startsWith('past:'));
  const autoWrong = S.wrongIds.filter(x => x.startsWith('auto-'));
  root.appendChild(el('div', { className: 'card accent' }, [
    el('h2', null, '🔁 오답함'),
    el('p', { className: 'text-small' },
      '총 ' + S.wrongIds.length + '항목 (플래시카드 모름 ' + fcWrong.length +
      ' · 기출 오답 ' + pastWrong.length + ' · 자동 객관식 오답 ' + autoWrong.length + ')'),
    el('div', { className: 'row' }, [
      el('button', { className: 'btn primary',
        onClick: () => { S.quizScope = 'wrong'; setTab('quiz'); } },
        '▶ 오답 셔플 시험 (' + pastWrong.length + '문)'),
      el('button', { className: 'btn',
        onClick: () => {
          if (!confirm('오답함을 전부 비웁니다. 진행할까요?')) return;
          S.wrongIds = []; saveState();
          toast('오답함 비움', 'success'); setTab('srs');
        } }, '🗑️ 전체 비우기')
    ])
  ]));
  if (S.wrongIds.length === 0) {
    root.appendChild(el('div', { className: 'card muted' }, [
      el('p', null, '오답함이 비어 있습니다.'),
      el('p', { className: 'text-small' }, '암기카드에서 "모른다" / 객관식에서 오답 → 자동 누적됨.')
    ]));
    return;
  }
  if (fcWrong.length) {
    const card = el('div', { className: 'card' });
    card.appendChild(el('h3', null, '🎴 암기카드 "모름" 처방 ' + fcWrong.length + '개'));
    const list = el('div', { className: 'formula-list' });
    fcWrong.forEach(id => {
      const fid = id.replace('fc:', '');
      const f = FORMULAS.find(x => x.id === fid);
      if (!f) return;
      const item = el('div', { className: 'formula-item' });
      const head = el('div');
      head.appendChild(el('span', { className: 'ko' }, f.ko));
      head.appendChild(el('span', { className: 'han hanja' }, f.han));
      item.appendChild(head);
      item.appendChild(el('div', { className: 'action-mini' }, '▸ ' + f.action));
      const row = el('div', { className: 'row', style: 'margin-top:6px' });
      row.appendChild(el('button', { className: 'btn small',
        onClick: () => showFormulaDetail(f.id) }, '상세'));
      row.appendChild(el('button', { className: 'btn small green',
        onClick: () => {
          S.wrongIds = S.wrongIds.filter(x => x !== id);
          if (!S.knownIds.includes(fid)) S.knownIds.push(fid);
          saveState();
          toast('✓ 안다로 이동', 'success'); setTab('srs');
        } }, '✓ 안다 (오답함에서 제거)'));
      item.appendChild(row);
      list.appendChild(item);
    });
    card.appendChild(list);
    root.appendChild(card);
  }
  if (pastWrong.length) {
    const card = el('div', { className: 'card' });
    card.appendChild(el('h3', null, '📋 기출 오답 ' + pastWrong.length + '문'));
    pastWrong.forEach(id => {
      const i = parseInt(id.split(':')[1]);
      const e = PAST_EXAMS[i];
      if (!e) return;
      const d = el('details');
      d.appendChild(el('summary', null,
        '[' + e.src + '] ' + e.q.slice(0, 60) + (e.q.length > 60 ? '…' : '')));
      const body = el('div', { style: 'padding:8px 0 12px 12px' });
      body.appendChild(el('p', { style: 'font-weight:600' }, e.q));
      e.options.forEach((o, k) => {
        body.appendChild(el('div', {
          style: 'margin:3px 0' + (k === e.answer ? ';color:#3d5826;font-weight:700' : '')
        }, o + (k === e.answer ? ' ✓' : '')));
      });
      body.appendChild(el('div', { className: 'explanation' }, e.explanation));
      body.appendChild(el('button', { className: 'btn small green',
        onClick: () => {
          S.wrongIds = S.wrongIds.filter(x => x !== id);
          saveState();
          toast('✓ 해결', 'success'); setTab('srs');
        } }, '✓ 익혔음 (제거)'));
      d.appendChild(body);
      card.appendChild(d);
    });
    root.appendChild(card);
  }
  if (autoWrong.length) {
    root.appendChild(el('div', { className: 'card muted' }, [
      el('h3', null, '🤖 자동 생성 객관식 오답 ' + autoWrong.length + '문'),
      el('p', null,
        '자동 생성 문제는 매번 선지가 달라지므로 객관식 모드에서 다시 풀면서 정답 시 자동 제거됩니다.'),
      el('button', { className: 'btn primary',
        onClick: () => { S.quizScope = 'all'; setTab('quiz'); } }, '▶ 객관식 다시 풀기')
    ]));
  }
}
