import { API_URL, getToken, logSoftphoneCall } from '@/lib/api';

export type ServerCallLogStatus =
  | 'started'
  | 'connected'
  | 'ended'
  | 'failed'
  | 'no-answer'
  | 'busy'
  | 'cancelled'
  | 'rejected';

export type CallAcceptedDiagnostic = {
  ok: boolean;
  pstnCaller?: string | null;
  reason?: string;
  inboundCallControlId?: string;
  request: {
    url: string;
    method: string;
    hasToken: boolean;
  };
  response?: {
    status: number;
    statusText: string;
    body: unknown;
  };
  error?: string;
  networkError?: string;
};

const CALL_ACCEPTED_PATH = '/api/softphone/call-accepted';

function logCallAcceptedDiagnostic(label: string, detail: unknown) {
  console.error(`[softphone-v2] postCallAccepted.${label}`, detail);
}

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
  }).catch((err) => {
    console.error('[softphone-v2] postServerCallLog.error', err);
  });
}

export async function postCallAccepted(): Promise<CallAcceptedDiagnostic> {
  const url = `${API_URL}${CALL_ACCEPTED_PATH}`;
  const method = 'POST';
  const token = getToken();
  const request = { url, method, hasToken: Boolean(token) };

  logCallAcceptedDiagnostic('request', request);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    });
  } catch (err) {
    const networkError = err instanceof Error ? err.message : String(err);
    const diagnostic: CallAcceptedDiagnostic = {
      ok: false,
      request,
      networkError,
      error: `Network error reaching ${url}: ${networkError}`,
    };
    logCallAcceptedDiagnostic('networkError', diagnostic);
    return diagnostic;
  }

  const raw = await res.text();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = { raw };
  }

  const response = {
    status: res.status,
    statusText: res.statusText,
    body,
  };

  logCallAcceptedDiagnostic('response', { request, response });

  if (!res.ok) {
    const apiError = typeof body === 'object' && body && 'error' in body
      ? String((body as { error: unknown }).error)
      : `HTTP ${res.status} ${res.statusText}`;
    const diagnostic: CallAcceptedDiagnostic = {
      ok: false,
      request,
      response,
      error: apiError,
    };
    logCallAcceptedDiagnostic('httpError', diagnostic);
    return diagnostic;
  }

  const payload = body as {
    success?: boolean;
    ok?: boolean;
    reason?: string;
    pstnCaller?: string | null;
    inboundCallControlId?: string;
  };

  const accepted = payload.ok === true || payload.success === true;
  const diagnostic: CallAcceptedDiagnostic = {
    ok: accepted,
    pstnCaller: payload.pstnCaller ?? null,
    reason: payload.reason,
    inboundCallControlId: payload.inboundCallControlId,
    request,
    response,
    ...(accepted
      ? {}
      : {
          error: payload.reason
            ? `Backend rejected accept: ${payload.reason}`
            : 'Backend returned ok:false without a reason',
        }),
  };

  if (!accepted) {
    logCallAcceptedDiagnostic('backendRejected', diagnostic);
  }

  return diagnostic;
}

export type BlindTransferResult = {
  success: boolean;
  transferId?: string;
  stage?: string;
  error?: string;
};

export async function postBlindTransfer(
  destination: string,
  destinationType?: 'pstn' | 'extension' | 'sip',
): Promise<BlindTransferResult> {
  const token = getToken();
  const url = `${API_URL}/api/softphone/transfer/blind`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        destination,
        ...(destinationType ? { destinationType } : {}),
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[softphone-v2] postBlindTransfer.networkError', message);
    return { success: false, error: message };
  }

  const body = await res.json().catch(() => ({})) as {
    success?: boolean;
    transferId?: string;
    stage?: string;
    error?: string;
  };

  if (!res.ok || body.success === false) {
    const error = body.error || `HTTP ${res.status}`;
    console.error('[softphone-v2] postBlindTransfer.error', error);
    return { success: false, error, transferId: body.transferId };
  }

  return {
    success: true,
    transferId: body.transferId,
    stage: body.stage,
  };
}
