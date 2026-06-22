const crypto = require('crypto');
const Razorpay = require('razorpay');
const { loadPlatformSettings } = require('./platformSettings');
const { loadPaymentGatewaySettings } = require('./paymentGateways');
const { getTelnyxConnectionConfig } = require('./telnyxConfig');
const { logger } = require('./logger');
const { isProduction } = require('./env');
const { writeSystemAuditLog } = require('./auditLog');
const {
  calculateCartPricing,
  fulfillNumberOrder,
  acquireFulfillmentLock,
  releaseFulfillmentLock,
  claimOrderForFulfillment,
  serializeOrder,
} = require('./billing');
const { buildInvoiceNumber } = require('./invoice');
const {
  ensureBankTransferReceivable,
  markBankTransferReceivablePaid,
  ensureOrderInvoice,
} = require('./receivables');

const INR_EXCHANGE_RATE = Number(process.env.RAZORPAY_INR_EXCHANGE_RATE || 83);

function toMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function usdToInrPaise(usdAmount) {
  return Math.round(Number(usdAmount) * INR_EXCHANGE_RATE * 100);
}

function inrPaiseToUsd(paise) {
  return toMoney(Number(paise) / 100 / INR_EXCHANGE_RATE);
}

async function getRazorpayCredentials(prisma) {
  const gateway = await loadPaymentGatewaySettings(prisma);
  const row = await prisma.paymentGatewaySettings.findUnique({ where: { id: 'default' } });
  const { decrypt } = require('./platformSettings');

  const keyId = row?.razorpayKeyIdEnc ? decrypt(row.razorpayKeyIdEnc) : null;
  const keySecret = row?.razorpayKeySecretEnc ? decrypt(row.razorpayKeySecretEnc) : null;
  const webhookSecret = row?.razorpayWebhookSecretEnc
    ? decrypt(row.razorpayWebhookSecretEnc)
    : process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || null;

  return {
    keyId,
    keySecret,
    webhookSecret,
    mode: gateway.razorpayMode || 'test',
    enabled: gateway.razorpayEnabled,
    configured: Boolean(keyId && keySecret),
  };
}

async function getRazorpayClient(prisma) {
  const creds = await getRazorpayCredentials(prisma);
  if (!creds.configured) return null;
  return new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
}

function verifyPaymentSignature({ orderId, paymentId, signature, keySecret }) {
  if (!orderId || !paymentId || !signature || !keySecret) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
  return expected === signature;
}

function verifyWebhookSignature(rawBody, signature, webhookSecret) {
  if (!webhookSecret || !signature) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
  const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
  return expected === signature;
}

async function claimRazorpayEvent(prisma, event) {
  try {
    await prisma.processedRazorpayEvent.create({
      data: {
        id: event.id || `${event.event}_${event.payload?.payment?.entity?.id || Date.now()}`,
        type: event.event,
        orderId: event.payload?.payment?.entity?.notes?.orderId
          || event.payload?.order?.entity?.notes?.orderId
          || null,
      },
    });
    return true;
  } catch (error) {
    if (error.code === 'P2002') return false;
    throw error;
  }
}

