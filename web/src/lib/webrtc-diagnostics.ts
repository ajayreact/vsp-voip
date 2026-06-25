import type { Call } from '@telnyx/webrtc';
import { verifyLocalAudioSenders, type LocalAudioSenderStatus } from '@/lib/webrtc-audio';

export type IceCandidateSummary = {
  id: string;
  candidateType: string;
  address: string | null;
  port: number | null;
  protocol: string | null;
};

export type SelectedCandidatePairSummary = {
  state: string | null;
  nominated: boolean | null;
  currentRoundTripTime: number | null;
  local: IceCandidateSummary | null;
  remote: IceCandidateSummary | null;
};

export type RtpDirectionStats = {
  packetsSent?: number;
  packetsReceived?: number;
  bytesSent?: number;
  bytesReceived?: number;
  jitter?: number | null;
  roundTripTime?: number | null;
};

export type AudioTrackSummary = {
  id: string;
  label: string;
  enabled: boolean;
  readyState: MediaStreamTrackState;
  muted: boolean;
};

export type BrowserNetworkInfo = {
  effectiveType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
  saveData: boolean | null;
  publicIp: string | null;
  vpnSuspected: boolean | null;
  vpnReason: string | null;
};

export type WebRtcDiagnosticsReport = {
  collectedAt: string;
  hasPeerConnection: boolean;
  iceConnectionState: RTCIceConnectionState | 'unavailable';
  iceGatheringState: RTCIceGatheringState | 'unavailable';
  connectionState: RTCPeerConnectionState | 'unavailable';
  signalingState: RTCSignalingState | 'unavailable';
  iceServers: RTCIceServer[];
  candidateCounts: {
    host: number;
    srflx: number;
    relay: number;
    prflx: number;
    unknown: number;
  };
  localCandidates: IceCandidateSummary[];
  remoteCandidates: IceCandidateSummary[];
  selectedCandidatePair: SelectedCandidatePairSummary | null;
  rtp: {
    outbound: RtpDirectionStats | null;
    inbound: RtpDirectionStats | null;
  };
  localAudioTracks: AudioTrackSummary[];
  remoteAudioTracks: AudioTrackSummary[];
  localAudioSenders: LocalAudioSenderStatus | null;
  network: BrowserNetworkInfo;
  alerts: string[];
  failureHints: string[];
};

type ConnectionLike = Navigator & {
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
    type?: string;
  };
};

function summarizeTrack(track: MediaStreamTrack): AudioTrackSummary {
  return {
    id: track.id,
    label: track.label || track.kind,
    enabled: track.enabled,
    readyState: track.readyState,
    muted: track.muted,
  };
}

function candidateFromReport(report: RTCStats): IceCandidateSummary {
  const row = report as RTCStats & {
    address?: string;
    ip?: string;
    port?: number;
    protocol?: string;
    candidateType?: string;
  };
  return {
    id: String(row.id),
    candidateType: String(row.candidateType || 'unknown'),
    address: row.address || row.ip || null,
    port: typeof row.port === 'number' ? row.port : null,
    protocol: row.protocol || null,
  };
}

function countCandidateTypes(candidates: IceCandidateSummary[]) {
  const counts = { host: 0, srflx: 0, relay: 0, prflx: 0, unknown: 0 };
  for (const candidate of candidates) {
    const type = candidate.candidateType as keyof typeof counts;
    if (type in counts) counts[type] += 1;
    else counts.unknown += 1;
  }
  return counts;
}

function collectBrowserNetworkInfo(srflxAddresses: string[]): BrowserNetworkInfo {
  const connection = (navigator as ConnectionLike).connection;
  const publicIp = srflxAddresses.find(Boolean) || null;

  let vpnSuspected: boolean | null = null;
  let vpnReason: string | null = null;

  if (typeof window !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    const vpnKeywords = ['vpn', 'wireguard', 'openvpn', 'cisco anyconnect', 'globalprotect', 'zscaler'];
    const uaHit = vpnKeywords.some((keyword) => ua.includes(keyword));
    if (uaHit) {
      vpnSuspected = true;
      vpnReason = 'User agent suggests VPN client software';
    } else if (publicIp && connection?.type === 'vpn') {
      vpnSuspected = true;
      vpnReason = 'Network Information API reports connection type "vpn"';
    } else if (publicIp) {
      vpnSuspected = false;
      vpnReason = null;
    }
  }

  return {
    effectiveType: connection?.effectiveType ?? null,
    downlinkMbps: typeof connection?.downlink === 'number' ? connection.downlink : null,
    rttMs: typeof connection?.rtt === 'number' ? connection.rtt : null,
    saveData: typeof connection?.saveData === 'boolean' ? connection.saveData : null,
    publicIp,
    vpnSuspected,
    vpnReason,
  };
}

