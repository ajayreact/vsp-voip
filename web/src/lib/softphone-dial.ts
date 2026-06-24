const EXTENSION_DIAL_PATTERN = /^\d{2,6}$/;

export function isExtensionDialInput(value: string) {
  const digits = value.trim().replace(/\D/g, '');
  return EXTENSION_DIAL_PATTERN.test(digits);
}

export function isPstnDialInput(value: string) {
  const digits = value.trim().replace(/\D/g, '');
  return digits.length >= 10;
}

export function normalizePstnDestination(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export function normalizeDialNumber(value: string) {
  const digits = value.trim().replace(/\D/g, '');
  if (!digits) return '';
  if (value.trim().startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export function resolveOutboundDestination(value: string): {
  destinationNumber: string;
  isExtension: boolean;
} {
  const trimmed = value.trim();
  const extensionDigits = trimmed.replace(/\D/g, '');

  if (isExtensionDialInput(trimmed)) {
    return { destinationNumber: extensionDigits, isExtension: true };
  }

  return {
    destinationNumber: normalizePstnDestination(trimmed),
    isExtension: false,
  };
}

export function isValidDialInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return isExtensionDialInput(trimmed) || isPstnDialInput(trimmed);
}
