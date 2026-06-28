import type { Call } from '@telnyx/react-voice-commons-sdk';
import { TelnyxCallState } from '@telnyx/react-voice-commons-sdk';
import { useCallingStore } from '../store/callingStore';
import { queryClient } from '../lib/queryClient';
import { postCallLog } from './softphoneService';
import {
  mapHistoryStatusToServerLog,
  resolveCallLogParties,
  type CallHistoryStatus,
} from './callLogParties';
import { normalizeDestination } from './dialNormalization';

type TrackedSession = {
  callId: string;
  direction: 'inbound' | 'outbound';
  remoteNumber: string;
  logFrom: string;
  logTo: string;
  reachedActive: boolean;
  acceptedByUser: boolean;
  userDeclined: boolean;
  userCancelled: boolean;
  logged: boolean;
};

const sessions = new Map<string, TrackedSession>();

function resolveTerminalStatus(session: TrackedSession): CallHistoryStatus {
  if (session.reachedActive) return 'completed';
  if (session.direction === 'inbound') {
    if (session.userDeclined || session.acceptedByUser) return 'rejected';
    return 'missed';
  }
  if (session.userCancelled) return 'cancelled';
  return 'outbound_no_answer';
}

export function beginTrackedCall(
  call: Call,
  direction: 'inbound' | 'outbound',
  remoteNumber: string,
) {
  if (sessions.has(call.callId)) return;
  const { defaultCallerId, tenantNumbers } = useCallingStore.getState();
  const callerId = defaultCallerId || tenantNumbers[0] || '';
  const parties = resolveCallLogParties(direction, remoteNumber, callerId);
  sessions.set(call.callId, {
    callId: call.callId,
    direction,
    remoteNumber: normalizeDestination(remoteNumber) || remoteNumber,
    logFrom: parties.from,
    logTo: parties.to,
    reachedActive: false,
    acceptedByUser: false,
    userDeclined: false,
    userCancelled: false,
    logged: false,
  });
}

export function markCallAccepted(callId: string) {
  const session = sessions.get(callId);
  if (!session) return;
  session.acceptedByUser = true;
}

export function markCallDeclined(callId: string) {
  const session = sessions.get(callId);
  if (!session) return;
  session.userDeclined = true;
}

export function markCallCancelled(callId: string) {
  const session = sessions.get(callId);
  if (!session) return;
  session.userCancelled = true;
}

export function updateTrackedRemoteNumber(callId: string, remoteNumber: string) {
  const session = sessions.get(callId);
  if (!session) return;
  const normalized = normalizeDestination(remoteNumber) || remoteNumber;
  session.remoteNumber = normalized;
  const { defaultCallerId, tenantNumbers } = useCallingStore.getState();
  const callerId = defaultCallerId || tenantNumbers[0] || '';
  const parties = resolveCallLogParties(session.direction, normalized, callerId);
  session.logFrom = parties.from;
  session.logTo = parties.to;
}

export function syncTrackedCallState(call: Call) {
  const session = sessions.get(call.callId);
  if (!session) {
    beginTrackedCall(
      call,
      call.isIncoming ? 'inbound' : 'outbound',
      call.destination,
    );
    return sessions.get(call.callId)!;
  }
  if (call.currentState === TelnyxCallState.ACTIVE) {
    session.reachedActive = true;
  }
  return session;
}

export function finalizeTrackedCall(call: Call, durationSeconds: number) {
  const session = sessions.get(call.callId);
  if (!session || session.logged) return;
  session.logged = true;

  const status = resolveTerminalStatus(session);
  const serverLog = mapHistoryStatusToServerLog(status, session.direction);

  void postCallLog({
    callSid: call.callId,
    from: session.logFrom,
    to: session.logTo,
    direction: session.direction,
    status: serverLog.status,
    durationSeconds: session.reachedActive ? durationSeconds : undefined,
    callType: serverLog.callType,
    userDeclined: session.userDeclined,
    acceptedByUser: session.acceptedByUser,
    userCancelled: session.userCancelled,
  }).catch(() => {});

  void queryClient.invalidateQueries({ queryKey: ['calls', 'recent'] });
  sessions.delete(call.callId);
}

export function clearTrackedCalls() {
  sessions.clear();
}
