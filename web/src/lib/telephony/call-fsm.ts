import type {
  CallPhase,
  CallSessionContext,
  TelephonyCallEvent,
  TelephonySnapshot,
} from './types';
import { LIVE_CALL_PHASES } from './types';
import {
  mergeInboundCallerLabel,
  mergeInboundCallerNameHint,
} from '../inbound-caller-display';
import { logDiagnosticTimeline, logTransition } from './logger';

const CONNECTED_OR_ENDING_PHASES = new Set<CallPhase>([
  'connected',
  'hold',
  'transferring',
  'recording',
  'ending',
]);

function cloneSession(session: CallSessionContext | null): CallSessionContext | null {
  return session ? { ...session } : null;
}

function withPhase(
  snapshot: TelephonySnapshot,
  callPhase: CallPhase,
  reason: string,
  patch?: Partial<TelephonySnapshot>,
): TelephonySnapshot {
  const prev = snapshot.callPhase;
  if (prev !== callPhase) {
    logTransition({ ...snapshot, ...patch, callPhase }, prev, callPhase, reason);
  }
  return {
    ...snapshot,
    ...patch,
    callPhase,
    lastTransitionAt: Date.now(),
    lastTransitionReason: reason,
  };
}

export function createInitialTelephonySnapshot(): TelephonySnapshot {
  return {
    connection: 'disconnected',
    callPhase: 'idle',
    session: null,
    socketConnected: false,
    connectionMessage: '',
    reconnectAttempt: 0,
    lastTransitionAt: Date.now(),
    lastTransitionReason: 'init',
  };
}

export function reduceConnectionEvent(
  snapshot: TelephonySnapshot,
  event: import('./types').TelephonyConnectionEvent,
): TelephonySnapshot {
  switch (event.type) {
    case 'CONN_CONNECTING':
      return {
        ...snapshot,
        connection: 'connecting',
        connectionMessage: 'Connecting…',
        lastTransitionReason: 'connecting',
      };
    case 'CONN_REGISTERING':
      return {
        ...snapshot,
        connection: 'registering',
        connectionMessage: 'Registering…',
        lastTransitionReason: 'registering',
      };
    case 'CONN_READY':
      return {
        ...snapshot,
        connection: 'ready',
        reconnectAttempt: 0,
        connectionMessage: 'Ready — open DevTools console for all Telnyx events',
        lastTransitionReason: 'ready',
      };
    case 'CONN_RECONNECTING':
      return {
        ...snapshot,
        connection: 'reconnecting',
        reconnectAttempt: event.attempt ?? snapshot.reconnectAttempt,
        connectionMessage: 'Reconnecting…',
        lastTransitionReason: 'reconnecting',
      };
    case 'CONN_DISCONNECTED':
      return {
        ...snapshot,
        connection: 'disconnected',
        connectionMessage: 'Disconnected',
        lastTransitionReason: 'disconnected',
      };
    case 'CONN_AUTH_FAILED':
      return {
        ...snapshot,
        connection: 'auth_failed',
        connectionMessage: event.reason,
        lastTransitionReason: event.reason,
      };
    case 'CONN_SOCKET_OPEN':
      return { ...snapshot, socketConnected: true };
    case 'CONN_SOCKET_CLOSE':
      return {
        ...snapshot,
        socketConnected: false,
      };
    case 'CONN_STATUS':
      return { ...snapshot, connectionMessage: event.message };
    default:
      return snapshot;
  }
}