async function createRazorpayCheckoutOrder({ prisma, tenant, items, connectionId }) {
  const platform = await loadPlatformSettings(prisma);
  const gateway = await loadPaymentGatewaySettings(prisma);
  const creds = await getRazorpayCredentials(prisma);

  if (!gateway.razorpayEnabled) {
    const error = new Error('Razorpay is not enabled. Contact your administrator.');
    error.status = 503;
    throw error;
  }
  if (!creds.configured) {
    const error = new Error('Razorpay is not configured. Add Razorpay keys in Payment Gateways.');
    error.status = 503;
    throw error;
  }
  if (!items?.length) {
    const error = new Error('Cart is empty');
    error.status = 400;
    throw error;
  }

  const razorpay = await getRazorpayClient(prisma);
  const pricing = calculateCartPricing(items, tenant, platform);
  const phoneNumbers = items.map((i) => i.phoneNumber);
  const invoiceNumber = buildInvoiceNumber();
  const amountPaise = usdToInrPaise(pricing.dueToday);

  const order = await prisma.numberOrder.create({
    data: {
      tenantId: tenant.id,
      status: 'PENDING',
      paymentMethod: 'RAZORPAY',
      invoiceNumber,
      connectionId: connectionId || null,
      phoneNumbers,
      carrierUpfront: pricing.carrierUpfront,
      carrierMonthly: pricing.carrierMonthly,
      platformFee: pricing.platformFee,
      totalCharged: pricing.dueToday,
      currency: 'USD',
    },
    include: { tenant: true },
  });

  await ensureBankTransferReceivable({ prisma, tenant, order });

  const razorpayOrder = await razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: order.id.slice(0, 40),
    notes: {
      orderId: order.id,
      tenantId: tenant.id,
      invoiceNumber,
      connectionId: connectionId || '',
    },
  });

  await prisma.numberOrder.update({
    where: { id: order.id },
    data: { razorpayOrderId: razorpayOrder.id },
  });

  return {
    orderId: order.id,
    invoiceNumber,
    razorpayOrderId: razorpayOrder.id,
    razorpayKeyId: creds.keyId,
    amount: amountPaise,
    currency: 'INR',
    amountUsd: pricing.dueToday,
    mode: creds.mode,
    order: serializeOrder({ ...order, razorpayOrderId: razorpayOrder.id }, tenant),
  };
}

async function finalizeRazorpayPayment({
  prisma,
  orderId,
  razorpayPaymentId,
  razorpayOrderId,
  razorpaySignature,
  apiKey,
  defaultConnectionId,
  skipSignatureVerify = false,
}) {
  const creds = await getRazorpayCredentials(prisma);
  const order = await prisma.numberOrder.findUnique({
    where: { id: orderId },
    include: { tenant: true },
  });

  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }
  if (order.paymentMethod !== 'RAZORPAY') {
    const error = new Error('Not a Razorpay order');
    error.status = 400;
    throw error;
  }
  if (order.razorpayOrderId && razorpayOrderId && order.razorpayOrderId !== razorpayOrderId) {
    const error = new Error('Razorpay order mismatch');
    error.status = 400;
    throw error;
  }

  if (!skipSignatureVerify) {
    const valid = verifyPaymentSignature({
      orderId: order.razorpayOrderId || razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      keySecret: creds.keySecret,
    });
    if (!valid) {
      const error = new Error('Invalid Razorpay payment signature');
      error.status = 400;
      error.code = 'RAZORPAY_SIGNATURE_INVALID';
      throw error;
    }
  }

  if (order.status === 'FULFILLED' || order.status === 'PARTIAL') {
    return {
      alreadyFulfilled: true,
      order: serializeOrder(order, order.tenant),
      purchased: [],
      failed: [],
      message: order.fulfillmentNote || 'Order already processed',
    };
  }

  const lockAcquired = await acquireFulfillmentLock(prisma, order.id);
  if (!lockAcquired) {
    const current = await prisma.numberOrder.findUnique({
      where: { id: order.id },
      include: { tenant: true },
    });
    if (current?.status === 'FULFILLED' || current?.status === 'PARTIAL') {
      return {
        alreadyFulfilled: true,
        order: serializeOrder(current, current.tenant),
        purchased: [],
        failed: [],
        message: current.fulfillmentNote || 'Order already processed',
      };
    }
    const error = new Error('Order fulfillment already in progress');
    error.status = 409;
    throw error;
  }

  try {
    const claimed = await claimOrderForFulfillment(prisma, order.id);
    if (!claimed) {
      const current = await prisma.numberOrder.findUnique({
        where: { id: order.id },
        include: { tenant: true },
      });
      return {
        alreadyFulfilled: current?.status === 'FULFILLED' || current?.status === 'PARTIAL',
        order: serializeOrder(current, current.tenant),
        purchased: [],
        failed: [],
        message: current?.fulfillmentNote || 'Order already processed',
      };
    }

    const paidAt = new Date();
    const platform = await loadPlatformSettings(prisma);
    const items = (Array.isArray(order.phoneNumbers) ? order.phoneNumbers : []).map((phoneNumber) => ({
      phoneNumber,
      upfrontCost: String(Number(order.carrierUpfront) / Math.max(1, order.phoneNumbers.length)),
      monthlyCost: String(Number(order.carrierMonthly) / Math.max(1, order.phoneNumbers.length)),
    }));

    await ensureOrderInvoice({ prisma, order, tenant: order.tenant, platform, items });

    await prisma.numberOrder.update({
      where: { id: order.id },
      data: {
        razorpayPaymentId: razorpayPaymentId,
        invoicePaidAt: paidAt,
        paymentFailureReason: null,
      },
    });

    await markBankTransferReceivablePaid({ prisma, orderId: order.id, paidAt });

    const freshOrder = await prisma.numberOrder.findUnique({
      where: { id: order.id },
      include: { tenant: true },
    });

    const itemsByPhone = Object.fromEntries(items.map((i) => [i.phoneNumber, i]));
    const result = await fulfillNumberOrder({
      prisma,
      order: freshOrder,
      apiKey,
      defaultConnectionId: defaultConnectionId || freshOrder.connectionId,
      subscriptionMap: null,
      platform,
      fulfillmentSource: 'RAZORPAY',
      itemsByPhone,
    });

    await writeSystemAuditLog(prisma, {
      action: 'order.payment_approved',
      entityType: 'NumberOrder',
      entityId: order.id,
      details: {
        gateway: 'RAZORPAY',
        razorpayPaymentId,
        purchased: result.purchased?.length || 0,
        failed: result.failed?.length || 0,
      },
    });

    const updated = await prisma.numberOrder.findUnique({
      where: { id: order.id },
      include: { tenant: true },
    });

    return {
      alreadyFulfilled: false,
      order: serializeOrder(updated, updated.tenant),
      ...result,
    };
  } finally {
    await releaseFulfillmentLock(prisma, order.id);
  }
}

