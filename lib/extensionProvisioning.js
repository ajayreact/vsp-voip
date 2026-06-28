const crypto = require('crypto');
const { signToken } = require('./auth');
const { issueRefreshToken } = require('./refreshTokens');
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
const { loadEmployeeForExtension } = require('./employeeTelephony');
const {
  buildEmployeeProvisioningProfile,
  buildExtensionConfigExport,
  buildMobileQrPayload,
  buildDeskQrPayload,
} = require('./employeeProvisioningProfile');

const TOKEN_TTL_MS = Number(process.env.PROVISIONING_TOKEN_TTL_MS || 15 * 60 * 1000);

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

async function loadExtensionWithTenant(prisma, tenantId, extensionId) {
  const extension = await prisma.extension.findFirst({
    where: { id: extensionId, tenantId },
    include: {
      user: { include: { tenant: true } },
    },
  });
  if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });
  return extension;
}

async function getExtensionSipCredentials(prisma, tenantId, extensionId) {
  const extension = await loadExtensionWithTenant(prisma, tenantId, extensionId);
  await ensureExtensionSipCredentials(prisma, extension);

  const connectionContext = await loadTelnyxConnectionContext(prisma);
  const employee = await loadEmployeeForExtension(prisma, extension);
  const phoneNumber = await loadExtensionPhoneNumber(prisma, extension.id);
  const tenant = extension.user?.tenant
    || await prisma.tenant.findUnique({ where: { id: tenantId } });

  let loginToken = null;
  let telnyxUsername = employee?.telnyxSipUsername || null;
  let telephonyMeta = null;

  if (extension.userId && employee && connectionContext.credentialConnectionId) {
    try {
      const telephony = await getOrCreateUserTelephonyCredential({
        prisma,
        userId: extension.userId,
        tenantId,
        connectionId: connectionContext.credentialConnectionId,
      });
      loginToken = telephony.loginToken;
      telnyxUsername = telephony.sipUsername;
      telephonyMeta = {
        ...telephony,
        credentialConnectionId: connectionContext.credentialConnectionId,
      };
    } catch (error) {
      console.warn(`Telnyx credential lookup failed for extension ${extension.extensionNumber}: ${error.message}`);
    }
  }

  const refreshedUser = employee?.id
    ? await prisma.user.findUnique({ where: { id: employee.id } })
    : employee;

  const provisioningProfile = buildEmployeeProvisioningProfile({
    tenant,
    extension,
    user: refreshedUser,
    phoneNumber,
    telephony: telephonyMeta,
    includeSecrets: true,
  });

  const sipProfile = buildExtensionSipProfile(extension, connectionContext, refreshedUser);

  return {
    ...sipProfile,
    ...provisioningProfile.sip,
    sipUsername: telnyxUsername || sipProfile.sipUsername,
    sipPassword: refreshedUser?.telnyxSipPassword || sipProfile.sipPassword,
    telnyxSipUsername: telnyxUsername,
    loginToken,
    webrtcEnabled: extension.webrtcEnabled,
    sipEnabled: extension.sipEnabled,
    employeeName: refreshedUser?.name || extension.displayName,
    employeeEmail: refreshedUser?.email || extension.email,
    extensionNumber: extension.extensionNumber,
    displayName: extension.displayName,
    tenantId: tenant?.id || tenantId,
    tenantName: tenant?.name || null,
    assignedDid: phoneNumber?.number || null,
    registrationExpirySec: provisioningProfile.sip.registrationExpirySec,
    symmetricRtp: provisioningProfile.sip.symmetricRtp,
    srtp: provisioningProfile.sip.srtp,
    codecs: provisioningProfile.sip.codecs,
    dtmfMode: provisioningProfile.sip.dtmfMode,
    provisioningProfile,
    configExport: buildExtensionConfigExport(provisioningProfile),
  };
}

async function createProvisioningTokenRecord(prisma, {
  tenantId,
  extensionId,
  purpose,
  actorUserId,
}) {
  await prisma.extensionProvisioningToken.deleteMany({
    where: {
      extensionId,
      purpose,
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
      purpose,
      tokenHash: hashToken(plainToken),
      expiresAt,
      createdByUserId: actorUserId || null,
    },
  });

  return { plainToken, expiresAt };
}

