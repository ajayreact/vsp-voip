const crypto = require('crypto');
const { signToken } = require('./auth');
const { getOrCreateUserTelephonyCredential } = require('./softphone');
const { registerUserDevice } = require('./userDevices');
const { writeExtensionAuditLog } = require('./extensionSecurity');
const { loadExtensionPhoneNumber } = require('./extensionOwnership');
const {
  loadCredentialConnectionId,
  loadTelnyxConnectionContext,
} = require('./telnyxSipProfile');
const {
  ensureExtensionSipCredentials,
  buildExtensionSipProfile,
} = require('./extensionSip');

const TOKEN_TTL_MS = 15 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function generatePlainToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function resolvePublicApiUrl() {
  return (
    process.env.PUBLIC_API_URL
    || process.env.NEXT_PUBLIC_API_URL
    || process.env.API_BASE_URL
    || 'http://localhost:3000'
  ).replace(/\/$/, '');
}

async function getExtensionSipCredentials(prisma, tenantId, extensionId) {
  let extension = await prisma.extension.findFirst({
    where: { id: extensionId, tenantId },
    include: { user: true },
  });
  if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });

  extension = await ensureExtensionSipCredentials(prisma, extension);
  const connectionContext = await loadTelnyxConnectionContext(prisma);
  const sipProfile = buildExtensionSipProfile(extension, connectionContext);

  let loginToken = null;
  let telnyxUsername = null;
  const user = extension.user;

  if (extension.userId && user && connectionContext.credentialConnectionId) {
    try {
      const telephony = await getOrCreateUserTelephonyCredential({
        prisma,
        userId: extension.userId,
        tenantId,
        connectionId: connectionContext.credentialConnectionId,
      });
      loginToken = telephony.loginToken;
      telnyxUsername = telephony.sipUsername;
    } catch (error) {
      console.warn(`Telnyx credential lookup failed for extension ${extension.extensionNumber}: ${error.message}`);
    }
  }

  return {
    ...sipProfile,
    telnyxSipUsername: telnyxUsername,
    loginToken,
    webrtcEnabled: extension.webrtcEnabled,
    sipEnabled: extension.sipEnabled,
    employeeName: user?.name || extension.displayName,
    employeeEmail: user?.email || extension.email,
    extensionNumber: extension.extensionNumber,
    displayName: extension.displayName,
  };
}

