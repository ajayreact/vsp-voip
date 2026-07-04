import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetSecureStoreForTests, setItemAsync } from 'expo-secure-store';

vi.mock('../../mobile-rn/src/auth/authService', () => ({
  bootstrapSession: vi.fn(async () => ({ id: 'user-1', email: 'jane@acme.com', name: 'Jane' })),
}));

import { saveAuthPreferences } from '../../mobile-rn/src/auth/authPreferences';
import { planSessionRestore } from '../../mobile-rn/src/auth/sessionRestore';

describe('mobile / session restore (Phase 4.1)', () => {
  beforeEach(() => {
    __resetSecureStoreForTests();
  });

  it('skips auto login when remember me is disabled', async () => {
    await setItemAsync('vsp.accessToken', 'token-123');
    await saveAuthPreferences({ rememberMe: false, lastUsername: 'jane@acme.com' });

    const plan = await planSessionRestore();
    expect(plan.phase).toBe('no_session');
    expect(plan.lastUsername).toBe('jane@acme.com');
  });

  it('requires biometric unlock when enabled and tokens exist', async () => {
    await setItemAsync('vsp.accessToken', 'token-123');
    await saveAuthPreferences({
      rememberMe: true,
      biometricEnabled: true,
      lastUsername: 'jane@acme.com',
    });

    const plan = await planSessionRestore();
    expect(plan.phase).toBe('needs_biometric');
  });

  it('restores session directly when remember me is enabled without biometrics', async () => {
    await setItemAsync('vsp.accessToken', 'token-123');
    await saveAuthPreferences({
      rememberMe: true,
      biometricEnabled: false,
      lastUsername: 'jane@acme.com',
    });

    const plan = await planSessionRestore();
    expect(plan.phase).toBe('restored');
  });
});
