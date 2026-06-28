/**
 * Inbound caller identity resolution for VSP Softphone UI.
 *
 * Telnyx WebRTC SDK (callUpdate @ ringing, inbound):
 * - Maps `telnyx_rtc.ringing` caller_id_number → Call.remotePartyNumber
 * - Maps caller_id_name → Call.remotePartyName
 * - Call Control PSTN bridge: remotePartyNumber is often tenant DID; PSTN caller
 *   is in remotePartyName (fromDisplayName) and/or dial client_state.pstnCaller
 *
 * Number precedence:
 * 1. caller_id_number / options.callerIdNumber (when not tenant DID)
 * 2. remotePartyNumber (when not tenant DID)
 * 3. remotePartyName (when value is E.164, not CNAM text)
 * 4. options.remoteCallerNumber / options.remotePartyNumber
 * 5. client_state.pstnCaller (Call Control dial metadata)
 * 6. notification.from / pstnCallerHint / notification scan
 * 7. remoteIdentity (filtered)
 * 8. Unknown (only when Telnyx provides no usable caller ID)
 *
 * Name precedence (separate from number — UI shows both):
 * 1. caller_id_name / options.callerIdName
 * 2. remotePartyName (when not phone-like)
 * 3. options.remoteCallerName
 * 4. client_state.pstnCallerName
 *
 * @see docs/telnyx/javascript-sdk/reference/call.md
 * @see docs/telnyx/javascript-sdk/explanation/call-state-lifecycle.md
 * @see docs/telnyx/webrtc/js-sdk/anatomy.md (telnyx_rtc.ringing fields)
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
    callerIdName?: string;
    callerIdNumber?: string;
    caller_id_name?: string;
    caller_id_number?: string;
    remote_caller_id_name?: string;
    remote_caller_id_number?: string;
    clientState?: string;
    client_state?: string;
  };
};

export type InboundCallerNotification = {
  type?: string;
  payload?: Record<string, unknown>;
};

export type InboundCallerContext = {
  ownNumbers?: string[];
  pstnCallerHint?: string;
  pstnCallerNameHint?: string;
  notification?: InboundCallerNotification;
  /** Telnyx Call object — scanned for client_state / custom fields on bridged PSTN legs. */
  call?: InboundCallerCallFields;
};

export function isUnknownInboundCallerLabel(label?: string | null): boolean {
  const normalized = String(label ?? '').trim().toLowerCase();
  if (isRestrictedCallerDisplayLabel(label)) return false;
  return UNKNOWN_CALLER_LABELS.has(normalized);
}

/** Prefer an established caller label over empty / Unknown placeholders. */
export function mergeInboundCallerLabel(
  current?: string | null,
  next?: string | null,
): string {
  const trimmedNext = String(next ?? '').trim();
  if (!isUnknownInboundCallerLabel(trimmedNext)) return trimmedNext;
  const trimmedCurrent = String(current ?? '').trim();
  if (!isUnknownInboundCallerLabel(trimmedCurrent)) return trimmedCurrent;
  return trimmedNext || trimmedCurrent;
}

/** Never clear a known display name when a later notification omits caller name. */
export function mergeInboundCallerNameHint(
  current?: string | null,
  next?: string | null,
  provided = true,
): string | null {
  const trimmedNext = String(next ?? '').trim();
  if (trimmedNext) return trimmedNext;
  if (!provided) return current ?? null;
  return current ?? null;
}

export type InboundCallerDebugSnapshot = {
  direction?: string;
  remotePartyNumber?: string;
  remotePartyName?: string;
  localPartyNumber?: string;
  chosenDisplayNumber: string;
  source: InboundCallerSource;
};

export type InboundCallerSource =
  | 'options.callerIdNumber'
  | 'remotePartyNumber'
  | 'remotePartyName'
  | 'options.remoteCallerNumber'
  | 'options.remotePartyNumber'
  | 'options.clientState'
  | 'notification.from'
  | 'pstnCallerHint'
  | 'notification.pstnCaller'
  | 'remoteIdentity'
  | 'restrictedCaller'
  | 'unknown';

export type InboundCallerNameSource =
  | 'options.callerIdName'
  | 'remotePartyName'
  | 'options.remoteCallerName'
  | 'clientState.pstnCallerName'
  | 'pstnCallerNameHint'
  | 'none';

