const {
  isPstnDestination,
  parseInternalExtensionDestination,
  isTelnyxCredentialSipDestination,
  parseCredentialSipUsername,
} = require('./PayloadNormalizer');

/**
 * Classify destination type from raw Telnyx `to` field (pure — no DB).
 * @returns {{ kind: 'EXTENSION'|'PSTN'|'CREDENTIAL_SIP'|'UNKNOWN', extensionNumber?: string, pstnNumber?: string, sipUsername?: string }}
 */
function classifyDestinationKind(to) {
  const extensionNumber = parseInternalExtensionDestination(to);
  if (extensionNumber) {
    return { kind: 'EXTENSION', extensionNumber };
  }
  if (isPstnDestination(to)) {
    return { kind: 'PSTN', pstnNumber: String(to || '').trim() };
  }
  const sipUsername = parseCredentialSipUsername(to);
  if (sipUsername) {
    return { kind: 'CREDENTIAL_SIP', sipUsername };
  }
  return { kind: 'UNKNOWN' };
}

/**
 * Resolve employee extension from Telnyx credential SIP URI (sip:gencred…@sip.telnyx.com).
 * Used when sip_uri_calling_preference: internal rewrites extension dials to credential URIs.
 */
async function loadTargetExtensionBySipUsername(prisma, tenantId, sipUsername) {
  if (!prisma || !tenantId || !sipUsername) return null;

  const user = await prisma.user.findFirst({
    where: {
      tenantId,
      telnyxSipUsername: { equals: sipUsername, mode: 'insensitive' },
    },
    include: {
      extensions: {
        where: { status: 'ACTIVE' },
        orderBy: { extensionNumber: 'asc' },
        take: 1,
      },
    },
  });
  if (user?.extensions?.[0]) {
    return user.extensions[0];
  }

  // Legacy desk credentials created before Phase 2.4a (extension-scoped).
  return prisma.extension.findFirst({
    where: {
      tenantId,
      telnyxSipUsername: { equals: sipUsername, mode: 'insensitive' },
      status: 'ACTIVE',
    },
    include: {
      forwarding: true,
      security: true,
      user: true,
      primaryPhoneNumber: true,
    },
  });
}

/**
 * Map destination `to` to extension digits when possible (numeric, sip:NNN@, or gencred SIP URI).
 */
async function resolveExtensionNumberFromTo(prisma, to, tenantId) {
  const direct = parseInternalExtensionDestination(to);
  if (direct) return direct;

  const sipUsername = parseCredentialSipUsername(to);
  if (!sipUsername || !prisma || !tenantId) return null;

  const extension = await loadTargetExtensionBySipUsername(prisma, tenantId, sipUsername);
  return extension?.extensionNumber ?? null;
}

/**
 * Resolve outbound destination for desk router.
 * @param {object} payload Telnyx webhook payload
 * @param {{ tenantId?: string|null }|null} caller Resolved caller, if available
 */
async function resolveOutboundDestination(prisma, payload, caller) {
  const to = payload?.to;
  const tenantId = caller?.tenantId ?? null;
  const classified = classifyDestinationKind(to);

  if (classified.kind === 'EXTENSION') {
    return {
      kind: 'EXTENSION',
      extensionNumber: classified.extensionNumber,
      tenantId,
      resolvedVia: 'extension_digits',
    };
  }

  if (classified.kind === 'CREDENTIAL_SIP' && prisma && tenantId) {
    const extension = await loadTargetExtensionBySipUsername(
      prisma,
      tenantId,
      classified.sipUsername,
    );
    if (extension?.extensionNumber) {
      return {
        kind: 'EXTENSION',
        extensionNumber: extension.extensionNumber,
        tenantId,
        resolvedVia: 'credential_sip',
        sipUsername: classified.sipUsername,
      };
    }
    return {
      kind: 'CREDENTIAL_SIP',
      sipUsername: classified.sipUsername,
      tenantId,
    };
  }

  if (classified.kind === 'PSTN') {
    return {
      kind: 'PSTN',
      pstnNumber: classified.pstnNumber,
      tenantId,
    };
  }

  return { kind: 'UNKNOWN', tenantId };
}

async function loadTargetExtension(prisma, tenantId, extensionNumber) {
  return prisma.extension.findFirst({
    where: {
      tenantId,
      extensionNumber: String(extensionNumber).trim(),
      status: 'ACTIVE',
    },
    include: {
      forwarding: true,
      security: true,
      user: true,
      primaryPhoneNumber: true,
    },
  });
}

async function loadTargetExtensionByDid(prisma, tenantId, destination) {
  const { normalizePhoneNumber } = require('../phone');
  const normalized = normalizePhoneNumber(destination);
  if (!normalized || !tenantId) return null;

  const include = {
    forwarding: true,
    security: true,
    user: true,
    primaryPhoneNumber: true,
  };

  const byPrimary = await prisma.extension.findFirst({
    where: {
      tenantId,
      status: 'ACTIVE',
      primaryPhoneNumber: { number: normalized },
    },
    include,
  });
  if (byPrimary) return byPrimary;

  return prisma.extension.findFirst({
    where: {
      tenantId,
      status: 'ACTIVE',
      phoneNumbers: { some: { number: normalized, isActive: true } },
    },
    include,
  });
}

module.exports = {
  classifyDestinationKind,
  loadTargetExtensionBySipUsername,
  resolveExtensionNumberFromTo,
  resolveOutboundDestination,
  loadTargetExtension,
  loadTargetExtensionByDid,
};
