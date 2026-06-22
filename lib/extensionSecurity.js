const { randomUUID } = require('crypto');
const { defaultBusinessHours, isWithinBusinessHours } = require('./businessHours');
const { normalizePhoneNumber } = require('./phone');

const DEFAULT_CALLING_PERMISSIONS = {
  local: true,
  national: true,
  international: true,
  premium: false,
  emergency: true,
};

const DEFAULT_WHITELIST = {
  numbers: [],
  prefixes: [],
  allowInternalExtensions: true,
};

const DEFAULT_BLACKLIST = {
  numbers: [],
  patterns: [],
  blockAnonymous: false,
  blockSpamPatterns: false,
};

const SPAM_PATTERNS = [
  /^\+?0{5,}/,
  /^\+?1?900/,
  /^\+?1?976/,
];

function normalizeStringList(value, max = 50) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeWhitelist(raw, allowInternalExtensions = true) {
  if (Array.isArray(raw)) {
    return {
      numbers: normalizeStringList(raw),
      prefixes: [],
      allowInternalExtensions,
    };
  }
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WHITELIST, allowInternalExtensions };
  return {
    numbers: normalizeStringList(raw.numbers),
    prefixes: normalizeStringList(raw.prefixes, 20),
    allowInternalExtensions: raw.allowInternalExtensions !== false,
  };
}

function normalizeBlacklist(raw, blockAnonymous = false, blockSpamPatterns = false) {
  if (Array.isArray(raw)) {
    return {
      numbers: normalizeStringList(raw),
      patterns: [],
      blockAnonymous,
      blockSpamPatterns,
    };
  }
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_BLACKLIST,
      blockAnonymous,
      blockSpamPatterns,
    };
  }
  return {
    numbers: normalizeStringList(raw.numbers),
    patterns: normalizeStringList(raw.patterns, 20),
    blockAnonymous: Boolean(raw.blockAnonymous ?? blockAnonymous),
    blockSpamPatterns: Boolean(raw.blockSpamPatterns ?? blockSpamPatterns),
  };
}

function normalizeCallingPermissions(raw, internationalEnabled = true) {
  const base = { ...DEFAULT_CALLING_PERMISSIONS, international: internationalEnabled };
  if (!raw || typeof raw !== 'object') return base;
  return {
    local: raw.local !== false,
    national: raw.national !== false,
    international: raw.international !== false && internationalEnabled !== false,
    premium: Boolean(raw.premium),
    emergency: raw.emergency !== false,
  };
}

function serializeSecurity(security) {
  if (!security) return null;
  const whitelist = normalizeWhitelist(security.whitelist, security.allowInternalExtensions);
  const blacklist = normalizeBlacklist(
    security.blacklist,
    security.blockAnonymous,
    security.spamPatternBlockEnabled,
  );

  return {
    whitelist,
    blacklist,
    blockAnonymous: Boolean(security.blockAnonymous || blacklist.blockAnonymous),
    spamPatternBlockEnabled: Boolean(security.spamPatternBlockEnabled),
    allowInternalExtensions: whitelist.allowInternalExtensions,
    callerId: {
      outboundNumber: security.outboundCallerId || null,
      hideCallerId: Boolean(security.hideCallerId),
      displayName: security.callerIdName || null,
    },
    callingPermissions: normalizeCallingPermissions(
      security.callingPermissions,
      security.internationalEnabled,
    ),
    timeRestrictions: {
      enabled: Boolean(security.timeRestrictionsEnabled),
      businessHours: security.businessHours || defaultBusinessHours(),
      afterHoursAction: security.afterHoursAction || 'BLOCK',
      holidaySchedule: Array.isArray(security.holidaySchedule) ? security.holidaySchedule : [],
    },
    recordingPolicy: security.recordingPolicy || 'INBOUND_ONLY',
  };
}

