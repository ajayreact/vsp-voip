const express = require('express');
const fs = require('fs');
const path = require('path');
const { getPrisma } = require('../db');
const { buyAndAssignNumber } = require('../lib/buyNumber');
const {
  getBillingConfig,
  calculateCartPricing,
  createCheckoutSession,
  createManualOrder,
  getOrderWithInvoice,
  completeCheckoutSession,
  serializeOrder,
  getTenantSubscriptionSummary,
  createBillingPortalSession,
  uploadOrderPaymentProof,
} = require('../lib/billing');
const {
  signToken,
  hashPassword,
  comparePassword,
  authMiddleware,
  requireRole,
} = require('../lib/auth');
const { resolveGreetingMessage } = require('../lib/greeting');
const { defaultBusinessHours } = require('../lib/businessHours');
const { mapCallRoutingResponse, normalizeIvrOptions } = require('../lib/callRouting');
const { normalizeRingGroupMembers, normalizeRingStrategy, clampRingTimeout } = require('../lib/ringGroup');
const { normalizePhoneNumber } = require('../lib/phone');
const {
  formatCallDuration,
  classifyCallType,
  normalizeSoftphoneLogStatus,
  callTypeDisplayLabel,
} = require('../lib/callLogMeta');
const {
  normalizeRoutingType,
  serializeOwnedNumber,
  ROUTING_TYPES,
} = require('../lib/numberRouting');
const { clampVoicemailMaxLength, mapVoicemailRecord } = require('../lib/voicemail');
const { mapCallRecording } = require('../lib/callRecording');
const {
  buildConversations,
  getMessagingProfileId,
  getSmsWebhookUrl,
  isSmsWebhookReachable,
  mapSmsMessage,
  sendSmsMessage,
  syncSmsMessageStatuses,
} = require('../lib/sms');
const { getMessagingSetupStatus } = require('../lib/telnyxMessagingSetup');
const { assertTenantActive } = require('../lib/tenantGuard');
const { loadPlatformSettings } = require('../lib/platformSettings');
const { getTelnyxConnectionConfig } = require('../lib/telnyxConfig');
const { createSoftphoneLoginToken, getOrCreateUserTelephonyCredential, setSoftphonePresence, loadCredentialConnectionId } = require('../lib/softphone');
const { markAgentWebRtcAccepted } = require('../lib/inboundCallControl');
const {
  registerUserDevice,
  listUserDevices,
  removeUserDevice,
  countUserDevices,
} = require('../lib/userDevices');
const { getCallControlSetupStatus, ensureTelnyxCallControlSetup } = require('../lib/telnyxCallControlSetup');
const { startOutboundCallRecording } = require('../lib/outboundRecording');
const { syncCallRecordingsFromTelnyx, refreshCallRecordingUrls, streamTelnyxRecording } = require('../lib/recordingSync');
const { recordTelemetryEvent } = require('../lib/telephonyHealth');
const { getRecordingSetupStatus, ensureTelnyxRecordingSetup } = require('../lib/telnyxRecordingSetup');
const { resolveSoftphoneInboundRoutingDiagnostics } = require('../lib/softphoneInboundDiagnostics');
const { getCredentialConnectionPushStatus } = require('../lib/telnyxPushSetup');
const { redeemProvisioningToken } = require('../lib/extensionProvisioning');
const { loginLimiter, searchLimiter, billingLimiter } = require('../lib/rateLimit');
const { sendPasswordResetEmail } = require('../lib/transactionalEmail');
const { consumeResetToken } = require('../lib/passwordReset');
const { searchAvailableNumbers, listAreaCodes } = require('../lib/numberSearch');
const {
  assertCanAddUser,
  assertCanAddPhoneNumbers,
  assertCanInitiateCall,
  shouldBypassQuotaForUser,
} = require('../lib/quotaService');
const extensionRoutes = require('./extensions');
const ringGroupRoutes = require('./ringGroups');
const router = express.Router();
const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'greetings');
const PAYMENT_PROOFS_DIR = path.join(__dirname, '..', 'uploads', 'payment-proofs');

function ensureUploadsDir() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function ensurePaymentProofsDir() {
  fs.mkdirSync(PAYMENT_PROOFS_DIR, { recursive: true });
}

async function loadTenantNumbersContext(prisma, tenantId) {
  const [numbers, greeting, users, ringGroups, extensions] = await Promise.all([
    prisma.phoneNumber.findMany({
      where: { tenantId },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        ringGroup: { select: { id: true, name: true } },
        extension: { select: { id: true, extensionNumber: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.greeting.findUnique({ where: { tenantId } }),
    prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.ringGroup.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.extension.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: {
        id: true,
        extensionNumber: true,
        displayName: true,
        primaryPhoneNumberId: true,
      },
      orderBy: { extensionNumber: 'asc' },
    }),
  ]);

  const extensionByPrimaryPhoneId = new Map(
    extensions
      .filter((ext) => ext.primaryPhoneNumberId)
      .map((ext) => [ext.primaryPhoneNumberId, ext]),
  );

  return {
    numbers: numbers.map((row) => {
      const extension =
        row.extension || extensionByPrimaryPhoneId.get(row.id) || null;
      return serializeOwnedNumber(row, greeting, row.assignedUser, row.ringGroup, extension);
    }),
    users,
    ringGroups,
    extensions: extensions.map((ext) => ({
      id: ext.id,
      label: `${ext.extensionNumber} — ${ext.displayName}`,
      extensionNumber: ext.extensionNumber,
      displayName: ext.displayName,
    })),
  };
}

async function resolveTelnyxConnection(prisma) {
  const platform = await loadPlatformSettings(prisma);
  return getTelnyxConnectionConfig(platform);
}

router.get('/numbers/area-codes', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), async (req, res) => {
  try {
    const country = String(req.query.country || 'US').toUpperCase();
    const result = listAreaCodes(country);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load area codes' });
  }
});

router.get('/numbers/search', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), searchLimiter, async (req, res) => {
  try {
    const result = await searchAvailableNumbers(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Search Error:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      error: 'Failed to fetch numbers from Telnyx',
      detail: error.response?.data?.errors?.[0]?.detail || error.message,
    });
  }
});

router.post('/mobile/provision', loginLimiter, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const result = await redeemProvisioningToken(prisma, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    if (error.status === 403) return res.status(403).json({ error: error.message });
    console.error('Mobile provision error:', error.message);
    res.status(500).json({ error: error.message || 'Provisioning failed' });
  }
});

router.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: { tenant: true },
    });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.tenantId && user.tenant && !user.tenant.isActive) {
      return res.status(403).json({ error: 'Your organization account is suspended. Contact VSP-VOIP support.' });
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    });

    res.json({
      success: true,
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name ?? null,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/auth/forgot-password', loginLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });

    // Always return success to avoid email enumeration
    if (user) {
      await sendPasswordResetEmail({ user });
    }

    res.json({
      success: true,
      message: 'If an account exists for that email, a reset link has been sent.',
    });
  } catch (error) {
    console.error('❌ Forgot password error:', error.message);
    res.status(500).json({ error: 'Could not process password reset request' });
  }
});

router.post('/auth/reset-password', loginLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const payload = await consumeResetToken(token);
    if (!payload?.userId) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const prisma = await getPrisma();
    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash },
    });

    res.json({ success: true, message: 'Password updated. You can sign in now.' });
  } catch (error) {
    console.error('❌ Reset password error:', error.message);
    res.status(500).json({ error: 'Could not reset password' });
  }
});

