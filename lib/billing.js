const Stripe = require('stripe');
const { buyAndAssignNumber } = require('./buyNumber');
const { getMessagingProfileId } = require('./sms');
const { loadPlatformSettings } = require('./platformSettings');
const { getTelnyxConnectionConfig } = require('./telnyxConfig');
const { getCallControlApplicationId } = require('./telnyxCallControlSetup');
const { isProduction } = require('./env');
const { logger } = require('./logger');
const {
  applyPaymentFailedGrace,
  applySubscriptionCancelledGrace,
} = require('./billingGrace');
const {
  buildInvoiceNumber,
  buildInvoiceContent,
  buildMailtoLink,
  isManualPaymentConfigured,
} = require('./invoice');
const { assertBankFulfillmentApproved } = require('./purchaseAuthorization');
const {
  buildMarginSnapshot,
  buildMarginFromOrderSplit,
  applyMarginToPhoneNumber,
} = require('./marginAnalytics');
const { createTenantReceivableForOrder, ensureOrderInvoice, ensureBankTransferReceivable, markBankTransferReceivablePaid } = require('./receivables');

const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3001';

async function getStripeClient(prisma) {
  const platform = await loadPlatformSettings(prisma);
  if (!platform.stripeSecretKey) return null;
  return new Stripe(platform.stripeSecretKey);
}

function toMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function decimalToNumber(value) {
  if (value == null) return 0;
  return Number(value);
}

function getTenantBillingRates(tenant, platform, gateway) {
  const defaults = platform
    ? {
        setup: platform.defaultFeeSetup,
        monthly: platform.defaultFeeMonthly,
        firstMonth: platform.defaultFeeFirstMonth ?? platform.defaultFeeMonthly,
      }
    : {
        setup: Number(process.env.BILLING_MARKUP_UPFRONT || 0),
        monthly: Number(process.env.BILLING_MARKUP_MONTHLY || 8),
        firstMonth: Number(process.env.BILLING_MARKUP_MONTHLY || 8),
      };

  const platformFeeSetup = tenant?.platformFeeSetup != null
    ? decimalToNumber(tenant.platformFeeSetup)
    : defaults.setup;
  const platformFeeMonthly = tenant?.platformFeeMonthly != null
    ? decimalToNumber(tenant.platformFeeMonthly)
    : defaults.monthly;
  const platformFeeFirstMonth = tenant?.platformFeeFirstMonth != null
    ? decimalToNumber(tenant.platformFeeFirstMonth)
    : defaults.firstMonth;

  const stripeKeysConfigured = Boolean(platform?.stripeSecretKey);
  const stripeGatewayEnabled = gateway?.stripeEnabled ?? false;
  const bankGatewayEnabled = gateway?.bankTransferEnabled ?? true;
  const bankConfigured = gateway?.bankConfigured ?? false;

  const manualPaymentEnabled = bankGatewayEnabled && bankConfigured;
  const stripeEnabled = stripeGatewayEnabled && stripeKeysConfigured;

  const manualPaymentEnabledLegacy = platform
    ? isManualPaymentConfigured(platform)
    : false;

  return {
    platformFeeSetup: toMoney(platformFeeSetup),
    platformFeeMonthly: toMoney(platformFeeMonthly),
    platformFeeFirstMonth: toMoney(platformFeeFirstMonth),
    currency: 'usd',
    stripeEnabled,
    manualPaymentEnabled: manualPaymentEnabled || (!gateway && manualPaymentEnabledLegacy),
    stripeGatewayEnabled,
    bankTransferEnabled: bankGatewayEnabled,
    razorpayEnabled: gateway?.razorpayEnabled ?? false,
  };
}

async function getBillingConfig(prisma, tenant) {
  const platform = await loadPlatformSettings(prisma);
  const { loadPaymentGatewaySettings, toPublicCheckoutConfig } = require('./paymentGateways');
  const gateway = await loadPaymentGatewaySettings(prisma);
  const rates = getTenantBillingRates(tenant, platform, gateway);
  const checkout = toPublicCheckoutConfig(gateway);
  return {
    ...rates,
    ...checkout,
    stripeEnabled: checkout.stripeEnabled,
    manualPaymentEnabled: checkout.manualPaymentEnabled,
  };
}

