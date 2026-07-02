import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildNumberHealth } = require('../../lib/v3/inventoryHealthService.js');

describe('V3 inventoryHealthService.buildNumberHealth', () => {
  const readiness = { callControlReady: true, webhookReady: true };

  it('marks fully assigned linked number green', () => {
    const health = buildNumberHealth({
      id: 'p1',
      number: '+15551230001',
      inventoryStatus: 'ASSIGNED',
      tenantId: 't1',
      employeeId: 'u1',
      extensionId: 'e1',
      extensionNumber: '101',
      routingType: 'direct_user',
    }, readiness);
    expect(health.checks.assigned).toBe('green');
    expect(health.checks.extensionLinked).toBe('green');
    expect(health.overall).not.toBe('red');
  });

  it('marks available inventory as yellow overall', () => {
    const health = buildNumberHealth({
      id: 'p2',
      number: '+15551230002',
      inventoryStatus: 'AVAILABLE',
      tenantId: null,
      employeeId: null,
      extensionId: null,
      routingType: 'tenant_default',
    }, readiness);
    expect(health.checks.inventoryStatus).toBe('yellow');
    expect(health.checks.assigned).toBe('yellow');
  });

  it('marks suspended as red inventory status', () => {
    const health = buildNumberHealth({
      id: 'p3',
      number: '+15551230003',
      inventoryStatus: 'SUSPENDED',
      tenantId: null,
      routingType: 'tenant_default',
    }, readiness);
    expect(health.checks.inventoryStatus).toBe('red');
  });
});
