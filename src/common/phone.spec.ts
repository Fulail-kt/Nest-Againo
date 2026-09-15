import { toE164 } from './phone';

describe('toE164', () => {
  it('adds India default for 10 digits', () => {
    expect(toE164('9876543210')).toBe('+919876543210');
  });

  it('keeps plus prefix', () => {
    expect(toE164('+44 7700 900123')).toBe('+447700900123');
  });

  it('rejects junk', () => {
    expect(toE164('12')).toBeNull();
    expect(toE164('')).toBeNull();
  });
});
