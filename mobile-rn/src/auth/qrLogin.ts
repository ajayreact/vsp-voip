export type QrLoginPayload = {
  server?: string;
  tenant?: string;
  extension?: string;
  username?: string;
  token?: string;
  accessToken?: string;
};

export function parseQrLoginPayload(raw: string): QrLoginPayload | null {
  try {
    const parsed = JSON.parse(raw.trim()) as QrLoginPayload;
    const token = parsed.token || parsed.accessToken;
    if (!token) return null;
    return { ...parsed, token };
  } catch {
    return null;
  }
}

export function validateQrPayload(payload: QrLoginPayload): string | null {
  if (!payload.token && !payload.accessToken) {
    return 'This QR code is missing a login token.';
  }
  return null;
}