export type InboundCallerFieldSnapshot = {
  notificationType?: string;
  remotePartyNumber?: string;
  remotePartyName?: string;
  callerIdNumber?: string;
  callerIdName?: string;
  remoteCallerIdNumber?: string;
  remoteCallerIdName?: string;
  clientState?: string;
  customHeaders?: unknown;
  localPartyNumber?: string;
  remoteIdentityDisplayName?: string;
  notificationFrom?: string;
  pstnCallerHint?: string;
};

const UNKNOWN_CALLER_LABELS = new Set(['', 'unknown', 'unknown caller']);

export type InboundCallerResolution = InboundCallerDebugSnapshot;

const BLOCKED_LABELS = /^(anonymous|blocked|unknown|restricted|unavailable|private)$/i;

const RESTRICTED_CALLER_DISPLAY: Record<string, string> = {
  anonymous: 'Anonymous',
  private: 'Private Number',
  blocked: 'Blocked',
  restricted: 'Restricted',
  unavailable: 'Unavailable',
};

/** Map Telnyx/network privacy labels to intentional UI copy (not "Unknown Caller"). */
export function normalizeRestrictedCallerLabel(value?: string | null): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const mapped = RESTRICTED_CALLER_DISPLAY[trimmed.toLowerCase()];
  return mapped ?? null;
}

export function isRestrictedCallerDisplayLabel(label?: string | null): boolean {
  const trimmed = String(label ?? '').trim();
  if (!trimmed) return false;
  return Object.values(RESTRICTED_CALLER_DISPLAY).some(
    (display) => display.toLowerCase() === trimmed.toLowerCase(),
  );
}

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

export function decodePstnCallerNameFromClientState(raw: string): string {
  try {
    const parsed = JSON.parse(atob(raw)) as { pstnCallerName?: string };
    const name = String(parsed.pstnCallerName || '').trim();
    if (!name || BLOCKED_LABELS.test(name) || looksLikePhoneNumberLabel(name)) return '';
    return name;
  } catch {
    return '';
  }
}

export function looksLikePhoneNumberLabel(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  const digits = phoneDigits(trimmed);
  if (digits.length >= 10) return true;
  if (/^\+\d/.test(trimmed)) return true;
  if (/^\d{2,6}$/.test(trimmed)) return true;
  return false;
}

