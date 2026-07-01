import { beforeEach, describe, expect, it, vi } from 'vitest';

const health = require('../../lib/health');
const redisLib = require('../../lib/redis');
const env = require('../../lib/env');
const commandOutbox = require('../../lib/telephony-v3/Outbox/commandOutbox');
const streamsModule = require('../../lib/telephony-v3/Redis/streams');
const heartbeatModule = require('../../lib/telephony-v3/Redis/heartbeat');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
const { getV3ReadinessStatus } = require('../../lib/telephony-v3/Health/healthService');

describe('V3 HealthService', () => {
  beforeEach(() => {
    process.env.V3_METRICS_REDIS_MIRROR = 'false';
    process.env.TELEPHONY_V3_REDIS_REQUIRED = 'true';

    vi.spyOn(health, 'checkDatabase').mockResolvedValue({ connected: true, latencyMs: 1 });
    vi.spyOn(redisLib, 'pingRedis').mockResolvedValue({ connected: false, error: 'down' });
    vi.spyOn(redisLib, 'getRedisConfig').mockReturnValue({ configured: true, host: 'localhost' });
    vi.spyOn(env, 'isProduction').mockReturnValue(true);
    vi.spyOn(commandOutbox, 'countOutboxByStatus').mockResolvedValue({
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      dead: 0,
    });
    vi.spyOn(streamsModule, 'getStreamDepth').mockResolvedValue(0);
    vi.spyOn(streamsModule, 'getQueueLagMs').mockResolvedValue(null);
    vi.spyOn(streamsModule, 'getDlqDepth').mockResolvedValue(0);
    vi.spyOn(streamsModule, 'getPendingCount').mockResolvedValue(0);
    vi.spyOn(heartbeatModule, 'listActiveWorkers').mockResolvedValue({ activeCount: 0, workers: [] });
    vi.spyOn(featureFlags, 'getGlobalFlagStatus').mockReturnValue({
      globalEnabled: false,
      ingressEnabled: false,
      outboxPaused: false,
    });
  });

  it('reports not ready in production when redis required but unavailable and no workers', async () => {
    const status = await getV3ReadinessStatus();
    expect(status.redis.required).toBe(true);
    expect(status.redis.connected).toBe(false);
    expect(status.checks.workers).toBe(false);
    expect(status.checks.redis).toBe(false);
    expect(status.ready).toBe(false);
    expect(status.dlq).toBeDefined();
    expect(status.outbox.processing).toBe(0);
  });
});
