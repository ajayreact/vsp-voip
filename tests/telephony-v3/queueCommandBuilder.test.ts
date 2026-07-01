import { describe, expect, it } from 'vitest';

const { buildQueueCommands } = require('../../lib/telephony-v3/Queue/queueCommandBuilder');
const { POLICY_ACTION, QUEUE_ACTION } = require('../../lib/telephony-v3/Queue/queueConstants');

describe('V3 queueCommandBuilder', () => {
  it('builds ENQUEUE for join', () => {
    const commands = buildQueueCommands({
      action: QUEUE_ACTION.JOIN,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callerCallControlId: 'cc-caller',
      queueId: 'queue-1',
    });
    expect(commands[0].commandType).toBe('ENQUEUE');
  });

  it('builds DIAL for assign', () => {
    const commands = buildQueueCommands({
      action: QUEUE_ACTION.ASSIGN,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callerCallControlId: 'cc-caller',
      agents: [{ extensionId: 'e1', sipUsername: 'agent1' }],
      queueId: 'queue-1',
    });
    expect(commands[0].commandType).toBe('DIAL');
  });

  it('builds overflow commands', () => {
    const commands = buildQueueCommands({
      action: QUEUE_ACTION.OVERFLOW,
      policy: { effectiveAction: POLICY_ACTION.ALLOW, overflow: true },
      callerCallControlId: 'cc-caller',
      overflowDestination: '+15551234567',
    });
    expect(commands.some((c) => c.commandType === 'DEQUEUE')).toBe(true);
    expect(commands.some((c) => c.commandType === 'DIAL')).toBe(true);
  });

  it('builds REJECT when denied', () => {
    const commands = buildQueueCommands({
      action: QUEUE_ACTION.JOIN,
      policy: { effectiveAction: POLICY_ACTION.DENY, reason: 'queue_disabled' },
      callerCallControlId: 'cc-caller',
    });
    expect(commands[0].commandType).toBe('REJECT');
  });
});
