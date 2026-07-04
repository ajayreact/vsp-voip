const { getCallControlApplicationId, getV3CallControlApplicationId } = require('../telnyxCallControlSetup');
const { CREDENTIAL_USERNAME_FIELDS, EXTENSION_DIAL_PATTERN } = require('./constants');
const {
  extractSipUsername,
  isOutboundDirection,
  isValidE164CallerId,
  callerResolutionPayloadSnapshot,
} = require('./PayloadNormalizer');
const { logDeskTelephonyEvent } = require('./deskOutboundLogger');

function logCallerResolutionDiagnostic(context) {
  console.warn('[INTERNAL CALL] caller resolution diagnostic', context);
}

async function resolveCallerFromAddress(prisma, from) {
  const sipUsername = extractSipUsername(from);
  if (!sipUsername) {
    logCallerResolutionDiagnostic({
      branch: 'resolveCallerFromAddress',
      failedReason: 'no_sip_username_in_from',
      from: from ?? null,
      lookupAttempted: null,
      lookupResult: null,
    });
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { telnyxSipUsername: { equals: sipUsername, mode: 'insensitive' } },
    include: {
      extensions: {
        where: { status: 'ACTIVE' },
        orderBy: { extensionNumber: 'asc' },
        take: 1,
      },
    },
  });
  if (user?.tenantId) {
    return {
      tenantId: user.tenantId,
      callerExtension: user.extensions[0] || null,
      user,
      sipUsername,
    };
  }

  // Legacy desk credentials created before Phase 2.4a (extension-scoped). Remove after migration.
  const legacyDeskExtension = await prisma.extension.findFirst({
    where: {
      telnyxSipUsername: { equals: sipUsername, mode: 'insensitive' },
      status: 'ACTIVE',
    },
    include: { user: true },
  });
  if (legacyDeskExtension) {
    return {
      tenantId: legacyDeskExtension.tenantId,
      callerExtension: legacyDeskExtension,
      user: legacyDeskExtension.user,
      sipUsername,
    };
  }

  logCallerResolutionDiagnostic({
    branch: 'resolveCallerFromAddress',
    failedReason: 'user_and_legacy_extension_not_found',
    from: from ?? null,
    sipUsername,
    lookupAttempted: ['User.telnyxSipUsername', 'Extension.telnyxSipUsername (legacy)'],
    lookupResult: null,
  });
  return null;
}

/**
 * When the desk phone sends From: sip:101@… (extension) without sip_username on the webhook,
 * resolve only when exactly one registered employee owns that extension (multi-tenant safe).
 */
async function resolveCallerFromUniqueRegisteredExtension(prisma, extensionNumber) {
  const digits = String(extensionNumber || '').trim();
  if (!EXTENSION_DIAL_PATTERN.test(digits)) {
    logCallerResolutionDiagnostic({
      branch: 'resolveCallerFromUniqueRegisteredExtension',
      failedReason: 'invalid_extension_number',
      extensionNumber: digits || null,
      lookupAttempted: null,
      lookupResult: null,
    });
    return null;
  }

  const users = await prisma.user.findMany({
    where: {
      telnyxSipUsername: { not: null },
      sipRegistered: true,
      extensions: {
        some: {
          extensionNumber: digits,
          status: 'ACTIVE',
        },
      },
    },
    include: {
      extensions: {
        where: { status: 'ACTIVE', extensionNumber: digits },
        orderBy: { extensionNumber: 'asc' },
        take: 1,
      },
    },
  });

  if (users.length === 1) {
    const user = users[0];
    return {
      tenantId: user.tenantId,
      callerExtension: user.extensions[0] || null,
      user,
      sipUsername: user.telnyxSipUsername,
      resolvedVia: 'unique_registered_extension',
    };
  }

  if (users.length > 1) {
    console.warn('[INTERNAL CALL] ambiguous extension caller (multi-tenant)', {
      extensionNumber: digits,
      tenantIds: users.map((item) => item.tenantId),
    });
    logCallerResolutionDiagnostic({
      branch: 'resolveCallerFromUniqueRegisteredExtension',
      failedReason: 'ambiguous_multi_tenant',
      extensionNumber: digits,
      lookupAttempted: 'User.findMany (registered + extension match)',
      lookupResult: { usersFound: users.length },
    });
    return null;
  }

  logCallerResolutionDiagnostic({
    branch: 'resolveCallerFromUniqueRegisteredExtension',
    failedReason: 'no_registered_users',
    extensionNumber: digits,
    lookupAttempted: 'User.findMany (registered + extension match)',
    lookupResult: { usersFound: 0 },
  });
  return null;
}

