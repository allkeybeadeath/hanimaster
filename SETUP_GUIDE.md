# 한의학 마스터 — 배포·확장 안내

대상: CIM Lab. 현재 `paideia-bangje-v1` (방제학 PWA) 가 시험(5/20) 직전 단계. 이후 다음 두 가지 방향으로 진화:

1. **앱 이름 변경**: paideia-bangje → **한의학 마스터 (Korean Medicine Master)**
2. **과목 선택 구조**: 방제학 외 다른 과목(본초학·진단학·생리학·병리학 등)을 같은 PWA 안에서 선택 가능하게
3. **명예의 전당 + 멀티배틀** 기능 추가 (Firebase 필요)

이 문서는 사용자가 직접 해야 할 GitHub·Firebase 작업 정리. 코드 측 작업은 v2 라운드에서 진행.

---

## A. GitHub 설정 (지금 해도 되고, v2 시작할 때 해도 됨)

### A-1. 저장소 생성 (한 번만)

1. https://github.com 로그인 (CIM Lab 공용 계정 또는 사용자 개인 계정)
2. 우상단 `+` → **New repository**
3. 입력:
   - Repository name: `kmm` (Korean Medicine Master 약자 — 짧을수록 URL 짧음. `korean-medicine-master` 도 가능하지만 GitHub Pages URL 이 길어짐)
   - Description: `한의학 마스터 — 한의대 시험 대비 PWA (CIM Lab)`
   - **Public** 선택 (Private 는 GitHub Pages 무료 플랜에서 작동 안 함)
   - "Add a README file" 체크 해제 (우리가 직접 푸시할 거라서)
4. `Create repository` 클릭

### A-2. 코드 푸시 (v1 도 v2 도 같은 절차)

zip 을 풀어서 그 안의 *내용물*(폴더가 아닌 파일들)을 저장소 루트에 올립니다.

**방법 1 — 웹 UI 드래그 (간단)**:
1. `paideia-bangje-v1.zip` 압축 풀기
2. 새로 만든 GitHub 저장소 페이지에서 "uploading an existing file" 링크 클릭
3. 압축 푼 폴더 안의 모든 파일(index.html, app.js, data-formulas.js, manifest.json, sw.js, icon.svg, icon-192.png, icon-512.png, apple-touch-icon.png) 드래그
4. 페이지 하단 "Commit changes" 클릭

**방법 2 — Git CLI (반복 작업에 편함)**:
```bash
# 압축 푼 폴더로 이동
cd paideia-bangje-v1
git init
git add .
git commit -m "Initial v1: 방제학 PWA"
git branch -M main
git remote add origin https://github.com/<USER>/kmm.git
git push -u origin main
```

### A-3. GitHub Pages 활성화 (한 번만)

1. 저장소 페이지 → **Settings** 탭
2. 좌측 메뉴 **Pages**
3. "Source" 섹션:
   - Branch: `main`
   - Folder: `/ (root)`
   - **Save** 클릭
4. 1~2 분 후 페이지 새로고침하면 상단에 *"Your site is live at https://&lt;USER&gt;.github.io/kmm/"* 표시
5. 그 URL 이 PWA 접속 주소. 모바일에서 그 URL 열고 → "홈 화면에 추가" → 앱처럼 사용

**중요**: GitHub Pages 는 HTTPS 자동 제공. PWA(Service Worker) 가 HTTPS 에서만 동작하므로 필수.

### A-4. 사용자 분배 흐름

CIM Lab 다수 사용자 → 위 URL 을 단톡방·노션·이메일로 공유 → 각자 휴대폰에서 접속 → 홈 화면에 추가 → 오프라인에서도 사용 (Service Worker 캐싱 덕분).

업데이트 시 사용자는 그냥 PWA 열면 자동으로 새 버전 받음 (sw.js 의 network-first 정책 덕분에 index.html 갱신 즉시 반영).

---

## B. Firebase 설정 (멀티배틀·명예의 전당 구현 시 필수)

### B-1. 프로젝트 생성 (한 번만)

1. https://console.firebase.google.com 접속, 구글 계정 로그인
2. **프로젝트 추가** (Create a project)
3. 입력:
   - 프로젝트 이름: `kmm-cimlab` (또는 원하는 이름)
   - 구글 애널리틱스: **사용 안 함** 선택 (학습 앱에는 불필요 + 개인정보 부담↓)
4. 1 분 대기 → "프로젝트가 준비되었습니다" → 계속

### B-2. Realtime Database 활성화 (멀티배틀·명예의전당용)

명예의 전당과 멀티 배틀은 **실시간 동기화**가 필요하므로 Cloud Firestore 가 아니라 **Realtime Database** 가 적합 (Greek paideia v59 도 동일 구조).

