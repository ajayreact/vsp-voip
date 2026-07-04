import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRedis = {
  xpending: vi.fn(),
  xadd: vi.fn(),
  xack: vi.fn(),
};

const requireRedis = require('../../lib/telephony-v3/Redis/requireRedis');
const streams = require('../../lib/telephony-v3/Redis/streams');

describe('V3 Streams poison-message handling', () => {
  beforeEach(() => {
    process.env.V3_METRICS_REDIS_MIRROR = 'false';
    vi.clearAllMocks();
    streams.resetConsumerGroupCacheForTests();
    vi.spyOn(requireRedis, 'requireV3Redis').mockResolvedValue(mockRedis);
    mockRedis.xadd.mockResolvedValue('dlq-1');
    mockRedis.xack.mockResolvedValue(1);
  });

  it('reads per-message delivery count from XPENDING', async () => {
    mockRedis.xpending.mockResolvedValue([['msg-1', 'worker-a', 120000, 3]]);
    const count = await streams.getMessageDeliveryCount('msg-1');
    expect(count).toBe(3);
  });

  it('moves message to DLQ with delivery count without affecting others', async () => {
    await streams.moveToDlq('msg-1', { eventType: 'call.initiated' }, 'boom', 5);

    expect(mockRedis.xadd).toHaveBeenCalledWith(
      'v3:stream:telephony-dlq',
      'MAXLEN',
      '~',
      '50000',
      '*',
      'originalId',
      'msg-1',
      'reason',
      'boom',
      'deliveryCount',
      '5',
      'failedAt',
      expect.any(String),
      'eventType',
      'call.initiated',
    );
    expect(mockRedis.xack).toHaveBeenCalledWith(
      'v3:stream:telephony-ingress',
      'v3-workers',
      'msg-1',
    );
  });
});
