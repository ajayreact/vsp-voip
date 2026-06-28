const {
  DEFAULT_SIP_SERVER,
  DEFAULT_SIP_PORT,
  DEFAULT_SIP_PORT_TLS,
} = require('./telnyxSipProfile');

/** Telnyx-recommended codec order for SIP desk phones (G.722, G.711). */
const TELNYX_SIP_CODECS = Object.freeze([
  { id: 'g722', label: 'G722', enabled: true },
  { id: 'pcmu', label: 'G711u (PCMU)', enabled: true },
  { id: 'pcma', label: 'G711a (PCMA)', enabled: true },
]);

/** WebRTC / mobile preferred codecs (includes Opus). */
const TELNYX_WEBRTC_CODECS = Object.freeze([
  { id: 'opus', label: 'Opus', enabled: true },
  ...TELNYX_SIP_CODECS,
]);

const REGISTRATION_EXPIRY_SEC = 3600;

function buildTelnyxSipBlock(user, { includeSecrets = false, transport = 'TLS' } = {}) {
  const username = user?.telnyxSipUsername || null;
  const port = transport === 'UDP' || transport === 'TCP' ? DEFAULT_SIP_PORT : DEFAULT_SIP_PORT_TLS;
  const outboundProxy = `${DEFAULT_SIP_SERVER}:${port}`;

  return {
    username,
    password: includeSecrets ? (user?.telnyxSipPassword || null) : null,
    authId: username,
    server: DEFAULT_SIP_SERVER,
    port: DEFAULT_SIP_PORT,
    portTls: DEFAULT_SIP_PORT_TLS,
    transport,
    outboundProxy,
    sipUri: username ? `sip:${username}@${DEFAULT_SIP_SERVER}` : null,
    registrationExpirySec: REGISTRATION_EXPIRY_SEC,
    registrationIntervalSec: REGISTRATION_EXPIRY_SEC,
    symmetricRtp: true,
    srtp: 'Optional',
    codecs: TELNYX_SIP_CODECS.map((codec) => ({ ...codec })),
    dtmfMode: 'RFC2833',
    stunServer: 'stun.telnyx.com:3478',
    dnsSrvLookup: true,
  };
}

function buildEmployeeProvisioningProfile({
  tenant,
  extension,
  user,
  phoneNumber = null,
  telephony = null,
  includeSecrets = false,
}) {
  const sip = buildTelnyxSipBlock(user, { includeSecrets });

  return {
    v: 3,
    type: 'vsp-employee-provision',
    tenantId: tenant?.id || extension?.tenantId || null,
    tenantName: tenant?.name || null,
    employeeId: user?.id || null,
    employeeName: user?.name || extension?.displayName || null,
    employeeEmail: user?.email || extension?.email || null,
    extensionId: extension?.id || null,
    extensionNumber: extension?.extensionNumber || null,
    displayName: extension?.displayName || user?.name || null,
    assignedDid: phoneNumber?.number || null,
    sip,
    webrtc: telephony
      ? {
        loginToken: includeSecrets ? (telephony.loginToken || null) : null,
        sipUsername: telephony.sipUsername || user?.telnyxSipUsername || null,
        credentialId: telephony.credentialId || user?.telnyxCredentialId || null,
        expiresInSeconds: telephony.expiresInSeconds || null,
        codecs: TELNYX_WEBRTC_CODECS.map((codec) => ({ ...codec })),
      }
      : null,
    credentialConnectionId: telephony?.credentialConnectionId || null,
  };
}

function buildExtensionConfigExport(profile) {
  const sip = profile?.sip || {};
  return {
    format: 'vsp-extension-config',
    version: 3,
    exportedAt: new Date().toISOString(),
    tenant: {
      id: profile.tenantId,
      name: profile.tenantName,
    },
    employee: {
      id: profile.employeeId,
      name: profile.employeeName,
      email: profile.employeeEmail,
    },
    extension: {
      id: profile.extensionId,
      number: profile.extensionNumber,
      displayName: profile.displayName,
      assignedDid: profile.assignedDid,
    },
    sip: {
      server: sip.server,
      outboundProxy: sip.outboundProxy,
      username: sip.username,
      authId: sip.authId,
      password: sip.password,
      transport: sip.transport,
      port: sip.port,
      portTls: sip.portTls,
      registrationExpirySec: sip.registrationExpirySec,
      symmetricRtp: sip.symmetricRtp,
      srtp: sip.srtp,
      codecs: sip.codecs,
      dtmfMode: sip.dtmfMode,
    },
  };
}

function buildMobileQrPayload({
  apiUrl,
  token,
  expiresAt,
  tenant,
  extension,
  user,
}) {
  return {
    v: 3,
    type: 'vsp-voip-provision',
    target: 'mobile',
    apiUrl,
    token,
    expiresAt: expiresAt.toISOString(),
    tenantId: tenant.id,
    tenantName: tenant.name,
    employeeName: user?.name || extension.displayName,
    extensionId: extension.id,
    extensionNumber: extension.extensionNumber,
    displayName: extension.displayName,
  };
}

function buildDeskQrPayload({
  apiUrl,
  token,
  expiresAt,
  tenant,
  extension,
}) {
  return {
    v: 3,
    type: 'vsp-desk-provision',
    target: 'desk',
    apiUrl,
    token,
    expiresAt: expiresAt.toISOString(),
    tenantId: tenant.id,
    tenantName: tenant.name,
    extensionId: extension.id,
    extensionNumber: extension.extensionNumber,
    displayName: extension.displayName,
  };
}

module.exports = {
  TELNYX_SIP_CODECS,
  TELNYX_WEBRTC_CODECS,
  REGISTRATION_EXPIRY_SEC,
  buildTelnyxSipBlock,
  buildEmployeeProvisioningProfile,
  buildExtensionConfigExport,
  buildMobileQrPayload,
  buildDeskQrPayload,
};
