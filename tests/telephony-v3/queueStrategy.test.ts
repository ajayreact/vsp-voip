import { beforeEach, describe, expect, it } from 'vitest';

const { selectAgentsForStrategy, filterAvailableAgents } = require('../../lib/telephony-v3/Queue/queueStrategy');
const { RING_STRATEGY } = require('../../lib/telephony-v3/Queue/queueConstants');
const { resetQueueStateForTests } = require('../../lib/telephony-v3/Queue/queueState');

const agents = [
  { extensionId: 'e1', priority: 0, lastAnsweredAt: '2026-01-01T00:00:00Z', available: true, dnd: false },
  { extensionId: 'e2', priority: 1, lastAnsweredAt: '2026-06-01T00:00:00Z', available: true, dnd: false },
  { extensionId: 'e3', priority: 2, dnd: true, available: true },
];

describe('V3 queueStrategy', () => {
  beforeEach(() => {
    resetQueueStateForTests();
  });

  it('filters DND agents', () => {
    expect(filterAvailableAgents(agents)).toHaveLength(2);
  });

  it('ROUND_ROBIN cycles agents', () => {
    const first = selectAgentsForStrategy({
      strategy: RING_STRATEGY.ROUND_ROBIN,
      agents,
      queueKey: 'tenant:q1',
      roundRobinPointer: 0,
    });
    expect(first.agents[0].extensionId).toBe('e1');

    const second = selectAgentsForStrategy({
      strategy: RING_STRATEGY.ROUND_ROBIN,
      agents,
      queueKey: 'tenant:q1',
      roundRobinPointer: first.nextPointer,
    });
    expect(second.agents[0].extensionId).toBe('e2');
  });

  it('LEAST_RECENT picks oldest answered', () => {
    const result = selectAgentsForStrategy({
      strategy: RING_STRATEGY.LEAST_RECENT,
      agents,
      queueKey: 'q',
    });
    expect(result.agents[0].extensionId).toBe('e1');
  });

  it('LONGEST_IDLE uses idleSince', () => {
    const idleAgents = [
      { extensionId: 'a', idleSince: '2026-01-01T00:00:00Z', available: true },
      { extensionId: 'b', idleSince: '2026-06-01T00:00:00Z', available: true },
    ];
    const result = selectAgentsForStrategy({
      strategy: RING_STRATEGY.LONGEST_IDLE,
      agents: idleAgents,
      queueKey: 'q',
    });
    expect(result.agents[0].extensionId).toBe('a');
  });

  it('SIMULTANEOUS returns all available', () => {
    const result = selectAgentsForStrategy({
      strategy: RING_STRATEGY.SIMULTANEOUS,
      agents,
      queueKey: 'q',
    });
    expect(result.agents).toHaveLength(2);
  });

  it('SEQUENTIAL returns one by priority index', () => {
    const result = selectAgentsForStrategy({
      strategy: RING_STRATEGY.SEQUENTIAL,
      agents,
      queueKey: 'q',
      sequentialIndex: 1,
    });
    expect(result.agents[0].extensionId).toBe('e2');
    expect(result.nextSequentialIndex).toBe(2);
  });

  it('RANDOM returns one agent', () => {
    const result = selectAgentsForStrategy({
      strategy: RING_STRATEGY.RANDOM,
      agents,
      queueKey: 'q',
    });
    expect(result.agents).toHaveLength(1);
  });
});
