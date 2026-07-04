import type { MobileProvisionQrPayload } from './provisionQr';

export function getDeskQrMessage(): string {
  return 'This QR code is for desk phone setup. Sign in with email or ask your administrator for a mobile login QR.';
}

export function getInvalidQrMessage(): string {
  return "This QR code isn't valid for VSP Phone. Please try again or sign in manually.";
}

export function classifyQrPayload(payload: MobileProvisionQrPayload | null): 'mobile' | 'desk' | 'invalid' {
  if (!payload?.token?.trim()) return 'invalid';
  if (payload.type === 'vsp-desk-provision') return 'desk';
  if (payload.type === 'vsp-voip-provision') return 'mobile';
  return 'invalid';
}

export function mapProvisionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (/desk phone setup/i.test(message)) {
    return getDeskQrMessage();
  }
  if (/expired/i.test(message)) {
    return 'This provisioning QR code has expired. Ask your administrator for a new one.';
  }
  if (/already been used|already used|token.*used|invalid token|not found|410/i.test(message)) {
    return 'This QR code has already been used or is no longer valid. Ask your administrator for a new one.';
  }
  if (/403|forbidden|not authorized/i.test(message)) {
    return "Your organization doesn't allow provisioning with this QR code.";
  }
  if (/429|too many/i.test(message)) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (/network|fetch failed|connection|timeout|offline/i.test(message)) {
    return 'Connection lost. Check your network and try again.';
  }
  if (/5\d{2}/.test(message) || /something went wrong on our end/i.test(message)) {
    return 'Something went wrong while provisioning your device. Please try again.';
  }

  return "We couldn't provision this device. The QR code may have expired or already been used.";
}