function calculateCartPricing(items, tenant, platform) {
  const rates = getTenantBillingRates(tenant, platform);
  const count = items.length;
  let carrierUpfront = 0;
  let carrierMonthly = 0;

  for (const item of items) {
    carrierUpfront += Number(item.upfrontCost) || 0;
    carrierMonthly += Number(item.monthlyCost) || 0;
  }

  const platformUpfront = rates.platformFeeSetup * count;
  const platformFirstMonth = rates.platformFeeFirstMonth * count;
  const platformRecurring = rates.platformFeeMonthly * count;

  const dueToday = carrierUpfront + carrierMonthly + platformUpfront + platformFirstMonth;
  const recurringMonthly = carrierMonthly + platformRecurring;

  return {
    ...rates,
    count,
    carrierUpfront: toMoney(carrierUpfront),
    carrierMonthly: toMoney(carrierMonthly),
    platformUpfront: toMoney(platformUpfront),
    platformFirstMonth: toMoney(platformFirstMonth),
    platformRecurring: toMoney(platformRecurring),
    platformFee: toMoney(platformUpfront + platformFirstMonth),
    dueToday: toMoney(dueToday),
    recurringMonthly: toMoney(recurringMonthly),
    orderTotal: toMoney(dueToday),
  };
}

async function getOrCreateStripeCustomer(prisma, tenant, email) {
  const stripe = await getStripeClient(prisma);
  if (!stripe) throw new Error('Stripe is not configured');

  if (tenant.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    name: tenant.name,
    metadata: { tenantId: tenant.id },
  });

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

function buildSubscriptionLineItems(items, tenant, platform) {
  const rates = getTenantBillingRates(tenant, platform);
  const lines = [];

  for (const item of items) {
    const carrierUpfront = Number(item.upfrontCost) || 0;
    const carrierMonthly = Number(item.monthlyCost) || 0;
    const recurringTotal = carrierMonthly + rates.platformFeeMonthly;
    const firstMonthPlatformExtra = Math.max(0, rates.platformFeeFirstMonth - rates.platformFeeMonthly);
    const oneTimeTotal = carrierUpfront + rates.platformFeeSetup + firstMonthPlatformExtra;

    lines.push({
      price_data: {
        currency: rates.currency,
        recurring: { interval: 'month' },
        product_data: {
          name: `Phone number ${item.phoneNumber}`,
          description: 'Monthly service (carrier + VSP-VOIP platform)',
          metadata: { phoneNumber: item.phoneNumber, tenantId: tenant.id },
        },
        unit_amount: Math.round(recurringTotal * 100),
      },
      quantity: 1,
    });

    if (oneTimeTotal > 0) {
      lines.push({
        price_data: {
          currency: rates.currency,
          product_data: {
            name: `Phone number ${item.phoneNumber} — setup & first month`,
            description: 'One-time setup and first-month platform fees',
            metadata: { phoneNumber: item.phoneNumber, type: 'setup' },
          },
          unit_amount: Math.round(oneTimeTotal * 100),
        },
        quantity: 1,
      });
    }
  }

  return lines;
}

async function createCheckoutSession({ prisma, tenant, userEmail, items, connectionId }) {
  const platform = await loadPlatformSettings(prisma);
  const { loadPaymentGatewaySettings } = require('./paymentGateways');
  const gateway = await loadPaymentGatewaySettings(prisma);

  if (!gateway.stripeEnabled) {
    const error = new Error('Card payments are not enabled. Use bank transfer or contact support.');
    error.status = 503;
    throw error;
  }

  const stripe = await getStripeClient(prisma);
  if (!stripe) {
    const error = new Error('Stripe billing is not configured. Add Stripe keys in the super admin dashboard.');
    error.status = 503;
    throw error;
  }

  if (!items?.length) {
    const error = new Error('Cart is empty');
    error.status = 400;
    throw error;
  }

  const pricing = calculateCartPricing(items, tenant, platform);
  const phoneNumbers = items.map((i) => i.phoneNumber);
  const customerId = await getOrCreateStripeCustomer(prisma, tenant, userEmail);

  const order = await prisma.numberOrder.create({
    data: {
      tenantId: tenant.id,
      status: 'PENDING',
      paymentMethod: 'STRIPE',
      connectionId: connectionId || null,
      phoneNumbers,
      carrierUpfront: pricing.carrierUpfront,
      carrierMonthly: pricing.carrierMonthly,
      platformFee: pricing.platformFee,
      totalCharged: pricing.dueToday,
      currency: 'USD',
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: buildSubscriptionLineItems(items, tenant, platform),
    success_url: `${WEB_ORIGIN}/cart/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${WEB_ORIGIN}/cart?cancelled=1`,
    metadata: {
      orderId: order.id,
      tenantId: tenant.id,
      connectionId: connectionId || '',
    },
    subscription_data: {
      metadata: {
        tenantId: tenant.id,
        orderId: order.id,
      },
    },
  });

  await prisma.numberOrder.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  });

  return { url: session.url, orderId: order.id, sessionId: session.id };
}

