import { describe, expect, it } from 'vitest';

describe('Symplore pilot — buildExtensionSipProfile prefers the dedicated desk credential', () => {
  it('uses extension.telnyxSipUsername when a dedicated desk credential exists, ignoring the employee credential', async () => {
    const { buildExtensionSipProfile } = await import('../../lib/extensionSip.js');
    const extension = {
      extensionNumber: '100',
      displayName: 'Suresh Desk',
      telnyxSipUsername: 'gencred-suresh-desk',
      telnyxSipPassword: 'desk-secret',
      telnyxCredentialId: 'cred-desk-1',
      sipRegistered: true,
    };
    const employee = {
      telnyxSipUsername: 'gencred-suresh-app',
      telnyxSipPassword: 'app-secret',
      telnyxCredentialId: 'cred-app-1',
    };

    const profile = buildExtensionSipProfile(extension, { credentialConnectionId: 'conn-1' }, employee);
    expect(profile.sipUsername).toBe('gencred-suresh-desk');
    expect(profile.sipPassword).toBe('desk-secret');
    expect(profile.telnyxSipUsername).toBe('gencred-suresh-desk');
    expect(profile.deskRegistered).toBe(true);
  });

  it('falls back to the employee credential when the extension has no dedicated desk credential', async () => {
    const { buildExtensionSipProfile } = await import('../../lib/extensionSip.js');
    const extension = { extensionNumber: '101', displayName: 'Bala Desk' };
    const employee = { telnyxSipUsername: 'gencred-bala-app', telnyxSipPassword: 'app-secret' };

    const profile = buildExtensionSipProfile(extension, { credentialConnectionId: 'conn-1' }, employee);
    expect(profile.sipUsername).toBe('gencred-bala-app');
  });
});