async function resolveParkedOutboundPstnFrom(prisma, payload, caller) {
  const { normalizePhoneNumber } = require('../phone');
  const rawFrom = String(payload?.from || '').trim();

  if (isValidE164CallerId(rawFrom)) {
    return normalizePhoneNumber(rawFrom);
  }

  if (!caller?.tenantId) return rawFrom;

  const extensionId = caller.callerExtension?.id || null;
  let extension = caller.callerExtension;
  if (extensionId && !extension?.security) {
    extension = await prisma.extension.findFirst({
      where: { id: extensionId, tenantId: caller.tenantId },
      include: { security: true, primaryPhoneNumber: true },
    });
  }

  const outboundCallerId = extension?.security?.outboundCallerId;
  if (isValidE164CallerId(outboundCallerId)) {
    return normalizePhoneNumber(outboundCallerId);
  }

  let assignedDid = extension?.primaryPhoneNumber?.number || null;
  if (!assignedDid && extensionId) {
    const { loadExtensionPhoneNumber } = require('../extensionOwnership');
    assignedDid = (await loadExtensionPhoneNumber(prisma, extensionId))?.number || null;
  }
  if (isValidE164CallerId(assignedDid)) {
    return normalizePhoneNumber(assignedDid);
  }

  const companyDid = await prisma.phoneNumber.findFirst({
    where: { tenantId: caller.tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { number: true },
  });
  if (isValidE164CallerId(companyDid?.number)) {
    return normalizePhoneNumber(companyDid.number);
  }

  return rawFrom;
}

/**
 * Desk phone Call Control Application outbound only: resolve caller from tenant DID (payload.from).
 * Runs after all standard SIP-username resolution paths fail.
 */
async function resolveCallerFromCallControlOutboundDid(prisma, payload, platform) {
  const snapshot = callerResolutionPayloadSnapshot(payload);
  const { normalizePhoneNumber } = require('../phone');
  const normalizedFrom = normalizePhoneNumber(payload?.from);

  if (!isOutboundDirection(payload?.direction)) {
    logCallerResolutionDiagnostic({
      branch: 'call_control_did',
      failedReason: 'not_outbound_direction',
      normalizedFrom: normalizedFrom || null,
      ...snapshot,
    });
    return null;
  }

  if (!platform) {
    logCallerResolutionDiagnostic({
      branch: 'call_control_did',
      failedReason: 'no_platform_context',
      normalizedFrom: normalizedFrom || null,
      ...snapshot,
    });
    return null;
  }

  const callControlApplicationId = getCallControlApplicationId(platform);
  const v3CallControlApplicationId = getV3CallControlApplicationId();
  const payloadConnectionId = payload?.connection_id ? String(payload.connection_id) : null;
  const matchesCallControlApp = Boolean(payloadConnectionId && (
    (callControlApplicationId && payloadConnectionId === String(callControlApplicationId))
    || (v3CallControlApplicationId && payloadConnectionId === String(v3CallControlApplicationId))
  ));
  if (!matchesCallControlApp) {
    logCallerResolutionDiagnostic({
      branch: 'call_control_did',
      failedReason: 'connection_id_not_call_control_application',
      expectedCallControlApplicationId: callControlApplicationId || null,
      expectedV3CallControlApplicationId: v3CallControlApplicationId || null,
      payloadConnectionId,
      normalizedFrom: normalizedFrom || null,
      ...snapshot,
    });
    return null;
  }

  if (!normalizedFrom) {
    logCallerResolutionDiagnostic({
      branch: 'call_control_did',
      failedReason: 'from_not_e164',
      normalizedFrom: null,
      ...snapshot,
    });
    return null;
  }

  const phoneRecord = await prisma.phoneNumber.findUnique({
    where: { number: normalizedFrom },
    select: { tenantId: true, assignedUserId: true, extensionId: true },
  });

  console.log('[INTERNAL CALL] caller resolution lookup', {
    branch: 'call_control_did',
    lookupAttempted: 'PhoneNumber.findUnique',
    lookupKey: normalizedFrom,
    lookupResult: phoneRecord
      ? {
        tenantId: phoneRecord.tenantId,
        assignedUserId: phoneRecord.assignedUserId,
        extensionId: phoneRecord.extensionId,
      }
      : null,
  });

  if (!phoneRecord?.tenantId) {
    logCallerResolutionDiagnostic({
      branch: 'call_control_did',
      failedReason: 'phone_number_not_found',
      normalizedFrom,
      ...snapshot,
    });
    return null;
  }

  if (phoneRecord.assignedUserId) {
    const user = await prisma.user.findFirst({
      where: { id: phoneRecord.assignedUserId, tenantId: phoneRecord.tenantId },
      include: {
        extensions: {
          where: { status: 'ACTIVE' },
          orderBy: { extensionNumber: 'asc' },
          take: 1,
        },
      },
    });

    console.log('[INTERNAL CALL] caller resolution lookup', {
      branch: 'call_control_did_assignedUserId',
      lookupAttempted: 'User.findFirst',
      lookupKey: phoneRecord.assignedUserId,
      lookupResult: user ? { id: user.id, tenantId: user.tenantId } : null,
    });

    if (user?.tenantId) {
      return {
        tenantId: phoneRecord.tenantId,
        callerExtension: user.extensions[0] || null,
        user,
        sipUsername: user.telnyxSipUsername || null,
        resolvedVia: 'call_control_did_assigned_user',
      };
    }

    logCallerResolutionDiagnostic({
      branch: 'call_control_did',
      failedReason: 'assigned_user_not_found',
      normalizedFrom,
      assignedUserId: phoneRecord.assignedUserId,
      ...snapshot,
    });
    return null;
  }

  if (phoneRecord.extensionId) {
    const extension = await prisma.extension.findFirst({
      where: {
        id: phoneRecord.extensionId,
        tenantId: phoneRecord.tenantId,
        status: 'ACTIVE',
      },
      include: { user: true },
    });

    console.log('[INTERNAL CALL] caller resolution lookup', {
      branch: 'call_control_did_extensionId',
      lookupAttempted: 'Extension.findFirst',
      lookupKey: phoneRecord.extensionId,
      lookupResult: extension?.user
        ? { extensionId: extension.id, userId: extension.user.id }
        : null,
    });

    if (extension?.user?.tenantId) {
      return {
        tenantId: phoneRecord.tenantId,
        callerExtension: extension,
        user: extension.user,
        sipUsername: extension.user.telnyxSipUsername || null,
        resolvedVia: 'call_control_did_extension',
      };
    }

    logCallerResolutionDiagnostic({
      branch: 'call_control_did',
      failedReason: 'extension_user_not_found',
      normalizedFrom,
      extensionId: phoneRecord.extensionId,
      ...snapshot,
    });
    return null;
  }

  logCallerResolutionDiagnostic({
    branch: 'call_control_did',
    failedReason: 'phone_number_has_no_assigned_user_or_extension',
    normalizedFrom,
    ...snapshot,
  });
  return null;
}

function finishCallerResolve(caller, payload, options = {}) {
  if (!caller?.tenantId) return caller;
  if (options.logCallerResolved) {
    logDeskTelephonyEvent('caller.resolved', {
      callControlId: payload?.call_control_id || null,
      callerId: caller?.user?.id ?? null,
      tenantId: caller.tenantId,
      extensionId: caller?.callerExtension?.id ?? null,
      resolvedVia: caller?.resolvedVia ?? null,
    });
  }
  return caller;
}

async function resolveCallerFromPayload(prisma, payload, platform = null, options = {}) {
  let caller = await resolveCallerFromAddress(prisma, payload?.from);
  if (caller?.tenantId) return finishCallerResolve(caller, payload, options);

  for (const field of CREDENTIAL_USERNAME_FIELDS) {
    const value = payload?.[field];
    if (!value) continue;
    caller = await resolveCallerFromAddress(prisma, value);
    if (caller?.tenantId) return finishCallerResolve(caller, payload, options);
  }

  const fromUsername = extractSipUsername(payload?.from);
  if (fromUsername && EXTENSION_DIAL_PATTERN.test(fromUsername)) {
    caller = await resolveCallerFromUniqueRegisteredExtension(prisma, fromUsername);
    if (caller?.tenantId) return finishCallerResolve(caller, payload, options);
  }

  for (const field of ['calling_party_id', 'caller_id_number']) {
    if (payload?.[field]) {
      caller = await resolveCallerFromAddress(prisma, payload[field]);
      if (caller?.tenantId) return finishCallerResolve(caller, payload, options);
    }
  }

  // Caller identity must come from SIP username (Telnyx Credential Connection / WebRTC SDK).
  // Never resolve ext:NNN without tenantId — extension numbers are not globally unique.

  const headers = payload?.custom_headers;
  if (Array.isArray(headers)) {
    for (const header of headers) {
      const value = header?.header_value ?? header?.value;
      if (!value) continue;
      caller = await resolveCallerFromAddress(prisma, value);
      if (caller?.tenantId) return finishCallerResolve(caller, payload, options);
    }
  }

  for (const field of ['sip_from', 'calling_party_id']) {
    if (payload?.[field]) {
      caller = await resolveCallerFromAddress(prisma, payload[field]);
      if (caller?.tenantId) return finishCallerResolve(caller, payload, options);
    }
  }

  const { normalizePhoneNumber } = require('../phone');
  const normalizedFrom = normalizePhoneNumber(payload?.from);
  if (normalizedFrom) {
    const phoneRecord = await prisma.phoneNumber.findUnique({
      where: { number: normalizedFrom },
      select: { tenantId: true, assignedUserId: true },
    });
    if (phoneRecord?.assignedUserId) {
      const user = await prisma.user.findFirst({
        where: { id: phoneRecord.assignedUserId, tenantId: phoneRecord.tenantId },
        include: {
          extensions: {
            where: { status: 'ACTIVE' },
            orderBy: { extensionNumber: 'asc' },
            take: 1,
          },
        },
      });
      if (user?.telnyxSipUsername) {
        return finishCallerResolve({
          tenantId: phoneRecord.tenantId,
          callerExtension: user.extensions[0] || null,
          user,
          sipUsername: user.telnyxSipUsername,
        }, payload, options);
      }
    }
    if (phoneRecord?.tenantId) {
      caller = await resolveCallerFromAddress(prisma, payload?.sip_from || payload?.calling_party_id);
      if (caller?.tenantId === phoneRecord.tenantId) return finishCallerResolve(caller, payload, options);
    }
  }

  caller = await resolveCallerFromCallControlOutboundDid(prisma, payload, platform);
  if (caller?.tenantId) return finishCallerResolve(caller, payload, options);

  logCallerResolutionDiagnostic({
    branch: 'resolveCallerFromPayload',
    failedReason: 'all_methods_exhausted',
    normalizedFrom: normalizePhoneNumber(payload?.from) || null,
    ...callerResolutionPayloadSnapshot(payload),
  });
  if (options.logCallerResolved) {
    logDeskTelephonyEvent('caller.resolved', {
      callControlId: payload?.call_control_id || null,
      result: 'skipped',
      reason: 'caller_not_resolved',
    });
  }
  return null;
}

module.exports = {
  logCallerResolutionDiagnostic,
  resolveCallerFromAddress,
  resolveCallerFromUniqueRegisteredExtension,
  resolveCallerFromCallControlOutboundDid,
  resolveCallerFromPayload,
  resolveParkedOutboundPstnFrom,
};