async function mapSubscriptionItems(stripe, subscriptionId) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price.product'],
  });

  const recurringByPhone = {};

  for (const item of subscription.items.data) {
    const product = item.price?.product;
    const phoneNumber = typeof product === 'object' ? product?.metadata?.phoneNumber : null;
    const type = typeof product === 'object' ? product?.metadata?.type : null;
    if (phoneNumber && type !== 'setup') {
      recurringByPhone[phoneNumber] = {
        subscriptionItemId: item.id,
        monthlyAmount: (item.price.unit_amount || 0) / 100,
      };
    }
  }

  return { subscriptionId: subscription.id, recurringByPhone };
}

async function fulfillNumberOrder({
  prisma,
  order,
  apiKey,
  defaultConnectionId,
  subscriptionMap,
  platform,
  fulfillmentSource = 'STRIPE',
  itemsByPhone = null,
}) {
  const phoneNumbers = Array.isArray(order.phoneNumbers) ? order.phoneNumbers : [];
  const connectionId = order.connectionId || defaultConnectionId;
  const callControlApplicationId = getCallControlApplicationId(platform);
  const messagingProfileId = getMessagingProfileId(platform);
  const tenant = order.tenant;
  const rates = getTenantBillingRates(tenant, platform);
  const purchased = [];
  const failed = [];

  for (const phoneNumber of phoneNumbers) {
    try {
      const item = itemsByPhone?.[phoneNumber];
      const margin = item
        ? buildMarginSnapshot({
          item,
          rates,
          orderId: order.id,
          source: fulfillmentSource,
        })
        : buildMarginFromOrderSplit({
          order,
          rates,
          phoneNumber,
          source: fulfillmentSource,
        });

      const result = await buyAndAssignNumber({
        phoneNumber,
        tenant,
        prisma,
        apiKey,
        connectionId,
        callControlApplicationId,
        messagingProfileId,
        marginData: margin,
      });

      if (result.savedNumber && !result.alreadyOwned) {
        await applyMarginToPhoneNumber(prisma, result.savedNumber.id, margin);
        const { writeSystemAuditLog } = require('./auditLog');
        await writeSystemAuditLog(prisma, {
          action: 'number.purchased',
          entityType: 'PhoneNumber',
          entityId: result.savedNumber.id,
          details: {
            phoneNumber,
            orderId: order.id,
            tenantId: tenant.id,
            source: fulfillmentSource,
            telnyxUpfrontCost: margin.telnyxUpfrontCost,
            telnyxMonthlyCost: margin.telnyxMonthlyCost,
            grossProfitMonthly: margin.grossProfitMonthly,
          },
        });
      }

      const subInfo = subscriptionMap?.recurringByPhone?.[phoneNumber];
      if (subInfo && result.savedNumber) {
        const perNumberCarrier = toMoney(decimalToNumber(order.carrierMonthly) / phoneNumbers.length);
        await prisma.phoneNumber.update({
          where: { id: result.savedNumber.id },
          data: {
            stripeSubscriptionItemId: subInfo.subscriptionItemId,
            carrierMonthly: perNumberCarrier,
            platformMonthly: rates.platformFeeMonthly,
            tenantMonthlyTotal: toMoney(subInfo.monthlyAmount),
          },
        });
      }

      purchased.push({
        phoneNumber,
        message: result.alreadyOwned ? 'Already assigned' : 'Purchased successfully',
      });
    } catch (error) {
      failed.push({ phoneNumber, error: error.message || 'Purchase failed' });
    }
  }

  const status = failed.length === 0 ? 'FULFILLED' : purchased.length ? 'PARTIAL' : 'FAILED';
  const note = failed.length
    ? `${purchased.length} ok, ${failed.length} failed`
    : `${purchased.length} number(s) assigned with recurring billing`;

  await prisma.numberOrder.update({
    where: { id: order.id },
    data: {
      status,
      fulfillmentNote: note,
      ...(subscriptionMap?.subscriptionId
        ? { stripeSubscriptionId: subscriptionMap.subscriptionId }
        : {}),
    },
  });

  if (subscriptionMap?.subscriptionId) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeSubscriptionId: subscriptionMap.subscriptionId },
    });
  }

  return { purchased, failed, status, message: note };
}

async function claimStripeEvent(prisma, event) {
  try {
    await prisma.processedStripeEvent.create({
      data: {
        id: event.id,
        type: event.type,
        orderId: event.data?.object?.metadata?.orderId || null,
      },
    });
    return true;
  } catch (error) {
    if (error.code === 'P2002') return false;
    throw error;
  }
}

