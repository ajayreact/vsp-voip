function normalizePhoneNumber(number) {
  if (!number) return null;
  const digits = String(number).replace(/\D/g, '');
  if (!digits) return null;
  return `+${digits}`;
}

function formatPhoneNumberForDisplay(number) {
  if (!number) return '—';
  const digits = String(number).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length > 0) return `+${digits}`;
  return String(number);
}

module.exports = { normalizePhoneNumber, formatPhoneNumberForDisplay };
