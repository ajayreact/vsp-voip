/**
 * V3 Call Flow Execution Service — pure graph walker (simulation only, no live calls).
 */

const callFlowNodeService = require('./callFlowNodeService');

const MAX_STEPS = 64;

function parseTime(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(date) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
}

function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h * 60) + (m || 0);
}

function isWithinSchedule(date, schedule = {}) {
  const key = dayKey(date);
  const ranges = schedule[key] || schedule[key?.slice(0, 3)] || [];
  if (!Array.isArray(ranges) || ranges.length === 0) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (ranges.length === 2 && typeof ranges[0] === 'string') {
    return minutes >= timeToMinutes(ranges[0]) && minutes <= timeToMinutes(ranges[1]);
  }
  return ranges.some((range) => {
    if (!Array.isArray(range) || range.length < 2) return false;
    return minutes >= timeToMinutes(range[0]) && minutes <= timeToMinutes(range[1]);
  });
}

function isHoliday(date, holidays = []) {
  const iso = date.toISOString().slice(0, 10);
  return holidays.some((h) => {
    if (typeof h === 'string') return h.slice(0, 10) === iso;
    if (h?.date) return String(h.date).slice(0, 10) === iso;
    return false;
  });
}

function matchesTimeCondition(date, ranges = []) {
  const key = dayKey(date);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return ranges.some((range) => {
    const days = range.days || [];
    if (days.length && !days.includes(key)) return false;
    return minutes >= timeToMinutes(range.start) && minutes <= timeToMinutes(range.end);
  });
}

function pickEdge(definition, nodeId, sourceHandle) {
  const edges = callFlowNodeService.getOutgoingEdges(definition, nodeId);
  return edges.find((e) => e.sourceHandle === sourceHandle)
    || edges.find((e) => e.label === sourceHandle)
    || edges[0]
    || null;
}

function buildDestination(node) {
  switch (node.type) {
    case 'EXTENSION':
      return { type: 'extension', extensionId: node.data?.extensionId, extensionNumber: node.data?.extensionNumber };
    case 'RING_GROUP':
      return { type: 'ring_group', ringGroupId: node.data?.ringGroupId, ringGroupName: node.data?.ringGroupName };
    case 'QUEUE':
      return { type: 'queue', queueId: node.data?.queueId, queueName: node.data?.queueName };
    case 'VOICEMAIL':
      return { type: 'voicemail', extensionId: node.data?.extensionId, mailbox: node.data?.mailbox };
    case 'FORWARD':
      return { type: 'forward', destination: node.data?.destination, destinationType: node.data?.destinationType };
    case 'END':
      return { type: 'end', reason: node.data?.reason || 'completed' };
    default:
      return { type: 'unknown', nodeType: node.type };
  }
}

