/**
 * Inbound caller identity — same priority chain as web softphone.
 * @see web/src/lib/inbound-caller-display.ts
 */

export type InboundCallerCallFields = {
  direction?: string;
  remotePartyNumber?: string;
  remotePartyName?: string;
  localPartyNumber?: string;
  callerNumber?: string;
  remoteIdentity?: {
    displayName?: string;
    uri?: { user?: string; raw?: string; toString?: () => string };
  };
  options?: {
    remoteCallerNumber?: string;
    remotePartyNumber?: string;
    callerNumber?: string;
    remoteCallerName?: string;
    destinationNumber?: string;
  };
};

export type InboundCallerResolution = {
  direction?: string;
  remotePartyNumber?: string;
  remotePartyName?: string;
  localPartyNumber?: string;
  chosenDisplayNumber: string;
  source: string;
};

const BLOCKED_LABELS = /^(anonymous|blocked|unknown|restricted|unavailable|private)$/i;

export function phoneDigits(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

function isOwnTenantNumber(digits: string, ownNumbers: string[] = []): boolean {
  if (!digits) return false;
  return ownNumbers.some((value) => {
    const ownDigits = phoneDigits(value);
    if (!ownDigits) return false;
    if (digits === ownDigits) return true;
    return digits.length >= 10
      && ownDigits.length >= 10
      && digits.slice(-10) === ownDigits.slice(-10);
  });
}

export function isForbiddenInboundCallerValue(
  normalized: string,
  call: InboundCallerCallFields,
  ownNumbers: string[] = [],
): boolean {
  if (!normalized) return true;
  const digits = phoneDigits(normalized);
  const forbidden = [
    call.localPartyNumber,
    call.options?.callerNumber,
    call.callerNumber,
    call.options?.destinationNumber,
  ];
  for (const value of forbidden) {
    if (!value) continue;
    const forbiddenDigits = phoneDigits(value);
    if (!forbiddenDigits) continue;
    if (digits === forbiddenDigits) return true;
    if (digits.length >= 10 && forbiddenDigits.length >= 10 && digits.slice(-10) === forbiddenDigits.slice(-10)) {
      return true;
    }
  }
  return isOwnTenantNumber(digits, ownNumbers);
}

export function extractPhoneDisplayValue(
  value?: string | null,
  ownNumbers: string[] = [],
  call?: InboundCallerCallFields,
): string {
  if (!value) return '';
  let candidate = String(value).trim();
  if (!candidate || BLOCKED_LABELS.test(candidate)) return '';

  const sipMatch = candidate.match(/(?:sip|tel):([^@;>\s]+)/i);
  if (sipMatch?.[1]) candidate = sipMatch[1];

  candidate = candidate.replace(/^sip:/i, '').replace(/^tel:/i, '');
  candidate = candidate.split('@')[0] || candidate;
  candidate = candidate.split(';')[0] || candidate;
  candidate = candidate.replace(/[<>"']/g, '').trim();

  const digits = candidate.replace(/\D/g, '');
  if (!digits) return '';
  if (/[a-z]/i.test(candidate.replace(/^sip:/i, ''))) return '';

  let normalized = '';
  if (digits.length === 10) normalized = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) normalized = `+${digits}`;
  else if (/^\d{2,6}$/.test(digits)) normalized = digits;
  else if (candidate.startsWith('+') && digits.length >= 10) normalized = `+${digits}`;
  else return '';

  if (call && isForbiddenInboundCallerValue(normalized, call, ownNumbers)) return '';
  if (isOwnTenantNumber(phoneDigits(normalized), ownNumbers)) return '';
  return normalized;
}

export function resolveInboundCallerDisplay(
  call: InboundCallerCallFields,
  ownNumbers: string[] = [],
): InboundCallerResolution {
  const chain: Array<[string, string | undefined | null]> = [
    ['remotePartyNumber', call.remotePartyNumber],
    ['options.remoteCallerNumber', call.options?.remoteCallerNumber],
    ['options.remotePartyNumber', call.options?.remotePartyNumber],
    ['remoteIdentity', resolveFilteredRemoteIdentity(call, ownNumbers)],
  ];

  for (const [source, raw] of chain) {
    const normalized = extractPhoneDisplayValue(raw, ownNumbers, call);
    if (normalized) {
      return {
        direction: call.direction,
        remotePartyNumber: call.remotePartyNumber,
        remotePartyName: call.remotePartyName,
        localPartyNumber: call.localPartyNumber,
        chosenDisplayNumber: normalized,
        source,
      };
    }
  }

  return {
    direction: call.direction,
    remotePartyNumber: call.remotePartyNumber,
    remotePartyName: call.remotePartyName,
    localPartyNumber: call.localPartyNumber,
    chosenDisplayNumber: 'Unknown',
    source: 'unknown',
  };
}

function resolveFilteredRemoteIdentity(call: InboundCallerCallFields, ownNumbers: string[] = []): string {
  const uri = call.remoteIdentity?.uri;
  const candidates = [
    uri?.user,
    uri?.raw,
    typeof uri?.toString === 'function' ? uri.toString() : undefined,
    call.remoteIdentity?.displayName,
  ];
  for (const candidate of candidates) {
    const parsed = extractPhoneDisplayValue(candidate, ownNumbers, call);
    if (parsed) return parsed;
  }
  return '';
}

export function resolveInboundCallerNameHint(call: InboundCallerCallFields): string {
  for (const candidate of [call.remotePartyName, call.options?.remoteCallerName]) {
    const trimmed = String(candidate || '').trim();
    if (!trimmed || BLOCKED_LABELS.test(trimmed)) continue;
    if (phoneDigits(trimmed).length >= 10) continue;
    if (/^\+\d/.test(trimmed)) continue;
    return trimmed;
  }
  return '';
}
