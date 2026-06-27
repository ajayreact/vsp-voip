import { describe, it, expect } from 'vitest';
import { REST_ENDPOINTS, endpointsForProbe, endpointKey } from '../lib/endpoints';
import { probeAllEndpoints } from '../lib/endpoint-probe';
import { isApiReachable } from '../lib/api-client';

describe('api / REST endpoint coverage', () => {
  it('registry contains all major route groups', () => {
    const groups = new Set(REST_ENDPOINTS.map((ep) => ep.group));
    for (const required of [
      'health',
      'auth',
      'tenant',
      'softphone',
      'messaging',
      'sms-legacy',
      'extensions',
      'ring-groups',
      'admin',
      'billing',
    ]) {
      expect(groups.has(required)).toBe(true);
    }
    expect(REST_ENDPOINTS.length).toBeGreaterThanOrEqual(60);
  });

  it('registry paths are unique', () => {
    const keys = REST_ENDPOINTS.map(endpointKey);
    expect(keys.length).toBe(new Set(keys).size);
  });

  it('probes registered endpoints for auth contract', async () => {
    if (!(await isApiReachable())) {
      console.warn('[skip] API unreachable');
      return;
    }

    const { results, skipped } = await probeAllEndpoints(endpointsForProbe());
    if (skipped) {
      console.warn('[skip] API unreachable during probe');
      return;
    }

    const failures = results.filter((r) => !r.ok);
    if (failures.length > 0) {
      console.warn('Endpoint probe failures:', failures.slice(0, 10));
    }

    expect(failures.length).toBe(0);
  }, 120000);

  it('public health endpoints respond without auth', async () => {
    if (!(await isApiReachable())) return;

    const { results, skipped } = await probeAllEndpoints(
      REST_ENDPOINTS.filter((ep) => ep.group === 'health'),
    );
    if (skipped) return;

    expect(results.every((r) => r.ok)).toBe(true);
  });
});