async function createExtensionProvisioningToken(prisma, tenantId, extensionId, options = {}, actor = {}) {
  const target = String(options.target || 'mobile').toLowerCase();
  const extension = await loadExtensionWithTenant(prisma, tenantId, extensionId);
  const apiUrl = resolvePublicApiUrl();
  const tenant = extension.user?.tenant
    || await prisma.tenant.findUnique({ where: { id: tenantId } });

  if (target === 'sip_phone' || target === 'desk') {
    if (!extension.userId) {
      throw Object.assign(
        new Error('Assign an employee to this extension before generating a desk provisioning QR'),
        { status: 400 },
      );
    }

    const { plainToken, expiresAt } = await createProvisioningTokenRecord(prisma, {
      tenantId,
      extensionId,
      purpose: 'desk',
      actorUserId: actor.userId,
    });

    const qrPayload = buildDeskQrPayload({
      apiUrl,
      token: plainToken,
      expiresAt,
      tenant,
      extension,
    });

    await writeExtensionAuditLog(prisma, {
      tenantId,
      extensionId,
      userId: actor.userId,
      userEmail: actor.userEmail,
      category: 'provisioning',
      action: 'provisioning.desk_qr_created',
      summary: `Desk provisioning QR for extension ${extension.extensionNumber}`,
      changes: { expiresAt: expiresAt.toISOString() },
    });

    return {
      target: 'sip_phone',
      token: null,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: Math.floor(TOKEN_TTL_MS / 1000),
      qrPayload,
      qrPayloadJson: JSON.stringify(qrPayload),
    };
  }

  if (!extension.userId) {
    throw Object.assign(
      new Error('Assign an employee to this extension before generating a mobile QR code'),
      { status: 400 },
    );
  }

  const { plainToken, expiresAt } = await createProvisioningTokenRecord(prisma, {
    tenantId,
    extensionId,
    purpose: 'mobile',
    actorUserId: actor.userId,
  });

  const qrPayload = buildMobileQrPayload({
    apiUrl,
    token: plainToken,
    expiresAt,
    tenant,
    extension,
    user: extension.user,
  });

  await writeExtensionAuditLog(prisma, {
    tenantId,
    extensionId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    category: 'provisioning',
    action: 'provisioning.mobile_qr_created',
    summary: `Mobile provisioning QR for extension ${extension.extensionNumber}`,
    changes: { expiresAt: expiresAt.toISOString() },
  });

  return {
    target: 'mobile',
    token: null,
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

  const connectionId = await loadCredentialConnectionId(prisma);
  let telephony = null;
  if (connectionId) {
    telephony = await getOrCreateUserTelephonyCredential({
      prisma,
      userId: user.id,
      tenantId: record.tenantId,
      connectionId,
    });
  }

  const refreshedUser = await prisma.user.findUnique({ where: { id: user.id } });
  const phoneNumber = await loadExtensionPhoneNumber(prisma, extension.id);
  const connectionContext = await loadTelnyxConnectionContext(prisma);
  await ensureExtensionSipCredentials(prisma, extension);

  const provisioningProfile = buildEmployeeProvisioningProfile({
    tenant: record.tenant || user.tenant,
    extension,
    user: refreshedUser,
    phoneNumber,
    telephony: telephony
      ? { ...telephony, credentialConnectionId: connectionContext.credentialConnectionId }
      : null,
    includeSecrets: true,
  });

  const sipProfile = buildExtensionSipProfile(extension, connectionContext, refreshedUser);

  if (record.purpose === 'desk') {
    await writeExtensionAuditLog(prisma, {
      tenantId: record.tenantId,
      extensionId: extension.id,
      userId: null,
      userEmail: null,
      category: 'provisioning',
      action: 'provisioning.desk_token_redeemed',
      summary: `Desk provisioning profile retrieved for extension ${extension.extensionNumber}`,
    });

    return {
      purpose: 'desk',
      provisioningProfile,
      sip: provisioningProfile.sip,
      configExport: buildExtensionConfigExport(provisioningProfile),
    };
  }

  const deviceId = body.deviceId ? String(body.deviceId).trim() : null;
  const platformRaw = body.platform ? String(body.platform).trim().toLowerCase() : null;
  const pushToken = body.pushToken ? String(body.pushToken).trim() : null;
  const normalizedPlatform = platformRaw === 'ios'
    ? 'ios'
    : (platformRaw === 'android' || platformRaw === 'mobile' ? 'android' : null);

  if (deviceId && normalizedPlatform && pushToken) {
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

  const accessToken = signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
  });
  const refreshToken = await issueRefreshToken(user.id);

  await writeExtensionAuditLog(prisma, {
    tenantId: record.tenantId,
    extensionId: extension.id,
    userId: user.id,
    userEmail: user.email,
    category: 'provisioning',
    action: 'provisioning.token_redeemed',
    summary: `Extension ${extension.extensionNumber} provisioned via mobile QR`,
    changes: { deviceId, platform: normalizedPlatform },
  });

  return {
    purpose: 'mobile',
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name ?? record.tenant?.name ?? null,
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
    provisioningProfile,
    configExport: buildExtensionConfigExport(provisioningProfile),
  };
}

module.exports = {
  createExtensionProvisioningToken,
  getExtensionSipCredentials,
  redeemProvisioningToken,
  TOKEN_TTL_MS,
};
