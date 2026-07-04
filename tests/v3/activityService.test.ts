import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const activityService = require('../../lib/v3/activityService.js');

describe('V3 activityService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('maps audit logs to timeline events', async () => {
    const prisma = {
      user: {
        findMany: vi.fn(async () => [{ id: 'u1', email: 'a@x.com', name: 'Alice' }]),
      },
      adminAuditLog: {
        findMany: vi.fn(async () => [{
          id: 'log1',
          action: 'v3.profile.updated',
          entityType: 'V3SoftphoneProfile',
          entityId: 'p1',
          userId: 'u1',
          userEmail: 'a@x.com',
          details: {},
          createdAt: new Date(),
        }]),
        count: vi.fn(async () => 1),
      },
    };

    const timeline = await activityService.getActivityTimeline(prisma, 't1');
    expect(timeline.items).toHaveLength(1);
    expect(timeline.items[0].label).toBe('Profile Updated');
  });

  it('filters by category', async () => {
    const prisma = {
      user: { findMany: vi.fn(async () => [{ id: 'u1', email: 'a@x.com', name: 'Alice' }]) },
      adminAuditLog: {
        findMany: vi.fn(async () => [
          { id: '1', action: 'v3.device.added', entityType: 'V3DeskDevice', entityId: 'd1', userId: 'u1', userEmail: null, details: {}, createdAt: new Date() },
          { id: '2', action: 'v3.profile.updated', entityType: 'V3SoftphoneProfile', entityId: 'p1', userId: 'u1', userEmail: null, details: {}, createdAt: new Date() },
        ]),
        count: vi.fn(async () => 2),
      },
    };

    const timeline = await activityService.getActivityTimeline(prisma, 't1', { category: 'device' });
    expect(timeline.items.every((i) => i.category === 'device')).toBe(true);
  });
});
