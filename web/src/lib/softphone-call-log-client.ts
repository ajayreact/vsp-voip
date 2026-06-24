import { logSoftphoneCall } from '@/lib/api';

export type ServerCallLogStatus = 'started' | 'connected' | 'ended' | 'failed';

export function postServerCallLog(params: {
  callSid: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  status: ServerCallLogStatus;
  durationSeconds?: number;
}) {
  if (!params.from || !params.to) return;

  void logSoftphoneCall({
    callSid: params.callSid,
    from: params.from,
    to: params.to,
    direction: params.direction,
    status: params.status,
    durationSeconds: params.durationSeconds,
  }).catch(() => {
    /* call logging must not break the softphone */
  });
}
