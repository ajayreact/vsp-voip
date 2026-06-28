export type MessageAttachment = {
  id: string;
  messageId?: string;
  mimeType?: string;
  sizeBytes?: number;
  fileName?: string;
  publicUrl?: string;
  createdAt?: string;
};

export type PlatformMessage = {
  id: string;
  conversationId: string;
  tenantId?: string;
  telnyxMessageId?: string | null;
  from: string;
  to: string;
  body: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'inbound' | 'outbound';
  messageType?: 'SMS' | 'MMS' | string;
  status: string;
  deliveryError?: string | null;
  sentByUserId?: string | null;
  readAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  attachments?: MessageAttachment[];
};

export type PlatformConversation = {
  id: string;
  tenantId?: string;
  peer: string;
  line: string;
  type?: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount: number;
  lastMessage?: PlatformMessage | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MessagingLine = {
  id: string;
  number: string;
};
