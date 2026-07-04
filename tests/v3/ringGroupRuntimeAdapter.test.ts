import { describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ringGroupRuntimeAdapter = require('../../lib/v3/runtime/ringGroupRuntimeAdapter.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeAdapter = require('../../lib/v3/runtime/runtimeAdapter.js');

describe('V3 ringGroupRuntimeAdapter', () => {
  it('deactivates legacy ring group on delete action', async () => {
    vi.spyOn(runtimeAdapter, 'getLink').mockResolvedValue({
      runtimeEntityId: 'legacy-rg-1',
      v3EntityType: 'ring_group',
      v3EntityId: 'v3-rg-1',
    });

    const prisma = {
      v3RingGroup: {
        findFirst: vi.fn(async () => ({
          id: 'v3-rg-1',
          tenantId: 't1',
          removedAt: new Date(),
          isActive: false,
        })),
      },
      ringGroup: {
        update: vi.fn(async () => ({ id: 'legacy-rg-1', isActive: false })),
      },
    };

    const result = await ringGroupRuntimeAdapter.sync(prisma, 't1', 'v3-rg-1', { action: 'delete' });
    expect(result.ok).toBe(true);
    expect(result.action).toBe('deactivated');
    expect(prisma.ringGroup.update).toHaveBeenCalledWith({
      where: { id: 'legacy-rg-1' },
      data: { isActive: false },
    });
  });
});
