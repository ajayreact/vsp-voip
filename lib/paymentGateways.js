const { loadPlatformSettings, invalidatePlatformSettingsCache } = require('./platformSettings');

const GATEWAY_ID = 'default';
const DEFAULT_DISPLAY_ORDER = ['bank', 'stripe', 'razorpay'];

let cache = null;

function parseDisplayOrder(value) {
  if (Array.isArray(value)) {
    return value.filter((id) => ['bank', 'stripe', 'razorpay'].includes(id));
  }
  return [...DEFAULT_DISPLAY_ORDER];
}

function isBankConfigured(gateway) {
  return Boolean(
    gateway.bankAccountNumber
    || gateway.bankIfscSwift
    || gateway.bankPaymentInstructions
    || gateway.bankName,
  );
}

function mapGatewayRow(row, platform) {
  const { decrypt, maskSecret } = require('./platformSettings');
  const displayOrder = parseDisplayOrder(row?.displayOrder);

  const bankAccountName = row?.bankAccountName || platform?.bankAccountName || '';
  const bankName = row?.bankName || platform?.bankName || '';
  const bankAccountNumber = row?.bankAccountNumber || platform?.bankAccountNumber || '';
  const bankIfscSwift = row?.bankIfscSwift
    || platform?.bankRoutingNumber
    || platform?.bankSwiftCode
    || '';
  const bankBranch = row?.bankBranch || '';
  const bankPaymentInstructions = row?.bankPaymentInstructions || platform?.bankPaymentInstructions || '';

  const stripeKeysConfigured = Boolean(platform?.stripeSecretKey);
  const razorpayKeyId = row?.razorpayKeyIdEnc ? decrypt(row.razorpayKeyIdEnc) : null;
  const razorpayKeySecret = row?.razorpayKeySecretEnc ? decrypt(row.razorpayKeySecretEnc) : null;

  return {
    id: GATEWAY_ID,
    bankTransferEnabled: row?.bankTransferEnabled ?? true,
    stripeEnabled: row?.stripeEnabled ?? false,
    razorpayEnabled: row?.razorpayEnabled ?? false,
    stripeMode: row?.stripeMode || 'test',
    razorpayMode: row?.razorpayMode || 'test',
    displayOrder,
    bankAccountName,
    bankName,
    bankAccountNumber,
    bankIfscSwift,
    bankBranch,
    bankPaymentInstructions,
    razorpayKeyId,
    razorpayKeyIdPreview: maskSecret(razorpayKeyId),
    razorpayConfigured: Boolean(razorpayKeyId && razorpayKeySecret),
    bankConfigured: isBankConfigured({
      bankAccountNumber,
      bankIfscSwift,
      bankPaymentInstructions,
      bankName,
    }),
    stripeKeysConfigured,
  };
}

async function ensureGatewayRow(prisma) {
  let row = await prisma.paymentGatewaySettings.findUnique({ where: { id: GATEWAY_ID } });
  if (row) return row;

  row = await prisma.paymentGatewaySettings.create({
    data: {
      id: GATEWAY_ID,
      bankTransferEnabled: true,
      stripeEnabled: false,
      razorpayEnabled: false,
      displayOrder: DEFAULT_DISPLAY_ORDER,
    },
  });

  const platform = await prisma.platformSettings.findUnique({ where: { id: 'platform' } });
  if (platform) {
    row = await prisma.paymentGatewaySettings.update({
      where: { id: GATEWAY_ID },
      data: {
        bankAccountName: platform.bankAccountName,
        bankName: platform.bankName,
        bankAccountNumber: platform.bankAccountNumber,
        bankIfscSwift: platform.bankRoutingNumber || platform.bankSwiftCode,
        bankPaymentInstructions: platform.bankPaymentInstructions,
      },
    });
  }

  return row;
}

async function loadPaymentGatewaySettings(prisma, { force = false } = {}) {
  if (cache && !force) return cache;

  const platform = await loadPlatformSettings(prisma);
  const row = await ensureGatewayRow(prisma);
  cache = mapGatewayRow(row, platform);
  return cache;
}

