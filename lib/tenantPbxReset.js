const { revokeAllRefreshTokensForUser } = require('./refreshTokens');

const TELEPHONY_CLEAR_USER_FIELDS = {
  telnyxCredentialId: null,
  telnyxSipUsername: null,
  telnyxSipPassword: null,
  sipRegistered: null,
  sipRegistrationCheckedAt: null,
  sipRegistrationResponse: null,
  sipRegistrationSource: null,
  softphoneOnlineAt: null,
  pushDeviceToken: null,
  pushDevicePlatform: null,
  pushTokenUpdatedAt: null,
};

function assertDevelopmentEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run: NODE_ENV=production. This reset is development-only.');
  }

  const publicUrl = String(process.env.API_PUBLIC_URL || '').toLowerCase();
  if (publicUrl.includes('vspphone.com') && process.env.ALLOW_DEV_RESET_ON_VSPPHONE !== '1') {
    throw new Error(
      'Refusing to run: API_PUBLIC_URL looks like production (vspphone.com). '
      + 'Set ALLOW_DEV_RESET_ON_VSPPHONE=1 only if you are certain this is a safe dev host.',
    );
  }
}

async function collectTenantSnapshot(prisma, tenantId) {
  const [
    tenant,
    extensions,
    ringGroups,
    ringGroupMembers,
    phoneNumbers,
    employees,
    tenantAdmins,
    superAdmins,
    greeting,
    callLogs,
    recordings,
    voicemails,
    conversations,
    smsMessages,
    provisioningTokens,
    userDevices,
    usersWithSip,
    usersWithPresence,
  ] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } }),
    prisma.extension.count({ where: { tenantId } }),
    prisma.ringGroup.count({ where: { tenantId } }),
    prisma.ringGroupMember.count({ where: { ringGroup: { tenantId } } }),
    prisma.phoneNumber.count({ where: { tenantId } }),
    prisma.user.count({ where: { tenantId, role: 'TENANT_USER' } }),
    prisma.user.count({ where: { tenantId, role: 'TENANT_ADMIN' } }),
    prisma.user.count({ where: { role: 'SUPER_ADMIN' } }),
    prisma.greeting.count({ where: { tenantId } }),
    prisma.callLog.count({ where: { tenantId } }),
    prisma.callRecording.count({ where: { tenantId } }),
    prisma.voicemail.count({ where: { tenantId } }),
    prisma.conversation.count({ where: { tenantId } }),
    prisma.smsMessage.count({ where: { tenantId } }),
    prisma.extensionProvisioningToken.count({ where: { tenantId } }),
    prisma.userDevice.count({ where: { user: { tenantId } } }),
    prisma.user.count({
      where: {
        tenantId,
        OR: [
          { telnyxCredentialId: { not: null } },
          { telnyxSipUsername: { not: null } },
        ],
      },
    }),
    prisma.user.count({
      where: {
        tenantId,
        OR: [
          { softphoneOnlineAt: { not: null } },
          { sipRegistered: true },
        ],
      },
    }),
  ]);

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const assignedNumbers = await prisma.phoneNumber.count({
    where: {
      tenantId,
      OR: [
        { assignedUserId: { not: null } },
        { extensionId: { not: null } },
        { ringGroupId: { not: null } },
      ],
    },
  });

  return {
    tenant,
    extensions,
    ringGroups,
    ringGroupMembers,
    phoneNumbers,
    assignedNumbers,
    unassignedNumbers: phoneNumbers - assignedNumbers,
    employees,
    tenantAdmins,
    superAdmins,
    greeting,
    callLogs,
    recordings,
    voicemails,
    conversations,
    smsMessages,
    provisioningTokens,
    userDevices,
    usersWithSip,
    usersWithPresence,
  };
}

