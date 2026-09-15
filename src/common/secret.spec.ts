import { decryptSecret, encryptSecret, redact } from './secret';

describe('secret', () => {
  it('roundtrips', () => {
    const packed = encryptSecret('EAABtoken-example');
    expect(packed).not.toContain('EAABtoken');
    expect(decryptSecret(packed)).toBe('EAABtoken-example');
  });

  it('redact hides token', () => {
    expect(redact('EAABtokenXYZ')).toBe('EAA…YZ');
  });
});
