const axios = require('axios');
const { normalizePhoneNumber } = require('./phone');
const { isTenantOperational } = require('./tenantGuard');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

const PENDING_SMS_STATUSES = new Set(['queued', 'sending', 'sent']);

function getSmsWebhookUrl() {
  return `${process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`}/webhook/sms`;
}

function isSmsWebhookReachable() {
  const publicUrl = process.env.API_PUBLIC_URL?.trim();
  return Boolean(publicUrl && !/localhost|127\.0\.0\.1/i.test(publicUrl));
}

function isPendingSmsStatus(status) {
  return PENDING_SMS_STATUSES.has(String(status || '').toLowerCase());
}

function extractTelnyxDeliveryStatus(data) {
  if (!data) return null;
  const toStatus = Array.isArray(data.to) ? data.to[0]?.status : data.to?.status;
  return toStatus || data.status || null;
}

function getMessagingProfileId(platform) {
  return platform?.telnyxMessagingProfileId
    || process.env.TELNYX_MESSAGING_PROFILE_ID?.trim()
    || null;
}

function mapSmsMessage(message) {
  return {
    id: message.id,
    tenantId: message.tenantId,
    telnyxMessageId: message.telnyxMessageId,
    from: message.from,
    to: message.to,
    body: message.body,
    direction: message.direction,
    status: message.status,
    deliveryError: message.deliveryError || null,
    isRead: message.isRead,
    createdAt: message.createdAt,
  };
}

function extractPhoneNumber(value) {
  if (!value) return null;
  if (typeof value === 'string') return normalizePhoneNumber(value);
  if (typeof value === 'object' && value.phone_number) {
    return normalizePhoneNumber(value.phone_number);
  }
  return null;
}

async function resolveTenantIdByNumber(prisma, phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return null;

  const phone = await prisma.phoneNumber.findUnique({
    where: { number: normalized },
    select: { tenantId: true },
  });
  return phone?.tenantId ?? null;
}

function resolveConversationParties(message, tenantNumbers) {
  const numberSet = new Set(tenantNumbers.map((n) => normalizePhoneNumber(n)).filter(Boolean));
  const from = normalizePhoneNumber(message.from);
  const to = normalizePhoneNumber(message.to);
  if (!from || !to) return null;

  if (numberSet.has(to)) return { peer: from, line: to };
  if (numberSet.has(from)) return { peer: to, line: from };
  return null;
}

function conversationKey(peer, line) {
  return `${line}|${peer}`;
}

async function buildConversations(prisma, tenantId, tenantNumbers) {
  const messages = await prisma.smsMessage.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const conversations = new Map();

  for (const message of messages) {
    const parties = resolveConversationParties(message, tenantNumbers);
    if (!parties) continue;

    const key = conversationKey(parties.peer, parties.line);
    const existing = conversations.get(key);
    if (existing) {
      if (message.direction === 'inbound' && !message.isRead) {
        existing.unreadCount += 1;
      }
      continue;
    }

    conversations.set(key, {
      peer: parties.peer,
      line: parties.line,
      lastMessage: mapSmsMessage(message),
      unreadCount: message.direction === 'inbound' && !message.isRead ? 1 : 0,
    });
  }

  return Array.from(conversations.values()).sort(
    (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
  );
}

async function saveInboundSmsFromEvent(prisma, payload) {
  const telnyxMessageId = payload.id || payload.message_id || null;
  const text = payload.text ?? payload.body ?? '';
  if (!text && !telnyxMessageId) return null;

  const from = extractPhoneNumber(payload.from) || 'unknown';
  const toEntry = Array.isArray(payload.to) ? payload.to[0] : payload.to;
  const to = extractPhoneNumber(toEntry) || extractPhoneNumber(payload.to) || 'unknown';

  let tenantId = await resolveTenantIdByNumber(prisma, to);
  if (!tenantId) tenantId = await resolveTenantIdByNumber(prisma, from);
  if (!tenantId) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, isActive: true, billingStatus: true, billingGraceUntil: true },
  });
  if (!tenant || !isTenantOperational(tenant)) {
    console.warn('SMS inbound blocked: tenant suspended or inactive', { tenantId });
    return null;
  }

  if (telnyxMessageId) {
    const existing = await prisma.smsMessage.findUnique({ where: { telnyxMessageId } });
    if (existing) return existing;
  }

  const status = payload.to?.[0]?.status
    || payload.status
    || 'received';

  return prisma.smsMessage.create({
    data: {
      tenantId,
      telnyxMessageId,
      from,
      to,
      body: String(text),
      direction: 'inbound',
      status: String(status),
      isRead: false,
    },
  });
}

async function upsertOutboundSmsStatus(prisma, payload) {
  const telnyxMessageId = payload.id || payload.message_id || null;
  if (!telnyxMessageId) return null;

  const status = extractTelnyxDeliveryStatus(payload) || 'sent';
  const existing = await prisma.smsMessage.findUnique({ where: { telnyxMessageId } });
  if (!existing) return null;

  return prisma.smsMessage.update({
    where: { id: existing.id },
    data: { status: String(status) },
  });
}

async function fetchTelnyxMessageStatus(telnyxMessageId) {
  if (!TELNYX_API_KEY || !telnyxMessageId) return null;

  const response = await axios.get(`https://api.telnyx.com/v2/messages/${telnyxMessageId}`, {
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      Accept: 'application/json',
    },
  });

  const data = response.data?.data;
  const status = extractTelnyxDeliveryStatus(data);
  const errors = [
    ...(Array.isArray(data?.errors) ? data.errors : []),
    ...(Array.isArray(data?.to?.[0]?.errors) ? data.to[0].errors : []),
  ]
    .map((item) => item?.detail || item?.title || item?.code)
    .filter(Boolean);

  return {
    status,
    deliveryError: errors[0] || null,
  };
}