function buildDryRunReport(tenantId, before, options) {
  const wouldRemove = {
    employees: before.employees,
    extensions: before.extensions,
    ringGroups: before.ringGroups,
    ringGroupMembers: before.ringGroupMembers,
    greetings: before.greeting,
    provisioningTokens: before.provisioningTokens,
    userDevices: before.userDevices,
    phoneNumberAssignments: before.assignedNumbers,
    sipCredentialAssignments: before.usersWithSip,
    presenceRecords: before.usersWithPresence,
    refreshTokens: 'all tenant users (revoked on execute)',
    activeSessions: 'tenant refresh tokens + tenant SIP presence keys (cleared on execute)',
  };

  if (options.clearCallHistory) {
    wouldRemove.callLogs = before.callLogs;
    wouldRemove.callRecordings = before.recordings;
    wouldRemove.voicemailMetadata = before.voicemails;
    wouldRemove.smsConversations = before.conversations;
    wouldRemove.smsMessages = before.smsMessages;
  }

  const wouldPreserve = {
    purchasedDids: before.phoneNumbers,
    tenantAdmins: before.tenantAdmins,
    superAdmins: before.superAdmins,
    platformConfiguration: true,
    billingConfiguration: true,
    telephonyArchitecture: true,
  };

  if (!options.clearCallHistory) {
    wouldPreserve.callLogs = before.callLogs;
    wouldPreserve.callRecordings = before.recordings;
    wouldPreserve.voicemailMetadata = before.voicemails;
    wouldPreserve.smsConversations = before.conversations;
    wouldPreserve.smsMessages = before.smsMessages;
  }

  return {
    dryRun: true,
    tenantId,
    tenantName: before.tenant.name,
    options: {
      clearCallHistory: Boolean(options.clearCallHistory),
      skipTelnyx: Boolean(options.skipTelnyx),
      flushRedis: Boolean(options.flushRedis),
    },
    wouldRemove,
    wouldPreserve,
    currentCounts: before,
  };
}

async function deleteTelnyxCredentialSafe(credentialId) {
  if (!credentialId || process.env.TELNYX_API_KEY?.trim() === '') return { skipped: true };
  try {
    const { deleteTelephonyCredential } = require('./telnyxCallControl');
    await deleteTelephonyCredential(credentialId);
    return { deleted: true };
  } catch (error) {
    return { deleted: false, error: error.message };
  }
}

async function purgeEmployeeTelephonyCredentials(prisma, tenantId, { skipTelnyx = false } = {}) {
  const [employees, extensions] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: 'TENANT_USER' },
      select: { id: true, telnyxCredentialId: true },
    }),
    prisma.extension.findMany({
      where: { tenantId },
      select: { id: true, telnyxCredentialId: true },
    }),
  ]);

  const credentialIds = new Set();
  for (const row of [...employees, ...extensions]) {
    if (row.telnyxCredentialId) credentialIds.add(row.telnyxCredentialId);
  }

  const telnyxResults = [];
  if (!skipTelnyx) {
    for (const credentialId of credentialIds) {
      telnyxResults.push({ credentialId, ...(await deleteTelnyxCredentialSafe(credentialId)) });
    }
  }

  return {
    employeeCredentialCount: credentialIds.size,
    telnyxResults,
  };
}

async function revokeTenantRefreshTokens(prisma, tenantId) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, role: true },
  });
  for (const user of users) {
    await revokeAllRefreshTokensForUser(user.id);
  }
  return users.length;
}

async function flushTenantPresenceSessions(prisma, tenantId) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { telnyxSipUsername: true },
  });
  const extensions = await prisma.extension.findMany({
    where: { tenantId },
    select: { telnyxSipUsername: true, sipUsername: true },
  });

  const sipUsernames = new Set();
  for (const row of [...users, ...extensions]) {
    for (const value of [row.telnyxSipUsername, row.sipUsername]) {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized) sipUsernames.add(normalized);
    }
  }

  const redis = await require('./redis').getRedisClient().catch(() => null);
  if (!redis) return { flushed: 0, skipped: true, sipUsernames: sipUsernames.size };

  let flushed = 0;
  for (const sipUsername of sipUsernames) {
    const keys = [
      `ccs:agent:${sipUsername}`,
      `ccs:active:${sipUsername}`,
    ];
    flushed += keys.length;
    await redis.del(...keys);
  }

  return { flushed, skipped: false, sipUsernames: sipUsernames.size };
}

