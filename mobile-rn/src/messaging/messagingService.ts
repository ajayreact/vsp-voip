import * as FileSystem from 'expo-file-system';
import { endpoints } from '../api/endpoints';
import { authorizedRequest } from '../auth/authService';
import type {
  AttachmentUploadInput,
  MessageAttachment,
  MessagingSetup,
  PlatformConversation,
  PlatformMessage,
} from './types';

export async function fetchConversations(options?: { cursor?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (options?.cursor) q.set('cursor', options.cursor);
  if (options?.limit) q.set('limit', String(options.limit));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return authorizedRequest<{
    success: boolean;
    count: number;
    conversations: PlatformConversation[];
    nextCursor: string | null;
  }>(`${endpoints.messaging.conversations}${suffix}`);
}

export async function fetchConversationMessages(
  conversationId: string,
  options?: { cursor?: string; limit?: number },
) {
  const q = new URLSearchParams();
  if (options?.cursor) q.set('cursor', options.cursor);
  if (options?.limit) q.set('limit', String(options.limit));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return authorizedRequest<{
    success: boolean;
    conversationId: string;
    count: number;
    messages: PlatformMessage[];
    nextCursor: string | null;
  }>(`${endpoints.messaging.conversationMessages(conversationId)}${suffix}`);
}

export async function markConversationRead(conversationId: string) {
  return authorizedRequest<{ success: boolean; conversationId?: string; readAt?: string }>(
    endpoints.messaging.markRead(conversationId),
    { method: 'PATCH' },
  );
}

export async function sendPlatformMessage(body: {
  from: string;
  to: string;
  text: string;
  attachmentIds?: string[];
}) {
  return authorizedRequest<{ success: boolean; message: PlatformMessage }>(
    endpoints.messaging.send,
    { method: 'POST', body },
  );
}

export async function uploadMessageAttachment(input: AttachmentUploadInput): Promise<MessageAttachment> {
  const data = await FileSystem.readAsStringAsync(input.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const res = await authorizedRequest<{ success: boolean; attachment: MessageAttachment }>(
    endpoints.messaging.attachments,
    {
      method: 'POST',
      body: {
        data,
        filename: input.fileName,
        mimeType: input.mimeType || 'application/octet-stream',
      },
    },
  );
  return res.attachment;
}

export async function fetchMessagingSetup(): Promise<MessagingSetup> {
  const config = await authorizedRequest<{
    success?: boolean;
    configured?: boolean;
    webhookReachable?: boolean;
    numbers?: { id: string; number: string }[];
    defaultFrom?: string | null;
    messagingSetup?: { message?: string };
  }>(endpoints.messaging.smsConfig);

  const lines = (config.numbers ?? []).map((n) => ({ id: n.id, number: n.number }));
  return {
    configured: Boolean(config.configured),
    webhookReachable: config.webhookReachable !== false,
    setupHint: config.messagingSetup?.message || '',
    lines,
    defaultLine: config.defaultFrom || lines[0]?.number || '',
  };
}