function buildAlertsAndHints(input: {
  iceConnectionState: RTCIceConnectionState | 'unavailable';
  candidateCounts: WebRtcDiagnosticsReport['candidateCounts'];
  selectedCandidatePair: SelectedCandidatePairSummary | null;
  rtp: WebRtcDiagnosticsReport['rtp'];
}): { alerts: string[]; failureHints: string[] } {
  const alerts: string[] = [];
  const failureHints: string[] = [];

  const { iceConnectionState, candidateCounts, selectedCandidatePair, rtp } = input;

  if (iceConnectionState === 'failed') {
    alerts.push('ICE connection failed');
    failureHints.push('UDP blocked — corporate firewall may block UDP 3478 to stun.telnyx.com / turn.telnyx.com');
    failureHints.push('TURN unavailable — verify outbound TCP 443 to turn.telnyx.com is allowed');
    failureHints.push('Corporate firewall — allow rtc.telnyx.com:443 (signaling) and TURN endpoints');
    failureHints.push('Symmetric NAT — STUN reflexive candidates may fail; TURN relay is required');
  }

  if (iceConnectionState === 'disconnected') {
    alerts.push('ICE connection disconnected');
  }

  const relayOnlyLocal = candidateCounts.relay > 0
    && candidateCounts.host === 0
    && candidateCounts.srflx === 0;
  const selectedIsRelay = selectedCandidatePair?.local?.candidateType === 'relay'
    || selectedCandidatePair?.remote?.candidateType === 'relay';

  if (relayOnlyLocal || selectedIsRelay) {
    alerts.push('Corporate network detected. Media is relayed through TURN.');
  }

  if (rtp.outbound && rtp.outbound.packetsSent === 0 && iceConnectionState === 'connected') {
    alerts.push('No outbound RTP packets detected — remote party may not hear you');
  }

  if (rtp.inbound && rtp.inbound.packetsReceived === 0 && iceConnectionState === 'connected') {
    alerts.push('No inbound RTP packets detected — you may not hear the remote party');
  }

  return { alerts, failureHints };
}

