export function metaConfig() {
  return {
    appId: process.env.META_APP_ID?.trim() || '',
    appSecret: process.env.META_APP_SECRET?.trim() || '',
    configId: process.env.META_CONFIG_ID?.trim() || '',
    graphVersion: process.env.META_GRAPH_API_VERSION?.trim() || 'v25.0',
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || '',
    testTemplate: process.env.WA_TEST_TEMPLATE?.trim() || '',
    greetingTemplate: process.env.WA_GREETING_TEMPLATE?.trim() || '',
    templateLang: process.env.WA_TEMPLATE_LANG?.trim() || 'en_US',
    publicBase: (process.env.PUBLIC_API_URL || '').trim().replace(/\/$/, ''),
  };
}

export function oauthRedirectUri() {
  const { publicBase } = metaConfig();
  return publicBase ? `${publicBase}/integrations/whatsapp/oauth-return` : '';
}

export function oauthDialogUrl(opts?: { embedded?: boolean }) {
  const { appId, configId, graphVersion } = metaConfig();
  const redirectUri = oauthRedirectUri();
  if (!appId || !redirectUri) return '';
  const embedded = opts?.embedded !== false;
  if (embedded && !configId) return '';
  const q = new URLSearchParams({
    client_id: appId,
    display: 'page',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
  });
  if (embedded) {
    q.set('override_default_response_type', 'true');
    q.set('config_id', configId);
    q.set('extras', JSON.stringify({ sessionInfoVersion: '3' }));
  }
  return `https://www.facebook.com/${graphVersion}/dialog/oauth?${q.toString()}`;
}

export function metaReady() {
  const c = metaConfig();
  return !!(c.appId && c.appSecret && c.configId);
}

export function graphUrl(path: string) {
  const { graphVersion } = metaConfig();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `https://graph.facebook.com/${graphVersion}${p}`;
}
