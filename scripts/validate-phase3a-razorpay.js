#!/usr/bin/env node
/**
 * Phase 3A Razorpay validation — npm run validate:phase3a
 */
const crypto = require('crypto');
const {
  verifyPaymentSignature,
  verifyWebhookSignature,
  usdToInrPaise,
  inrPaiseToUsd,
} = require('../lib/razorpayBilling');
const { getRazorpayPaymentsReport, getRevenueByGatewayReport } = require('../lib/razorpayReporting');

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function warn(name, detail = '') {
  results.push({ name, ok: null, detail });
  console.log(`⚠️  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function testSignatureVerification() {
  console.log('\n=== Signature verification ===');
  const secret = 'test_webhook_secret';
  const orderId = 'order_test123';
  const paymentId = 'pay_test456';
  const body = `${orderId}|${paymentId}`;
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (verifyPaymentSignature({ orderId, paymentId, signature, keySecret: secret })) {
    pass('Payment signature valid');
  } else fail('Payment signature valid');

  if (!verifyPaymentSignature({ orderId, paymentId, signature: 'bad', keySecret: secret })) {
    pass('Payment signature invalid rejected');
  } else fail('Payment signature invalid rejected');

  const payload = JSON.stringify({ event: 'payment.captured' });
  const webhookSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (verifyWebhookSignature(payload, webhookSig, secret)) {
    pass('Webhook signature valid');
  } else fail('Webhook signature valid');

  if (!verifyWebhookSignature(payload, 'invalid', secret)) {
    pass('Webhook signature invalid rejected (fail closed)');
  } else fail('Webhook signature invalid rejected');
}

async function testCurrencyConversion() {
  console.log('\n=== Currency conversion ===');
  const paise = usdToInrPaise(10);
  const back = inrPaiseToUsd(paise);
  if (paise > 0 && Math.abs(back - 10) < 0.02) {
    pass('USD ↔ INR paise conversion', `${paise} paise ≈ $${back}`);
  } else fail('USD ↔ INR paise conversion', `${paise} / ${back}`);
}

async function testWebhookHandlerFailClosed() {
  console.log('\n=== Webhook fail-closed ===');
  const { handleRazorpayWebhook } = require('../lib/razorpayBilling');
  try {
    await handleRazorpayWebhook('{}', 'bad-signature');
    fail('Invalid webhook should throw');
  } catch (err) {
    if (err.code === 'RAZORPAY_WEBHOOK_INVALID' || err.message.includes('Invalid')) {
      pass('Invalid webhook signature rejected', err.message);
    } else if (err.message.includes('not configured')) {
      warn('Webhook secret not configured in env', 'Set RAZORPAY_WEBHOOK_SECRET for live test');
    } else {
      fail('Invalid webhook rejection', err.message);
    }
  }
}

async function testFailedPaymentFlow() {
  console.log('\n=== Failed payment flow ===');
  const { getPrisma } = require('../db');
  const { markRazorpayPaymentFailed } = require('../lib/razorpayBilling');
  const prisma = await getPrisma();

  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!tenant) {
    warn('Failed payment test', 'No tenant');
    return;
  }

  const order = await prisma.numberOrder.create({
    data: {
      tenantId: tenant.id,
      status: 'PENDING',
      paymentMethod: 'RAZORPAY',
      phoneNumbers: ['+19998887777'],
      carrierUpfront: 1,
      carrierMonthly: 1,
      platformFee: 8,
      totalCharged: 10,
      currency: 'USD',
      invoiceNumber: `TEST-RZP-${Date.now()}`,
      razorpayOrderId: `order_test_${Date.now()}`,
    },
  });

  const updated = await markRazorpayPaymentFailed({
    prisma,
    orderId: order.id,
    reason: 'Test payment failed',
    razorpayPaymentId: 'pay_failed_test',
  });

  if (updated?.status === 'PENDING' && updated?.paymentFailureReason) {
    pass('Failed payment preserves PENDING order', updated.paymentFailureReason);
  } else fail('Failed payment flow');

  const audit = await prisma.adminAuditLog.findFirst({
    where: { entityId: order.id, action: 'order.payment_failed' },
    orderBy: { createdAt: 'desc' },
  });
  if (audit) pass('Failed payment audit log created');
  else fail('Failed payment audit log');

  await prisma.numberOrder.delete({ where: { id: order.id } }).catch(() => {});
}

async function testReporting() {
  console.log('\n=== Reporting ===');
  const { getPrisma } = require('../db');
  const prisma = await getPrisma();
  const payments = await getRazorpayPaymentsReport(prisma);
  const byGateway = await getRevenueByGatewayReport(prisma);
  pass('Razorpay payments report', `${payments.summary.totalOrders} orders`);
  pass('Revenue by gateway report', `${byGateway.gateways.length} gateways`);
}

async function testCheckoutRouteExists() {
  console.log('\n=== Module exports ===');
  const mod = require('../lib/razorpayBilling');
  for (const fn of [
    'createRazorpayCheckoutOrder',
    'finalizeRazorpayPayment',
    'handleRazorpayWebhook',
    'refundRazorpayOrder',
    'markRazorpayPaymentFailed',
  ]) {
    if (typeof mod[fn] === 'function') pass(`Export ${fn}`);
    else fail(`Export ${fn}`);
  }
}

async function main() {
  console.log('Phase 3A Razorpay validation\n');
  await testSignatureVerification();
  await testCurrencyConversion();
  await testWebhookHandlerFailClosed();
  await testFailedPaymentFlow();
  await testReporting();
  await testCheckoutRouteExists();

  const failed = results.filter((r) => r.ok === false).length;
  console.log(`\n${results.filter((r) => r.ok).length} passed, ${failed} failed, ${results.filter((r) => r.ok === null).length} warnings`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
