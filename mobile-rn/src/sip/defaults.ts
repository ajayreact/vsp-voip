import type { SipCodecEntry, SipProfile } from './types';

export const TELNYX_SIP_SERVER = 'sip.telnyx.com';
export const TELNYX_STUN_SERVER = 'stun.telnyx.com:3478';
export const TELNYX_TURN_SERVER = 'turn.telnyx.com:3478';

export const DEFAULT_CODECS: SipCodecEntry[] = [
  { id: 'opus', label: 'Opus', enabled: true },
  { id: 'g722', label: 'G722', enabled: true },
  { id: 'pcmu', label: 'G711u (PCMU)', enabled: true },
  { id: 'pcma', label: 'G711a (PCMA)', enabled: true },
  { id: 'g729', label: 'G729', enabled: false, licensed: true },
  { id: 'gsm', label: 'GSM', enabled: false },
  { id: 'ilbc', label: 'iLBC', enabled: false },
];

export function createTelnyxDefaultProfile(overrides: Partial<SipProfile> = {}): SipProfile {
  return {
    profileName: 'Telnyx Enterprise',
    displayName: '',
    extension: '',
    sipUsername: '',
    authUsername: '',
    password: '',

    sipServer: TELNYX_SIP_SERVER,
    secondarySipServer: '',
    sipPort: '5061',
    transport: 'TLS',

    outboundProxy: `${TELNYX_SIP_SERVER}:5061`,
    secondaryProxy: '',
    stunServer: TELNYX_STUN_SERVER,
    keepAlive: true,
    keepAliveIntervalSec: '30',
    registrationExpirySec: '3600',

    codecs: DEFAULT_CODECS.map((codec) => ({ ...codec })),
    dtmfMode: 'RFC2833',
    natTraversal: 'ICE',

    srtp: 'Optional',
    tlsVersion: 'TLS 1.2',
    verifyServerCertificate: true,

    echoCancellation: true,
    noiseSuppression: true,
    automaticGainControl: true,
    voiceActivityDetection: false,
    comfortNoise: true,
    adaptiveJitterBuffer: true,

    autoAnswer: false,
    callWaiting: true,
    doNotDisturb: false,
    autoRecordCalls: false,
    callRecordingPath: '',

    voicemailNumber: '',
    mailboxId: '',

    sipSessionTimerSec: '1800',
    sessionRefresh: 'UAC',
    dnsSrvLookup: true,
    dnsNaptr: true,
    rport: true,
    symmetricRtp: true,
    rewriteContactHeader: true,
    useCompactSipHeaders: false,
    sipOptionsKeepalive: true,
    sipOptionsKeepaliveIntervalSec: '30',

    enableSipLogs: false,
    enableRtpLogs: false,
    logLevel: 'ERROR',

    rtpPortRangeStart: '10000',
    rtpPortRangeEnd: '20000',
    rtpTimeoutSec: '60',
    localSipPort: '',
    localRtpPort: '',
    callerId: '',

    ...overrides,
  };
}

export const FIELD_TOOLTIPS: Record<string, string> = {
  profileName: 'Friendly label for this SIP profile in VSP Phone.',
  displayName: 'Caller ID name sent on outbound calls.',
  extension: 'Internal extension number for your organization.',
  sipUsername: 'SIP User ID registered with Telnyx (often matches your telephony credential username).',
  authUsername: 'Authentication ID if different from SIP username (Grandstream: Authentication ID).',
  password: 'SIP authentication password from your Telnyx telephony credential.',
  sipServer: 'Primary SIP registrar. For Telnyx use sip.telnyx.com.',
  secondarySipServer: 'Failover SIP server if your provider supports secondary registration.',
  sipPort: 'Signaling port. Telnyx TLS uses 5061; UDP/TCP typically use 5060.',
  transport: 'TLS is recommended for Telnyx enterprise deployments.',
  outboundProxy: 'Outbound proxy for NAT traversal. Telnyx TLS: sip.telnyx.com:5061.',
  secondaryProxy: 'Optional backup outbound proxy.',
  stunServer: 'STUN server for NAT discovery. Telnyx: stun.telnyx.com:3478.',
  keepAlive: 'Sends periodic SIP keep-alive packets to maintain NAT bindings.',
  registrationExpirySec: 'REGISTER expiry in seconds. Telnyx default: 3600.',
  dtmfMode: 'RFC2833 (telephone-event) is recommended for Telnyx.',
  natTraversal: 'ICE is recommended for WebRTC and mobile softphones on Telnyx.',
  srtp: 'Optional allows SRTP when negotiated; Mandatory requires encrypted media.',
  verifyServerCertificate: 'Validate TLS certificates when using TLS transport.',
  dnsSrvLookup: 'Resolve _sip._tls SRV records for Telnyx (recommended).',
  symmetricRtp: 'Send RTP to the source address of received RTP (recommended for NAT).',
  sipOptionsKeepalive: 'Send SIP OPTIONS as a lightweight keep-alive.',
};
