import { env } from '../shared/config/env';
import type { User } from '../api/types';
import {
  parseMobileProvisionQr,
  validateMobileProvisionQr,
  type MobileProvisionQrPayload,
} from './provisionQr';
import {
  sipProfileFromProvisioningProfile,
  type EmployeeProvisioningProfile,
} from '../sip/provisioningProfile';
import { saveStoredSipProfile } from '../sip/storage';

export type { MobileProvisionQrPayload };
export { parseMobileProvisionQr, validateMobileProvisionQr };

export type MobileProvisionResponse = {
  success?: boolean;
  purpose?: 'mobile' | 'desk';
  accessToken?: string;
  refreshToken?: string;
  user?: User & { tenantName?: string | null };
  extension?: Record<string, unknown>;
  telephony?: {
    loginToken?: string;
    sipUsername?: string;
    credentialId?: string;
    expiresInSeconds?: number;
  };
  provisioningProfile?: EmployeeProvisioningProfile;
  configExport?: Record<string, unknown>;
  sip?: EmployeeProvisioningProfile['sip'];
};

function resolveProvisionApiUrl(payload: MobileProvisionQrPayload): string {
  return (payload.apiUrl || env.apiBaseUrl).replace(/\/$/, '');
}

export async function redeemProvisioningQr(
  payload: MobileProvisionQrPayload,
  deviceMeta: {
    deviceId?: string;
    platform?: string;
    pushToken?: string;
    deviceName?: string;
    appVersion?: string;
  } = {},
): Promise<MobileProvisionResponse> {
  const baseUrl = resolveProvisionApiUrl(payload);
  const response = await fetch(`${baseUrl}/api/mobile/provision`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: payload.token,
      ...deviceMeta,
    }),
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) as MobileProvisionResponse & { error?: string } : {};
  if (!response.ok) {
    throw new Error(data.error || `Provisioning failed (${response.status})`);
  }

  return data;
}

export async function applyMobileProvisioningResult(result: MobileProvisionResponse): Promise<void> {
  if (result.provisioningProfile) {
    const profile = sipProfileFromProvisioningProfile(result.provisioningProfile);
    await saveStoredSipProfile(profile);
  }
}

export async function redeemDeskProvisioningQr(raw: string): Promise<EmployeeProvisioningProfile | null> {
  const payload = parseMobileProvisionQr(raw);
  if (!payload || payload.type !== 'vsp-desk-provision') return null;

  const validationError = validateMobileProvisionQr(payload);
  if (validationError) {
    throw new Error(validationError);
  }

  const result = await redeemProvisioningQr(payload);
  return result.provisioningProfile || null;
}
