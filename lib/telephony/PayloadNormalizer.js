const { getCredentialConnectionId } = require('../telnyxConfig');
const { getCallControlApplicationId } = require('../telnyxCallControlSetup');
const { EXTENSION_DIAL_PATTERN } = require('./constants');

function isPstnDestination(to) {
  const digits = String(to || '').replace(/\D/g, '');
  return digits.length >= 10;
}

function parseInternalExtensionDestination(to) {
  if (!to || isPstnDestination(to)) return null;
  const raw = String(to).trim();
  const sipMatch = raw.match(/sip:(?:\+?)(\d{2,6})@/i);
  if (sipMatch) return sipMatch[1];
  const digits = raw.replace(/\D/g, '');
  if (EXTENSION_DIAL_PATTERN.test(digits)) return digits;
  return null;
}

function extractSipUsername(from) {
  const raw = String(from || '').trim();
  if (!raw) return null;
  if (raw.startsWith('sip:')) {
    const match = raw.match(/^sip:([^@;]+)/i);
    return match ? match[1] : null;
  }
  if (raw.includes('@')) return raw.split('@')[0];
  return raw;
}

/** Telnyx auto-generated SIP usernames (gencred…) — not E.164 or extension digits. */
function looksLikeTelnyxCredentialUsername(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (/^gencred[a-z0-9]+$/i.test(trimmed)) return true;
  if (/^sip:gencred[a-z0-9]+@/i.test(trimmed)) return true;
  return /^[a-z0-9]{20,}$/i.test(trimmed) && !/\d{7,}/.test(trimmed);
}

/** Desk/mobile/app ring target after Telnyx internal URI resolution (sip_uri_calling_preference). */
function isTelnyxCredentialSipDestination(to) {
  const username = extractSipUsername(to);
  return Boolean(username && looksLikeTelnyxCredentialUsername(username));
}

function parseCredentialSipUsername(to) {
  if (!isTelnyxCredentialSipDestination(to)) return null;
  return extractSipUsername(to);
}

function isOutboundDirection(direction) {
  const normalized = String(direction || '').toLowerCase();
  return normalized === 'outgoing' || normalized === 'outbound';
}

/**
 * True desk-originated Pattern 1 outbound (Grandstream/WebRTC user dial).
 * Excludes inbound PSTN B-legs (typically state "bridging", from external PSTN).
 */
function isDeskOriginatedParkedOutbound(payload) {
  if (!payload || !isOutboundDirection(payload.direction)) return false;
  return String(payload.state || '').toLowerCase() === 'parked';
}

function isValidE164CallerId(value) {
  const { normalizePhoneNumber } = require('../phone');
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return false;
  return normalized.replace(/\D/g, '').length >= 10;
}

function callerResolutionPayloadSnapshot(payload) {
  return {
    from: payload?.from ?? null,
    to: payload?.to ?? null,
    sip_username: payload?.sip_username ?? null,
    username: payload?.username ?? null,
    credential_username: payload?.credential_username ?? null,
    calling_party_id: payload?.calling_party_id ?? null,
    caller_id_number: payload?.caller_id_number ?? null,
    sip_from: payload?.sip_from ?? null,
    direction: payload?.direction ?? null,
    connection_id: payload?.connection_id ?? null,
  };
}

function describeCredentialConnectionOutboundGate(payload, platform, { eventType = 'call.initiated' } = {}) {
  const credentialConnectionId = getCredentialConnectionId(platform);
  const callControlApplicationId = getCallControlApplicationId(platform);
  const payloadConnectionId = payload?.connection_id ? String(payload.connection_id) : null;
  const direction = String(payload.direction || '').toLowerCase() || null;

  const diagnostics = {
    expectedCredentialConnectionId: credentialConnectionId || null,
    expectedCallControlApplicationId: callControlApplicationId || null,
    payloadConnectionId,
    direction,
    event: eventType,
    platform: platform?.source || 'unknown',
  };

  if (!credentialConnectionId && !callControlApplicationId) {
    return { ok: false, reason: 'missing_platform_connection_ids', acceptedAs: null, ...diagnostics };
  }
  if (!payloadConnectionId) {
    return { ok: false, reason: 'missing_payload_connection_id', acceptedAs: null, ...diagnostics };
  }
  if (!isOutboundDirection(direction)) {
    return { ok: false, reason: 'direction_not_outbound', acceptedAs: null, ...diagnostics };
  }

  let acceptedAs = null;
  if (credentialConnectionId && payloadConnectionId === String(credentialConnectionId)) {
    acceptedAs = 'Credential Connection';
  } else if (callControlApplicationId && payloadConnectionId === String(callControlApplicationId)) {
    acceptedAs = 'Call Control Application';
  }

  if (!acceptedAs) {
    return { ok: false, reason: 'connection_id_mismatch', acceptedAs: null, ...diagnostics };
  }

  return {
    ok: true,
    reason: 'matched',
    acceptedAs,
    matchedConnectionId: payloadConnectionId,
    ...diagnostics,
  };
}

function isCredentialConnectionOutbound(payload, platform) {
  return describeCredentialConnectionOutboundGate(payload, platform).ok;
}

/** Desk phone outbound only — Call Control Application connection (not mobile credential). */
function isCallControlApplicationOutbound(payload, platform) {
  const callControlApplicationId = getCallControlApplicationId(platform);
  const payloadConnectionId = payload?.connection_id ? String(payload.connection_id) : null;
  if (!callControlApplicationId || !payloadConnectionId) return false;
  if (!isOutboundDirection(payload?.direction)) return false;
  return payloadConnectionId === String(callControlApplicationId);
}

/**
 * Normalize Telnyx webhook payload for desk outbound V2.
 * @param {object} payload Raw Telnyx call.initiated payload
 * @param {object} platform Platform settings
 */
function normalizeDeskOutboundPayload(payload, platform) {
  const gate = describeCredentialConnectionOutboundGate(payload, platform);
  return {
    callControlId: payload?.call_control_id || null,
    callSessionId: payload?.call_session_id || null,
    direction: String(payload?.direction || '').toLowerCase() || null,
    connectionId: payload?.connection_id ? String(payload.connection_id) : null,
    acceptedAs: gate.acceptedAs || null,
    from: payload?.from ?? null,
    to: payload?.to ?? null,
    sipUsername: payload?.sip_username ?? payload?.username ?? null,
    outboundGate: gate,
    raw: payload,
  };
}

module.exports = {
  isPstnDestination,
  parseInternalExtensionDestination,
  extractSipUsername,
  looksLikeTelnyxCredentialUsername,
  isTelnyxCredentialSipDestination,
  parseCredentialSipUsername,
  isOutboundDirection,
  isDeskOriginatedParkedOutbound,
  isValidE164CallerId,
  callerResolutionPayloadSnapshot,
  describeCredentialConnectionOutboundGate,
  isCredentialConnectionOutbound,
  isCallControlApplicationOutbound,
  normalizeDeskOutboundPayload,
};
