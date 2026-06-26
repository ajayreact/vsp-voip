/**
 * Staging validation for messaging backend (Priority 3).
 * Run: npx tsx scripts/validate-messaging-staging.js
 *
 * Uses local API + DB when available. Real Telnyx send/receive requires
 * QA credentials, assigned DIDs, and API_PUBLIC_URL reachable by Telnyx.
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
const { sendTelnyxMessage } = require('../lib/messaging/telnyxClient');

const API_BASE = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const QA_EMAIL = process.env.QA_EMAIL || process.env.TEST_EMAIL;
const QA_PASSWORD = process.env.QA_PASSWORD || process.env.TEST_PASSWORD;

const results = [];

function record(name, status, detail) {
  results.push({ name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'SKIP' ? '○' : '✗';
  console.log(`${icon} ${name}: ${detail}`);
}

async function login() {
  if (!QA_EMAIL || !QA_PASSWORD) return null;
  try {
    const res = await axios.post(`${API_BASE}/api/auth/login`, {
      email: QA_EMAIL,
      password: QA_PASSWORD,
    }, { timeout: 10000 });
    return res.data?.accessToken || null;
  } catch {
    return null;
  }
}

async function simulateInboundMms(prisma) {
  const phone = await prisma.phoneNumber.findFirst({
    select: { tenantId: true, number: true },
  });
  if (!phone) {
    record('Inbound MMS (simulated webhook)', 'SKIP', 'No phone numbers in DB');
    return;
  }

  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const fixtureServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(pngBytes);
  });
  await new Promise((resolve) => fixtureServer.listen(0, '127.0.0.1', resolve));
  const mediaUrl = `http://127.0.0.1:${fixtureServer.address().port}/staging.png`;

  const telnyxMessageId = `staging-mms-${Date.now()}`;
  const payload = {
    id: telnyxMessageId,
    text: 'Staging MMS validation',
    from: { phone_number: '+15551234567' },
    to: [{ phone_number: phone.number, status: 'received' }],
    media: [{
      url: mediaUrl,
      content_type: 'image/png',
      filename: 'staging.png',
    }],
  };

  let saved;
  try {
    saved = await handleTelnyxMessagingEvent(prisma, {
      data: { event_type: 'message.received', payload },
    });
  } finally {
    await new Promise((resolve) => fixtureServer.close(resolve));
  }

  if (!saved?.id) {
    record('Inbound MMS (simulated webhook)', 'FAIL', 'Webhook handler returned no message');
    return;
  }

  const message = await prisma.message.findUnique({
    where: { id: saved.id },
    include: { attachments: true, legacySms: true },
  });

  const attachment = message?.attachments?.[0];
  if (!attachment) {
    record('Inbound MMS (simulated webhook)', 'FAIL', 'No attachment persisted');
    return;
  }

  const fileExists = fs.existsSync(path.join(UPLOADS_DIR, attachment.storageKey));
  const durable = isDurablePublicUrl(attachment.publicUrl);

  if (!durable || !fileExists || attachment.sizeBytes <= 0 || attachment.mimeType !== 'image/png') {
    record(
      'Inbound MMS (simulated webhook)',
      'FAIL',
      `attachment durable=${durable} file=${fileExists} size=${attachment.sizeBytes} mime=${attachment.mimeType}`,
    );
    return;
  }

  record('Inbound MMS (simulated webhook)', 'PASS', `Stored ${attachment.storageKey} (${attachment.sizeBytes} bytes)`);

  const duplicate = await handleTelnyxMessagingEvent(prisma, {
    data: { event_type: 'message.received', payload },
  });
  const dupCount = await prisma.message.count({ where: { telnyxMessageId } });
  record(
    'Duplicate inbound webhook',
    dupCount === 1 ? 'PASS' : 'FAIL',
    `message rows for ${telnyxMessageId}: ${dupCount}`,
  );

  const tenantNumbers = await prisma.phoneNumber.findMany({
    where: { tenantId: phone.tenantId },
    select: { number: true },
  });
  const legacyConversations = await buildConversations(
    prisma,
    phone.tenantId,
    tenantNumbers.map((row) => row.number),
  );
  const conv = legacyConversations.find((item) => item.line === phone.number);
  record(
    'Legacy SMS unread compatibility',
    conv && typeof conv.unreadCount === 'number' ? 'PASS' : 'FAIL',
    conv ? `unreadCount=${conv.unreadCount}, lastMessageId=${conv.lastMessage?.id}` : 'conversation not found',
  );
}

async function validateLiveTelnyx() {
  if (!process.env.TELNYX_API_KEY) {
    record('Outbound SMS (live Telnyx)', 'SKIP', 'TELNYX_API_KEY not set');
    record('Outbound MMS (live Telnyx)', 'SKIP', 'TELNYX_API_KEY not set');
    record('Delivery receipts (live Telnyx)', 'SKIP', 'Requires live send + webhook');
    return;
  }

  const from = process.env.QA_SMS_FROM?.trim();
  const to = process.env.QA_SMS_TO?.trim();
  if (!from || !to) {
    record('Outbound SMS (live Telnyx)', 'SKIP', 'Set QA_SMS_FROM and QA_SMS_TO for live send validation');
    record('Outbound MMS (live Telnyx)', 'SKIP', 'Set QA_SMS_FROM, QA_SMS_TO, and QA_MMS_MEDIA_URL');
    record('Delivery receipts (live Telnyx)', 'SKIP', 'Requires QA_SMS_FROM/QA_SMS_TO live send');
    return;
  }

  try {
    const sms = await sendTelnyxMessage({
      from,
      to,
      text: `VSP staging SMS validation ${new Date().toISOString()}`,
      messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
    });
    record('Outbound SMS (live Telnyx)', 'PASS', `telnyxMessageId=${sms?.id || 'unknown'}`);
  } catch (error) {
    record('Outbound SMS (live Telnyx)', 'FAIL', error.message);
  }

  const mediaUrl = process.env.QA_MMS_MEDIA_URL?.trim();
  if (!mediaUrl) {
    record('Outbound MMS (live Telnyx)', 'SKIP', 'Set QA_MMS_MEDIA_URL to a public HTTPS image URL');
  } else {
    try {
      const mms = await sendTelnyxMessage({
        from,
        to,
        text: 'VSP staging MMS validation',
        media_urls: [mediaUrl],
        messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
      });
      record('Outbound MMS (live Telnyx)', 'PASS', `telnyxMessageId=${mms?.id || 'unknown'}`);
    } catch (error) {
      record('Outbound MMS (live Telnyx)', 'FAIL', error.message);
    }
  }

  record('Inbound SMS (live Telnyx)', 'SKIP', 'Send an SMS to QA_SMS_FROM and confirm /webhook/sms + portal inbox');
  record('Delivery receipts (live Telnyx)', 'SKIP', 'Confirm message.finalized webhook updates message status in portal');
}

async function validateApiEndpoints(token) {
  if (!token) {
    record('Authenticated messaging API', 'SKIP', 'Login unavailable');
    return;
  }

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const conversations = await axios.get(`${API_BASE}/api/conversations`, { headers, timeout: 10000 });
    const legacy = await axios.get(`${API_BASE}/api/sms/conversations`, { headers, timeout: 10000 });
    record(
      'Authenticated messaging API',
      conversations.status === 200 && legacy.status === 200 ? 'PASS' : 'FAIL',
      `conversations=${conversations.status}, legacy=${legacy.status}`,
    );
  } catch (error) {
    record('Authenticated messaging API', 'FAIL', error.message);
  }
}

async function main() {
  console.log('Messaging staging validation');
  console.log(`API base: ${API_BASE}`);

  let prisma;
  try {
    prisma = await getPrisma();
    record('Database connectivity', 'PASS', 'Prisma connected');
  } catch (error) {
    record('Database connectivity', 'FAIL', error.message);
    printSummary();
    process.exit(1);
  }

  const token = await login();
  await validateApiEndpoints(token);
  await simulateInboundMms(prisma);
  await validateLiveTelnyx();

  const ephemeralAttachments = await prisma.messageAttachment.count({
    where: {
      sizeBytes: 0,
      publicUrl: { contains: 'telnyx' },
    },
  });
  record(
    'Historical MMS attachment check',
    ephemeralAttachments === 0 ? 'PASS' : 'FAIL',
    ephemeralAttachments
      ? `${ephemeralAttachments} attachment(s) still reference ephemeral Telnyx URLs`
      : 'No ephemeral Telnyx attachment URLs remain',
  );

  printSummary();
  process.exit(results.some((item) => item.status === 'FAIL') ? 1 : 0);
}

function printSummary() {
  const pass = results.filter((item) => item.status === 'PASS').length;
  const fail = results.filter((item) => item.status === 'FAIL').length;
  const skip = results.filter((item) => item.status === 'SKIP').length;
  console.log('\nSummary');
  console.log(`PASS: ${pass}  FAIL: ${fail}  SKIP: ${skip}`);

  const reportPath = path.join(process.cwd(), 'reports', 'messaging-staging-validation.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    apiBase: API_BASE,
    results,
  }, null, 2));
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
