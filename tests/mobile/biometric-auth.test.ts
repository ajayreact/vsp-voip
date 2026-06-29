import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetBiometricTestState,
  __setBiometricTestState,
} from 'expo-local-authentication';
import {
  authenticateWithBiometric,
  getBiometricCapability,
} from '../../mobile-rn/src/auth/biometricAuth';

describe('mobile / biometric auth (Phase 4.1)', () => {
  beforeEach(() => {
    __resetBiometricTestState();
  });

  it('reports Face ID capability when facial recognition is supported', async () => {
    const capability = await getBiometricCapability();
    expect(capability.available).toBe(true);
    expect(['Face ID', 'Face unlock', 'Biometrics']).toContain(capability.label);
  });

  it('returns success when local authentication succeeds', async () => {
    const result = await authenticateWithBiometric('Unlock VSP Phone');
    expect(result).toEqual({ success: true });
  });

  it('maps user cancel to cancelled reason', async () => {
    __setBiometricTestState({
      authenticateResult: { success: false, error: 'user_cancel' },
    });

    const result = await authenticateWithBiometric();
    expect(result).toEqual({ success: false, reason: 'cancelled' });
  });
});
