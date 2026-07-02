/**
 * V3 Call Flow Service — CRUD and serialization for design-time call flows.
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');
const callFlowNodeService = require('./callFlowNodeService');

function serializeFlow(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    did: row.did,
    status: row.status,
    version: row.version,
    definition: callFlowNodeService.serializeDefinition(row.definition),
    nodeCount: callFlowNodeService.normalizeDefinition(row.definition).nodes.length,
    edgeCount: callFlowNodeService.normalizeDefinition(row.definition).edges.length,
    removedAt: row.removedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function defaultDefinition() {
  const start = callFlowNodeService.createNode('START', { x: 120, y: 120 });
  const end = callFlowNodeService.createNode('END', { x: 420, y: 120 });
  let definition = callFlowNodeService.normalizeDefinition({ version: 1, nodes: [start, end], edges: [] });
  definition = callFlowNodeService.connectNodes(definition, start.id, end.id, { sourceHandle: 'default', label: 'default' });
  return definition;
}

async function listCallFlows(prisma, tenantId, { search, status, limit = 50, offset = 0 } = {}) {
  const where = { tenantId, removedAt: null };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { did: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.v3CallFlow.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.v3CallFlow.count({ where }),
  ]);

  return { items: rows.map(serializeFlow), total };
}

async function getCallFlow(prisma, tenantId, callFlowId) {
  const row = await prisma.v3CallFlow.findFirst({
    where: { id: callFlowId, tenantId, removedAt: null },
  });
  return serializeFlow(row);
}

async function createCallFlow(prisma, tenantId, data, { req, actor } = {}) {
  const name = String(data.name || '').trim();
  if (!name) throw Object.assign(new Error('name is required'), { status: 400 });

  const definition = data.definition
    ? callFlowNodeService.normalizeDefinition(data.definition)
    : defaultDefinition();

  const row = await prisma.v3CallFlow.create({
    data: {
      id: randomUUID(),
      tenantId,
      name,
      description: data.description || null,
      did: data.did || null,
      status: data.status || 'DRAFT',
      definition,
      version: 1,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.callflow.created',
    entityType: 'V3CallFlow',
    entityId: row.id,
    newValue: { name: row.name, status: row.status, nodeCount: definition.nodes.length },
    extra: { tenantId, actor: actor?.sub },
  });

  return serializeFlow(row);
}

async function updateCallFlow(prisma, tenantId, callFlowId, data, { req, actor } = {}) {
  const existing = await prisma.v3CallFlow.findFirst({
    where: { id: callFlowId, tenantId, removedAt: null },
  });
  if (!existing) throw Object.assign(new Error('Call flow not found'), { status: 404 });

  const updates = {};
  if (data.name != null) updates.name = String(data.name).trim();
  if (data.description !== undefined) updates.description = data.description || null;
  if (data.did !== undefined) updates.did = data.did || null;
  if (data.status != null) updates.status = data.status;
  if (data.definition != null) {
    updates.definition = callFlowNodeService.normalizeDefinition(data.definition);
    updates.version = existing.version + 1;
  }

  const row = await prisma.v3CallFlow.update({
    where: { id: callFlowId },
    data: updates,
  });

  await auditService.log(prisma, req, {
    action: 'v3.callflow.updated',
    entityType: 'V3CallFlow',
    entityId: callFlowId,
    oldValue: { name: existing.name, status: existing.status, version: existing.version },
    newValue: { name: row.name, status: row.status, version: row.version },
    extra: { tenantId, actor: actor?.sub },
  });

  return serializeFlow(row);
}

async function removeCallFlow(prisma, tenantId, callFlowId, { req, actor } = {}) {
  const existing = await prisma.v3CallFlow.findFirst({
    where: { id: callFlowId, tenantId, removedAt: null },
  });
  if (!existing) throw Object.assign(new Error('Call flow not found'), { status: 404 });

  const row = await prisma.v3CallFlow.update({
    where: { id: callFlowId },
    data: { removedAt: new Date(), status: 'ARCHIVED' },
  });

  await auditService.log(prisma, req, {
    action: 'v3.callflow.deleted',
    entityType: 'V3CallFlow',
    entityId: callFlowId,
    oldValue: { name: existing.name, status: existing.status },
    newValue: { status: 'ARCHIVED', removedAt: row.removedAt },
    extra: { tenantId, actor: actor?.sub },
  });

  return serializeFlow(row);
}

module.exports = {
  serializeFlow,
  defaultDefinition,
  listCallFlows,
  getCallFlow,
  createCallFlow,
  updateCallFlow,
  removeCallFlow,
};