router.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { tenant: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name ?? null,
      tenantContactEmail: user.tenant?.contactEmail ?? null,
      tenantTimezone: user.tenant?.timezone ?? null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.get('/tenant/profile', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Organization not found' });

    res.json({
      success: true,
      profile: {
        id: tenant.id,
        name: tenant.name,
        contactEmail: tenant.contactEmail || '',
        timezone: tenant.timezone || 'America/New_York',
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load company profile' });
  }
});

router.put('/tenant/profile', authMiddleware, requireRole('TENANT_ADMIN'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const { contactEmail, timezone } = req.body;
    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);

    const tenant = await prisma.tenant.update({
      where: { id: req.user.tenantId },
      data: {
        ...(contactEmail !== undefined ? { contactEmail: contactEmail ? String(contactEmail).trim() : null } : {}),
        ...(timezone !== undefined ? { timezone: String(timezone).trim() || 'America/New_York' } : {}),
      },
    });

    res.json({
      success: true,
      profile: {
        id: tenant.id,
        name: tenant.name,
        contactEmail: tenant.contactEmail || '',
        timezone: tenant.timezone,
      },
    });
  } catch (error) {
    if (error.status === 403) return res.status(403).json({ error: error.message });
    res.status(500).json({ error: 'Failed to update company profile' });
  }
});

router.get('/tenant/users', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const users = await prisma.user.findMany({
      where: { tenantId: req.user.tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        extensions: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            extensionNumber: true,
            displayName: true,
            department: true,
          },
          take: 1,
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    res.json({
      success: true,
      users: users.map((user) => {
        const extension = user.extensions[0] || null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
          assignedExtension: extension
            ? {
              id: extension.id,
              extensionNumber: extension.extensionNumber,
              displayName: extension.displayName,
              department: extension.department,
            }
            : null,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load team members' });
  }
});

router.post('/tenant/users', authMiddleware, requireRole('TENANT_ADMIN'), async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, name, and password are required' });
    }

    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const allowedRoles = ['TENANT_ADMIN', 'TENANT_USER'];
    const userRole = allowedRoles.includes(role) ? role : 'TENANT_USER';

    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);
    await assertCanAddUser(prisma, req.user.tenantId, { bypass: shouldBypassQuotaForUser(req.user) });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase().trim(),
        name: String(name).trim(),
        passwordHash,
        role: userRole,
        tenantId: req.user.tenantId,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    res.status(201).json({ success: true, user });
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({
        error: error.message,
        code: error.code || undefined,
        quota: error.quota || undefined,
      });
    }
    if (error.code === 'P2002') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.get('/tenant/subscription', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const summary = await getTenantSubscriptionSummary({
      prisma,
      tenantId: req.user.tenantId,
    });

    res.json({ success: true, summary });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load subscription' });
  }
});

router.get('/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const tenantFilter = req.user.role === 'SUPER_ADMIN' ? {} : { tenantId: req.user.tenantId };

    const [callCount, numberCount, unreadVoicemailCount, unreadSmsCount, recentCalls, pendingOrdersCount, recentOrders] = await Promise.all([
      prisma.callLog.count({ where: tenantFilter }),
      req.user.tenantId
        ? prisma.phoneNumber.count({ where: { tenantId: req.user.tenantId } })
        : prisma.phoneNumber.count(),
      req.user.tenantId
        ? prisma.voicemail.count({ where: { tenantId: req.user.tenantId, isRead: false } })
        : 0,
      req.user.tenantId
        ? prisma.smsMessage.count({ where: { tenantId: req.user.tenantId, isRead: false, direction: 'inbound' } })
        : 0,
      prisma.callLog.findMany({
        where: tenantFilter,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { tenant: { select: { name: true } } },
      }),
      req.user.tenantId
        ? prisma.numberOrder.count({
            where: { tenantId: req.user.tenantId, status: { in: ['PENDING', 'PAID'] } },
          })
        : 0,
      req.user.tenantId
        ? prisma.numberOrder.findMany({
            where: { tenantId: req.user.tenantId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { tenant: true },
          })
        : [],
    ]);

    res.json({
      success: true,
      callCount,
      numberCount,
      unreadVoicemailCount,
      unreadSmsCount,
      pendingOrdersCount,
      recentOrders: recentOrders.map((o) => serializeOrder(o, o.tenant)),
      recentCalls,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

router.get('/softphone/config', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);
    const platform = await loadPlatformSettings(prisma);
    const connectionId = await loadCredentialConnectionId(prisma);
    const [numbers, greeting] = await Promise.all([
      prisma.phoneNumber.findMany({
        where: { tenantId: req.user.tenantId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, number: true },
      }),
      prisma.greeting.findUnique({ where: { tenantId: req.user.tenantId } }),
    ]);
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        pushDeviceToken: true,
        pushDevicePlatform: true,
        pushTokenUpdatedAt: true,
        telnyxSipUsername: true,
        _count: { select: { devices: true } },
      },
    });
    const registeredDevices = await listUserDevices(prisma, req.user.sub);

    const apiPublic = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
    const callControlSetup = await getCallControlSetupStatus(prisma);
    const webrtcSetup = await getRecordingSetupStatus(prisma);
    const outboundReady = Boolean(connectionId && webrtcSetup.outboundVoiceProfileId);

    const inboundDiagnostics = await resolveSoftphoneInboundRoutingDiagnostics(
      prisma,
      req.user.tenantId,
      req.user.sub,
    );
    const inAppRingGroup = inboundDiagnostics.routingMethods.greetingRingGroup.userIncluded;

    res.json({
      success: true,
      configured: Boolean(connectionId),
      credentialConnectionId: connectionId,
      sipUsername: inboundDiagnostics.sipUsername,
      webrtcSession: {
        sipUsername: inboundDiagnostics.sipUsername,
        dialUri: inboundDiagnostics.webrtcDialUri,
        credentialConnectionId: connectionId,
        note: 'Call Control dials this SIP URI for inbound PSTN → WebRTC. Keep the softphone page open and registered.',
      },
      numbers,
      defaultCallerId: numbers[0]?.number || null,
      callRecordingEnabled: greeting?.callRecordingEnabled !== false,
      voiceWebhookUrl: `${apiPublic}/webhook/voice`,
      callRecordingWebhookUrl: `${apiPublic}/webhook/call-recording`,
      callControlSetup,
      webrtcSetup: {
        outboundVoiceProfileId: webrtcSetup.outboundVoiceProfileId,
        outboundReady,
        credentialWebhookConfigured: webrtcSetup.credentialWebhookConfigured,
        webhooksReachable: webrtcSetup.webhooksReachable,
        message: !connectionId
          ? 'WebRTC credential connection is not configured.'
          : !webrtcSetup.outboundVoiceProfileId
            ? 'Assign Outbound Voice Profile "VSP-Outbound" on the Telnyx CREDENTIAL connection (VSP-SIP-Trunk), not the Call Control app (VSP-Voice-App). Phone numbers stay on Call Control for inbound.'
            : webrtcSetup.message,
      },
      telnyxArchitecture: {
        inbound: {
          resource: 'Call Control Application',
          name: callControlSetup.applicationName || 'VSP-Voice-App',
          id: callControlSetup.applicationId || null,
          webhookUrl: callControlSetup.callControlWebhookUrl,
          numberAssignment: 'Keep numbers (e.g. +13099880196) assigned here for inbound PSTN → webhook → ring WebRTC users.',
        },
        outboundWebRtc: {
          resource: 'Credential Connection',
          name: webrtcSetup.credentialConnectionId ? 'VSP-SIP-Trunk (platform credential connection)' : null,
          id: connectionId,
          webhookUrl: `${apiPublic}/webhook/voice`,
          outboundVoiceProfileId: webrtcSetup.outboundVoiceProfileId,
          note: 'Softphone registers here via telephony credential JWT. Caller ID is any tenant-owned number; numbers do not need to move off Call Control.',
        },
      },
      inboundRouting: {
        ringGroupEnabled: greeting?.ringGroupEnabled ?? false,
        inAppRingGroup,
        ready: inboundDiagnostics.ready,
        routingMethods: inboundDiagnostics.routingMethods,
        numberTargets: inboundDiagnostics.numberTargets,
        sampleNumberTargets: inboundDiagnostics.sampleNumberTargets,
        pushTokenRegistered: Boolean(user?.pushDeviceToken) || registeredDevices.length > 0,
        pushPlatform: user?.pushDevicePlatform || null,
        registeredDeviceCount: registeredDevices.length,
        registeredDevices: registeredDevices.map((device) => ({
          deviceId: device.deviceId,
          platform: device.platform,
          deviceName: device.deviceName,
          appVersion: device.appVersion,
          lastSeenAt: device.lastSeenAt,
        })),
        message: inboundDiagnostics.message,
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load softphone config' });
  }
});

router.get('/softphone/diagnostics', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const connectionId = await loadCredentialConnectionId(prisma);
    const [webrtcSetup, callControlSetup, inboundDiagnostics, pushStatus, registeredDevices] = await Promise.all([
      getRecordingSetupStatus(prisma),
      getCallControlSetupStatus(prisma),
      resolveSoftphoneInboundRoutingDiagnostics(prisma, req.user.tenantId, req.user.sub),
      getCredentialConnectionPushStatus(connectionId),
      listUserDevices(prisma, req.user.sub),
    ]);

    let connectionName = null;
    let connectionWebhook = null;
    if (connectionId && process.env.TELNYX_API_KEY) {
      const { getCredentialConnection } = require('../lib/telnyxRecordingSetup');
      const connection = await getCredentialConnection(connectionId);
      connectionName = connection?.connection_name || connection?.name || null;
      connectionWebhook = connection?.webhook_event_url || null;
    }

    res.json({
      success: true,
      outboundReady: Boolean(connectionId && webrtcSetup.outboundVoiceProfileId),
      credentialConnection: {
        id: connectionId,
        name: connectionName,
        webhookUrl: connectionWebhook,
        outboundVoiceProfileId: webrtcSetup.outboundVoiceProfileId,
      },
      callControlApplication: {
        id: callControlSetup.applicationId,
        name: callControlSetup.applicationName,
        webhookConfigured: callControlSetup.applicationWebhookConfigured,
        webhookUrl: callControlSetup.callControlWebhookUrl,
        webhooksReachable: callControlSetup.webhooksReachable,
      },
      inboundRouting: inboundDiagnostics,
      push: {
        telnyxPortal: pushStatus,
        userDevices: {
          registered: registeredDevices.length > 0,
          count: registeredDevices.length,
          devices: registeredDevices.map((device) => ({
            deviceId: device.deviceId,
            platform: device.platform,
            deviceName: device.deviceName,
            lastSeenAt: device.lastSeenAt,
          })),
        },
        note: 'Telnyx Portal push + SDK notificationToken on connectWithToken are both required for background mobile inbound.',
      },
      fix: !webrtcSetup.outboundVoiceProfileId
        ? 'Assign VSP-Outbound on VSP-SIP-Trunk (Credential Connection) Outbound tab, or set TELNYX_OUTBOUND_VOICE_PROFILE_ID in API .env and restart API.'
        : !inboundDiagnostics.ready
          ? inboundDiagnostics.message
          : !pushStatus.configured
            ? pushStatus.portalAction || pushStatus.message
            : null,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Diagnostics failed' });
  }
});

router.post('/softphone/token', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);
    const platform = await loadPlatformSettings(prisma);
    const connectionId = await loadCredentialConnectionId(prisma);

    const token = await createSoftphoneLoginToken({
      prisma,
      connectionId,
      userId: req.user.sub,
      tenantId: req.user.tenantId,
    });

    if (!token?.loginToken || typeof token.loginToken !== 'string' || !token.loginToken.trim()) {
      return res.status(502).json({
        error: 'Telnyx did not return a valid WebRTC login token. Verify TELNYX_API_KEY and credential connection.',
      });
    }

    ensureTelnyxRecordingSetup(prisma).catch((syncError) => {
      console.warn('⚠️ Credential connection webhook/recording sync after softphone login:', syncError.message);
    });
    ensureTelnyxCallControlSetup(prisma).catch((syncError) => {
      console.warn('⚠️ Call Control number sync after softphone login:', syncError.message);
    });

    res.json({
      success: true,
      loginToken: token.loginToken,
      sipUsername: token.sipUsername,
      credentialConnectionId: connectionId,
      expiresInSeconds: token.expiresInSeconds,
    });
  } catch (error) {
    console.error('❌ Softphone token error:', error.response?.data || error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to create softphone token',
      detail: error.response?.data?.errors?.[0]?.detail,
    });
  }
});

