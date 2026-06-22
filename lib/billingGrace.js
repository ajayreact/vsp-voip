const GRACE_DAYS_PAYMENT_FAILED = Number(process.env.BILLING_GRACE_DAYS || 7);
const GRACE_DAYS_SUBSCRIPTION_CANCELLED = Number(process.env.BILLING_CANCEL_GRACE_DAYS || 3);

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function applyPaymentFailedGrace(prisma, tenantId) {
  if (!tenantId) return null;
  const now = new Date();
  const graceUntil = addDays(now, GRACE_DAYS_PAYMENT_FAILED);

  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      paymentFailedAt: now,
      billingGraceUntil: graceUntil,
      billingStatus: 'GRACE',
    },
  });
}

async function applySubscriptionCancelledGrace(prisma, tenantId) {
  if (!tenantId) return null;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return null;

  const now = new Date();
  const graceUntil = tenant.billingGraceUntil && tenant.billingGraceUntil > now
    ? tenant.billingGraceUntil
    : addDays(now, GRACE_DAYS_SUBSCRIPTION_CANCELLED);

  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      billingGraceUntil: graceUntil,
      billingStatus: 'GRACE',
      stripeSubscriptionId: null,
    },
  });
}

async function expireBillingGracePeriods(prisma) {
  const now = new Date();
  const expired = await prisma.tenant.findMany({
    where: {
      billingGraceUntil: { lt: now },
      billingStatus: { in: ['GRACE'] },
      isActive: true,
    },
  });

  for (const tenant of expired) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        isActive: false,
        billingStatus: 'SUSPENDED',
      },
    });
  }

  return expired.length;
}

module.exports = {
  applyPaymentFailedGrace,
  applySubscriptionCancelledGrace,
  expireBillingGracePeriods,
  GRACE_DAYS_PAYMENT_FAILED,
  GRACE_DAYS_SUBSCRIPTION_CANCELLED,
};
