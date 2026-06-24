import { logSoftphoneCall, notifySoftphoneCallAccepted } from '@/lib/api';

export type ServerCallLogStatus =
  | 'started'
  | 'connected'
  | 'ended'
  | 'failed'
  | 'no-answer'
  | 'busy'
  | 'cancelled'
  | 'rejected';

export function postServerCallLog(params: {
  callSid: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  status: ServerCallLogStatus;
  durationSeconds?: number;
  callType?: string;
  userDeclined?: boolean;
  acceptedByUser?: boolean;
  userCancelled?: boolean;
}) {
  if (!params.from || !params.to) return;

  void logSoftphoneCall({
    callSid: params.callSid,
    from: params.from,
    to: params.to,
    direction: params.direction,
    status: params.status,
    durationSeconds: params.durationSeconds,
    callType: params.callType,
    userDeclined: params.userDeclined,
    acceptedByUser: params.acceptedByUser,
    userCancelled: params.userCancelled,
  }).catch(() => {
    /* call logging must not break the softphone */
  });
}

export function postCallAccepted() {
  return notifySoftphoneCallAccepted().catch(() => null);
}
