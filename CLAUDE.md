# Stroll Hub — Claude 운영 규칙

## 일정 추가 규칙

일정을 추가할 때는 **항상 아래 세 가지를 동시에 실행**한다:

1. `stroll-hub/src/data/notion.json`의 `schedule` 배열에 항목 추가
2. Google Calendar에 이벤트 등록 (시간대: Asia/Seoul)
   - 알림: **2일 전 popup**, **1일 전 popup**
   - 종일 이벤트(allDay: true)로 등록 (시간 미지정 시)
3. git commit & push → GitHub Actions가 Netlify 자동 배포

### Google Calendar 기본값
- 캘린더: strollpress.kr@gmail.com (primary)
- 알림: `[{ method: "popup", minutes: 2880 }, { method: "popup", minutes: 1440 }]`

---

## 대시보드 업데이트 규칙

"대시보드 업데이트해줘" 요청 시:
1. Notion MCP로 `collection://9261fb8f-171f-42c9-80f4-beb550c43536` 조회
2. notion.json 갱신 (synced_at 날짜 포함)
3. commit & push

---

## 프로젝트 구조

- 앱: `stroll-hub/` (Vite + React)
- 데이터: `stroll-hub/src/data/notion.json`
- 배포: Netlify `stroll-dashboard.netlify.app` (Site ID: `46c495b4-e57e-4211-a8cf-aeeab062fc3a`)
- 브랜치: `claude/cool-knuth-rClsT`

---

## PIN 잠금

- 파일: `stroll-hub/src/components/PinLock.jsx`
- PIN: `VITE_PIN` 환경변수 또는 코드 기본값
