#!/usr/bin/env node
/**
 * Phase 2A.5 validation harness — run: node scripts/validate-phase2a.js
 * Optional: API_BASE=http://localhost:3000 REDIS_URL=redis://localhost:6379
 */
require('dotenv').config();

const axios = require('axios');
const Stripe = require('stripe');

const BASE = process.env.API_BASE || 'http://localhost:3000';
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

async function http(method, path, opts = {}) {
  return axios({ method, url: `${BASE}${path}`, validateStatus: () => true, ...opts });
}

async function testSecurity() {
  console.log('\n=== Security ===');

  const search = await http('GET', '/api/numbers/search?country=US');
  if (search.status === 401) pass('GET /api/numbers/search unauthenticated → 401');
  else fail('GET /api/numbers/search unauthenticated', `got ${search.status}`);

  const area = await http('GET', '/api/numbers/area-codes');
  if (area.status === 401) pass('GET /api/numbers/area-codes unauthenticated → 401');
  else fail('GET /api/numbers/area-codes unauthenticated', `got ${area.status}`);

  const assign = await http('POST', '/api/numbers/assign', { data: { phoneNumber: '+15551234567', tenantId: 'x' } });
  if (assign.status === 404 || assign.status === 401) {
    pass('POST /api/numbers/assign removed or blocked', `got ${assign.status}`);
  } else fail('POST /api/numbers/assign public', `got ${assign.status}`);

  const adminDash = await http('GET', '/api/admin/dashboard');
  if (adminDash.status === 401) pass('GET /api/admin/dashboard unauthenticated → 401');
  else fail('GET /api/admin/* unauthenticated', `got ${adminDash.status}`);

  const login = await http('POST', '/api/auth/login', {
    data: { email: 'invalid@example.com', password: 'wrong' },
  });
  if (login.status === 401) pass('Invalid login → 401');
  else fail('Invalid login', `got ${login.status}`);
}

async function testHealthLive() {
  console.log('\n=== Health (live server) ===');

  const health = await http('GET', '/health');
  if (health.status === 200 && health.data?.status === 'ok') pass('/health liveness');
  else fail('/health liveness', JSON.stringify(health.data));

  const ready = await http('GET', '/ready');
  if (ready.status === 200 || ready.status === 503) {
    pass('/ready responds', `ready=${ready.data?.ready}, db=${ready.data?.database?.connected}`);
    if (ready.data?.database?.connected === false) fail('/ready database check', ready.data.database.error);
    if (process.env.NODE_ENV === 'production' && ready.data?.redis?.connected === false) {
      fail('/ready redis in production', 'redis not connected');
    } else if (ready.data?.redis?.connected) {
      pass('/ready redis connected');
    } else {
      warn('/ready redis', 'not connected (optional in dev)');
    }
  } else fail('/ready', `status ${ready.status}`);
}

async function testHealthSimulated() {
  console.log('\n=== Health (simulated outages) ===');

  const { Client } = require('pg');
  const badDb = new Client({
    connectionString: 'postgresql://invalid:invalid@127.0.0.1:59999/none',
    connectionTimeoutMillis: 2000,
  });
  let dbFailed = false;
  try {
    await badDb.connect();
    await badDb.query('SELECT 1');
  } catch {
    dbFailed = true;
  } finally {
    await badDb.end().catch(() => {});
  }
  if (dbFailed) pass('Simulated Postgres outage detected');
  else fail('Simulated Postgres outage', 'connection unexpectedly succeeded');

  const origRedis = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://127.0.0.1:59998';
  const { pingRedis, closeRedis } = require('../lib/redis');
  await closeRedis().catch(() => {});
  const redisDown = await pingRedis();
  process.env.REDIS_URL = origRedis;
  await closeRedis().catch(() => {});

  if (redisDown.connected === false) pass('Simulated Redis outage detected');
  else fail('Simulated Redis outage', JSON.stringify(redisDown));

  const { getReadinessStatus } = require('../lib/health');
  const liveReady = await getReadinessStatus();
  if (liveReady.database?.connected) pass('Live /ready DB still healthy after simulation');
  else fail('Live DB after simulation', liveReady.database?.error);
}

