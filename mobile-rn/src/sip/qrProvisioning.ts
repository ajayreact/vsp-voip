import type { SipProfile } from './types';
import { createTelnyxDefaultProfile } from './defaults';
import { importSipProfileJson } from './importExport';

export type SipQrPayload = {
  v?: number;
  type: string;
  extensionId?: string;
  extensionNumber?: string;
  displayName?: string;
  sip?: {
    username?: string;
    password?: string;
    authId?: string;
    server?: string;
    port?: number;
    portTls?: number;
    transport?: string;
    outboundProxy?: string;
  };
};

export function parseSipQrPayload(raw: string): SipQrPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as SipQrPayload;
    if (parsed?.type === 'vsp-sip-provision') return parsed;
  } catch {
    // fall through
  }

  if (trimmed.startsWith('vsp-sip:')) {
    try {
      const encoded = trimmed.slice('vsp-sip:'.length);
      return JSON.parse(decodeURIComponent(encoded)) as SipQrPayload;
    } catch {
      return null;
    }
  }

  return null;
}

export function applyQrPayloadToProfile(payload: SipQrPayload, current?: SipProfile): SipProfile {
  const base = current ?? createTelnyxDefaultProfile();
  return importSipProfileJson(JSON.stringify(payload));
}

export function validateSipQrPayload(payload: SipQrPayload): string | null {
  if (payload.type !== 'vsp-sip-provision') {
    return 'This QR code is not a VSP SIP provisioning code.';
  }
  if (!payload.sip?.username) {
    return 'The QR code is missing SIP username information.';
  }
  if (!payload.sip?.server) {
    return 'The QR code is missing SIP server information.';
  }
  return null;
}
