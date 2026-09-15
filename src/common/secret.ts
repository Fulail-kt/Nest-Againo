import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function key() {
  const raw = process.env.WA_TOKEN_KEY || process.env.JWT_SECRET || '';
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptSecret(packed: string) {
  const [ivB64, tagB64, dataB64] = packed.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Bad secret');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  d.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([d.update(Buffer.from(dataB64, 'base64')), d.final()]).toString('utf8');
}

export function redact(v?: string | null) {
  if (!v) return v;
  if (v.length < 8) return '***';
  return `${v.slice(0, 3)}…${v.slice(-2)}`;
}
