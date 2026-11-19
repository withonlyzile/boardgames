// Play with Zile: gửi mail cho chủ trang mỗi khi có người đăng nhập Google vào web.
// Chạy trên Google Apps Script bằng tài khoản chủ trang. Mail gửi về chính tài khoản đó.
// Trang web gửi mã đăng nhập Google, script kiểm tra mã với Google rồi mới gửi mail,
// nên người lạ không giả được thông báo.
var CLIENT_ID = '659838653690-lascndialv4sckc946pcla1osavt2q2s.apps.googleusercontent.com';
var SITE = 'https://withonlyzile.github.io/boardgames/';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(body.idToken || ''), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return reply('ma khong hop le');
    var info = JSON.parse(res.getContentText());
    if (info.aud !== CLIENT_ID || String(info.email_verified) !== 'true') return reply('ma khong dung trang');

    var props = PropertiesService.getScriptProperties();
    var key = 'u_' + info.sub;
    var lanDau = !props.getProperty(key);
    props.setProperty(key, new Date().toISOString());

    var gio = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'HH:mm dd/MM/yyyy');
    var ten = info.name || info.email;
    var tieuDe = 'Play with Zile: ' + ten + (lanDau ? ' đăng nhập lần đầu' : ' vừa đăng nhập');
    var noiDung = ten + ' vừa đăng nhập Play with Zile lúc ' + gio + '.\n' +
      'Email: ' + info.email + '\n' +
      (lanDau ? 'Đây là lần đầu tài khoản này vào web.\n' : '') +
      'Trang: ' + SITE + '\n';
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), tieuDe, noiDung);
    return reply('ok');
  } catch (err) {
    return reply('loi');
  }
}

function reply(t) {
  return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT);
}
