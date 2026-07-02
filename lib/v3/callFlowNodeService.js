/**
 * V3 Call Flow Node Service — independent node type registry and graph helpers.
 *
 * New node types register in NODE_REGISTRY without modifying existing handlers.
 */

const { randomUUID } = require('crypto');

const NODE_TYPES = Object.freeze([
  'START',
  'PLAY_GREETING',
  'MENU',
  'EXTENSION',
  'RING_GROUP',
  'QUEUE',
  'VOICEMAIL',
  'FORWARD',
  'BUSINESS_HOURS',
  'HOLIDAY',
  'TIME_CONDITION',
  'API_WEBHOOK',
  'END',
]);

const TERMINAL_NODE_TYPES = new Set([
  'EXTENSION',
  'RING_GROUP',
  'QUEUE',
  'VOICEMAIL',
  'FORWARD',
  'END',
]);

const ROUTING_NODE_TYPES = new Set([
  'START',
  'PLAY_GREETING',
  'MENU',
  'BUSINESS_HOURS',
  'HOLIDAY',
  'TIME_CONDITION',
  'API_WEBHOOK',
]);

const NODE_REGISTRY = Object.freeze({
  START: {
    label: 'Start',
    color: '#10b981',
    defaultData: {},
    outputs: [{ id: 'default', label: 'Next' }],
  },
  PLAY_GREETING: {
    label: 'Play Greeting',
    color: '#6366f1',
    defaultData: { greetingId: null, greetingText: null, audioUrl: null },
    outputs: [{ id: 'default', label: 'Next' }],
  },
  MENU: {
    label: 'Menu',
    color: '#8b5cf6',
    defaultData: { prompt: 'Press a digit', options: [{ digit: '1', label: 'Option 1' }] },
    outputs: [{ id: 'default', label: 'Default' }],
  },
  EXTENSION: {
    label: 'Extension',
    color: '#0ea5e9',
    defaultData: { extensionId: null, extensionNumber: null },
    outputs: [],
  },
  RING_GROUP: {
    label: 'Ring Group',
    color: '#14b8a6',
    defaultData: { ringGroupId: null, ringGroupName: null },
    outputs: [],
  },
  QUEUE: {
    label: 'Queue',
    color: '#f59e0b',
    defaultData: { queueId: null, queueName: null },
    outputs: [],
  },
  VOICEMAIL: {
    label: 'Voicemail',
    color: '#ec4899',
    defaultData: { extensionId: null, mailbox: null },
    outputs: [],
  },
  FORWARD: {
    label: 'Forward',
    color: '#f97316',
    defaultData: { destination: null, destinationType: 'external' },
    outputs: [],
  },
  BUSINESS_HOURS: {
    label: 'Business Hours',
    color: '#64748b',
    defaultData: { schedule: { mon: ['09:00', '17:00'], tue: ['09:00', '17:00'], wed: ['09:00', '17:00'], thu: ['09:00', '17:00'], fri: ['09:00', '17:00'] }, timezone: null },
    outputs: [{ id: 'open', label: 'Open' }, { id: 'closed', label: 'Closed' }],
  },
  HOLIDAY: {
    label: 'Holiday',
    color: '#a855f7',
    defaultData: { holidays: [] },
    outputs: [{ id: 'holiday', label: 'Holiday' }, { id: 'normal', label: 'Normal' }],
  },
  TIME_CONDITION: {
    label: 'Time Condition',
    color: '#475569',
    defaultData: { ranges: [{ start: '09:00', end: '17:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'] }] },
    outputs: [{ id: 'match', label: 'Match' }, { id: 'no_match', label: 'No Match' }],
  },
  API_WEBHOOK: {
    label: 'API Webhook',
    color: '#334155',
    defaultData: { url: null, method: 'POST', timeoutMs: 5000 },
    outputs: [{ id: 'success', label: 'Success' }, { id: 'failure', label: 'Failure' }],
  },
  END: {
    label: 'End',
    color: '#ef4444',
    defaultData: { reason: 'completed' },
    outputs: [],
  },
});

function listNodeTypes() {
  return NODE_TYPES.map((type) => ({
    type,
    ...NODE_REGISTRY[type],
    terminal: TERMINAL_NODE_TYPES.has(type),
    routing: ROUTING_NODE_TYPES.has(type),
  }));
}

