const { normalizePhoneNumber } = require('../phone');
const { isTenantOperational } = require('../tenantGuard');
const { getMessagingProfileId } = require('./telnyxProfile');
const {
  PENDING_MESSAGE_STATUSES,
  MAX_SMS_LENGTH,
} = require('./constants');
const { mapChannelStatus, mapMessageRecord } = require('./mappers');
const {
  sendTelnyxMessage,
  fetchTelnyxMessage,
  extractTelnyxDeliveryStatus,
} = require('./telnyxClient');
const {
  findOrCreateConversation,
  updateConversationPreview,
  resolveConversationParties,
} = require('./ConversationService');
const {
  loadAttachmentsForSend,
  linkAttachmentsToMessage,
  persistInboundAttachments,
  getApiPublicBase,
} = require('./AttachmentService');
const { buildSignedAttachmentUrl } = require('./attachmentAccess');
const { syncLegacySmsFromMessage } = require('./legacySync');
const { notifyInboundMessage } = require('./NotificationService');

async function appendStatusHistory(prisma, messageId, status, source, detail) {
  return prisma.messageStatus.create({
    data: {
      messageId,
      status,
      source,
      detail: detail || null,
    },
  });
}

async function createMessageRecord(prisma, data) {
  const message = await prisma.message.create({
    data,
    include: { attachments: true },
  });
  await appendStatusHistory(prisma, message.id, message.status, 'system');
  return message;
}

async function sendMessage({
  prisma,
  platform,
  tenantId,
  userId,
  from,
  to,
  text,
  attachmentIds,
}) {
  const normalizedFrom = normalizePhoneNumber(from);
  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedFrom || !normalizedTo) {
    throw Object.assign(new Error('Invalid from or to phone number'), { status: 400 });
  }

  const body = String(text || '').trim();
  const attachments = await loadAttachmentsForSend(prisma, tenantId, attachmentIds);
  const messageType = attachments.length ? 'MMS' : 'SMS';

  if (!body && !attachments.length) {
    throw Object.assign(new Error('Message text or attachments are required'), { status: 400 });
  }
  if (body.length > MAX_SMS_LENGTH) {
    throw Object.assign(new Error(`Message is too long (max ${MAX_SMS_LENGTH} characters)`), { status: 400 });
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
    throw Object.assign(new Error('This organization is suspended. Outbound messaging is disabled.'), { status: 403 });
  }

  const conversation = await findOrCreateConversation(prisma, {
    tenantId,
    peer: normalizedTo,
    line: normalizedFrom,
  });

  const messagingProfileId = getMessagingProfileId(platform);
  const payload = {
    from: normalizedFrom,
    to: normalizedTo,
  };
  if (body) payload.text = body;
  if (attachments.length) {
    const base = getApiPublicBase();
    payload.media_urls = attachments.map((item) => buildSignedAttachmentUrl(item.id, base, 60 * 60 * 24)).filter(Boolean);
    payload.type = 'MMS';
  }
  if (messagingProfileId) payload.messaging_profile_id = messagingProfileId;

  let telnyxData;
  try {
    telnyxData = await sendTelnyxMessage(payload);
  } catch (error) {
    throw error;
  }

  const telnyxMessageId = telnyxData?.id || null;
  const remoteStatus = mapChannelStatus(extractTelnyxDeliveryStatus(telnyxData)) || 'SENT';

  if (telnyxMessageId) {
    const existing = await prisma.message.findUnique({
      where: { telnyxMessageId },
      include: { attachments: true, legacySms: true },
    });
    if (existing) {
      await syncLegacySmsFromMessage(prisma, existing);
      return mapMessageRecord(existing);
    }
  }

  let message = await createMessageRecord(prisma, {
    conversationId: conversation.id,
    tenantId,
    telnyxMessageId,
    from: normalizedFrom,
    to: normalizedTo,
    body: body || null,
    direction: 'OUTBOUND',
    messageType,
    status: remoteStatus,
    sentByUserId: userId || null,
    readAt: new Date(),
  });

  if (attachments.length) {
    await linkAttachmentsToMessage(prisma, attachments.map((item) => item.id), message.id);
    message = await prisma.message.findUnique({
      where: { id: message.id },
      include: { attachments: true },
    });
  }

  await updateConversationPreview(prisma, conversation.id, message);
  await syncLegacySmsFromMessage(prisma, message);
  await appendStatusHistory(prisma, message.id, remoteStatus, 'telnyx_send');

  return mapMessageRecord(message);
}

