const { RING_STRATEGY } = require('./queueConstants');
const { getRoundRobinPointer, setRoundRobinPointer } = require('./queueState');

/**
 * Filter agents that are available and not DND.
 * @param {Array<Record<string, unknown>>} agents
 */
function filterAvailableAgents(agents) {
  return (agents || []).filter((a) => a.available !== false && a.dnd !== true && a.isActive !== false);
}

/**
 * Select agent(s) per ring strategy.
 *
 * @param {{
 *   strategy: string,
 *   agents: Array<Record<string, unknown>>,
 *   queueKey: string,
 *   roundRobinPointer?: number,
 *   sequentialIndex?: number,
 * }} input
 * @returns {{ agents: Array<Record<string, unknown>>, nextPointer?: number, nextSequentialIndex?: number }}
 */
function selectAgentsForStrategy(input) {
  const available = filterAvailableAgents(input.agents);
  if (!available.length) {
    return { agents: [] };
  }

  const strategy = String(input.strategy || RING_STRATEGY.ROUND_ROBIN).toUpperCase();

  switch (strategy) {
    case RING_STRATEGY.SIMULTANEOUS:
      return { agents: available };

    case RING_STRATEGY.RANDOM: {
      const idx = Math.floor(Math.random() * available.length);
      return { agents: [available[idx]] };
    }

    case RING_STRATEGY.LEAST_RECENT: {
      const sorted = [...available].sort((a, b) => {
        const aTs = a.lastAnsweredAt ? new Date(a.lastAnsweredAt).getTime() : 0;
        const bTs = b.lastAnsweredAt ? new Date(b.lastAnsweredAt).getTime() : 0;
        return aTs - bTs;
      });
      return { agents: [sorted[0]] };
    }

    case RING_STRATEGY.LONGEST_IDLE: {
      const sorted = [...available].sort((a, b) => {
        const aTs = a.idleSince ? new Date(a.idleSince).getTime()
          : (a.lastRungAt ? new Date(a.lastRungAt).getTime() : 0);
        const bTs = b.idleSince ? new Date(b.idleSince).getTime()
          : (b.lastRungAt ? new Date(b.lastRungAt).getTime() : 0);
        return aTs - bTs;
      });
      return { agents: [sorted[0]] };
    }

    case RING_STRATEGY.SEQUENTIAL: {
      const idx = input.sequentialIndex ?? 0;
      const sorted = [...available].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      const agent = sorted[idx % sorted.length];
      return { agents: [agent], nextSequentialIndex: idx + 1 };
    }

    case RING_STRATEGY.ROUND_ROBIN:
    default: {
      const pointer = input.roundRobinPointer ?? getRoundRobinPointer(input.queueKey);
      const sorted = [...available].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      const agent = sorted[pointer % sorted.length];
      const nextPointer = pointer + 1;
      setRoundRobinPointer(input.queueKey, nextPointer);
      return { agents: [agent], nextPointer };
    }
  }
}

module.exports = {
  selectAgentsForStrategy,
  filterAvailableAgents,
  RING_STRATEGY,
};
