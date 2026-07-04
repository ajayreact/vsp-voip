import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindLeg = vi.fn();
const mockFindSession = vi.fn();

const prisma = require('../../lib/telephony-v3/internal/prisma');
const locks = require('../../lib/telephony-v3/Redis/locks');
const commandOutbox = require('../../lib/telephony-v3/Outbox/commandOutbox');
const { metrics } = require('../../lib/telephony-v3/Utils/metrics');
const domainEventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');
const commandExecutor = require('../../lib/telephony-v3/Executor/commandExecutor');

function mockTelnyxSuccess(id = 'telnyx-req-1') {
  return {
    answerCall: vi.fn().mockResolvedValue({ id }),
    hangupCall: vi.fn().mockResolvedValue({ id }),
    bridgeCalls: vi.fn().mockResolvedValue({ id }),
    speakCall: vi.fn().mockResolvedValue({ id }),
    startCallRecording: vi.fn().mockResolvedValue({ id }),
    callControlAction: vi.fn().mockResolvedValue({ id }),
  };
}

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cmd-1',
    sessionId: 'sess-1',
    legId: 'leg-1',
    commandType: 'HANGUP',
    attempts: 0,
    maxAttempts: 5,
    payload: { sourceEventId: 'evt-1' },
    ...overrides,
  };
}