async function resetTenantPbxData(prisma, tenantId, options = {}) {
  const {
    dryRun = false,
    clearCallHistory = false,
    skipTelnyx = false,
    flushRedis = true,
  } = options;

  const before = await collectTenantSnapshot(prisma, tenantId);
  if (dryRun) {
    return buildDryRunReport(tenantId, before, options);
  }

  const telnyxPurge = await purgeEmployeeTelephonyCredentials(prisma, tenantId, { skipTelnyx });

  const deleted = await prisma.$transaction(async (tx) => {
    const counts = {};

    counts.extensionsUnlinked = (await tx.extension.updateMany({
      where: { tenantId },
      data: { primaryPhoneNumberId: null, userId: null },
    })).count;

    counts.phoneNumbersUnassigned = (await tx.phoneNumber.updateMany({
      where: { tenantId },
      data: {
        assignedUserId: null,
        extensionId: null,
        ringGroupId: null,
        routingType: 'tenant_default',
        forwardDestination: null,
        label: null,
      },
    })).count;

    counts.provisioningTokens = (await tx.extensionProvisioningToken.deleteMany({ where: { tenantId } })).count;
    counts.ringGroups = (await tx.ringGroup.deleteMany({ where: { tenantId } })).count;
    counts.extensions = (await tx.extension.deleteMany({ where: { tenantId } })).count;
    counts.greetings = (await tx.greeting.deleteMany({ where: { tenantId } })).count;
    counts.userDevices = (await tx.userDevice.deleteMany({
      where: { user: { tenantId } },
    })).count;
    counts.employeesDeleted = (await tx.user.deleteMany({
      where: { tenantId, role: 'TENANT_USER' },
    })).count;

    counts.tenantAdminsTelephonyCleared = (await tx.user.updateMany({
      where: { tenantId, role: 'TENANT_ADMIN' },
      data: TELEPHONY_CLEAR_USER_FIELDS,
    })).count;

    if (clearCallHistory) {
      counts.messageAttachments = (await tx.messageAttachment.deleteMany({ where: { tenantId } })).count;
      counts.smsMessages = (await tx.smsMessage.deleteMany({ where: { tenantId } })).count;
      counts.messages = (await tx.message.deleteMany({ where: { tenantId } })).count;
      counts.conversations = (await tx.conversation.deleteMany({ where: { tenantId } })).count;
      counts.callLogs = (await tx.callLog.deleteMany({ where: { tenantId } })).count;
      counts.callRecordings = (await tx.callRecording.deleteMany({ where: { tenantId } })).count;
      counts.voicemails = (await tx.voicemail.deleteMany({ where: { tenantId } })).count;
      counts.callQualityMetrics = (await tx.callQualityMetric.deleteMany({ where: { tenantId } })).count;
    }

    return counts;
  }, { timeout: 120000 });

  const refreshTokensRevoked = await revokeTenantRefreshTokens(prisma, tenantId);
  const presenceFlush = flushRedis
    ? await flushTenantPresenceSessions(prisma, tenantId)
    : { skipped: true };

  const after = await validateTenantPbxReset(prisma, tenantId);

  return {
    tenantId,
    tenantName: before.tenant.name,
    options: {
      clearCallHistory,
      skipTelnyx,
      flushRedis,
    },
    before,
    deleted,
    telnyxPurge,
    refreshTokensRevoked,
    presenceFlush,
    after,
    ok: after.ok,
  };
}

