import { normalizeDestination } from './dialNormalization';

export function resolveCallLogParties(
  direction: 'inbound' | 'outbound',
  remoteOrDestination: string,
  callerId: string,
) {
  const normalizedCallerId = normalizeDestination(callerId) || callerId;
  const remote = normalizeDestination(remoteOrDestination) || remoteOrDestination;
  if (direction === 'outbound') {
    return { from: normalizedCallerId, to: remote };
  }
  return { from: remote, to: normalizedCallerId };
}

export type CallHistoryStatus =
  | 'completed'
  | 'missed'
  | 'rejected'
  | 'cancelled'
  | 'busy'
  | 'failed'
  | 'outbound_no_answer';

export function mapHistoryStatusToServerLog(
  status: CallHistoryStatus,
  direction: 'inbound' | 'outbound',
): {
  status: 'ended' | 'failed' | 'no-answer' | 'busy' | 'cancelled' | 'rejected';
  callType: string;
} {
  switch (status) {
    case 'completed':
      return { status: 'ended', callType: direction === 'outbound' ? 'outbound' : 'answered' };
    case 'missed':
      return { status: 'no-answer', callType: 'missed' };
    case 'rejected':
      return { status: 'rejected', callType: direction === 'inbound' ? 'missed' : 'outbound' };
    case 'cancelled':
      return { status: 'cancelled', callType: direction === 'outbound' ? 'outbound' : 'missed' };
    case 'busy':
      return { status: 'busy', callType: direction === 'outbound' ? 'outbound' : 'missed' };
    case 'failed':
      return { status: 'failed', callType: direction === 'outbound' ? 'outbound' : 'missed' };
    default:
      return { status: 'no-answer', callType: direction === 'outbound' ? 'outbound' : 'missed' };
  }
}