router.post('/softphone/internal-call', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const extensionNumber = req.body?.extensionNumber
      ? String(req.body.extensionNumber).trim()
      : '';
    if (!extensionNumber) {
      return res.status(400).json({ error: 'extensionNumber is required' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);
    const platform = await loadPlatformSettings(prisma);
    const { initiateInternalCallFromApi } = require('../lib/internalExtensionDial');

    const result = await initiateInternalCallFromApi(
      prisma,
      req.user.tenantId,
      req.user.sub,
      extensionNumber,
      platform,
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Internal extension call error:', error.response?.data || error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to place internal call',
      detail: error.response?.data?.errors?.[0]?.detail,
    });
  }
});

router.post('/softphone/presence', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const online = req.body?.online !== false;
    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);
    const result = await setSoftphonePresence({
      prisma,
      userId: req.user.sub,
      tenantId: req.user.tenantId,
      online,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to update softphone presence' });
  }
});

/** Notify Call Control that the agent accepted on WebRTC (before bridge webhooks arrive). */
router.post('/softphone/call-accepted', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const user = await prisma.user.findFirst({
      where: { id: req.user.sub, tenantId: req.user.tenantId },
      select: { telnyxSipUsername: true },
    });
    if (!user?.telnyxSipUsername) {
      return res.status(400).json({ error: 'WebRTC SIP credentials are not provisioned for this user' });
    }

    const result = await markAgentWebRtcAccepted(user.telnyxSipUsername);
    res.json({ success: result.ok, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to mark call accepted' });
  }
});

router.post('/softphone/telemetry', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const event = req.body?.event ? String(req.body.event).trim() : '';
    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }

    const properties = req.body?.properties && typeof req.body.properties === 'object'
      ? req.body.properties
      : {};

    console.log('[softphone-telemetry]', {
      tenantId: req.user.tenantId,
      userId: req.user.sub,
      event,
      properties,
      at: new Date().toISOString(),
    });
    recordTelemetryEvent({
      event,
      properties,
      tenantId: req.user.tenantId,
      userId: req.user.sub,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to record telemetry' });
  }
});

router.post('/softphone/push-token', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const token = req.body?.token ? String(req.body.token).trim() : '';
    const platform = req.body?.platform ? String(req.body.platform).trim().toLowerCase() : '';
    const deviceId = req.body?.deviceId ? String(req.body.deviceId).trim() : '';
    const deviceName = req.body?.deviceName ? String(req.body.deviceName).trim() : null;
    const appVersion = req.body?.appVersion ? String(req.body.appVersion).trim() : null;

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }
    if (!['android', 'ios'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be android or ios' });
    }
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);

    const device = await registerUserDevice(prisma, {
      userId: req.user.sub,
      deviceId,
      platform,
      pushToken: token,
      deviceName,
      appVersion,
    });

    const deviceCount = await countUserDevices(prisma, req.user.sub);

    let sipUsername = null;
    const connectionId = await loadCredentialConnectionId(prisma);
    if (connectionId) {
      try {
        const telephony = await getOrCreateUserTelephonyCredential({
          prisma,
          userId: req.user.sub,
          tenantId: req.user.tenantId,
          connectionId,
        });
        sipUsername = telephony?.sipUsername || null;
      } catch (credError) {
        console.warn('⚠️ SIP credential provision on push-token:', credError.message);
      }
    }

    res.json({
      success: true,
      platform,
      registered: true,
      deviceId: device.deviceId,
      registeredDeviceCount: deviceCount,
      sipUsername,
      webrtcDialUri: sipUsername ? `sip:${sipUsername}@sip.telnyx.com` : null,
      note: 'Telnyx push delivery requires notificationToken on SDK connectWithToken; this endpoint stores the device token and ensures SIP credentials exist for inbound dial.',
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to register push token' });
  }
});

