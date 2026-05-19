/* data-v14-graph.js — v14 「方鑑·關係圖」 SVG 콘텐츠 데이터
 * ============================================================================
 *  - 3개의 SVG 관계도 (表裏雙解劑 / 補益劑 / 章間連結)
 *  - 각 그래프는 raw SVG 문자열 + viewBox 메타데이터
 *  - SVG 안의 클래스(.node-rect, .edge-derive 등)는 bangje-v14-graph.js의 스타일 주입과 매칭
 *  - 원본: 방제학_관계도.html (사용자 제작)
 * ============================================================================ */
(function(){
'use strict';

const SVG_PYORI = `<svg viewBox="0 0 1600 1100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#b8521a"/>
      </marker>
      <marker id="arrow-jade" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#2e6b48"/>
      </marker>
    </defs>

    <!-- background zones for 3 categories -->
    <rect x="20" y="50" width="500" height="1020" fill="rgba(168,40,40,0.05)" stroke="rgba(168,40,40,0.3)" stroke-width="1" stroke-dasharray="3 5"/>
    <rect x="540" y="50" width="500" height="1020" fill="rgba(35,77,112,0.05)" stroke="rgba(35,77,112,0.3)" stroke-width="1" stroke-dasharray="3 5"/>
    <rect x="1060" y="50" width="520" height="1020" fill="rgba(184,82,26,0.05)" stroke="rgba(184,82,26,0.3)" stroke-width="1" stroke-dasharray="3 5"/>

    <text x="270" y="80" class="category-banner" font-size="20" fill="#a82828">解表攻裏劑</text>
    <text x="270" y="100" class="label-fn" fill="#a82828" font-size="11">해표 + 사하</text>

    <text x="790" y="80" class="category-banner" font-size="20" fill="#234d70">解表淸裏劑</text>
    <text x="790" y="100" class="label-fn" fill="#234d70" font-size="11">해표 + 청열</text>

    <text x="1320" y="80" class="category-banner" font-size="20" fill="#b8521a">解表溫裏劑</text>
    <text x="1320" y="100" class="label-fn" fill="#b8521a" font-size="11">해표 + 온리</text>

    <!-- ====== EDGES (drawn first so they're behind nodes) ====== -->

    <!-- 大柴胡湯 lineage -->
    <!-- 小柴胡湯 → 大柴胡湯 -->
    <path class="edge edge-derive" d="M 130 200 Q 250 250 270 280"/>
    <text x="200" y="225" class="edge-label">
      <tspan x="200" dy="-2" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">− 인삼·감초</tspan>
    </text>

    <!-- 小承氣湯 → 大柴胡湯 -->
    <path class="edge edge-derive" d="M 410 200 Q 340 250 320 280"/>
    <text x="380" y="225" class="edge-label">
      <tspan x="380" dy="-2" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">− 후박</tspan>
    </text>

    <!-- 大柴胡 → 復方大柴胡 -->
    <path class="edge edge-add" d="M 270 380 L 270 450"/>
    <text x="320" y="420" class="edge-label" fill="#2e6b48">+ 행기·청열</text>

    <!-- 防風通聖散 contains 多方 -->
    <path class="edge edge-contain" d="M 130 700 Q 200 720 230 740"/>
    <path class="edge edge-contain" d="M 130 780 Q 200 770 230 760"/>
    <path class="edge edge-contain" d="M 410 700 Q 340 720 310 740"/>
    <path class="edge edge-contain" d="M 410 780 Q 340 770 310 760"/>
    <path class="edge edge-contain" d="M 130 860 Q 200 830 230 800"/>
    <path class="edge edge-contain" d="M 410 860 Q 340 830 310 800"/>

    <!-- 葛根芩連湯 ~ 石膏湯 similarity -->
    <path class="edge edge-similar" d="M 720 320 Q 790 330 860 320"/>
    <text x="790" y="305" class="edge-label" fill="#5a2e6e">표한+리열</text>

    <!-- 黃連解毒湯 → 石膏湯 -->
    <path class="edge edge-derive" d="M 920 200 Q 880 230 870 280"/>
    <text x="890" y="240" class="edge-label">
      <tspan x="890" dy="0" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 석고·마황·향시</tspan>
    </text>

    <!-- 石膏湯 ~ 大靑龍湯 비교 -->
    <path class="edge edge-similar" d="M 870 380 Q 870 430 870 470"/>
    <text x="950" y="430" class="edge-label" fill="#5a2e6e">表實+裏熱</text>

    <!-- 理中湯 → 桂枝人蔘湯 -->
    <path class="edge edge-derive" d="M 1200 200 Q 1260 230 1310 280"/>
    <text x="1240" y="240" class="edge-label">
      <tspan x="1240" dy="0" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 계지</tspan>
    </text>

    <!-- 五積散 contains multiple base formulas -->
    <path class="edge edge-contain" d="M 1170 700 Q 1230 720 1290 740"/>
    <path class="edge edge-contain" d="M 1170 780 Q 1230 770 1290 760"/>
    <path class="edge edge-contain" d="M 1470 700 Q 1410 720 1350 740"/>
    <path class="edge edge-contain" d="M 1470 780 Q 1410 770 1350 760"/>
    <path class="edge edge-contain" d="M 1170 860 Q 1230 830 1290 800"/>
    <path class="edge edge-contain" d="M 1470 860 Q 1410 830 1350 800"/>

    <!-- 大柴胡 ~ 桂枝人蔘湯 비교 (太陽+陽明 vs 太陽+太陰) -->
    <path class="edge edge-similar" d="M 330 340 Q 800 360 1290 340"/>
    <text x="800" y="350" class="edge-label" fill="#5a2e6e">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">합병의 짝: 少陽·陽明 ↔ 太陽·太陰</tspan>
    </text>

    <!-- ====== NODES ====== -->

    <!-- 解表攻裏劑 zone -->
    <!-- 기원 -->
    <g>
      <rect class="node-rect node-base" x="60" y="160" width="140" height="50" rx="0"/>
      <text class="label-name" x="130" y="180" font-size="14">小柴胡湯</text>
      <text class="label-fn" x="130" y="198">시·금·반·강·조·삼·초</text>
    </g>
    <g>
      <rect class="node-rect node-base" x="340" y="160" width="140" height="50" rx="0"/>
      <text class="label-name" x="410" y="180" font-size="14">小承氣湯</text>
      <text class="label-fn" x="410" y="198">대황·지실·후박</text>
    </g>

    <!-- 大柴胡湯 (메인) -->
    <g>
      <rect class="node-rect node-main bigexam" x="180" y="280" width="200" height="80" rx="0"/>
      <text class="label-name" x="280" y="306" font-size="18">大柴胡湯</text>
      <text class="label-fn" x="280" y="326">和解少陽·內瀉熱結</text>
      <text class="label-meta" x="280" y="345">少陽+陽明合病 (8味)</text>
      <text class="exam-badge" x="370" y="298">★기출</text>
    </g>

    <!-- 復方大柴胡湯 -->
    <g>
      <rect class="node-rect node-sub" x="180" y="450" width="200" height="60" rx="0"/>
      <text class="label-name" x="280" y="473" font-size="14">復方大柴胡湯</text>
      <text class="label-fn" x="280" y="492">+천련자·연호삭·목향·포공영</text>
    </g>

    <!-- 防風通聖散 (메인) -->
    <g>
      <rect class="node-rect node-main bigexam" x="180" y="730" width="200" height="80" rx="0"/>
      <text class="label-name" x="280" y="756" font-size="18">防風通聖散</text>
      <text class="label-fn" x="280" y="776">疏風解表·瀉熱通便</text>
      <text class="label-meta" x="280" y="795">風熱·表裏俱實 (18味)</text>
      <text class="exam-badge" x="370" y="748">★기출</text>
    </g>

    <!-- 防風通聖 구성 처방들 (작은 노드) -->
    <g>
      <rect class="node-rect node-base" x="40" y="680" width="100" height="34" rx="0"/>
      <text class="label-name" x="90" y="700" font-size="11">川芎茶調散</text>
    </g>
    <g>
      <rect class="node-rect node-base" x="40" y="763" width="100" height="34" rx="0"/>
      <text class="label-name" x="90" y="783" font-size="11">白虎湯</text>
    </g>
    <g>
      <rect class="node-rect node-base" x="40" y="845" width="100" height="34" rx="0"/>
      <text class="label-name" x="90" y="865" font-size="11">凉膈散</text>
    </g>
    <g>
      <rect class="node-rect node-base" x="420" y="680" width="100" height="34" rx="0"/>
      <text class="label-name" x="470" y="700" font-size="11">調胃承氣湯</text>
    </g>
    <g>
      <rect class="node-rect node-base" x="420" y="763" width="100" height="34" rx="0"/>
      <text class="label-name" x="470" y="783" font-size="11">六一散</text>
    </g>
    <g>
      <rect class="node-rect node-base" x="420" y="845" width="100" height="34" rx="0"/>
      <text class="label-name" x="470" y="865" font-size="11">四物湯</text>
    </g>

    <!-- 함정 카드 22객 -->
    <g>
      <rect x="80" y="930" width="380" height="100" fill="#fff5e8" stroke="var(--red)" stroke-width="2" stroke-dasharray="5 3"/>
      <text x="270" y="952" class="label-name" font-size="13" fill="var(--red)">⚠ 22객 함정</text>
      <text x="270" y="975" class="label-fn" font-size="11">방풍통성산에 ‘없는’ 처방 = 곽향정기산</text>
      <text x="270" y="995" class="label-fn" font-size="11">★ 汗不傷表 · 下不傷裏 · 利不傷陰 · 寒不傷胃</text>
      <text x="270" y="1015" class="label-fn" font-size="10">5法: 汗·下·淸·利·補 共施</text>
    </g>

    <!-- 解表淸裏劑 zone -->
    <!-- 黃連解毒湯 -->
    <g>
      <rect class="node-rect node-base" x="850" y="160" width="140" height="50" rx="0"/>
      <text class="label-name" x="920" y="180" font-size="14">黃連解毒湯</text>
      <text class="label-fn" x="920" y="198">금·련·백·치</text>
    </g>

    <!-- 葛根芩連湯 -->
    <g>
      <rect class="node-rect node-main" x="600" y="280" width="200" height="80" rx="0"/>
      <text class="label-name" x="700" y="306" font-size="18">葛根芩連湯</text>
      <text class="label-fn" x="700" y="326">解表淸裏</text>
      <text class="label-meta" x="700" y="345">太陽+陽明 熱利 (4味)</text>
    </g>

    <!-- 石膏湯 -->
    <g>
      <rect class="node-rect node-main" x="770" y="280" width="200" height="80" rx="0" style="opacity:0"/>
      <!-- placeholder shifted -->
    </g>
    <g>
      <rect class="node-rect node-main bigexam" x="820" y="280" width="200" height="80" rx="0"/>
      <text class="label-name" x="920" y="306" font-size="18">石膏湯</text>
      <text class="label-fn" x="920" y="326">淸熱瀉火·發汗解表</text>
      <text class="label-meta" x="920" y="345">表證+裏熱熾 (7味)</text>
      <text class="exam-badge" x="1010" y="298">★15·16·21</text>
    </g>

    <!-- 大靑龍湯 비교 -->
    <g>
      <rect class="node-rect node-sub" x="820" y="470" width="200" height="55" rx="0"/>
      <text class="label-name" x="920" y="490" font-size="14">大靑龍湯</text>
      <text class="label-fn" x="920" y="510">麻黃湯+생강·대조·석고</text>
    </g>

    <!-- 비교 카드 -->
    <g>
      <rect x="600" y="600" width="420" height="90" fill="#fff5e8" stroke="var(--blue)" stroke-width="1.5"/>
      <text x="810" y="622" class="label-name" font-size="13" fill="var(--blue)">葛根芩連 vs 石膏湯</text>
      <text x="810" y="644" class="label-fn" font-size="10.5">葛根芩連: 太陽+陽明 熱利 (지사작용 강)</text>
      <text x="810" y="660" class="label-fn" font-size="10.5">石膏湯: 三焦熱 (마황+두시 ↔ 석고+삼황+치자)</text>
      <text x="810" y="676" class="label-fn" font-size="10.5">→ 상반상성: 발표해도 리열 안 돕고, 청리해도 표사 지장 없음</text>
    </g>

    <!-- 解表淸裏 22 객 -->
    <g>
      <rect x="600" y="730" width="420" height="80" fill="#fff5e8" stroke="var(--red)" stroke-width="2" stroke-dasharray="5 3"/>
      <text x="810" y="750" class="label-name" font-size="12" fill="var(--red)">⚠ 22객 함정</text>
      <text x="810" y="770" class="label-fn" font-size="10.5">석고탕: 석고·삼황·치자 + 마황·두시 배오</text>
      <text x="810" y="785" class="label-fn" font-size="10.5">→ 표사 안 잡혔는데 황련해독탕만 쓰면 攣急, 발한약만 쓰면 毒劇</text>
      <text x="810" y="800" class="label-fn" font-size="10.5">→ 표리분소·내외동치 필수</text>
    </g>

    <!-- 解表溫裏劑 zone -->
    <!-- 理中湯 (기원) -->
    <g>
      <rect class="node-rect node-base" x="1130" y="160" width="140" height="50" rx="0"/>
      <text class="label-name" x="1200" y="180" font-size="14">理中湯</text>
      <text class="label-fn" x="1200" y="198">출·삼·강·초</text>
    </g>

    <!-- 桂枝人蔘湯 -->
    <g>
      <rect class="node-rect node-main" x="1220" y="280" width="200" height="80" rx="0"/>
      <text class="label-name" x="1320" y="306" font-size="18">桂枝人蔘湯</text>
      <text class="label-fn" x="1320" y="326">解表溫裏·益氣消痞</text>
      <text class="label-meta" x="1320" y="345">太陽+太陰 (5味)</text>
    </g>

    <!-- 五積散 -->
    <g>
      <rect class="node-rect node-main bigexam" x="1220" y="730" width="200" height="80" rx="0"/>
      <text class="label-name" x="1320" y="752" font-size="17">五積散</text>
      <text class="label-fn" x="1320" y="772">發表溫裏·順氣化痰</text>
      <text class="label-fn" x="1320" y="787">活血消積·燥濕健脾</text>
      <text class="label-meta" x="1320" y="803">本寒 (17味)</text>
      <text class="exam-badge" x="1410" y="748">★기출</text>
    </g>

    <!-- 五積散 구성 처방 -->
    <g>
      <rect class="node-rect node-base" x="1080" y="680" width="100" height="34" rx="0"/>
      <text class="label-name" x="1130" y="700" font-size="11">麻黃湯·桂枝湯</text>
    </g>
    <g>
      <rect class="node-rect node-base" x="1080" y="763" width="100" height="34" rx="0"/>
      <text class="label-name" x="1130" y="783" font-size="11">平胃散</text>
    </g>
    <g>
      <rect class="node-rect node-base" x="1080" y="845" width="100" height="34" rx="0"/>
      <text class="label-name" x="1130" y="865" font-size="11">二陳湯</text>
    </g>
    <g>
      <rect class="node-rect node-base" x="1460" y="680" width="100" height="34" rx="0"/>
      <text class="label-name" x="1510" y="700" font-size="11">四物湯</text>
    </g>
    <g>
      <rect class="node-rect node-base" x="1460" y="763" width="100" height="34" rx="0"/>
      <text class="label-name" x="1510" y="783" font-size="11">감초건강탕</text>
    </g>
    <g>
      <rect class="node-rect node-base" x="1460" y="845" width="100" height="34" rx="0"/>
      <text class="label-name" x="1510" y="865" font-size="11">桔梗枳殼湯</text>
    </g>

    <!-- 22 객 오적 함정 -->
    <g>
      <rect x="1120" y="930" width="400" height="100" fill="#fff5e8" stroke="var(--red)" stroke-width="2" stroke-dasharray="5 3"/>
      <text x="1320" y="952" class="label-name" font-size="13" fill="var(--red)">⚠ 22객 함정 (오적 연결)</text>
      <text x="1320" y="975" class="label-fn" font-size="11">血積 = 궁귀탕 + 작약감초탕 ○</text>
      <text x="1320" y="995" class="label-fn" font-size="11">"氣積 = 궁귀탕+작약감초탕" ✗ (오답)</text>
      <text x="1320" y="1015" class="label-fn" font-size="10">한습에 금은화·연교 ✗</text>
    </g>

  </svg>`;

const SVG_BOIK = `<svg viewBox="0 0 1600 1450" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow-orange2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="#b8521a"/>
      </marker>
    </defs>

    <!-- background zones -->
    <rect x="20" y="50" width="780" height="1380" fill="rgba(184,134,11,0.04)" stroke="rgba(184,134,11,0.3)" stroke-width="1" stroke-dasharray="3 5"/>
    <rect x="820" y="50" width="760" height="1380" fill="rgba(150,50,88,0.04)" stroke="rgba(150,50,88,0.3)" stroke-width="1" stroke-dasharray="3 5"/>

    <text x="410" y="80" class="category-banner" font-size="22" fill="#b8860b">補氣劑</text>
    <text x="410" y="100" class="label-fn" fill="#b8860b" font-size="11">脾·肺氣虛</text>

    <text x="1200" y="80" class="category-banner" font-size="22" fill="#963258">補血劑</text>
    <text x="1200" y="100" class="label-fn" fill="#963258" font-size="11">心·肝·脾血虛</text>

    <!-- ============ EDGES ============ -->

    <!-- 理中湯 → 四君子湯 -->
    <path class="edge edge-derive" d="M 200 180 Q 280 215 360 250"/>
    <text x="280" y="200" class="edge-label">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">− 건강 + 복령</tspan>
    </text>

    <!-- 四君子 → 異功散 (+陳皮) -->
    <path class="edge edge-add" d="M 460 290 L 620 290"/>
    <text x="540" y="280" class="edge-label" fill="#2e6b48">+ 진피</text>

    <!-- 異功散 → 六君子 (+半夏) -->
    <path class="edge edge-add" d="M 730 320 Q 730 360 730 400"/>
    <text x="765" y="365" class="edge-label" fill="#2e6b48">+ 반하</text>

    <!-- 四君子 → 六君子 (+陳皮·半夏) shortcut -->
    <path class="edge edge-add" d="M 460 305 Q 540 340 620 420"/>
    <text x="510" y="350" class="edge-label" fill="#2e6b48">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 진피·반하</tspan>
    </text>

    <!-- 六君子 → 香砂六君子 (+木香·砂仁) -->
    <path class="edge edge-add" d="M 730 470 Q 730 510 730 550"/>
    <text x="775" y="515" class="edge-label" fill="#2e6b48">+ 목향·사인</text>

    <!-- 四君子 → 參苓白朮散 -->
    <path class="edge edge-add" d="M 360 320 Q 220 400 200 470"/>
    <text x="220" y="395" class="edge-label" fill="#2e6b48">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 산약·연자육</tspan>
      <tspan x="220" dy="12" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 편두·의이인</tspan>
      <tspan x="220" dy="12" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 사인·길경</tspan>
    </text>

    <!-- 四君子 → 補中益氣湯 (구성 변화) -->
    <path class="edge edge-derive" d="M 460 280 Q 540 280 540 280 Q 540 660 410 700"/>
    <text x="560" y="500" class="edge-label">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">− 복령</tspan>
      <tspan x="560" dy="14" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 황기·승마</tspan>
      <tspan x="560" dy="14" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 시호·당귀·진피</tspan>
    </text>

    <!-- 補中益氣 → 擧元煎 -->
    <path class="edge edge-derive" d="M 320 770 Q 240 800 200 840"/>
    <text x="220" y="800" class="edge-label">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">− 시·진·당귀</tspan>
    </text>

    <!-- 補中益氣 → 升陽益胃湯 -->
    <path class="edge edge-add" d="M 500 770 Q 600 810 680 840"/>
    <text x="640" y="810" class="edge-label" fill="#2e6b48">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 강독방·이진탕</tspan>
      <tspan x="640" dy="12" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 황련·작약·택사</tspan>
    </text>

    <!-- 補中益氣 → 升陷湯 -->
    <path class="edge edge-derive" d="M 320 770 Q 280 820 250 950"/>
    <text x="225" y="900" class="edge-label">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">− 인삼·당귀·백출·진피</tspan>
      <tspan x="225" dy="12" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 지모·길경</tspan>
    </text>

    <!-- 補中益氣 → 益氣聰明湯 -->
    <path class="edge edge-derive" d="M 410 770 Q 450 870 450 950"/>
    <text x="490" y="900" class="edge-label">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">− 시·진·당귀</tspan>
      <tspan x="490" dy="12" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">+ 작약·황백·갈근·만형자</tspan>
    </text>

    <!-- 補中益氣 → 李濟馬 보중익기탕 -->
    <path class="edge edge-derive" d="M 500 770 Q 550 870 620 950"/>
    <text x="585" y="870" class="edge-label">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">승마·시호 → 곽향·소엽</tspan>
      <tspan x="585" dy="12" style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">황기↑↑ (3돈)</tspan>
    </text>

    <!-- 玉屛風散 (독립) - similarity with 補中益氣 -->
    <path class="edge edge-similar" d="M 220 1080 Q 250 1140 320 1180"/>

    <!-- 生脈散 (독립) -->

    <!-- 膠艾湯 → 四物湯 -->
    <path class="edge edge-derive" d="M 1000 180 Q 1100 215 1200 250"/>
    <text x="1080" y="200" class="edge-label">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">− 아교·애엽·감초</tspan>
    </text>

    <!-- 四物湯 → 도홍사물탕 -->
    <path class="edge edge-add" d="M 1300 330 Q 1300 400 1300 460"/>
    <text x="1345" y="395" class="edge-label" fill="#2e6b48">+ 도인·홍화</text>

    <!-- 四物湯 → 금련사물탕 -->
    <path class="edge edge-add" d="M 1200 320 Q 1130 400 1080 460"/>
    <text x="1090" y="390" class="edge-label" fill="#2e6b48">+ 황금·황련</text>

    <!-- 四物湯 → 계부사물탕 -->
    <path class="edge edge-add" d="M 1400 320 Q 1470 400 1500 460"/>
    <text x="1500" y="390" class="edge-label" fill="#2e6b48">+ 부자·육계</text>

    <!-- 四物湯 + 四君子湯 = 팔진탕 -->
    <path class="edge edge-add" d="M 410 310 Q 800 600 1300 530"/>
    <text x="900" y="450" class="edge-label" fill="#2e6b48" font-size="11">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:5">四物 + 四君子 = 八珍湯 (氣血雙補)</tspan>
    </text>

    <!-- 黃芪 (李東垣) → 當歸補血湯 -->
    <path class="edge edge-derive" d="M 1300 800 Q 1300 860 1300 900"/>
    <text x="1370" y="860" class="edge-label">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">황기:당귀 = 5:1</tspan>
    </text>

    <!-- 백호탕 vs 당귀보혈탕 비교 -->
    <path class="edge edge-similar" d="M 1100 970 Q 1200 970 1280 970"/>
    <text x="1190" y="958" class="edge-label" fill="#5a2e6e">유사한 듯 정반대</text>

    <!-- ============ NODES ============ -->

    <!-- 補氣劑 zone -->
    <!-- 理中湯 (기원) -->
    <g>
      <rect class="node-rect node-base" x="130" y="160" width="140" height="50"/>
      <text class="label-name" x="200" y="180" font-size="14">理中湯</text>
      <text class="label-fn" x="200" y="198">백출·인삼·건강·감초</text>
    </g>

    <!-- 四君子湯 -->
    <g>
      <rect class="node-rect node-main bigexam" x="350" y="250" width="220" height="80"/>
      <text class="label-name" x="460" y="278" font-size="18">四君子湯</text>
      <text class="label-fn" x="460" y="298">益氣健脾 · 補氣 基礎方</text>
      <text class="label-meta" x="460" y="316">人·朮·苓·草 (4味)</text>
      <text class="exam-badge" x="558" y="266">★22객</text>
    </g>

    <!-- 異功散 -->
    <g>
      <rect class="node-rect node-sub" x="620" y="270" width="170" height="40"/>
      <text class="label-name" x="705" y="288" font-size="13">異功散</text>
      <text class="label-fn" x="705" y="304">益氣健脾+行氣化滯</text>
    </g>

    <!-- 六君子湯 -->
    <g>
      <rect class="node-rect node-sub" x="620" y="410" width="170" height="50"/>
      <text class="label-name" x="705" y="430" font-size="13">六君子湯</text>
      <text class="label-fn" x="705" y="448">+ 燥濕化痰</text>
    </g>

    <!-- 香砂六君子湯 -->
    <g>
      <rect class="node-rect node-sub" x="620" y="555" width="170" height="50"/>
      <text class="label-name" x="705" y="575" font-size="13">香砂六君子湯</text>
      <text class="label-fn" x="705" y="593">益氣化痰+行氣溫中</text>
    </g>

    <!-- 參苓白朮散 -->
    <g>
      <rect class="node-rect node-main bigexam" x="80" y="470" width="240" height="80"/>
      <text class="label-name" x="200" y="496" font-size="17">參苓白朮散</text>
      <text class="label-fn" x="200" y="516">益氣健脾·滲濕止瀉</text>
      <text class="label-meta" x="200" y="534">脾胃氣虛挾濕 (10味)</text>
      <text class="exam-badge" x="305" y="486">★22객</text>
    </g>

    <!-- 補中益氣湯 -->
    <g>
      <rect class="node-rect node-main bigexam" x="290" y="700" width="220" height="80"/>
      <text class="label-name" x="400" y="726" font-size="17">補中益氣湯</text>
      <text class="label-fn" x="400" y="745">補中益氣·昇陽擧陷</text>
      <text class="label-fn" x="400" y="760">甘溫除熱</text>
      <text class="label-meta" x="400" y="775">中氣下陷 (8味)</text>
      <text class="exam-badge" x="497" y="716">★다출</text>
    </g>

    <!-- 擧元煎 -->
    <g>
      <rect class="node-rect node-sub" x="90" y="840" width="160" height="55"/>
      <text class="label-name" x="170" y="860" font-size="13">擧元煎</text>
      <text class="label-fn" x="170" y="878">益氣擧陷 (혈붕혈탈)</text>
    </g>

    <!-- 升陽益胃湯 -->
    <g>
      <rect class="node-rect node-sub" x="600" y="840" width="190" height="55"/>
      <text class="label-name" x="695" y="860" font-size="13">升陽益胃湯</text>
      <text class="label-fn" x="695" y="878">益氣昇陽·淸熱除濕</text>
    </g>

    <!-- 升陷湯 -->
    <g>
      <rect class="node-rect node-sub" x="150" y="950" width="170" height="55"/>
      <text class="label-name" x="235" y="970" font-size="13">升陷湯</text>
      <text class="label-fn" x="235" y="988">大氣下陷 · +지모</text>
    </g>

    <!-- 益氣聰明湯 -->
    <g>
      <rect class="node-rect node-sub" x="350" y="950" width="200" height="55"/>
      <text class="label-name" x="450" y="970" font-size="13">益氣聰明湯</text>
      <text class="label-fn" x="450" y="988">+ 작약·황백·갈근·만형자</text>
    </g>

    <!-- 李濟馬 보중익기탕 -->
    <g>
      <rect class="node-rect node-sub" x="570" y="950" width="200" height="55"/>
      <text class="label-name" x="670" y="968" font-size="13">補中益氣湯 (소음인)</text>
      <text class="label-fn" x="670" y="985">승·시→곽향·소엽, 황기 3돈</text>
    </g>

    <!-- 玉屛風散 -->
    <g>
      <rect class="node-rect node-main" x="100" y="1080" width="220" height="80"/>
      <text class="label-name" x="210" y="1106" font-size="17">玉屛風散</text>
      <text class="label-fn" x="210" y="1126">益氣固表止汗</text>
      <text class="label-meta" x="210" y="1144">황기·백출·방풍 (3味)</text>
    </g>

    <!-- 生脈散 -->
    <g>
      <rect class="node-rect node-main" x="420" y="1080" width="220" height="80"/>
      <text class="label-name" x="530" y="1106" font-size="17">生脈散</text>
      <text class="label-fn" x="530" y="1126">益氣生津·斂陰止汗</text>
      <text class="label-meta" x="530" y="1144">人蔘·麥門冬·五味子 (3味)</text>
    </g>

    <!-- 人蔘蛤蚧散 -->
    <g>
      <rect class="node-rect node-sub" x="100" y="1200" width="240" height="55"/>
      <text class="label-name" x="220" y="1220" font-size="13">人蔘蛤蚧散</text>
      <text class="label-fn" x="220" y="1238">補肺益腎·止咳定喘</text>
    </g>

    <!-- 백호탕 (비교용) -->
    <g>
      <rect class="node-rect node-base" x="930" y="945" width="160" height="50"/>
      <text class="label-name" x="1010" y="965" font-size="14">白虎湯</text>
      <text class="label-fn" x="1010" y="983">실열·맥홍대유력</text>
    </g>

    <!-- 補氣劑 핵심 카드 -->
    <g>
      <rect x="100" y="1300" width="690" height="120" fill="#fff5e8" stroke="var(--red)" stroke-width="2" stroke-dasharray="5 3"/>
      <text x="445" y="1322" class="label-name" font-size="13" fill="var(--red)">⚠ 補氣劑 시험 핵심</text>
      <text x="445" y="1344" class="label-fn" font-size="11">사군자탕 ‘아닌 것’ = 黃芪 | 향사육군자탕 작용 = 益氣化痰·行氣溫中</text>
      <text x="445" y="1362" class="label-fn" font-size="11">참령백출산 적응증 ‘아닌 것’ = 心悸不眠 | 養氣育神·醒脾悅色·順正辟邪</text>
      <text x="445" y="1380" class="label-fn" font-size="11">생맥산 대체: 인삼·오미자 → 白朮·烏梅 (의학입문)</text>
      <text x="445" y="1398" class="label-fn" font-size="11">소음인 보중익기탕: 승마·시호 → 藿香·蘇葉 / 황기 3돈</text>
    </g>

    <!-- 補血劑 zone -->
    <!-- 膠艾湯 -->
    <g>
      <rect class="node-rect node-base" x="930" y="160" width="140" height="50"/>
      <text class="label-name" x="1000" y="180" font-size="14">膠艾湯</text>
      <text class="label-fn" x="1000" y="198">『金匱要略』</text>
    </g>

    <!-- 四物湯 -->
    <g>
      <rect class="node-rect node-main bigexam" x="1200" y="250" width="220" height="80"/>
      <text class="label-name" x="1310" y="276" font-size="18">四物湯</text>
      <text class="label-fn" x="1310" y="296">補血和血 · 補血 基礎方</text>
      <text class="label-meta" x="1310" y="314">熟·歸·芍·芎 (4味)</text>
      <text class="exam-badge" x="1410" y="266">★기출多</text>
    </g>

    <!-- 도홍사물탕 -->
    <g>
      <rect class="node-rect node-sub" x="1200" y="460" width="200" height="55"/>
      <text class="label-name" x="1300" y="480" font-size="13">桃紅四物湯</text>
      <text class="label-fn" x="1300" y="498">活血化瘀 기본방</text>
    </g>

    <!-- 금련사물탕 -->
    <g>
      <rect class="node-rect node-sub" x="970" y="460" width="160" height="55"/>
      <text class="label-name" x="1050" y="480" font-size="13">芩連四物湯</text>
      <text class="label-fn" x="1050" y="498">血虛 + 熱</text>
    </g>

    <!-- 계부사물탕 -->
    <g>
      <rect class="node-rect node-sub" x="1430" y="460" width="160" height="55"/>
      <text class="label-name" x="1510" y="480" font-size="13">桂附四物湯</text>
      <text class="label-fn" x="1510" y="498">血虛 + 寒</text>
    </g>

    <!-- 八珍湯 (氣血雙補) - 다리 -->
    <g>
      <rect class="node-rect node-sub" x="1200" y="555" width="220" height="55" fill="#fff0e0" stroke="var(--orange)" stroke-width="2"/>
      <text class="label-name" x="1310" y="575" font-size="14">八珍湯</text>
      <text class="label-fn" x="1310" y="593">四物 + 四君子 = 氣血雙補</text>
    </g>

    <!-- 黃芪 (개념) -->
    <g>
      <rect class="node-rect node-base" x="1230" y="750" width="160" height="50"/>
      <text class="label-name" x="1310" y="770" font-size="14">李東垣의 着眼</text>
      <text class="label-fn" x="1310" y="788">陽生陰長·無形→有形</text>
    </g>

    <!-- 當歸補血湯 -->
    <g>
      <rect class="node-rect node-main bigexam" x="1200" y="900" width="240" height="80"/>
      <text class="label-name" x="1320" y="928" font-size="17">當歸補血湯</text>
      <text class="label-fn" x="1320" y="947">補氣生血 · 甘溫除熱</text>
      <text class="label-meta" x="1320" y="965">黃芪 : 當歸 = 5 : 1</text>
      <text class="exam-badge" x="1430" y="918">★매년</text>
    </g>

    <!-- 補血劑 핵심 카드 -->
    <g>
      <rect x="900" y="1080" width="680" height="180" fill="#fff5e8" stroke="var(--red)" stroke-width="2" stroke-dasharray="5 3"/>
      <text x="1240" y="1102" class="label-name" font-size="13" fill="var(--red)">⚠ 補血劑 시험 핵심</text>
      <text x="1240" y="1126" class="label-fn" font-size="11">四物湯 유래 = 膠艾湯 (-아교·애엽·감초)</text>
      <text x="1240" y="1144" class="label-fn" font-size="11">血中血藥: 熟地·芍藥 (음유·양혈렴음)</text>
      <text x="1240" y="1162" class="label-fn" font-size="11">血中氣藥: 當歸·川芎 (온통·활혈행기)</text>
      <text x="1240" y="1182" class="label-fn" font-size="11">도홍사물탕 主治 ‘아닌 것’ = 白帶腫大</text>
      <text x="1240" y="1202" class="label-fn" font-size="11">당귀보혈탕: 황기:당귀=5:1 / 작용=補氣生血</text>
      <text x="1240" y="1222" class="label-fn" font-size="11">白虎湯 vs 當歸補血湯: 둘 다 신열·번갈·맥홍대</text>
      <text x="1240" y="1240" class="label-fn" font-size="11">↳ 백호=洪大有力(실열), 보혈탕=大而虛 重按無力(허열) ⚠誤投必死</text>
    </g>

    <!-- 보익제 6분류 작은 다이어그램 -->
    <g>
      <rect x="900" y="1300" width="680" height="120" fill="#fdfaf2" stroke="var(--ink)" stroke-width="1.5"/>
      <text x="1240" y="1322" class="label-name" font-size="13">補益劑 六分類</text>
      <text x="930" y="1345" class="label-fn" font-size="11" text-anchor="start">氣虛 → 補氣劑 (사군자·삼령백출·보중익기·옥병풍·생맥)</text>
      <text x="930" y="1363" class="label-fn" font-size="11" text-anchor="start">血虛 → 補血劑 (사물·당귀보혈)</text>
      <text x="930" y="1381" class="label-fn" font-size="11" text-anchor="start">氣血兩虛 → 氣血雙補劑 (八珍·歸脾·十全大補)</text>
      <text x="930" y="1399" class="label-fn" font-size="11" text-anchor="start">陰虛 → 補陰劑 | 陽虛 → 補陽劑 | 陰陽兩虛 → 陰陽幷補劑</text>
    </g>

  </svg>`;

const SVG_CONNECT = `<svg viewBox="0 0 1600 600" xmlns="http://www.w3.org/2000/svg">

    <!-- 두 영역 -->
    <rect x="40" y="50" width="700" height="520" fill="rgba(168,40,40,0.04)" stroke="rgba(168,40,40,0.3)" stroke-width="1" stroke-dasharray="3 5"/>
    <rect x="860" y="50" width="700" height="520" fill="rgba(184,134,11,0.04)" stroke="rgba(184,134,11,0.3)" stroke-width="1" stroke-dasharray="3 5"/>

    <text x="390" y="80" class="category-banner" font-size="20" fill="#a82828">表裏雙解劑</text>
    <text x="1210" y="80" class="category-banner" font-size="20" fill="#b8860b">補益劑</text>

    <!-- 연결선들 -->

    <!-- 방풍통성산 ↔ 사물탕 -->
    <path class="edge edge-contain" d="M 380 250 Q 770 280 1180 280"/>
    <text x="780" y="265" class="edge-label" fill="#b8860b">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">방풍통성산 안에 四物湯 들어있음</tspan>
    </text>

    <!-- 방풍통성산 ↔ 보중익기 (한열 대비) -->
    <path class="edge edge-similar" d="M 380 280 Q 770 380 1180 380"/>
    <text x="780" y="370" class="edge-label" fill="#5a2e6e">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">현곡 3대 통치방: 본열↔본허 (방풍통성↔이음전)</tspan>
    </text>

    <!-- 오적산 ↔ 사물탕 -->
    <path class="edge edge-contain" d="M 380 350 Q 770 420 1180 420"/>
    <text x="770" y="425" class="edge-label" fill="#b8860b">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">오적산 血積 = 궁귀탕 (사물탕 계열)</tspan>
    </text>

    <!-- 계지인삼탕 ↔ 사군자탕 -->
    <path class="edge edge-similar" d="M 380 450 Q 770 470 1180 470"/>
    <text x="770" y="478" class="edge-label" fill="#5a2e6e">
      <tspan style="paint-order:stroke;stroke:#fffdf6;stroke-width:4">계지인삼탕 = 이중탕+계지 ≈ 사군자에서 분기</tspan>
    </text>

    <!-- 노드들 (간략) -->
    <g>
      <rect class="node-rect node-main" x="200" y="220" width="180" height="55"/>
      <text class="label-name" x="290" y="240" font-size="14">防風通聖散</text>
      <text class="label-fn" x="290" y="260">本熱 통치방</text>
    </g>
    <g>
      <rect class="node-rect node-main" x="200" y="320" width="180" height="55"/>
      <text class="label-name" x="290" y="340" font-size="14">五積散</text>
      <text class="label-fn" x="290" y="360">本寒 통치방</text>
    </g>
    <g>
      <rect class="node-rect node-main" x="200" y="420" width="180" height="55"/>
      <text class="label-name" x="290" y="440" font-size="14">桂枝人蔘湯</text>
      <text class="label-fn" x="290" y="460">理中湯+桂枝</text>
    </g>

    <g>
      <rect class="node-rect node-main" x="1180" y="220" width="200" height="55"/>
      <text class="label-name" x="1280" y="240" font-size="14">四物湯</text>
      <text class="label-fn" x="1280" y="260">補血 基礎方</text>
    </g>
    <g>
      <rect class="node-rect node-main" x="1180" y="320" width="200" height="55"/>
      <text class="label-name" x="1280" y="340" font-size="14">補中益氣湯 / 利陰煎</text>
      <text class="label-fn" x="1280" y="360">本虛 통치방</text>
    </g>
    <g>
      <rect class="node-rect node-main" x="1180" y="420" width="200" height="55"/>
      <text class="label-name" x="1280" y="440" font-size="14">四君子湯</text>
      <text class="label-fn" x="1280" y="460">補氣 基礎方 (이중탕−건강+복령)</text>
    </g>

    <!-- 통치방 요약 -->
    <g>
      <rect x="500" y="510" width="600" height="50" fill="#fff5e8" stroke="var(--purple)" stroke-width="1.5"/>
      <text x="800" y="530" class="label-name" font-size="13" fill="var(--purple)">『東醫臨床方劑學』 三大 通治方</text>
      <text x="800" y="548" class="label-fn" font-size="11">本寒 → 五積散  ·  本熱 → 防風通聖散  ·  本虛 → 利陰煎(補益)</text>
    </g>

  </svg>`;

window.V14_GRAPHS = {
  pyori: {
    title: '表裏雙解劑',
    subtitle: '汗法 + 下·淸·溫法 결합 · 表裏同病 치료',
    color: 'red',
    viewBox: '0 0 1600 1100',
    svg: SVG_PYORI,
  },
  boik: {
    title: '補益劑',
    subtitle: '氣血兩虛 · 陰陽兩虛 — 처방 파생의 系譜',
    color: 'gold',
    viewBox: '0 0 1600 1450',
    svg: SVG_BOIK,
  },
  connect: {
    title: '章 間 連結 · 全體 觀',
    subtitle: '7장 表裏雙解劑 ↔ 8장 補益劑 ─ 三大 通治方',
    color: 'purple',
    viewBox: '0 0 1600 600',
    svg: SVG_CONNECT,
  },
};

console.log('[v14 關係圖] graph data loaded · 3 graphs (pyori/boik/connect)');

})();
