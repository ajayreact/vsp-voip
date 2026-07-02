/**
 * V3 Call Flow Validation Service — structural and reference validation (no live routing).
 */

const callFlowNodeService = require('./callFlowNodeService');

function issue(severity, code, message, nodeId = null) {
  return { severity, code, message, nodeId };
}

function detectCycles(definition) {
  const def = callFlowNodeService.normalizeDefinition(definition);
  const adj = new Map(def.nodes.map((n) => [n.id, []]));
  for (const edge of def.edges) {
    if (adj.has(edge.source)) adj.get(edge.source).push(edge.target);
  }

  const cycles = [];
  const visited = new Set();
  const stack = new Set();
  const path = [];

  function dfs(nodeId) {
    visited.add(nodeId);
    stack.add(nodeId);
    path.push(nodeId);

    for (const next of adj.get(nodeId) || []) {
      if (!visited.has(next)) {
        dfs(next);
      } else if (stack.has(next)) {
        const cycleStart = path.indexOf(next);
        cycles.push(path.slice(cycleStart).concat(next));
      }
    }

    path.pop();
    stack.delete(nodeId);
  }

  for (const node of def.nodes) {
    if (!visited.has(node.id)) dfs(node.id);
  }

  return cycles;
}

function findUnreachableNodes(definition) {
  const def = callFlowNodeService.normalizeDefinition(definition);
  const start = callFlowNodeService.findStartNode(def);
  if (!start) return def.nodes.map((n) => n.id);

  const reachable = new Set([start.id]);
  const queue = [start.id];
  while (queue.length) {
    const current = queue.shift();
    for (const edge of def.edges.filter((e) => e.source === current)) {
      if (!reachable.has(edge.target)) {
        reachable.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  return def.nodes.filter((n) => !reachable.has(n.id)).map((n) => n.id);
}

function findDeadEndNodes(definition) {
  const def = callFlowNodeService.normalizeDefinition(definition);
  return def.nodes.filter((node) => {
    if (callFlowNodeService.TERMINAL_NODE_TYPES.has(node.type)) return false;
    const outgoing = def.edges.filter((e) => e.source === node.id);
    return outgoing.length === 0;
  });
}

async function validateReferences(prisma, tenantId, definition) {
  const results = [];
  const def = callFlowNodeService.normalizeDefinition(definition);

  for (const node of def.nodes) {
    if (node.type === 'EXTENSION' || node.type === 'VOICEMAIL') {
      const extId = node.data?.extensionId;
      if (!extId) {
        results.push(issue('error', 'INVALID_EXTENSION', 'Extension node missing extensionId', node.id));
        continue;
      }
      const ext = await prisma.extension.findFirst({ where: { id: extId, tenantId }, select: { id: true } });
      if (!ext) results.push(issue('error', 'INVALID_EXTENSION', `Extension not found: ${extId}`, node.id));
    }

    if (node.type === 'RING_GROUP') {
      const rgId = node.data?.ringGroupId;
      if (!rgId) {
        results.push(issue('error', 'MISSING_RING_GROUP', 'Ring Group node missing ringGroupId', node.id));
        continue;
      }
      const rg = await prisma.ringGroup.findFirst({ where: { id: rgId, tenantId }, select: { id: true } });
      if (!rg) results.push(issue('error', 'MISSING_RING_GROUP', `Ring group not found: ${rgId}`, node.id));
    }

    if (node.type === 'QUEUE') {
      if (!node.data?.queueId && !node.data?.queueName) {
        results.push(issue('error', 'MISSING_QUEUE', 'Queue node missing queueId or queueName', node.id));
      }
    }

    if (node.type === 'PLAY_GREETING') {
      const greetingId = node.data?.greetingId;
      const greetingText = node.data?.greetingText;
      const audioUrl = node.data?.audioUrl;
      if (!greetingId && !greetingText && !audioUrl) {
        results.push(issue('error', 'MISSING_GREETING', 'Play Greeting node needs greetingId, greetingText, or audioUrl', node.id));
      } else if (greetingId) {
        const greeting = await prisma.greeting.findFirst({ where: { id: greetingId, tenantId }, select: { id: true } });
        if (!greeting) results.push(issue('warning', 'MISSING_GREETING', `Greeting not found: ${greetingId}`, node.id));
      }
    }

    if (node.type === 'FORWARD') {
      if (!node.data?.destination) {
        results.push(issue('error', 'INVALID_ROUTING', 'Forward node missing destination', node.id));
      }
    }

    if (node.type === 'API_WEBHOOK') {
      if (!node.data?.url) {
        results.push(issue('error', 'INVALID_ROUTING', 'API Webhook node missing url', node.id));
      }
    }

    if (node.type === 'MENU') {
      const options = node.data?.options || [];
      if (!options.length) {
        results.push(issue('warning', 'INVALID_ROUTING', 'Menu node has no options configured', node.id));
      }
      for (const opt of options) {
        const hasEdge = def.edges.some(
          (e) => e.source === node.id && (e.sourceHandle === opt.digit || e.label === opt.digit),
        );
        if (!hasEdge) {
          results.push(issue('warning', 'DISCONNECTED_NODE', `Menu option ${opt.digit} has no connected edge`, node.id));
        }
      }
    }
  }

  return results;
}

async function validateFlow(prisma, tenantId, definition) {
  const def = callFlowNodeService.normalizeDefinition(definition);
  const issues = [];

  const startNodes = def.nodes.filter((n) => n.type === 'START');
  if (startNodes.length === 0) {
    issues.push(issue('error', 'MISSING_START', 'Flow must contain exactly one Start node'));
  } else if (startNodes.length > 1) {
    issues.push(issue('error', 'MISSING_START', 'Flow must contain only one Start node'));
  }

  if (startNodes.length === 1 && callFlowNodeService.getIncomingEdges(def, startNodes[0].id).length > 0) {
    issues.push(issue('warning', 'INVALID_ROUTING', 'Start node should not have incoming edges', startNodes[0].id));
  }

  const unreachable = findUnreachableNodes(def);
  for (const nodeId of unreachable) {
    issues.push(issue('warning', 'DISCONNECTED_NODE', 'Node is not reachable from Start', nodeId));
  }

  const cycles = detectCycles(def);
  for (const cycle of cycles) {
    issues.push(issue('error', 'LOOP_DETECTED', `Cycle detected: ${cycle.join(' → ')}`, cycle[0]));
  }

  const deadEnds = findDeadEndNodes(def);
  for (const node of deadEnds) {
    issues.push(issue('error', 'DEAD_END', `Routing node "${node.label}" has no outgoing connection`, node.id));
  }

  for (const node of def.nodes) {
    if (node.type === 'BUSINESS_HOURS') {
      for (const handle of ['open', 'closed']) {
        const has = def.edges.some((e) => e.source === node.id && e.sourceHandle === handle);
        if (!has) issues.push(issue('warning', 'INVALID_ROUTING', `Business Hours missing "${handle}" branch`, node.id));
      }
    }
  }

  if (prisma && tenantId) {
    const refIssues = await validateReferences(prisma, tenantId, def);
    issues.push(...refIssues);
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
    scanned: { nodes: def.nodes.length, edges: def.edges.length },
  };
}

module.exports = {
  validateFlow,
  detectCycles,
  findUnreachableNodes,
  findDeadEndNodes,
  validateReferences,
};
