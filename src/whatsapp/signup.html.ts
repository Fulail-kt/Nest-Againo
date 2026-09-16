export function embeddedSignupHtml(opts: {
  appId: string;
  configId: string;
  graphVersion: string;
  publicBase: string;
  redirectUri: string;
}) {
  const appId = json(opts.appId);
  const configId = json(opts.configId);
  const version = json(opts.graphVersion);
  const publicBase = json(opts.publicBase);
  const redirectUri = json(opts.redirectUri);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Connect WhatsApp</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:24px}
    button{background:#25D366;color:#111;border:0;border-radius:10px;padding:14px 18px;font-size:16px;width:100%}
    p{color:#aaa;line-height:1.4}
  </style>
</head>
<body>
  <p>Connect this shop to your WhatsApp Business account. Meta opens next.</p>
  <button id="go" type="button">Continue with Meta</button>
  <script>
    var APP_ID = ${appId};
    var CONFIG_ID = ${configId};
    var GRAPH = ${version};
    var PUBLIC_BASE = ${publicBase};
    var REDIRECT_URI = ${redirectUri};
    var session = null;
    var sent = false;
    function send(payload) {
      if (sent && payload.type === 'ok') return;
      if (payload.type === 'ok') sent = true;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }
    window.addEventListener('message', function (event) {
      if (event.origin.indexOf('facebook.com') === -1) return;
      try {
        var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.type === 'WA_EMBEDDED_SIGNUP') {
          session = data.data || {};
        }
      } catch (e) {}
    });
    window.fbAsyncInit = function () {
      FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: true, version: GRAPH });
    };
    function launch() {
      if (REDIRECT_URI) {
        var extras = encodeURIComponent(JSON.stringify({ setup: {}, sessionInfoVersion: '3' }));
        window.location.href = 'https://www.facebook.com/' + GRAPH + '/dialog/oauth'
          + '?client_id=' + encodeURIComponent(APP_ID)
          + '&display=page'
          + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI)
          + '&response_type=code'
          + '&override_default_response_type=true'
          + '&config_id=' + encodeURIComponent(CONFIG_ID)
          + '&extras=' + extras;
        return;
      }
      FB.login(function (response) {
        if (response && response.authResponse && response.authResponse.code) {
          send({
            type: 'ok',
            code: response.authResponse.code,
            wabaId: session && (session.waba_id || session.wabaId),
            phoneNumberId: session && (session.phone_number_id || session.phoneNumberId)
          });
        }
      }, {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: '3' }
      });
    }
    document.getElementById('go').onclick = launch;
  </script>
  <script async defer src="https://connect.facebook.net/en_US/sdk.js"></script>
</body>
</html>`;
}

export function oauthReturnHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>WhatsApp</title>
  <style>body{font-family:system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:24px}</style>
</head>
<body>
  <p id="msg">Returning to Againo…</p>
  <script>
    var q = new URLSearchParams(location.search);
    var code = q.get('code');
    var err = q.get('error');
    var payload = code
      ? { type: 'ok', code: code, wabaId: q.get('waba_id') || undefined, phoneNumberId: q.get('phone_number_id') || undefined }
      : { type: 'cancel', error: err || 'cancelled' };
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
    document.getElementById('msg').textContent = code
      ? 'Connected. This window can close.'
      : 'Signup cancelled. Close and try again.';
  </script>
</body>
</html>`;
}

function json(v: string) {
  return JSON.stringify(v);
}
