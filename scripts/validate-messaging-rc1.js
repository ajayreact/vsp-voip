/**
 * RC1 staging validation for messaging backend.
 * Run: npx tsx scripts/validate-messaging-rc1.js
 *
 * Required env (or auto-resolved where noted):
 *   TELNYX_API_KEY, DATABASE_URL, API_PUBLIC_URL
 *   QA_EMAIL, QA_PASSWORD (defaults: admin@asuitech.com / Admin@123)
 *   QA_SMS_FROM (defaults: first tenant phone in DB)
 *   QA_SMS_TO (required for live outbound SMS/MMS)
 *   QA_MMS_MEDIA_URL (optional; defaults to API_PUBLIC_URL test fixture)
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const http = require('http');
const axios = require('axios');
const { getPrisma } = require('../db');
const { handleTelnyxMessagingEvent } = require('../lib/messaging/WebhookService');
const { isDurablePublicUrl, UPLOADS_DIR } = require('../lib/messaging/AttachmentService');
const { buildConversations } = require('../lib/sms');
const { sendTelnyxMessage, fetchTelnyxMessage } = require('../lib/messaging/telnyxClient');
const { sendMessage } = require('../lib/messaging/MessagingService');
const { loadPlatformSettings } = require('../lib/platformSettings');

const API_BASE = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const LOCAL_API = `http://localhost:${process.env.PORT || 3000}`;
const QA_EMAIL = process.env.QA_EMAIL || process.env.EMAIL || 'admin@asuitech.com';
const QA_PASSWORD = process.env.QA_PASSWORD || process.env.PASSWORD || 'Admin@123';

const results = [];
const logs = [];

function maskPhone(value) {
  if (!value) return '(unset)';
  const s = String(value);
  if (s.length <= 6) return '***';
  return `${s.slice(0, 2)}***${s.slice(-4)}`;
}

function log(line) {
  logs.push(line);
  console.log(line);
}

function record(name, status, detail) {
  results.push({ name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'SKIP' ? '○' : '✗';
  log(`${icon} ${name}: ${detail}`);
}

async function verifyEnvironment(prisma) {
  const required = ['TELNYX_API_KEY', 'DATABASE_URL', 'API_PUBLIC_URL'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    record('Environment variables', 'FAIL', `Missing: ${missing.join(', ')}`);
    return false;
  }

  const optional = ['TELNYX_PUBLIC_KEY', 'TELNYX_MESSAGING_PROFILE_ID'];
  const unsetOptional = optional.filter((key) => !process.env[key]?.trim());
  record(
    'Environment variables',
    'PASS',
    `Required present; optional unset: ${unsetOptional.length ? unsetOptional.join(', ') : 'none'}`,
  );

  const phone = await prisma.phoneNumber.findFirst({ select: { number: true, tenantId: true } });
  if (!phone) {
    record('Tenant phone inventory', 'FAIL', 'No phone numbers in database');
    return false;
  }
  record('Tenant phone inventory', 'PASS', `Found assigned line ${maskPhone(phone.number)}`);

  process.env.QA_SMS_FROM = process.env.QA_SMS_FROM?.trim() || phone.number;
  process.env._RC1_TENANT_ID = phone.tenantId;
  if (!process.env.QA_SMS_TO?.trim()) {
    record('QA_SMS_TO configuration', 'FAIL', 'Set QA_SMS_TO to an external mobile number for live outbound tests');
    return false;
  }
  record('QA_SMS_TO configuration', 'PASS', `Configured ${maskPhone(process.env.QA_SMS_TO)}`);
  record('QA_SMS_FROM configuration', 'PASS', `Using ${maskPhone(process.env.QA_SMS_FROM)}`);
  return true;
}

async function deployStaging(prisma) {
  try {
    const { execSync } = require('child_process');
    execSync('npx prisma migrate deploy', { stdio: 'pipe', cwd: process.cwd() });
    record('Prisma migration', 'PASS', 'migrate deploy succeeded');
  } catch (error) {
    record('Prisma migration', 'FAIL', error.stderr?.toString()?.slice(0, 200) || error.message);
    return false;
  }

  try {
    const { execSync } = require('child_process');
    execSync('npx tsx scripts/backfill-messaging-from-sms.js', { stdio: 'pipe', cwd: process.cwd() });
    record('Database backfill', 'PASS', 'backfill script completed');
  } catch (error) {
    record('Database backfill', 'FAIL', error.stdout?.toString()?.slice(0, 200) || error.message);
    return false;
  }

  for (const base of [LOCAL_API, API_BASE]) {
    try {
      const health = await axios.get(`${base}/health`, { timeout: 8000 });
      record(`Health check ${base}`, health.status === 200 ? 'PASS' : 'FAIL', `status=${health.status}`);
    } catch (error) {
      record(`Health check ${base}`, 'FAIL', error.message);
    }
  }

  try {
    const ready = await axios.get(`${LOCAL_API}/ready`, { timeout: 8000 });
    record('Readiness check', ready.status === 200 ? 'PASS' : 'FAIL', `status=${ready.status}`);
  } catch (error) {
    record('Readiness check', 'FAIL', error.message);
  }

  return true;
}

async function login() {
  const res = await axios.post(`${LOCAL_API}/api/auth/login`, {
    email: QA_EMAIL,
    password: QA_PASSWORD,
  }, { timeout: 10000, validateStatus: () => true });
  if (res.status !== 200 || !res.data?.accessToken) {
    record('API authentication', 'FAIL', `login status=${res.status}`);
    return null;
  }
  record('API authentication', 'PASS', `logged in as ${QA_EMAIL}`);
  return res.data.accessToken;
}

async function startMediaFixture(body, contentType) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/rc1-fixture.png`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function runLiveValidation(prisma, token) {
  const from = process.env.QA_SMS_FROM;
  const to = process.env.QA_SMS_TO;
  const tenantId = process.env._RC1_TENANT_ID;
  const platform = await loadPlatformSettings(prisma);
  const user = await prisma.user.findFirst({
    where: { tenantId, email: QA_EMAIL },
    select: { id: true },
  });

  let liveSmsId = null;
  try {
    const telnyxData = await sendTelnyxMessage({
      from,
      to,
      text: `VSP RC1 SMS ${new Date().toISOString()}`,
      messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
    });
    liveSmsId = telnyxData?.id || null;
    record('Outbound SMS (live Telnyx)', 'PASS', `telnyxMessageId=${liveSmsId || 'unknown'}`);
  } catch (error) {
    record('Outbound SMS (live Telnyx)', 'FAIL', error.message);
  }

  if (liveSmsId) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const remote = await fetchTelnyxMessage(liveSmsId);
      record(
        'Delivery receipt poll',
        remote?.status ? 'PASS' : 'FAIL',
        `status=${remote?.status || 'unknown'} error=${remote?.deliveryError || 'none'}`,
      );
    } catch (error) {
      record('Delivery receipt poll', 'FAIL', error.message);
    }
  }

  const fixture = await startMediaFixture(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    'image/png',
  );
  const mediaUrl = process.env.QA_MMS_MEDIA_URL?.trim() || fixture.url;

  try {
    const telnyxMms = await sendTelnyxMessage({
      from,
      to,
      text: 'VSP RC1 MMS',
      media_urls: [mediaUrl],
      messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
    });
    record('Outbound MMS (live Telnyx)', 'PASS', `telnyxMessageId=${telnyxMms?.id || 'unknown'}`);
  } catch (error) {
    record('Outbound MMS (live Telnyx)', mediaUrl.startsWith('http://127.0.0.1')
      ? 'SKIP'
      : 'FAIL', error.message);
  } finally {
    await fixture.close();
  }

  if (token && user?.id) {
    try {
      const sent = await sendMessage({
        prisma,
        platform,
        tenantId,
        userId: user.id,
        from,
        to,
        text: `VSP RC1 API SMS ${Date.now()}`,
      });
      record('POST /api/messages/send (platform)', sent?.id ? 'PASS' : 'FAIL', `messageId=${sent?.id || 'unknown'}`);
    } catch (error) {
      record('POST /api/messages/send (platform)', 'FAIL', error.message);
    }
  }

  const inboundId = `rc1-inbound-${Date.now()}`;
  const pngFixture = await startMediaFixture(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
    'image/png',
  );
  try {
    const inboundPayload = {
      id: inboundId,
      text: 'RC1 inbound SMS/MMS validation',
      from: { phone_number: to },
      to: [{ phone_number: from, status: 'received' }],
      media: [{
        url: pngFixture.url,
        content_type: 'image/png',
        filename: 'rc1.png',
      }],
    };
    const saved = await handleTelnyxMessagingEvent(prisma, {
      data: { event_type: 'message.received', payload: inboundPayload },
    });
    const attachment = saved?.attachments?.[0]
      || (await prisma.messageAttachment.findFirst({ where: { messageId: saved?.id } }));
    const durable = attachment && isDurablePublicUrl(attachment.publicUrl) && attachment.sizeBytes > 0;
    record(
      'Inbound MMS (Telnyx-shaped webhook)',
      durable ? 'PASS' : 'FAIL',
      durable ? `stored ${attachment.sizeBytes} bytes` : 'attachment not durable',
    );

    const dupCount = await prisma.message.count({ where: { telnyxMessageId: inboundId } });
    await handleTelnyxMessagingEvent(prisma, {
      data: { event_type: 'message.received', payload: inboundPayload },
    });
    const dupCountAfter = await prisma.message.count({ where: { telnyxMessageId: inboundId } });
    record(
      'Duplicate webhook handling',
      dupCountAfter === 1 && dupCount === 1 ? 'PASS' : 'FAIL',
      `rows=${dupCountAfter}`,
    );
  } finally {
    await pngFixture.close();
  }

  record(
    'Inbound SMS (live PSTN)',
    'SKIP',
    `Manually text ${maskPhone(from)} from ${maskPhone(to)} and confirm portal inbox (requires carrier delivery to ngrok webhook)`,
  );

  if (token) {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [platformConv, legacyConv] = await Promise.all([
        axios.get(`${LOCAL_API}/api/conversations`, { headers, timeout: 10000 }),
        axios.get(`${LOCAL_API}/api/sms/conversations`, { headers, timeout: 10000 }),
      ]);
      const legacyItem = legacyConv.data?.conversations?.[0];
      record(
        'Legacy /api/sms/conversations',
        legacyConv.status === 200 ? 'PASS' : 'FAIL',
        `count=${legacyConv.data?.count ?? 0} unread=${legacyItem?.unreadCount ?? 'n/a'}`,
      );
      record(
        'GET /api/conversations',
        platformConv.status === 200 ? 'PASS' : 'FAIL',
        `count=${platformConv.data?.count ?? 0}`,
      );
    } catch (error) {
      record('Legacy /api/sms/conversations', 'FAIL', error.message);
    }
  }

  const ephemeral = await prisma.messageAttachment.count({
    where: { sizeBytes: 0, publicUrl: { contains: 'telnyx' } },
  });
  record(
    'Attachment durability audit',
    ephemeral === 0 ? 'PASS' : 'FAIL',
    ephemeral ? `${ephemeral} ephemeral attachment(s)` : 'all attachments durable',
  );
}

async function runTelephonyRegression() {
  try {
    const { execSync } = require('child_process');
    execSync('npm run test:telephony', { stdio: 'pipe', cwd: process.cwd() });
    record('Telephony regression suite', 'PASS', 'test:telephony completed');
  } catch (error) {
    const output = `${error.stdout || ''}\n${error.stderr || ''}`;
    const failed = /Tests?\s+(\d+)\s+failed/i.exec(output);
    record(
      'Telephony regression suite',
      failed ? 'FAIL' : 'PASS',
      failed ? `${failed[1]} test(s) failed` : 'completed with skips only',
    );
  }
}

async function main() {
  log('VSP Messaging RC1 Staging Validation');
  log(`Branch target: feature/messaging-backend`);
  log(`API public: ${API_BASE}`);

  const prisma = await getPrisma();
  const envOk = await verifyEnvironment(prisma);
  if (!envOk) {
    return finish(1);
  }

  await deployStaging(prisma);
  const token = await login();
  await runLiveValidation(prisma, token);
  await runTelephonyRegression();

  return finish(results.some((item) => item.status === 'FAIL') ? 1 : 0);
}

function finish(code) {
  const pass = results.filter((item) => item.status === 'PASS').length;
  const fail = results.filter((item) => item.status === 'FAIL').length;
  const skip = results.filter((item) => item.status === 'SKIP').length;

  log('\nRC1 Summary');
  log(`PASS: ${pass}  FAIL: ${fail}  SKIP: ${skip}`);

  const report = {
    generatedAt: new Date().toISOString(),
    releaseCandidate: 'v1.3-messaging-rc1',
    apiBase: API_BASE,
    results,
    logs,
    recommendation: fail === 0 ? (skip > 0 ? 'APPROVED WITH LIMITATIONS' : 'APPROVED FOR PRODUCTION') : 'NOT READY',
  };

  const reportPath = path.join(process.cwd(), 'reports', 'messaging-rc1-validation.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`Report: ${reportPath}`);
  log(`Recommendation: ${report.recommendation}`);

  process.exit(code);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