async function acquireFulfillmentLock(prisma, orderId) {
  const lockedBy = process.env.HOSTNAME || `pid-${process.pid}`;
  try {
    await prisma.fulfillmentLock.create({
      data: { orderId, lockedBy },
    });
    return true;
  } catch (error) {
    if (error.code === 'P2002') return false;
    throw error;
  }
}

async function releaseFulfillmentLock(prisma, orderId) {
  await prisma.fulfillmentLock.delete({ where: { orderId } }).catch(() => {});
}

async function claimOrderForFulfillment(prisma, orderId) {
  const updated = await prisma.numberOrder.updateMany({
    where: {
      id: orderId,
      status: { in: ['PENDING', 'PAID', 'PENDING_PAYMENT'] },
    },
    data: { status: 'PAID' },
  });
  return updated.count === 1;
}

async function completeCheckoutSession({ prisma, sessionId, tenantId, apiKey, defaultConnectionId }) {
  const platform = await loadPlatformSettings(prisma);
  const stripe = await getStripeClient(prisma);
  if (!stripe) throw new Error('Stripe is not configured');

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    const error = new Error('Payment not completed');
    error.status = 402;
    throw error;
  }

  const order = await prisma.numberOrder.findUnique({
    where: { stripeSessionId: sessionId },
    include: { tenant: true },
  });

  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }

  if (tenantId && order.tenantId !== tenantId) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }

  if (order.status === 'FULFILLED' || order.status === 'PARTIAL') {
    return {
      alreadyFulfilled: true,
      order,
      purchased: [],
      failed: [],
      message: order.fulfillmentNote || 'Order already processed',
    };
  }

  const lockAcquired = await acquireFulfillmentLock(prisma, order.id);
  if (!lockAcquired) {
    const current = await prisma.numberOrder.findUnique({ where: { id: order.id } });
    if (current?.status === 'FULFILLED' || current?.status === 'PARTIAL') {
      return {
        alreadyFulfilled: true,
        order: current,
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
      const current = await prisma.numberOrder.findUnique({ where: { id: order.id } });
      return {
        alreadyFulfilled: current?.status === 'FULFILLED' || current?.status === 'PARTIAL',
        order: current || order,
        purchased: [],
        failed: [],
        message: current?.fulfillmentNote || 'Order already processed',
      };
    }

    let subscriptionMap = null;
    if (session.subscription) {
      const subId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;
      subscriptionMap = await mapSubscriptionItems(stripe, subId);
    }

    const freshOrder = await prisma.numberOrder.findUnique({
      where: { id: order.id },
      include: { tenant: true },
    });

    const result = await fulfillNumberOrder({
      prisma,
      order: freshOrder,
      apiKey,
      defaultConnectionId,
      subscriptionMap,
      platform,
      fulfillmentSource: 'STRIPE',
    });

    return { alreadyFulfilled: false, order: freshOrder, ...result };
  } finally {
    await releaseFulfillmentLock(prisma, order.id);
  }
}

async function resolveTenantIdFromStripeCustomer(prisma, customerId) {
  if (!customerId) return null;
  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: String(customerId) },
    select: { id: true },
  });
  return tenant?.id || null;
}

