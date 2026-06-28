const { loadCredentialConnectionId, buildSipEndpointProfile } = require('./telnyxSipProfile');
const {
  getOrCreateUserTelephonyCredential,
  resetUserTelephonyCredential,
} = require('./softphone');

/**
 * Phase 2.4a: one Telnyx telephony credential per employee (User).
 * Mobile WebRTC and desk phones register the same SIP identity on the Credential Connection.
 */
async function ensureEmployeeTelephonyForExtension(prisma, extension, { forceRecreate = false } = {}) {
  if (!extension?.id) return null;

  const displayUsername = extension.sipUsername || extension.extensionNumber;
  let ext = extension;

  if (!extension.sipUsername) {
    ext = await prisma.extension.update({
      where: { id: extension.id },
      data: {
        sipUsername: displayUsername,
        sipEnabled: extension.sipEnabled !== false,
      },
    });
  }

  const userId = extension.userId;
  if (!userId) {
    return ext;
  }

  const connectionId = await loadCredentialConnectionId(prisma);
  if (!connectionId) {
    return ext;
  }

  if (forceRecreate) {
    await resetUserTelephonyCredential({
      prisma,
      userId,
      tenantId: extension.tenantId,
      connectionId,
    });
  } else {
    await getOrCreateUserTelephonyCredential({
      prisma,
      userId,
      tenantId: extension.tenantId,
      connectionId,
    });
  }

  return ext;
}

async function loadEmployeeForExtension(prisma, extension) {
  if (!extension?.userId) return extension?.user || null;
  if (extension.user?.id === extension.userId) return extension.user;
  return prisma.user.findFirst({
    where: { id: extension.userId, tenantId: extension.tenantId },
  });
}

function buildEmployeeExtensionSipProfile(extension, user, connectionContext = {}) {
  const endpoint = buildSipEndpointProfile(user, connectionContext);
  return {
    ...endpoint,
    extensionNumber: extension?.extensionNumber || null,
    displayName: extension?.displayName || user?.name || null,
    telnyxSipUsername: endpoint.sipUsername,
    deskRegistered: Boolean(user?.sipRegistered),
    webrtcRegistered: Boolean(user?.sipRegistered),
  };
}

module.exports = {
  ensureEmployeeTelephonyForExtension,
  loadEmployeeForExtension,
  buildEmployeeExtensionSipProfile,
};
