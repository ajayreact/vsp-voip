import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pbxHealthService = require('../../lib/v3/pbxHealthService.js');

describe('V3 pbxHealthService', () => {
  it('builds red health when validation fails', () => {
    const health = pbxHealthService.buildRingGroupHealth(
      { id: 'rg1', name: 'Sales', memberExtensionIds: [], strategy: 'SIMULTANEOUS', isActive: true, overflowDestination: null },
      { valid: false, errors: [{ message: 'At least one member extension is required' }] },
    );
    expect(health.overall).toBe('red');
    expect(health.reasons.length).toBeGreaterThan(0);
  });

  it('builds green health for valid queue', () => {
    const health = pbxHealthService.buildQueueHealth(
      { id: 'q1', name: 'Support', agentExtensionIds: ['e1'], queueNumber: '800', isActive: true, overflowDestination: { type: 'voicemail' } },
      { valid: true, errors: [] },
    );
    expect(health.overall).toBe('green');
  });
});
