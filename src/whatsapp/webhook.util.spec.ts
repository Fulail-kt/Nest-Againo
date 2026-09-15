import { createHmac } from 'crypto';
import { verifyMetaSignature, webhookEventId } from './webhook.util';

describe('webhook.util', () => {
  const secret = 'test-app-secret';
  const raw = Buffer.from('{"object":"whatsapp_business_account"}');

  it('accepts valid signature', () => {
    const hex = createHmac('sha256', secret).update(raw).digest('hex');
    expect(verifyMetaSignature(raw, `sha256=${hex}`, secret)).toBe(true);
  });

  it('rejects invalid signature', () => {
    expect(verifyMetaSignature(raw, 'sha256=deadbeef', secret)).toBe(false);
    expect(verifyMetaSignature(raw, undefined, secret)).toBe(false);
  });

  it('idempotency id from status', () => {
    expect(
      webhookEventId('e1', { value: { statuses: [{ id: 'wamid.1', status: 'delivered' }] } }),
    ).toBe('wamid.1:delivered');
  });
});
