import type { SipProfile, SipProfileValidationResult } from './types';

function requireNonEmpty(value: string, message: string): string | null {
  return value.trim() ? null : message;
}

function requirePort(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  const port = Number(trimmed);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return `${label} must be between 1 and 65535.`;
  }
  return null;
}

function requirePositiveInt(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num <= 0) {
    return `${label} must be a positive number.`;
  }
  return null;
}

export function validateSipProfile(profile: SipProfile): SipProfileValidationResult {
  const errors: Record<string, string> = {};

  const profileNameErr = requireNonEmpty(profile.profileName, 'Profile name is required.');
  if (profileNameErr) errors.profileName = profileNameErr;

  const sipServerErr = requireNonEmpty(profile.sipServer, 'SIP server is required.');
  if (sipServerErr) errors.sipServer = sipServerErr;

  const portErr = requirePort(profile.sipPort, 'SIP port');
  if (portErr) errors.sipPort = portErr;

  if (profile.transport === 'TLS' && profile.sipPort === '5060') {
    errors.sipPort = 'Telnyx TLS typically uses port 5061, not 5060.';
  }

  if (profile.sipUsername.trim() && !profile.password.trim()) {
    errors.password = 'Password is required when a SIP username is set.';
  }

  if (profile.password.trim() && !profile.sipUsername.trim()) {
    errors.sipUsername = 'SIP username is required when a password is set.';
  }

  const regErr = requirePositiveInt(profile.registrationExpirySec, 'Registration expiry');
  if (regErr) errors.registrationExpirySec = regErr;

  const keepAliveErr = requirePositiveInt(profile.keepAliveIntervalSec, 'Keep-alive interval');
  if (keepAliveErr) errors.keepAliveIntervalSec = keepAliveErr;

  const enabledCodecs = profile.codecs.filter((c) => c.enabled);
  if (enabledCodecs.length === 0) {
    errors.codecs = 'Enable at least one preferred codec.';
  }

  if (profile.natTraversal === 'STUN' && !profile.stunServer.trim()) {
    errors.stunServer = 'STUN server is required when NAT traversal is STUN or ICE.';
  }

  if (profile.natTraversal === 'ICE' && !profile.stunServer.trim()) {
    errors.stunServer = 'STUN server is recommended for ICE (Telnyx: stun.telnyx.com:3478).';
  }

  if (profile.srtp === 'Mandatory' && profile.transport !== 'TLS') {
    errors.srtp = 'Mandatory SRTP requires TLS transport.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function friendlySipError(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : String(raw ?? '');
  const lower = message.toLowerCase();

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('403')) {
    return 'Authentication failed. Check your SIP username and password.';
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return 'SIP server not reachable. Verify the server address and port.';
  }
  if (lower.includes('408') || lower.includes('timeout')) {
    return 'Connection timed out. Check network, firewall, and SIP server settings.';
  }
  if (lower.includes('credential connection')) {
    return 'Voice service is not fully configured. Contact your administrator.';
  }
  if (lower.includes('login token') || lower.includes('softphone token')) {
    return 'Could not obtain a registration token. Verify your account and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network error. Check your internet connection and try again.';
  }
  if (lower.includes('certificate') || lower.includes('tls')) {
    return 'Secure connection failed. Verify TLS settings and certificate validation.';
  }

  return 'Could not complete the SIP operation. Review your settings and try again.';
}