async function markRazorpayPaymentFailed({ prisma, orderId, reason, razorpayPaymentId }) {
  const order = await prisma.numberOrder.findUnique({ where: { id: orderId } });
  if (!order || order.paymentMethod !== 'RAZORPAY') return null;
  if (['FULFILLED', 'PARTIAL', 'CANCELLED'].includes(order.status)) return serializeOrder(order);

  const updated = await prisma.numberOrder.update({
    where: { id: orderId },
    data: {
      status: 'PENDING',
      paymentFailureReason: reason || 'Payment failed',
      ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
    },
    include: { tenant: true },
  });

  await writeSystemAuditLog(prisma, {
    action: 'order.payment_failed',
    entityType: 'NumberOrder',
    entityId: orderId,
    details: { gateway: 'RAZORPAY', reason, razorpayPaymentId },
  });

  return serializeOrder(updated, updated.tenant);
}

async function handleRazorpayWebhook(rawBody, signature) {
  const { getPrisma } = require('../db');
  const prisma = await getPrisma();
  const creds = await getRazorpayCredentials(prisma);

  if (!creds.webhookSecret) {
    if (isProduction() || signature) {
      const error = new Error('Razorpay webhook is not configured');
      error.status = 503;
      throw error;
    }
    logger.warn('razorpay_webhook_skipped', { reason: 'not_configured' });
    return { skipped: true };
  }

  if (!verifyWebhookSignature(rawBody, signature, creds.webhookSecret)) {
    const error = new Error('Invalid Razorpay webhook signature');
    error.status = 400;
    error.code = 'RAZORPAY_WEBHOOK_INVALID';
    throw error;
  }

  const event = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  const isNew = await claimRazorpayEvent(prisma, event);
  if (!isNew) {
    return { received: true, duplicate: true };
  }

  const platform = await loadPlatformSettings(prisma);
  const { connectionId } = getTelnyxConnectionConfig(platform);
  const apiKey = process.env.TELNYX_API_KEY?.trim();

  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.notes?.orderId;
    if (orderId) {
      await finalizeRazorpayPayment({
        prisma,
        orderId,
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id,
        skipSignatureVerify: true,
        apiKey,
        defaultConnectionId: connectionId,
      });
    }
  }

  if (event.event === 'payment.failed') {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.notes?.orderId;
    if (orderId) {
      await markRazorpayPaymentFailed({
        prisma,
        orderId,
        reason: payment.error_description || payment.error_reason || 'Payment failed',
        razorpayPaymentId: payment.id,
      });
    }
  }

  if (event.event === 'refund.processed') {
    const refund = event.payload?.refund?.entity;
    const paymentId = refund?.payment_id;
    if (paymentId && refund?.id) {
      const order = await prisma.numberOrder.findFirst({ where: { razorpayPaymentId: paymentId } });
      if (order) {
        const existing = await prisma.paymentRefund.findFirst({ where: { gatewayRefundId: refund.id } });
        if (!existing) {
          await prisma.paymentRefund.create({
            data: {
              orderId: order.id,
              tenantId: order.tenantId,
              paymentMethod: 'RAZORPAY',
              gatewayPaymentId: paymentId,
              gatewayRefundId: refund.id,
              amount: inrPaiseToUsd(refund.amount),
              currency: 'USD',
              status: 'processed',
              reason: 'Razorpay webhook refund.processed',
            },
          });
        }
      }
    }
  }

  return { received: true };
}