router.get('/softphone/devices', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);
    const devices = await listUserDevices(prisma, req.user.sub);

    res.json({
      success: true,
      count: devices.length,
      devices: devices.map((device) => ({
        deviceId: device.deviceId,
        platform: device.platform,
        deviceName: device.deviceName,
        appVersion: device.appVersion,
        lastSeenAt: device.lastSeenAt,
        pushTokenPreview: `${device.pushToken.slice(0, 8)}…`,
      })),
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to list devices' });
  }
});

router.delete('/softphone/devices/:deviceId', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);
    const result = await removeUserDevice(prisma, req.user.sub, req.params.deviceId);

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to remove device' });
  }
});

router.post('/softphone/call-log', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const { callSid, from, to, status, direction } = req.body;
    const durationRaw = req.body?.durationSeconds;
    const durationSeconds = Number.isFinite(Number(durationRaw))
      ? Math.max(0, Math.round(Number(durationRaw)))
      : null;
    const normalizedFrom = normalizePhoneNumber(from);
    const normalizedTo = normalizePhoneNumber(to);
    if (!normalizedFrom || !normalizedTo) {
      return res.status(400).json({ error: 'from and to are required' });
    }

    const callDirection = String(direction || 'outbound').toLowerCase() === 'inbound'
      ? 'inbound'
      : 'outbound';

    const prisma = await getPrisma();
    const ownedNumber = callDirection === 'inbound'
      ? normalizedTo
      : normalizedFrom;
    const owned = await prisma.phoneNumber.findFirst({
      where: { tenantId: req.user.tenantId, number: ownedNumber },
    });
    if (!owned) {
      return res.status(403).json({
        error: callDirection === 'inbound'
          ? 'Destination must be one of your tenant numbers'
          : 'Caller ID must be one of your tenant numbers',
      });
    }

    const sidPrefix = callDirection === 'inbound' ? 'inbound' : 'outbound';
    const sid = callSid ? String(callSid) : `${sidPrefix}-${Date.now()}-${req.user.sub}`;
    const rawStatus = String(status || 'completed').toLowerCase();
    const normalizedStatus = normalizeSoftphoneLogStatus(rawStatus, callDirection, {
      userDeclined: Boolean(req.body?.userDeclined),
      acceptedByUser: Boolean(req.body?.acceptedByUser),
      userCancelled: Boolean(req.body?.userCancelled),
    });
    const callType = req.body?.callType
      ? String(req.body.callType)
      : classifyCallType(normalizedStatus, callDirection);
    const terminal = ['completed', 'ended', 'connected', 'busy', 'failed', 'no-answer',
      'canceled', 'cancelled', 'rejected', 'missed', 'outbound_no_answer'].includes(normalizedStatus);

    const callLog = await prisma.callLog.upsert({
      where: { callSid: sid },
      create: {
        callSid: sid,
        from: normalizedFrom,
        to: normalizedTo,
        direction: callDirection,
        status: normalizedStatus,
        callType,
        durationSeconds,
        endedAt: durationSeconds != null || terminal ? new Date() : undefined,
        tenantId: req.user.tenantId,
      },
      update: {
        status: normalizedStatus,
        callType,
        from: normalizedFrom,
        to: normalizedTo,
        direction: callDirection,
        ...(durationSeconds != null
          ? { durationSeconds, endedAt: new Date() }
          : terminal ? { endedAt: new Date() } : {}),
      },
    });

    syncCallRecordingsFromTelnyx(prisma, { tenantId: req.user.tenantId }).catch((error) => {
      console.warn('⚠️ Post-call recording sync failed:', error.message);
    });

    res.json({ success: true, callLog });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save call log' });
  }
});

router.post('/softphone/record-start', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const { callControlId, from, to } = req.body;
    if (!callControlId) {
      return res.status(400).json({ error: 'callControlId is required' });
    }

    const normalizedFrom = normalizePhoneNumber(from);
    const normalizedTo = normalizePhoneNumber(to);
    if (!normalizedFrom || !normalizedTo) {
      return res.status(400).json({ error: 'from and to are required' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);
    await assertCanInitiateCall(prisma, req.user.tenantId, {
      bypass: shouldBypassQuotaForUser(req.user),
    });

    const owned = await prisma.phoneNumber.findFirst({
      where: { tenantId: req.user.tenantId, number: normalizedFrom },
    });
    if (!owned) {
      return res.status(403).json({ error: 'Caller ID must be one of your tenant numbers' });
    }

    const greeting = await prisma.greeting.findUnique({ where: { tenantId: req.user.tenantId } });
    if (greeting?.callRecordingEnabled === false) {
      return res.status(403).json({ error: 'Call recording is disabled in Call routing settings' });
    }

    const result = await startOutboundCallRecording({
      callControlId: String(callControlId),
      tenantId: req.user.tenantId,
      from: normalizedFrom,
      to: normalizedTo,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Outbound record-start error:', error.response?.data || error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to start outbound recording',
      detail: error.response?.data?.errors?.[0]?.detail,
    });
  }
});

router.get('/tenants/:tenantId/greeting', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    if (req.user.role !== 'SUPER_ADMIN' && req.user.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const greeting = await prisma.greeting.findUnique({ where: { tenantId } });
    const routing = mapCallRoutingResponse(greeting, tenant);
    res.json({ success: true, ...routing });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load greeting' });
  }
});

router.get('/tenants/:tenantId/call-routing', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    if (req.user.role !== 'SUPER_ADMIN' && req.user.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const greeting = await prisma.greeting.findUnique({ where: { tenantId } });
    res.json({ success: true, routing: mapCallRoutingResponse(greeting, tenant) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load call routing' });
  }
});

router.put('/tenants/:tenantId/call-routing', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const {
      message,
      voice,
      afterHoursMessage,
      businessHoursEnabled,
      businessHours,
      ivrEnabled,
      ivrPrompt,
      ivrOptions,
      forwardEnabled,
      forwardNumber,
      playGreetingBeforeConnect,
      ringGroupEnabled,
      ringGroupName,
      ringGroupMembers,
      ringStrategy,
      ringTimeout,
      noAnswerMessage,
      voicemailEnabled,
      voicemailPrompt,
      voicemailMaxLength,
      afterHoursVoicemailEnabled,
      callRecordingEnabled,
      callRecordingNotice,
      playCallRecordingNotice,
      greetingAudioUrl,
      ivrPromptAudioUrl,
    } = req.body;

    if (req.user.role !== 'SUPER_ADMIN' && req.user.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const normalizedForward = forwardNumber ? normalizePhoneNumber(forwardNumber) : null;
    if (forwardEnabled && !normalizedForward) {
      return res.status(400).json({ error: 'forwardNumber is required when call forward is enabled' });
    }

    const normalizedMembers = normalizeRingGroupMembers(ringGroupMembers);
    if (ringGroupEnabled && !normalizedMembers.length) {
      return res.status(400).json({ error: 'At least one ring group member is required' });
    }

    const hasAppRingMembers = normalizedMembers.some(
      (member) => member.type === 'app' && member.userId,
    );

    const routingFields = {
      afterHoursMessage: afterHoursMessage || null,
      businessHoursEnabled: Boolean(businessHoursEnabled),
      businessHours: businessHours || defaultBusinessHours(),
      ivrEnabled: Boolean(ivrEnabled),
      ivrPrompt: ivrPrompt || null,
      ivrOptions: normalizeIvrOptions(ivrOptions),
      forwardEnabled: Boolean(forwardEnabled),
      forwardNumber: normalizedForward,
      playGreetingBeforeConnect: hasAppRingMembers
        ? false
        : playGreetingBeforeConnect !== false,
      ringGroupEnabled: Boolean(ringGroupEnabled),
      ringGroupName: ringGroupName ? String(ringGroupName).trim() : null,
      ringGroupMembers: normalizedMembers,
      ringStrategy: normalizeRingStrategy(ringStrategy),
      ringTimeout: clampRingTimeout(ringTimeout),
      noAnswerMessage: noAnswerMessage || null,
      voicemailEnabled: voicemailEnabled !== false,
      voicemailPrompt: voicemailPrompt || null,
      voicemailMaxLength: clampVoicemailMaxLength(voicemailMaxLength),
      afterHoursVoicemailEnabled: Boolean(afterHoursVoicemailEnabled),
      callRecordingEnabled: callRecordingEnabled !== false,
      callRecordingNotice: callRecordingNotice || null,
      playCallRecordingNotice: playCallRecordingNotice !== false,
      greetingAudioUrl: greetingAudioUrl ? String(greetingAudioUrl).trim() : null,
      ivrPromptAudioUrl: ivrPromptAudioUrl ? String(ivrPromptAudioUrl).trim() : null,
    };

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const greeting = await prisma.greeting.upsert({
      where: { tenantId },
      create: {
        tenantId,
        message: String(message).trim(),
        voice: voice || 'en-US',
        ...routingFields,
      },
      update: {
        message: String(message).trim(),
        ...(voice ? { voice } : {}),
        ...routingFields,
      },
    });

    if (hasAppRingMembers) {
      ensureTelnyxCallControlSetup(prisma).catch((syncError) => {
        console.warn('⚠️ Call Control number sync after routing save:', syncError.message);
      });
    }

    res.json({
      success: true,
      routing: mapCallRoutingResponse(greeting, tenant),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save call routing' });
  }
});

router.get('/tenant/voicemails', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const where = req.user.role === 'SUPER_ADMIN' && req.query.tenantId
      ? { tenantId: String(req.query.tenantId) }
      : req.user.tenantId
        ? { tenantId: req.user.tenantId }
        : {};

    const voicemails = await prisma.voicemail.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      success: true,
      count: voicemails.length,
      voicemails: voicemails.map(mapVoicemailRecord),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load voicemails' });
  }
});