describe('V3 commandExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metrics.resetMetricsForTests();
    domainEventBus.resetForTests();
    vi.spyOn(locks, 'withSessionLock').mockImplementation(async (_id, fn) => fn());
    prisma.__setGetPrismaForTests(async () => ({
      v3CallLeg: { findUnique: mockFindLeg },
      v3CallSession: { findUnique: mockFindSession },
    }));
    mockFindLeg.mockResolvedValue({ id: 'leg-1', callControlId: 'cc-leg-1' });
    mockFindSession.mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      correlationId: 'corr-1',
      primaryCallControlId: 'cc-primary',
    });

    vi.spyOn(commandOutbox, 'recordCommandExecutionStarted').mockResolvedValue({});
    vi.spyOn(commandOutbox, 'completeCommand').mockResolvedValue({ id: 'cmd-1', status: 'ACKED' });
    vi.spyOn(commandOutbox, 'markCommandExecutionFailed').mockResolvedValue({ id: 'cmd-1', status: 'FAILED' });
    vi.spyOn(commandOutbox, 'claimPendingCommands').mockResolvedValue([]);
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('executes successful HANGUP and emits domain events', async () => {
    const telnyx = mockTelnyxSuccess();
    const row = baseRow();

    const outcome = await commandExecutor.executeOneCommand(row, 'worker-a', { telnyx });

    expect(outcome.ok).toBe(true);
    expect(telnyx.hangupCall).toHaveBeenCalledWith('cc-leg-1');
    expect(commandOutbox.recordCommandExecutionStarted).toHaveBeenCalled();
    expect(commandOutbox.completeCommand).toHaveBeenCalledWith('cmd-1', 'worker-a', expect.objectContaining({
      telnyxRequestId: 'telnyx-req-1',
    }));

    const events = domainEventBus.replay({ sessionId: 'sess-1' });
    expect(events.some((e: { eventType: string }) => e.eventType === DOMAIN_EVENTS.COMMAND_STARTED)).toBe(true);
    expect(events.some((e: { eventType: string }) => e.eventType === DOMAIN_EVENTS.COMMAND_COMPLETED)).toBe(true);

    const prom = await metrics.renderPrometheus();
    expect(prom).toContain('commands_started_total');
    expect(prom).toContain('commands_completed_total');
  });

  it('retries retryable adapter failures', async () => {
    const telnyx = mockTelnyxSuccess();
    telnyx.hangupCall.mockRejectedValue(Object.assign(new Error('upstream 503'), { status: 503 }));

    const outcome = await commandExecutor.executeOneCommand(baseRow(), 'worker-a', { telnyx });

    expect(outcome.ok).toBe(false);
    expect(commandOutbox.markCommandExecutionFailed).toHaveBeenCalledWith('cmd-1', 'worker-a', expect.objectContaining({
      retryable: true,
      failureClass: 'Carrier',
    }));

    const prom = await metrics.renderPrometheus();
    expect(prom).toContain('commands_failed_total');
  });

  it('dead-letters permanent validation failures', async () => {
    const telnyx = mockTelnyxSuccess();
    telnyx.hangupCall.mockRejectedValue(Object.assign(new Error('bad payload'), { status: 400 }));

    vi.spyOn(commandOutbox, 'markCommandExecutionFailed').mockResolvedValue({
      id: 'cmd-1',
      status: 'DEAD',
      commandType: 'HANGUP',
    });

    const outcome = await commandExecutor.executeOneCommand(baseRow(), 'worker-a', { telnyx });

    expect(outcome.ok).toBe(false);
    expect(commandOutbox.markCommandExecutionFailed).toHaveBeenCalledWith('cmd-1', 'worker-a', expect.objectContaining({
      retryable: false,
      failureClass: 'Validation',
    }));

    const prom = await metrics.renderPrometheus();
    expect(prom).toContain('command_dlq_total');
  });

  it('completes idempotent permanent failures without retry', async () => {
    const telnyx = mockTelnyxSuccess();
    telnyx.hangupCall.mockRejectedValue(Object.assign(new Error('Call has ended'), { status: 409 }));

    const outcome = await commandExecutor.executeOneCommand(baseRow(), 'worker-a', { telnyx });

    expect(outcome.ok).toBe(true);
    expect(outcome.idempotent).toBe(true);
    expect(commandOutbox.completeCommand).toHaveBeenCalled();
    expect(commandOutbox.markCommandExecutionFailed).not.toHaveBeenCalled();
  });

  it('acks unsupported commands without failing worker', async () => {
    const telnyx = mockTelnyxSuccess();
    const row = baseRow({ commandType: 'FORWARD' });

    const outcome = await commandExecutor.executeOneCommand(row, 'worker-a', { telnyx });

    expect(outcome.ok).toBe(true);
    expect(telnyx.hangupCall).not.toHaveBeenCalled();
    expect(commandOutbox.completeCommand).toHaveBeenCalledWith('cmd-1', 'worker-a', expect.objectContaining({
      result: expect.objectContaining({ skipped: true, reason: 'unsupported' }),
    }));
  });

  it('increments retry metric when attempts > 0', async () => {
    const telnyx = mockTelnyxSuccess();
    telnyx.hangupCall.mockRejectedValue(Object.assign(new Error('upstream 503'), { status: 503 }));

    await commandExecutor.executeOneCommand(baseRow({ attempts: 1 }), 'worker-a', { telnyx });

    const prom = await metrics.renderPrometheus();
    expect(prom).toContain('command_retry_total');
  });

  it('processes batch via claim loop', async () => {
    vi.spyOn(commandOutbox, 'claimPendingCommands').mockResolvedValue([
      baseRow(),
      baseRow({ id: 'cmd-2' }),
    ]);
    const telnyx = mockTelnyxSuccess();

    const result = await commandExecutor.processCommandBatch('worker-a', 10, { telnyx });

    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(commandOutbox.claimPendingCommands).toHaveBeenCalledWith('worker-a', 10);
  });

  it('resolves callControlId from session when leg missing', async () => {
    mockFindLeg.mockResolvedValue(null);
    const telnyx = mockTelnyxSuccess();
    const row = baseRow({ legId: null });

    await commandExecutor.executeOneCommand(row, 'worker-a', { telnyx });

    expect(telnyx.hangupCall).toHaveBeenCalledWith('cc-primary');
  });

  it('includes observability fields in started event payload', async () => {
    const telnyx = mockTelnyxSuccess();
    await commandExecutor.executeOneCommand(baseRow(), 'worker-a', { telnyx });

    const started = domainEventBus.replay({ eventType: DOMAIN_EVENTS.COMMAND_STARTED })[0];
    expect(started.payload).toMatchObject({
      commandId: 'cmd-1',
      commandType: 'HANGUP',
      traceId: 'evt-1',
      workerId: 'worker-a',
    });
  });
});
