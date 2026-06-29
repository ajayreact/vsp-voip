import { describe, expect, it } from 'vitest';
import {
  classifyQrPayload,
  getDeskQrMessage,
  mapProvisionError,
} from '../../mobile-rn/src/auth/provisionErrors';

describe('mobile / provision errors (Phase 4.1)', () => {
  it('classifies desk and mobile QR payloads', () => {
    expect(
      classifyQrPayload({
        type: 'vsp-desk-provision',
        token: 'abc',
      }),
    ).toBe('desk');

    expect(
      classifyQrPayload({
        type: 'vsp-voip-provision',
        token: 'abc',
      }),
    ).toBe('mobile');

    expect(classifyQrPayload(null)).toBe('invalid');
  });

  it('maps expired provisioning errors', () => {
    expect(mapProvisionError(new Error('Provisioning token expired'))).toContain('expired');
  });

  it('maps already-used provisioning errors', () => {
    expect(mapProvisionError(new Error('Token already used'))).toContain('already been used');
  });

  it('maps desk provisioning errors to desk guidance', () => {
    expect(mapProvisionError(new Error('desk phone setup'))).toBe(getDeskQrMessage());
  });
});
