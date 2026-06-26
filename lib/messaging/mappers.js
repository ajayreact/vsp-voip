const { TELNYX_STATUS_TO_CHANNEL } = require('./constants');

function mapChannelStatus(value) {
  if (!value) return null;
  const key = String(value).toLowerCase();
  return TELNYX_STATUS_TO_CHANNEL[key] || String(value).toUpperCase();
}

function mapMessageRecord(message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    tenantId: message.tenantId,
    telnyxMessageId: message.telnyxMessageId,
    from: message.from,
    to: message.to,
    body: message.body,
    direction: message.direction,
    messageType: message.messageType,
    status: message.status,
    deliveryError: message.deliveryError,
    sentByUserId: message.sentByUserId,
    readAt: message.readAt,
    deliveredAt: message.deliveredAt,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    attachments: (message.attachments || []).map(mapAttachmentRecord),
  };
}

function mapAttachmentRecord(attachment) {
  return {
    id: attachment.id,
    messageId: attachment.messageId,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    fileName: attachment.fileName,
    publicUrl: attachment.publicUrl,
    createdAt: attachment.createdAt,
  };
}

function mapConversationRecord(conversation, extras = {}) {
  return {
    id: conversation.id,
    tenantId: conversation.tenantId,
    peer: conversation.peer,
    line: conversation.line,
    type: conversation.type,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    unreadCount: extras.unreadCount ?? 0,
    lastMessage: extras.lastMessage ? mapMessageRecord(extras.lastMessage) : null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

/** Legacy /api/sms shape */
function mapLegacySmsMessage(message) {
  return {
    id: message.legacySms?.id || message.id,
    tenantId: message.tenantId,
    telnyxMessageId: message.telnyxMessageId,
    from: message.from,
    to: message.to,
    body: message.body || '',
    direction: message.direction === 'OUTBOUND' ? 'outbound' : 'inbound',
    status: String(message.status || '').toLowerCase(),
    deliveryError: message.deliveryError || null,
    isRead: Boolean(message.readAt || message.direction === 'OUTBOUND'),
    createdAt: message.createdAt,
  };
}

module.exports = {
  mapChannelStatus,
  mapMessageRecord,
  mapAttachmentRecord,
  mapConversationRecord,
  mapLegacySmsMessage,
};
