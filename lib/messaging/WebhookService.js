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

function extractInboundMedia(payload) {
  const urls = [];
  if (Array.isArray(payload.media)) {
    for (const item of payload.media) {
      if (item?.url) urls.push(item.url);
    }
  }
  if (Array.isArray(payload.media_urls)) {
    urls.push(...payload.media_urls.filter(Boolean));
  }
  return [...new Set(urls)];
}

async function handleInboundReceived(prisma, payload) {
  const telnyxMessageId = payload.id || payload.message_id || null;
  const text = payload.text ?? payload.body ?? '';
  const mediaUrls = extractInboundMedia(payload);
  if (!text && !telnyxMessageId && !mediaUrls.length) return null;

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
  const messageType = mediaUrls.length ? 'MMS' : 'SMS';

  return saveInboundFromWebhook(prisma, {
    tenantId,
    telnyxMessageId,
    from,
    to,
    body: String(text || ''),
    messageType,
    status,
    mediaUrls,
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
  extractInboundMedia,
  resolveTenantIdByNumber,
};
