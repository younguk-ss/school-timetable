// Vercel 서버리스 프록시 — DIDMATE 기기가 구글 인증서를 신뢰할 필요 없이
// 시간표(색상·병합 포함 JSON)를 받아오게 하는 핵심 파일.
//
//   DIDMATE 기기 ──HTTPS──▶ (Vercel, Let's Encrypt 인증서) /api/timetable
//                                   └─ 서버측에서 ──▶ Google Apps Script (?format=json)
//
// 기기는 Vercel 도메인만 신뢰하면 되고, 구글 접속·인증서 검증은 Vercel 서버가 대신 처리한다.
//
// 설정: Vercel 프로젝트 → Settings → Environment Variables 에
//   APPS_SCRIPT_EXEC_URL = https://script.google.com/macros/s/XXXXXXXX/exec
// 를 추가한 뒤 재배포(Redeploy)할 것. (apps-script 웹앱은 "모든 사용자" 접근으로 배포)

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const url = process.env.APPS_SCRIPT_EXEC_URL;
  if (!url) {
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: 'APPS_SCRIPT_EXEC_URL 환경변수가 설정되지 않았습니다. ' +
             'Vercel → Settings → Environment Variables 에 Apps Script /exec URL을 추가하고 재배포하세요.'
    }));
    return;
  }

  try {
    const sep = url.indexOf('?') === -1 ? '?' : '&';
    // Apps Script /exec 는 script.googleusercontent.com 으로 302 리다이렉트 → fetch가 자동 추적
    const r = await fetch(url + sep + 'format=json', {
      redirect: 'follow',
      headers: { 'Accept': 'application/json' }
    });
    const text = await r.text();

    // Apps Script가 권한/오류 시 HTML(로그인 페이지 등)을 줄 수 있으므로 JSON인지 확인
    try {
      JSON.parse(text);
    } catch (parseErr) {
      res.statusCode = 502;
      res.end(JSON.stringify({
        error: 'Apps Script가 JSON이 아닌 응답을 반환했습니다. 웹앱 접근 권한을 "모든 사용자"로 ' +
               '재배포했는지, APPS_SCRIPT_EXEC_URL이 최신 /exec 주소인지 확인하세요.'
      }));
      return;
    }

    res.statusCode = 200;
    res.end(text);
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: (e && e.message) ? e.message : String(e) }));
  }
};
