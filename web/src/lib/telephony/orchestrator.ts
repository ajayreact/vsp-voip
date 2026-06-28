import type { Call } from '@telnyx/webrtc';
import {
  createInitialTelephonySnapshot,
  reduceCallEvent,
  reduceConnectionEvent,
  tickDuration,
} from './call-fsm';
import { evaluateInternalBridgeAutoAnswer } from './internal-bridge-policy';
import { summarizeSnapshot } from './diagnostics';
import { logDiagnosticTimeline, logTelephony } from './logger';
import { syncRingbackWithSnapshot } from './ringback-controller';
import {
  mapSdkStateToCallEvents,
  normalizeSdkCallState,
  shouldConfirmRemoteAnswer,
} from './telnyx-mapper';
import type {
  CallKind,
  TelephonyCallEvent,
  TelephonyConnectionEvent,
  TelephonySnapshot,
} from './types';
import { LIVE_CALL_PHASES } from './types';

export type TelephonyOrchestratorOptions = {
  onSnapshotChange?: (snapshot: TelephonySnapshot, prev: TelephonySnapshot) => void;
  getRemoteAudioElement?: () => HTMLAudioElement | null;
};

export class TelephonyOrchestrator {
  private snapshot: TelephonySnapshot = createInitialTelephonySnapshot();
  private readonly options: TelephonyOrchestratorOptions;

  constructor(options: TelephonyOrchestratorOptions = {}) {
    this.options = options;
  }

  getSnapshot(): TelephonySnapshot {
    return this.snapshot;
  }

  dispatchConnection(event: TelephonyConnectionEvent) {
    this.apply(() => reduceConnectionEvent(this.snapshot, event));
  }

  dispatchCall(event: TelephonyCallEvent) {
    logDiagnosticTimeline('fsm.dispatch', this.snapshot, {
      dispatchedEvent: event.type,
      fromPhase: this.snapshot.callPhase,
      reducer: 'reduceCallEvent',
      eventPayload: event,
    });
    this.apply(() => reduceCallEvent(this.snapshot, event));
  }

  dispatchSdkNotification(call: Call, eventType?: string, userAnswered?: boolean) {
    const normalized = normalizeSdkCallState(call.state);
    const callId = call.id ?? '';
    const events = mapSdkStateToCallEvents(normalized, callId);

    logDiagnosticTimeline('sdk.dispatchSdkNotification', this.snapshot, {
      notificationType: eventType,
      sdkState: normalized,
      sdkPrevState: normalizeCallPrevStateForLog(call),
      callId,
      mappedEvents: events.map((entry) => entry.type),
    });

    for (const event of events) {
      this.dispatchCall(event);
    }

    if (normalized === 'active' && callId && this.snapshot.session) {
      const confirm = shouldConfirmRemoteAnswer({
        call,
        session: this.snapshot.session,
        eventType,
        userAnswered,
      });
      if (confirm.confirmed) {
        logDiagnosticTimeline('answer.REMOTE_ANSWER_CONFIRMED.dispatch', this.snapshot, {
          callId,
          source: confirm.source,
          reason: confirm.reason,
        });
        this.dispatchCall({
          type: 'REMOTE_ANSWER_CONFIRMED',
          callId,
          source: confirm.source,
        });
      }
    }

    void this.syncRingback(null);
  }

  receiveInbound(input: {
    callId: string;
    remoteLabel: string;
    logFrom: string;
    logTo: string;
    callerNameHint?: string | null;
  }) {
    this.dispatchCall({ type: 'INBOUND_RECEIVED', ...input });
  }

  updateSessionLabel(remoteLabel: string, callerNameHint?: string | null) {
    this.dispatchCall({ type: 'SESSION_LABEL', remoteLabel, callerNameHint });
  }

  updateSessionLogParties(logFrom: string, logTo: string) {
    this.dispatchCall({ type: 'SESSION_LOG_PARTIES', logFrom, logTo });
  }

  setMuted(muted: boolean) {
    this.dispatchCall({ type: 'MUTE_TOGGLED', muted });
  }

  holdStarted() {
    this.dispatchCall({ type: 'HOLD_STARTED' });
  }

  holdEnded() {
    this.dispatchCall({ type: 'HOLD_ENDED' });
  }

  setConnectionStatus(message: string) {
    this.dispatchConnection({ type: 'CONN_STATUS', message });
  }

  reconnectAttempt(attempt: number) {
    this.dispatchConnection({ type: 'CONN_RECONNECTING', attempt });
  }

