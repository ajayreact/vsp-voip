const {
  loadTelnyxConnectionContext,
  credentialFieldsFromTelnyx,
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
const {
  createExtensionTelephonyCredential,
  getTelephonyCredential,
  deleteTelephonyCredential,
} = require('./telnyxCallControl');
const { isDedicatedDeskCredentialPilotTenant } = require('./telephony/deskDedicatedCredentialPilot');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

/**
 * Symplore pilot only (see lib/telephony/deskDedicatedCredentialPilot.js): gives the
 * desk phone its own Telnyx credential instead of sharing the employee's app
 * credential, so the desk phone and the mobile/softphone app no longer contend for
 * a single Telnyx registration slot. No-op for every other tenant.
 */
async function ensureDedicatedDeskTelnyxCredential(prisma, extension, { forceRecreate = false } = {}) {
  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('TELNYX_API_KEY is not configured'), { status: 500 });
  }

  const connectionContext = await loadTelnyxConnectionContext(prisma);
  const connectionId = connectionContext.credentialConnectionId;
  if (!connectionId) {
    throw Object.assign(new Error('Credential connection is not configured'), { status: 503 });
  }

  let current = extension;

  if (forceRecreate && current.telnyxCredentialId) {
    try {
      await deleteTelephonyCredential(current.telnyxCredentialId);
    } catch (error) {
      console.warn(`Could not delete desk Telnyx credential ${current.telnyxCredentialId}: ${error.message}`);
    }
    current = await prisma.extension.update({
      where: { id: current.id },
      data: { telnyxCredentialId: null, telnyxSipUsername: null, telnyxSipPassword: null },
    });
  }

  let credentialId = current.telnyxCredentialId;
  let sipUsername = current.telnyxSipUsername;

  if (credentialId) {
    try {
      const existing = await getTelephonyCredential(credentialId);
      sipUsername = existing?.sip_username || sipUsername;
    } catch {
      credentialId = null;
    }
  }

  if (!credentialId) {
    const created = await createExtensionTelephonyCredential(
      connectionId,
      `vsp-desk-${String(current.tenantId).slice(0, 8)}-${current.extensionNumber}`,
    );
    credentialId = created?.id;
    sipUsername = created?.sip_username || sipUsername;
    current = await prisma.extension.update({
      where: { id: current.id },
      data: credentialFieldsFromTelnyx(created),
    });
  }

  if (!credentialId) {
    throw Object.assign(new Error('Telnyx did not return a desk telephony credential'), { status: 502 });
  }

  return prisma.extension.findFirst({ where: { id: current.id }, include: { user: true } });
}

async function ensureExtensionTelnyxCredential(prisma, extension, options = {}) {
  if (extension?.tenantId && isDedicatedDeskCredentialPilotTenant(extension.tenantId)) {
    return ensureDedicatedDeskTelnyxCredential(prisma, extension, options);
  }
  // Phase 2.4a: extension rows no longer receive separate Telnyx telephony credentials.
  // Desk phones and mobile apps share the assigned employee credential on the Credential Connection.
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

  return ensureExtensionTelnyxCredential(prisma, ext);
}

function buildExtensionSipProfile(extension, connectionContext = {}, user = null) {
  // Symplore pilot: a dedicated desk credential on the extension row takes priority
  // over the employee's shared app credential (see ensureDedicatedDeskTelnyxCredential
  // above). Absent that, every other tenant falls through to the Phase 2.4a behavior.
  if (extension?.telnyxSipUsername) {
    const endpoint = buildSipEndpointProfile(extension, connectionContext);
    return {
      ...endpoint,
      extensionNumber: extension?.extensionNumber || null,
      displayName: extension?.displayName || null,
      telnyxSipUsername: endpoint.sipUsername,
      deskRegistered: Boolean(extension?.sipRegistered),
      webrtcRegistered: false,
    };
  }

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
