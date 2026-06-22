#!/usr/bin/env node
/**
 * P0 launch readiness validation
 * Run: npm run validate:p0
 * Production: API_BASE=https://api.yourdomain.com npm run validate:p0
 */
require('dotenv').config();

const axios = require('axios');

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
  return axios({ method, url: `${BASE}${path}`, validateStatus: () => true, timeout: 15000, ...opts });
}

async function checkEnv() {
  console.log('\n=== Environment (production rules) ===');
  const isProd = process.env.NODE_ENV === 'production';

  const required = [
    'DATABASE_URL',
    'TELNYX_API_KEY',
    'API_PUBLIC_URL',
    'WEB_ORIGIN',
  ];

  const prodOnly = [
    'JWT_SECRET',
    'SETTINGS_ENCRYPTION_KEY',
    'TELNYX_PUBLIC_KEY',
    'REDIS_URL',
    'STRIPE_WEBHOOK_SECRET',
    'SMTP_HOST',
    'SMTP_FROM',
  ];

  for (const key of required) {
    if (process.env[key]?.trim()) pass(`Env ${key} set`);
    else fail(`Env ${key} set`);
  }

  if (isProd) {
    for (const key of prodOnly) {
      if (process.env[key]?.trim()) pass(`Env ${key} set (production)`);
      else fail(`Env ${key} set (production)`);
    }
  } else {
    warn('Production env vars', 'NODE_ENV !== production — skipping strict prod-only checks');
  }
}

async function checkReadiness() {
  console.log('\n=== Readiness endpoint ===');

  const ready = await http('GET', '/ready');
  if (ready.status !== 200 && ready.status !== 503) {
    fail('/ready responds', `status ${ready.status}`);
    return;
  }

  const d = ready.data;
  if (d.database?.connected) pass('Database connected', `${d.database.latencyMs}ms`);
  else fail('Database connected', d.database?.error);

  if (d.redis?.connected) pass('Redis connected');
  else if (d.redis?.optional) warn('Redis', 'not connected (optional in dev)');
  else fail('Redis connected', d.redis?.error);

  if (d.telnyx?.apiKeyConfigured) pass('Telnyx API key configured');
  else fail('Telnyx API key configured');

  if (d.stripe?.webhookConfigured) pass('Stripe webhook secret configured');
  else warn('Stripe webhook secret', 'not configured');

  if (d.smtp?.connected) pass('SMTP connected');
  else if (d.smtp?.optional) warn('SMTP', 'not connected (optional in dev)');
  else fail('SMTP connected', d.smtp?.error);

  if (d.ready) pass('/ready overall', 'ready=true');
  else warn('/ready overall', 'ready=false');
}

async function checkSmtpModule() {
  console.log('\n=== SMTP module ===');
  const { isSmtpConfigured, verifySmtpConnection } = require('../lib/mailer');
  const { welcomeEmail, passwordResetEmail, paymentReceiptEmail } = require('../lib/emailTemplates');

  if (isSmtpConfigured()) pass('SMTP configured in mailer');
  else warn('SMTP configured', 'set SMTP_HOST + SMTP_FROM');

  const templates = [
    ['Welcome template', welcomeEmail({ name: 'Test', email: 't@t.com', tenantName: 'Test Co' })],
    ['Password reset template', passwordResetEmail({ name: 'Test', resetUrl: 'https://example.com/reset' })],
    ['Receipt template', paymentReceiptEmail({ tenantName: 'Test', order: { id: 'ord_1' }, phoneNumbers: ['+15551234567'], amount: 99 })],
  ];

  for (const [name, tpl] of templates) {
    if (tpl.subject && tpl.text) pass(name);
    else fail(name);
  }

  const smtp = await verifySmtpConnection();
  if (smtp.connected) pass('SMTP verify() connection');
  else if (smtp.optional) warn('SMTP verify()', 'skipped or failed in dev');
  else fail('SMTP verify()', smtp.error);
}

async function checkPasswordResetApi() {
  console.log('\n=== Password reset API ===');
  const res = await http('POST', '/api/auth/forgot-password', {
    data: { email: 'nonexistent-p0-test@example.com' },
  });
  if (res.status === 200 && res.data?.success) pass('POST /api/auth/forgot-password');
  else fail('POST /api/auth/forgot-password', `status ${res.status}`);
}

async function checkDocs() {
  console.log('\n=== Launch documentation ===');
  const fs = require('fs');
  const path = require('path');
  const docs = [
    'docs/launch/README.md',
    'docs/launch/production-deployment-guide.md',
    'docs/launch/stripe-go-live-guide.md',
    'docs/launch/telnyx-go-live-guide.md',
    'docs/launch/smtp-setup-guide.md',
    'docs/launch/customer-onboarding-sop.md',
    'docs/launch/launch-checklist.md',
    'docs/launch/remaining-risks-report.md',
  ];

  for (const doc of docs) {
    const full = path.join(__dirname, '..', doc);
    if (fs.existsSync(full)) pass(`Doc exists: ${doc}`);
    else fail(`Doc exists: ${doc}`);
  }
}

async function main() {
  console.log(`P0 Launch Validation — ${BASE}\n`);
  await checkEnv();
  await checkReadiness();
  await checkSmtpModule();
  await checkPasswordResetApi();
  await checkDocs();

  const failed = results.filter((r) => r.ok === false).length;
  const warnings = results.filter((r) => r.ok === null).length;
  const passed = results.filter((r) => r.ok === true).length;

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}  Failed: ${failed}  Warnings: ${warnings}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
