import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const commandOutbox = require('../../lib/telephony-v3/Outbox/commandOutbox');
const commandExecutor = require('../../lib/telephony-v3/Executor/commandExecutor');
const { runOutboxWorkerTick } = require('../../lib/telephony-v3/Workers/ingressWorker');

describe('V3 ingressWorker outbox tick', () => {
  const originalExecutor = process.env.TELEPHONY_V3_EXECUTOR_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalExecutor === undefined) {
      delete process.env.TELEPHONY_V3_EXECUTOR_ENABLED;
    } else {
      process.env.TELEPHONY_V3_EXECUTOR_ENABLED = originalExecutor;
    }
  });

  it('uses stub executor when TELEPHONY_V3_EXECUTOR_ENABLED is false', async () => {
    process.env.TELEPHONY_V3_EXECUTOR_ENABLED = 'false';
    vi.spyOn(commandOutbox, 'claimPendingCommands').mockResolvedValue([
      { id: 'cmd-1', commandType: 'HANGUP' },
    ]);
    vi.spyOn(commandOutbox, 'markCommandSent').mockResolvedValue({ id: 'cmd-1', commandType: 'HANGUP' });
    vi.spyOn(commandOutbox, 'acknowledgeCommand').mockResolvedValue({ id: 'cmd-1', status: 'ACKED' });

    const result = await runOutboxWorkerTick('worker-a');

    expect(result.processed).toBe(1);
    expect(commandOutbox.markCommandSent).toHaveBeenCalled();
  });

  it('delegates to command executor when TELEPHONY_V3_EXECUTOR_ENABLED is true', async () => {
    process.env.TELEPHONY_V3_EXECUTOR_ENABLED = 'true';
    vi.spyOn(commandExecutor, 'processCommandBatch').mockResolvedValue({
      processed: 2,
      succeeded: 2,
      failed: 0,
      paused: false,
    });

    const result = await runOutboxWorkerTick('worker-b');

    expect(result.processed).toBe(2);
    expect(commandExecutor.processCommandBatch).toHaveBeenCalledWith('worker-b');
  });
});
