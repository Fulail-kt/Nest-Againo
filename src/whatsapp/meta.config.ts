export function metaConfig() {
  return {
    appId: process.env.META_APP_ID?.trim() || '',
    appSecret: process.env.META_APP_SECRET?.trim() || '',
    configId: process.env.META_CONFIG_ID?.trim() || '',
    graphVersion: process.env.META_GRAPH_API_VERSION?.trim() || 'v21.0',
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || '',
    testTemplate: process.env.WA_TEST_TEMPLATE?.trim() || '',
    greetingTemplate: process.env.WA_GREETING_TEMPLATE?.trim() || '',
    templateLang: process.env.WA_TEMPLATE_LANG?.trim() || 'en',
    publicBase: (process.env.PUBLIC_API_URL || '').trim().replace(/\/$/, ''),
  };
}

export function oauthRedirectUri() {
  const { publicBase } = metaConfig();
  return publicBase ? `${publicBase}/integrations/whatsapp/oauth-return` : '';
}
  const c = metaConfig();
  return !!(c.appId && c.appSecret && c.configId);
}

export function graphUrl(path: string) {
  const { graphVersion } = metaConfig();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `https://graph.facebook.com/${graphVersion}${p}`;
}
