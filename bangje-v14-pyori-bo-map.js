/* bangje-v14-pyori-bo-map.js — v14 「方鑑(방감)」 시각적 매핑 화면
 * ============================================================================
 *  - 7장 表裏雙解劑 + 8장 補益劑 主要 處方의 관계·구성·용량 시각 매핑
 *  - 진입 경로:
 *      1) 의서궁 — 헬게이트 배너 아래 「方鑑」 배너
 *      2) 방제학 home — 같은 배너
 *      3) URL/콘솔: window.V14PyoriBoMap.open()
 *  - 화면 구성:
 *      · TOC + 4개 섹션 (계보·용량·매트릭스·함정카드)
 *      · 처방-본초 매트릭스 (가로 본초 × 세로 처방, 君臣佐使 색상 코딩)
 *      · 派生 系譜 다이어그램 (LINEAGE)
 *      · 五積 분해 / 4비교 카드 / 22 함정 카드
 *  - 데이터 출처: window.FORMULAS (data-formulas.js) + window.V14_RELATIONS (data-v14-relations.js)
 *  - 디자인 시스템: 朱砂(zhusha) · 黃금(huang) · 米색(mi) — 의서궁 기본 변수 그대로 사용
 *
 *  외부 API: window.V14PyoriBoMap = { open, render }
 *  라우트 등록: ROUTES.fangjian = open
 * ============================================================================ */
