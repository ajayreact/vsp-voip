import {
  parseMobileProvisionQr,
  validateMobileProvisionQr,
  type MobileProvisionQrPayload,
} from './provisionService';

export type QrLoginPayload = MobileProvisionQrPayload;

export function parseQrLoginPayload(raw: string): QrLoginPayload | null {
  return parseMobileProvisionQr(raw);
}

export function validateQrPayload(payload: QrLoginPayload): string | null {
  return validateMobileProvisionQr(payload);
}