router.patch('/tenant/voicemails/:id/read', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const existing = await prisma.voicemail.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.tenantId !== req.user.tenantId) {
      return res.status(404).json({ error: 'Voicemail not found' });
    }

    const voicemail = await prisma.voicemail.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.json({ success: true, voicemail: mapVoicemailRecord(voicemail) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update voicemail' });
  }
});

router.delete('/tenant/voicemails/:id', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const prisma = await getPrisma();
    const existing = await prisma.voicemail.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Voicemail not found' });
    if (req.user.role !== 'SUPER_ADMIN' && existing.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.voicemail.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete voicemail' });
  }
});

router.get('/tenant/voicemails/:id/stream', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const prisma = await getPrisma();
    const record = await prisma.voicemail.findUnique({ where: { id: req.params.id } });
    if (!record) return res.status(404).json({ error: 'Voicemail not found' });
    if (req.user.role !== 'SUPER_ADMIN' && record.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!record.recordingSid) {
      if (record.recordingUrl) {
        return res.redirect(record.recordingUrl);
      }
      return res.status(404).json({ error: 'Voicemail file not available' });
    }

    const { stream, contentType, contentLength } = await streamTelnyxRecording(record.recordingSid);
    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Accept-Ranges', 'bytes');
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to stream voicemail' });
      }
    });
    stream.pipe(res);
  } catch (error) {
    const status = error.status || 502;
    res.status(status).json({ error: error.message || 'Failed to stream voicemail' });
  }
});

router.get('/tenant/recordings/setup', authMiddleware, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const setup = await getRecordingSetupStatus(prisma);
    res.json({ success: true, setup });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load recording setup status' });
  }
});

router.post('/tenant/recordings/sync', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const tenantId = req.user.role === 'SUPER_ADMIN' && req.body?.tenantId
      ? String(req.body.tenantId)
      : req.user.tenantId;

    const syncResult = await syncCallRecordingsFromTelnyx(prisma, { tenantId: tenantId || undefined });
    res.json({ success: true, ...syncResult });
  } catch (error) {
    console.error('❌ Recording sync error:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Failed to sync recordings' });
  }
});

router.get('/tenant/recordings', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const tenantId = req.user.role === 'SUPER_ADMIN' && req.query.tenantId
      ? String(req.query.tenantId)
      : req.user.tenantId;

    if (req.query.sync !== '0') {
      try {
        await syncCallRecordingsFromTelnyx(prisma, { tenantId: tenantId || undefined });
      } catch (error) {
        console.warn('⚠️ Recording sync on load failed:', error.message);
      }
    }

    const where = req.user.role === 'SUPER_ADMIN' && req.query.tenantId
      ? { tenantId: String(req.query.tenantId) }
      : req.user.tenantId
        ? { tenantId: req.user.tenantId }
        : {};

    const recordings = await prisma.callRecording.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const refreshedRecordings = await refreshCallRecordingUrls(prisma, recordings);

    res.json({
      success: true,
      count: refreshedRecordings.length,
      recordings: refreshedRecordings.map(mapCallRecording),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load call recordings' });
  }
});

router.get('/tenant/recordings/:id/stream', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const prisma = await getPrisma();
    const record = await prisma.callRecording.findUnique({ where: { id: req.params.id } });
    if (!record) return res.status(404).json({ error: 'Recording not found' });
    if (req.user.role !== 'SUPER_ADMIN' && record.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!record.recordingSid) {
      if (record.recordingUrl) {
        return res.redirect(record.recordingUrl);
      }
      return res.status(404).json({ error: 'Recording file not available' });
    }

    const { stream, contentType, contentLength } = await streamTelnyxRecording(record.recordingSid);
    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Accept-Ranges', 'bytes');
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to stream recording' });
      }
    });
    stream.pipe(res);
  } catch (error) {
    const status = error.status || 502;
    res.status(status).json({ error: error.message || 'Failed to stream recording' });
  }
});

router.delete('/tenant/recordings/:id', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const prisma = await getPrisma();
    const existing = await prisma.callRecording.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Recording not found' });
    if (req.user.role !== 'SUPER_ADMIN' && existing.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.callRecording.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

router.get('/sms/config', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);
    const platform = await loadPlatformSettings(prisma);
    const numbers = await prisma.phoneNumber.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, number: true },
    });
    const messagingSetup = await getMessagingSetupStatus(
      prisma,
      numbers.map((item) => item.number),
    );

    res.json({
      success: true,
      configured: Boolean(getMessagingProfileId(platform)),
      messagingProfileId: getMessagingProfileId(platform),
      numbers,
      defaultFrom: numbers[0]?.number || null,
      smsWebhookUrl: getSmsWebhookUrl(),
      webhookReachable: isSmsWebhookReachable(),
      messagingSetup,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load SMS config' });
  }
});

router.get('/sms/conversations', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const tenantId = req.user.role === 'SUPER_ADMIN' && req.query.tenantId
      ? String(req.query.tenantId)
      : req.user.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const numbers = await prisma.phoneNumber.findMany({
      where: { tenantId },
      select: { number: true },
    });
    const conversations = await buildConversations(
      prisma,
      tenantId,
      numbers.map((n) => n.number),
    );

    res.json({ success: true, count: conversations.length, conversations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load SMS conversations' });
  }
});

