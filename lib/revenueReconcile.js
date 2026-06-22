const { loadPlatformSettings } = require('./platformSettings');
const { getTenantBillingRates } = require('./billing');
const {
  buildMarginFromOrderSplit,
  applyMarginToPhoneNumber,
} = require('./marginAnalytics');
const {
  ensureBankTransferReceivable,
  markBankTransferReceivablePaid,
} = require('./receivables');
const { getRevenueProtectionDashboard } = require('./revenueProtection');
const { normalizePhoneNumber } = require('./phone');

function isLegacyBankOrder(order) {
  if (order.paymentMethod !== 'MANUAL_BANK') return false;
  if (['ADMIN_DIRECT', 'ADMIN_DIRECT_BILLABLE'].includes(order.paymentReference)) return false;
  if (!['FULFILLED', 'PARTIAL'].includes(order.status)) return false;
  return order.paymentReviewStatus !== 'APPROVED' || !order.invoicePaidAt;
}

function inferFulfillmentSource(order) {
  if (order.paymentReviewStatus === 'APPROVED') return 'BANK';
  return 'LEGACY_BANK';
}

async function repairOrderPhoneMargins({ prisma, order, platform, report }) {
  const phoneNumbers = Array.isArray(order.phoneNumbers) ? order.phoneNumbers : [];
  if (!phoneNumbers.length) return;

  const rates = getTenantBillingRates(order.tenant, platform);
  const source = inferFulfillmentSource(order);

  for (const raw of phoneNumbers) {
    const number = normalizePhoneNumber(raw);
    if (!number) continue;

    let phone = await prisma.phoneNumber.findFirst({
      where: { number, tenantId: order.tenantId },
    });

    if (!phone) {
      report.warnings.push({
        type: 'PHONE_NOT_FOUND',
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        number,
      });
      continue;
    }

    const margin = buildMarginFromOrderSplit({
      order,
      rates,
      phoneNumber: number,
      source,
    });

    const needsMargin = phone.grossProfitMonthly == null || phone.orderId !== order.id;
    if (!needsMargin && phone.source === source) continue;

    await applyMarginToPhoneNumber(prisma, phone.id, margin);
    phone = await prisma.phoneNumber.findUnique({ where: { id: phone.id } });

    report.phonesRepaired.push({
      number,
      orderId: order.id,
      invoiceNumber: order.invoiceNumber,
      margin: {
        telnyxUpfrontCost: Number(phone.telnyxUpfrontCost),
        telnyxMonthlyCost: Number(phone.telnyxMonthlyCost),
        customerPriceTotal: Number(phone.customerPriceTotal),
        customerPriceMonthly: Number(phone.customerPriceMonthly),
        grossProfitUpfront: Number(phone.grossProfitUpfront),
        grossProfitMonthly: Number(phone.grossProfitMonthly),
      },
    });
  }
}

async function repairOrderPaymentState({ prisma, order, report }) {
  const paidAt = order.invoicePaidAt || order.updatedAt || new Date();
  const orderUpdates = {};

  if (order.paymentReviewStatus !== 'APPROVED') {
    orderUpdates.paymentReviewStatus = 'APPROVED';
  }
  if (!order.invoicePaidAt) {
    orderUpdates.invoicePaidAt = paidAt;
  }
  if (!order.paymentReference && order.invoiceNumber) {
    orderUpdates.paymentReference = order.invoiceNumber;
  }

  if (Object.keys(orderUpdates).length) {
    await prisma.numberOrder.update({
      where: { id: order.id },
      data: orderUpdates,
    });
    report.ordersRepaired.push({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      updates: orderUpdates,
      reason: 'legacy_fulfilled_before_phase2b',
    });
  }

  await ensureBankTransferReceivable({ prisma, tenant: order.tenant, order });
  const receivable = await markBankTransferReceivablePaid({
    prisma,
    orderId: order.id,
    paidAt,
  });
  report.receivablesUpdated.push({
    orderId: order.id,
    invoiceNumber: order.invoiceNumber,
    status: receivable.status,
    paidAt: receivable.paidAt,
  });
}

