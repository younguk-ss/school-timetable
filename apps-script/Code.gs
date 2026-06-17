/**
 * 장흥관산중학교 - 이번주 시간표 송출 앱 (Google Apps Script 웹앱)
 * --------------------------------------------------------------
 * - 스프레드시트의 "이번주 시간표" 시트(맨 왼쪽 탭)를 실시간으로 읽어 1920x1080 화면에 송출
 * - 셀에 적용된 배경색/글자색을 그대로 가져와 교과목별 색을 자동 일치
 * - 교과목을 시트에서 수정하면 새로고침(자동 폴링) 시 바로 반영
 *
 * [2026-06-17 수정] sheet.getMergedRanges() → rng.getMergedRanges()
 *   getMergedRanges()는 Sheet가 아니라 Range의 메서드이므로,
 *   getDataRange()로 얻은 rng(Range)에 호출해야 한다.
 */

var CONFIG = {
  // 데이터베이스가 되는 스프레드시트 ID (URL의 /d/ 와 /edit 사이 값)
  SPREADSHEET_ID: '1G5XMHgQXd86CDg6PKhPML-Ra3z_JoCl0TbFx2y_0Bho',

  // 특정 시트명을 강제로 지정하고 싶으면 여기에 입력 (비워두면 자동 감지)
  SHEET_NAME: '',

  // 학교 로고 이미지의 Google Drive 파일 ID (선택)
  //  - 드라이브에 로고를 올린 뒤, 그 파일의 "공유 > 링크가 있는 모든 사용자(보기)" 설정 후
  //    링크의 /d/ 뒤 ID를 여기에 붙여넣으면 로고가 자동 삽입됩니다.
  //  - 비워두면 깔끔한 텍스트형 대체 엠블럼이 표시됩니다.
  LOGO_FILE_ID: '',

  // 학교 이름 (헤더 표기용)
  SCHOOL_NAME: '장흥관산중학교',

  // 화면 자동 새로고침 주기(초). 시트 수정 후 이 시간 내에 화면에 반영됩니다.
  REFRESH_SECONDS: 20
};

/**
 * 웹앱 진입점
 * - 기본: HTML 화면(google.script.run 버전)
 * - ?format=json: 시간표 데이터를 JSON으로 반환
 *   → Vercel 서버리스 프록시(/api/timetable)가 서버측에서 이 JSON을 받아가
 *     DIDMATE 기기가 구글 인증서를 신뢰할 필요 없이 색상·병합까지 그대로 표시하게 함.
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.format === 'json') {
    return ContentService
      .createTextOutput(JSON.stringify(getTimetable()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(CONFIG.SCHOOL_NAME + ' 이번주 시간표')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** 설정값을 클라이언트로 전달 */
function getConfig() {
  return {
    schoolName: CONFIG.SCHOOL_NAME,
    refreshSeconds: CONFIG.REFRESH_SECONDS
  };
}

/** 스프레드시트 핸들 얻기 (ID로만 열기 — openById에 필요한 전체 spreadsheets 권한 사용) */
function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/** 대상 시트 선택: (1) 지정명 → (2) A1에 '이번주' 포함된 시트 → (3) 맨 왼쪽 시트 */
function getTargetSheet_(ss) {
  if (CONFIG.SHEET_NAME) {
    var named = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (named) return named;
  }
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var a1 = String(sheets[i].getRange(1, 1).getDisplayValue() || '');
    if (a1.indexOf('이번주') !== -1) return sheets[i];
  }
  return sheets[0];
}

/**
 * 시간표 데이터 모델 생성.
 * 셀 값/배경색/글자색/굵기 + 병합정보 + 구조(요일그룹, 교시행 등)를 함께 반환.
 */
