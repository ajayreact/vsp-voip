import type { DtmfMode, NatTraversal, SipCodecId, SipProfile, SipTransport, SrtpMode } from './types';
import { createTelnyxDefaultProfile, DEFAULT_CODECS, TELNYX_SIP_SERVER } from './defaults';

type GrandstreamExport = {
  format: 'grandstream-compatible';
  version: 1;
  exportedAt: string;
  profile: Record<string, string | number | boolean | string[]>;
};

export function profileToExportJson(profile: SipProfile): string {
  const payload = {
    format: 'vsp-sip-profile',
    version: 2,
    exportedAt: new Date().toISOString(),
    profile,
    grandstream: buildGrandstreamFields(profile),
  };
  return JSON.stringify(payload, null, 2);
}

export function profileToGrandstreamJson(profile: SipProfile): string {
  const payload: GrandstreamExport = {
    format: 'grandstream-compatible',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: buildGrandstreamFields(profile),
  };
  return JSON.stringify(payload, null, 2);
}

function buildGrandstreamFields(profile: SipProfile): Record<string, string | number | boolean | string[]> {
  return {
    'SIP Server': profile.sipServer,
    'Secondary SIP Server': profile.secondarySipServer,
    'Outbound Proxy': profile.outboundProxy,
    'SIP User ID': profile.sipUsername,
    'Authentication ID': profile.authUsername || profile.sipUsername,
    'Authentication Password': profile.password,
    'SIP Port': Number(profile.sipPort) || 5061,
    Transport: profile.transport,
    'Preferred Vocoder Order': profile.codecs.filter((c) => c.enabled).map((c) => c.label),
    'DTMF Mode': profile.dtmfMode,
    'Registration Expiration': Number(profile.registrationExpirySec) || 3600,
    'SIP Keep Alive': profile.keepAlive,
    SRTP: profile.srtp,
    STUN: profile.stunServer,
    ICE: profile.natTraversal === 'ICE',
    'RTP Port Range': `${profile.rtpPortRangeStart}-${profile.rtpPortRangeEnd}`,
    'DNS SRV': profile.dnsSrvLookup,
    'Symmetric RTP': profile.symmetricRtp,
    'RTP Timeout': Number(profile.rtpTimeoutSec) || 60,
    'Local SIP Port': profile.localSipPort,
    'Local RTP Port': profile.localRtpPort,
    'Caller ID': profile.callerId || profile.extension,
    'Display Name': profile.displayName,
  };
}

function normalizeTransport(value: unknown): SipTransport {
  const raw = String(value ?? '').toUpperCase();
  if (raw === 'TCP') return 'TCP';
  if (raw === 'UDP') return 'UDP';
  return 'TLS';
}

function normalizeDtmf(value: unknown): DtmfMode {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('info')) return 'SIP INFO';
  if (raw.includes('in-band') || raw.includes('inband')) return 'In-band';
  return 'RFC2833';
}

function normalizeNat(value: unknown): NatTraversal {
  const raw = String(value ?? '').toUpperCase();
  if (raw === 'STUN') return 'STUN';
  if (raw === 'TURN') return 'TURN';
  if (raw === 'NONE') return 'None';
  return 'ICE';
}

function normalizeSrtp(value: unknown): SrtpMode {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('mandatory') || raw.includes('required')) return 'Mandatory';
  if (raw.includes('disabled') || raw === 'off') return 'Disabled';
  return 'Optional';
}

function mergeCodecOrder(labels: string[]): SipProfile['codecs'] {
  const order = labels.map((label) => label.toLowerCase());
  const rank = (id: SipCodecId) => {
    const label = DEFAULT_CODECS.find((c) => c.id === id)?.label.toLowerCase() ?? id;
    const idx = order.findIndex((entry) => label.includes(entry) || entry.includes(label));
    return idx === -1 ? 999 : idx;
  };
  return DEFAULT_CODECS
    .map((codec) => ({ ...codec }))
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map((codec, index) => ({
      ...codec,
      enabled: index < 4 || order.some((entry) => codec.label.toLowerCase().includes(entry)),
    }));
}

