import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeHealthService = require('../../lib/v3/runtime/runtimeHealthService.js');

function emptyPrisma() {
  return {
    v3RingGroup: { findMany: vi.fn(async () => []) },
    v3Queue: { findMany: vi.fn(async () => []) },
    v3BusinessHoursSchedule: { findMany: vi.fn(async () => []) },
    v3VoicemailBox: { findMany: vi.fn(async () => []) },
    v3CallFlow: { findMany: vi.fn(async () => []) },
    extension: { findMany: vi.fn(async () => []) },
    phoneNumber: { findMany: vi.fn(async () => []) },
    v3DeskDevice: { findMany: vi.fn(async () => []) },
    v3RuntimeSyncJob: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
    },
    v3RuntimeLink: { count: vi.fn(async () => 0) },
  };
}

describe('V3 runtimeHealthService', () => {
  beforeEach(() => {
    process.env.V3_RUNTIME_SYNC_ENABLED = 'false';
  });

  it('returns disabled health when feature flag off', async () => {
    const health = await runtimeHealthService.getRuntimeHealth(emptyPrisma(), 't1');
    expect(health.enabled).toBe(false);
    expect(health.overall).toBe('yellow');
    expect(health.domains.runtimeReady).toBe('yellow');
  });
});
