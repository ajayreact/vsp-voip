import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildEmployeeStatus } = require('../../lib/v3/healthCheckService.js');

const READY = { webhookReady: true, callControlReady: true, credentialReady: true };

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    name: 'Jane Doe',
    email: 'jane@acme.test',
    telnyxCredentialId: 'cred-1',
    telnyxSipUsername: 'gencred-jane',
    sipRegistered: true,
    devices: [{ id: 'd1' }],
    assignedNumbers: [{ id: 'p1', number: '+15551230001' }],
    extensions: [
      { id: 'ext-1', extensionNumber: '101', webrtcEnabled: true, primaryPhoneNumberId: 'p1', primaryPhoneNumber: { number: '+15551230001' } },
    ],
    ...overrides,
  };
}

describe('V3 healthCheckService.buildEmployeeStatus', () => {
  it('marks a fully provisioned + registered employee green', () => {
    const status = buildEmployeeStatus(baseUser(), READY);
    expect(status.overall).toBe('green');
    expect(status.checks.extension).toBe('green');
    expect(status.checks.credential).toBe('green');
    expect(status.checks.sipUsername).toBe('green');
    expect(status.checks.registration).toBe('green');
  });

  it('marks a missing credential as red (blocking)', () => {
    const status = buildEmployeeStatus(baseUser({ telnyxCredentialId: null }), READY);
    expect(status.checks.credential).toBe('red');
    expect(status.overall).toBe('red');
  });

  it('marks an employee without an extension as red', () => {
    const status = buildEmployeeStatus(baseUser({ extensions: [] }), READY);
    expect(status.checks.extension).toBe('red');
    expect(status.overall).toBe('red');
  });

  it('marks not-yet-registered / no-device as yellow (not blocking)', () => {
    const status = buildEmployeeStatus(baseUser({ sipRegistered: false, devices: [] }), READY);
    expect(status.checks.registration).toBe('yellow');
    expect(status.checks.device).toBe('yellow');
    expect(status.overall).toBe('yellow');
  });

  it('propagates tenant-global Telnyx not-ready as red', () => {
    const status = buildEmployeeStatus(baseUser(), { webhookReady: false, callControlReady: false });
    expect(status.checks.webhookReady).toBe('red');
    expect(status.checks.callControlReady).toBe('red');
    expect(status.overall).toBe('red');
  });
});