async function refundRazorpayOrder({ prisma, orderId, amountUsd, reason }) {
  const order = await prisma.numberOrder.findUnique({
    where: { id: orderId },
    include: { tenant: true },
  });
  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }
  if (order.paymentMethod !== 'RAZORPAY') {
    const error = new Error('Not a Razorpay order');
    error.status = 400;
    throw error;
  }
  if (!order.razorpayPaymentId) {
    const error = new Error('No Razorpay payment on this order');
    error.status = 400;
    throw error;
  }
  if (order.refundedAt) {
    const error = new Error('Order already refunded');
    error.status = 400;
    throw error;
  }

  const razorpay = await getRazorpayClient(prisma);
  if (!razorpay) {
    const error = new Error('Razorpay is not configured');
    error.status = 503;
    throw error;
  }

  const refundAmountUsd = amountUsd != null ? Number(amountUsd) : Number(order.totalCharged);
  const refundPaise = usdToInrPaise(refundAmountUsd);

  const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
    amount: refundPaise,
    notes: { orderId: order.id, reason: reason || 'Admin refund' },
  });

  const paidAt = new Date();
  await prisma.numberOrder.update({
    where: { id: order.id },
    data: {
      refundId: refund.id,
      refundedAt: paidAt,
      refundAmount: refundAmountUsd,
    },
  });

  await prisma.paymentRefund.create({
    data: {
      orderId: order.id,
      tenantId: order.tenantId,
      paymentMethod: 'RAZORPAY',
      gatewayPaymentId: order.razorpayPaymentId,
      gatewayRefundId: refund.id,
      amount: refundAmountUsd,
      currency: 'USD',
      status: 'processed',
      reason: reason || 'Admin refund',
    },
  });

  await prisma.tenantReceivable.updateMany({
    where: { orderId: order.id },
    data: { status: 'WRITTEN_OFF', notes: reason || 'Refunded via Razorpay' },
  });

  await writeSystemAuditLog(prisma, {
    action: 'order.refunded',
    entityType: 'NumberOrder',
    entityId: order.id,
    details: {
      gateway: 'RAZORPAY',
      refundId: refund.id,
      amount: refundAmountUsd,
      reason,
    },
  });

  return {
    refundId: refund.id,
    amount: refundAmountUsd,
    order: serializeOrder(
      await prisma.numberOrder.findUnique({ where: { id: order.id }, include: { tenant: true } }),
      order.tenant,
    ),
  };
}

module.exports = {
  getRazorpayCredentials,
  getRazorpayClient,
  verifyPaymentSignature,
  verifyWebhookSignature,
  createRazorpayCheckoutOrder,
  finalizeRazorpayPayment,
  markRazorpayPaymentFailed,
  handleRazorpayWebhook,
  refundRazorpayOrder,
  usdToInrPaise,
  inrPaiseToUsd,
  INR_EXCHANGE_RATE,
};