function readCallOptionString(
  call: InboundCallerCallFields,
  keys: string[],
): string {
  const options = call.options as Record<string, unknown> | undefined;
  if (!options) return '';
  for (const key of keys) {
    const value = options[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** Raw Telnyx invite / ringing fields before VSP filtering. */
export function extractTelnyxRawCallerFields(call: InboundCallerCallFields) {
  return {
    callerIdNumber: readCallOptionString(call, [
      'caller_id_number',
      'callerIdNumber',
      'remote_caller_id_number',
      'remoteCallerIdNumber',
    ]),
    callerIdName: readCallOptionString(call, [
      'caller_id_name',
      'callerIdName',
      'remote_caller_id_name',
      'remoteCallerIdName',
    ]),
    clientState: readCallOptionString(call, [
      'client_state',
      'clientState',
      'customData',
      'custom_data',
    ]),
    customHeaders: (call.options as Record<string, unknown> | undefined)?.customHeaders
      ?? (call.options as Record<string, unknown> | undefined)?.custom_headers,
  };
}

/** Capture all inbound caller identity fields from a Telnyx notification for diagnostics. */
export function collectInboundCallerFieldSnapshot(
  call: InboundCallerCallFields,
  context: InboundCallerContext = {},
): InboundCallerFieldSnapshot {
  const raw = extractTelnyxRawCallerFields(call);
  return {
    notificationType: context.notification?.type,
    remotePartyNumber: call.remotePartyNumber,
    remotePartyName: call.remotePartyName,
    callerIdNumber: raw.callerIdNumber,
    callerIdName: raw.callerIdName,
    remoteCallerIdNumber: raw.callerIdNumber,
    remoteCallerIdName: raw.callerIdName,
    clientState: raw.clientState,
    customHeaders: raw.customHeaders,
    localPartyNumber: call.localPartyNumber,
    remoteIdentityDisplayName: call.remoteIdentity?.displayName,
    notificationFrom: extractNotificationFrom(context.notification),
    pstnCallerHint: context.pstnCallerHint,
  };
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

function decodePstnCallerFromCallOptions(call?: InboundCallerCallFields): string {
  const options = call?.options as Record<string, unknown> | undefined;
  if (!options) return '';

  for (const key of ['clientState', 'client_state', 'customData', 'custom_data']) {
    const value = options[key];
    if (typeof value !== 'string') continue;
    const fromState = decodePstnCallerFromClientState(value);
    if (fromState) return fromState;
  }
  return '';
}

function pickRestrictedCallerLabel(
  call: InboundCallerCallFields,
  rawFields: ReturnType<typeof extractTelnyxRawCallerFields>,
): InboundCallerResolution | null {
  const candidates = [
    call.remotePartyNumber,
    call.remotePartyName,
    rawFields.callerIdNumber,
    rawFields.callerIdName,
    call.options?.remoteCallerName,
  ];
  for (const candidate of candidates) {
    const label = normalizeRestrictedCallerLabel(candidate);
    if (label) return buildResolution(call, label, 'restrictedCaller');
  }
  return null;
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
  const resolvedCall = context.call ?? call;
  const raw = extractTelnyxRawCallerFields(resolvedCall);

  const chain: Array<[InboundCallerSource, string | undefined | null]> = [
    ['options.callerIdNumber', raw.callerIdNumber],
    ['remotePartyNumber', resolvedCall.remotePartyNumber],
    ['options.remoteCallerNumber', resolvedCall.options?.remoteCallerNumber],
    ['options.remotePartyNumber', resolvedCall.options?.remotePartyNumber],
    // Call Control PSTN bridge: PSTN E.164 often in fromDisplayName → remotePartyName.
    ['remotePartyName', resolvedCall.remotePartyName],
    ['options.clientState', decodePstnCallerFromCallOptions(resolvedCall)],
    ['notification.from', extractNotificationFrom(context.notification)],
    ['pstnCallerHint', context.pstnCallerHint],
    ['notification.pstnCaller', decodePstnCallerFromNotification(context.notification)],
    ['remoteIdentity', resolveFilteredRemoteIdentity(resolvedCall, ownNumbers)],
  ];

  for (const [source, raw] of chain) {
    const picked = pickCallerField(source, raw, resolvedCall, ownNumbers);
    if (picked) return picked;
  }

  const restricted = pickRestrictedCallerLabel(resolvedCall, raw);
  if (restricted) return restricted;

  return buildResolution(resolvedCall, 'Unknown', 'unknown');
}

/** Resolve inbound caller number + Telnyx name hint from the first ringing notification. */
export function resolveInboundSessionIdentity(
  call: InboundCallerCallFields,
  context: InboundCallerContext = {},
): {
  displayNumber: string;
  nameHint: string;
  source: InboundCallerSource;
  nameSource: InboundCallerNameSource;
  fieldSnapshot: InboundCallerFieldSnapshot;
} {
  const fieldSnapshot = collectInboundCallerFieldSnapshot(call, { ...context, call });
  const resolution = resolveInboundCallerDisplay(call, { ...context, call });
  const nameResolution = resolveInboundCallerNameHint(call, context);
  return {
    displayNumber: resolution.chosenDisplayNumber,
    nameHint: nameResolution.nameHint,
    source: resolution.source,
    nameSource: nameResolution.source,
    fieldSnapshot,
  };
}

/** Telnyx display name for inbound UI when no contact match. */
export function resolveInboundCallerNameHint(
  call: InboundCallerCallFields,
  context: InboundCallerContext = {},
): { nameHint: string; source: InboundCallerNameSource } {
  const raw = extractTelnyxRawCallerFields(call);
  const clientStateRaw = raw.clientState || decodePstnCallerFromCallOptions(call);

  const chain: Array<[InboundCallerNameSource, string | undefined | null]> = [
    ['options.callerIdName', raw.callerIdName],
    ['remotePartyName', call.remotePartyName],
    ['options.remoteCallerName', call.options?.remoteCallerName],
    ['clientState.pstnCallerName', clientStateRaw ? decodePstnCallerNameFromClientState(clientStateRaw) : ''],
    ['pstnCallerNameHint', context.pstnCallerNameHint],
  ];

  for (const [source, candidate] of chain) {
    const trimmed = String(candidate || '').trim();
    if (!trimmed || BLOCKED_LABELS.test(trimmed)) continue;
    if (looksLikePhoneNumberLabel(trimmed)) continue;
    return { nameHint: trimmed, source };
  }

  return { nameHint: '', source: 'none' };
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
