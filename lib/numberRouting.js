const { normalizePhoneNumber, formatPhoneNumberForDisplay } = require('./phone');

const ROUTING_TYPES = new Set(['tenant_default', 'forward', 'ring_group', 'ivr', 'direct_user']);

function normalizeRoutingType(value) {
  const type = String(value || 'tenant_default').toLowerCase();
  return ROUTING_TYPES.has(type) ? type : 'tenant_default';
}

function routingTypeLabel(type) {
  const labels = {
    tenant_default: 'Tenant default',
    forward: 'Call forwarding',
    ring_group: 'Ring group',
    ivr: 'IVR menu',
    direct_user: 'Assigned user',
  };
  return labels[type] || 'Tenant default';
}

function resolveEffectiveRoutingType(phoneRecord, greeting) {
  const type = normalizeRoutingType(phoneRecord?.routingType);
  if (type !== 'tenant_default') return type;
  if (greeting?.ivrEnabled) return 'ivr';
  if (greeting?.ringGroupEnabled) return 'ring_group';
  if (greeting?.forwardEnabled && greeting.forwardNumber) return 'forward';
  return 'tenant_default';
}

function resolveDestination(phoneRecord, greeting, assignedUser, ringGroup, extension) {
  const type = normalizeRoutingType(phoneRecord?.routingType);

  if (type === 'forward') {
    const dest = phoneRecord.forwardDestination || greeting?.forwardNumber;
    return dest ? formatPhoneNumberForDisplay(dest) : '—';
  }
  if (type === 'ring_group') {
    return ringGroup?.name || phoneRecord.label || greeting?.ringGroupName || 'Ring group';
  }
  if (type === 'ivr') return 'IVR menu';
  if (type === 'direct_user') {
    if (extension) return `${extension.extensionNumber} — ${extension.displayName}`;
    return assignedUser?.name || phoneRecord.label || 'Assigned user';
  }

  if (greeting?.forwardEnabled && greeting.forwardNumber) {
    return formatPhoneNumberForDisplay(greeting.forwardNumber);
  }
  if (greeting?.ringGroupEnabled) return greeting.ringGroupName || 'Ring group';
  if (greeting?.ivrEnabled) return 'IVR menu';
  return 'Standard greeting';
}

function applyNumberRoutingToGreeting(greeting, phoneRecord) {
  if (!greeting || !phoneRecord) return greeting;
  const type = normalizeRoutingType(phoneRecord.routingType);
  if (type === 'tenant_default') return greeting;

  const clone = { ...greeting };

  if (type === 'forward') {
    clone.forwardEnabled = true;
    clone.forwardNumber = normalizePhoneNumber(phoneRecord.forwardDestination) || greeting.forwardNumber;
    clone.ringGroupEnabled = false;
    clone.ivrEnabled = false;
    return clone;
  }

  if (type === 'ring_group') {
    clone.ringGroupEnabled = true;
    clone.forwardEnabled = false;
    clone.ivrEnabled = false;
    return clone;
  }

  if (type === 'ivr') {
    clone.ivrEnabled = true;
    clone.forwardEnabled = false;
    clone.ringGroupEnabled = false;
    return clone;
  }

  return clone;
}

function extensionManagedRoutingLabel(extension) {
  return `Managed by Extension ${extension.extensionNumber}`;
}

function serializeOwnedNumber(row, greeting, assignedUser, ringGroup, extension) {
  const routingType = resolveEffectiveRoutingType(row, greeting);
  const extensionManaged = Boolean(extension);
  const managedLabel = extension ? extensionManagedRoutingLabel(extension) : null;

  return {
    id: row.id,
    number: row.number,
    numberFormatted: formatPhoneNumberForDisplay(row.number),
    tenantId: row.tenantId,
    label: row.label || '',
    assignedUserId: row.assignedUserId || null,
    assignedUserName: assignedUser?.name || null,
    extensionId: row.extensionId || extension?.id || null,
    extensionNumber: extension?.extensionNumber || null,
    extensionName: extension
      ? `${extension.extensionNumber} — ${extension.displayName}`
      : null,
    isExtensionManaged: extensionManaged,
    ringGroupId: row.ringGroupId || null,
    ringGroupName: ringGroup?.name || null,
    routingType: normalizeRoutingType(row.routingType),
    routingTypeLabel: extensionManaged
      ? managedLabel
      : routingTypeLabel(normalizeRoutingType(row.routingType)),
    effectiveRoutingType: extensionManaged ? 'extension_managed' : routingType,
    effectiveRoutingLabel: extensionManaged ? managedLabel : routingTypeLabel(routingType),
    forwardDestination: row.forwardDestination || null,
    destination: extensionManaged
      ? `${extension.extensionNumber} — ${extension.displayName}`
      : resolveDestination(row, greeting, assignedUser, ringGroup, extension),
    isActive: row.isActive !== false,
    carrierMonthly: row.carrierMonthly != null ? Number(row.carrierMonthly) : null,
    platformMonthly: row.platformMonthly != null ? Number(row.platformMonthly) : null,
    tenantMonthlyTotal: row.tenantMonthlyTotal != null ? Number(row.tenantMonthlyTotal) : null,
    createdAt: row.createdAt,
  };
}

module.exports = {
  ROUTING_TYPES,
  normalizeRoutingType,
  routingTypeLabel,
  extensionManagedRoutingLabel,
  resolveEffectiveRoutingType,
  resolveDestination,
  applyNumberRoutingToGreeting,
  serializeOwnedNumber,
  formatPhoneNumberForDisplay,
};