async function handleStripeWebhook(rawBody, signature) {
  const { getPrisma } = require('../db');
  const prisma = await getPrisma();
  const platform = await loadPlatformSettings(prisma);
  const stripe = await getStripeClient(prisma);
  const secret = platform.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !secret) {
    if (isProduction() || signature) {
      const error = new Error('Stripe webhook is not configured');
      error.status = 503;
      throw error;
    }
    logger.warn('stripe_webhook_skipped', { reason: 'not_configured' });
    return { skipped: true };
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

  const isNewEvent = await claimStripeEvent(prisma, event);
  if (!isNewEvent) {
    logger.info('stripe_event_duplicate', { eventId: event.id, type: event.type });
    return { received: true, duplicate: true };
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { connectionId } = getTelnyxConnectionConfig(platform);
    const result = await completeCheckoutSession({
      prisma,
      sessionId: session.id,
      tenantId: session.metadata?.tenantId,
      apiKey: process.env.TELNYX_API_KEY?.trim(),
      defaultConnectionId: connectionId,
    });

    if (!result.alreadyFulfilled && result.order?.status === 'FULFILLED') {
      const { sendPaymentReceiptEmail, resolveTenantAdminEmail } = require('./transactionalEmail');
      const email = session.customer_details?.email
        || session.customer_email
        || await resolveTenantAdminEmail(prisma, result.order.tenantId);
      await sendPaymentReceiptEmail({
        to: email,
        tenantName: result.order.tenant?.name || 'your organization',
        order: result.order,
        phoneNumbers: result.order.phoneNumbers,
        amount: result.order.totalCharged,
        currency: result.order.currency || 'USD',
      }).catch((err) => logger.warn('receipt_email_failed', { error: err.message }));
    }
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    logger.info('stripe_invoice_paid', { invoiceId: invoice.id, customer: invoice.customer });
    let tenantId = invoice.subscription_details?.metadata?.tenantId
      || invoice.metadata?.tenantId;
    if (!tenantId) {
      tenantId = await resolveTenantIdFromStripeCustomer(prisma, invoice.customer);
    }
    const { writeSystemAuditLog } = require('./auditLog');
    await writeSystemAuditLog(prisma, {
      action: 'billing.invoice_paid',
      entityType: 'StripeInvoice',
      entityId: invoice.id,
      details: {
        customerId: invoice.customer,
        tenantId: tenantId || null,
        amountPaid: invoice.amount_paid,
      },
    });
    if (tenantId && invoice.billing_reason !== 'subscription_create') {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      const { sendRecurringPaymentReceiptEmail, resolveTenantAdminEmail } = require('./transactionalEmail');
      const email = invoice.customer_email || await resolveTenantAdminEmail(prisma, tenantId);
      await sendRecurringPaymentReceiptEmail({
        to: email,
        tenantName: tenant?.name || 'your organization',
        invoiceId: invoice.id,
        amountDue: invoice.amount_paid,
        currency: invoice.currency || 'usd',
      }).catch((err) => logger.warn('recurring_receipt_email_failed', { error: err.message }));
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    logger.warn('stripe_payment_failed', { invoiceId: invoice.id, customer: invoice.customer });
    let tenantId = invoice.subscription_details?.metadata?.tenantId
      || invoice.metadata?.tenantId;
    if (!tenantId) {
      tenantId = await resolveTenantIdFromStripeCustomer(prisma, invoice.customer);
    }
    const { writeSystemAuditLog } = require('./auditLog');
    await writeSystemAuditLog(prisma, {
      action: 'billing.payment_failed',
      entityType: 'StripeInvoice',
      entityId: invoice.id,
      details: {
        customerId: invoice.customer,
        tenantId: tenantId || null,
        amountDue: invoice.amount_due,
      },
    });
    if (tenantId) {
      await applyPaymentFailedGrace(prisma, tenantId);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    let tenantId = subscription.metadata?.tenantId;
    if (!tenantId) {
      tenantId = await resolveTenantIdFromStripeCustomer(prisma, subscription.customer);
    }
    const { writeSystemAuditLog } = require('./auditLog');
    await writeSystemAuditLog(prisma, {
      action: 'billing.subscription_cancelled',
      entityType: 'StripeSubscription',
      entityId: subscription.id,
      details: { tenantId: tenantId || null },
    });
    if (tenantId) {
      await applySubscriptionCancelledGrace(prisma, tenantId);
    }
  }

  return { received: true };
}

function serializeOrder(order, tenant) {
  return {
    id: order.id,
    tenantId: order.tenantId,
    tenantName: tenant?.name || order.tenant?.name,
    status: order.status,
    paymentMethod: order.paymentMethod,
    invoiceNumber: order.invoiceNumber,
    invoiceSentAt: order.invoiceSentAt,
    invoicePaidAt: order.invoicePaidAt || null,
    invoiceEmailTo: order.invoiceEmailTo,
    adminNotes: order.adminNotes,
    paymentReference: order.paymentReference,
    phoneNumbers: order.phoneNumbers,
    carrierUpfront: Number(order.carrierUpfront),
    carrierMonthly: Number(order.carrierMonthly),
    platformFee: Number(order.platformFee),
    totalCharged: Number(order.totalCharged),
    recurringMonthly: Number(order.carrierMonthly) + Number(order.platformFee) / Math.max(1, (Array.isArray(order.phoneNumbers) ? order.phoneNumbers.length : 1)),
    currency: order.currency,
    fulfillmentNote: order.fulfillmentNote,
    connectionId: order.connectionId,
    paymentProofUrl: order.paymentProofUrl || null,
    paymentProofUploadedAt: order.paymentProofUploadedAt || null,
    paymentReviewStatus: order.paymentReviewStatus || 'NONE',
    billTenantAutomatically: Boolean(order.billTenantAutomatically),
    razorpayOrderId: order.razorpayOrderId || null,
    razorpayPaymentId: order.razorpayPaymentId || null,
    paymentFailureReason: order.paymentFailureReason || null,
    refundedAt: order.refundedAt || null,
    refundAmount: order.refundAmount != null ? Number(order.refundAmount) : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

async function createManualOrder({ prisma, tenant, items, connectionId }) {
  const platform = await loadPlatformSettings(prisma);
  const { loadPaymentGatewaySettings } = require('./paymentGateways');
  const gateway = await loadPaymentGatewaySettings(prisma);

  if (!gateway.bankTransferEnabled) {
    const error = new Error('Bank transfer is not enabled. Contact your administrator.');
    error.status = 503;
    throw error;
  }

  if (!gateway.bankConfigured) {
    const error = new Error('Bank transfer payment is not configured. Super admin must add bank details.');
    error.status = 503;
    throw error;
  }

  if (!items?.length) {
    const error = new Error('Cart is empty');
    error.status = 400;
    throw error;
  }

  const pricing = calculateCartPricing(items, tenant, platform);
  const invoiceNumber = buildInvoiceNumber();
  const phoneNumbers = items.map((i) => i.phoneNumber);

  const order = await prisma.numberOrder.create({
    data: {
      tenantId: tenant.id,
      status: 'PENDING_PAYMENT',
      paymentMethod: 'MANUAL_BANK',
      paymentReviewStatus: 'NONE',
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

  await ensureBankTransferReceivable({ prisma, tenant: order.tenant, order });

  const invoice = buildInvoiceContent({ order, tenant, platform, pricing, gateway });

  return {
    order: serializeOrder(order, tenant),
    invoice,
  };
}

async function getOrderWithInvoice({ prisma, orderId, tenantId }) {
  const order = await prisma.numberOrder.findUnique({
    where: { id: orderId },
    include: { tenant: true },
  });

  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }

  if (tenantId && order.tenantId !== tenantId) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }

  const platform = await loadPlatformSettings(prisma);
  const { loadPaymentGatewaySettings } = require('./paymentGateways');
  const gateway = await loadPaymentGatewaySettings(prisma);
  const pricing = calculateCartPricing(
    (Array.isArray(order.phoneNumbers) ? order.phoneNumbers : []).map((phoneNumber) => ({
      phoneNumber,
      upfrontCost: String(Number(order.carrierUpfront) / Math.max(1, order.phoneNumbers.length)),
      monthlyCost: String(Number(order.carrierMonthly) / Math.max(1, order.phoneNumbers.length)),
    })),
    order.tenant,
    platform,
  );

  const invoice = buildInvoiceContent({
    order,
    tenant: order.tenant,
    platform,
    pricing,
    gateway,
  });

  const tenantAdmin = await prisma.user.findFirst({
    where: { tenantId: order.tenantId, role: 'TENANT_ADMIN' },
    orderBy: { createdAt: 'asc' },
  });

  return {
    order: serializeOrder(order, order.tenant),
    invoice,
    mailtoLink: buildMailtoLink({
      to: tenantAdmin?.email || order.invoiceEmailTo,
      invoice,
    }),
    tenantAdminEmail: tenantAdmin?.email || null,
  };
}

async function markOrderInvoiceSent({ prisma, orderId, emailTo }) {
  const order = await prisma.numberOrder.update({
    where: { id: orderId },
    data: {
      invoiceSentAt: new Date(),
      invoiceEmailTo: emailTo || null,
    },
    include: { tenant: true },
  });

  return serializeOrder(order, order.tenant);
}

async function confirmManualOrderAndFulfill({
  prisma, orderId, apiKey, defaultConnectionId, adminNotes, paymentReference,
}) {
  const order = await prisma.numberOrder.findUnique({
    where: { id: orderId },
    include: { tenant: true },
  });

  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }

  if (order.paymentMethod !== 'MANUAL_BANK') {
    const error = new Error('This order is not a manual bank transfer order');
    error.status = 400;
    throw error;
  }

  if (order.status === 'CANCELLED') {
    const error = new Error('Order was cancelled');
    error.status = 400;
    throw error;
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

  assertBankFulfillmentApproved(order);

  const lockAcquired = await acquireFulfillmentLock(prisma, orderId);
  if (!lockAcquired) {
    const error = new Error('Order fulfillment already in progress');
    error.status = 409;
    throw error;
  }

  try {
    const claimed = await claimOrderForFulfillment(prisma, orderId);
    if (!claimed) {
      const current = await prisma.numberOrder.findUnique({
        where: { id: orderId },
        include: { tenant: true },
      });
      return {
        alreadyFulfilled: current?.status === 'FULFILLED' || current?.status === 'PARTIAL',
        order: serializeOrder(current, current?.tenant),
        purchased: [],
        failed: [],
        message: current?.fulfillmentNote || 'Order already processed',
      };
    }

    if (adminNotes !== undefined || paymentReference !== undefined) {
      await prisma.numberOrder.update({
        where: { id: orderId },
        data: {
          ...(adminNotes !== undefined ? { adminNotes: adminNotes || null } : {}),
          ...(paymentReference !== undefined ? { paymentReference: paymentReference || null } : {}),
        },
      });
    }

    const platform = await loadPlatformSettings(prisma);
    const paidOrder = await prisma.numberOrder.findUnique({
      where: { id: orderId },
      include: { tenant: true },
    });
    const result = await fulfillNumberOrder({
      prisma,
      order: paidOrder,
      apiKey,
      defaultConnectionId: defaultConnectionId || paidOrder.connectionId,
      subscriptionMap: null,
      platform,
      fulfillmentSource: 'BANK',
    });

    return {
      alreadyFulfilled: false,
      order: serializeOrder(
        await prisma.numberOrder.findUnique({ where: { id: orderId }, include: { tenant: true } }),
        order.tenant,
      ),
      ...result,
    };
  } finally {
    await releaseFulfillmentLock(prisma, orderId);
  }
}

async function cancelManualOrder({ prisma, orderId, adminNotes }) {
  const order = await prisma.numberOrder.findUnique({ where: { id: orderId } });

  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }

  if (order.status === 'FULFILLED' || order.status === 'PARTIAL') {
    const error = new Error('Cannot cancel a fulfilled order');
    error.status = 400;
    throw error;
  }

  const updated = await prisma.numberOrder.update({
    where: { id: orderId },
    data: {
      status: 'CANCELLED',
      ...(adminNotes !== undefined ? { adminNotes: adminNotes || null } : {}),
    },
    include: { tenant: true },
  });

  return serializeOrder(updated, updated.tenant);
}

async function uploadOrderPaymentProof({ prisma, orderId, tenantId, proofUrl }) {
  const order = await prisma.numberOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }
  if (tenantId && order.tenantId !== tenantId) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }
  if (order.paymentMethod !== 'MANUAL_BANK') {
    const error = new Error('Payment proof only applies to bank transfer orders');
    error.status = 400;
    throw error;
  }
  if (!['PENDING_PAYMENT', 'PENDING'].includes(order.status)) {
    const error = new Error('Order is not awaiting payment');
    error.status = 400;
    throw error;
  }
  if (order.paymentReviewStatus === 'APPROVED') {
    const error = new Error('Payment already approved');
    error.status = 400;
    throw error;
  }

  const updated = await prisma.numberOrder.update({
    where: { id: orderId },
    data: {
      paymentProofUrl: proofUrl,
      paymentProofUploadedAt: new Date(),
      paymentReviewStatus: 'PENDING',
      status: 'PENDING_PAYMENT',
    },
    include: { tenant: true },
  });

  return serializeOrder(updated, updated.tenant);
}

async function approveBankPayment({ prisma, orderId, apiKey, defaultConnectionId, adminNotes, paymentReference }) {
  const order = await prisma.numberOrder.findUnique({
    where: { id: orderId },
    include: { tenant: true },
  });
  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }
  if (order.paymentMethod !== 'MANUAL_BANK') {
    const error = new Error('Not a bank transfer order');
    error.status = 400;
    throw error;
  }

  await prisma.numberOrder.update({
    where: { id: orderId },
    data: {
      paymentReviewStatus: 'APPROVED',
      ...(adminNotes !== undefined ? { adminNotes: adminNotes || null } : {}),
      ...(paymentReference !== undefined ? { paymentReference: paymentReference || null } : {}),
    },
  });

  const result = await confirmManualOrderAndFulfill({
    prisma,
    orderId,
    apiKey,
    defaultConnectionId,
    adminNotes,
    paymentReference,
  });

  if (result.purchased?.length) {
    const paidAt = new Date();
    await prisma.numberOrder.update({
      where: { id: orderId },
      data: { invoicePaidAt: paidAt },
    });
    await markBankTransferReceivablePaid({ prisma, orderId, paidAt });
  }

  return result;
}

async function rejectBankPayment({ prisma, orderId, adminNotes }) {
  const order = await prisma.numberOrder.findUnique({
    where: { id: orderId },
    include: { tenant: true },
  });
  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }
  if (order.paymentMethod !== 'MANUAL_BANK') {
    const error = new Error('Not a bank transfer order');
    error.status = 400;
    throw error;
  }
  if (['FULFILLED', 'PARTIAL'].includes(order.status)) {
    const error = new Error('Cannot reject a fulfilled order');
    error.status = 400;
    throw error;
  }

  const updated = await prisma.numberOrder.update({
    where: { id: orderId },
    data: {
      status: 'CANCELLED',
      paymentReviewStatus: 'REJECTED',
      ...(adminNotes !== undefined ? { adminNotes: adminNotes || null } : {}),
    },
    include: { tenant: true },
  });

  return serializeOrder(updated, updated.tenant);
}

