import { Logger } from '@nestjs/common';
import { graphUrl, metaConfig } from './meta.config';

const log = new Logger('MetaGraph');

type GraphErr = { error?: { message?: string; code?: number; error_subcode?: number } };

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly retryable = false,
  ) {
    super(message);
  }
}

function userFacing(code?: number, fallback = 'WhatsApp request failed.') {
  if (code === 190) return 'WhatsApp connection expired. Reconnect WhatsApp.';
  if (code === 132001 || code === 132000) return 'WhatsApp template missing or rejected.';
  if (code === 131047) return 'WhatsApp only allows free text inside a 24-hour window. Use a template.';
  if (code === 4 || code === 80007) return 'WhatsApp rate limit. Try again shortly.';
  if (code === 10) return 'WhatsApp permission denied. Reconnect WhatsApp.';
  return fallback;
}

export function mapMetaError(code?: number, message?: string) {
  const retryable = code === 4 || code === 80007 || !code;
  return new MetaApiError(userFacing(code, message || 'WhatsApp request failed.'), code, retryable);
}

async function graph<T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : graphUrl(path));
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & GraphErr;
  if (!res.ok || data.error) {
    const code = data.error?.code;
    log.warn(`Graph ${res.status} code=${code ?? '?'} path=${url.pathname}`);
    throw mapMetaError(code, data.error?.message);
  }
  return data;
}

export async function exchangeCode(code: string) {
  const { appId, appSecret } = metaConfig();
  const short = await graph<{ access_token: string; expires_in?: number }>('/oauth/access_token', {
    query: { client_id: appId, client_secret: appSecret, code },
  });
  try {
    const long = await graph<{ access_token: string; expires_in?: number }>('/oauth/access_token', {
      query: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: short.access_token,
      },
    });
    return {
      accessToken: long.access_token,
      expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
    };
  } catch {
    return {
      accessToken: short.access_token,
      expiresAt: short.expires_in ? new Date(Date.now() + short.expires_in * 1000) : null,
    };
  }
}

export async function fetchPhone(token: string, phoneNumberId: string) {
  return graph<{
    id: string;
    display_phone_number?: string;
    verified_name?: string;
  }>(`/${phoneNumberId}`, {
    token,
    query: { fields: 'id,display_phone_number,verified_name' },
  });
}

export async function fetchWaba(token: string, wabaId: string) {
  return graph<{
    id: string;
    name?: string;
    owner_business_info?: { id?: string; name?: string };
  }>(`/${wabaId}`, {
    token,
    query: { fields: 'id,name,owner_business_info' },
  });
}

type Owned = {
  data?: Array<{
    id: string;
    owned_whatsapp_business_accounts?: {
      data?: Array<{
        id: string;
        name?: string;
        phone_numbers?: {
          data?: Array<{ id: string; display_phone_number?: string; verified_name?: string }>;
        };
      }>;
    };
  }>;
};

export async function discoverAssets(token: string) {
  const me = await graph<Owned>('/me/businesses', {
    token,
    query: {
      fields:
        'id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}',
    },
  });
  const biz = me.data?.[0];
  const waba = biz?.owned_whatsapp_business_accounts?.data?.[0];
  const phone = waba?.phone_numbers?.data?.[0];
  return {
    metaBusinessId: biz?.id,
    wabaId: waba?.id,
    phoneNumberId: phone?.id,
    displayPhoneNumber: phone?.display_phone_number,
    verifiedName: phone?.verified_name ?? waba?.name,
  };
}

export async function subscribeWaba(token: string, wabaId: string) {
  try {
    await graph(`/${wabaId}/subscribed_apps`, { method: 'POST', token });
  } catch (e) {
    log.warn(`subscribe apps failed: ${e instanceof Error ? e.message : 'error'}`);
  }
}

export type SendPayload = {
  phoneNumberId: string;
  token: string;
  to: string;
  type: 'text' | 'template';
  text?: string;
  template?: { name: string; language: string; parameters: string[] };
};

export async function sendWhatsApp(payload: SendPayload) {
  const body =
    payload.type === 'template' && payload.template
      ? {
          messaging_product: 'whatsapp',
          to: payload.to.replace(/^\+/, ''),
          type: 'template',
          template: {
            name: payload.template.name,
            language: { code: payload.template.language },
            components: payload.template.parameters.length
              ? [
                  {
                    type: 'body',
                    parameters: payload.template.parameters.map((t) => ({
                      type: 'text',
                      text: t,
                    })),
                  },
                ]
              : undefined,
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: payload.to.replace(/^\+/, ''),
          type: 'text',
          text: { body: payload.text ?? '' },
        };

  const res = await graph<{ messages?: Array<{ id?: string }> }>(
    `/${payload.phoneNumberId}/messages`,
    { method: 'POST', token: payload.token, body },
  );
  return res.messages?.[0]?.id ?? null;
}
