# 方劑學 v2.2

CIM Lab 방제학 학습 PWA · 中華 帝王風 · 51 의가 · 9 등급 · 멀티 對決

## 한 줄 시작

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

## v1 데이터 이식 (★ 첫 작업)

`data-formulas.js` 의 빈 배열에 v1.0 데이터 붙여넣기:
- `FORMULAS` (24 처방), `HERBS` (68 약재), `PAST_EXAMS` (23 기출)

스키마는 파일 상단 주석 참고. 채우는 즉시 모든 화면에 자동 반영.

## 시험일 변경

`app.js` 상단:
```js
const EXAM_DATE_ISO = '2026-05-20T00:00:00+09:00';
```

## 상세 문서

전체 구조·기능·Firebase 설정·디자인 시스템·인수 체크리스트는 **`HANDOVER.md`** 참고.

---

본 저장소는 CIM Lab 내부 학습용. 외부 공개 금지 (이순재 사진 fair-use 관련).