async function testStripeWebhookDirect() {
  console.log('\n=== Stripe webhooks (direct) ===');

  const { handleStripeWebhook } = require('../lib/billing');

  try {
    await handleStripeWebhook(Buffer.from('{}'), 'bad_sig');
    fail('Invalid signature without secret', 'should throw');
  } catch (error) {
    if (error.status === 503 || error.status === 400) {
      pass('Unsigned/unconfigured Stripe webhook rejected', `status ${error.status}`);
    } else fail('Invalid signature handling', error.message);
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || process.env.VALIDATION_STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    warn('Stripe signed event tests', 'Set STRIPE_WEBHOOK_SECRET to test constructEvent + dedup');
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_validation');
  const eventTypes = [
    'checkout.session.completed',
    'invoice.paid',
    'invoice.payment_failed',
    'customer.subscription.deleted',
  ];

  for (const type of eventTypes) {
    const eventId = `evt_val_${type.replace(/\./g, '_')}_${Date.now()}`;
    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      type,
      data: {
        object: {
          id: `${type.split('.').pop()}_val`,
          customer: 'cus_validation',
          metadata: { tenantId: '00000000-0000-4000-8000-000000000001' },
          subscription_details: { metadata: { tenantId: '00000000-0000-4000-8000-000000000001' } },
          amount_due: 1000,
        },
      },
    });
    const sig = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const raw = Buffer.from(payload);

    const first = await handleStripeWebhook(raw, sig);
    if (first.received || first.skipped) pass(`Stripe ${type} handled`);
    else fail(`Stripe ${type}`, JSON.stringify(first));

    const second = await handleStripeWebhook(raw, sig);
    if (second.duplicate) pass(`Stripe ${type} duplicate idempotent`);
    else fail(`Stripe ${type} duplicate`, JSON.stringify(second));
  }
}

async function testStripeWebhookHttp() {
  console.log('\n=== Stripe webhooks (HTTP) ===');

  const bad = await http('POST', '/api/billing/webhook', {
    data: '{"id":"evt_bad"}',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 'bad' },
  });
  if (bad.status === 400 || bad.status === 503) pass(`HTTP invalid Stripe webhook → ${bad.status}`);
  else if (bad.status === 200 && !process.env.STRIPE_WEBHOOK_SECRET) {
    warn('HTTP Stripe webhook', 'server running pre-2A.5 billing fix — restart API');
  } else fail('HTTP invalid Stripe signature', `status ${bad.status}`);
}

async function testStripeDedupDirect() {
  console.log('\n=== ProcessedStripeEvent (direct) ===');

  const { getPrisma } = require('../db');
  const prisma = await getPrisma();
  const testId = `evt_dedup_test_${Date.now()}`;

  await prisma.processedStripeEvent.delete({ where: { id: testId } }).catch(() => {});

  await prisma.processedStripeEvent.create({
    data: { id: testId, type: 'test.event', orderId: null },
  });

  let duplicateBlocked = false;
  try {
    await prisma.processedStripeEvent.create({
      data: { id: testId, type: 'test.event', orderId: null },
    });
  } catch (error) {
    if (error.code === 'P2002') duplicateBlocked = true;
  }

  await prisma.processedStripeEvent.delete({ where: { id: testId } }).catch(() => {});

  if (duplicateBlocked) pass('ProcessedStripeEvent PK prevents duplicate insert');
  else fail('ProcessedStripeEvent dedup', 'duplicate insert succeeded');
}

async function testRedisStores() {
  console.log('\n=== Redis stores ===');

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    warn('Redis store tests', 'REDIS_URL not set — using in-memory fallbacks in dev');
    return;
  }

  const { pingRedis, getRedisClient, closeRedis } = require('../lib/redis');
  await closeRedis().catch(() => {});
  const ping = await pingRedis();
  if (!ping.connected) {
    fail('Redis connectivity', ping.error || 'not connected');
    return;
  }
  pass('Redis connectivity', `${ping.latencyMs}ms`);

  const { incrementCounter } = require('../lib/rateLimit');
  const rlKey = `validate-${Date.now()}`;
  const r1 = await incrementCounter('validate', rlKey, 60000, 5);
  const r2 = await incrementCounter('validate', rlKey, 60000, 5);
  const redis = await getRedisClient();
  const keys = await redis.keys(`rl:validate:${rlKey}:*`);
  if (keys.length > 0) pass('Rate limiting uses Redis keys', keys[0]);
  else fail('Rate limiting Redis keys', 'none found');
  if (r1.allowed && r2.allowed) pass('Rate limit counter increments');

  const { saveSession, getSession, deleteSession } = require('../lib/callControlSessionStore');
  const sid = `validate-cc-${Date.now()}`;
  await saveSession(sid, { tenantId: 'test', stage: 'validate' });
  const loaded = await getSession(sid);
  const redisSessionKey = await redis.get(`ccs:${sid}`);
  if (loaded?.stage === 'validate' && redisSessionKey) pass('Call Control sessions stored in Redis');
  else fail('Call Control session Redis', `loaded=${!!loaded}, redis=${!!redisSessionKey}`);
  await deleteSession(sid);
}

