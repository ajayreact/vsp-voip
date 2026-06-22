#!/usr/bin/env node
/**
 * End-to-end bank transfer approval workflow validation.
 * Usage: npm run test:bank-approval-flow
 * Optional: E2E_LIVE_TELNYX=1 E2E_TEST_NUMBER=+1XXXXXXXXXX
 */
const fs = require('fs');
const path = require('path');
const { getPrisma } = require('../db');
const { reconcileLegacyRevenueRecords } = require('../lib/revenueReconcile');
const { getRevenueProtectionDashboard } = require('../lib/revenueProtection');
const {
  createManualOrder,
  uploadOrderPaymentProof,
  approveBankPayment,
} = require('../lib/billing');
const { loadPlatformSettings } = require('../lib/platformSettings');
const { getTelnyxConnectionConfig } = require('../lib/telnyxConfig');

const LEGACY_INVOICE = 'VSP-20260621-5J1P';

async function verifyLegacyOrder(prisma) {
  const order = await prisma.numberOrder.findFirst({
    where: { invoiceNumber: LEGACY_INVOICE },
    include: { receivable: true, tenant: true },
  });
  if (!order) return { ok: false, error: 'Legacy order not found' };

  const phones = await prisma.phoneNumber.findMany({ where: { orderId: order.id } });
  const checks = {
    paymentReviewStatus: order.paymentReviewStatus === 'APPROVED',
    invoicePaidAt: Boolean(order.invoicePaidAt),
    receivablePaid: order.receivable?.status === 'PAID',
    phoneLinked: phones.length > 0,
    marginPopulated: phones.every((p) => p.grossProfitMonthly != null && p.orderId === order.id),
  };

  return {
    ok: Object.values(checks).every(Boolean),
    order: {
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      status: order.status,
      paymentReviewStatus: order.paymentReviewStatus,
      invoicePaidAt: order.invoicePaidAt,
    },
    receivable: order.receivable,
    phones: phones.map((p) => ({
      number: p.number,
      orderId: p.orderId,
      source: p.source,
      grossProfitMonthly: p.grossProfitMonthly != null ? Number(p.grossProfitMonthly) : null,
    })),
    checks,
  };
}

async function runLiveApprovalTest(prisma) {
  const tenant = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  if (!tenant) throw new Error('No active tenant for E2E test');

  const testNumber = process.env.E2E_TEST_NUMBER?.trim();
  if (!testNumber) {
    return { skipped: true, reason: 'Set E2E_TEST_NUMBER to run live Telnyx purchase test' };
  }

  const existing = await prisma.phoneNumber.findUnique({ where: { number: testNumber } });
  if (existing) {
    return { skipped: true, reason: `Number ${testNumber} already in DB — pick an unassigned number` };
  }

  const items = [{ phoneNumber: testNumber, upfrontCost: '1', monthlyCost: '1', country: 'US' }];
  const platform = await loadPlatformSettings(prisma);
  const { connectionId } = getTelnyxConnectionConfig(platform);
  const apiKey = process.env.TELNYX_API_KEY?.trim();

  const { order } = await createManualOrder({ prisma, tenant, items, connectionId });

  const proofDir = path.join(process.cwd(), 'uploads', 'payment-proofs');
  fs.mkdirSync(proofDir, { recursive: true });
  const proofFile = `e2e-${order.id}.txt`;
  fs.writeFileSync(path.join(proofDir, proofFile), 'E2E test payment proof');
  const apiPublic = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
  const proofUrl = `${apiPublic}/uploads/payment-proofs/${proofFile}`;

  await uploadOrderPaymentProof({
    prisma,
    orderId: order.id,
    tenantId: tenant.id,
    proofUrl,
  });

  const result = await approveBankPayment({
    prisma,
    orderId: order.id,
    apiKey,
    defaultConnectionId: connectionId,
    paymentReference: `E2E-${Date.now()}`,
  });

  const updated = await prisma.numberOrder.findUnique({
    where: { id: order.id },
    include: { receivable: true },
  });
  const phone = await prisma.phoneNumber.findFirst({ where: { number: testNumber } });
  const audits = await prisma.adminAuditLog.findMany({
    where: {
      OR: [
        { entityId: order.id },
        { entityId: phone?.id || 'none' },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const checks = {
    orderFulfilled: updated?.status === 'FULFILLED',
    paymentApproved: updated?.paymentReviewStatus === 'APPROVED',
    invoicePaid: Boolean(updated?.invoicePaidAt),
    receivablePaid: updated?.receivable?.status === 'PAID',
    phoneOrderId: phone?.orderId === order.id,
    marginPopulated: phone?.grossProfitMonthly != null,
    telnyxPurchased: (result.purchased?.length || 0) > 0,
    auditLogs: audits.some((a) => a.action === 'number.purchased'),
  };

  return {
    skipped: false,
    orderId: order.id,
    invoiceNumber: order.invoiceNumber,
    purchased: result.purchased,
    failed: result.failed,
    checks,
    ok: Object.values(checks).every(Boolean),
    audits: audits.map((a) => ({ action: a.action, entityId: a.entityId, createdAt: a.createdAt })),
  };
}

async function verifyDashboard(prisma) {
  const d = await getRevenueProtectionDashboard(prisma);
  return {
    paidOrders: d.paidOrders,
    pendingPayments: d.pendingPayments,
    unpaidFulfillments: d.unpaidFulfillments,
    numbersWithoutInvoice: d.numbersWithoutInvoice,
    marginNumbersTracked: d.marginNumbersTracked,
    totals: d.totals,
    marginByTenant: d.marginByTenant,
  };
}

async function main() {
  const prisma = await getPrisma();
  const report = {
    timestamp: new Date().toISOString(),
    reconcile: null,
    legacyVerification: null,
    liveApprovalTest: null,
    dashboard: null,
  };

  report.reconcile = await reconcileLegacyRevenueRecords(prisma, { dryRun: false });
  report.legacyVerification = await verifyLegacyOrder(prisma);
  report.dashboard = await verifyDashboard(prisma);

  if (process.env.E2E_LIVE_TELNYX === '1') {
    report.liveApprovalTest = await runLiveApprovalTest(prisma);
    report.dashboard = await verifyDashboard(prisma);
  } else {
    report.liveApprovalTest = { skipped: true, reason: 'Set E2E_LIVE_TELNYX=1 for live Telnyx purchase test' };
  }

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();

  const failed =
    !report.legacyVerification.ok
    || (report.liveApprovalTest.skipped === false && !report.liveApprovalTest.ok)
    || report.reconcile.errors.length > 0;

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
