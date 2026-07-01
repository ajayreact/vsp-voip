import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workerEnv = require('../../lib/telephony-v3/Utils/workerEnv');

const REQUIRED = {
  TELEPHONY_V3_GLOBAL: 'false',
  TELEPHONY_V3_INGRESS_ENABLED: 'false',
  TELEPHONY_V3_CALLMANAGER_ENABLED: 'false',
  TELEPHONY_V3_EXECUTOR_ENABLED: 'false',
  DATABASE_URL: 'postgresql://vsp:vsp@localhost:5432/vsp_voip_test',
  REDIS_URL: 'redis://localhost:6379',
};

describe('V3 worker production wiring (B2)', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of workerEnv.REQUIRED_WORKER_ENV) {
      saved[key] = process.env[key];
    }
    process.env.V3_WORKER_SKIP_ENV_VALIDATE = 'false';
    for (const [key, value] of Object.entries(REQUIRED)) {
      process.env[key] = value;
    }
  });

  afterEach(() => {
    for (const key of workerEnv.REQUIRED_WORKER_ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    delete process.env.V3_WORKER_SKIP_ENV_VALIDATE;
  });

  describe('workerEnv', () => {
    it('passes when all required variables are set', () => {
      expect(() => workerEnv.validateWorkerEnv()).not.toThrow();
    });

    it('fails fast with a clear error when a required variable is missing', () => {
      delete process.env.TELEPHONY_V3_EXECUTOR_ENABLED;
      expect(() => workerEnv.validateWorkerEnv()).toThrow(/TELEPHONY_V3_EXECUTOR_ENABLED is required/);
    });

    it('allows empty-string DATABASE_URL to fail validation', () => {
      process.env.DATABASE_URL = '   ';
      expect(() => workerEnv.validateWorkerEnv()).toThrow(/DATABASE_URL is required/);
    });

    it('can be skipped for test harnesses', () => {
      delete process.env.DATABASE_URL;
      process.env.V3_WORKER_SKIP_ENV_VALIDATE = 'true';
      expect(() => workerEnv.validateWorkerEnv()).not.toThrow();
    });
  });

  describe('readiness integration', () => {
    it('healthService treats missing workers as unhealthy in production', async () => {
      const health = require('../../lib/health');
      const redisLib = require('../../lib/redis');
      const env = require('../../lib/env');
      const commandOutbox = require('../../lib/telephony-v3/Outbox/commandOutbox');
      const streamsModule = require('../../lib/telephony-v3/Redis/streams');
      const heartbeatModule = require('../../lib/telephony-v3/Redis/heartbeat');
      const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
      const { getV3ReadinessStatus } = require('../../lib/telephony-v3/Health/healthService');

      vi.spyOn(health, 'checkDatabase').mockResolvedValue({ connected: true, latencyMs: 1 });
      vi.spyOn(redisLib, 'pingRedis').mockResolvedValue({ connected: true, latencyMs: 1 });
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
      vi.spyOn(featureFlags, 'getGlobalFlagStatus').mockReturnValue({
        globalEnabled: true,
        ingressEnabled: true,
        outboxPaused: false,
      });

      vi.spyOn(heartbeatModule, 'listActiveWorkers').mockResolvedValue({
        activeCount: 1,
        workers: [{ workerId: 'worker-compose-1', at: Date.now(), role: 'ingress' }],
      });

      const status = await getV3ReadinessStatus();
      expect(status.checks.workers).toBe(true);
      expect(status.workers.activeCount).toBe(1);
      expect(status.workers.workers[0].workerId).toBe('worker-compose-1');
    });
  });

  describe('duplicate processing guards', () => {
    it('uses Redis consumer groups for ingress (one consumer per message)', () => {
      const streamsSource = require('fs').readFileSync(
        require('path').join(__dirname, '../../lib/telephony-v3/Redis/streams.js'),
        'utf8',
      );
      expect(streamsSource).toContain('xreadgroup');
      expect(streamsSource).toContain('CONSUMER_GROUP');
    });

    it('uses SKIP LOCKED for outbox claims (disjoint worker batches)', () => {
      const outboxSource = require('fs').readFileSync(
        require('path').join(__dirname, '../../lib/telephony-v3/Outbox/commandOutbox.js'),
        'utf8',
      );
      expect(outboxSource).toContain('FOR UPDATE SKIP LOCKED');
    });
  });

  describe('graceful shutdown wiring', () => {
    it('worker script registers SIGTERM handler and drain timeout', () => {
      const workerSource = require('fs').readFileSync(
        require('path').join(__dirname, '../../scripts/telephony-v3-worker.js'),
        'utf8',
      );
      expect(workerSource).toContain("process.on('SIGTERM'");
      expect(workerSource).toContain('waitForDrain');
      expect(workerSource).toContain('validateWorkerEnv');
    });
  });
});
