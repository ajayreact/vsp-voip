const {
  isPstnDestination,
  parseInternalExtensionDestination,
} = require('./PayloadNormalizer');

/**
 * Classify destination type from raw Telnyx `to` field (pure — no DB).
 * @returns {{ kind: 'EXTENSION'|'PSTN'|'UNKNOWN', extensionNumber?: string, pstnNumber?: string }}
 */
function classifyDestinationKind(to) {
  const extensionNumber = parseInternalExtensionDestination(to);
  if (extensionNumber) {
    return { kind: 'EXTENSION', extensionNumber };
  }
  if (isPstnDestination(to)) {
    return { kind: 'PSTN', pstnNumber: String(to || '').trim() };
  }
  return { kind: 'UNKNOWN' };
}

/**
 * Resolve outbound destination for desk router (classification only — no dialing).
 * @param {object} payload Telnyx webhook payload
 * @param {{ tenantId?: string|null }|null} caller Resolved caller, if available
 */
function resolveOutboundDestination(payload, caller) {
  const classified = classifyDestinationKind(payload?.to);
  const tenantId = caller?.tenantId ?? null;

  if (classified.kind === 'PSTN') {
    return {
      kind: 'PSTN',
      pstnNumber: classified.pstnNumber,
      tenantId,
    };
  }
  if (classified.kind === 'EXTENSION') {
    return {
      kind: 'EXTENSION',
      extensionNumber: classified.extensionNumber,
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
  resolveOutboundDestination,
  loadTargetExtension,
  loadTargetExtensionByDid,
};
