export type MessageAttachment = {
  id: string;
  messageId?: string;
  mimeType?: string;
  sizeBytes?: number;
  fileName?: string;
  publicUrl?: string;
  url?: string;
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
  /** Client-only optimistic placeholder */
  _optimistic?: boolean;
  /** Client-only outbox reference */
  _outboxId?: string;
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

export type MessagingSetup = {
  configured: boolean;
  webhookReachable: boolean;
  setupHint: string;
  lines: MessagingLine[];
  defaultLine: string;
};

export type AttachmentUploadInput = {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};
