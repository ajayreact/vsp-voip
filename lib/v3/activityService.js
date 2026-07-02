/**
 * V3 Activity Service — tenant-scoped timeline from adminAuditLog (read-only).
 */

const ACTION_META = {
  'v3.employee.created': { category: 'employee', label: 'Employee Created' },
  'v3.employee.provision_device': { category: 'provisioning', label: 'Provision Completed' },
  'v3.pbx.repair': { category: 'repair', label: 'Repair Executed' },
  'v3.number.assigned_tenant': { category: 'number', label: 'Number Assigned' },
  'v3.number.assigned_extension': { category: 'number', label: 'Number Assigned' },
  'v3.number.unassigned_tenant': { category: 'number', label: 'Number Unassigned' },
  'v3.number.unassigned_extension': { category: 'number', label: 'Number Unassigned' },
  'v3.number.repair': { category: 'repair', label: 'Number Repair Executed' },
  'v3.device.added': { category: 'device', label: 'Device Added' },
  'v3.device.updated': { category: 'device', label: 'Device Updated' },
  'v3.device.assigned': { category: 'device', label: 'Device Assigned' },
  'v3.device.removed': { category: 'device', label: 'Device Removed' },
  'v3.device.provisioned': { category: 'provisioning', label: 'Provision Completed' },
  'v3.device.repair': { category: 'repair', label: 'Device Repair Executed' },
  'v3.callflow.created': { category: 'callflow', label: 'Call Flow Modified' },
  'v3.callflow.updated': { category: 'callflow', label: 'Call Flow Modified' },
  'v3.callflow.deleted': { category: 'callflow', label: 'Call Flow Modified' },
  'v3.ringgroup.created': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.ringgroup.updated': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.ringgroup.deleted': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.queue.created': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.queue.updated': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.queue.deleted': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.business_hours.created': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.business_hours.updated': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.business_hours.deleted': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.holiday.created': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.holiday.updated': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.holiday.deleted': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.voicemail.created': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.voicemail.updated': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.voicemail.deleted': { category: 'pbx', label: 'PBX Object Modified' },
  'v3.profile.updated': { category: 'profile', label: 'Profile Updated' },
  'v3.preferences.updated': { category: 'profile', label: 'Preference Changed' },
  'v3.device_preference.updated': { category: 'profile', label: 'Device Preference Updated' },
  'v3.presence.changed': { category: 'profile', label: 'Presence Changed' },
  'v3.report.exported': { category: 'report', label: 'Report Exported' },
};

function resolveMeta(action) {
  if (ACTION_META[action]) return ACTION_META[action];
  if (action.startsWith('v3.')) {
    return { category: 'system', label: action.replace(/^v3\./, '').replace(/[._]/g, ' ') };
  }
  return null;
}

async function getTenantUserIds(prisma, tenantId) {
  const users = await prisma.user.findMany({ where: { tenantId }, select: { id: true, email: true, name: true } });
  return users;
}

function serializeEvent(log, userMap) {
  const meta = resolveMeta(log.action);
  if (!meta) return null;
  const actor = log.userId ? userMap.get(log.userId) : null;
  return {
    id: log.id,
    action: log.action,
    category: meta.category,
    label: meta.label,
    entityType: log.entityType,
    entityId: log.entityId,
    actorId: log.userId,
    actorEmail: log.userEmail || actor?.email || null,
    actorName: actor?.name || null,
    details: log.details,
    createdAt: log.createdAt,
  };
}

async function getActivityTimeline(prisma, tenantId, { limit = 50, offset = 0, category } = {}) {
  const users = await getTenantUserIds(prisma, tenantId);
  const userIds = users.map((u) => u.id);
  const userMap = new Map(users.map((u) => [u.id, u]));

  if (!userIds.length) return { items: [], total: 0 };

  const where = {
    action: { startsWith: 'v3.' },
    userId: { in: userIds },
  };

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit * 3, 500),
      skip: offset,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  let items = logs.map((log) => serializeEvent(log, userMap)).filter(Boolean);
  if (category) {
    items = items.filter((item) => item.category === category);
  }
  items = items.slice(0, limit);

  return { items, total, limit, offset };
}

module.exports = {
  ACTION_META,
  getActivityTimeline,
  resolveMeta,
};