async function createExtensionProvisioningToken(prisma, tenantId, extensionId, options = {}, actor = {}) {
  const target = String(options.target || 'mobile').toLowerCase();
  const extension = await prisma.extension.findFirst({
    where: { id: extensionId, tenantId },
    include: { user: true },
  });
  if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });

  const apiUrl = resolvePublicApiUrl();

  if (target === 'sip_phone') {
    const sip = await getExtensionSipCredentials(prisma, tenantId, extensionId);
    const qrPayload = {
      v: 2,
      type: 'vsp-sip-provision',
      extensionId: extension.id,
      extensionNumber: extension.extensionNumber,
      displayName: extension.displayName,
      sip: {
        username: sip.sipUsername,
        password: sip.sipPassword,
        authId: sip.sipUsername,
        server: sip.sipServer,
        port: sip.sipPort,
        portTls: sip.sipPortTls,
        transport: sip.sipTransport,
        outboundProxy: sip.outboundProxy,
      },
      telnyxCredentialId: sip.credentialId,
      credentialConnectionId: sip.credentialConnectionId,
      credentialConnectionName: sip.credentialConnectionName,
    };

    await writeExtensionAuditLog(prisma, {
      tenantId,
      extensionId,
      userId: actor.userId,
      userEmail: actor.userEmail,
      category: 'provisioning',
      action: 'provisioning.sip_qr_created',
      summary: `SIP phone QR generated for extension ${extension.extensionNumber}`,
    });

    return {
      target: 'sip_phone',
      expiresAt: null,
      expiresInSeconds: null,
      token: null,
      qrPayload,
      qrPayloadJson: JSON.stringify(qrPayload),
    };
  }

  if (!extension.userId) {
    throw Object.assign(new Error('Assign an employee to this extension before generating a mobile QR code'), { status: 400 });
  }

  await prisma.extensionProvisioningToken.deleteMany({
    where: {
      extensionId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  const plainToken = generatePlainToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.extensionProvisioningToken.create({
    data: {
      tenantId,
      extensionId,
      tokenHash: hashToken(plainToken),
      expiresAt,
      createdByUserId: actor.userId || null,
    },
  });

  const qrPayload = {
    v: 1,
    type: 'vsp-voip-provision',
    target: 'mobile',
    apiUrl,
    token: plainToken,
    extensionId: extension.id,
    extensionNumber: extension.extensionNumber,
    displayName: extension.displayName,
  };

  await writeExtensionAuditLog(prisma, {
    tenantId,
    extensionId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    category: 'provisioning',
    action: 'provisioning.mobile_qr_created',
    summary: `Mobile QR provisioning token for extension ${extension.extensionNumber}`,
    changes: { expiresAt: expiresAt.toISOString() },
  });

  return {
    target: 'mobile',
    token: plainToken,
    expiresAt: expiresAt.toISOString(),
    expiresInSeconds: Math.floor(TOKEN_TTL_MS / 1000),
    qrPayload,
    qrPayloadJson: JSON.stringify(qrPayload),
  };
}

async function redeemProvisioningToken(prisma, body = {}) {
  const plainToken = String(body.token || '').trim();
  if (!plainToken) {
    throw Object.assign(new Error('token is required'), { status: 400 });
  }

  const record = await prisma.extensionProvisioningToken.findUnique({
    where: { tokenHash: hashToken(plainToken) },
    include: {
      extension: {
        include: {
          user: { include: { tenant: true } },
          voicemailSettings: true,
        },
      },
      tenant: true,
    },
  });

  if (!record) {
    throw Object.assign(new Error('Invalid provisioning token'), { status: 400 });
  }
  if (record.usedAt) {
    throw Object.assign(new Error('Provisioning token has already been used'), { status: 400 });
  }
  if (record.expiresAt < new Date()) {
    throw Object.assign(new Error('Provisioning token has expired'), { status: 400 });
  }

  const extension = record.extension;
  const user = extension.user;
  if (!user) {
    throw Object.assign(new Error('Extension has no assigned employee'), { status: 400 });
  }
  if (user.tenant && user.tenant.isActive === false) {
    throw Object.assign(new Error('Organization account is suspended'), { status: 403 });
  }

  await prisma.extensionProvisioningToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  const deviceId = body.deviceId ? String(body.deviceId).trim() : null;
  const platform = body.platform ? String(body.platform).trim().toLowerCase() : null;
  const pushToken = body.pushToken ? String(body.pushToken).trim() : 'qr-provisioned';

  if (deviceId && ['android', 'ios', 'mobile'].includes(platform)) {
    const normalizedPlatform = platform === 'mobile' ? 'android' : platform;
    await registerUserDevice(prisma, {
      userId: user.id,
      deviceId,
      platform: normalizedPlatform,
      pushToken,
      deviceName: body.deviceName ? String(body.deviceName).trim() : null,
      appVersion: body.appVersion ? String(body.appVersion).trim() : null,
    });
  }

  await prisma.extension.update({
    where: { id: extension.id },
    data: { lastActivityAt: new Date() },
  });

  const connectionId = await loadCredentialConnectionId(prisma);
  let telephony = null;
  let sipProfile = null;
  if (connectionId) {
    telephony = await getOrCreateUserTelephonyCredential({
      prisma,
      userId: user.id,
      tenantId: record.tenantId,
      connectionId,
    });
    const refreshedUser = await prisma.user.findUnique({ where: { id: user.id } });
    const connectionContext = await loadTelnyxConnectionContext(prisma);
    const refreshedExtension = await ensureExtensionSipCredentials(prisma, extension);
    sipProfile = buildExtensionSipProfile(refreshedExtension, connectionContext);
  }

  const phoneNumber = await loadExtensionPhoneNumber(prisma, extension.id);
  const accessToken = signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
  });

  await writeExtensionAuditLog(prisma, {
    tenantId: record.tenantId,
    extensionId: extension.id,
    userId: user.id,
    userEmail: user.email,
    category: 'provisioning',
    action: 'provisioning.token_redeemed',
    summary: `Extension ${extension.extensionNumber} provisioned via mobile QR`,
    changes: { deviceId, platform },
  });

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name ?? null,
    },
    extension: {
      id: extension.id,
      extensionNumber: extension.extensionNumber,
      displayName: extension.displayName,
      department: extension.department,
      voicemailEnabled: extension.voicemailEnabled,
      webrtcEnabled: extension.webrtcEnabled,
      sipEnabled: extension.sipEnabled,
      assignedDid: phoneNumber
        ? { id: phoneNumber.id, number: phoneNumber.number, label: phoneNumber.label }
        : null,
    },
    telephony: telephony
      ? {
        loginToken: telephony.loginToken,
        sipUsername: telephony.sipUsername,
        credentialId: telephony.credentialId,
        expiresInSeconds: telephony.expiresInSeconds,
        sip: sipProfile,
      }
      : null,
  };
}

module.exports = {
  createExtensionProvisioningToken,
  getExtensionSipCredentials,
  redeemProvisioningToken,
  TOKEN_TTL_MS,
};