async function resolveRepairedAlerts(prisma, report) {
  const openAlerts = await prisma.billingIntegrityAlert.findMany({
    where: { resolvedAt: null },
  });

  for (const alert of openAlerts) {
    const details = alert.details || {};
    const orderId = details.orderId || details.id;
    const phoneNumberId = details.phoneNumberId;

    let shouldResolve = false;

    if (alert.type === 'UNPAID_FULFILLMENT' && orderId) {
      const order = await prisma.numberOrder.findUnique({ where: { id: orderId } });
      shouldResolve = order?.paymentReviewStatus === 'APPROVED' && order?.invoicePaidAt;
    }

    if (alert.type === 'NUMBER_WITHOUT_PAID_ORDER' && (orderId || phoneNumberId)) {
      const phone = phoneNumberId
        ? await prisma.phoneNumber.findUnique({ where: { id: phoneNumberId }, include: { order: true } })
        : null;
      if (phone?.order?.paymentReviewStatus === 'APPROVED' && phone.order.invoicePaidAt) {
        shouldResolve = true;
      }
    }

    if (shouldResolve) {
      await prisma.billingIntegrityAlert.update({
        where: { id: alert.id },
        data: { resolvedAt: new Date() },
      });
      report.alertsResolved.push({ id: alert.id, type: alert.type, message: alert.message });
    }
  }
}

async function repairOrphanPhonesWithMatchingOrders({ prisma, platform, report }) {
  const orphans = await prisma.phoneNumber.findMany({
    where: {
      isActive: true,
      orderId: null,
      source: null,
    },
  });

  for (const phone of orphans) {
    const candidates = await prisma.numberOrder.findMany({
      where: {
        tenantId: phone.tenantId,
        status: { in: ['FULFILLED', 'PARTIAL'] },
        paymentMethod: 'MANUAL_BANK',
      },
      include: { tenant: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const match = candidates.find((o) => {
      const nums = Array.isArray(o.phoneNumbers) ? o.phoneNumbers : [];
      return nums.some((n) => normalizePhoneNumber(n) === phone.number);
    });

    if (!match) continue;

    await repairOrderPaymentState({ prisma, order: match, report });
    await repairOrderPhoneMargins({ prisma, order: match, platform, report });
  }
}

async function reconcileLegacyRevenueRecords(prisma, { dryRun = false } = {}) {
  const report = {
    dryRun,
    scannedAt: new Date().toISOString(),
    ordersScanned: 0,
    ordersRepaired: [],
    phonesRepaired: [],
    receivablesCreated: [],
    receivablesUpdated: [],
    alertsResolved: [],
    warnings: [],
    errors: [],
  };

  const platform = await loadPlatformSettings(prisma);

  const legacyOrders = await prisma.numberOrder.findMany({
    where: {
      paymentMethod: 'MANUAL_BANK',
      status: { in: ['FULFILLED', 'PARTIAL'] },
      paymentReference: { notIn: ['ADMIN_DIRECT', 'ADMIN_DIRECT_BILLABLE'] },
    },
    include: { tenant: true, receivable: true },
    orderBy: { createdAt: 'asc' },
  });

  report.ordersScanned = legacyOrders.length;

  for (const order of legacyOrders) {
    try {
      if (dryRun) {
        report.ordersRepaired.push({
          id: order.id,
          invoiceNumber: order.invoiceNumber,
          wouldRepair: true,
          paymentReviewStatus: order.paymentReviewStatus,
          invoicePaidAt: order.invoicePaidAt,
        });
        continue;
      }

      if (isLegacyBankOrder(order)) {
        await repairOrderPaymentState({ prisma, order, report });
      }
      await repairOrderPhoneMargins({ prisma, order, platform, report });
    } catch (err) {
      report.errors.push({
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        error: err.message,
      });
    }
  }

  if (!dryRun) {
    await repairOrphanPhonesWithMatchingOrders({ prisma, platform, report });
    await resolveRepairedAlerts(prisma, report);
  }

  report.dashboard = await getRevenueProtectionDashboard(prisma);

  return report;
}

module.exports = {
  reconcileLegacyRevenueRecords,
  isLegacyBankOrder,
};
