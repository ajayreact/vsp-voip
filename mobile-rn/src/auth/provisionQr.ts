export type MobileProvisionQrPayload = {
  v?: number;
  type: string;
  target?: string;
  apiUrl?: string;
  token?: string;
  expiresAt?: string;
  tenantId?: string;
  tenantName?: string;
  employeeName?: string;
  extensionId?: string;
  extensionNumber?: string;
  displayName?: string;
};

export function parseMobileProvisionQr(raw: string): MobileProvisionQrPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as MobileProvisionQrPayload;
    if (parsed?.type === 'vsp-voip-provision' && parsed.token) return parsed;
    if (parsed?.type === 'vsp-desk-provision' && parsed.token) return parsed;
  } catch {
    return null;
  }

  return null;
}

export function validateMobileProvisionQr(payload: MobileProvisionQrPayload): string | null {
  if (!payload.token?.trim()) {
    return 'This QR code is missing a provisioning token.';
  }
  if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) {
    return 'This provisioning QR code has expired. Ask your administrator for a new one.';
  }
  return null;
}