function buildSecurityUpdate(body) {
  const data = {};

  if (body.whitelist !== undefined) {
    const wl = normalizeWhitelist(body.whitelist);
    data.whitelist = wl;
    data.allowInternalExtensions = wl.allowInternalExtensions;
  }
  if (body.blacklist !== undefined) {
    const bl = normalizeBlacklist(body.blacklist);
    data.blacklist = bl;
    data.blockAnonymous = bl.blockAnonymous;
    data.spamPatternBlockEnabled = bl.blockSpamPatterns;
  }
  if (body.blockAnonymous !== undefined) data.blockAnonymous = Boolean(body.blockAnonymous);
  if (body.spamPatternBlockEnabled !== undefined) {
    data.spamPatternBlockEnabled = Boolean(body.spamPatternBlockEnabled);
  }
  if (body.allowInternalExtensions !== undefined) {
    data.allowInternalExtensions = Boolean(body.allowInternalExtensions);
  }

  if (body.callerId !== undefined) {
    if (body.callerId.outboundNumber !== undefined) {
      const num = body.callerId.outboundNumber
        ? normalizePhoneNumber(String(body.callerId.outboundNumber))
        : null;
      data.outboundCallerId = num;
    }
    if (body.callerId.hideCallerId !== undefined) {
      data.hideCallerId = Boolean(body.callerId.hideCallerId);
    }
    if (body.callerId.displayName !== undefined) {
      data.callerIdName = body.callerId.displayName
        ? String(body.callerId.displayName).slice(0, 80)
        : null;
    }
  }

  if (body.callingPermissions !== undefined) {
    const perms = normalizeCallingPermissions(body.callingPermissions);
    data.callingPermissions = perms;
    data.internationalEnabled = perms.international;
  }

  if (body.timeRestrictions !== undefined) {
    const tr = body.timeRestrictions;
    if (tr.enabled !== undefined) data.timeRestrictionsEnabled = Boolean(tr.enabled);
    if (tr.businessHours !== undefined) data.businessHours = tr.businessHours;
    if (tr.afterHoursAction !== undefined) data.afterHoursAction = tr.afterHoursAction;
    if (tr.holidaySchedule !== undefined) data.holidaySchedule = tr.holidaySchedule;
  }

  if (body.recordingPolicy !== undefined) {
    data.recordingPolicy = body.recordingPolicy;
  }

  return data;
}

function isAnonymousCaller(from) {
  const value = String(from || '').toLowerCase();
  return !value
    || value === 'anonymous'
    || value === 'restricted'
    || value === 'unknown'
    || value === 'unavailable';
}

function matchesPrefix(number, prefix) {
  const n = normalizePhoneNumber(number) || number;
  const p = normalizePhoneNumber(prefix) || prefix;
  return n.startsWith(p);
}

function matchesPattern(number, pattern) {
  try {
    const re = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return re.test(number);
  } catch {
    return false;
  }
}

function isInternalExtensionCall(from, tenantExtensions = []) {
  const raw = String(from || '').trim();
  const extMatch = raw.match(/^ext:(\d{2,6})$/i);
  if (extMatch) {
    return tenantExtensions.some((ext) => ext.extensionNumber === extMatch[1]);
  }
  const digits = raw.replace(/\D/g, '');
  return tenantExtensions.some((ext) => ext.extensionNumber === digits);
}

function evaluateInboundSecurity(security, from, { tenantExtensions = [], timezone = 'America/New_York' } = {}) {
  if (!security) return { allowed: true };

  const serialized = serializeSecurity(security);
  const normalizedFrom = normalizePhoneNumber(from) || from;

  if (serialized.timeRestrictions.enabled) {
    const open = isWithinBusinessHours(serialized.timeRestrictions.businessHours, timezone);
    if (!open && serialized.timeRestrictions.afterHoursAction === 'BLOCK') {
      return { allowed: false, reason: 'After hours — calls blocked' };
    }
  }

  if (serialized.blockAnonymous && isAnonymousCaller(from)) {
    return { allowed: false, reason: 'Anonymous callers blocked' };
  }

  const { blacklist, whitelist } = serialized;

  if (blacklist.blockSpamPatterns || serialized.spamPatternBlockEnabled) {
    for (const re of SPAM_PATTERNS) {
      if (re.test(normalizedFrom)) {
        return { allowed: false, reason: 'Spam pattern blocked' };
      }
    }
    for (const pattern of blacklist.patterns) {
      if (matchesPattern(normalizedFrom, pattern)) {
        return { allowed: false, reason: 'Blacklisted pattern' };
      }
    }
  }

  for (const blocked of blacklist.numbers) {
    const b = normalizePhoneNumber(blocked) || blocked;
    if (normalizedFrom === b || normalizedFrom.endsWith(b.replace(/\D/g, ''))) {
      return { allowed: false, reason: 'Blacklisted number' };
    }
  }

  const hasWhitelist = whitelist.numbers.length > 0 || whitelist.prefixes.length > 0;
  if (hasWhitelist) {
    const numberMatch = whitelist.numbers.some((n) => {
      const w = normalizePhoneNumber(n) || n;
      return normalizedFrom === w;
    });
    const prefixMatch = whitelist.prefixes.some((p) => matchesPrefix(normalizedFrom, p));
    const internalMatch = whitelist.allowInternalExtensions
      && isInternalExtensionCall(from, tenantExtensions);
    if (!numberMatch && !prefixMatch && !internalMatch) {
      return { allowed: false, reason: 'Not on whitelist' };
    }
  }

  return { allowed: true };
}

