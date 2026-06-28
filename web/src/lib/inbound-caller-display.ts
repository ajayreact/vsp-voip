/**
 * Inbound caller identity resolution for VSP Softphone UI.
 *
 * Priority (Telnyx WebRTC SDK + VSP enrichment):
 * 1. call.remotePartyNumber
 * 2. options.remoteCallerNumber
 * 3. notification.from
 * 4. pstnCaller (backend hint / client_state)
 * 5. filtered remoteIdentity
 * 6. "Unknown"
 *
 * Never use as inbound caller: localPartyNumber, options.callerNumber, tenant DIDs, callee extension.
 *
 * @see docs/telnyx/javascript-sdk/reference/call.md
 * @see docs/telnyx/javascript-sdk/explanation/call-state-lifecycle.md
 */

export type InboundCallerCallFields = {
  direction?: string;
  remotePartyNumber?: string;
  remotePartyName?: string;
  localPartyNumber?: string;
  callerNumber?: string;
  remoteIdentity?: {
    displayName?: string;
    uri?: {
      user?: string;
      raw?: string;
      toString?: () => string;
    };
  };
  options?: {
    remoteCallerNumber?: string;
    remotePartyNumber?: string;
    callerNumber?: string;
    remoteCallerName?: string;
    destinationNumber?: string;
  };
};

export type InboundCallerNotification = {
  type?: string;
  payload?: Record<string, unknown>;
};

export type InboundCallerContext = {
  ownNumbers?: string[];
  pstnCallerHint?: string;
  notification?: InboundCallerNotification;
};

export type InboundCallerDebugSnapshot = {
  direction?: string;
  remotePartyNumber?: string;
  remotePartyName?: string;
  localPartyNumber?: string;
  chosenDisplayNumber: string;
  source: InboundCallerSource;
};

export type InboundCallerSource =
  | 'remotePartyNumber'
  | 'options.remoteCallerNumber'
  | 'options.remotePartyNumber'
  | 'notification.from'
  | 'pstnCallerHint'
  | 'notification.pstnCaller'
  | 'remoteIdentity'
  | 'unknown';

export type InboundCallerResolution = InboundCallerDebugSnapshot;

const BLOCKED_LABELS = /^(anonymous|blocked|unknown|restricted|unavailable|private)$/i;