async function getTenantSubscriptionSummary({ prisma, tenantId }) {
  const platform = await loadPlatformSettings(prisma);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    const error = new Error('Organization not found');
    error.status = 404;
    throw error;
  }

  const numbers = await prisma.phoneNumber.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  let stripeSubscription = null;
  const stripe = await getStripeClient(prisma);
  if (stripe && tenant.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
      stripeSubscription = {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    } catch {
      stripeSubscription = {
        id: tenant.stripeSubscriptionId,
        status: 'unknown',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }
  }

  const estimatedMonthly = numbers.reduce(
    (sum, n) => sum + Number(n.tenantMonthlyTotal ?? n.platformMonthly ?? 0),
    0,
  );

  return {
    stripeEnabled: platform.stripeEnabled,
    manualPaymentEnabled: isManualPaymentConfigured(platform),
    hasStripeSubscription: Boolean(tenant.stripeSubscriptionId),
    stripeCustomerConfigured: Boolean(tenant.stripeCustomerId),
    stripeSubscription,
    activeNumbers: numbers.map((n) => ({
      id: n.id,
      number: n.number,
      carrierMonthly: n.carrierMonthly != null ? Number(n.carrierMonthly) : null,
      platformMonthly: n.platformMonthly != null ? Number(n.platformMonthly) : null,
      tenantMonthlyTotal: n.tenantMonthlyTotal != null ? Number(n.tenantMonthlyTotal) : null,
      hasStripeBilling: Boolean(n.stripeSubscriptionItemId),
      createdAt: n.createdAt,
    })),
    estimatedMonthlyTotal: toMoney(estimatedMonthly),
    numberCount: numbers.length,
  };
}