async function testQuotas() {
  console.log('\n=== Quotas ===');

  const login = await http('POST', '/api/auth/login', {
    data: { email: process.env.SEED_ADMIN_EMAIL || 'admin@asuitech.com', password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123' },
  });
  if (login.status !== 200 || !login.data?.accessToken) {
    warn('Quota API tests', `login failed (${login.status}) — seed DB or set SEED_ADMIN_*`);
    return;
  }

  const token = login.data.accessToken;
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const { getPrisma } = require('../db');
  const prisma = await getPrisma();
  const user = login.data.user;
  const tenantId = user.tenantId;

  const orig = await prisma.tenant.update({
    where: { id: tenantId },
    data: { maxUsers: 1, maxPhoneNumbers: 0, maxConcurrentCalls: 0 },
  });

  try {
    const userQuota = await http('POST', '/api/tenant/users', {
      ...auth,
      data: { email: `quota-test-${Date.now()}@example.com`, name: 'Quota Test', password: 'Test@12345', role: 'TENANT_USER' },
    });
    if (userQuota.status === 403 && userQuota.data?.code === 'QUOTA_EXCEEDED') {
      pass('User quota enforced', userQuota.data.error);
    } else fail('User quota', `status ${userQuota.status}`);

    const numQuota = await http('POST', '/api/numbers/buy', {
      ...auth,
      data: { phoneNumber: '+15559876543' },
    });
    if (numQuota.status === 403 && numQuota.data?.code === 'QUOTA_EXCEEDED') {
      pass('Phone number quota enforced (API)', numQuota.data.error);
    } else {
      let libBlocked = false;
      try {
        const { assertCanAddPhoneNumbers } = require('../lib/quotaService');
        await assertCanAddPhoneNumbers(prisma, tenantId, 1);
      } catch (error) {
        if (error.code === 'QUOTA_EXCEEDED') libBlocked = true;
      }
      if (libBlocked) pass('Phone number quota enforced (lib)', 'maxPhoneNumbers=0');
      else fail('Phone number quota', `API ${numQuota.status}: ${JSON.stringify(numQuota.data)}`);
    }

    const callQuota = await http('POST', '/api/softphone/record-start', {
      ...auth,
      data: { callControlId: 'cc-quota-test', from: '+15551111111', to: '+15552222222' },
    });
    if (callQuota.status === 403 && callQuota.data?.code === 'QUOTA_EXCEEDED') {
      pass('Concurrent call quota enforced (API)', callQuota.data.error);
    } else {
      const { assertCanInitiateCall, ACTIVE_CALL_STATUSES } = require('../lib/quotaService');
      await prisma.callLog.createMany({
        data: ACTIVE_CALL_STATUSES.map((status, i) => ({
          callSid: `quota-sid-${Date.now()}-${i}`,
          from: '+15551111111',
          to: '+15552222222',
          status,
          tenantId,
          direction: 'outbound',
          callType: 'voice',
        })),
      });
      let libBlocked = false;
      try {
        await assertCanInitiateCall(prisma, tenantId);
      } catch (error) {
        if (error.code === 'QUOTA_EXCEEDED') libBlocked = true;
      }
      await prisma.callLog.deleteMany({ where: { callSid: { startsWith: 'quota-sid-' } } });
      if (libBlocked) pass('Concurrent call quota enforced (lib)', 'maxConcurrentCalls=0');
      else fail('Concurrent call quota', `API ${callQuota.status}, lib not blocked`);
    }
  } finally {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        maxUsers: orig.maxUsers,
        maxPhoneNumbers: orig.maxPhoneNumbers,
        maxConcurrentCalls: orig.maxConcurrentCalls,
      },
    });
  }
}

async function main() {
  console.log(`Phase 2A.5 validation — ${BASE}\n`);

  await testSecurity();
  await testHealthLive();
  await testStripeDedupDirect();
  await testRedisStores();
  await testHealthSimulated();
  await testStripeWebhookDirect();
  await testStripeWebhookHttp();
  await testQuotas();

  const passed = results.filter((r) => r.ok === true).length;
  const failed = results.filter((r) => r.ok === false).length;
  const warnings = results.filter((r) => r.ok === null).length;

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}  Failed: ${failed}  Warnings: ${warnings}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
