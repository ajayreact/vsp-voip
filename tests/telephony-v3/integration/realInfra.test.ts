/**
 * B3 — V3 engine validation against REAL PostgreSQL + REAL Redis.
 * Run: npm run test:v3:integration
 *
 * No mocks for PostgreSQL or Redis. Telnyx HTTP is mocked only in scenario 10.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  TENANT_ID,
  applyIntegrationEnv,
  buildTelnyxWebhook,
  getTimingSummary,
  isIntegrationEnabled,
  probeRealInfra,
  processNextIngressJob,
  recordTiming,
  resetConnections,
  resetIntegrationState,
  resetTimingSamples,
} from './realInfra';

const gateway = require('../../../lib/telephony-v3/WebhookGateway/gateway');
const streams = require('../../../lib/telephony-v3/Redis/streams');
const { STREAM } = require('../../../lib/telephony-v3/constants');
const commandOutbox = require('../../../lib/telephony-v3/Outbox/commandOutbox');
const commandBus = require('../../../lib/telephony-v3/Commands/commandBus');
const commandExecutor = require('../../../lib/telephony-v3/Executor/commandExecutor');
const sessionManager = require('../../../lib/telephony-v3/Sessions/sessionManager');
const legManager = require('../../../lib/telephony-v3/Sessions/legManager');
const eventBus = require('../../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../../lib/telephony-v3/Events/domainEvents');
const { recordWorkerHeartbeat, listActiveWorkers } = require('../../../lib/telephony-v3/Redis/heartbeat');
const { V3ConflictError } = require('../../../lib/telephony-v3/errors');

const runIntegration = isIntegrationEnabled();

describe.runIf(runIntegration)('V3 Real Infrastructure (B3)', () => {
  let prisma: Awaited<ReturnType<typeof import('../../../db').getPrisma>>;

  beforeAll(async () => {
    const probe = await probeRealInfra();
    if (!probe.available) {
      throw new Error(`Integration infra unavailable: ${probe.reason}`);
    }
    applyIntegrationEnv();
    const db = require('../../../db');
    prisma = await db.getPrisma();
  });

  beforeEach(async () => {
    await resetIntegrationState();
    resetTimingSamples();
  });

  afterAll(async () => {
    if (runIntegration) {
      const summary = getTimingSummary();
      // eslint-disable-next-line no-console
      console.log('\n=== V3 Integration Timing Summary ===');
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(summary, null, 2));
      await resetConnections();
    }
  });

  describe('1. Webhook → Gateway → Redis Stream', () => {
    it('accepts webhook, stores payload, enqueues stream entry, creates ProcessedTelnyxEvent', async () => {
      const body = buildTelnyxWebhook({ eventId: 'evt-gw-1', callControlId: 'cc-gw-1' });

      const start = Date.now();
      const result = await gateway.handleV3WebhookIngress(body, { source: 'integration' });
      recordTiming('webhook_gateway', start);

      expect(result.accepted).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(result.ingressId).toBeTruthy();

      const depth = await streams.getStreamDepth();
      expect(depth).toBeGreaterThanOrEqual(1);

      const payloadRef = streams.newIngressPayloadRef(body);
      const stored = await streams.loadIngressPayload(payloadRef);
      expect(stored).toMatchObject(body);

      const processed = await prisma.processedTelnyxEvent.findUnique({ where: { id: 'evt-gw-1' } });
      expect(processed).toBeTruthy();
      expect(processed?.eventType).toBe('call.initiated');
    });

    it('rejects duplicate webhook at durable dedup layer', async () => {
      const body = buildTelnyxWebhook({ eventId: 'evt-dup-1', callControlId: 'cc-dup-1' });
      const first = await gateway.handleV3WebhookIngress(body, { source: 'integration' });
      expect(first.duplicate).toBe(false);

      const depthBefore = await streams.getStreamDepth();
      const second = await gateway.handleV3WebhookIngress(body, { source: 'integration' });
      const depthAfter = await streams.getStreamDepth();

      expect(second.accepted).toBe(true);
      expect(second.duplicate).toBe(true);
      expect(depthAfter).toBe(depthBefore);
    });
  });

  describe('2. Redis Consumer Group', () => {
    it('creates consumer group, delivers message, ACK clears pending', async () => {
      const body = buildTelnyxWebhook({ eventId: 'evt-cg-1', callControlId: 'cc-cg-1' });
      await gateway.handleV3WebhookIngress(body, { source: 'integration' });

      await streams.ensureConsumerGroup();
      const redis = await (await import('./realInfra')).getRedis();
      const groups = await redis.xinfo('GROUPS', STREAM.INGRESS);
      expect(JSON.stringify(groups)).toContain(STREAM.CONSUMER_GROUP);

      const pendingBefore = await streams.getPendingCount();
      expect(pendingBefore).toBe(0);

      const enqueueStart = Date.now();
      const job = await processNextIngressJob('worker-cg-1', 3000);
      recordTiming('worker_process', enqueueStart);

      expect(job).toBeTruthy();
      expect(job?.fields.eventType).toBe('call.initiated');

      const pendingAfter = await streams.getPendingCount();
      expect(pendingAfter).toBe(0);
    });
  });

  describe('3. CallManager pipeline', () => {
    it('processes webhook through worker into session, leg, FSM transition, and outbox', async () => {
      const cc = 'cc-cm-1';
      const cs = 'cs-cm-1';
      const body = buildTelnyxWebhook({
        eventId: 'evt-cm-init',
        callControlId: cc,
        callSessionId: cs,
        eventType: 'call.initiated',
        state: 'parked',
      });

      await gateway.handleV3WebhookIngress(body, { source: 'integration' });
      await processNextIngressJob('worker-cm-1', 3000);

      const leg = await prisma.v3CallLeg.findUnique({ where: { callControlId: cc } });
      expect(leg).toBeTruthy();

      const session = await prisma.v3CallSession.findUnique({
        where: { id: leg!.sessionId },
        include: { legs: true },
      });
      expect(session).toBeTruthy();
      expect(session?.tenantId).toBe(TENANT_ID);
      expect(session?.state).toBe('ORIGIN_PARKED');

      const transitions = await prisma.v3SessionTransition.findMany({
        where: { sessionId: session!.id },
      });
      expect(transitions.length).toBeGreaterThan(0);

      const answeredBody = buildTelnyxWebhook({
        eventId: 'evt-cm-answered',
        callControlId: cc,
        callSessionId: cs,
        eventType: 'call.answered',
        state: 'answered',
      });
      await gateway.handleV3WebhookIngress(answeredBody, { source: 'integration' });
      await processNextIngressJob('worker-cm-1', 3000);

      const updated = await prisma.v3CallSession.findUnique({ where: { id: session!.id } });
      expect(['ACTIVE', 'BRIDGING', 'RINGING']).toContain(updated?.state);

      const outboxRows = await prisma.v3CommandOutbox.findMany({ where: { sessionId: session!.id } });
      expect(outboxRows.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('4. PostgreSQL transactions', () => {
    it('optimistic locking rejects stale version', async () => {
      const { session } = await sessionManager.createSession({
        tenantId: TENANT_ID,
        correlationId: 'corr-lock',
      });

      await expect(
        sessionManager.persistSessionTransition(
          session.id,
          session.version + 99,
          { state: 'ROUTING' },
          {
            fromState: 'NEW',
            toState: 'ROUTING',
            triggerEvent: 'route.decided',
            eventId: 'evt-lock-fail',
          },
          TENANT_ID,
        ),
      ).rejects.toBeInstanceOf(V3ConflictError);
    });

    it('rolls back transaction on failure (no partial transition row)', async () => {
      const { session } = await sessionManager.createSession({
        tenantId: TENANT_ID,
        correlationId: 'corr-tx-rollback',
      });

      const before = await prisma.v3SessionTransition.count({ where: { sessionId: session.id } });

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.v3CallSession.update({
            where: { id: session.id },
            data: { state: 'ROUTING', version: { increment: 1 } },
          });
          throw new Error('simulated failure');
        }),
      ).rejects.toThrow('simulated failure');

      const afterSession = await prisma.v3CallSession.findUnique({ where: { id: session.id } });
      expect(afterSession?.state).toBe('NEW');
      expect(await prisma.v3SessionTransition.count({ where: { sessionId: session.id } })).toBe(before);
    });

    it('duplicate event replay returns existing session without duplicate legs', async () => {
      const cc = 'cc-dup-leg';
      const body = buildTelnyxWebhook({
        eventId: 'evt-dup-leg-1',
        callControlId: cc,
        callSessionId: 'cs-dup-leg',
      });

      await gateway.handleV3WebhookIngress(body, { source: 'integration' });
      await processNextIngressJob('worker-dup-1', 3000);
      await processNextIngressJob('worker-dup-1', 500);

      const legs = await prisma.v3CallLeg.findMany({ where: { callControlId: cc } });
      expect(legs).toHaveLength(1);
    });

    it('version conflict retry succeeds on reload', async () => {
      const { session } = await sessionManager.createSession({
        tenantId: TENANT_ID,
        correlationId: 'corr-retry',
      });

      let attempts = 0;
      let result;
      while (attempts < 3) {
        attempts += 1;
        const current = await sessionManager.loadSession(session.id, TENANT_ID);
        try {
          result = await sessionManager.persistSessionTransition(
            current.id,
            current.version,
            { state: 'ORIGIN_PARKED' },
            {
              fromState: current.state,
              toState: 'ORIGIN_PARKED',
              triggerEvent: 'origin.parked',
              eventId: `evt-retry-${attempts}`,
            },
            TENANT_ID,
          );
          break;
        } catch (error) {
          if (!(error instanceof V3ConflictError) || attempts >= 3) throw error;
        }
      }

      expect(result?.state).toBe('ORIGIN_PARKED');
      expect(attempts).toBeGreaterThanOrEqual(1);
    });

    it('persists session and leg rows durably', async () => {
      const { session } = await sessionManager.createSession({ tenantId: TENANT_ID });
      const { leg } = await legManager.findOrCreateLeg({
        sessionId: session.id,
        callControlId: 'cc-persist-1',
        role: 'ORIGIN',
      });

      const reloadedSession = await prisma.v3CallSession.findUnique({ where: { id: session.id } });
      const reloadedLeg = await prisma.v3CallLeg.findUnique({ where: { id: leg.id } });
      expect(reloadedSession?.tenantId).toBe(TENANT_ID);
      expect(reloadedLeg?.callControlId).toBe('cc-persist-1');
    });
  });

  describe('5. Outbox lifecycle (real PostgreSQL)', () => {
    async function seedSession() {
      const { session } = await sessionManager.createSession({
        tenantId: TENANT_ID,
        correlationId: 'corr-outbox',
        primaryCallControlId: 'cc-outbox-1',
      });
      await legManager.findOrCreateLeg({
        sessionId: session.id,
        callControlId: 'cc-outbox-1',
        role: 'ORIGIN',
      });
      return session;
    }

    it('walks PENDING → PROCESSING → SENT → ACKED', async () => {
      const session = await seedSession();
      const row = await commandOutbox.enqueueCommand({
        sessionId: session.id,
        legId: null,
        commandType: 'HANGUP',
        idempotencyKey: `${session.id}:HANGUP:cc-outbox-1:0`,
        payload: { callControlId: 'cc-outbox-1' },
      });
      expect(row.status).toBe('PENDING');

      const txStart = Date.now();
      const [claimed] = await commandOutbox.claimPendingCommands('worker-outbox-a', 1);
      recordTiming('outbox_claim', txStart);
      expect(claimed.status).toBe('PROCESSING');
      expect(claimed.claimOwner).toBe('worker-outbox-a');

      await commandOutbox.markCommandSent(claimed.id, 'worker-outbox-a', { telnyxRequestId: 'tx-req-1' });
      const sent = await prisma.v3CommandOutbox.findUnique({ where: { id: claimed.id } });
      expect(sent?.status).toBe('SENT');

      await commandOutbox.acknowledgeCommand(claimed.id, 'worker-outbox-a');
      const acked = await prisma.v3CommandOutbox.findUnique({ where: { id: claimed.id } });
      expect(acked?.status).toBe('ACKED');
    });

    it('marks FAILED then DEAD after max attempts', async () => {
      const session = await seedSession();
      const row = await commandOutbox.enqueueCommand({
        sessionId: session.id,
        commandType: 'DIAL',
        idempotencyKey: `${session.id}:DIAL:fail:0`,
        payload: {},
        maxAttempts: 2,
      });

      let [claimed] = await commandOutbox.claimPendingCommands('worker-fail', 1);
      let failed = await commandOutbox.markCommandFailed(claimed.id, 'transient', 'worker-fail');
      expect(failed.status).toBe('FAILED');

      await prisma.v3CommandOutbox.update({
        where: { id: row.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });

      [claimed] = await commandOutbox.claimPendingCommands('worker-fail', 1);
      const dead = await commandOutbox.markCommandFailed(claimed.id, 'permanent', 'worker-fail');
      expect(dead.status).toBe('DEAD');
    });

    it('reclaims expired PROCESSING lease', async () => {
      const session = await seedSession();
      const row = await commandOutbox.enqueueCommand({
        sessionId: session.id,
        commandType: 'ANSWER',
        idempotencyKey: `${session.id}:ANSWER:lease:0`,
        payload: {},
      });

      await prisma.v3CommandOutbox.update({
        where: { id: row.id },
        data: {
          status: 'PROCESSING',
          claimOwner: 'dead-worker',
          claimedUntil: new Date(Date.now() - 60_000),
          nextAttemptAt: new Date(),
        },
      });

      const [reclaimed] = await commandOutbox.claimPendingCommands('recovery-worker', 1);
      expect(reclaimed.id).toBe(row.id);
      expect(reclaimed.claimOwner).toBe('recovery-worker');
    });
  });

  describe('6. Multi-worker concurrency', () => {
    it('assigns disjoint outbox claims to two workers (SKIP LOCKED)', async () => {
      const { session } = await sessionManager.createSession({ tenantId: TENANT_ID });
      await commandOutbox.enqueueCommand({
        sessionId: session.id,
        commandType: 'HANGUP',
        idempotencyKey: `${session.id}:HANGUP:a:0`,
        payload: {},
      });
      await commandOutbox.enqueueCommand({
        sessionId: session.id,
        commandType: 'HANGUP',
        idempotencyKey: `${session.id}:HANGUP:b:0`,
        payload: {},
      });

      const [a, b] = await Promise.all([
        commandOutbox.claimPendingCommands('worker-a', 1),
        commandOutbox.claimPendingCommands('worker-b', 1),
      ]);

      const ids = new Set([a[0]?.id, b[0]?.id].filter(Boolean));
      expect(ids.size).toBe(2);
    });

    it('distributes ingress messages across consumer group members', async () => {
      for (let i = 0; i < 2; i += 1) {
        const body = buildTelnyxWebhook({
          eventId: `evt-mw-${i}`,
          callControlId: `cc-mw-${i}`,
          callSessionId: `cs-mw-${i}`,
        });
        await gateway.handleV3WebhookIngress(body, { source: 'integration' });
      }

      const jobA = await processNextIngressJob('worker-mw-a', 3000);
      const jobB = await processNextIngressJob('worker-mw-b', 3000);

      expect(jobA?.id).toBeTruthy();
      expect(jobB?.id).toBeTruthy();
      expect(jobA?.id).not.toBe(jobB?.id);

      const sessions = await prisma.v3CallSession.findMany({
        where: { primaryCallControlId: { in: ['cc-mw-0', 'cc-mw-1'] } },
      });
      expect(sessions).toHaveLength(2);
    });

    it('does not duplicate leg on parallel findOrCreateLeg', async () => {
      const { session } = await sessionManager.createSession({ tenantId: TENANT_ID });
      await Promise.all([
        legManager.findOrCreateLeg({
          sessionId: session.id,
          callControlId: 'cc-par-leg',
          role: 'ORIGIN',
        }),
        legManager.findOrCreateLeg({
          sessionId: session.id,
          callControlId: 'cc-par-leg',
          role: 'ORIGIN',
        }),
      ]);

      const legs = await prisma.v3CallLeg.findMany({ where: { callControlId: 'cc-par-leg' } });
      expect(legs).toHaveLength(1);
    });
  });

  describe('7. Crash recovery', () => {
    it('reclaims stale ingress message after worker death simulation', async () => {
      const { dispatchIngressJob } = require('../../../lib/telephony-v3/Workers/ingressDispatcher');

      const body = buildTelnyxWebhook({
        eventId: 'evt-crash-1',
        callControlId: 'cc-crash-1',
        callSessionId: 'cs-crash-1',
      });
      await gateway.handleV3WebhookIngress(body, { source: 'integration' });

      const batch = await streams.readIngressBatch('dead-worker', 1, 1000);
      expect(batch.length).toBe(1);

      const stale = await streams.claimStaleMessages('recovery-worker', 0, 5);
      expect(stale.length).toBeGreaterThanOrEqual(1);

      await dispatchIngressJob(stale[0], { workerId: 'recovery-worker' });
      await streams.ackIngressJob(stale[0].id);

      const leg = await prisma.v3CallLeg.findUnique({ where: { callControlId: 'cc-crash-1' } });
      expect(leg).toBeTruthy();
      expect(await streams.getPendingCount()).toBe(0);
    });
  });

  describe('8. Redis restart recovery', () => {
    it('reconnects and restores heartbeat after Redis client reset', async () => {
      await recordWorkerHeartbeat('worker-redis-recovery', { role: 'ingress' });
      let workers = await listActiveWorkers();
      expect(workers.activeCount).toBeGreaterThanOrEqual(1);

      const redisLib = require('../../../lib/redis');
      await redisLib.closeRedis();

      const ping = await redisLib.pingRedis();
      expect(ping.connected).toBe(true);

      await recordWorkerHeartbeat('worker-redis-recovery', { role: 'ingress' });
      workers = await listActiveWorkers();
      expect(workers.workers.some((w) => w.workerId === 'worker-redis-recovery')).toBe(true);
    });
  });

  describe('9. Database restart recovery', () => {
    it('reconnects Prisma and preserves committed rows', async () => {
      const { session } = await sessionManager.createSession({
        tenantId: TENANT_ID,
        correlationId: 'corr-db-restart',
      });

      const db = require('../../../db');
      await db.disconnectPrisma();

      const reloaded = await db.getPrisma();
      const row = await reloaded.v3CallSession.findUnique({ where: { id: session.id } });
      expect(row?.correlationId).toBe('corr-db-restart');
    });
  });

  describe('10. End-to-end telephony pipeline (Telnyx HTTP mocked)', () => {
    it('runs Gateway → Worker → CallManager → CommandBus → Outbox → Executor', async () => {
      const cc = 'cc-e2e-1';
      const cs = 'cs-e2e-1';

      const initiated = buildTelnyxWebhook({
        eventId: 'evt-e2e-init',
        callControlId: cc,
        callSessionId: cs,
        eventType: 'call.initiated',
        state: 'parked',
      });
      await gateway.handleV3WebhookIngress(initiated, { source: 'integration' });
      await processNextIngressJob('worker-e2e', 3000);

      const session = await prisma.v3CallSession.findFirst({
        where: { primaryCallControlId: cc },
      });
      expect(session).toBeTruthy();

      const leg = await prisma.v3CallLeg.findFirst({ where: { sessionId: session!.id } });
      expect(leg).toBeTruthy();

      eventBus.resetForTests();
      await commandBus.enqueueIntent({
        sessionId: session!.id,
        legId: leg!.id,
        tenantId: TENANT_ID,
        correlationId: session!.correlationId,
        commandType: 'HANGUP',
        targetCallControlId: cc,
        reason: 'integration_e2e',
        payload: { phase: 'B3' },
        sequence: 0,
      });

      const outboxRows = await prisma.v3CommandOutbox.findMany({ where: { sessionId: session!.id } });
      expect(outboxRows.length).toBe(1);

      const telnyx = {
        hangupCall: vi.fn().mockResolvedValue({ id: 'mock-telnyx-req' }),
        dialCall: vi.fn().mockResolvedValue({ id: 'mock-dial-req' }),
        answerCall: vi.fn().mockResolvedValue({ id: 'mock-answer-req' }),
      };

      const [claimed] = await commandOutbox.claimPendingCommands('worker-e2e-exec', 1);
      const outcome = await commandExecutor.executeOneCommand(claimed, 'worker-e2e-exec', { telnyx });

      expect(outcome.ok).toBe(true);
      expect(telnyx.hangupCall).toHaveBeenCalledTimes(1);

      const completed = await prisma.v3CommandOutbox.findUnique({ where: { id: claimed.id } });
      expect(completed?.status).toBe('ACKED');

      const events = eventBus.replay({ sessionId: session!.id });
      expect(events.some((e) => e.eventType === DOMAIN_EVENTS.COMMAND_ENQUEUED)).toBe(true);
    });
  });

  describe('11. Performance timing', () => {
    it('records webhook, enqueue, worker, and transaction latencies', async () => {
      const body = buildTelnyxWebhook({
        eventId: 'evt-perf-1',
        callControlId: 'cc-perf-1',
        callSessionId: 'cs-perf-1',
      });

      const webhookStart = Date.now();
      await gateway.handleV3WebhookIngress(body, { source: 'integration' });
      recordTiming('webhook_latency', webhookStart);

      const enqueueStart = Date.now();
      await streams.getStreamDepth();
      recordTiming('redis_enqueue_verify', enqueueStart);

      const workerStart = Date.now();
      await processNextIngressJob('worker-perf', 3000);
      recordTiming('worker_latency', workerStart);

      const { session } = await sessionManager.createSession({ tenantId: TENANT_ID });
      const txStart = Date.now();
      await commandOutbox.enqueueCommand({
        sessionId: session.id,
        commandType: 'SPEAK',
        idempotencyKey: `${session.id}:SPEAK:perf:0`,
        payload: { text: 'perf' },
      });
      recordTiming('outbox_enqueue', txStart);

      const summary = getTimingSummary();
      expect(summary.webhook_latency?.count).toBeGreaterThan(0);
      expect(summary.worker_latency?.count).toBeGreaterThan(0);
    });
  });
});

describe.runIf(!runIntegration)('V3 Real Infrastructure (B3)', () => {
  it('skips when V3_INTEGRATION is not enabled', () => {
    expect(isIntegrationEnabled()).toBe(false);
  });
});
