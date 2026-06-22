const { getPrisma } = require('../db');
const { loadCredentialConnectionId, credentialFieldsFromTelnyx } = require('./telnyxSipProfile');
const {
  createTelephonyCredential,
  createTelephonyCredentialToken,
  getTelephonyCredential,
} = require('./telnyxCallControl');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

async function getOrCreateUserTelephonyCredential({ prisma, userId, tenantId, connectionId }) {
  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('TELNYX_API_KEY is not configured'), { status: 500 });
  }
  if (!connectionId) {
    throw Object.assign(
      new Error('WebRTC credential connection is not configured. Set TELNYX_CREDENTIAL_CONNECTION_ID or add it in Admin → Platform settings.'),
      { status: 503 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.tenantId !== tenantId) {
    throw Object.assign(new Error('User not found in this organization'), { status: 403 });
  }

  let credentialId = user.telnyxCredentialId;
  let sipUsername = user.telnyxSipUsername;

  if (credentialId) {
    try {
      const existing = await getTelephonyCredential(credentialId);
      sipUsername = existing?.sip_username || sipUsername;
    } catch {
      credentialId = null;
    }
  }

  if (!credentialId) {
    const created = await createTelephonyCredential(
      connectionId,
      `vsp-${tenantId.slice(0, 8)}-${userId.slice(0, 8)}`,
    );
    credentialId = created?.id;
    sipUsername = created?.sip_username || sipUsername;
    await prisma.user.update({
      where: { id: userId },
      data: credentialFieldsFromTelnyx(created),
    });
  }

  if (!credentialId) {
    throw Object.assign(new Error('Telnyx did not return a telephony credential'), { status: 502 });
  }

  if (!sipUsername) {
    const detail = await getTelephonyCredential(credentialId);
    sipUsername = detail?.sip_username || null;
    if (detail?.sip_password) {
      await prisma.user.update({
        where: { id: userId },
        data: { telnyxSipPassword: detail.sip_password },
      });
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      telnyxCredentialId: credentialId,
      telnyxSipUsername: sipUsername,
      softphoneOnlineAt: new Date(),
    },
  });

  const loginToken = await createTelephonyCredentialToken(credentialId);

  return {
    loginToken,
    credentialId,
    sipUsername,
    expiresInSeconds: 24 * 60 * 60,
  };
}

async function createSoftphoneLoginToken({ prisma, userId, tenantId, connectionId }) {
  return getOrCreateUserTelephonyCredential({
    prisma,
    userId,
    tenantId,
    connectionId,
  });
}

async function setSoftphonePresence({ prisma, userId, tenantId, online }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.tenantId !== tenantId) {
    throw Object.assign(new Error('User not found in this organization'), { status: 403 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      softphoneOnlineAt: online ? new Date() : null,
      sipRegistered: Boolean(online),
      sipRegistrationCheckedAt: new Date(),
      sipRegistrationResponse: online ? 'softphone heartbeat' : 'offline',
      sipRegistrationSource: online ? 'portal_presence' : null,
    },
  });

  return { online: Boolean(online) };
}

const { getCredentialConnectionId } = require('./telnyxConfig');

module.exports = {
  getCredentialConnectionId,
  loadCredentialConnectionId,
  createSoftphoneLoginToken,
  getOrCreateUserTelephonyCredential,
  setSoftphonePresence,
};
