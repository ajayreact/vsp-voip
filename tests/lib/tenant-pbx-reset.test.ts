import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const {
  assertDevelopmentEnvironment,
  buildDryRunReport,
} = require('../../lib/tenantPbxReset');

describe('tenantPbxReset', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, NODE_ENV: 'development', API_PUBLIC_URL: 'http://localhost:3000' };
  });

  afterEach(() => {
    process.env = envBackup;
    vi.restoreAllMocks();
  });

  it('refuses production environment', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertDevelopmentEnvironment()).toThrow(/development-only/i);
  });

  it('dry-run preserves call history by default', () => {
    const report = buildDryRunReport(
      'tenant-1',
      {
        tenant: { id: 'tenant-1', name: 'Acme Corp' },
        employees: 3,
        extensions: 2,
        ringGroups: 1,
        ringGroupMembers: 2,
        phoneNumbers: 4,
        assignedNumbers: 2,
        unassignedNumbers: 2,
        tenantAdmins: 1,
        superAdmins: 1,
        greeting: 1,
        callLogs: 120,
        recordings: 15,
        voicemails: 8,
        conversations: 5,
        smsMessages: 40,
        provisioningTokens: 2,
        userDevices: 4,
        usersWithSip: 3,
        usersWithPresence: 2,
      },
      { clearCallHistory: false, skipTelnyx: false, flushRedis: true },
    );

    expect(report.dryRun).toBe(true);
    expect(report.wouldPreserve.callLogs).toBe(120);
    expect(report.wouldPreserve.smsMessages).toBe(40);
    expect(report.wouldRemove.employees).toBe(3);
    expect(report.wouldRemove.callLogs).toBeUndefined();
  });

  it('dry-run includes communications wipe when --clear-call-history is set', () => {
    const report = buildDryRunReport(
      'tenant-1',
      {
        tenant: { id: 'tenant-1', name: 'Acme Corp' },
        employees: 1,
        extensions: 1,
        ringGroups: 0,
        ringGroupMembers: 0,
        phoneNumbers: 2,
        assignedNumbers: 1,
        unassignedNumbers: 1,
        tenantAdmins: 1,
        superAdmins: 1,
        greeting: 0,
        callLogs: 10,
        recordings: 2,
        voicemails: 1,
        conversations: 3,
        smsMessages: 6,
        provisioningTokens: 0,
        userDevices: 1,
        usersWithSip: 1,
        usersWithPresence: 1,
      },
      { clearCallHistory: true, skipTelnyx: false, flushRedis: true },
    );

    expect(report.wouldRemove.callLogs).toBe(10);
    expect(report.wouldRemove.smsMessages).toBe(6);
    expect(report.wouldPreserve.callLogs).toBeUndefined();
  });
});