async function syncSmsMessageStatuses(prisma, messages) {
  if (!TELNYX_API_KEY || !Array.isArray(messages) || !messages.length) {
    return messages;
  }

  const pending = messages.filter(
    (message) => message.direction === 'outbound'
      && message.telnyxMessageId
      && isPendingSmsStatus(message.status),
  );
  if (!pending.length) return messages;

  const updates = new Map();
  await Promise.all(pending.map(async (message) => {
    try {
      const remote = await fetchTelnyxMessageStatus(message.telnyxMessageId);
      if (!remote?.status || remote.status === message.status) {
        if (remote?.deliveryError) {
          message.deliveryError = remote.deliveryError;
        }
        return;
      }

      const updated = await prisma.smsMessage.update({
        where: { id: message.id },
        data: { status: String(remote.status) },
      });
      if (remote.deliveryError) {
        updated.deliveryError = remote.deliveryError;
      }
      updates.set(message.id, updated);
    } catch (error) {
      const detail = error.response?.data?.errors?.[0]?.detail || error.message;
      console.warn(`SMS status sync failed for ${message.telnyxMessageId}:`, detail);
    }
  }));

  if (!updates.size) return messages;
  return messages.map((message) => updates.get(message.id) || message);
}

async function sendSmsMessage({
  prisma,
  platform,
  tenantId,
  from,
  to,
  text,
}) {
  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('TELNYX_API_KEY is not configured'), { status: 500 });
  }

  const normalizedFrom = normalizePhoneNumber(from);
  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedFrom || !normalizedTo) {
    throw Object.assign(new Error('Invalid from or to phone number'), { status: 400 });
  }

  const body = String(text || '').trim();
  if (!body) {
    throw Object.assign(new Error('Message text is required'), { status: 400 });
  }
  if (body.length > 1600) {
    throw Object.assign(new Error('Message is too long (max 1600 characters)'), { status: 400 });
  }

  const owned = await prisma.phoneNumber.findFirst({
    where: { tenantId, number: normalizedFrom },
  });
  if (!owned) {
    throw Object.assign(new Error('Caller ID must be one of your assigned numbers'), { status: 403 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, isActive: true, billingStatus: true, billingGraceUntil: true },
  });
  if (!tenant || !isTenantOperational(tenant)) {
    throw Object.assign(new Error('This organization is suspended. Outbound SMS is disabled.'), { status: 403 });
  }

  const messagingProfileId = getMessagingProfileId(platform);
  const payload = {
    from: normalizedFrom,
    to: normalizedTo,
    text: body,
  };
  if (messagingProfileId) {
    payload.messaging_profile_id = messagingProfileId;
  }

  let telnyxData;
  try {
    const response = await axios.post('https://api.telnyx.com/v2/messages', payload, {
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    telnyxData = response.data?.data;
  } catch (error) {
    const detail = error.response?.data?.errors?.[0]?.detail || error.message;
    throw Object.assign(new Error(detail || 'Telnyx rejected the SMS'), {
      status: error.response?.status || 502,
    });
  }

  const telnyxMessageId = telnyxData?.id || null;
  const status = telnyxData?.to?.[0]?.status || telnyxData?.status || 'sent';

  if (telnyxMessageId) {
    const existing = await prisma.smsMessage.findUnique({ where: { telnyxMessageId } });
    if (existing) return existing;
  }

  return prisma.smsMessage.create({
    data: {
      tenantId,
      telnyxMessageId,
      from: normalizedFrom,
      to: normalizedTo,
      body,
      direction: 'outbound',
      status: String(status),
      isRead: true,
    },
  });
}

async function handleTelnyxSmsEvent(prisma, body) {
  const eventType = body?.data?.event_type;
  const payload = body?.data?.payload;
  if (!payload) return null;

  if (eventType === 'message.received') {
    return saveInboundSmsFromEvent(prisma, payload);
  }

  if (eventType?.startsWith('message.') && eventType !== 'message.received') {
    return upsertOutboundSmsStatus(prisma, payload);
  }

  return null;
}

module.exports = {
  getMessagingProfileId,
  getSmsWebhookUrl,
  isSmsWebhookReachable,
  isPendingSmsStatus,
  mapSmsMessage,
  buildConversations,
  resolveConversationParties,
  conversationKey,
  saveInboundSmsFromEvent,
  upsertOutboundSmsStatus,
  syncSmsMessageStatuses,
  sendSmsMessage,
  handleTelnyxSmsEvent,
};
