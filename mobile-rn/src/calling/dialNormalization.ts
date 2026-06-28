export function normalizeDestination(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (/^\d{2,6}$/.test(digits)) return digits;
  if (value.trim().startsWith('+')) return `+${digits}`;
  return value.trim();
}

/** Internal PBX extension (2–6 digits), not PSTN. */
export function isExtensionDialInput(value: string) {
  const digits = value.trim().replace(/\D/g, '');
  return /^\d{2,6}$/.test(digits);
}