router.get('/sms/messages', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const peer = normalizePhoneNumber(req.query.peer);
    const line = normalizePhoneNumber(req.query.line);
    if (!peer || !line) {
      return res.status(400).json({ error: 'peer and line query parameters are required' });
    }

    const prisma = await getPrisma();
    const tenantId = req.user.role === 'SUPER_ADMIN' && req.query.tenantId
      ? String(req.query.tenantId)
      : req.user.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const ownedLine = await prisma.phoneNumber.findFirst({
      where: { tenantId, number: line },
    });
    if (!ownedLine) {
      return res.status(403).json({ error: 'Line number is not assigned to your organization' });
    }

    let messages = await prisma.smsMessage.findMany({
      where: {
        tenantId,
        OR: [
          { from: peer, to: line },
          { from: line, to: peer },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Number(req.query.limit) || 200, 500),
    });

    messages = await syncSmsMessageStatuses(prisma, messages);

    res.json({
      success: true,
      count: messages.length,
      messages: messages.map(mapSmsMessage),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load SMS messages' });
  }
});

router.patch('/sms/conversations/read', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const peer = normalizePhoneNumber(req.body.peer);
    const line = normalizePhoneNumber(req.body.line);
    if (!peer || !line) {
      return res.status(400).json({ error: 'peer and line are required' });
    }

    const prisma = await getPrisma();
    const ownedLine = await prisma.phoneNumber.findFirst({
      where: { tenantId: req.user.tenantId, number: line },
    });
    if (!ownedLine) {
      return res.status(403).json({ error: 'Line number is not assigned to your organization' });
    }

    const result = await prisma.smsMessage.updateMany({
      where: {
        tenantId: req.user.tenantId,
        direction: 'inbound',
        isRead: false,
        from: peer,
        to: line,
      },
      data: { isRead: true },
    });

    res.json({ success: true, updated: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark conversation read' });
  }
});

router.post('/sms/send', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const { from, to, text } = req.body;
    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);
    const platform = await loadPlatformSettings(prisma);

    let message = await sendSmsMessage({
      prisma,
      platform,
      tenantId: req.user.tenantId,
      from,
      to,
      text,
    });

    [message] = await syncSmsMessageStatuses(prisma, [message]);

    res.json({ success: true, message: mapSmsMessage(message) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to send SMS' });
  }
});

router.delete('/sms/messages/:id', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const prisma = await getPrisma();
    const existing = await prisma.smsMessage.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Message not found' });
    if (req.user.role !== 'SUPER_ADMIN' && existing.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.smsMessage.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

router.put('/tenants/:tenantId/greeting', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { message, voice } = req.body;

    if (req.user.role !== 'SUPER_ADMIN' && req.user.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const greeting = await prisma.greeting.upsert({
      where: { tenantId },
      create: {
        tenantId,
        message: String(message).trim(),
        voice: voice || 'en-US',
      },
      update: {
        message: String(message).trim(),
        ...(voice ? { voice } : {}),
      },
    });

    res.json({
      success: true,
      greeting,
      preview: resolveGreetingMessage(greeting.message, tenant.name),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save greeting' });
  }
});

router.get('/calls', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.json({ success: true, count: 0, calls: [] });
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const prisma = await getPrisma();
    const calls = await prisma.callLog.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const sids = calls.map((c) => c.callSid).filter(Boolean);
    const recordings = sids.length
      ? await prisma.callRecording.findMany({
          where: { tenantId: req.user.tenantId, callSid: { in: sids } },
        })
      : [];
    const recordingBySid = Object.fromEntries(recordings.map((r) => [r.callSid, r]));

    res.json({
      success: true,
      count: calls.length,
      calls: calls.map((call) => {
        const recording = recordingBySid[call.callSid];
        return {
          id: call.id,
          callSid: call.callSid,
          from: call.from,
          to: call.to,
          direction: call.direction,
          status: call.status,
          callType: call.callType || call.direction,
          callTypeLabel: callTypeDisplayLabel(call.callType || call.direction),
          durationSeconds: call.durationSeconds,
          durationLabel: formatCallDuration(call.durationSeconds),
          createdAt: call.createdAt,
          endedAt: call.endedAt,
          recordingId: recording?.id || null,
          recordingUrl: recording?.recordingUrl || null,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch call logs' });
  }
});

router.get('/numbers/mine', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.json({ success: true, numbers: [], users: [] });
    }

    const prisma = await getPrisma();
    const ctx = await loadTenantNumbersContext(prisma, req.user.tenantId);

    res.json({
      success: true,
      numbers: ctx.numbers,
      users: ctx.users,
      extensions: ctx.extensions,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load your numbers' });
  }
});

router.put('/numbers/:id', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const { label, assignedUserId, routingType, forwardDestination, ringGroupId, extensionId, isActive } = req.body;

    if (extensionId !== undefined) {
      return res.status(400).json({
        error: 'DID assignment is managed in Phone System → Extensions. Use the Primary DID field on the extension.',
      });
    }
    if (assignedUserId !== undefined) {
      return res.status(400).json({
        error: 'Employee assignment is managed in Phone System → Extensions.',
      });
    }
    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);

    const existing = await prisma.phoneNumber.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Number not found' });
    }

    const type = routingType != null ? normalizeRoutingType(routingType) : existing.routingType;
    const normalizedForward = forwardDestination
      ? normalizePhoneNumber(forwardDestination)
      : existing.forwardDestination;

    if (type === 'forward' && !normalizedForward) {
      return res.status(400).json({ error: 'Forward destination is required for call forwarding routing' });
    }

    let normalizedRingGroupId = existing.ringGroupId;
    if (ringGroupId !== undefined) {
      normalizedRingGroupId = ringGroupId ? String(ringGroupId) : null;
    }
    if (type === 'ring_group' && !normalizedRingGroupId && ringGroupId === undefined) {
      return res.status(400).json({ error: 'ringGroupId is required for ring group routing' });
    }
    if (normalizedRingGroupId) {
      const group = await prisma.ringGroup.findFirst({
        where: { id: normalizedRingGroupId, tenantId: req.user.tenantId, isActive: true },
      });
      if (!group) {
        return res.status(400).json({ error: 'Ring group not found' });
      }
    }

    if (type === 'direct_user' && !existing.extensionId) {
      return res.status(400).json({
        error: 'Direct-user routing is set automatically when a DID is assigned to an extension in Phone System → Extensions.',
      });
    }

    const updated = await prisma.phoneNumber.update({
      where: { id: existing.id },
      data: {
        ...(label !== undefined ? { label: label ? String(label).trim() : null } : {}),
        ...(routingType !== undefined ? { routingType: type } : {}),
        ...(forwardDestination !== undefined ? { forwardDestination: normalizedForward } : {}),
        ...(ringGroupId !== undefined || type === 'ring_group'
          ? { ringGroupId: type === 'ring_group' ? normalizedRingGroupId : (ringGroupId !== undefined ? normalizedRingGroupId : null) }
          : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        ringGroup: { select: { id: true, name: true } },
        extension: { select: { id: true, extensionNumber: true, displayName: true } },
      },
    });

    const greeting = await prisma.greeting.findUnique({ where: { tenantId: req.user.tenantId } });

    res.json({
      success: true,
      number: serializeOwnedNumber(updated, greeting, updated.assignedUser, updated.ringGroup, updated.extension),
      routingTypes: Array.from(ROUTING_TYPES),
      ringGroups: await prisma.ringGroup.findMany({
        where: { tenantId: req.user.tenantId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update number routing' });
  }
});

router.post('/tenant/greeting/audio', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const { data, filename, field } = req.body;
    if (!data || !filename) {
      return res.status(400).json({ error: 'data and filename are required' });
    }

    const targetField = field === 'ivrPromptAudioUrl' ? 'ivrPromptAudioUrl' : 'greetingAudioUrl';
    const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(safeName).toLowerCase();
    const allowed = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.webm']);
    if (!allowed.has(ext)) {
      return res.status(400).json({ error: 'Allowed formats: mp3, wav, ogg, m4a, webm' });
    }

    const base64 = String(data).includes(',') ? String(data).split(',')[1] : String(data);
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ error: 'File must be 8 MB or smaller' });
    }

    ensureUploadsDir();
    const storedName = `${req.user.tenantId}-${Date.now()}-${safeName}`;
    const filePath = path.join(UPLOADS_DIR, storedName);
    fs.writeFileSync(filePath, buffer);

    const apiPublic = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
    const publicUrl = `${apiPublic}/uploads/greetings/${storedName}`;

    const prisma = await getPrisma();
    const greeting = await prisma.greeting.upsert({
      where: { tenantId: req.user.tenantId },
      create: {
        tenantId: req.user.tenantId,
        message: 'Welcome to {company}. Your call is connected.',
        [targetField]: publicUrl,
      },
      update: { [targetField]: publicUrl },
    });

    res.json({
      success: true,
      url: publicUrl,
      field: targetField,
      routing: mapCallRoutingResponse(greeting, await prisma.tenant.findUnique({ where: { id: req.user.tenantId } })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload greeting audio' });
  }
});

router.post('/billing/billing-portal', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), async (req, res) => {
  try {
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, req.user.tenantId);
    const url = await createBillingPortalSession({
      prisma,
      tenantId: req.user.tenantId,
      returnUrl: req.body.returnUrl,
      customerEmail: req.user.email,
    });

    res.json({ success: true, url });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Could not open billing portal' });
  }
});

router.get('/billing/orders/:id/invoice/download', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.role === 'SUPER_ADMIN' ? null : req.user.tenantId;
    const prisma = await getPrisma();
    const result = await getOrderWithInvoice({
      prisma,
      orderId: req.params.id,
      tenantId,
    });

    const fileName = `invoice-${result.invoice.invoiceNumber}.txt`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.type('text/plain; charset=utf-8').send(result.invoice.body);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to download invoice' });
  }
});

router.get('/billing/config', authMiddleware, async (req, res) => {
  try {
    const prisma = await getPrisma();
    let tenant = null;
    if (req.user.tenantId) {
      tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
    }
    const config = await getBillingConfig(prisma, tenant);
    res.json({ success: true, ...config });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load billing config' });
  }
});

router.post('/billing/manual-order', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), billingLimiter, async (req, res) => {
  try {
    const { items, connectionId } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    const tenantId =
      req.user.role === 'SUPER_ADMIN' && req.body.tenantId
        ? req.body.tenantId
        : req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, tenantId);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await assertCanAddPhoneNumbers(prisma, tenantId, items.length, {
      bypass: shouldBypassQuotaForUser(req.user),
    });

    const result = await createManualOrder({
      prisma,
      tenant,
      items,
      connectionId,
    });

    const { writeAuditLog } = require('../lib/auditLog');
    await writeAuditLog(prisma, req, {
      action: 'order.created',
      entityType: 'NumberOrder',
      entityId: result.order.id,
      details: {
        paymentMethod: 'MANUAL_BANK',
        tenantId,
        phoneNumbers: items.map((i) => i.phoneNumber),
        totalCharged: result.order.totalCharged,
        invoiceNumber: result.order.invoiceNumber,
      },
    });

    res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Manual order error:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Could not place order' });
  }
});

