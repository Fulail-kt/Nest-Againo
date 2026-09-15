import { createHmac, timingSafeEqual } from 'crypto';

export function verifyMetaSignature(raw: Buffer, header: string | undefined, appSecret: string) {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(raw).digest('hex');
  const got = header.slice(7);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(got, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function webhookEventId(entryId: string, change: Record<string, unknown>) {
  const value = (change.value ?? {}) as Record<string, unknown>;
  const statuses = value.statuses as Array<{ id?: string; status?: string }> | undefined;
  const messages = value.messages as Array<{ id?: string }> | undefined;
  const sid = statuses?.[0]?.id ?? messages?.[0]?.id;
  const st = statuses?.[0]?.status ?? '';
  return sid ? `${sid}:${st}` : `${entryId}:${String(change.field ?? 'x')}`;
}
