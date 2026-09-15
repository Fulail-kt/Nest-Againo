export function toE164(raw: string, defaultCc = '91') {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (raw.trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCc}${digits}`;
  if (digits.length === 12 && digits.startsWith(defaultCc)) return `+${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return null;
}
