# Vercel 프록시로 색상까지 연동하기 (DIDMATE 인증서 오류 우회 · B2)

DIDMATE 기기에서 `script.google.com`이 인증서 오류(`SEC_ERROR_UNKNOWN_ISSUER`)로 안 뜰 때,
**기기가 구글 인증서를 신뢰할 필요가 없도록** 구조를 바꾸는 방법입니다.

```
[기존/실패]  기기 ──HTTPS──▶ script.google.com           ❌ 구글 인증서 거부
[이 방법]   기기 ──HTTPS──▶ <프로젝트>.vercel.app/live   ✅ Vercel(Let's Encrypt) 인증서
                                  └ 서버에서 ──▶ Apps Script(?format=json)  ✅ Vercel이 대신 신뢰
```

색상·글꼴·병합셀이 **시트 그대로** 표시되고, 선생님이 시트만 고치면 약 20초 내 자동 반영됩니다.

---

## ⚠️ 먼저 확인 (중요)

이 우회책은 **기기가 Vercel의 인증서(Let's Encrypt)는 신뢰**해야 동작합니다.
- 기기 브라우저로 아무 `https://example.com` 또는 배포한 `https://<프로젝트>.vercel.app` 페이지가 **정상으로 열리는지** 먼저 확인하세요.
- 만약 그것마저 같은 인증서 오류가 난다면 → 원인은 **기기 날짜/시간** 또는 **학교망 보안장비**입니다.
  먼저 `apps-script/README` 및 인증서 가이드의 1·2순위(시간 동기화 / 학교망 예외)를 해결해야 합니다.
- 빠른 판별: 기기를 **휴대폰 LTE 핫스팟**에 연결해 접속 → 되면 학교망 문제, 안 되면 기기 문제.

---

## 구성 파일

| 파일 | 역할 |
|------|------|
| `api/timetable.js` | Vercel 서버리스 프록시. 서버측에서 Apps Script JSON을 받아 기기에 전달 |
| `live.html` | 색상·병합을 그리는 화면. `/api/timetable`에서 데이터를 받아옴 |
| `apps-script/Code.gs` | `?format=json` 요청 시 시간표 JSON 반환(doGet 분기) |
| `vercel.json` | `/api/timetable` 캐시 no-store (이미 설정됨) |

---

## 설치 순서

### 1단계 — Apps Script를 JSON으로 배포
1. https://script.google.com 프로젝트에서 `apps-script/Code.gs` 최신본 반영(doGet에 `?format=json` 분기 포함).
2. **배포 → 새 배포 → 웹 앱**
   - 실행 계정: **나**
   - 액세스 권한: **모든 사용자(Anyone)**  ← 프록시가 서버에서 호출하려면 필수
3. 발급된 **웹앱 URL**(`https://script.google.com/macros/s/XXXXXXXX/exec`)을 복사.
4. 확인: 브라우저에서 그 URL 뒤에 `?format=json`을 붙여 열었을 때 **JSON 텍스트**가 나오면 정상.

### 2단계 — Vercel 환경변수 설정
1. Vercel 프로젝트 → **Settings → Environment Variables**
2. 추가:
   - Name: `APPS_SCRIPT_EXEC_URL`
   - Value: 1단계에서 복사한 `.../exec` URL (뒤에 `?format=json`은 붙이지 않아도 됨 — 프록시가 자동으로 붙임)
   - Environment: Production (필요시 Preview도)
3. 저장.

### 3단계 — 재배포
- 이 저장소를 GitHub에 push하면 Vercel이 자동 배포합니다.
- 환경변수는 추가 후 **반드시 한 번 Redeploy**(Deployments → 점3개 → Redeploy) 해야 적용됩니다.

### 4단계 — 확인 & 기기 연결
1. 브라우저에서 `https://<프로젝트>.vercel.app/api/timetable` → **JSON**이 나오면 프록시 정상.
2. `https://<프로젝트>.vercel.app/live` → 색상 시간표 화면이 뜨면 완성.
3. **DIDMATE 플레이어가 보는 주소를 `https://<프로젝트>.vercel.app/live` 로 변경.**

---

## 문제 해결

| 증상 | 원인/조치 |
|------|-----------|
| `/api/timetable`이 `APPS_SCRIPT_EXEC_URL 환경변수...` 오류 | 2단계 환경변수 미설정 또는 미재배포 |
| `Apps Script가 JSON이 아닌 응답...` 오류 | 웹앱을 "모든 사용자"로 재배포했는지, URL이 최신 `/exec`인지 확인 |
| 기기에서 `live`도 인증서 오류 | 기기가 Let's Encrypt도 거부 → 날짜/시간·학교망부터 해결(맨 위 "먼저 확인") |
| 로고가 텍스트("관산中")로 나옴 | `live.html`의 `LOGO_DATA_URI`에 base64 입력(선택) |

> 참고: Apps Script를 **다시 배포**해서 `/s/...` ID가 바뀌면, Vercel 환경변수 `APPS_SCRIPT_EXEC_URL`도 새 URL로 갱신 후 Redeploy 하세요.