router.post('/billing/orders/:id/payment-proof', authMiddleware, async (req, res) => {
  try {
    const { data, filename } = req.body;
    if (!data || !filename) {
      return res.status(400).json({ error: 'data and filename are required' });
    }

    const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(safeName).toLowerCase();
    const allowed = new Set(['.jpg', '.jpeg', '.png', '.pdf', '.webp']);
    if (!allowed.has(ext)) {
      return res.status(400).json({ error: 'Allowed formats: jpg, png, pdf, webp' });
    }

    const base64 = String(data).includes(',') ? String(data).split(',')[1] : String(data);
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File must be 5 MB or smaller' });
    }

    ensurePaymentProofsDir();
    const storedName = `${req.params.id}-${Date.now()}-${safeName}`;
    const filePath = path.join(PAYMENT_PROOFS_DIR, storedName);
    fs.writeFileSync(filePath, buffer);

    const apiPublic = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
    const proofUrl = `${apiPublic}/uploads/payment-proofs/${storedName}`;

    const tenantId =
      req.user.role === 'SUPER_ADMIN' ? null : req.user.tenantId;

    const prisma = await getPrisma();
    const order = await uploadOrderPaymentProof({
      prisma,
      orderId: req.params.id,
      tenantId,
      proofUrl,
    });

    const { writeAuditLog } = require('../lib/auditLog');
    await writeAuditLog(prisma, req, {
      action: 'order.payment_proof_uploaded',
      entityType: 'NumberOrder',
      entityId: req.params.id,
      details: { proofUrl, tenantId: order.tenantId },
    });

    res.json({ success: true, order });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to upload payment proof' });
  }
});

router.get('/billing/orders/:id', authMiddleware, async (req, res) => {
  try {
    const tenantId =
      req.user.role === 'SUPER_ADMIN' ? null : req.user.tenantId;

    const prisma = await getPrisma();
    const result = await getOrderWithInvoice({
      prisma,
      orderId: req.params.id,
      tenantId,
    });

    res.json({ success: true, order: result.order });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load order' });
  }
});

router.post('/billing/checkout-session', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), billingLimiter, async (req, res) => {
  try {
    const { items, connectionId } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    const tenantId =
      req.user.role === 'SUPER_ADMIN' && req.body.tenantId
        ? req.body.tenantId
        : req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, tenantId);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await assertCanAddPhoneNumbers(prisma, tenantId, items.length, {
      bypass: shouldBypassQuotaForUser(req.user),
    });

    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    const session = await createCheckoutSession({
      prisma,
      tenant,
      userEmail: user?.email || req.user.email,
      items,
      connectionId,
    });

    const { writeAuditLog } = require('../lib/auditLog');
    await writeAuditLog(prisma, req, {
      action: 'order.created',
      entityType: 'NumberOrder',
      entityId: session.orderId,
      details: {
        paymentMethod: 'STRIPE',
        tenantId,
        phoneNumbers: items.map((i) => i.phoneNumber),
        stripeSessionId: session.sessionId,
      },
    });

    res.json({ success: true, ...session });
  } catch (error) {
    console.error('❌ Stripe checkout error:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Could not start checkout' });
  }
});

router.post('/billing/razorpay-order', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), billingLimiter, async (req, res) => {
  try {
    const { items, connectionId } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    const tenantId =
      req.user.role === 'SUPER_ADMIN' && req.body.tenantId
        ? req.body.tenantId
        : req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, tenantId);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await assertCanAddPhoneNumbers(prisma, tenantId, items.length, {
      bypass: shouldBypassQuotaForUser(req.user),
    });

    const { createRazorpayCheckoutOrder } = require('../lib/razorpayBilling');
    const result = await createRazorpayCheckoutOrder({
      prisma,
      tenant,
      items,
      connectionId,
    });

    const { writeAuditLog } = require('../lib/auditLog');
    await writeAuditLog(prisma, req, {
      action: 'order.created',
      entityType: 'NumberOrder',
      entityId: result.orderId,
      details: {
        paymentMethod: 'RAZORPAY',
        tenantId,
        phoneNumbers: items.map((i) => i.phoneNumber),
        razorpayOrderId: result.razorpayOrderId,
        amountInr: result.amount,
      },
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Razorpay order error:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Could not create Razorpay order' });
  }
});

router.post('/billing/razorpay-verify', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), billingLimiter, async (req, res) => {
  try {
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
    if (!orderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'orderId, razorpayPaymentId, and razorpaySignature are required' });
    }

    const tenantId =
      req.user.role === 'SUPER_ADMIN' && req.body.tenantId
        ? req.body.tenantId
        : req.user.tenantId;

    const prisma = await getPrisma();
    const order = await prisma.numberOrder.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (tenantId && order.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const platform = await loadPlatformSettings(prisma);
    const { connectionId } = getTelnyxConnectionConfig(platform);
    const { finalizeRazorpayPayment } = require('../lib/razorpayBilling');

    const result = await finalizeRazorpayPayment({
      prisma,
      orderId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      apiKey: process.env.TELNYX_API_KEY?.trim(),
      defaultConnectionId: connectionId,
    });

    const { writeAuditLog } = require('../lib/auditLog');
    await writeAuditLog(prisma, req, {
      action: 'order.payment_approved',
      entityType: 'NumberOrder',
      entityId: orderId,
      details: {
        gateway: 'RAZORPAY',
        razorpayPaymentId,
        purchased: result.purchased?.length || 0,
        failed: result.failed?.length || 0,
      },
    });

    res.json({
      success: result.failed?.length === 0,
      message: result.message,
      purchased: result.purchased,
      failed: result.failed,
      alreadyFulfilled: result.alreadyFulfilled,
      order: result.order,
    });
  } catch (error) {
    console.error('❌ Razorpay verify error:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Payment verification failed' });
  }
});