async function writeExtensionAuditLog(prisma, {
  tenantId,
  extensionId,
  userId,
  userEmail,
  category,
  action,
  summary,
  changes,
}) {
  return prisma.extensionAuditLog.create({
    data: {
      id: randomUUID(),
      tenantId,
      extensionId,
      userId: userId || null,
      userEmail: userEmail || null,
      category,
      action,
      summary: summary || null,
      changes: changes || {},
    },
  });
}

function diffSecurityChanges(before, after) {
  const changes = {};
  if (JSON.stringify(before?.whitelist) !== JSON.stringify(after?.whitelist)) {
    changes.whitelist = { before: before?.whitelist, after: after?.whitelist };
  }
  if (JSON.stringify(before?.blacklist) !== JSON.stringify(after?.blacklist)) {
    changes.blacklist = { before: before?.blacklist, after: after?.blacklist };
  }
  if (before?.outboundCallerId !== after?.outboundCallerId
    || before?.hideCallerId !== after?.hideCallerId
    || before?.callerIdName !== after?.callerIdName) {
    changes.callerId = {
      before: {
        outboundCallerId: before?.outboundCallerId,
        hideCallerId: before?.hideCallerId,
        callerIdName: before?.callerIdName,
      },
      after: {
        outboundCallerId: after?.outboundCallerId,
        hideCallerId: after?.hideCallerId,
        callerIdName: after?.callerIdName,
      },
    };
  }
  if (JSON.stringify(before?.callingPermissions) !== JSON.stringify(after?.callingPermissions)) {
    changes.callingPermissions = { before: before?.callingPermissions, after: after?.callingPermissions };
  }
  if (before?.recordingPolicy !== after?.recordingPolicy) {
    changes.recordingPolicy = { before: before?.recordingPolicy, after: after?.recordingPolicy };
  }
  if (before?.timeRestrictionsEnabled !== after?.timeRestrictionsEnabled
    || before?.afterHoursAction !== after?.afterHoursAction) {
    changes.timeRestrictions = {
      before: {
        enabled: before?.timeRestrictionsEnabled,
        afterHoursAction: before?.afterHoursAction,
      },
      after: {
        enabled: after?.timeRestrictionsEnabled,
        afterHoursAction: after?.afterHoursAction,
      },
    };
  }
  return changes;
}

async function updateExtensionSecurity(prisma, tenantId, extensionId, body, actor = {}) {
  const extension = await prisma.extension.findFirst({
    where: { id: extensionId, tenantId },
    include: { security: true },
  });
  if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });

  const before = extension.security;
  const data = buildSecurityUpdate(body);

  const security = await prisma.extensionSecurity.upsert({
    where: { extensionId },
    create: { extensionId, ...data },
    update: data,
  });

  const changes = diffSecurityChanges(before, security);
  if (Object.keys(changes).length) {
    await writeExtensionAuditLog(prisma, {
      tenantId,
      extensionId,
      userId: actor.userId,
      userEmail: actor.userEmail,
      category: 'security',
      action: 'security.updated',
      summary: 'Extension security settings updated',
      changes,
    });
  }

  return security;
}

async function listExtensionAuditLogs(prisma, tenantId, extensionId, { limit = 50, category } = {}) {
  const where = { tenantId, extensionId };
  if (category) where.category = category;

  const rows = await prisma.extensionAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    action: row.action,
    summary: row.summary,
    changes: row.changes,
    userEmail: row.userEmail,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function listTenantSecurityAuditLogs(prisma, tenantId, limit = 50) {
  const rows = await prisma.extensionAuditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
    include: {
      extension: { select: { extensionNumber: true, displayName: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    extensionId: row.extensionId,
    extensionNumber: row.extension.extensionNumber,
    displayName: row.extension.displayName,
    category: row.category,
    action: row.action,
    summary: row.summary,
    userEmail: row.userEmail,
    createdAt: row.createdAt.toISOString(),
  }));
}

module.exports = {
  serializeSecurity,
  buildSecurityUpdate,
  updateExtensionSecurity,
  evaluateInboundSecurity,
  writeExtensionAuditLog,
  listExtensionAuditLogs,
  listTenantSecurityAuditLogs,
  normalizeWhitelist,
  normalizeBlacklist,
  DEFAULT_CALLING_PERMISSIONS,
};