export function importSipProfileJson(raw: string): SipProfile {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const base = createTelnyxDefaultProfile();

  if (parsed.type === 'vsp-sip-provision' && parsed.sip && typeof parsed.sip === 'object') {
    return mergeQrSipPayload(base, parsed);
  }

  const envelope = (parsed.profile && typeof parsed.profile === 'object')
    ? (parsed.profile as Record<string, unknown>)
    : parsed;

  const gs = parsed.grandstream && typeof parsed.grandstream === 'object'
    ? (parsed.grandstream as Record<string, unknown>)
    : envelope;

  const vocoder = gs['Preferred Vocoder Order'] ?? envelope.codecs;
  const codecs = Array.isArray(vocoder)
    ? mergeCodecOrder(vocoder.map(String))
    : base.codecs;

  return {
    ...base,
    profileName: String(envelope.profileName ?? gs['Profile Name'] ?? parsed.displayName ?? base.profileName),
    displayName: String(envelope.displayName ?? gs['Display Name'] ?? parsed.displayName ?? ''),
    extension: String(envelope.extension ?? parsed.extensionNumber ?? gs['Caller ID'] ?? ''),
    sipUsername: String(envelope.sipUsername ?? gs['SIP User ID'] ?? gs.username ?? ''),
    authUsername: String(envelope.authUsername ?? gs['Authentication ID'] ?? gs.authId ?? ''),
    password: String(envelope.password ?? gs['Authentication Password'] ?? gs.password ?? ''),
    sipServer: String(envelope.sipServer ?? gs['SIP Server'] ?? gs.server ?? TELNYX_SIP_SERVER),
    secondarySipServer: String(envelope.secondarySipServer ?? gs['Secondary SIP Server'] ?? ''),
    sipPort: String(envelope.sipPort ?? gs['SIP Port'] ?? (normalizeTransport(gs.Transport ?? envelope.transport) === 'TLS' ? '5061' : '5060')),
    transport: normalizeTransport(gs.Transport ?? envelope.transport),
    outboundProxy: String(envelope.outboundProxy ?? gs['Outbound Proxy'] ?? ''),
    secondaryProxy: String(envelope.secondaryProxy ?? gs['Secondary Proxy'] ?? ''),
    stunServer: String(envelope.stunServer ?? gs.STUN ?? base.stunServer),
    keepAlive: Boolean(envelope.keepAlive ?? gs['SIP Keep Alive'] ?? true),
    keepAliveIntervalSec: String(envelope.keepAliveIntervalSec ?? gs['Keepalive Interval'] ?? '30'),
    registrationExpirySec: String(envelope.registrationExpirySec ?? gs['Registration Expiration'] ?? '3600'),
    codecs,
    dtmfMode: normalizeDtmf(gs['DTMF Mode'] ?? envelope.dtmfMode),
    natTraversal: normalizeNat(envelope.natTraversal ?? (gs.ICE ? 'ICE' : base.natTraversal)),
    srtp: normalizeSrtp(gs.SRTP ?? envelope.srtp),
    tlsVersion: envelope.tlsVersion === 'TLS 1.3' ? 'TLS 1.3' : 'TLS 1.2',
    verifyServerCertificate: envelope.verifyServerCertificate !== false,
    callerId: String(envelope.callerId ?? gs['Caller ID'] ?? ''),
    dnsSrvLookup: envelope.dnsSrvLookup !== false && gs['DNS SRV'] !== false,
    symmetricRtp: envelope.symmetricRtp !== false && gs['Symmetric RTP'] !== false,
    rtpPortRangeStart: String(envelope.rtpPortRangeStart ?? '10000'),
    rtpPortRangeEnd: String(envelope.rtpPortRangeEnd ?? '20000'),
    rtpTimeoutSec: String(envelope.rtpTimeoutSec ?? gs['RTP Timeout'] ?? '60'),
    localSipPort: String(envelope.localSipPort ?? gs['Local SIP Port'] ?? ''),
    localRtpPort: String(envelope.localRtpPort ?? gs['Local RTP Port'] ?? ''),
  };
}

function mergeQrSipPayload(base: SipProfile, parsed: Record<string, unknown>): SipProfile {
  const sip = parsed.sip as Record<string, unknown>;
  const transport = normalizeTransport(sip.transport);
  const port = String(sip.portTls ?? sip.port ?? (transport === 'TLS' ? '5061' : '5060'));

  return {
    ...base,
    profileName: String(parsed.displayName ?? base.profileName),
    displayName: String(parsed.displayName ?? ''),
    extension: String(parsed.extensionNumber ?? ''),
    sipUsername: String(sip.username ?? ''),
    authUsername: String(sip.authId ?? sip.username ?? ''),
    password: String(sip.password ?? ''),
    sipServer: String(sip.server ?? TELNYX_SIP_SERVER),
    sipPort: port,
    transport,
    outboundProxy: String(sip.outboundProxy ?? `${sip.server ?? TELNYX_SIP_SERVER}:${port}`),
  };
}

export function buildServerInfoBlock(profile: SipProfile): string {
  return [
    `Profile: ${profile.profileName}`,
    `SIP Server: ${profile.sipServer}`,
    `Port: ${profile.sipPort} (${profile.transport})`,
    `Outbound Proxy: ${profile.outboundProxy || '—'}`,
    `Username: ${profile.sipUsername || '—'}`,
    `Auth ID: ${profile.authUsername || profile.sipUsername || '—'}`,
    `Extension: ${profile.extension || '—'}`,
    `STUN: ${profile.stunServer || '—'}`,
    `Registration: ${profile.registrationExpirySec}s`,
    `Codecs: ${profile.codecs.filter((c) => c.enabled).map((c) => c.label).join(', ') || '—'}`,
  ].join('\n');
}
