/**
 * V3 Billing Service — read-only billing center data from existing records.
 */

const { getTenantSubscriptionSummary } = require('../billing');
const storageService = require('./storageService');

function money(value) {
  if (value == null) return null;
  return Number(value);
}

async function getBillingOverview(prisma, tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  const [subscription, orders, receivables, storage, sms, apiUsage, usageCounts] = await Promise.all([
    getTenantSubscriptionSummary({ prisma, tenantId }).catch(() => null),
    prisma.numberOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        invoiceNumber: true,
        invoicePaidAt: true,
        invoiceSentAt: true,
        totalCharged: true,
        currency: true,
        paymentMethod: true,
        createdAt: true,
      },
    }),
    prisma.tenantReceivable.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    storageService.getStorageUsage(prisma, tenantId),
    storageService.getSmsUsage(prisma, tenantId),
    storageService.getApiUsageEstimate(prisma, tenantId),
    Promise.all([
      prisma.user.count({ where: { tenantId, role: 'TENANT_USER' } }),
      prisma.extension.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.phoneNumber.count({ where: { tenantId, isActive: { not: false } } }),
      prisma.v3DeskDevice.count({ where: { tenantId, removedAt: null } }),
    ]),
  ]);

  const [seats, extensions, numbers, deskPhones] = usageCounts;
  const platformMonthly = money(tenant.platformFeeMonthly);
  const estimatedMonthly = subscription?.estimatedMonthlyTotal ?? platformMonthly;

  const paidOrders = orders.filter((o) => o.invoicePaidAt || o.status === 'FULFILLED');
  const pendingReceivables = receivables.filter((r) => r.status === 'PENDING');

  return {
    plan: {
      name: tenant.stripeSubscriptionId ? 'Subscription' : 'Standard',
      billingStatus: tenant.billingStatus,
      billingGraceUntil: tenant.billingGraceUntil,
      platformFeeMonthly: platformMonthly,
      platformFeeSetup: money(tenant.platformFeeSetup),
    },
    usage: {
      seats,
      extensions,
      numbers,
      deskPhones,
      storage,
      recordingUsage: storage.recordings,
      smsUsage: sms,
      apiUsage,
    },
    costs: {
      estimatedMonthlyTotal: estimatedMonthly,
      currency: 'USD',
    },
    renewalDate: subscription?.stripeSubscription?.currentPeriodEnd || null,
    subscription: subscription || null,
    invoices: orders.map((o) => ({
      id: o.id,
      invoiceNumber: o.invoiceNumber,
      status: o.status,
      amount: money(o.totalCharged),
      currency: o.currency,
      paidAt: o.invoicePaidAt,
      sentAt: o.invoiceSentAt,
      createdAt: o.createdAt,
      paymentMethod: o.paymentMethod,
    })),
    payments: [
      ...paidOrders.map((o) => ({
        type: 'order',
        id: o.id,
        amount: money(o.totalCharged),
        paidAt: o.invoicePaidAt || o.createdAt,
        reference: o.invoiceNumber,
      })),
      ...receivables.filter((r) => r.paidAt).map((r) => ({
        type: 'receivable',
        id: r.id,
        amount: money(r.amount),
        paidAt: r.paidAt,
        reference: r.invoiceNumber,
      })),
    ],
    receivables: pendingReceivables.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      amount: money(r.amount),
      status: r.status,
      dueAt: r.dueAt,
    })),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getBillingOverview,
};