function invalidatePaymentGatewayCache() {
  cache = null;
}

function getCheckoutGateways(gateway) {
  const items = [];

  for (const id of gateway.displayOrder) {
    if (id === 'bank' && gateway.bankTransferEnabled && gateway.bankConfigured) {
      items.push({
        id: 'bank',
        label: 'Bank Transfer',
        available: true,
        placeholder: false,
      });
    }
    if (id === 'stripe' && gateway.stripeEnabled && gateway.stripeKeysConfigured) {
      items.push({
        id: 'stripe',
        label: 'Credit / Debit Card (Stripe)',
        available: true,
        placeholder: false,
        mode: gateway.stripeMode,
      });
    }
    if (id === 'razorpay' && gateway.razorpayEnabled && gateway.razorpayConfigured) {
      items.push({
        id: 'razorpay',
        label: 'Razorpay',
        available: true,
        placeholder: false,
        mode: gateway.razorpayMode,
      });
    }
  }

  return items;
}

function toAdminGatewaySettings(gateway) {
  return {
    bankTransferEnabled: gateway.bankTransferEnabled,
    stripeEnabled: gateway.stripeEnabled,
    razorpayEnabled: gateway.razorpayEnabled,
    stripeMode: gateway.stripeMode,
    razorpayMode: gateway.razorpayMode,
    displayOrder: gateway.displayOrder,
    bankAccountName: gateway.bankAccountName,
    bankName: gateway.bankName,
    bankAccountNumber: gateway.bankAccountNumber,
    bankIfscSwift: gateway.bankIfscSwift,
    bankBranch: gateway.bankBranch,
    bankPaymentInstructions: gateway.bankPaymentInstructions,
    bankConfigured: gateway.bankConfigured,
    stripeKeysConfigured: gateway.stripeKeysConfigured,
    razorpayKeyIdPreview: gateway.razorpayKeyIdPreview,
    razorpayConfigured: gateway.razorpayConfigured,
    checkoutGateways: getCheckoutGateways(gateway),
  };
}

function toPublicCheckoutConfig(gateway) {
  const checkoutGateways = getCheckoutGateways(gateway);
  return {
    gateways: checkoutGateways,
    stripeEnabled: checkoutGateways.some((g) => g.id === 'stripe' && g.available),
    manualPaymentEnabled: checkoutGateways.some((g) => g.id === 'bank' && g.available),
    razorpayVisible: checkoutGateways.some((g) => g.id === 'razorpay'),
    razorpayEnabled: checkoutGateways.some((g) => g.id === 'razorpay' && g.available),
    bankDetails: gateway.bankTransferEnabled && gateway.bankConfigured
      ? {
          bankAccountName: gateway.bankAccountName,
          bankName: gateway.bankName,
          bankAccountNumber: gateway.bankAccountNumber,
          bankIfscSwift: gateway.bankIfscSwift,
          bankBranch: gateway.bankBranch,
          bankPaymentInstructions: gateway.bankPaymentInstructions,
        }
      : null,
  };
}