function assertNodeType(type) {
  const normalized = String(type || '').toUpperCase();
  if (!NODE_REGISTRY[normalized]) {
    throw Object.assign(new Error(`Unsupported node type: ${type}`), { status: 400, code: 'INVALID_NODE_TYPE' });
  }
  return normalized;
}

function normalizeDefinition(definition) {
  const def = definition && typeof definition === 'object' ? definition : {};
  return {
    version: Number(def.version) || 1,
    nodes: Array.isArray(def.nodes) ? def.nodes.map(normalizeNode) : [],
    edges: Array.isArray(def.edges) ? def.edges.map(normalizeEdge) : [],
  };
}

function normalizeNode(node) {
  const type = assertNodeType(node.type);
  return {
    id: String(node.id || randomUUID()),
    type,
    label: node.label || NODE_REGISTRY[type].label,
    position: {
      x: Number(node.position?.x) || 0,
      y: Number(node.position?.y) || 0,
    },
    data: { ...NODE_REGISTRY[type].defaultData, ...(node.data || {}) },
  };
}

function normalizeEdge(edge) {
  return {
    id: String(edge.id || randomUUID()),
    source: String(edge.source),
    target: String(edge.target),
    sourceHandle: edge.sourceHandle ? String(edge.sourceHandle) : 'default',
    label: edge.label != null ? String(edge.label) : null,
  };
}

function createNode(type, position = { x: 0, y: 0 }, data = {}) {
  const nodeType = assertNodeType(type);
  return normalizeNode({
    id: randomUUID(),
    type: nodeType,
    label: NODE_REGISTRY[nodeType].label,
    position,
    data: { ...NODE_REGISTRY[nodeType].defaultData, ...data },
  });
}

function duplicateNode(node, offset = { x: 40, y: 40 }) {
  return normalizeNode({
    ...node,
    id: randomUUID(),
    label: `${node.label || NODE_REGISTRY[node.type].label} (copy)`,
    position: {
      x: (node.position?.x || 0) + offset.x,
      y: (node.position?.y || 0) + offset.y,
    },
    data: { ...(node.data || {}) },
  });
}

function deleteNode(definition, nodeId) {
  const def = normalizeDefinition(definition);
  return {
    ...def,
    nodes: def.nodes.filter((n) => n.id !== nodeId),
    edges: def.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
  };
}

function connectNodes(definition, sourceId, targetId, { sourceHandle = 'default', label = null } = {}) {
  const def = normalizeDefinition(definition);
  const exists = def.edges.some(
    (e) => e.source === sourceId && e.target === targetId && e.sourceHandle === sourceHandle,
  );
  if (exists) return def;
  return {
    ...def,
    edges: [
      ...def.edges,
      normalizeEdge({ id: randomUUID(), source: sourceId, target: targetId, sourceHandle, label }),
    ],
  };
}

function disconnectEdge(definition, edgeId) {
  const def = normalizeDefinition(definition);
  return { ...def, edges: def.edges.filter((e) => e.id !== edgeId) };
}

function getOutgoingEdges(definition, nodeId) {
  return normalizeDefinition(definition).edges.filter((e) => e.source === nodeId);
}

function getIncomingEdges(definition, nodeId) {
  return normalizeDefinition(definition).edges.filter((e) => e.target === nodeId);
}

function findNode(definition, nodeId) {
  return normalizeDefinition(definition).nodes.find((n) => n.id === nodeId) || null;
}

function findStartNode(definition) {
  return normalizeDefinition(definition).nodes.find((n) => n.type === 'START') || null;
}

function serializeDefinition(definition) {
  return JSON.parse(JSON.stringify(normalizeDefinition(definition)));
}

module.exports = {
  NODE_TYPES,
  TERMINAL_NODE_TYPES,
  ROUTING_NODE_TYPES,
  NODE_REGISTRY,
  listNodeTypes,
  assertNodeType,
  normalizeDefinition,
  createNode,
  duplicateNode,
  deleteNode,
  connectNodes,
  disconnectEdge,
  getOutgoingEdges,
  getIncomingEdges,
  findNode,
  findStartNode,
  serializeDefinition,
};
