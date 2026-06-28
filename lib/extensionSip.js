const {
  loadTelnyxConnectionContext,
  DEFAULT_SIP_SERVER,
  DEFAULT_SIP_PORT,
  DEFAULT_SIP_PORT_TLS,
  buildSipEndpointProfile,
} = require('./telnyxSipProfile');
const {
  ensureEmployeeTelephonyForExtension,
  loadEmployeeForExtension,
  buildEmployeeExtensionSipProfile,
} = require('./employeeTelephony');

/**
 * Phase 2.4a: extension rows no longer receive separate Telnyx telephony credentials.
 * Desk phones and mobile apps share the assigned employee credential on the Credential Connection.
 */
async function ensureExtensionTelnyxCredential(prisma, extension, options = {}) {
  return ensureEmployeeTelephonyForExtension(prisma, extension, options);
}

async function ensureExtensionSipCredentials(prisma, extension) {
  if (!extension) return null;

  let ext = extension;
  if (!ext.user && ext.userId) {
    ext = await prisma.extension.findFirst({
      where: { id: ext.id },
      include: { user: true },
    });
  }

  return ensureEmployeeTelephonyForExtension(prisma, ext);
}

function buildExtensionSipProfile(extension, connectionContext = {}, user = null) {
  const employee = user || extension?.user || null;
  if (employee?.telnyxSipUsername) {
    return buildEmployeeExtensionSipProfile(extension, employee, connectionContext);
  }

  const authUsername = extension?.sipUsername || extension?.extensionNumber || null;
  return {
    sipUsername: authUsername,
    sipPassword: null,
    extensionNumber: extension?.extensionNumber || null,
    displayName: extension?.displayName || null,
    sipServer: DEFAULT_SIP_SERVER,
    sipPort: DEFAULT_SIP_PORT,
    sipPortTls: DEFAULT_SIP_PORT_TLS,
    sipTransport: 'UDP',
    sipUri: authUsername ? `sip:${authUsername}@${DEFAULT_SIP_SERVER}` : null,
    outboundProxy: `${DEFAULT_SIP_SERVER}:${DEFAULT_SIP_PORT}`,
    credentialConnectionId: connectionContext.credentialConnectionId || null,
    credentialConnectionName: connectionContext.credentialConnectionName || null,
    voiceConnectionId: connectionContext.voiceConnectionId || null,
    voiceConnectionName: connectionContext.voiceConnectionName || null,
    credentialId: null,
    telnyxSipUsername: null,
    deskRegistered: false,
  };
}

async function buildExtensionSipProfileWithEmployee(prisma, extension, connectionContext = {}) {
  const employee = await loadEmployeeForExtension(prisma, extension);
  return buildExtensionSipProfile(extension, connectionContext, employee);
}

function mergeSipProfiles(extensionProfile, telnyxProfile) {
  if (!telnyxProfile?.sipUsername) return extensionProfile;
  return {
    ...extensionProfile,
    telnyxSipUsername: telnyxProfile.sipUsername,
    telnyxSipPassword: telnyxProfile.sipPassword,
    sipUsername: telnyxProfile.sipUsername,
    sipPassword: telnyxProfile.sipPassword,
    credentialId: telnyxProfile.credentialId || null,
    loginToken: telnyxProfile.loginToken || null,
  };
}

module.exports = {
  ensureExtensionSipCredentials,
  ensureExtensionTelnyxCredential,
  buildExtensionSipProfile,
  buildExtensionSipProfileWithEmployee,
  mergeSipProfiles,
  buildSipEndpointProfile,
};