export async function collectWebRtcDiagnostics(
  peerConnection: RTCPeerConnection | null | undefined,
  call?: Call | null,
): Promise<WebRtcDiagnosticsReport> {
  const collectedAt = new Date().toISOString();

  if (!peerConnection) {
    return {
      collectedAt,
      hasPeerConnection: false,
      iceConnectionState: 'unavailable',
      iceGatheringState: 'unavailable',
      connectionState: 'unavailable',
      signalingState: 'unavailable',
      iceServers: [],
      candidateCounts: { host: 0, srflx: 0, relay: 0, prflx: 0, unknown: 0 },
      localCandidates: [],
      remoteCandidates: [],
      selectedCandidatePair: null,
      rtp: { outbound: null, inbound: null },
      localAudioTracks: [],
      remoteAudioTracks: [],
      localAudioSenders: null,
      network: collectBrowserNetworkInfo([]),
      alerts: ['No active WebRTC peer connection. Place or receive a call on Softphone V2, then refresh.'],
      failureHints: [],
    };
  }

  const localCandidates: IceCandidateSummary[] = [];
  const remoteCandidates: IceCandidateSummary[] = [];
  let selectedCandidatePair: SelectedCandidatePairSummary | null = null;
  let outboundRtp: RtpDirectionStats | null = null;
  let inboundRtp: RtpDirectionStats | null = null;

  try {
    const stats = await peerConnection.getStats();
    const candidateMap = new Map<string, IceCandidateSummary>();

    stats.forEach((report) => {
      if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
        const summary = candidateFromReport(report);
        candidateMap.set(summary.id, summary);
        if (report.type === 'local-candidate') localCandidates.push(summary);
        else remoteCandidates.push(summary);
      }

      if (report.type === 'candidate-pair') {
        const pair = report as RTCStats & {
          selected?: boolean;
          nominated?: boolean;
          state?: string;
          currentRoundTripTime?: number;
          localCandidateId?: string;
          remoteCandidateId?: string;
        };
        const isSelected = pair.selected || pair.nominated || pair.state === 'succeeded';
        if (isSelected) {
          selectedCandidatePair = {
            state: pair.state ?? null,
            nominated: pair.nominated ?? null,
            currentRoundTripTime: typeof pair.currentRoundTripTime === 'number'
              ? pair.currentRoundTripTime
              : null,
            local: pair.localCandidateId ? candidateMap.get(pair.localCandidateId) ?? null : null,
            remote: pair.remoteCandidateId ? candidateMap.get(pair.remoteCandidateId) ?? null : null,
          };
        }
      }

      if (report.type === 'outbound-rtp' && (report as RTCRtpStreamStats).kind === 'audio') {
        const rtp = report as RTCRtpStreamStats & {
          packetsSent?: number;
          bytesSent?: number;
          roundTripTime?: number;
        };
        outboundRtp = {
          packetsSent: rtp.packetsSent,
          bytesSent: rtp.bytesSent,
          roundTripTime: typeof rtp.roundTripTime === 'number' ? rtp.roundTripTime : null,
        };
      }

      if (report.type === 'inbound-rtp' && (report as RTCRtpStreamStats).kind === 'audio') {
        const rtp = report as RTCRtpStreamStats & {
          packetsReceived?: number;
          bytesReceived?: number;
          jitter?: number;
        };
        inboundRtp = {
          packetsReceived: rtp.packetsReceived,
          bytesReceived: rtp.bytesReceived,
          jitter: typeof rtp.jitter === 'number' ? rtp.jitter : null,
        };
      }
    });
  } catch {
    // getStats may fail while connection is torn down
  }

  const localAudioTracks = peerConnection.getSenders()
    .map((sender) => sender.track)
    .filter((track): track is MediaStreamTrack => track?.kind === 'audio')
    .map(summarizeTrack);

  const remoteAudioTracks = peerConnection.getReceivers()
    .map((receiver) => receiver.track)
    .filter((track): track is MediaStreamTrack => track?.kind === 'audio')
    .map(summarizeTrack);

  const localAudioSenders = call ? verifyLocalAudioSenders(call, peerConnection) : null;

  const srflxAddresses = localCandidates
    .filter((candidate) => candidate.candidateType === 'srflx')
    .map((candidate) => candidate.address)
    .filter((address): address is string => Boolean(address));

  const candidateCounts = countCandidateTypes(localCandidates);
  const { alerts, failureHints } = buildAlertsAndHints({
    iceConnectionState: peerConnection.iceConnectionState,
    candidateCounts,
    selectedCandidatePair,
    rtp: { outbound: outboundRtp, inbound: inboundRtp },
  });

  let iceServers: RTCIceServer[] = [];
  try {
    iceServers = peerConnection.getConfiguration().iceServers ?? [];
  } catch {
    iceServers = [];
  }

  return {
    collectedAt,
    hasPeerConnection: true,
    iceConnectionState: peerConnection.iceConnectionState,
    iceGatheringState: peerConnection.iceGatheringState,
    connectionState: peerConnection.connectionState,
    signalingState: peerConnection.signalingState,
    iceServers,
    candidateCounts,
    localCandidates,
    remoteCandidates,
    selectedCandidatePair,
    rtp: {
      outbound: outboundRtp,
      inbound: inboundRtp,
    },
    localAudioTracks,
    remoteAudioTracks,
    localAudioSenders,
    network: collectBrowserNetworkInfo(srflxAddresses),
    alerts,
    failureHints,
  };
}

export function downloadWebRtcDiagnosticsReport(report: WebRtcDiagnosticsReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = report.collectedAt.replace(/[:.]/g, '-');
  anchor.href = url;
  anchor.download = `vsp-webrtc-diagnostics-${stamp}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function iceStateTone(state: string): 'ok' | 'warn' | 'error' | 'neutral' {
  if (state === 'connected' || state === 'completed') return 'ok';
  if (state === 'checking' || state === 'new' || state === 'gathering') return 'warn';
  if (state === 'failed' || state === 'disconnected' || state === 'closed') return 'error';
  return 'neutral';
}