async function updatePaymentGatewaySettings(prisma, input) {
  const { encrypt } = require('./platformSettings');
  const current = await loadPaymentGatewaySettings(prisma);

  const data = {
    bankTransferEnabled: input.bankTransferEnabled ?? current.bankTransferEnabled,
    stripeEnabled: input.stripeEnabled ?? current.stripeEnabled,
    razorpayEnabled: input.razorpayEnabled ?? current.razorpayEnabled,
    stripeMode: input.stripeMode === 'live' ? 'live' : (input.stripeMode === 'test' ? 'test' : current.stripeMode),
    razorpayMode: input.razorpayMode === 'live' ? 'live' : (input.razorpayMode === 'test' ? 'test' : current.razorpayMode),
    displayOrder: input.displayOrder ? parseDisplayOrder(input.displayOrder) : current.displayOrder,
    bankAccountName: input.bankAccountName !== undefined ? (input.bankAccountName || null) : (current.bankAccountName || null),
    bankName: input.bankName !== undefined ? (input.bankName || null) : (current.bankName || null),
    bankAccountNumber: input.bankAccountNumber !== undefined ? (input.bankAccountNumber || null) : (current.bankAccountNumber || null),
    bankIfscSwift: input.bankIfscSwift !== undefined ? (input.bankIfscSwift || null) : (current.bankIfscSwift || null),
    bankBranch: input.bankBranch !== undefined ? (input.bankBranch || null) : (current.bankBranch || null),
    bankPaymentInstructions: input.bankPaymentInstructions !== undefined
      ? (input.bankPaymentInstructions || null)
      : (current.bankPaymentInstructions || null),
  };

  let razorpayKeyIdEnc;
  if (input.razorpayKeyId !== undefined && input.razorpayKeyId !== '') {
    razorpayKeyIdEnc = encrypt(String(input.razorpayKeyId).trim());
  } else {
    const existing = await prisma.paymentGatewaySettings.findUnique({ where: { id: GATEWAY_ID } });
    razorpayKeyIdEnc = existing?.razorpayKeyIdEnc ?? null;
  }

  let razorpayKeySecretEnc;
  if (input.razorpayKeySecret !== undefined && input.razorpayKeySecret !== '') {
    razorpayKeySecretEnc = encrypt(String(input.razorpayKeySecret).trim());
  } else {
    const existing = await prisma.paymentGatewaySettings.findUnique({ where: { id: GATEWAY_ID } });
    razorpayKeySecretEnc = existing?.razorpayKeySecretEnc ?? null;
  }

  let razorpayWebhookSecretEnc;
  if (input.razorpayWebhookSecret !== undefined && input.razorpayWebhookSecret !== '') {
    razorpayWebhookSecretEnc = encrypt(String(input.razorpayWebhookSecret).trim());
  } else {
    const existing = await prisma.paymentGatewaySettings.findUnique({ where: { id: GATEWAY_ID } });
    razorpayWebhookSecretEnc = existing?.razorpayWebhookSecretEnc ?? null;
  }

  await prisma.paymentGatewaySettings.upsert({
    where: { id: GATEWAY_ID },
    create: { id: GATEWAY_ID, ...data, razorpayKeyIdEnc, razorpayKeySecretEnc, razorpayWebhookSecretEnc },
    update: { ...data, razorpayKeyIdEnc, razorpayKeySecretEnc, razorpayWebhookSecretEnc },
  });

  invalidatePaymentGatewayCache();
  invalidatePlatformSettingsCache();
  return toAdminGatewaySettings(await loadPaymentGatewaySettings(prisma, { force: true }));
}

async function getBankPaymentStats(prisma) {
  const [pending, approved, rejected] = await Promise.all([
    prisma.numberOrder.count({
      where: {
        paymentMethod: 'MANUAL_BANK',
        OR: [
          { status: 'PENDING_PAYMENT' },
          { status: 'PENDING' },
          { paymentReviewStatus: 'PENDING' },
        ],
        NOT: { status: { in: ['FULFILLED', 'CANCELLED', 'FAILED'] } },
      },
    }),
    prisma.numberOrder.count({
      where: {
        paymentMethod: 'MANUAL_BANK',
        paymentReviewStatus: 'APPROVED',
      },
    }),
    prisma.numberOrder.count({
      where: {
        paymentMethod: 'MANUAL_BANK',
        paymentReviewStatus: 'REJECTED',
      },
    }),
  ]);

  return { pending, approved, rejected };
}

module.exports = {
  loadPaymentGatewaySettings,
  invalidatePaymentGatewayCache,
  updatePaymentGatewaySettings,
  toAdminGatewaySettings,
  toPublicCheckoutConfig,
  getCheckoutGateways,
  isBankConfigured,
  getBankPaymentStats,
  DEFAULT_DISPLAY_ORDER,
};