1. 좌측 메뉴 **빌드 → Realtime Database** 클릭
2. **데이터베이스 만들기**
3. 위치: `asia-southeast1 (싱가포르)` 선택 — 한국에서 가장 가까운 무료 리전
4. 보안 규칙: 일단 **테스트 모드로 시작** 선택 (30일간 누구나 읽기/쓰기. 그 안에 규칙 갱신)
5. **사용 설정**

### B-3. 보안 규칙 설정 (테스트 모드 만료 전에 필수)

좌측 메뉴 **Realtime Database → 규칙** 탭에서 아래 코드 붙여넣고 **게시**:

```json
{
  "rules": {
    "hallOfFame": {
      ".read": true,
      ".write": "newData.exists() && newData.hasChildren(['name','score','subject','timestamp']) && newData.child('name').isString() && newData.child('name').val().length <= 20 && newData.child('score').isNumber() && newData.child('score').val() <= 100"
    },
    "battles": {
      ".read": true,
      "$battleId": {
        ".write": "newData.exists() || data.exists()",
        ".validate": "newData.hasChildren(['createdAt','subject','status'])"
      }
    },
    "presence": {
      ".read": true,
      "$userId": {
        ".write": "auth == null || auth.uid == $userId"
      }
    }
  }
}
```

이 규칙은:
- **hallOfFame**: 누구나 읽기/쓰기 가능하되, 점수가 0-100 범위·이름 20자 이하 등 형식 강제 (악성 데이터 차단)
- **battles**: 누구나 읽기 가능, 쓰기는 필요한 필드 있을 때만
- **presence**: 자기 자신만 자기 상태 갱신 가능

### B-4. 웹 앱 등록 + 설정 값 받기

1. 좌측 상단 **프로젝트 설정** (톱니바퀴) 클릭
2. **일반** 탭 → "내 앱" 섹션 → **웹** 아이콘 (`</>` 모양) 클릭
3. 앱 닉네임: `kmm-web`
4. "Firebase 호스팅도 설정" **체크 해제** (GitHub Pages 쓸 거라서 불필요)
5. **앱 등록**
6. 표시되는 코드 블록에서 `firebaseConfig` 객체 복사:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "kmm-cimlab.firebaseapp.com",
     databaseURL: "https://kmm-cimlab-default-rtdb.asia-southeast1.firebasedatabase.app",
     projectId: "kmm-cimlab",
     storageBucket: "kmm-cimlab.appspot.com",
     messagingSenderId: "...",
     appId: "1:...:web:..."
   };
   ```
7. 이 값을 **다음 세션 첫 메시지에 그대로 붙여넣기** → v2 빌드 때 코드에 삽입함

**API 키 보안 우려**: Firebase 웹 API 키는 공개되어도 안전 (보안은 위의 .rules 규칙으로 함). GitHub public repo 에 그대로 커밋해도 무방.

### B-5. 비용

CIM Lab 학습용 사용량(수십명 동시 접속, 하루 수백 게임)은 **무료 플랜(Spark)** 한도 안. 한도 초과 가능성:
- 동시 접속 100명 이상
- 일일 다운로드 10GB 이상
- 일일 쓰기 100k 이상

→ 일반 사용 시 도달 불가. 만약 도달하면 자동으로 차단 (요금 청구되지 않음).

---

## C. 한의학 마스터 (v2) 청사진

### C-1. 디렉토리 구조 (예정)

```
kmm/
├── index.html              # 셸 (변경 없음)
├── app.js                  # 라우팅·상태 코어 (과목 선택 추가)
├── modules-common.js       # 플래시카드·퀴즈·SRS (과목 무관 공통)
├── modules-hof.js          # 명예의전당 (Firebase 의존)
├── modules-battle.js       # 멀티배틀 (Firebase 의존)
├── firebase-config.js      # Firebase 초기화 (B-4 값 삽입)
├── subjects/
│   ├── bangje.js           # 방제학 데이터 (현재 data-formulas.js)
│   ├── boncho.js           # 본초학 (추가 예정)
│   ├── diagnosis.js        # 진단학 (추가 예정)
│   └── ...
├── manifest.json
├── sw.js
└── icons/
```

홈 화면이 과목 선택 그리드로 변경됨 — 잠긴(아직 데이터 없는) 과목도 미리 표시.

### C-2. 데이터 스키마 (과목 무관 통일)

```js
// 각 subjects/*.js 가 다음 형식으로 export
window.SUBJECTS = window.SUBJECTS || {};
window.SUBJECTS.bangje = {
  id: 'bangje',
  name: '방제학',
  hanja: '方劑學',
  emoji: '🍵',
  description: '한약 처방 구성·작용·적응증',
  examDate: '2026-05-20',           // 선택. 없으면 카운트다운 미표시
  items: [...],                     // 처방·본초·증후 등 (subject 별 의미)
  itemSchema: 'formula',            // 'formula' | 'herb' | 'syndrome'
  pastExams: [...],
  compareGroups: [...],
  studyPlan: [...]
};
```

`itemSchema` 가 'formula' 면 처방 필드(작용/적응증/구성 etc.), 'herb' 면 본초 필드(성미/귀경/효능), 'syndrome' 면 증후 필드. 렌더링 모듈이 schema 별로 분기.

### C-3. 명예의 전당 데이터 모델 (Firebase RTDB)

```
hallOfFame/
  {pushId}/
    name: "익명123"             // 사용자가 입력
    subject: "bangje"           // 어느 과목
    scope: "all"                // 'all' | 'past' | 'wrong'
    score: 87                   // 0-100
    total: 30                   // 풀이한 문제 수
    correct: 26
    durationSec: 240
    timestamp: 1747890123
