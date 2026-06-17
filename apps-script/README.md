# 이번주 시간표 — Google Apps Script 웹앱 버전

장흥관산중학교 "이번주 시간표"를 Google 스프레드시트에서 **셀 배경색·글자색·병합까지 그대로** 읽어
1920×1080 화면(전광판/모니터)에 송출하는 임베드 앱입니다.

> 같은 저장소 루트의 `index.html`은 Vercel/GitHub Pages용 **CSV 연동 버전**입니다.
> 이 폴더(`apps-script/`)는 색상까지 그대로 가져오는 **Apps Script 연동 버전**입니다.

## 구성 파일

| 파일 | Apps Script 안에서의 이름 | 설명 |
|------|--------------------------|------|
| `Code.gs` | `Code.gs` | 서버 로직(시트 읽기 + 색상/병합 추출) |
| `Index.html` | `Index` (HTML 파일) | 화면 UI (`google.script.run`으로 서버 호출) |
| `appsscript.json` | 매니페스트 | 권한·실행 설정 |

## 2026-06-17 버그 수정

배포 시 발생한 오류:

```
시간표를 불러오지 못했습니다
원인: sheet.getMergedRanges is not a function
```

**원인:** `getMergedRanges()`는 `Sheet`(시트)가 아니라 `Range`(범위) 객체의 메서드입니다.
기존 코드는 `sheet.getMergedRanges()`로 호출해 오류가 났습니다.

**수정:** 이미 만들어 둔 `rng = sheet.getDataRange()`(Range)에 호출하도록 변경.

```js
// 변경 전 (오류)
var merges = sheet.getMergedRanges().map(...)
// 변경 후 (정상)
var merges = rng.getMergedRanges().map(...)
```

## JSON 출력 (Vercel 프록시 연동용)

`doGet(e)`는 `?format=json` 파라미터가 오면 HTML 대신 시간표 **JSON**을 반환합니다.
DIDMATE 기기의 인증서 오류(`SEC_ERROR_UNKNOWN_ISSUER`)를 우회하기 위해,
Vercel 서버리스 프록시(`/api/timetable`)가 서버측에서 이 JSON을 받아 기기에 전달합니다.
자세한 설정은 저장소 루트의 `VERCEL-색상연동-안내.md` 참고.

## 배포 방법

1. https://script.google.com 에서 새 프로젝트 생성 (또는 기존 프로젝트 열기)
2. `Code.gs` 내용을 붙여넣기
3. 파일 추가 → HTML → 이름을 **`Index`** 로 만들고 `Index.html` 내용 붙여넣기
4. 프로젝트 설정 → "appsscript.json 매니페스트 파일 표시" 켠 뒤 `appsscript.json` 내용 반영
5. `Code.gs`의 `CONFIG.SPREADSHEET_ID` 가 대상 스프레드시트 ID인지 확인
6. **배포 → 새 배포 → 웹 앱**
   - 실행 계정: **나(배포자)**
   - 액세스 권한: **모든 사용자**
7. 처음 배포 시 권한 승인(스프레드시트/드라이브 읽기) 진행
8. 발급된 웹앱 URL을 모니터 브라우저 또는 `<iframe>`으로 임베드

## 설정값 (`Code.gs` 상단 `CONFIG`)

| 키 | 의미 |
|----|------|
| `SPREADSHEET_ID` | 데이터 원본 스프레드시트 ID |
| `SHEET_NAME` | 특정 시트명 강제 지정(비우면 자동 감지) |
| `LOGO_FILE_ID` | 로고 이미지의 Drive 파일 ID(선택) |
| `SCHOOL_NAME` | 헤더에 표기할 학교 이름 |
| `REFRESH_SECONDS` | 자동 새로고침 주기(초) |

## 로고 표시

- `Index.html`의 `LOGO_DATA_URI` 에 base64 이미지를 붙여넣으면 최우선 사용
- 또는 `CONFIG.LOGO_FILE_ID` 에 Drive 파일 ID 지정
- 둘 다 비어 있으면 텍스트 엠블럼("관산中")이 표시됩니다