export function reduceCallEvent(
  snapshot: TelephonySnapshot,
  event: TelephonyCallEvent,
): TelephonySnapshot {
  logDiagnosticTimeline('fsm.reducer', snapshot, {
    dispatchedEvent: event.type,
    fromPhase: snapshot.callPhase,
    reducer: 'reduceCallEvent',
  });

  switch (event.type) {
    case 'RESET':
      return {
        ...createInitialTelephonySnapshot(),
        connection: snapshot.connection,
        socketConnected: snapshot.socketConnected,
        lastTransitionReason: 'reset',
      };

    case 'DIAL_REQUESTED':
      return withPhase(snapshot, 'dialing', 'dial_requested', {
        session: {
          callId: 'pending',
          callControlId: null,
          direction: 'outbound',
          kind: event.kind,
          remoteLabel: event.destination,
          callerNameHint: null,
          logFrom: '',
          logTo: event.destination,
          startedAt: Date.now(),
          connectedAt: null,
          durationSeconds: 0,
          remoteRingSeen: false,
          activeTransitionCount: 0,
          isMuted: false,
          terminationReason: null,
        },
      });

    case 'DIAL_ACCEPTED': {
      const session = cloneSession(snapshot.session);
      if (!session) return snapshot;
      session.callId = event.callId;
      session.callControlId = event.callControlId ?? session.callControlId;
      return withPhase({ ...snapshot, session }, 'calling', 'dial_accepted');
    }

    case 'DIAL_FAILED':
      return withPhase(
        { ...snapshot, session: null },
        'failed',
        event.reason,
      );

    case 'SDK_TRYING':
    case 'SDK_RINGING':
    case 'SDK_EARLY':
    case 'SDK_ANSWERING': {
      if (CONNECTED_OR_ENDING_PHASES.has(snapshot.callPhase)) {
        logDiagnosticTimeline('fsm.sdk-progress-ignored', snapshot, {
          dispatchedEvent: event.type,
          reason: 'already_connected_or_ending',
        });
        return snapshot;
      }
      const session = cloneSession(snapshot.session);
      if (session) session.remoteRingSeen = true;
      return withPhase({ ...snapshot, session }, 'remote_ringing', event.type.toLowerCase());
    }

    case 'SDK_ACTIVE': {
      const session = cloneSession(snapshot.session);
      if (session) session.activeTransitionCount += 1;
      return { ...snapshot, session };
    }

    case 'REMOTE_ANSWER_CONFIRMED': {
      const session = cloneSession(snapshot.session);
      if (!session) return snapshot;
      session.callId = event.callId;
      const connectedAtBefore = session.connectedAt;
      if (!session.connectedAt) {
        session.connectedAt = Date.now();
      }
      logDiagnosticTimeline('answer.confirmed', {
        ...snapshot,
        session,
      }, {
        source: event.source,
        callId: event.callId,
        connectedAt: session.connectedAt,
        connectedAtWasNull: connectedAtBefore == null,
        priorPhase: snapshot.callPhase,
      });
      if (snapshot.callPhase === 'connected' || snapshot.callPhase === 'hold' || snapshot.callPhase === 'recording') {
        return { ...snapshot, session };
      }
      return withPhase(
        { ...snapshot, session },
        'connected',
        event.source,
      );
    }

    case 'SDK_HELD':
      return withPhase(snapshot, 'hold', 'sdk_held');

    case 'HOLD_STARTED':
      return withPhase(snapshot, 'hold', 'hold_started');

    case 'HOLD_ENDED':
      return withPhase(snapshot, 'connected', 'hold_ended');

    case 'TRANSFER_STARTED':
      return withPhase(snapshot, 'transferring', 'transfer_started');

    case 'TRANSFER_ENDED':
      return withPhase(snapshot, 'connected', 'transfer_ended');

    case 'RECORDING_STARTED':
      return withPhase(snapshot, 'recording', 'recording_started');

    case 'RECORDING_STOPPED':
      return withPhase(snapshot, 'connected', 'recording_stopped');

    case 'INBOUND_RECEIVED': {
      if (
        snapshot.session?.direction === 'inbound'
        && LIVE_CALL_PHASES.has(snapshot.callPhase)
      ) {
        logDiagnosticTimeline('fsm.inbound-received-ignored', snapshot, {
          existingCallId: snapshot.session?.callId ?? null,
          incomingCallId: event.callId,
          callPhase: snapshot.callPhase,
          reason: 'inbound_session_already_live',
        });
        return snapshot;
      }
      return withPhase(snapshot, 'remote_ringing', 'inbound_received', {
        session: {
          callId: event.callId,
          callControlId: null,
          direction: 'inbound',
          kind: 'inbound',
          remoteLabel: mergeInboundCallerLabel(null, event.remoteLabel),
          callerNameHint: mergeInboundCallerNameHint(null, event.callerNameHint ?? null),
          logFrom: event.logFrom,
          logTo: event.logTo,
          startedAt: Date.now(),
          connectedAt: null,
          durationSeconds: 0,
          remoteRingSeen: true,
          activeTransitionCount: 0,
          isMuted: false,
          terminationReason: null,
        },
      });
    }

    case 'SESSION_LABEL': {
      const session = cloneSession(snapshot.session);
      if (!session) return snapshot;
      session.remoteLabel = mergeInboundCallerLabel(session.remoteLabel, event.remoteLabel);
      if (event.callerNameHint !== undefined) {
        session.callerNameHint = mergeInboundCallerNameHint(
          session.callerNameHint,
          event.callerNameHint,
        );
      }
      return { ...snapshot, session };
    }

    case 'SESSION_LOG_PARTIES': {
      const session = cloneSession(snapshot.session);
      if (!session) return snapshot;
      session.logFrom = event.logFrom;
      session.logTo = event.logTo;
      return { ...snapshot, session };
    }

    case 'MUTE_TOGGLED': {
      const session = cloneSession(snapshot.session);
      if (!session) return snapshot;
      session.isMuted = event.muted;
      return { ...snapshot, session };
    }

    case 'HANGUP_REQUESTED':
      return withPhase(snapshot, 'ending', 'hangup_requested');

    case 'SDK_TERMINAL':
      return withPhase(
        {
          ...snapshot,
          session: snapshot.session
            ? { ...snapshot.session, terminationReason: event.reason }
            : null,
        },
        event.reason === 'failed' ? 'failed' : 'ended',
        event.reason,
      );

    default:
      return snapshot;
  }
}

export function tickDuration(snapshot: TelephonySnapshot, now = Date.now()): TelephonySnapshot {
  if (snapshot.callPhase !== 'connected' && snapshot.callPhase !== 'hold' && snapshot.callPhase !== 'recording') {
    return snapshot;
  }
  const session = cloneSession(snapshot.session);
  if (!session?.connectedAt) return snapshot;
  const durationSeconds = Math.max(0, Math.floor((now - session.connectedAt) / 1000));
  const prevDuration = session.durationSeconds;
  session.durationSeconds = durationSeconds;
  if (durationSeconds !== prevDuration) {
    logDiagnosticTimeline('timer.tick', snapshot, {
      durationSeconds,
      previousDuration: prevDuration,
      connectedAt: session.connectedAt,
      callPhase: snapshot.callPhase,
    });
  }
  return { ...snapshot, session };
}
