import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceHealthService = require('../../lib/v3/deviceHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceService = require('../../lib/v3/deviceService.js');

describe('V3 deviceHealthService', () => {
  const readiness = { callControlReady: true, webhookReady: true, credentialReady: true };

  it('marks registered devices green', () => {
    const health = deviceHealthService.buildDeviceHealth({
      id: 'd1',
      vendor: 'yealink',
      model: 'T46U',
      macAddress: 'AABB',
      extensionId: 'e1',
      employeeId: 'u1',
      extensionNumber: '101',
      employeeName: 'Jane',
      sipUsername: 'sip-jane',
      status: 'REGISTERED',
      registrationStatus: 'registered',
      provisionUrl: 'https://api.test/api/v3/devices/d1/config?vendor=yealink',
      lastProvisionedAt: new Date(),
      configVersion: 1,
      provisionVersion: 1,
      firmwareVersion: '1.0',
      lastRegistrationAt: new Date(),
      lastSeenAt: new Date(),
    }, readiness);

    expect(health.overall).toBe('green');
    expect(health.checks.registration).toBe('green');
  });

  it('marks never-registered devices red', () => {
    const health = deviceHealthService.buildDeviceHealth({
      id: 'd1',
      vendor: 'yealink',
      status: 'CREATED',
      registrationStatus: 'never',
      extensionId: null,
      employeeId: null,
      sipUsername: null,
      provisionUrl: null,
      configVersion: 1,
      provisionVersion: 1,
    }, readiness);

    expect(health.checks.registration).toBe('red');
    expect(health.reasons.some((r: string) => r.includes('never registered'))).toBe(true);
  });

  it('marks provisioned-but-offline as yellow registration', () => {
    const health = deviceHealthService.buildDeviceHealth({
      id: 'd1',
      vendor: 'poly',
      status: 'PROVISIONED',
      registrationStatus: 'offline',
      extensionId: 'e1',
      employeeId: 'u1',
      sipUsername: 'sip-u1',
      provisionUrl: 'https://api.test/config',
      lastProvisionedAt: new Date(),
      configVersion: 2,
      provisionVersion: 2,
    }, readiness);

    expect(health.checks.registration).toBe('yellow');
  });
});

describe('V3 deviceService.deriveRegistrationStatus', () => {
  it('derives registration states', () => {
    expect(deviceService.deriveRegistrationStatus({ sipRegistered: true }, null, {})).toBe('registered');
    expect(deviceService.deriveRegistrationStatus(null, null, { status: 'PROVISIONED', lastProvisionedAt: new Date() })).toBe('offline');
    expect(deviceService.deriveRegistrationStatus(null, null, { status: 'CREATED' })).toBe('never');
  });
});
