/** Display US/CA numbers as +1 (XXX) XXX-XXXX when possible. */
export function formatPhoneNumber(value: string | null | undefined): string {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length > 0) return `+${digits}`;
  return value;
}