function getTimetable() {
 try {
  var ss = getSpreadsheet_();
  if (!ss) return { error: '스프레드시트를 열 수 없습니다. SPREADSHEET_ID 또는 접근 권한을 확인하세요.' };
  var sheet = getTargetSheet_(ss);
  if (!sheet) return { error: '시트를 찾을 수 없습니다.' };
  var rng = sheet.getDataRange();

  var values = rng.getDisplayValues();
  var bg = rng.getBackgrounds();
  var fc = rng.getFontColors();
  var fw = rng.getFontWeights();
  var fi = rng.getFontStyles();

  var numRows = values.length;
  var numCols = numRows ? values[0].length : 0;

  // 병합 셀 정보 (0-based)
  // ⚠️ getMergedRanges()는 Range의 메서드 → rng로 호출해야 함 (sheet로 호출 시 오류)
  var merges = rng.getMergedRanges().map(function (r) {
    return { r: r.getRow() - 1, c: r.getColumn() - 1, rs: r.getNumRows(), cs: r.getNumColumns() };
  });

  var DAYS = ['월', '화', '수', '목', '금', '토', '일'];

  // 1) 요일 헤더 행 찾기
  var dayRow = -1;
  for (var r = 0; r < numRows; r++) {
    var hit = 0;
    for (var c = 0; c < numCols; c++) {
      var v = (values[r][c] || '').trim();
      if (DAYS.indexOf(v) !== -1) hit++;
    }
    if (hit >= 3) { dayRow = r; break; }
  }

  var gradeRow = (dayRow >= 0) ? dayRow + 1 : -1;

  // 2) 참고사항(비고) 시작 열 찾기
  var notesStartCol = numCols;
  if (dayRow >= 0) {
    for (var c = 0; c < numCols; c++) {
      if ((values[dayRow][c] || '').indexOf('참고') !== -1) { notesStartCol = c; break; }
    }
  }

  // 3) 요일 그룹 만들기 (요일명이 등장하는 열 = 시작열, 다음 시작열까지가 span)
  var dayStarts = [];
  if (dayRow >= 0) {
    for (var c = 1; c < notesStartCol; c++) {
      var dv = (values[dayRow][c] || '').trim();
      if (DAYS.indexOf(dv) !== -1) dayStarts.push({ name: dv, start: c });
    }
  }
  var dayGroups = [];
  for (var i = 0; i < dayStarts.length; i++) {
    var start = dayStarts[i].start;
    var next = (i + 1 < dayStarts.length) ? dayStarts[i + 1].start : notesStartCol;
    var span = Math.max(1, next - start);
    var grades = [];
    for (var g = 0; g < span; g++) {
      grades.push((gradeRow >= 0 ? (values[gradeRow][start + g] || '') : '').trim());
    }
    dayGroups.push({ name: dayStarts[i].name, start: start, span: span, grades: grades });
  }

  // 4) 교시(본문) 행 찾기: 교시 라벨이 있거나, 요일 영역에 내용이 있는 행
  var bodyRows = [];
  var firstDataRow = (gradeRow >= 0) ? gradeRow + 1 : 0;
  for (var r = firstDataRow; r < numRows; r++) {
    var labelA = (values[r][0] || '').trim();
    var hasContent = false;
    for (var c = 1; c < notesStartCol; c++) {
      if ((values[r][c] || '').trim() !== '') { hasContent = true; break; }
    }
    if (/교시/.test(labelA) || hasContent) bodyRows.push(r);
  }

  // 5) 참고사항 모으기 (notesStartCol 이후 비어있지 않은 셀)
  var notes = [];
  var seen = {};
  for (var r = 0; r < numRows; r++) {
    for (var c = notesStartCol; c < numCols; c++) {
      var v = (values[r][c] || '').trim();
      if (v && !seen[v]) { seen[v] = true; notes.push(v); }
    }
  }

  return {
    title: (values[0] && values[0][0] ? values[0][0] : '').trim(),
    schoolName: CONFIG.SCHOOL_NAME,
    numRows: numRows,
    numCols: numCols,
    values: values,
    bg: bg,
    fontColor: fc,
    fontWeight: fw,
    fontStyle: fi,
    merges: merges,
    dayRow: dayRow,
    gradeRow: gradeRow,
    notesStartCol: notesStartCol,
    dayGroups: dayGroups,
    bodyRows: bodyRows,
    notes: notes,
    sheetName: sheet.getName()
  };
 } catch (e) {
  return { error: (e && e.message) ? e.message : String(e) };
 }
}

/** 로고를 Drive에서 읽어 base64 data URI로 반환 (없으면 빈 문자열) */
function getLogoDataUri() {
  if (!CONFIG.LOGO_FILE_ID) return '';
  try {
    var blob = DriveApp.getFileById(CONFIG.LOGO_FILE_ID).getBlob();
    var ct = blob.getContentType() || 'image/png';
    return 'data:' + ct + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    return '';
  }
}
