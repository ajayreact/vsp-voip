const { loadPlatformSettings } = require('./platformSettings');
const { getCredentialConnectionId, getTelnyxConnectionConfig } = require('./telnyxConfig');

const DEFAULT_SIP_SERVER = process.env.TELNYX_SIP_SERVER?.trim() || 'sip.telnyx.com';
const DEFAULT_SIP_PORT = Number(process.env.TELNYX_SIP_PORT || 5060);
const DEFAULT_SIP_PORT_TLS = Number(process.env.TELNYX_SIP_PORT_TLS || 5061);

function credentialFieldsFromTelnyx(credential) {
  if (!credential) return {};
  return {
    telnyxCredentialId: credential.id || null,
    telnyxSipUsername: credential.sip_username || null,
    telnyxSipPassword: credential.sip_password || null,
  };
}

async function loadCredentialConnectionId(prisma) {
  const platform = await loadPlatformSettings(prisma);
  return getCredentialConnectionId(platform);
}

async function loadTelnyxConnectionContext(prisma) {
  const platform = await loadPlatformSettings(prisma);
  const voice = getTelnyxConnectionConfig(platform);
  return {
    platform,
    credentialConnectionId: getCredentialConnectionId(platform),
    credentialConnectionName: platform?.telnyxConnectionName || voice.connectionName || 'Credential Connection',
    voiceConnectionId: voice.connectionId || null,
    voiceConnectionName: voice.connectionName || null,
  };
}

function buildSipEndpointProfile(user, connectionContext = {}) {
  const username = user?.telnyxSipUsername || null;
  const password = user?.telnyxSipPassword || null;
  return {
    sipUsername: username,
    sipPassword: password,
    sipServer: DEFAULT_SIP_SERVER,
    sipPort: DEFAULT_SIP_PORT,
    sipPortTls: DEFAULT_SIP_PORT_TLS,
    sipTransport: 'UDP',
    sipUri: username ? `sip:${username}@${DEFAULT_SIP_SERVER}` : null,
    outboundProxy: `${DEFAULT_SIP_SERVER}:${DEFAULT_SIP_PORT}`,
    credentialConnectionId: connectionContext.credentialConnectionId || null,
    credentialConnectionName: connectionContext.credentialConnectionName || null,
    voiceConnectionId: connectionContext.voiceConnectionId || null,
    voiceConnectionName: connectionContext.voiceConnectionName || null,
    credentialId: user?.telnyxCredentialId || null,
  };
}

module.exports = {
  DEFAULT_SIP_SERVER,
  DEFAULT_SIP_PORT,
  DEFAULT_SIP_PORT_TLS,
  credentialFieldsFromTelnyx,
  loadCredentialConnectionId,
  loadTelnyxConnectionContext,
  buildSipEndpointProfile,
};
