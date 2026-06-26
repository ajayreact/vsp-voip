const { normalizePhoneNumber } = require('../phone');
const { isTenantOperational } = require('../tenantGuard');
const {
  saveInboundFromWebhook,
  updateOutboundFromWebhook,
} = require('./MessagingService');

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

function extractInboundMediaItems(payload) {
  const items = [];
  const seen = new Set();

  if (Array.isArray(payload.media)) {
    for (const item of payload.media) {
      if (!item?.url || seen.has(item.url)) continue;
      seen.add(item.url);
      items.push({
        url: item.url,
        contentType: item.content_type || item.contentType || null,
        fileName: item.filename || item.file_name || null,
        hash: item.sha256 || null,
      });
    }
  }

  if (Array.isArray(payload.media_urls)) {
    for (const url of payload.media_urls) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      items.push({ url, contentType: null, fileName: null, hash: null });
    }
  }

  return items;
}

function extractInboundMedia(payload) {
  return extractInboundMediaItems(payload).map((item) => item.url);
}

async function handleInboundReceived(prisma, payload) {
  const telnyxMessageId = payload.id || payload.message_id || null;
  const text = payload.text ?? payload.body ?? '';
  const mediaItems = extractInboundMediaItems(payload);
  if (!text && !telnyxMessageId && !mediaItems.length) return null;

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
    console.warn('Messaging inbound blocked: tenant suspended or inactive', { tenantId });
    return null;
  }

  const status = payload.to?.[0]?.status || payload.status || 'received';
  const messageType = mediaItems.length ? 'MMS' : 'SMS';

  return saveInboundFromWebhook(prisma, {
    tenantId,
    telnyxMessageId,
    from,
    to,
    body: String(text || ''),
    messageType,
    status,
    mediaItems,
  });
}

async function handleTelnyxMessagingEvent(prisma, body) {
  const eventType = body?.data?.event_type;
  const payload = body?.data?.payload;
  if (!payload) return null;

  if (eventType === 'message.received') {
    return handleInboundReceived(prisma, payload);
  }

  if (eventType?.startsWith('message.') && eventType !== 'message.received') {
    return updateOutboundFromWebhook(prisma, payload);
  }

  return null;
}

module.exports = {
  handleTelnyxMessagingEvent,
  handleInboundReceived,
  extractInboundMediaItems,
  extractInboundMedia,
  resolveTenantIdByNumber,
};