async function validateTenantPbxReset(prisma, tenantId) {
  const [
    extensions,
    ringGroups,
    employees,
    tenantAdmins,
    tenantAdminsWithPassword,
    assignedNumbers,
    extensionLinkedNumbers,
    ringGroupLinkedNumbers,
    provisioningTokens,
    userDevices,
    greeting,
    usersWithSip,
    usersWithPresence,
    phoneNumbers,
    superAdmins,
    callLogs,
    recordings,
    voicemails,
    conversations,
  ] = await Promise.all([
    prisma.extension.count({ where: { tenantId } }),
    prisma.ringGroup.count({ where: { tenantId } }),
    prisma.user.count({ where: { tenantId, role: 'TENANT_USER' } }),
    prisma.user.count({ where: { tenantId, role: 'TENANT_ADMIN' } }),
    prisma.user.count({
      where: {
        tenantId,
        role: 'TENANT_ADMIN',
        passwordHash: { not: '' },
      },
    }),
    prisma.phoneNumber.count({ where: { tenantId, assignedUserId: { not: null } } }),
    prisma.phoneNumber.count({ where: { tenantId, extensionId: { not: null } } }),
    prisma.phoneNumber.count({ where: { tenantId, ringGroupId: { not: null } } }),
    prisma.extensionProvisioningToken.count({ where: { tenantId } }),
    prisma.userDevice.count({ where: { user: { tenantId } } }),
    prisma.greeting.count({ where: { tenantId } }),
    prisma.user.count({
      where: {
        tenantId,
        OR: [
          { telnyxCredentialId: { not: null } },
          { telnyxSipUsername: { not: null } },
        ],
      },
    }),
    prisma.user.count({
      where: {
        tenantId,
        OR: [
          { softphoneOnlineAt: { not: null } },
          { sipRegistered: true },
        ],
      },
    }),
    prisma.phoneNumber.count({ where: { tenantId } }),
    prisma.user.count({ where: { role: 'SUPER_ADMIN' } }),
    prisma.callLog.count({ where: { tenantId } }),
    prisma.callRecording.count({ where: { tenantId } }),
    prisma.voicemail.count({ where: { tenantId } }),
    prisma.conversation.count({ where: { tenantId } }),
  ]);

  const issues = [];
  if (extensions > 0) issues.push(`${extensions} extension(s) remain`);
  if (ringGroups > 0) issues.push(`${ringGroups} ring group(s) remain`);
  if (employees > 0) issues.push(`${employees} tenant employee(s) remain`);
  if (assignedNumbers > 0) issues.push(`${assignedNumbers} DID(s) still assigned to users`);
  if (extensionLinkedNumbers > 0) issues.push(`${extensionLinkedNumbers} DID(s) still linked to extensions`);
  if (ringGroupLinkedNumbers > 0) issues.push(`${ringGroupLinkedNumbers} DID(s) still linked to ring groups`);
  if (provisioningTokens > 0) issues.push(`${provisioningTokens} QR provisioning token(s) remain`);
  if (userDevices > 0) issues.push(`${userDevices} device registration(s) remain`);
  if (greeting > 0) issues.push(`${greeting} tenant greeting(s) remain`);
  if (usersWithSip > 0) issues.push(`${usersWithSip} user(s) still have SIP credential assignments`);
  if (usersWithPresence > 0) issues.push(`${usersWithPresence} user(s) still have presence/SIP registration state`);
  if (tenantAdmins === 0) issues.push('no tenant admin account remains');
  if (tenantAdminsWithPassword < tenantAdmins) issues.push('one or more tenant admins cannot log in (missing password)');

  const checklist = {
    tenantAdminLoginReady: tenantAdmins > 0 && tenantAdminsWithPassword === tenantAdmins,
    zeroEmployees: employees === 0,
    zeroExtensions: extensions === 0,
    zeroRingGroups: ringGroups === 0,
    zeroRegisteredDevices: userDevices === 0,
    zeroQrTokens: provisioningTokens === 0,
    zeroSipRegistrations: usersWithSip === 0 && usersWithPresence === 0,
    purchasedDidsAvailable: phoneNumbers > 0
      && assignedNumbers === 0
      && extensionLinkedNumbers === 0
      && ringGroupLinkedNumbers === 0,
    noOrphanRecords: issues.length === 0,
    superAdminPreserved: superAdmins > 0,
  };

  return {
    ok: issues.length === 0,
    issues,
    checklist,
    counts: {
      phoneNumbers,
      unassignedDids: phoneNumbers - assignedNumbers - extensionLinkedNumbers - ringGroupLinkedNumbers,
      tenantAdmins,
      superAdmins,
      extensions,
      ringGroups,
      employees,
      callLogs,
      recordings,
      voicemails,
      conversations,
    },
  };
}

async function resetAllTenantsPbxData(prisma, options = {}) {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  const results = [];
  for (const tenant of tenants) {
    results.push(await resetTenantPbxData(prisma, tenant.id, options));
  }
  return {
    tenantCount: tenants.length,
    options: {
      clearCallHistory: Boolean(options.clearCallHistory),
      skipTelnyx: Boolean(options.skipTelnyx),
      flushRedis: Boolean(options.flushRedis),
    },
    results,
    ok: results.every((row) => row.ok || row.dryRun),
  };
}

module.exports = {
  assertDevelopmentEnvironment,
  collectTenantSnapshot,
  buildDryRunReport,
  resetTenantPbxData,
  resetAllTenantsPbxData,
  validateTenantPbxReset,
};