async function createBillingPortalSession({ prisma, tenantId, returnUrl, customerEmail }) {
  const stripe = await getStripeClient(prisma);
  if (!stripe) {
    throw Object.assign(new Error('Stripe is not configured on this platform'), { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  const customerId = await getOrCreateStripeCustomer(prisma, tenant, customerEmail || tenant.contactEmail);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl || process.env.WEB_ORIGIN || 'http://localhost:3001/settings/payment-methods',
  });

  return session.url;
}

async function recordAdminDirectOrder({
  prisma,
  tenant,
  items,
  connectionId,
  purchased,
  failed,
  billTenantAutomatically = false,
}) {
  if (!items?.length) return null;

  const platform = await loadPlatformSettings(prisma);
  const pricing = calculateCartPricing(items, tenant, platform);
  const status = failed.length === 0 ? 'FULFILLED' : purchased.length ? 'PARTIAL' : 'FAILED';
  const note = failed.length
    ? `${purchased.length} ok, ${failed.length} failed`
    : `${purchased.length} number(s) purchased by super admin`;

  const invoiceNumber = billTenantAutomatically ? buildInvoiceNumber() : null;

  const order = await prisma.numberOrder.create({
    data: {
      tenantId: tenant.id,
      status,
      paymentMethod: 'MANUAL_BANK',
      connectionId: connectionId || null,
      phoneNumbers: items.map((i) => i.phoneNumber),
      carrierUpfront: pricing.carrierUpfront,
      carrierMonthly: pricing.carrierMonthly,
      platformFee: pricing.platformFee,
      totalCharged: pricing.dueToday,
      currency: 'USD',
      fulfillmentNote: note,
      adminNotes: billTenantAutomatically
        ? 'Super admin direct purchase — tenant billed automatically'
        : 'Super admin direct purchase',
      paymentReference: billTenantAutomatically ? 'ADMIN_DIRECT_BILLABLE' : 'ADMIN_DIRECT',
      billTenantAutomatically,
      invoiceNumber,
      paymentReviewStatus: billTenantAutomatically ? 'NONE' : 'APPROVED',
    },
    include: { tenant: true },
  });

  if (billTenantAutomatically) {
    await createTenantReceivableForOrder({
      prisma,
      tenant,
      order,
      platform,
      items,
    });
    await ensureOrderInvoice({ prisma, order, tenant, platform, items });
  }

  return serializeOrder(order, tenant);
}

module.exports = {
  getBillingConfig,
  getTenantBillingRates,
  calculateCartPricing,
  createCheckoutSession,
  createManualOrder,
  getOrderWithInvoice,
  markOrderInvoiceSent,
  confirmManualOrderAndFulfill,
  cancelManualOrder,
  uploadOrderPaymentProof,
  approveBankPayment,
  rejectBankPayment,
  serializeOrder,
  completeCheckoutSession,
  handleStripeWebhook,
  getTenantSubscriptionSummary,
  createBillingPortalSession,
  recordAdminDirectOrder,
};