async function syncMessageStatuses(prisma, messages) {
  if (!Array.isArray(messages) || !messages.length) return messages;

  const pending = messages.filter(
    (message) => message.direction === 'OUTBOUND'
      && message.telnyxMessageId
      && PENDING_MESSAGE_STATUSES.has(message.status),
  );
  if (!pending.length) return messages;

  const updates = new Map();
  await Promise.all(pending.map(async (message) => {
    try {
      const remote = await fetchTelnyxMessage(message.telnyxMessageId);
      if (!remote?.status) return;

      const channelStatus = mapChannelStatus(remote.status);
      if (!channelStatus || (channelStatus === message.status && !remote.deliveryError)) {
        if (remote.deliveryError) message.deliveryError = remote.deliveryError;
        return;
      }

      const updated = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: channelStatus,
          deliveryError: remote.deliveryError || message.deliveryError,
          deliveredAt: channelStatus === 'DELIVERED' ? new Date() : message.deliveredAt,
        },
        include: { attachments: true },
      });

      await appendStatusHistory(prisma, message.id, channelStatus, 'telnyx_poll', remote.deliveryError);
      await syncLegacySmsFromMessage(prisma, updated);
      updates.set(message.id, updated);
    } catch (error) {
      console.warn(`Message status sync failed for ${message.telnyxMessageId}:`, error.message);
    }
  }));

  if (!updates.size) return messages;
  return messages.map((message) => updates.get(message.id) || message);
}

async function getMessageStatusDetail(prisma, messageId, tenantId) {
  const message = await prisma.message.findFirst({
    where: { id: messageId, tenantId },
    include: {
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!message) {
    throw Object.assign(new Error('Message not found'), { status: 404 });
  }

  if (message.direction === 'OUTBOUND'
    && message.telnyxMessageId
    && PENDING_MESSAGE_STATUSES.has(message.status)) {
    const [synced] = await syncMessageStatuses(prisma, [message]);
    if (synced && synced.id === message.id) {
      return prisma.message.findFirst({
        where: { id: messageId, tenantId },
        include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
      });
    }
  }

  return message;
}

async function saveInboundFromWebhook(prisma, {
  tenantId,
  telnyxMessageId,
  from,
  to,
  body,
  messageType,
  status,
  mediaItems,
}) {
  const conversation = await findOrCreateConversation(prisma, {
    tenantId,
    peer: from,
    line: to,
  });

  if (telnyxMessageId) {
    const existing = await prisma.message.findUnique({
      where: { telnyxMessageId },
      include: { attachments: true, legacySms: true },
    });
    if (existing) return existing;
  }

  let preparedAttachments = [];
  if (Array.isArray(mediaItems) && mediaItems.length) {
    preparedAttachments = await persistInboundAttachments({
      tenantId,
      telnyxMessageId,
      messageId: telnyxMessageId || `pending-${Date.now()}`,
      mediaItems,
    });
  }

  const channelStatus = mapChannelStatus(status) || 'RECEIVED';
  let message = await createMessageRecord(prisma, {
    conversationId: conversation.id,
    tenantId,
    telnyxMessageId,
    from,
    to,
    body: body || null,
    direction: 'INBOUND',
    messageType: messageType || 'SMS',
    status: channelStatus,
  });

  if (preparedAttachments.length) {
    await prisma.messageAttachment.createMany({
      data: preparedAttachments.map((row) => ({
        ...row,
        messageId: message.id,
      })),
    });
    message = await prisma.message.findUnique({
      where: { id: message.id },
      include: { attachments: true },
    });
  }

  await updateConversationPreview(prisma, conversation.id, message);
  await syncLegacySmsFromMessage(prisma, message);
  await appendStatusHistory(prisma, message.id, channelStatus, 'telnyx_webhook');
  await notifyInboundMessage(prisma, { tenantId, conversationId: conversation.id, message });

  return message;
}

async function updateOutboundFromWebhook(prisma, payload) {
  const telnyxMessageId = payload.id || payload.message_id || null;
  if (!telnyxMessageId) return null;

  const status = mapChannelStatus(extractTelnyxDeliveryStatus(payload)) || 'SENT';
  const errors = [
    ...(Array.isArray(payload.errors) ? payload.errors : []),
    ...(Array.isArray(payload.to?.[0]?.errors) ? payload.to[0].errors : []),
  ].map((item) => item?.detail || item?.title || item?.code).filter(Boolean);

  const existing = await prisma.message.findUnique({
    where: { telnyxMessageId },
    include: { attachments: true, legacySms: true },
  });
  if (!existing) return null;

  const updated = await prisma.message.update({
    where: { id: existing.id },
    data: {
      status,
      deliveryError: errors[0] || existing.deliveryError,
      deliveredAt: status === 'DELIVERED' ? new Date() : existing.deliveredAt,
    },
    include: { attachments: true, legacySms: true },
  });

  await appendStatusHistory(prisma, updated.id, status, 'telnyx_webhook', errors[0]);
  await syncLegacySmsFromMessage(prisma, updated);
  return updated;
}

module.exports = {
  sendMessage,
  syncMessageStatuses,
  getMessageStatusDetail,
  saveInboundFromWebhook,
  updateOutboundFromWebhook,
  appendStatusHistory,
  resolveConversationParties,
};