```

탑 리스트는 `subject + scope` 별로 상위 100 정렬 표시. 사용자가 객관식 퀴즈 결과 화면에서 "🏆 명예의 전당에 등록" 버튼 누르면 push.

### C-4. 멀티배틀 데이터 모델 (Firebase RTDB)

```
battles/
  {battleId}/                   // 6자리 코드 (사용자가 친구에게 공유)
    createdAt: 1747890000
    subject: "bangje"
    scope: "past"
    questions: [{...}, ...]     // 미리 생성된 문제 셋 (10문)
    status: "waiting" | "playing" | "done"
    players/
      {playerId}/
        name: "본2-AAA"
        currentQ: 3
        score: 2
        finishedAt: null
```

호스트가 방 만들면 6자리 코드 생성 → 친구가 코드 입력해 입장 → 양쪽 다 준비되면 시작 → 같은 문제 셋을 각자 풀고 결과 비교.

### C-5. 작업 분량 추정

| 작업 | 예상 시간 (1세션 = 약 4시간) |
|---|---|
| 디렉토리 재구성 + 과목 선택 홈 | 0.5 세션 |
| 명예의 전당 + Firebase 통합 | 0.5 세션 |
| 멀티배틀 (방 생성·입장·동기화) | 1 세션 |
| 본초학 데이터 수집·큐레이션 | 1~2 세션 (PDF 등 자료 필요) |
| UI 다듬기 + 테스트 | 0.5 세션 |
| **총합** | **3~4 세션** |

---

## D. 다음 세션 시작 전 사용자가 준비할 것

### 시험 전 (~5/20)
- v1 사용해서 시험 준비. GitHub 배포는 선택사항(zip 직접 풀어서 휴대폰에 옮겨도 됨)

### 시험 후 (v2 시작)
1. **GitHub 저장소 URL** (A-3 의 사이트 주소)
2. **Firebase 설정 객체** (B-4 의 firebaseConfig 코드 블록 전체)
3. **본초학·진단학 등 추가 과목 자료** (PDF·HWP·노트 무관)
4. **시험 일정** (있다면 — 각 과목별)
5. **명예의 전당 가시성 선호** — 익명 표시? 전체 공개? CIM Lab 한정?
6. **멀티배틀 UX 선호** — 동기형(같이 풀기) vs 비동기형(각자 풀고 점수 비교)

이 중 1·2 만 있어도 v2 골격 빌드는 가능. 3·4 는 데이터 추가용. 5·6 은 UX 정책.

---

## E. 잠재적 이슈

1. **Firebase 무료 한도** — CIM Lab 규모(수십 명)에선 거의 도달 불가. 단, 멀티배틀 봇이나 무한 루프 버그 있으면 한 명이 한도 다 소진 가능 → 코드에서 클라이언트 사이드 throttle 필수.

2. **GitHub Pages 빌드 지연** — push 후 1-5분 정도 반영 지연. 시험 직전 마지막 갱신은 시험 1시간 전엔 끝낼 것.

3. **iOS Safari PWA 제약** — Safari 는 Service Worker 캐시 용량 50MB 제한, localStorage 5MB. 본초학·진단학 추가하면 데이터가 커질 수 있어 IndexedDB 전환 검토.

4. **Firebase 익명 인증** — 사용자가 이름만 입력하고 게임할 수 있으나, 사칭 방지 원하면 익명 인증 추가 가능 (uid 기반 식별). 단순 학습 앱이라 일단 미적용.

5. **데이터 무결성** — 명예의 전당 점수 100점은 client-side 계산 후 push 되므로 이론상 조작 가능. 학습 앱에선 큰 문제 없으나, 신경 쓰이면 server-side validation (Firebase Cloud Functions) 추가 가능.
