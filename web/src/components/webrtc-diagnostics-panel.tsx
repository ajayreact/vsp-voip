'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, RefreshCw, Radio } from 'lucide-react';
import {
  collectWebRtcDiagnostics,
  downloadWebRtcDiagnosticsReport,
  iceStateTone,
  type WebRtcDiagnosticsReport,
} from '@/lib/webrtc-diagnostics';
import {
  getWebRtcDiagnosticsRegistry,
  subscribeWebRtcDiagnosticsRegistry,
} from '@/lib/webrtc-diagnostics-registry';

function toneClass(tone: ReturnType<typeof iceStateTone>) {
  switch (tone) {
    case 'ok':
      return 'text-emerald-600';
    case 'warn':
      return 'text-amber-600';
    case 'error':
      return 'text-rose-600';
    default:
      return 'text-slate-600';
  }
}

function StateBadge({ label, value }: { label: string; value: string }) {
  const tone = iceStateTone(value);
  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold capitalize ${toneClass(tone)}`}>{value}</p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="font-mono text-sm text-slate-900">{value ?? '—'}</span>
    </div>
  );
}

function AlertBanner({ message, tone = 'info' }: { message: string; tone?: 'info' | 'warn' | 'error' }) {
  const styles = tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-900'
    : tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-blue-200 bg-blue-50 text-blue-900';
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>
      {message}
    </div>
  );
}

type WebRtcDiagnosticsPanelProps = {
  backHref?: string;
  backLabel?: string;
  pollMs?: number;
};

export function WebRtcDiagnosticsPanel({
  backHref = '/softphone-v2',
  backLabel = 'Back to Softphone',
  pollMs = 1000,
}: WebRtcDiagnosticsPanelProps) {
  const [report, setReport] = useState<WebRtcDiagnosticsReport | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const registry = getWebRtcDiagnosticsRegistry();
      const next = await collectWebRtcDiagnostics(
        registry?.peerConnection ?? null,
        registry?.call ?? null,
      );
      setReport(next);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timerId = window.setInterval(() => {
      void refresh();
    }, pollMs);
    const unsubscribe = subscribeWebRtcDiagnosticsRegistry(() => {
      void refresh();
    });
    return () => {
      window.clearInterval(timerId);
      unsubscribe();
    };
  }, [pollMs, refresh]);

  const exportReport = () => {
    if (!report) return;
    downloadWebRtcDiagnosticsReport(report);
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4">
        <div className="flex items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-[#007AFF] hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          ) : null}
          <div>
            <h1 className="text-xl font-bold text-slate-900">WebRTC Diagnostics</h1>
            <p className="text-xs text-slate-500">Live ICE, RTP, and network metrics</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportReport}
            disabled={!report}
            className="inline-flex items-center gap-2 rounded-full bg-[#007AFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#0066DD] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {!report?.hasPeerConnection ? (
          <AlertBanner
            tone="warn"
            message="No active call peer connection. Open Softphone V2, place or answer a call, then return here for live diagnostics."
          />
        ) : null}

        {report?.alerts.map((alert) => (
          <AlertBanner
            key={alert}
            tone={alert.includes('failed') || alert.includes('No ') ? 'error' : 'warn'}
            message={alert}
          />
        ))}

        {report?.failureHints.length ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <h2 className="text-sm font-semibold text-slate-900">Likely causes (ICE failed)</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {report.failureHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {report ? (
          <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StateBadge label="ICE Connection" value={report.iceConnectionState} />
              <StateBadge label="ICE Gathering" value={report.iceGatheringState} />
              <StateBadge label="Connection" value={report.connectionState} />
              <StateBadge label="Signaling" value={report.signalingState} />
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Radio className="h-4 w-4 text-[#007AFF]" />
                ICE Candidate Types (local)
              </h2>
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {(['host', 'srflx', 'relay', 'prflx', 'unknown'] as const).map((type) => (
                  <div key={type} className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                    <p className="text-xs uppercase text-slate-500">{type}</p>
                    <p className="text-lg font-semibold text-slate-900">{report.candidateCounts[type]}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <h2 className="text-sm font-semibold text-slate-900">Selected Candidate Pair</h2>
              {report.selectedCandidatePair ? (
                <div className="mt-3 space-y-2 font-mono text-xs text-slate-700">
                  <p>State: {report.selectedCandidatePair.state ?? '—'}</p>
                  <p>Nominated: {String(report.selectedCandidatePair.nominated ?? '—')}</p>
                  <p>RTT: {report.selectedCandidatePair.currentRoundTripTime ?? '—'}</p>
                  <p>
                    Local: {report.selectedCandidatePair.local?.candidateType ?? '—'}{' '}
                    {report.selectedCandidatePair.local?.address ?? ''}
                    {report.selectedCandidatePair.local?.port ? `:${report.selectedCandidatePair.local.port}` : ''}
                  </p>
                  <p>
                    Remote: {report.selectedCandidatePair.remote?.candidateType ?? '—'}{' '}
                    {report.selectedCandidatePair.remote?.address ?? ''}
                    {report.selectedCandidatePair.remote?.port ? `:${report.selectedCandidatePair.remote.port}` : ''}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No selected candidate pair yet.</p>
              )}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <h2 className="text-sm font-semibold text-slate-900">RTP Outbound</h2>
                <div className="mt-2">
                  <MetricRow label="packetsSent" value={report.rtp.outbound?.packetsSent} />
                  <MetricRow label="bytesSent" value={report.rtp.outbound?.bytesSent} />
                  <MetricRow label="roundTripTime" value={report.rtp.outbound?.roundTripTime} />
                </div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <h2 className="text-sm font-semibold text-slate-900">RTP Inbound</h2>
                <div className="mt-2">
                  <MetricRow label="packetsReceived" value={report.rtp.inbound?.packetsReceived} />
                  <MetricRow label="bytesReceived" value={report.rtp.inbound?.bytesReceived} />
                  <MetricRow label="jitter" value={report.rtp.inbound?.jitter} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <h2 className="text-sm font-semibold text-slate-900">Local Audio Tracks</h2>
                {report.localAudioTracks.length ? (
                  <ul className="mt-2 space-y-2 text-xs text-slate-700">
                    {report.localAudioTracks.map((track) => (
                      <li key={track.id} className="rounded-lg bg-slate-50 p-2 font-mono">
                        {track.label} · {track.readyState} · enabled={String(track.enabled)} · muted={String(track.muted)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No local audio tracks.</p>
                )}
                {report.localAudioSenders ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Senders live: {report.localAudioSenders.liveEnabledCount}/{report.localAudioSenders.senderCount}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <h2 className="text-sm font-semibold text-slate-900">Remote Audio Tracks</h2>
                {report.remoteAudioTracks.length ? (
                  <ul className="mt-2 space-y-2 text-xs text-slate-700">
                    {report.remoteAudioTracks.map((track) => (
                      <li key={track.id} className="rounded-lg bg-slate-50 p-2 font-mono">
                        {track.label} · {track.readyState} · enabled={String(track.enabled)} · muted={String(track.muted)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No remote audio tracks.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <h2 className="text-sm font-semibold text-slate-900">Browser Network</h2>
              <div className="mt-2">
                <MetricRow label="Public IP (srflx)" value={report.network.publicIp} />
                <MetricRow label="Network type" value={report.network.effectiveType} />
                <MetricRow label="Downlink (Mbps)" value={report.network.downlinkMbps} />
                <MetricRow label="RTT (ms)" value={report.network.rttMs} />
                <MetricRow label="Save-Data" value={report.network.saveData != null ? String(report.network.saveData) : null} />
                <MetricRow
                  label="VPN suspected"
                  value={
                    report.network.vpnSuspected == null
                      ? 'Unknown'
                      : report.network.vpnSuspected
                        ? `Yes${report.network.vpnReason ? ` — ${report.network.vpnReason}` : ''}`
                        : 'No'
                  }
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <h2 className="text-sm font-semibold text-slate-900">ICE Servers (from peer connection)</h2>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {JSON.stringify(report.iceServers, null, 2)}
              </pre>
            </section>

            <p className="pb-4 text-center text-xs text-slate-400">
              Last collected {report.collectedAt ? new Date(report.collectedAt).toLocaleString() : '—'}
            </p>
          </>
        ) : (
          <p className="py-12 text-center text-sm text-slate-500">Loading diagnostics…</p>
        )}
      </div>
    </div>
  );
}
