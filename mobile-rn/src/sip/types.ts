export type SipTransport = 'UDP' | 'TCP' | 'TLS';
export type DtmfMode = 'RFC2833' | 'SIP INFO' | 'In-band';
export type NatTraversal = 'None' | 'STUN' | 'ICE' | 'TURN';
export type SrtpMode = 'Disabled' | 'Optional' | 'Mandatory';
export type TlsVersion = 'TLS 1.2' | 'TLS 1.3';
export type SessionRefresh = 'UAC' | 'UAS' | 'Disabled';
export type LogLevel = 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';

export type SipCodecId =
  | 'opus'
  | 'g722'
  | 'pcmu'
  | 'pcma'
  | 'g729'
  | 'gsm'
  | 'ilbc';

export type SipCodecEntry = {
  id: SipCodecId;
  label: string;
  enabled: boolean;
  licensed?: boolean;
};

export type SipProfile = {
  profileName: string;
  displayName: string;
  extension: string;
  sipUsername: string;
  authUsername: string;
  password: string;

  sipServer: string;
  secondarySipServer: string;
  sipPort: string;
  transport: SipTransport;

  outboundProxy: string;
  secondaryProxy: string;
  stunServer: string;
  keepAlive: boolean;
  keepAliveIntervalSec: string;
  registrationExpirySec: string;

  codecs: SipCodecEntry[];
  dtmfMode: DtmfMode;
  natTraversal: NatTraversal;

  srtp: SrtpMode;
  tlsVersion: TlsVersion;
  verifyServerCertificate: boolean;

  echoCancellation: boolean;
  noiseSuppression: boolean;
  automaticGainControl: boolean;
  voiceActivityDetection: boolean;
  comfortNoise: boolean;
  adaptiveJitterBuffer: boolean;

  autoAnswer: boolean;
  callWaiting: boolean;
  doNotDisturb: boolean;
  autoRecordCalls: boolean;
  callRecordingPath: string;

  voicemailNumber: string;
  mailboxId: string;

  sipSessionTimerSec: string;
  sessionRefresh: SessionRefresh;
  dnsSrvLookup: boolean;
  dnsNaptr: boolean;
  rport: boolean;
  symmetricRtp: boolean;
  rewriteContactHeader: boolean;
  useCompactSipHeaders: boolean;
  sipOptionsKeepalive: boolean;
  sipOptionsKeepaliveIntervalSec: string;

  enableSipLogs: boolean;
  enableRtpLogs: boolean;
  logLevel: LogLevel;

  rtpPortRangeStart: string;
  rtpPortRangeEnd: string;
  rtpTimeoutSec: string;
  localSipPort: string;
  localRtpPort: string;
  callerId: string;
};

export type SipConnectionSnapshot = {
  status: 'registered' | 'connecting' | 'not_registered';
  registeredServer: string | null;
  publicIp: string | null;
  transport: SipTransport | null;
  selectedCodec: string | null;
  registrationExpiryAt: number | null;
  lastRegistrationAt: number | null;
  roundTripLatencyMs: number | null;
};

export type SipProfileValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
};

export const SIP_SECTIONS = [
  { id: 'account', title: 'Account', keywords: ['profile', 'display', 'extension', 'username', 'password', 'auth'] },
  { id: 'server', title: 'Server', keywords: ['sip server', 'port', 'transport', 'tls', 'udp', 'tcp'] },
  { id: 'network', title: 'Network', keywords: ['proxy', 'stun', 'keep alive', 'registration', 'expiry'] },
  { id: 'codecs', title: 'Preferred Codecs', keywords: ['opus', 'g722', 'pcmu', 'pcma', 'g729', 'gsm', 'ilbc', 'codec'] },
  { id: 'dtmf', title: 'DTMF', keywords: ['dtmf', 'rfc2833', 'sip info', 'in-band'] },
  { id: 'nat', title: 'NAT Traversal', keywords: ['nat', 'stun', 'ice', 'turn'] },
  { id: 'security', title: 'Security', keywords: ['srtp', 'tls', 'certificate'] },
  { id: 'audio', title: 'Audio', keywords: ['echo', 'noise', 'gain', 'jitter', 'vad', 'comfort'] },
  { id: 'callFeatures', title: 'Call Features', keywords: ['auto answer', 'waiting', 'dnd', 'record'] },
  { id: 'voicemail', title: 'Voicemail', keywords: ['voicemail', 'mailbox'] },
  { id: 'advanced', title: 'Advanced', keywords: ['session timer', 'dns', 'srv', 'naptr', 'rport', 'symmetric', 'compact', 'options'] },
  { id: 'logging', title: 'Logging', keywords: ['log', 'debug', 'rtp', 'sip logs'] },
  { id: 'status', title: 'Connection Status', keywords: ['registered', 'connecting', 'latency', 'transport'] },
] as const;

export type SipSectionId = (typeof SIP_SECTIONS)[number]['id'];
