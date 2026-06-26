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
  numbers?: { id: string; number: string }[];
  defaultCallerId?: string | null;
};

export async function fetchSoftphoneToken(): Promise<SoftphoneTokenResponse> {
  return authorizedRequest<SoftphoneTokenResponse>(endpoints.softphone.token, {
    method: 'POST',
  });
}

export async function fetchSoftphoneConfig(): Promise<SoftphoneConfigResponse> {
  return authorizedRequest<SoftphoneConfigResponse>(endpoints.softphone.config);
}