function executeNode(definition, node, context) {
  const step = {
    nodeId: node.id,
    nodeType: node.type,
    label: node.label,
    action: node.type.toLowerCase(),
    detail: {},
    nextNodeId: null,
    terminal: false,
    destination: null,
  };

  if (callFlowNodeService.TERMINAL_NODE_TYPES.has(node.type)) {
    step.terminal = true;
    step.destination = buildDestination(node);
    return step;
  }

  switch (node.type) {
    case 'START': {
      const edge = pickEdge(definition, node.id, 'default');
      step.nextNodeId = edge?.target || null;
      step.detail = { branch: 'default' };
      break;
    }
    case 'PLAY_GREETING': {
      const edge = pickEdge(definition, node.id, 'default');
      step.nextNodeId = edge?.target || null;
      step.detail = {
        greetingId: node.data?.greetingId,
        greetingText: node.data?.greetingText,
        audioUrl: node.data?.audioUrl,
      };
      break;
    }
    case 'MENU': {
      const digit = context.pressedDigits?.length ? String(context.pressedDigits.shift()) : null;
      step.detail = { digit, prompt: node.data?.prompt };
      const edge = digit ? pickEdge(definition, node.id, digit) : pickEdge(definition, node.id, 'default');
      step.nextNodeId = edge?.target || null;
      if (!edge && digit) {
        step.detail.fallback = true;
        step.nextNodeId = pickEdge(definition, node.id, 'default')?.target || null;
      }
      break;
    }
    case 'BUSINESS_HOURS': {
      const now = parseTime(context.currentTime) || new Date();
      const schedule = context.businessHours || node.data?.schedule || {};
      const open = isWithinSchedule(now, schedule);
      step.detail = { open, evaluatedAt: now.toISOString() };
      const edge = pickEdge(definition, node.id, open ? 'open' : 'closed');
      step.nextNodeId = edge?.target || null;
      break;
    }
    case 'HOLIDAY': {
      const now = parseTime(context.currentTime) || new Date();
      const holidays = context.holidays || node.data?.holidays || [];
      const holiday = isHoliday(now, holidays);
      step.detail = { holiday, evaluatedAt: now.toISOString() };
      const edge = pickEdge(definition, node.id, holiday ? 'holiday' : 'normal');
      step.nextNodeId = edge?.target || null;
      break;
    }
    case 'TIME_CONDITION': {
      const now = parseTime(context.currentTime) || new Date();
      const match = matchesTimeCondition(now, node.data?.ranges || []);
      step.detail = { match, evaluatedAt: now.toISOString() };
      const edge = pickEdge(definition, node.id, match ? 'match' : 'no_match');
      step.nextNodeId = edge?.target || null;
      break;
    }
    case 'API_WEBHOOK': {
      const simulatedOk = context.webhookResults?.[node.id] !== false;
      step.detail = { url: node.data?.url, method: node.data?.method || 'POST', simulatedOk };
      const edge = pickEdge(definition, node.id, simulatedOk ? 'success' : 'failure');
      step.nextNodeId = edge?.target || null;
      break;
    }
    default: {
      const edge = pickEdge(definition, node.id, 'default');
      step.nextNodeId = edge?.target || null;
    }
  }

  if (!step.nextNodeId && !step.terminal) {
    step.terminal = true;
    step.destination = { type: 'dead_end', nodeType: node.type };
  }

  return step;
}

function executePath(definition, context = {}) {
  const def = callFlowNodeService.normalizeDefinition(definition);
  const start = callFlowNodeService.findStartNode(def);
  if (!start) {
    return {
      ok: false,
      path: [],
      finalDestination: null,
      errors: [{ code: 'MISSING_START', message: 'No Start node in flow' }],
      warnings: [],
    };
  }

  const ctx = {
    incomingDid: context.incomingDid || context.did || null,
    currentTime: context.currentTime || new Date().toISOString(),
    businessHours: context.businessHours || null,
    holidays: context.holidays || [],
    pressedDigits: Array.isArray(context.pressedDigits) ? [...context.pressedDigits] : [],
    webhookResults: context.webhookResults || {},
  };

  const path = [];
  const errors = [];
  const warnings = [];
  const visitedCounts = new Map();
  let currentId = start.id;
  let finalDestination = null;

  for (let i = 0; i < MAX_STEPS; i += 1) {
    const node = callFlowNodeService.findNode(def, currentId);
    if (!node) {
      errors.push({ code: 'INVALID_ROUTING', message: `Node not found: ${currentId}` });
      break;
    }

    visitedCounts.set(currentId, (visitedCounts.get(currentId) || 0) + 1);
    if (visitedCounts.get(currentId) > 3) {
      errors.push({ code: 'LOOP_DETECTED', message: `Loop detected at node ${node.label}`, nodeId: node.id });
      break;
    }

    const step = executeNode(def, node, ctx);
    path.push(step);

    if (step.terminal) {
      finalDestination = step.destination;
      break;
    }

    if (!step.nextNodeId) {
      errors.push({ code: 'DEAD_END', message: `Dead end at node ${node.label}`, nodeId: node.id });
      finalDestination = { type: 'dead_end', nodeType: node.type };
      break;
    }

    currentId = step.nextNodeId;
  }

  if (path.length >= MAX_STEPS && !finalDestination) {
    warnings.push({ code: 'MAX_STEPS', message: `Simulation stopped after ${MAX_STEPS} steps` });
  }

  return {
    ok: errors.length === 0,
    path,
    finalDestination,
    errors,
    warnings,
    context: ctx,
  };
}

function executeStep(definition, nodeId, context = {}) {
  const def = callFlowNodeService.normalizeDefinition(definition);
  const node = callFlowNodeService.findNode(def, nodeId);
  if (!node) {
    throw Object.assign(new Error('Node not found'), { status: 404 });
  }
  return executeNode(def, node, {
    ...context,
    pressedDigits: Array.isArray(context.pressedDigits) ? [...context.pressedDigits] : [],
  });
}

module.exports = {
  executeNode,
  executeStep,
  executePath,
  MAX_STEPS,
};
