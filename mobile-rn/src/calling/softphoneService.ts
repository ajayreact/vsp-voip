import { endpoints } from '../api/endpoints';
import { authorizedRequest } from '../auth/authService';

export type SoftphoneTokenResponse = {
  success?: boolean;
  loginToken?: string;
  sipUsername?: string;
  credentialConnectionId?: string | null;
  expiresInSeconds?: number;
};

export type SoftphoneConfigResponse = {
  success?: boolean;
  configured?: boolean;
  sipUsername?: string | null;
  credentialConnectionId?: string | null;
  numbers?: { id: string; number: string }[];
  defaultCallerId?: string | null;
};

export type CallAcceptedResponse = {
  success?: boolean;
  ok?: boolean;
  pstnCaller?: string | null;
  reason?: string;
  inboundCallControlId?: string;
};

export type CallLogPayload = {
  callSid: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  status: string;
  durationSeconds?: number;
  callType?: string;
  userDeclined?: boolean;
  acceptedByUser?: boolean;
  userCancelled?: boolean;
};

export async function fetchSoftphoneToken(): Promise<SoftphoneTokenResponse> {
  return authorizedRequest<SoftphoneTokenResponse>(endpoints.softphone.token, {
    method: 'POST',
  });
}

export async function fetchSoftphoneConfig(): Promise<SoftphoneConfigResponse> {
  return authorizedRequest<SoftphoneConfigResponse>(endpoints.softphone.config);
}

export async function postSoftphonePresence(online: boolean): Promise<{ success?: boolean }> {
  return authorizedRequest(endpoints.softphone.presence, {
    method: 'POST',
    body: { online },
  });
}

export async function postCallAccepted(): Promise<CallAcceptedResponse> {
  return authorizedRequest<CallAcceptedResponse>(endpoints.softphone.callAccepted, {
    method: 'POST',
    body: {},
  });
}

export async function postCallLog(payload: CallLogPayload): Promise<{ success?: boolean }> {
  return authorizedRequest(endpoints.softphone.callLog, {
    method: 'POST',
    body: payload,
  });
}

export type PushTokenPayload = {
  token: string;
  platform: 'android' | 'ios';
  deviceId: string;
  deviceName?: string;
  appVersion?: string;
};

export async function postSoftphonePushToken(payload: PushTokenPayload) {
  return authorizedRequest<{
    success?: boolean;
    registered?: boolean;
    deviceId?: string;
    registeredDeviceCount?: number;
  }>(endpoints.softphone.pushToken, {
    method: 'POST',
    body: payload,
  });
}

export async function postSoftphoneTelemetry(
  event: string,
  properties?: Record<string, unknown>,
) {
  return authorizedRequest(endpoints.softphone.telemetry, {
    method: 'POST',
    body: { event, properties },
  });
}
