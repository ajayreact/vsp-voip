import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveMenuTree,
  resolveMenuNode,
  resolveDigitDestination,
  resolveDestinationTarget,
} = require('../../lib/telephony-v3/IVR/ivrMenuResolver');
const { DESTINATION_TYPE } = require('../../lib/telephony-v3/IVR/ivrConstants');
const prisma = require('../../lib/telephony-v3/internal/prisma');

describe('V3 ivrMenuResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.__setGetPrismaForTests(async () => ({
      extension: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ext-1',
          telnyxSipUsername: 'agent1',
          displayName: 'Agent One',
        }),
      },
      ringGroupMember: {
        findMany: vi.fn().mockResolvedValue([
          { extension: { telnyxSipUsername: 'rg1' } },
          { extension: { telnyxSipUsername: 'rg2' } },
        ]),
      },
    }));
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
  });

  it('uses greeting ivrOptions menus', () => {
    const tree = resolveMenuTree({
      ivrOptions: {
        menus: {
          root: { greeting: { text: 'Hello' }, digits: { '1': { destination: 'EXTENSION' } } },
        },
      },
    }, null);
    expect(tree.root.greeting.text).toBe('Hello');
  });

  it('resolves menu node with defaults', () => {
    const node = resolveMenuNode({ root: { greeting: { text: 'Hi' } } }, 'root');
    expect(node?.timeoutSec).toBe(5);
    expect(node?.retryCount).toBe(3);
  });

  it('resolves digit destination', () => {
    const menuNode = {
      digits: { '2': { destination: DESTINATION_TYPE.QUEUE, queueId: 'q-1' } },
    };
    const dest = resolveDigitDestination(menuNode, '2');
    expect(dest?.destination).toBe(DESTINATION_TYPE.QUEUE);
    expect(dest?.queueId).toBe('q-1');
  });

  it('resolves extension target for tenant', async () => {
    const target = await resolveDestinationTarget({
      destination: DESTINATION_TYPE.EXTENSION,
      extensionId: 'ext-1',
    }, 'tenant-1');
    expect(target.dialTo).toBe('sip:agent1@sip.telnyx.com');
  });

  it('resolves ring group dial targets', async () => {
    const target = await resolveDestinationTarget({
      destination: DESTINATION_TYPE.RING_GROUP,
      ringGroupId: 'rg-1',
    }, 'tenant-1');
    expect(target.dialTargets).toEqual([
      'sip:rg1@sip.telnyx.com',
      'sip:rg2@sip.telnyx.com',
    ]);
  });

  it('returns null extension when tenant isolated', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      extension: { findFirst: vi.fn().mockResolvedValue(null) },
      ringGroupMember: { findMany: vi.fn().mockResolvedValue([]) },
    }));
    const target = await resolveDestinationTarget({
      destination: DESTINATION_TYPE.EXTENSION,
      extensionId: 'ext-other-tenant',
    }, 'tenant-1');
    expect(target.extensionId).toBeUndefined();
    expect(target.dialTo).toBeNull();
  });
});