(function(){
'use strict';

function $(s,r){ return (r||document).querySelector(s); }
function $$(s,r){ return Array.from((r||document).querySelectorAll(s)); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m,k){ try{ window.toast && window.toast(m,k); }catch(_){} }

// ───────────────────────────────────────────────────────────────────────
// 1) 데이터 결합 — FORMULAS + V14_RELATIONS
// ───────────────────────────────────────────────────────────────────────
function getFormulaById(id){
  const F = window.FORMULAS || [];
  return F.find(f => f.id === id);
}
function getComposition(id){
  const f = getFormulaById(id);
  if(f && f.composition) return f.composition.map(h => String(h).replace(/\(炙\)|\(酒洗\)|\(灸\)|\(炮\)/g,''));
  const fb = window.V14_RELATIONS && window.V14_RELATIONS.FALLBACK_COMPOSITION;
  if(fb && fb[id]) return fb[id];
  return [];
}
function getRoleOf(rxId, herb){
  // 君臣佐使에서 herb가 어떤 역할인지 찾기
  const f = getFormulaById(rxId);
  if(!f || !f.monarch_minister) return '';
  const mm = f.monarch_minister;
  for(const k of ['君','臣','佐','使']){
    if(mm[k] && mm[k].some(h => String(h).replace(/\(.*?\)/g,'') === herb)) return k;
  }
  return '';
}

// ───────────────────────────────────────────────────────────────────────
// 2) 스타일 주입 — 의서궁 디자인 변수 (--zhusha/--huang/--mi) 재사용
// ───────────────────────────────────────────────────────────────────────
function injectStyles(){
  if(document.getElementById('v14-style')) return;
  const s = document.createElement('style');
  s.id = 'v14-style';
  s.textContent = `
    /* ─── v14 方鑑 화면 ─────────────────────────────────────────────── */
    .v14-wrap{
      max-width:680px;margin:0 auto;padding:14px 14px 80px;
      font-family:var(--font-body,'Noto Serif KR',serif);color:var(--mo,#1C140A);
    }
    .v14-hdr{
      background:linear-gradient(180deg,#1C140A 0%,#3A2A18 100%);
      color:var(--huang-l,#FFE08A);padding:18px 16px;border-radius:var(--r-lg,14px);
      border:2px solid var(--huang,#C9A227);box-shadow:var(--sh-lg,0 8px 24px rgba(0,0,0,.32));
      position:relative;overflow:hidden;
    }
    .v14-hdr::before{
      content:'';position:absolute;top:-30px;right:-30px;width:130px;height:130px;
      background:radial-gradient(circle,rgba(201,162,39,.18) 0%,transparent 70%);
    }
    .v14-hdr .seal{
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:32px;
      letter-spacing:.1em;color:var(--huang-l,#FFE08A);text-shadow:2px 2px 0 rgba(0,0,0,.4);
    }
    .v14-hdr .sub{font-size:11.5px;opacity:.85;margin-top:4px;letter-spacing:.15em}
    .v14-hdr .stamp{
      display:inline-block;margin-top:8px;background:var(--zhusha,#9C3030);
      color:var(--huang-l,#FFE08A);padding:3px 10px;font-size:11px;
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);letter-spacing:.15em;
      transform:rotate(-2deg);box-shadow:0 1px 3px rgba(0,0,0,.4);
    }
    .v14-back{
      position:absolute;top:12px;right:14px;background:rgba(252,244,229,.12);
      border:1px solid var(--huang,#C9A227);color:var(--huang-l,#FFE08A);
      padding:5px 11px;border-radius:8px;font-size:11.5px;cursor:pointer;
      font-family:inherit;
    }
    .v14-back:hover{background:rgba(252,244,229,.22)}
    .v14-toc{
      background:var(--mi-w,#FCF4E5);border:1px solid var(--mi-d,#E8D4B8);
      border-radius:var(--r,10px);padding:10px;margin:14px 0;
      display:flex;flex-wrap:wrap;gap:6px;
    }
    .v14-toc a{
      background:#fff;border:1px solid var(--gutong,#876A36);
      color:var(--mo,#1C140A);padding:5px 10px;border-radius:6px;
      font-size:12px;text-decoration:none;font-family:inherit;cursor:pointer;
      transition:all .15s;
    }
    .v14-toc a:hover{background:var(--zhusha,#9C3030);color:var(--huang-l,#FFE08A);transform:translateY(-1px)}

    .v14-sec{margin:24px 0 18px}
    .v14-sec-h{
      display:flex;align-items:center;gap:10px;
      border-bottom:2px solid var(--zhusha,#9C3030);padding-bottom:6px;margin-bottom:14px;
    }
    .v14-sec-h .han{
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);
      font-size:32px;color:var(--zhusha,#9C3030);line-height:1;
    }
    .v14-sec-h .t{font-size:17px;font-weight:700;letter-spacing:.05em}
    .v14-sec-h .s{font-size:11px;color:var(--gutong,#876A36);margin-top:2px}

    /* 처방 카드 */
    .v14-rx{
      background:var(--mi-w,#FCF4E5);border:1.5px solid var(--gutong,#876A36);
      border-radius:var(--r,10px);padding:12px 14px;margin-bottom:12px;
      box-shadow:var(--sh-sm,0 1px 3px rgba(0,0,0,.18));
    }
    .v14-rx.feat{
      background:#FFF6E0;border-color:var(--zhusha,#9C3030);border-width:2px;
      box-shadow:0 3px 10px rgba(156,48,48,.18);
    }
    .v14-rx-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed var(--mi-d,#E8D4B8)}
    .v14-rx-name{font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:22px;letter-spacing:.04em;color:var(--mo,#1C140A)}
    .v14-rx-name .ko{font-size:11.5px;color:var(--gutong,#876A36);margin-left:6px;font-family:inherit;letter-spacing:0}
    .v14-rx-tag{
      background:var(--zhusha,#9C3030);color:var(--huang-l,#FFE08A);
      padding:3px 8px;font-size:10px;border-radius:6px;letter-spacing:.1em;
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);white-space:nowrap;
    }
    .v14-rx-tag.gold{background:var(--huang-d,#8C6818)}
    .v14-rx-tag.jade{background:var(--feicui,#2A7060)}
    .v14-rx-tag.purp{background:#5D3A6E}
    .v14-rx-tag.org{background:#C66A3A}

    .v14-rx-row{display:grid;grid-template-columns:62px 1fr;gap:8px;margin-bottom:6px;align-items:start;font-size:13px;line-height:1.55}
    .v14-rx-lbl{
      font-weight:700;color:var(--zhusha-d,#6E1818);text-align:right;
      border-right:2px solid var(--zhusha,#9C3030);padding-right:6px;font-size:11.5px;
      letter-spacing:.08em;
    }
    .v14-rx-val{color:var(--mo,#1C140A)}
    .v14-rx-val b,.v14-rx-val strong{color:var(--zhusha-d,#6E1818);font-weight:700}

    /* 본초 칩 — 기능별 색상 */
    .v14-herbs{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}
    .v14-herb{
      display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:4px;
      font-size:11.5px;font-weight:600;border:1px solid #999;background:#fff;
      font-family:var(--font-han,'Noto Serif SC',serif);
    }
    .v14-herb .role{
      font-size:9px;font-weight:700;padding:0 3px;border-radius:3px;
      background:rgba(0,0,0,.08);margin-left:2px;
    }
    .v14-herb .role.jun{background:var(--zhusha,#9C3030);color:var(--huang-l,#FFE08A)}
    .v14-herb .role.sin{background:var(--gutong,#876A36);color:#FFF}
    .v14-herb .role.jwa{background:var(--feicui,#2A7060);color:#FFF}
    .v14-herb .role.sa{background:var(--xuan,#2C2E48);color:#FFF}
    .v14-herb .dose{font-family:'Courier New',monospace;font-size:9.5px;color:#666;padding-left:3px;border-left:1px dotted #ccc;margin-left:2px}

    /* 기능별 색상 */
    .v14-herb.f-jiebiao{background:#E8F1E8;border-color:#3E6B54;color:#1F4030}
    .v14-herb.f-qingre{background:#E8F0FC;border-color:#2A4D6E;color:#152840}
    .v14-herb.f-xiaxia{background:#FCE8E8;border-color:#9C3030;color:#6E1818}
    .v14-herb.f-wenli{background:#FDF0E0;border-color:#C66A3A;color:#7A3818}
    .v14-herb.f-buqi{background:#FFF5D8;border-color:#B8860B;color:#7A5A0A}
    .v14-herb.f-buxue{background:#F5E8F0;border-color:#A83A6E;color:#681F44}
    .v14-herb.f-buyin{background:#E8F5F0;border-color:#3A8A6E;color:#1F5040}
    .v14-herb.f-buyang{background:#FCE5D8;border-color:#C44A1A;color:#7A2A0A}
    .v14-herb.f-lishi{background:#E8E8F5;border-color:#5D3A6E;color:#382044}
    .v14-herb.f-huatan{background:#F0E8D8;border-color:#7A5A2A;color:#503818}
    .v14-herb.f-lichi{background:#F8E8D8;border-color:#A86A2A;color:#704414}
    .v14-herb.f-huoxue{background:#FCE0D8;border-color:#8A2A2A;color:#5A1414}
    .v14-herb.f-shougu{background:#E0E8E0;border-color:#5A7A5A;color:#2F4A2F}
    .v14-herb.f-huashi{background:#E5F0E5;border-color:#4A8A4A;color:#28502F}

    /* 핵심 포인트 박스 */
    .v14-key{
      background:linear-gradient(135deg,#FFF6E0,var(--mi-w,#FCF4E5));
      border-left:5px solid var(--zhusha,#9C3030);
      padding:10px 12px;margin:8px 0;font-size:12.5px;line-height:1.6;border-radius:4px;
    }
    .v14-key .lab{
      display:inline-block;background:var(--zhusha,#9C3030);color:#FFF;
      padding:2px 7px;font-size:10px;letter-spacing:.1em;font-weight:700;
      margin-right:6px;border-radius:3px;font-family:var(--font-display,'ZCOOL XiaoWei',serif);
    }
    .v14-key.gold{border-left-color:var(--huang-d,#8C6818)}
    .v14-key.gold .lab{background:var(--huang-d,#8C6818)}
    .v14-key.jade{border-left-color:var(--feicui,#2A7060)}
    .v14-key.jade .lab{background:var(--feicui,#2A7060)}

    /* exam 태그 */
    .v14-exam{
      display:inline-block;background:#FFF;border:1px dashed var(--zhusha,#9C3030);
      color:var(--zhusha,#9C3030);font-size:9.5px;padding:1px 5px;
      font-weight:700;letter-spacing:.05em;margin-left:5px;vertical-align:middle;
      border-radius:3px;
    }

    /* 분류 매트릭스 */
    .v14-table{
      width:100%;border-collapse:collapse;background:var(--mi-w,#FCF4E5);
      border:1.5px solid var(--gutong,#876A36);font-size:12px;margin:10px 0;
    }
    .v14-table th{
      background:var(--mo,#1C140A);color:var(--huang-l,#FFE08A);
      padding:8px 6px;text-align:center;font-family:var(--font-display,'ZCOOL XiaoWei',serif);
      letter-spacing:.08em;font-size:12.5px;
    }
    .v14-table td{padding:7px 6px;border:1px solid #C8B89A;text-align:center;vertical-align:middle}
    .v14-table td.lbl{background:var(--mi-d,#E8D4B8);font-weight:700;color:var(--zhusha-d,#6E1818);text-align:right;padding-right:8px}
    .v14-table td.hl{background:#FFF6E0;font-weight:700;color:var(--zhusha-d,#6E1818)}

    /* 派生 系譜 */
    .v14-lin{
      background:var(--mi-w,#FCF4E5);border:1.5px solid var(--gutong,#876A36);
      border-radius:var(--r,10px);padding:14px;margin:14px 0;
    }
    .v14-lin-t{
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:16px;
      letter-spacing:.08em;color:var(--zhusha-d,#6E1818);
      border-bottom:1px solid var(--mi-d,#E8D4B8);padding-bottom:6px;margin-bottom:10px;
    }
    .v14-lin-t .sec{font-size:10px;color:var(--gutong,#876A36);float:right;margin-top:4px;letter-spacing:.1em}
    .v14-lin-row{
      display:flex;flex-wrap:wrap;align-items:center;gap:5px;
      font-size:12px;margin-bottom:7px;padding:6px;background:#FFF;border-radius:4px;
    }
    .v14-lin-box{
      background:var(--mi-d,#E8D4B8);border:1px solid var(--gutong,#876A36);
      padding:4px 9px;font-family:var(--font-han,'Noto Serif SC',serif);font-weight:700;
      border-radius:4px;font-size:12px;
    }
    .v14-lin-box.res{
      background:var(--huang-l,#FFE08A);border:2px solid var(--zhusha,#9C3030);
      color:var(--zhusha-d,#6E1818);
    }
    .v14-lin-op{font-size:16px;font-weight:700;color:var(--zhusha,#9C3030);padding:0 3px}
    .v14-lin-note{
      font-size:10.5px;color:var(--gutong,#876A36);background:#FFF;
      padding:2px 6px;border:1px dashed #C8B89A;border-radius:3px;
    }

    /* 매트릭스 (가로 본초 × 세로 처방) */
    .v14-mtx-wrap{overflow-x:auto;border:1.5px solid var(--gutong,#876A36);background:var(--mi-w,#FCF4E5);border-radius:var(--r,10px);margin:14px 0;-webkit-overflow-scrolling:touch}
    .v14-mtx{border-collapse:collapse;font-size:11px;min-width:max-content}
    .v14-mtx th{background:var(--mo,#1C140A);color:var(--huang-l,#FFE08A);padding:6px 4px;position:sticky;top:0;z-index:2;font-family:var(--font-han,'Noto Serif SC',serif);font-size:12px;font-weight:700;white-space:nowrap}
    .v14-mtx th.rh{background:var(--zhusha-d,#6E1818);text-align:left;padding-left:10px;position:sticky;left:0;z-index:3}
    .v14-mtx td{padding:5px 4px;border:1px solid #D4C5A3;text-align:center;background:#FFF;min-width:38px}
    .v14-mtx td.rx-cell{
      background:var(--mi-d,#E8D4B8);font-family:var(--font-han,'Noto Serif SC',serif);
      font-weight:700;text-align:left;padding:7px 10px;border-right:2px solid var(--mo,#1C140A);
      color:var(--zhusha-d,#6E1818);white-space:nowrap;font-size:12px;
      position:sticky;left:0;z-index:1;
    }
    .v14-mtx td.has{background:#FFF6E0;font-weight:600;color:var(--zhusha-d,#6E1818)}
    .v14-mtx td.has.jun{background:#FCC4A4;font-weight:800}
    .v14-mtx td.has.sin{background:#FDE2B6}
    .v14-mtx td.has.jwa{background:#E8F0DC}
    .v14-mtx td.has.sa{background:#E0E0F0}
    .v14-mtx td.empty{color:#CCC}

    /* 五積 색상 박스 */
    .v14-wuji{
      display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin:10px 0;
    }
    .v14-wuji-card{
      padding:10px;border:1.5px solid var(--gutong,#876A36);border-radius:var(--r,10px);
      font-size:12px;
    }
    .v14-wuji-card .ji{font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:18px;letter-spacing:.05em;color:var(--zhusha-d,#6E1818)}
    .v14-wuji-card .tg{font-size:10px;color:var(--gutong,#876A36);margin-bottom:4px;letter-spacing:.08em}
    .v14-wuji-card .hb{display:flex;flex-wrap:wrap;gap:3px;margin:6px 0}
    .v14-wuji-card .bs{font-size:10.5px;color:#333;background:#FFF;padding:4px 6px;border-radius:3px;margin-top:5px}

    /* 함정 카드 */
    .v14-trap{
      background:#FFF6E0;border:1.5px solid var(--zhusha,#9C3030);
      border-left:6px solid var(--zhusha,#9C3030);border-radius:6px;
      padding:10px 12px;margin:8px 0;font-size:12.5px;line-height:1.6;
    }
    .v14-trap .ex{
      display:inline-block;background:var(--zhusha,#9C3030);color:var(--huang-l,#FFE08A);
      padding:2px 6px;font-size:9.5px;letter-spacing:.08em;font-weight:700;
      margin-right:6px;border-radius:3px;
    }
    .v14-trap .rx{font-family:var(--font-han,'Noto Serif SC',serif);font-weight:700;color:var(--mo,#1C140A);margin-right:4px}
    .v14-trap .q{color:var(--gutong,#876A36);font-size:11.5px}
    .v14-trap .a{color:var(--zhusha-d,#6E1818);font-weight:800;margin-top:3px;display:block}
    .v14-trap .h{font-size:10.5px;color:#555;margin-top:2px;display:block}

    /* 범례 */
    .v14-legend{
      background:#FFF;border:1px solid var(--mi-d,#E8D4B8);border-radius:var(--r,10px);
      padding:10px 12px;margin:10px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;
    }
    .v14-legend .ttl{font-weight:700;font-family:var(--font-display,'ZCOOL XiaoWei',serif);
      letter-spacing:.08em;font-size:12px;border-right:2px solid var(--mo,#1C140A);padding-right:8px;color:var(--zhusha-d,#6E1818)}

    /* 시그니처 도장 */
    .v14-seal{
      display:inline-block;font-family:var(--font-display,'ZCOOL XiaoWei',serif);
      background:var(--zhusha,#9C3030);color:var(--huang-l,#FFE08A);
      padding:4px 8px;border-radius:4px;font-size:12px;letter-spacing:.1em;
      transform:rotate(-1.5deg);
    }

    /* 모바일 */
    @media(max-width:520px){
      .v14-wrap{padding:10px 8px 80px}
      .v14-rx-row{grid-template-columns:54px 1fr;font-size:12.5px}
      .v14-hdr .seal{font-size:26px}
    }
  `;
  document.head.appendChild(s);
}

// ───────────────────────────────────────────────────────────────────────
// 3) 본초 칩 HTML 생성
// ───────────────────────────────────────────────────────────────────────
function herbChip(herb, opts){
  opts = opts || {};
  const HF = (window.V14_RELATIONS && window.V14_RELATIONS.HERB_FUNC) || {};
  const base = String(herb).replace(/\(.*?\)/g,'').replace(/\s+/g,'');
  const func = HF[base] || HF[herb] || '';
  const fclass = func ? `f-${func}` : '';
  const dose = opts.dose ? `<span class="dose">${esc(opts.dose)}</span>` : '';
  let role = '';
  if(opts.role){
    const r = opts.role;
    const cls = r==='君'?'jun':r==='臣'?'sin':r==='佐'?'jwa':r==='使'?'sa':'';
    role = `<span class="role ${cls}">${esc(r)}</span>`;
  }
  return `<span class="v14-herb ${fclass}">${esc(herb)}${role}${dose}</span>`;
}

// ───────────────────────────────────────────────────────────────────────
// 4) 처방 카드 HTML 생성
// ───────────────────────────────────────────────────────────────────────
function rxCard(rxMeta, opts){
  opts = opts || {};
  const id = rxMeta.id;
  const f = getFormulaById(id);
  const comp = getComposition(id);
  const han = (f && f.han) || rxMeta.han;
  const ko = (f && f.ko) || rxMeta.ko;
  const action = (f && f.action) || '';
  const ind = (f && f.indication) || '';
  const src = (f && f.source) || '';
  // FORMULAS의 keyPoints가 없으면 KEY_POINTS_EXTRA에서 보충
  let kps = (f && f.keyPoints) || [];
  if((!kps || !kps.length) && window.V14_RELATIONS && window.V14_RELATIONS.KEY_POINTS_EXTRA){
    kps = window.V14_RELATIONS.KEY_POINTS_EXTRA[id] || [];
  }
  const tagMap = {
    gongli:{cls:'',  label:'解表攻裏'},
    cingli:{cls:'jade', label:'解表淸裏'},
    wenli:{cls:'org', label:'解表溫裏'},
    buqi:{cls:'gold', label:'補氣劑'},
    buxue:{cls:'purp', label:'補血劑'},
  };
  const tag = tagMap[rxMeta.bucket] || {cls:'', label:''};
  // 본초 칩 생성 (role 정보 포함)
  const chips = comp.map(h => {
    const baseH = String(h).replace(/\(.*?\)/g,'');
    const role = getRoleOf(id, baseH);
    return herbChip(baseH, role ? {role} : {});
  }).join('');

  let kpHtml = '';
  if(kps.length){
    kpHtml = `<div class="v14-rx-row"><div class="v14-rx-lbl">키포인트</div><div class="v14-rx-val" style="font-size:12px">${
      kps.slice(0,6).map(k => `· ${esc(k)}`).join('<br>')
    }</div></div>`;
  }

  return `
    <div class="v14-rx ${opts.feat?'feat':''}" id="rx-${esc(id)}">
      <div class="v14-rx-hd">
        <div>
          <span class="v14-rx-name">${esc(han)}<span class="ko">${esc(ko)}</span></span>
        </div>
        <span class="v14-rx-tag ${tag.cls}">${esc(tag.label)}</span>
      </div>
      ${src ? `<div class="v14-rx-row"><div class="v14-rx-lbl">출전</div><div class="v14-rx-val">${esc(src)}</div></div>` : ''}
      ${action ? `<div class="v14-rx-row"><div class="v14-rx-lbl">작용</div><div class="v14-rx-val"><b>${esc(action)}</b></div></div>` : ''}
      ${ind ? `<div class="v14-rx-row"><div class="v14-rx-lbl">주치</div><div class="v14-rx-val">${esc(ind)}</div></div>` : ''}
      <div class="v14-rx-row"><div class="v14-rx-lbl">구성<br><span style="font-size:10px;color:#666">(${comp.length}味)</span></div><div class="v14-rx-val"><div class="v14-herbs">${chips}</div></div></div>
      ${kpHtml}
    </div>
  `;
}

// ───────────────────────────────────────────────────────────────────────
// 5) 派生 系譜 HTML
// ───────────────────────────────────────────────────────────────────────
function lineageHtml(L){
  const rows = L.steps.map(s => {
    const parts = [`<span class="v14-lin-box">${esc(s.base)}</span>`];
    if(s.sub && s.sub.length){
      parts.push(`<span class="v14-lin-op">−</span>`);
      parts.push(`<span class="v14-lin-note">${s.sub.map(esc).join('·')}</span>`);
    }
    if(s.add && s.add.length){
      parts.push(`<span class="v14-lin-op">+</span>`);
      parts.push(`<span class="v14-lin-note">${s.add.map(esc).join('·')}</span>`);
    }
    if(s.note) parts.push(`<span class="v14-lin-note" style="background:#FFF6E0">${esc(s.note)}</span>`);
    return `<div class="v14-lin-row">${parts.join('')}</div>`;
  }).join('');
  const result = L.result ? `<div class="v14-lin-row"><span class="v14-lin-op">=</span><span class="v14-lin-box res">${esc(L.result)}</span></div>` : '';
  const kp = L.keyPoint ? `<div class="v14-key" style="margin-top:8px"><span class="lab">핵심</span>${esc(L.keyPoint)}</div>` : '';
  return `
    <div class="v14-lin">
      <div class="v14-lin-t">${esc(L.title)}<span class="sec">${esc(L.section||'')}</span></div>
      ${rows}
      ${result}
      ${kp}
    </div>
  `;
}

// ───────────────────────────────────────────────────────────────────────
// 6) 처방 × 본초 매트릭스 HTML (전체 시험범위)
// ───────────────────────────────────────────────────────────────────────
function buildMatrix(){
  const R = window.V14_RELATIONS;
  if(!R) return '';
  const HF = R.HERB_FUNC;
  // 시험범위 처방
  const rows = R.MAIN_RX_ORDER;
  // 본초 집합 만들기 (기능순 정렬)
  const funcOrder = ['jiebiao','qingre','xiaxia','wenli','huashi','lishi','huatan','lichi','huoxue','buqi','buxue','buyin','buyang','shougu'];
  const seen = new Set();
  const herbs = [];
  rows.forEach(rm => {
    getComposition(rm.id).forEach(h => {
      const base = String(h).replace(/\(.*?\)/g,'');
      if(!seen.has(base)){ seen.add(base); herbs.push(base); }
    });
  });
  herbs.sort((a,b) => {
    const fa = HF[a] || 'zzz', fb = HF[b] || 'zzz';
    const ia = funcOrder.indexOf(fa), ib = funcOrder.indexOf(fb);
    return (ia<0?99:ia) - (ib<0?99:ib);
  });

  // 헤더
  const head = `<tr><th class="rh">처방 ↓ \\ 본초 →</th>${herbs.map(h => {
    const f = HF[h] || '';
    return `<th class="f-${f}">${esc(h)}</th>`;
  }).join('')}</tr>`;
  // 행
  const body = rows.map(rm => {
    const comp = getComposition(rm.id);
    const compSet = new Set(comp.map(h => String(h).replace(/\(.*?\)/g,'')));
    const cells = herbs.map(h => {
      if(compSet.has(h)){
        const role = getRoleOf(rm.id, h);
        const rcls = role==='君'?'jun':role==='臣'?'sin':role==='佐'?'jwa':role==='使'?'sa':'';
        const dot = role==='君'?'●君':role?'●'+role:'●';
        return `<td class="has ${rcls}">${esc(dot)}</td>`;
      }
      return `<td class="empty">·</td>`;
    }).join('');
    return `<tr><td class="rx-cell">${esc(rm.han)}<br><span style="font-size:9.5px;font-weight:400;color:#666">${esc(rm.ko)}</span></td>${cells}</tr>`;
  }).join('');

  return `
    <div class="v14-mtx-wrap">
      <table class="v14-mtx">
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div style="font-size:10.5px;color:#666;text-align:center;margin-top:4px">
      ● = 포함 / 君臣佐使 색상: <span style="background:#FCC4A4;padding:1px 4px">君</span> <span style="background:#FDE2B6;padding:1px 4px">臣</span> <span style="background:#E8F0DC;padding:1px 4px">佐</span> <span style="background:#E0E0F0;padding:1px 4px">使</span>
    </div>
  `;
}

// ───────────────────────────────────────────────────────────────────────
// 7) 용량 비교표 HTML
// ───────────────────────────────────────────────────────────────────────
function buildDoseTable(D){
  const head = `<tr><th>처방</th>${D.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const body = D.rows.map(r => {
    const cells = r.cells.map(c => {
      const v = String(c);
      const cls = v.includes('×') ? 'empty' : v.includes('君') ? 'hl' : '';
      return `<td class="${cls}">${esc(v)}</td>`;
    }).join('');
    return `<tr><td class="lbl">${esc(r.rx)}</td>${cells}</tr>`;
  }).join('');
  const kps = (D.keyPoints||[]).map(k => `<div class="v14-key gold"><span class="lab">핵심</span>${esc(k)}</div>`).join('');
  return `
    <div class="v14-lin">
      <div class="v14-lin-t">${esc(D.title)}</div>
      ${D.note ? `<div style="font-size:11.5px;color:#666;margin-bottom:8px">${esc(D.note)}</div>` : ''}
      <div class="v14-mtx-wrap"><table class="v14-mtx v14-table">
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table></div>
      ${kps}
    </div>
  `;
}

// ───────────────────────────────────────────────────────────────────────
// 8) 五積 분해 HTML
// ───────────────────────────────────────────────────────────────────────
function buildWuji(){
  const W = window.V14_RELATIONS && window.V14_RELATIONS.WUJI_MAP;
  if(!W) return '';
  const cards = W.rows.map(r => `
    <div class="v14-wuji-card" style="background:${r.color}">
      <div class="ji">${esc(r.ji)}</div>
      <div class="tg">${esc(r.tag)}</div>
      <div class="hb">${r.herbs.map(h => herbChip(h)).join('')}</div>
      <div class="bs">${esc(r.base)}</div>
    </div>
  `).join('');
  return `
    <div class="v14-lin">
      <div class="v14-lin-t">${esc(W.title)}</div>
      <div class="v14-wuji">${cards}</div>
      <div class="v14-key" style="border-left-color:#C44A1A"><span class="lab" style="background:#C44A1A">⚠ 경고</span>${esc(W.warning)}</div>
    </div>
  `;
}

// ───────────────────────────────────────────────────────────────────────
// 9) 함정 카드 / 비교 카드 HTML
// ───────────────────────────────────────────────────────────────────────
function buildTraps(){
  const T = window.V14_RELATIONS && window.V14_RELATIONS.TRAP_CARDS;
  if(!T) return '';
  return T.map(t => `
    <div class="v14-trap">
      <span class="ex">${esc(t.exam)}</span>
      <span class="rx">${esc(t.rx)}</span>
      <span class="q">${esc(t.q)}</span>
      <span class="a">→ ${esc(t.answer)}</span>
      <span class="h">${esc(t.hint||'')}</span>
    </div>
  `).join('');
}

function buildCompares(){
  const C = window.V14_RELATIONS && window.V14_RELATIONS.COMPARE_CARDS;
  if(!C) return '';
  return C.map(comp => {
    const rows = comp.rows.map(r => `
      <tr><td class="lbl">${esc(r.col)}</td><td>${r.cells.map(esc).join(' / ')}</td></tr>
    `).join('');
    return `
      <div class="v14-lin">
        <div class="v14-lin-t">${esc(comp.title)}</div>
        <table class="v14-table">${rows}</table>
      </div>
    `;
  }).join('');
}

// ───────────────────────────────────────────────────────────────────────
// 10) 메인 render — view에 innerHTML 적용
// ───────────────────────────────────────────────────────────────────────
function render(){
  const view = document.getElementById('view');
  if(!view){ console.warn('[v14] #view 없음'); return; }
  injectStyles();

  const R = window.V14_RELATIONS;
  if(!R){ view.innerHTML = '<div style="padding:20px">v14 관계 데이터(data-v14-relations.js)가 로드되지 않았습니다.</div>'; return; }

  const tocItems = [
    {id:'sec-cls',  label:'분류'},
    {id:'sec-rx',   label:'處方 카드'},
    {id:'sec-lin',  label:'派生 系譜'},
    {id:'sec-dose', label:'용량 비교'},
    {id:'sec-mtx',  label:'本草 매트릭스'},
    {id:'sec-wuji', label:'五積 분해'},
    {id:'sec-comp', label:'비교 카드'},
    {id:'sec-trap', label:'★ 함정 카드'},
  ];

  // 분류 매트릭스
  const clsHtml = `
    <table class="v14-table">
      <thead><tr><th style="width:22%">분류</th><th style="width:30%">病證</th><th style="width:23%">治法</th><th>대표 方劑</th></tr></thead>
      <tbody>
        <tr><td class="lbl">解表攻裏劑</td><td>外有表邪·裡有實積</td><td>해표 + <b>사하</b></td><td class="hl">大柴胡湯 · 防風通聖散</td></tr>
        <tr><td class="lbl">解表淸裏劑</td><td>表邪未解·裡熱已熾</td><td>해표 + <b>청열</b></td><td class="hl">葛根芩連湯 · 石膏湯</td></tr>
        <tr><td class="lbl">解表溫裏劑</td><td>表邪未解·又有裡寒</td><td>해표 + <b>온리</b></td><td class="hl">五積散 · 桂枝人蔘湯</td></tr>
        <tr><td class="lbl">補氣劑</td><td>脾胃氣虛·中氣下陷</td><td><b>보기</b></td><td class="hl">四君子·參苓白朮散·補中益氣·玉屛風·生脈散</td></tr>
        <tr><td class="lbl">補血劑</td><td>營血虛滯</td><td><b>보혈</b></td><td class="hl">四物湯 · 當歸補血湯</td></tr>
      </tbody>
    </table>
  `;

  // 처방 카드들 (FORMULAS 순서대로)
  const rxCards = R.MAIN_RX_ORDER.map(rm => rxCard(rm, {feat: ['daesiho-tang','bangpung-tongseong-san','ojeoksan','sagunja-tang','samryeong-baekchul-san','bojung-iggi-tang','simul-tang','danggwi-boheol-tang'].includes(rm.id)})).join('');

  // 派生 系譜
  const linHtml = R.LINEAGE.map(lineageHtml).join('');

  // 용량 비교표
  const doseHtml = R.DOSE_TABLES.map(buildDoseTable).join('');

  // 매트릭스
  const mtxHtml = buildMatrix();

  // 五積
  const wujiHtml = buildWuji();

  // 비교
  const compHtml = buildCompares();

  // 함정
  const trapHtml = buildTraps();

  // 범례
  const legend = `
    <div class="v14-legend">
      <span class="ttl">本草 분류</span>
      ${herbChip('解表 例')}${herbChip('黃連', {role:'佐'})}${herbChip('大黃')}${herbChip('乾薑')}${herbChip('人蔘',{role:'君'})}${herbChip('當歸')}${herbChip('麥門冬')}${herbChip('茯苓')}${herbChip('半夏')}${herbChip('陳皮')}${herbChip('川芎')}${herbChip('五味子')}
    </div>
  `;

  view.innerHTML = `
    <div class="v14-wrap">
      <div class="v14-hdr">
        <button class="v14-back" id="v14-back">← 의서궁</button>
        <div class="seal">方鑑 · 方劑學 시각 매핑</div>
        <div class="sub">7장 表裏雙解劑 · 8장 補益劑 · 處方 × 本草 × 派生 系譜</div>
        <span class="stamp">v14 NEW</span>
      </div>

      <div class="v14-toc">
        ${tocItems.map(t => `<a data-jump="${t.id}">${esc(t.label)}</a>`).join('')}
      </div>

      ${legend}

      <div class="v14-sec" id="sec-cls">
        <div class="v14-sec-h"><span class="han">分</span>
          <div><div class="t">시험범위 五分類</div><div class="s">CLASSIFICATION · 病證 × 治法 × 方劑</div></div>
        </div>
        ${clsHtml}
      </div>

      <div class="v14-sec" id="sec-rx">
        <div class="v14-sec-h"><span class="han">方</span>
          <div><div class="t">處方 카드 — 13 主要方</div><div class="s">FORMULA CARDS · 君臣佐使 · 작용 · 주치 · 키포인트</div></div>
        </div>
        ${rxCards}
      </div>

      <div class="v14-sec" id="sec-lin">
        <div class="v14-sec-h"><span class="han">系</span>
          <div><div class="t">派生 系譜</div><div class="s">LINEAGE · 기본방에서 다른 방제로 가는 변형 공식</div></div>
        </div>
        ${linHtml}
      </div>

      <div class="v14-sec" id="sec-dose">
        <div class="v14-sec-h"><span class="han">量</span>
          <div><div class="t">용량 比較</div><div class="s">DOSE COMPARISON · 같은 본초 다른 용량 = 다른 主治</div></div>
        </div>
        ${doseHtml}
      </div>

      <div class="v14-sec" id="sec-mtx">
        <div class="v14-sec-h"><span class="han">矩</span>
          <div><div class="t">處方 × 本草 매트릭스</div><div class="s">MATRIX · 가로 본초 × 세로 처방 · 君臣佐使 색상 코딩</div></div>
        </div>
        ${mtxHtml}
      </div>

      <div class="v14-sec" id="sec-wuji">
        <div class="v14-sec-h"><span class="han">五</span>
          <div><div class="t">五積散 ─ 五積 분해</div><div class="s">★ 22·21·20·18·17·16·15·14 多年 출제</div></div>
        </div>
        ${wujiHtml}
      </div>

      <div class="v14-sec" id="sec-comp">
        <div class="v14-sec-h"><span class="han">較</span>
          <div><div class="t">비교 카드</div><div class="s">COMPARE · 헷갈리는 처방 쌍</div></div>
        </div>
        ${compHtml}
      </div>

      <div class="v14-sec" id="sec-trap">
        <div class="v14-sec-h"><span class="han">罠</span>
          <div><div class="t">★ 함정 카드 (22~18 기출)</div><div class="s">TRAP · 자주 틀리는 포인트 · 22 객관식 중심</div></div>
        </div>
        ${trapHtml}
      </div>
    </div>
  `;

  // 이벤트
  $('#v14-back').onclick = () => {
    if(window.V11ClinicHub && window.V11ClinicHub.open) window.V11ClinicHub.open();
    else if(window.ROUTES && window.ROUTES.hub) window.ROUTES.hub();
    else if(window.ROUTES && window.ROUTES.home) window.ROUTES.home();
    else history.back();
  };
  $$('.v14-toc a').forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      const id = a.dataset.jump;
      const el = document.getElementById(id);
      if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
    };
  });
}

function open(){ render(); }

// ───────────────────────────────────────────────────────────────────────
// 11) 의서궁 / 방제학 home 배너 주입 (v13 통합 패치 패턴 따름)
// ───────────────────────────────────────────────────────────────────────
function injectBannerStyles(){
  if(document.getElementById('v14-banner-style')) return;
  const s = document.createElement('style');
  s.id = 'v14-banner-style';
  s.textContent = `
    .v14-banner{
      background:linear-gradient(135deg,#8C6818 0%,#5A4008 100%);
      color:#FFE08A;padding:14px 16px;border-radius:12px;margin:14px 0;
      cursor:pointer;display:flex;align-items:center;gap:12px;
      box-shadow:0 4px 14px rgba(140,104,24,.3);
      transition:transform .15s,box-shadow .15s;border:2px solid #FFE08A;
      font-family:var(--font-body,'Noto Serif KR',serif);
    }
    .v14-banner:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(140,104,24,.5)}
    .v14-banner-lg{padding:18px 20px;margin:16px 0;border-width:3px;
      background:linear-gradient(135deg,#A07820 0%,#3A2A08 50%,#7C5810 100%);
    }
    .v14-banner .han{
      font-family:var(--font-display,'ZCOOL XiaoWei',serif);font-size:38px;color:#FFE6A8;
      line-height:1;text-shadow:2px 2px 0 rgba(0,0,0,.4);min-width:64px;text-align:center;
    }
    .v14-banner-lg .han{font-size:50px;min-width:84px}
    .v14-banner .body{flex:1}
    .v14-banner .ttl{font-size:17px;font-weight:700;color:#FFE6A8;letter-spacing:.05em}
    .v14-banner-lg .ttl{font-size:20px}
    .v14-banner .sub{font-size:11px;opacity:.88;margin-top:3px;color:#FFE6A8}
    .v14-banner .arrow{margin-left:auto;font-size:22px;color:#FFE6A8;opacity:.7}
    .v14-banner .badge{
      display:inline-block;background:#FFE6A8;color:#5A4008;font-size:9.5px;
      padding:2px 6px;border-radius:8px;font-weight:700;margin-left:6px;
      vertical-align:middle;letter-spacing:.05em;
    }
  `;
  document.head.appendChild(s);
}

function makeBanner(big){
  const banner = document.createElement('div');
  banner.className = 'v14-banner' + (big?' v14-banner-lg':'');
  banner.innerHTML = `
    <div class="han">方</div>
    <div class="body">
      <div class="ttl">方鑑 — 시각 매핑 <span class="badge">NEW v14</span></div>
      <div class="sub">13 主要方 · 派生 系譜 · 본초 매트릭스 · 용량 비교 · 22 함정 카드</div>
      <div class="sub" style="margin-top:2px">표리쌍해제 + 보익제 전체를 한눈에</div>
    </div>
    <div class="arrow">→</div>
  `;
  banner.onclick = () => open();
  return banner;
}

function injectInHub(){
  // V11ClinicHub.open 후킹
  if(!window.V11ClinicHub || !window.V11ClinicHub.open) return;
  if(window.__v14HubHooked) return;
  window.__v14HubHooked = true;
  const orig = window.V11ClinicHub.open;
  window.V11ClinicHub.open = function(){
    orig.apply(this, arguments);
    setTimeout(() => {
      injectBannerStyles();
      const view = document.getElementById('view');
      if(!view) return;
      if(view.querySelector('.v14-banner')) return;
      const banner = makeBanner(true);
      // 헬게이트 배너 다음에 (가장 위쪽이지만 헬게이트보다는 아래)
      const hellBanner = view.querySelector('.hg-hellgate-banner');
      if(hellBanner && hellBanner.parentNode){
        hellBanner.parentNode.insertBefore(banner, hellBanner.nextSibling);
      } else {
        // 헬게이트가 아직 없으면 grid 위에
        const grid = view.querySelector('[class*="subject"], [class*="rooms"], [class*="hall-grid"], .ch-grid, .grid');
        const placeBefore = grid || view.querySelector('.card') || view.firstChild;
        if(placeBefore && placeBefore.parentNode) placeBefore.parentNode.insertBefore(banner, placeBefore);
        else view.appendChild(banner);
      }
    }, 60);  // 헬게이트보다 약간 늦게 (헬게이트의 30ms 이후)
  };
  if(window.ROUTES) window.ROUTES.hub = window.V11ClinicHub.open;
}

function injectInHome(){
  if(!window.ROUTES || !window.ROUTES.home) return;
  if(window.__v14HomeHooked) return;
  window.__v14HomeHooked = true;
  const orig = window.ROUTES.home;
  window.ROUTES.home = function(){
    orig.apply(this, arguments);
    setTimeout(() => {
      injectBannerStyles();
      const view = document.getElementById('view');
      if(!view) return;
      if(view.querySelector('.v14-banner')) return;
      const banner = makeBanner(false);
      // 헬게이트 다음
      const hellBanner = view.querySelector('.hg-hellgate-banner');
      if(hellBanner && hellBanner.parentNode){
        hellBanner.parentNode.insertBefore(banner, hellBanner.nextSibling);
      } else {
        const firstCard = view.querySelector('.card');
        if(firstCard && firstCard.parentNode) firstCard.parentNode.insertBefore(banner, firstCard.nextSibling);
        else view.appendChild(banner);
      }
    }, 60);
  };
}

// ───────────────────────────────────────────────────────────────────────
// 12) 부트스트랩 — 라우트 등록 + 후킹
// ───────────────────────────────────────────────────────────────────────
let _bootTries = 0;
function boot(){
  if(window.ROUTES){
    window.ROUTES.fangjian = open;
  }
  // 후킹 시도 — 의서궁/홈 모두
  try{ injectInHub();  }catch(_){}
  try{ injectInHome(); }catch(_){}
  if(_bootTries++ < 30){
    setTimeout(boot, 300);  // v13 통합 패치 이후에 잡힐 수 있도록 반복 시도
  }
}
setTimeout(boot, 200);

window.V14PyoriBoMap = {
  open: open,
  render: render,
};

console.log('[v14 方鑑] map engine ready · rx:', (window.FORMULAS||[]).length);

})();