  async beginOutboundDial(destination: string, kind: CallKind) {
    this.dispatchCall({ type: 'DIAL_REQUESTED', destination, kind });
    await this.syncRingback(null);
  }

  acceptDial(callId: string, callControlId?: string | null) {
    this.dispatchCall({ type: 'DIAL_ACCEPTED', callId, callControlId });
  }

  failDial(reason: string) {
    this.dispatchCall({ type: 'DIAL_FAILED', reason });
    void this.syncRingback(null);
  }

  requestHangup() {
    this.dispatchCall({ type: 'HANGUP_REQUESTED' });
    void this.syncRingback(null);
  }

  terminal(reason: string) {
    this.dispatchCall({ type: 'SDK_TERMINAL', reason });
    void this.syncRingback(null);
  }

  reset() {
    this.dispatchCall({ type: 'RESET' });
    void this.syncRingback(null);
  }

  evaluateBridgeAutoAnswer(call: Call): boolean {
    const evaluation = evaluateInternalBridgeAutoAnswer({
      pending: this.snapshot.pendingInternal,
      call,
      hasLiveCall: LIVE_CALL_PHASES.has(this.snapshot.callPhase)
        && this.snapshot.callPhase !== 'dialing'
        && !this.snapshot.pendingInternal
        && Boolean(this.snapshot.session?.callId)
        && this.snapshot.session?.callId !== 'pending',
    });

    logTelephony(
      evaluation.allowed ? 'info' : 'warn',
      'bridge.auto_answer.evaluated',
      { ...this.snapshot, detail: { reason: evaluation.reason, callId: call.id } },
    );

    return evaluation.allowed;
  }

  onBridgeLegArrived(callId: string) {
    this.dispatchCall({ type: 'BRIDGE_LEG_ARRIVED', callId });
  }

  onBridgeAutoAnswered(callId: string) {
    this.dispatchCall({ type: 'BRIDGE_AUTO_ANSWERED', callId });
  }

  tickTimer(now = Date.now()) {
    this.apply(() => tickDuration(this.snapshot, now));
  }

  canPlaceCall(input: {
    destination: string;
    callerNumber: string;
    isValidDial: boolean;
  }): boolean {
    const { connection, socketConnected, callPhase } = this.snapshot;
    return connection === 'ready'
      && socketConnected
      && !LIVE_CALL_PHASES.has(callPhase)
      && input.isValidDial
      && Boolean(input.callerNumber);
  }

  isConnected(): boolean {
    return this.snapshot.callPhase === 'connected'
      || this.snapshot.callPhase === 'hold'
      || this.snapshot.callPhase === 'recording';
  }

  getDurationSeconds(): number {
    return this.snapshot.session?.durationSeconds ?? 0;
  }

  async syncRingback(call: { stopRingback?: () => void } | null) {
    await syncRingbackWithSnapshot(this.snapshot, call);
  }

  private apply(mutator: () => TelephonySnapshot) {
    const prev = this.snapshot;
    this.snapshot = mutator();
    const summary = summarizeSnapshot(this.snapshot);
    const prevSummary = summarizeSnapshot(prev);
    const connectedAtAssigned = !prev.session?.connectedAt && Boolean(this.snapshot.session?.connectedAt);
    logDiagnosticTimeline('snapshot.updated', this.snapshot, {
      ...summary,
      previous: prevSummary,
      phaseChanged: prev.callPhase !== this.snapshot.callPhase,
      connectedAtAssigned,
      connectedAtValue: this.snapshot.session?.connectedAt ?? null,
    });
    if (connectedAtAssigned) {
      logDiagnosticTimeline('timer.connectedAt.assigned', this.snapshot, {
        connectedAt: this.snapshot.session?.connectedAt,
      });
    }
    this.options.onSnapshotChange?.(this.snapshot, prev);
  }
}

export function createTelephonyOrchestrator(options?: TelephonyOrchestratorOptions) {
  return new TelephonyOrchestrator(options);
}

function normalizeCallPrevStateForLog(call: Call): string {
  const extended = call as Call & { prevState?: string | number };
  if (typeof extended.prevState === 'number' && Number.isFinite(extended.prevState)) {
    const states = [
      'new', 'requesting', 'trying', 'recovering', 'ringing', 'answering',
      'early', 'active', 'held', 'hangup', 'destroy', 'purge',
    ];
    return states[extended.prevState] ?? String(extended.prevState);
  }
  return String(extended.prevState ?? '').trim().toLowerCase();
}
