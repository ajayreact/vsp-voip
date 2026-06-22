const crypto = require('crypto');

const SETTINGS_ID = 'platform';
const ALGO = 'aes-256-gcm';
let cache = null;

function getEncryptionKey() {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY
    || process.env.DATABASE_URL
    || 'vsp-voip-dev-settings-key';
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(blob) {
  if (!blob) return null;
  try {
    const buf = Buffer.from(blob, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

function maskSecret(value) {
  if (!value || value.length < 8) return value ? '••••••••' : null;
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

function envDefaults() {
  return {
    defaultFeeSetup: Number(process.env.BILLING_MARKUP_UPFRONT || 0),
    defaultFeeMonthly: Number(process.env.BILLING_MARKUP_MONTHLY || 8),
    defaultFeeFirstMonth: null,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY?.trim() || null,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY?.trim() || null,
  };
}

function mapRow(row) {
  const env = envDefaults();
  if (!row) {
    return {
      defaultFeeSetup: env.defaultFeeSetup,
      defaultFeeMonthly: env.defaultFeeMonthly,
      defaultFeeFirstMonth: env.defaultFeeFirstMonth,
      stripeSecretKey: env.stripeSecretKey,
      stripeWebhookSecret: env.stripeWebhookSecret,
      stripePublishableKey: env.stripePublishableKey,
      stripeEnabled: Boolean(env.stripeSecretKey),
      bankName: '',
      bankAccountName: '',
      bankAccountNumber: '',
      bankRoutingNumber: '',
      bankSwiftCode: '',
      bankPaymentInstructions: '',
    invoiceContactEmail: '',
    telnyxConnectionId: process.env.TELNYX_CONNECTION_ID?.trim() || '',
    telnyxConnectionName: process.env.TELNYX_CONNECTION_NAME?.trim() || 'VSP-VOIP Voice App',
    telnyxCredentialConnectionId: process.env.TELNYX_CREDENTIAL_CONNECTION_ID?.trim() || '',
    telnyxMessagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID?.trim() || '',
    telnyxCallControlApplicationId: process.env.TELNYX_CALL_CONTROL_APP_ID?.trim() || '',
    defaultMaxUsers: 25,
    defaultMaxPhoneNumbers: 20,
    defaultMaxConcurrentCalls: 5,
    lcrPrimaryConnectionId: '',
    lcrFallbackConnectionId: '',
    lcrNotes: '',
    source: 'env',
    };
  }

  const stripeSecretKey = decrypt(row.stripeSecretKeyEnc) || env.stripeSecretKey;
  const stripeWebhookSecret = decrypt(row.stripeWebhookSecretEnc) || env.stripeWebhookSecret;

  return {
    defaultFeeSetup: Number(row.defaultFeeSetup),
    defaultFeeMonthly: Number(row.defaultFeeMonthly),
    defaultFeeFirstMonth: row.defaultFeeFirstMonth != null ? Number(row.defaultFeeFirstMonth) : null,
    stripeSecretKey,
    stripeWebhookSecret,
    stripePublishableKey: row.stripePublishableKey || env.stripePublishableKey,
    stripeEnabled: Boolean(stripeSecretKey),
    bankName: row.bankName || '',
    bankAccountName: row.bankAccountName || '',
    bankAccountNumber: row.bankAccountNumber || '',
    bankRoutingNumber: row.bankRoutingNumber || '',
    bankSwiftCode: row.bankSwiftCode || '',
    bankPaymentInstructions: row.bankPaymentInstructions || '',
    invoiceContactEmail: row.invoiceContactEmail || '',
    telnyxConnectionId: row.telnyxConnectionId || process.env.TELNYX_CONNECTION_ID?.trim() || '',
    telnyxConnectionName: row.telnyxConnectionName
      || process.env.TELNYX_CONNECTION_NAME?.trim()
      || 'VSP-VOIP Voice App',
    telnyxCredentialConnectionId: row.telnyxCredentialConnectionId
      || process.env.TELNYX_CREDENTIAL_CONNECTION_ID?.trim()
      || '',
    telnyxMessagingProfileId: row.telnyxMessagingProfileId
      || process.env.TELNYX_MESSAGING_PROFILE_ID?.trim()
      || '',
    telnyxCallControlApplicationId: row.telnyxCallControlApplicationId
      || process.env.TELNYX_CALL_CONTROL_APP_ID?.trim()
      || '',
    defaultMaxUsers: row.defaultMaxUsers ?? 25,
    defaultMaxPhoneNumbers: row.defaultMaxPhoneNumbers ?? 20,
    defaultMaxConcurrentCalls: row.defaultMaxConcurrentCalls ?? 5,
    lcrPrimaryConnectionId: row.lcrPrimaryConnectionId || '',
    lcrFallbackConnectionId: row.lcrFallbackConnectionId || '',
    lcrNotes: row.lcrNotes || '',
    source: 'database',
  };
}

async function loadPlatformSettings(prisma, { force = false } = {}) {
  if (cache && !force) return cache;

  const row = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
  cache = mapRow(row);
  return cache;
}

function invalidatePlatformSettingsCache() {
  cache = null;
}

function getDefaultFees(platform) {
  const p = platform || cache || envDefaults();
  const monthly = p.defaultFeeMonthly ?? Number(process.env.BILLING_MARKUP_MONTHLY || 8);
  return {
    setup: p.defaultFeeSetup ?? Number(process.env.BILLING_MARKUP_UPFRONT || 0),
    monthly,
    firstMonth: p.defaultFeeFirstMonth != null ? p.defaultFeeFirstMonth : monthly,
  };
}

function toPublicSettings(platform) {
  return {
    stripePublishableKey: platform.stripePublishableKey || '',
    stripeSecretKeyConfigured: Boolean(platform.stripeSecretKey),
    stripeSecretKeyPreview: maskSecret(platform.stripeSecretKey),
    stripeWebhookConfigured: Boolean(platform.stripeWebhookSecret),
    stripeWebhookPreview: maskSecret(platform.stripeWebhookSecret),
    stripeEnabled: platform.stripeEnabled,
    manualPaymentEnabled: Boolean(
      platform.bankAccountNumber
      || platform.bankRoutingNumber
      || platform.bankPaymentInstructions
      || platform.bankName,
    ),
    defaultFeeSetup: platform.defaultFeeSetup,
    defaultFeeMonthly: platform.defaultFeeMonthly,
    defaultFeeFirstMonth: platform.defaultFeeFirstMonth,
    bankName: platform.bankName || '',
    bankAccountName: platform.bankAccountName || '',
    bankAccountNumber: platform.bankAccountNumber || '',
    bankRoutingNumber: platform.bankRoutingNumber || '',
    bankSwiftCode: platform.bankSwiftCode || '',
    bankPaymentInstructions: platform.bankPaymentInstructions || '',
    invoiceContactEmail: platform.invoiceContactEmail || '',
    telnyxConnectionId: platform.telnyxConnectionId || '',
    telnyxConnectionName: platform.telnyxConnectionName || 'VSP-VOIP Voice App',
    telnyxCredentialConnectionId: platform.telnyxCredentialConnectionId || '',
    telnyxMessagingProfileId: platform.telnyxMessagingProfileId || '',
    telnyxCallControlApplicationId: platform.telnyxCallControlApplicationId || '',
    defaultMaxUsers: platform.defaultMaxUsers ?? 25,
    defaultMaxPhoneNumbers: platform.defaultMaxPhoneNumbers ?? 20,
    defaultMaxConcurrentCalls: platform.defaultMaxConcurrentCalls ?? 5,
    lcrPrimaryConnectionId: platform.lcrPrimaryConnectionId || '',
    lcrFallbackConnectionId: platform.lcrFallbackConnectionId || '',
    lcrNotes: platform.lcrNotes || '',
    webhookUrl: `${process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`}/api/billing/webhook`,
    smsWebhookUrl: `${process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`}/webhook/sms`,
    callControlWebhookUrl: `${process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`}/webhook/call-control`,
  };
}

async function getPublicPlatformSettings(prisma) {
  const platform = await loadPlatformSettings(prisma);
  return toPublicSettings(platform);
}

async function updatePlatformSettings(prisma, input) {
  const current = await loadPlatformSettings(prisma);
  const data = {
    defaultFeeSetup: input.defaultFeeSetup ?? current.defaultFeeSetup,
    defaultFeeMonthly: input.defaultFeeMonthly ?? current.defaultFeeMonthly,
    defaultFeeFirstMonth: input.defaultFeeFirstMonth === ''
      ? null
      : (input.defaultFeeFirstMonth ?? current.defaultFeeFirstMonth),
    stripePublishableKey: input.stripePublishableKey !== undefined
      ? (input.stripePublishableKey || null)
      : (current.stripePublishableKey || null),
    bankName: input.bankName !== undefined ? (input.bankName || null) : (current.bankName || null),
    bankAccountName: input.bankAccountName !== undefined
      ? (input.bankAccountName || null)
      : (current.bankAccountName || null),
    bankAccountNumber: input.bankAccountNumber !== undefined
      ? (input.bankAccountNumber || null)
      : (current.bankAccountNumber || null),
    bankRoutingNumber: input.bankRoutingNumber !== undefined
      ? (input.bankRoutingNumber || null)
      : (current.bankRoutingNumber || null),
    bankSwiftCode: input.bankSwiftCode !== undefined
      ? (input.bankSwiftCode || null)
      : (current.bankSwiftCode || null),
    bankPaymentInstructions: input.bankPaymentInstructions !== undefined
      ? (input.bankPaymentInstructions || null)
      : (current.bankPaymentInstructions || null),
    invoiceContactEmail: input.invoiceContactEmail !== undefined
      ? (input.invoiceContactEmail || null)
      : (current.invoiceContactEmail || null),
    telnyxConnectionId: input.telnyxConnectionId !== undefined
      ? (input.telnyxConnectionId || null)
      : (current.telnyxConnectionId || null),
    telnyxConnectionName: input.telnyxConnectionName !== undefined
      ? (input.telnyxConnectionName || null)
      : (current.telnyxConnectionName || null),
    telnyxCredentialConnectionId: input.telnyxCredentialConnectionId !== undefined
      ? (input.telnyxCredentialConnectionId || null)
      : (current.telnyxCredentialConnectionId || null),
    telnyxMessagingProfileId: input.telnyxMessagingProfileId !== undefined
      ? (input.telnyxMessagingProfileId || null)
      : (current.telnyxMessagingProfileId || null),
    telnyxCallControlApplicationId: input.telnyxCallControlApplicationId !== undefined
      ? (input.telnyxCallControlApplicationId || null)
      : (current.telnyxCallControlApplicationId || null),
    defaultMaxUsers: input.defaultMaxUsers !== undefined
      ? Number(input.defaultMaxUsers)
      : (current.defaultMaxUsers ?? 25),
    defaultMaxPhoneNumbers: input.defaultMaxPhoneNumbers !== undefined
      ? Number(input.defaultMaxPhoneNumbers)
      : (current.defaultMaxPhoneNumbers ?? 20),
    defaultMaxConcurrentCalls: input.defaultMaxConcurrentCalls !== undefined
      ? Number(input.defaultMaxConcurrentCalls)
      : (current.defaultMaxConcurrentCalls ?? 5),
    lcrPrimaryConnectionId: input.lcrPrimaryConnectionId !== undefined
      ? (input.lcrPrimaryConnectionId || null)
      : (current.lcrPrimaryConnectionId || null),
    lcrFallbackConnectionId: input.lcrFallbackConnectionId !== undefined
      ? (input.lcrFallbackConnectionId || null)
      : (current.lcrFallbackConnectionId || null),
    lcrNotes: input.lcrNotes !== undefined
      ? (input.lcrNotes || null)
      : (current.lcrNotes || null),
  };

  let stripeSecretKeyEnc;
  if (input.stripeSecretKey !== undefined && input.stripeSecretKey !== '') {
    stripeSecretKeyEnc = encrypt(String(input.stripeSecretKey).trim());
  } else {
    const existing = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
    stripeSecretKeyEnc = existing?.stripeSecretKeyEnc ?? null;
    if (!stripeSecretKeyEnc && current.stripeSecretKey && input.stripeSecretKey === undefined) {
      stripeSecretKeyEnc = encrypt(current.stripeSecretKey);
    }
  }

  let stripeWebhookSecretEnc;
  if (input.stripeWebhookSecret !== undefined && input.stripeWebhookSecret !== '') {
    stripeWebhookSecretEnc = encrypt(String(input.stripeWebhookSecret).trim());
  } else {
    const existing = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
    stripeWebhookSecretEnc = existing?.stripeWebhookSecretEnc ?? null;
    if (!stripeWebhookSecretEnc && current.stripeWebhookSecret && input.stripeWebhookSecret === undefined) {
      stripeWebhookSecretEnc = encrypt(current.stripeWebhookSecret);
    }
  }

  await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      ...data,
      stripeSecretKeyEnc,
      stripeWebhookSecretEnc,
    },
    update: {
      ...data,
      stripeSecretKeyEnc,
      stripeWebhookSecretEnc,
    },
  });

  invalidatePlatformSettingsCache();
  const updated = await loadPlatformSettings(prisma, { force: true });
  return toPublicSettings(updated);
}

module.exports = {
  loadPlatformSettings,
  invalidatePlatformSettingsCache,
  getDefaultFees,
  getPublicPlatformSettings,
  updatePlatformSettings,
  maskSecret,
  decrypt,
  encrypt,
};
