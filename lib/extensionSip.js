const crypto = require('crypto');
const {
  loadTelnyxConnectionContext,
  loadCredentialConnectionId,
  DEFAULT_SIP_SERVER,
  DEFAULT_SIP_PORT,
  DEFAULT_SIP_PORT_TLS,
  buildSipEndpointProfile,
} = require('./telnyxSipProfile');
const {
  getTelephonyCredential,
  createExtensionTelephonyCredential,
  deleteTelephonyCredential,
} = require('./telnyxCallControl');

function generateSipPassword() {
  return crypto.randomBytes(18).toString('base64url');
}

function extensionCredentialName(extension) {
  const tenantPrefix = String(extension.tenantId || '').slice(0, 8);
  const extNum = String(extension.extensionNumber || 'ext').replace(/\s+/g, '');
  return `vsp-ext-${tenantPrefix}-${extNum}`.slice(0, 64);
}

async function ensureExtensionTelnyxCredential(prisma, extension, { forceRecreate = false } = {}) {
  if (!extension?.id) return null;
  if (extension.sipEnabled === false) return extension;

  const connectionId = await loadCredentialConnectionId(prisma);
  if (!connectionId) {
    console.warn(`Extension ${extension.extensionNumber}: credential connection not configured — desk Telnyx credential skipped`);
    return extension;
  }

  let credentialId = extension.telnyxCredentialId;
  let sipUsername = extension.telnyxSipUsername;
  let sipPassword = extension.telnyxSipPassword;

  if (credentialId && !forceRecreate) {
    try {
      const existing = await getTelephonyCredential(credentialId);
      sipUsername = existing?.sip_username || sipUsername;
      sipPassword = existing?.sip_password || sipPassword;
    } catch {
      credentialId = null;
    }
  }

  if ((!credentialId || forceRecreate) && credentialId && forceRecreate) {
    try {
      await deleteTelephonyCredential(credentialId);
    } catch (error) {
      console.warn(`Could not delete old extension Telnyx credential ${credentialId}: ${error.message}`);
    }
  }

  if (!credentialId || forceRecreate) {
    const created = await createExtensionTelephonyCredential(connectionId, extensionCredentialName(extension));
    if (!created?.id) {
      throw Object.assign(new Error('Telnyx did not return an extension desk credential'), { status: 502 });
    }
    credentialId = created.id;
    sipUsername = created.sip_username || null;
    sipPassword = created.sip_password || null;
  }

  if (!credentialId || !sipUsername) return extension;

  const displayUsername = extension.sipUsername || extension.extensionNumber;

  return prisma.extension.update({
    where: { id: extension.id },
    data: {
      telnyxCredentialId: credentialId,
      telnyxSipUsername: sipUsername,
      telnyxSipPassword: sipPassword || null,
      sipUsername: displayUsername,
      sipEnabled: extension.sipEnabled !== false,
      ...(forceRecreate
        ? {
          sipRegistered: false,
          sipRegistrationCheckedAt: new Date(),
          sipRegistrationSource: 'credentials_reset',
        }
        : {}),
    },
  });
}

async function ensureExtensionSipCredentials(prisma, extension) {
  if (!extension) return null;

  const displayUsername = extension.sipUsername || extension.extensionNumber;

  if (!extension.sipUsername) {
    extension = await prisma.extension.update({
      where: { id: extension.id },
      data: {
        sipUsername: displayUsername,
        sipEnabled: extension.sipEnabled !== false,
      },
    });
  }

  if (extension.sipEnabled !== false) {
    try {
      extension = await ensureExtensionTelnyxCredential(prisma, extension);
    } catch (error) {
      console.warn(`Extension ${extension.extensionNumber}: Telnyx desk credential provisioning failed: ${error.message}`);
    }
  }

  return extension;
}

function buildExtensionSipProfile(extension, connectionContext = {}) {
  const authUsername = extension?.telnyxSipUsername
    || extension?.sipUsername
    || extension?.extensionNumber
    || null;
  const authPassword = extension?.telnyxSipPassword || extension?.sipPassword || null;

  return {
    sipUsername: authUsername,
    sipPassword: authPassword,
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
    credentialId: extension?.telnyxCredentialId || null,
    telnyxSipUsername: extension?.telnyxSipUsername || null,
    deskRegistered: Boolean(extension?.sipRegistered),
  };
}

function mergeSipProfiles(extensionProfile, telnyxProfile) {
  if (!telnyxProfile?.sipUsername) return extensionProfile;
  return {
    ...extensionProfile,
    telnyxSipUsername: telnyxProfile.sipUsername,
    telnyxSipPassword: telnyxProfile.sipPassword,
    credentialId: telnyxProfile.credentialId || null,
    loginToken: telnyxProfile.loginToken || null,
  };
}

module.exports = {
  generateSipPassword,
  ensureExtensionSipCredentials,
  ensureExtensionTelnyxCredential,
  buildExtensionSipProfile,
  mergeSipProfiles,
  buildSipEndpointProfile,
};