router.post('/billing/complete', authMiddleware, requireRole('SUPER_ADMIN', 'TENANT_ADMIN'), billingLimiter, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const tenantId =
      req.user.role === 'SUPER_ADMIN' && req.body.tenantId
        ? req.body.tenantId
        : req.user.tenantId;

    const prisma = await getPrisma();
    const { connectionId } = await resolveTelnyxConnection(prisma);
    const result = await completeCheckoutSession({
      prisma,
      sessionId,
      tenantId,
      apiKey: TELNYX_API_KEY,
      defaultConnectionId: connectionId,
    });

    res.json({
      success: result.failed?.length === 0,
      message: result.message,
      purchased: result.purchased,
      failed: result.failed,
      alreadyFulfilled: result.alreadyFulfilled,
    });
  } catch (error) {
    console.error('❌ Complete checkout error:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Could not complete order' });
  }
});

router.get('/billing/orders', authMiddleware, async (req, res) => {
  try {
    if (!req.user.tenantId && req.user.role !== 'SUPER_ADMIN') {
      return res.json({ success: true, orders: [] });
    }

    const prisma = await getPrisma();
    const orders = await prisma.numberOrder.findMany({
      where: req.user.role === 'SUPER_ADMIN' ? {} : { tenantId: req.user.tenantId },
      include: { tenant: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({
      success: true,
      orders: orders.map((o) => serializeOrder(o, o.tenant)),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

router.post('/billing/quote', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }
    const prisma = await getPrisma();
    let tenant = null;
    if (req.user.tenantId) {
      tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
    }
    const pricing = calculateCartPricing(items, tenant);
    res.json({ success: true, pricing });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate quote' });
  }
});

router.get('/numbers/connections', authMiddleware, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const { connectionId, connectionName } = await resolveTelnyxConnection(prisma);
    const connections = [];
    if (connectionId) {
      connections.push({
        id: connectionId,
        label: connectionName,
        type: 'texml',
      });
    }
    res.json({
      success: true,
      connections,
      defaultConnectionId: connectionId || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load connections' });
  }
});

router.post('/numbers/checkout', authMiddleware, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const prisma = await getPrisma();
    const { assertDirectPurchaseAllowed } = require('../lib/purchaseAuthorization');
    assertDirectPurchaseAllowed(req.user);

    const { phoneNumbers, connectionId, billTenantAutomatically } = req.body;
    if (!Array.isArray(phoneNumbers) || !phoneNumbers.length) {
      return res.status(400).json({ error: 'phoneNumbers array is required' });
    }

    const tenantId = req.body.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for admin purchase' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await assertCanAddPhoneNumbers(prisma, tenantId, phoneNumbers.length, {
      bypass: shouldBypassQuotaForUser(req.user),
    });

    const { connectionId: defaultConnectionId } = await resolveTelnyxConnection(prisma);
    const platform = await loadPlatformSettings(prisma);
    const resolvedConnectionId = connectionId || defaultConnectionId;
    const messagingProfileId = getMessagingProfileId(platform);
    const purchased = [];
    const failed = [];

    const { buildMarginSnapshot } = require('../lib/marginAnalytics');
    const { getTenantBillingRates } = require('../lib/billing');
    const rates = getTenantBillingRates(tenant, platform);
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const itemsByPhone = Object.fromEntries(rawItems.map((i) => [i.phoneNumber, i]));

    for (const phoneNumber of phoneNumbers) {
      try {
        const item = itemsByPhone[phoneNumber] || {
          phoneNumber,
          upfrontCost: '0',
          monthlyCost: '0',
        };
        const margin = buildMarginSnapshot({
          item,
          rates,
          source: 'ADMIN_DIRECT',
        });

        const result = await buyAndAssignNumber({
          phoneNumber,
          tenant,
          prisma,
          apiKey: TELNYX_API_KEY,
          connectionId: resolvedConnectionId,
          messagingProfileId,
          marginData: margin,
        });
        purchased.push({
          phoneNumber,
          message: result.alreadyOwned
            ? 'Already assigned to your organization'
            : 'Purchased successfully',
        });
      } catch (error) {
        failed.push({
          phoneNumber,
          error: error.message || 'Purchase failed',
        });
      }
    }

    let order = null;
    if (purchased.length) {
      const purchasedSet = new Set(purchased.map((p) => p.phoneNumber));
      const orderItems = rawItems.length
        ? rawItems.filter((i) => purchasedSet.has(i.phoneNumber))
        : purchased.map((p) => ({
            phoneNumber: p.phoneNumber,
            upfrontCost: '0',
            monthlyCost: '0',
          }));

      if (orderItems.length) {
        order = await recordAdminDirectOrder({
          prisma,
          tenant,
          items: orderItems,
          connectionId: resolvedConnectionId,
          purchased,
          failed,
          billTenantAutomatically: Boolean(billTenantAutomatically),
        });

        if (order?.id) {
          await prisma.phoneNumber.updateMany({
            where: {
              tenantId: tenant.id,
              number: { in: orderItems.map((i) => i.phoneNumber) },
            },
            data: { orderId: order.id },
          });
        }
      }
    }

    res.json({
      success: failed.length === 0,
      message:
        failed.length === 0
          ? `Order placed — ${purchased.length} number(s) processed`
          : `${purchased.length} succeeded, ${failed.length} failed`,
      purchased,
      failed,
      order,
      texmlConfigured: Boolean(resolvedConnectionId),
    });
  } catch (error) {
    console.error('❌ Checkout error:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Checkout failed' });
  }
});

router.post('/numbers/buy', authMiddleware, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { assertDirectPurchaseAllowed } = require('../lib/purchaseAuthorization');
    assertDirectPurchaseAllowed(req.user);

    const { phoneNumber, billTenantAutomatically } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }

    const tenantId = req.body.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for admin purchase' });
    }

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await assertCanAddPhoneNumbers(prisma, tenantId, 1, {
      bypass: shouldBypassQuotaForUser(req.user),
    });

    console.log(`🛒 Buying ${phoneNumber} for ${tenant.name}...`);

    const { connectionId } = await resolveTelnyxConnection(prisma);
    const platform = await loadPlatformSettings(prisma);
    const { buildMarginSnapshot } = require('../lib/marginAnalytics');
    const { getTenantBillingRates } = require('../lib/billing');
    const rates = getTenantBillingRates(tenant, platform);
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const item = rawItems.find((i) => i.phoneNumber === phoneNumber) || {
      phoneNumber,
      upfrontCost: String(req.body.upfrontCost ?? '0'),
      monthlyCost: String(req.body.monthlyCost ?? '0'),
    };
    const margin = buildMarginSnapshot({ item, rates, source: 'ADMIN_DIRECT' });

    const result = await buyAndAssignNumber({
      phoneNumber,
      tenant,
      prisma,
      apiKey: TELNYX_API_KEY,
      connectionId,
      messagingProfileId: getMessagingProfileId(platform),
      marginData: margin,
    });

    let order = null;
    if (!result.alreadyOwned) {
      const orderItems = [item];
      order = await recordAdminDirectOrder({
        prisma,
        tenant,
        items: orderItems,
        connectionId,
        purchased: [{ phoneNumber, message: 'Purchased successfully' }],
        failed: [],
        billTenantAutomatically: Boolean(billTenantAutomatically),
      });

      if (order?.id) {
        await prisma.phoneNumber.updateMany({
          where: { tenantId: tenant.id, number: phoneNumber },
          data: { orderId: order.id },
        });
      }
    }

    res.json({
      success: true,
      message: result.alreadyOwned
        ? 'Number is already assigned to your organization'
        : 'Number purchased and assigned successfully',
      data: result.savedNumber,
      connectionAssigned: result.connectionAssigned,
      messagingProfileAssigned: result.messagingProfileAssigned,
      texmlConfigured: Boolean(connectionId),
      order,
    });
  } catch (error) {
    console.error('❌ Buy number error:', error.message);
    res.status(error.status || 500).json({
      error: error.message || 'Failed to buy number',
    });
  }
});

router.use(extensionRoutes);
router.use(ringGroupRoutes);

module.exports = router;
