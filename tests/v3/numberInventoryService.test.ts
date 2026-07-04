import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { deriveInventoryStatus, V3_SOURCE } = require('../../lib/v3/numberInventoryService.js');

describe('V3 numberInventoryService.deriveInventoryStatus', () => {
  it('returns AVAILABLE for active unassigned platform numbers', () => {
    expect(deriveInventoryStatus({ number: '+15551230001', isActive: true, tenantId: null, source: V3_SOURCE.AVAILABLE })).toBe('AVAILABLE');
  });

  it('returns RESERVED for v3:RESERVED source', () => {
    expect(deriveInventoryStatus({ number: '+15551230002', isActive: true, source: V3_SOURCE.RESERVED })).toBe('RESERVED');
  });

  it('returns ASSIGNED when tenantId is set', () => {
    expect(deriveInventoryStatus({ number: '+15551230003', isActive: true, tenantId: 't1' })).toBe('ASSIGNED');
  });

  it('returns PORTING when number is in porting set', () => {
    const set = new Set(['+15551230004']);
    expect(deriveInventoryStatus({ number: '+15551230004', isActive: true, tenantId: null }, set)).toBe('PORTING');
  });

  it('returns SUSPENDED when inactive', () => {
    expect(deriveInventoryStatus({ number: '+15551230005', isActive: false, tenantId: 't1' })).toBe('SUSPENDED');
  });

  it('returns RELEASE_PENDING for v3:RELEASE_PENDING source', () => {
    expect(deriveInventoryStatus({ number: '+15551230006', isActive: true, source: V3_SOURCE.RELEASE_PENDING })).toBe('RELEASE_PENDING');
  });
});
