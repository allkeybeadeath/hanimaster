/* bangje-v96 part 5 — CSS 주입 + 정리 hook */
(function(){
'use strict';

const V96_CSS = `
/* ─ 채팅 ───────────────────────────────────────────────────────────────── */
.chat-card{
  background:var(--mi-w,#FBF1DF);
  border:1px solid var(--gutong,#876A36);
  border-radius:8px;
  margin-top:12px;
  overflow:hidden;
  font-family:var(--font-body);
  /* v10.0.3: 채팅창은 모든 모달·드로어·alert 보다 아래 — 가리지 않게 */
  position:relative;
  z-index:0;
  order:9999;  /* flex/grid 부모에서 가장 마지막 */
}
/* 채팅이 들어있는 board 영역이 flex 면 채팅이 자동으로 맨 아래로 */
.cb-board, .bc-board, #view, #card-battle-view, #cube-view {
  display: flex; flex-direction: column;
}
.cb-board > .chat-card, .bc-board > .chat-card,
#view > .chat-card, [id$="-view"] > .chat-card { order: 9999; }
.chat-card.collapsed .chat-body{ display:none; }
.chat-head{
  display:flex; align-items:center; gap:6px;
  padding:6px 10px;
  background:var(--zhusha,#9C3030);
  color:var(--mi-w,#FBF1DF);
  font-family:var(--font-display);
  font-size:13px;
}
.chat-head .han{ color:var(--huang,#C9A227); }
.chat-toggle{
  margin-left:auto;
  background:transparent; border:none; color:var(--mi-w); cursor:pointer;
  font-size:14px; padding:0 4px;
}
.chat-body{ padding:8px; }
.chat-log{
  background:var(--mi,#F5E6D3);
  border-radius:6px;
  padding:6px 8px;
  height:140px;
  overflow-y:auto;
  font-size:12px;
  line-height:1.6;
  margin-bottom:6px;
}
.chat-empty{ color:var(--gutong,#876A36); font-style:italic; text-align:center; padding:14px 4px; font-size:11px; }
.chat-msg{
  display:flex; gap:6px; align-items:baseline;
  padding:2px 0;
  flex-wrap:wrap;
}
.chat-msg.mine{ background:rgba(201,162,39,.08); padding-left:4px; border-left:2px solid var(--huang); margin-left:-4px; padding-right:4px; border-radius:2px; }
.chat-msg.is-ai{ background:rgba(42,112,96,.06); }
.chat-name{
  flex-shrink:0;
  font-weight:600;
  color:var(--zhusha-d,#6E1818);
  font-size:11px;
  display:inline-flex; align-items:center; gap:3px;
}
.chat-ai-badge{
  background:var(--feicui,#2A7060); color:var(--mi-w);
  font-size:9px; padding:0 4px; border-radius:6px;
  font-family:var(--font-display); letter-spacing:.05em;
}
.chat-fac{
  display:inline-block;
  color:var(--mi-w); font-size:9px; padding:0 4px; border-radius:6px;
  font-family:var(--font-display);
}
.chat-body-text{ flex:1; color:var(--mo,#1C140A); word-break:break-all; min-width:0; }
.chat-ts{ flex-shrink:0; font-size:10px; color:var(--gutong,#876A36); }
.chat-presets{
  display:flex; flex-wrap:wrap; gap:4px;
  margin-bottom:6px;
}
.chat-preset{
  background:var(--mi,#F5E6D3);
  border:1px solid var(--gutong,#876A36);
  color:var(--mo,#1C140A);
  font-size:11px;
  padding:2px 8px;
  border-radius:10px;
  cursor:pointer;
  font-family:var(--font-body);
}
.chat-preset:hover{ background:var(--huang-l,#F5E0A8); }
.chat-input-row{ display:flex; gap:4px; }
.chat-input{
  flex:1; padding:4px 8px;
  border:1px solid var(--gutong,#876A36);
  border-radius:4px;
  font-size:12.5px;
  font-family:var(--font-body);
  background:var(--mi,#F5E6D3);
  color:var(--mo,#1C140A);
}
.chat-send{
  background:var(--zhusha,#9C3030);
  color:var(--mi-w,#FBF1DF);
  border:none;
  padding:4px 12px;
  border-radius:4px;
  cursor:pointer;
  font-family:var(--font-display);
  font-size:12.5px;
}
.chat-send:hover{ background:var(--zhusha-d,#6E1818); }

/* ─ presence 클릭 가능 표시 ───────────────────────────────────────────── */
.presence-chip[data-uid]:hover{
  background:rgba(201,162,39,.18) !important;
  box-shadow:0 0 0 1px var(--huang-d,#9A7B1A);
}
.presence-dot-fresh{ color:var(--feicui,#2A7060); font-size:11px; }
.presence-dot-stale{ color:var(--gutong,#876A36); font-size:11px; }

/* ─ 2시간의전사 ─────────────────────────────────────────────────────────── */
.w2h-sticky{
  position:sticky; top:0; z-index:5;
  background:var(--mi,#F5E6D3);
  padding:8px 10px;
  border-bottom:2px solid var(--zhusha,#9C3030);
  margin-top:-8px;
}
.w2h-panel-row{
  display:grid; grid-template-columns:repeat(4,1fr); gap:6px;
}
.w2h-panel-cell{
  text-align:center;
  background:var(--mi-w,#FBF1DF);
  padding:5px 4px;
  border-radius:4px;
  border:1px solid var(--gutong,#876A36);
}
.w2h-pl{ font-size:10px; color:var(--gutong,#876A36); font-family:var(--font-display); }
.w2h-pv{ font-size:18px; font-family:var(--font-display); color:var(--mo,#1C140A); line-height:1.1; }
.w2h-pv-sub{ font-size:10px; color:var(--gutong); margin-left:1px; }
.w2h-badge{ font-size:10.5px; padding:1px 6px; border-radius:8px; font-weight:700; font-family:var(--font-display); }
.w2h-badge.past{ background:#6E1818; color:#FFE08A; }
.w2h-badge.new{ background:#2A7060; color:#E8F4E8; }
.w2h-badge.d1{ background:#A8B5C8; color:#1C2535; }
.w2h-badge.d2{ background:#C9A227; color:#1C140A; }
.w2h-badge.d3{ background:#9C3030; color:#F5E6D3; }
.w2h-badge.d4{ background:#2C2E48; color:#F5E6D3; }
.w2h-trail{
  display:flex; flex-wrap:wrap; gap:4px;
  margin-top:6px;
}
.w2h-trail-dot{
  width:22px; height:22px;
  border-radius:50%;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:11px; font-weight:700;
  cursor:default;
}
.w2h-trail-ok{ background:var(--feicui,#2A7060); color:var(--mi-w); }
.w2h-trail-ng{ background:var(--zhusha,#9C3030); color:var(--mi-w); }

/* ─ presence detail modal close ──────────────────────────────────────── */
.modal-close{
  margin-left:auto;
  background:transparent; border:none;
  color:var(--mi-w);
  font-size:18px; cursor:pointer;
  padding:0 4px;
}

/* tile 변형 (2시간전사) */
.tile.warrior2h{
  background:linear-gradient(135deg, rgba(42,46,72,.92), rgba(28,30,48,.95));
  color:var(--mi-w,#FBF1DF);
  border:1.5px solid var(--huang-d,#9A7B1A);
}
.tile.warrior2h .han,
.tile.warrior2h .ttl,
.tile.warrior2h .desc{ color:inherit; }
.tile.warrior2h .desc{ color:rgba(245,230,211,.85); }

/* AI 옵션 토글 (battle lobby + cube lobby) */
.v96-ai-toggle{
  display:flex; align-items:center; gap:8px;
  padding:8px 10px;
  background:var(--mi,#F5E6D3);
  border:1px solid var(--gutong,#876A36);
  border-radius:6px;
  margin:6px 0;
}
.v96-ai-toggle label{
  display:inline-flex; align-items:center; gap:4px;
  cursor:pointer; font-size:12.5px;
}
.v96-ai-toggle .v96-ai-han{
  font-family:var(--font-display); color:var(--feicui,#2A7060);
  font-size:14px;
}
`;

if(typeof document !== 'undefined' && !document.getElementById('v96-css')){
  const s = document.createElement('style');
  s.id = 'v96-css';
  s.textContent = V96_CSS;
  document.head.appendChild(s);
}

window.addEventListener('beforeunload', () => {
  try{ if(window.V96Chat) V96Chat.unmountAll(); }catch(_){}
  try{ if(window.V96CardAI) V96CardAI.stop(); }catch(_){}
  try{ if(window.V96CubeAI) V96CubeAI.stop(); }catch(_){}
});

console.log('[v9.6] 확장 모듈 로드 완료 — 채팅·presence상세·2시간의전사·AI(card/cube)');

})();