export function phoneDigits(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

export function isOwnTenantNumber(digits: string, ownNumbers: string[] = []): boolean {
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

/** Values that must never be shown as the inbound caller identity. */
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
    if (/^\d{2,6}$/.test(digits) && digits === forbiddenDigits) return true;
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
  if (!candidate) return '';
  if (BLOCKED_LABELS.test(candidate)) return '';

  const sipMatch = candidate.match(/(?:sip|tel):([^@;>\s]+)/i);
  if (sipMatch?.[1]) {
    candidate = sipMatch[1];
  }

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

export function decodePstnCallerFromClientState(raw: string): string {
  try {
    const parsed = JSON.parse(atob(raw)) as {
      pstnCaller?: string;
      pstnCallerName?: string;
    };
    return (
      extractPhoneDisplayValue(parsed.pstnCaller, [], undefined)
      || extractPhoneDisplayValue(parsed.pstnCallerName, [], undefined)
    );
  } catch {
    return '';
  }
}

export function extractNotificationFrom(notification?: InboundCallerNotification): string {
  if (!notification?.payload) return '';
  const from = notification.payload.from;
  if (typeof from === 'string') return from;
  if (from && typeof from === 'object') {
    const record = from as Record<string, unknown>;
    if (typeof record.phone_number === 'string') return record.phone_number;
    if (typeof record.number === 'string') return record.number;
  }
  return '';
}

export function decodePstnCallerFromNotification(
  notification?: InboundCallerNotification,
): string {
  if (!notification) return '';

  const scan = (value: unknown, depth = 0): string => {
    if (!value || depth > 6) return '';
    if (typeof value === 'string') {
      if (value.length >= 16 && /^[A-Za-z0-9+/=]+$/.test(value)) {
        const fromState = decodePstnCallerFromClientState(value);
        if (fromState) return fromState;
      }
      return extractPhoneDisplayValue(value, [], undefined);
    }
    if (typeof value !== 'object') return '';

    const record = value as Record<string, unknown>;
    if (typeof record.pstnCaller === 'string') {
      const direct = extractPhoneDisplayValue(record.pstnCaller, [], undefined);
      if (direct) return direct;
    }
    if (typeof record.client_state === 'string') {
      const fromState = decodePstnCallerFromClientState(record.client_state);
      if (fromState) return fromState;
    }

    for (const nested of Object.values(record)) {
      const found = scan(nested, depth + 1);
      if (found) return found;
    }
    return '';
  };

  return scan(notification.payload) || scan(notification);
}

export function resolveFilteredRemoteIdentity(
  call: InboundCallerCallFields,
  ownNumbers: string[] = [],
): string {
  const uri = call.remoteIdentity?.uri;
  const identityCandidates = [
    uri?.user,
    uri?.raw,
    typeof uri?.toString === 'function' ? uri.toString() : undefined,
    call.remoteIdentity?.displayName,
  ];

  for (const candidate of identityCandidates) {
    const parsed = extractPhoneDisplayValue(candidate, ownNumbers, call);
    if (parsed) return parsed;
  }

  return '';
}

function pickCallerField(
  source: InboundCallerSource,
  raw: string | undefined | null,
  call: InboundCallerCallFields,
  ownNumbers: string[],
): InboundCallerResolution | null {
  const normalized = extractPhoneDisplayValue(raw, ownNumbers, call);
  if (!normalized) return null;
  return buildResolution(call, normalized, source);
}

function buildResolution(
  call: InboundCallerCallFields,
  chosenDisplayNumber: string,
  source: InboundCallerSource,
): InboundCallerResolution {
  return {
    direction: call.direction,
    remotePartyNumber: call.remotePartyNumber,
    remotePartyName: call.remotePartyName,
    localPartyNumber: call.localPartyNumber,
    chosenDisplayNumber,
    source,
  };
}

/**
 * Resolve inbound caller number for UI display.
 */
export function resolveInboundCallerDisplay(
  call: InboundCallerCallFields,
  context: InboundCallerContext = {},
): InboundCallerResolution {
  const ownNumbers = context.ownNumbers ?? [];

  const chain: Array<[InboundCallerSource, string | undefined | null]> = [
    ['remotePartyNumber', call.remotePartyNumber],
    ['options.remoteCallerNumber', call.options?.remoteCallerNumber],
    ['options.remotePartyNumber', call.options?.remotePartyNumber],
    ['notification.from', extractNotificationFrom(context.notification)],
    ['pstnCallerHint', context.pstnCallerHint],
    ['notification.pstnCaller', decodePstnCallerFromNotification(context.notification)],
    ['remoteIdentity', resolveFilteredRemoteIdentity(call, ownNumbers)],
  ];

  for (const [source, raw] of chain) {
    const picked = pickCallerField(source, raw, call, ownNumbers);
    if (picked) return picked;
  }

  return buildResolution(call, 'Unknown', 'unknown');
}

/** Telnyx display name for inbound UI when no contact match (remotePartyName / remoteCallerName). */
export function resolveInboundCallerNameHint(call: InboundCallerCallFields): string {
  const candidates = [call.remotePartyName, call.options?.remoteCallerName];
  for (const candidate of candidates) {
    const trimmed = String(candidate || '').trim();
    if (!trimmed || BLOCKED_LABELS.test(trimmed)) continue;
    if (phoneDigits(trimmed).length >= 10) continue;
    if (/^\+\d/.test(trimmed)) continue;
    return trimmed;
  }
  return '';
}

/** Development-only debug log (browser or NODE_ENV=development). */
export function logInboundCallerResolution(
  resolution: InboundCallerResolution,
  label = 'inbound.caller-id',
): void {
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev) return;

  const payload = {
    direction: resolution.direction,
    remotePartyNumber: resolution.remotePartyNumber,
    remotePartyName: resolution.remotePartyName,
    localPartyNumber: resolution.localPartyNumber,
    chosenDisplayNumber: resolution.chosenDisplayNumber,
    source: resolution.source,
  };

  if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[VSP Softphone] ${label}`, payload);
  }
}

export function isInboundCallDirection(call: InboundCallerCallFields | null | undefined): boolean {
  if (!call) return false;
  if (String(call.direction || '').toLowerCase() === 'inbound') return true;
  return Boolean(
    call.options?.remoteCallerNumber && !call.options?.destinationNumber,
  );
}
