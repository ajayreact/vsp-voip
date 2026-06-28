import { createTelnyxDefaultProfile } from './defaults';
import type { SipProfile, SipTransport, SrtpMode } from './types';

export type EmployeeProvisioningProfile = {
  tenantId?: string | null;
  tenantName?: string | null;
  employeeName?: string | null;
  extensionNumber?: string | null;
  displayName?: string | null;
  assignedDid?: string | null;
  sip?: {
    username?: string | null;
    password?: string | null;
    authId?: string | null;
    server?: string | null;
    port?: number | null;
    portTls?: number | null;
    transport?: string | null;
    outboundProxy?: string | null;
    registrationExpirySec?: number | null;
    symmetricRtp?: boolean | null;
    srtp?: string | null;
    codecs?: Array<{ id: string; label: string; enabled: boolean }>;
    dtmfMode?: string | null;
    stunServer?: string | null;
  };
};

function normalizeTransport(value: unknown): SipTransport {
  const raw = String(value ?? 'TLS').toUpperCase();
  if (raw === 'UDP') return 'UDP';
  if (raw === 'TCP') return 'TCP';
  return 'TLS';
}

function normalizeSrtp(value: unknown): SrtpMode {
  const raw = String(value ?? 'Optional');
  if (raw === 'Disabled') return 'Disabled';
  if (raw === 'Mandatory') return 'Mandatory';
  return 'Optional';
}

export function sipProfileFromProvisioningProfile(
  profile: EmployeeProvisioningProfile,
): SipProfile {
  const sip = profile.sip || {};
  const transport = normalizeTransport(sip.transport);
  const port = String(
    transport === 'TLS' ? (sip.portTls || 5061) : (sip.port || 5060),
  );

  const base = createTelnyxDefaultProfile({
    profileName: profile.tenantName
      ? `${profile.tenantName} — Ext ${profile.extensionNumber || ''}`.trim()
      : 'VSP Phone',
    displayName: profile.displayName || profile.employeeName || '',
    extension: profile.extensionNumber || '',
    sipUsername: sip.username || '',
    authUsername: sip.authId || sip.username || '',
    password: sip.password || '',
    sipServer: sip.server || 'sip.telnyx.com',
    sipPort: port,
    transport,
    outboundProxy: sip.outboundProxy || `${sip.server || 'sip.telnyx.com'}:${port}`,
    stunServer: sip.stunServer || 'stun.telnyx.com:3478',
    registrationExpirySec: String(sip.registrationExpirySec || 3600),
    symmetricRtp: sip.symmetricRtp !== false,
    srtp: normalizeSrtp(sip.srtp),
    callerId: profile.assignedDid || profile.extensionNumber || '',
  });

  if (Array.isArray(sip.codecs) && sip.codecs.length) {
    const enabledIds = new Set(
      sip.codecs.filter((codec) => codec.enabled).map((codec) => codec.id),
    );
    base.codecs = base.codecs.map((codec) => ({
      ...codec,
      enabled: enabledIds.has(codec.id),
    }));
  }

  return base;
}
