import { apiFetch, getSmsConfig } from '@/lib/api';
import type { MessageAttachment, PlatformConversation, PlatformMessage } from '@/lib/messaging/types';

export async function fetchConversations(options?: { cursor?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (options?.cursor) q.set('cursor', options.cursor);
  if (options?.limit) q.set('limit', String(options.limit));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<{
    success: boolean;
    count: number;
    conversations: PlatformConversation[];
    nextCursor: string | null;
  }>(`/api/conversations${suffix}`);
}

export async function fetchConversationMessages(
  conversationId: string,
  options?: { cursor?: string; limit?: number },
) {
  const q = new URLSearchParams();
  if (options?.cursor) q.set('cursor', options.cursor);
  if (options?.limit) q.set('limit', String(options.limit));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<{
    success: boolean;
    conversationId: string;
    count: number;
    messages: PlatformMessage[];
    nextCursor: string | null;
  }>(`/api/conversations/${conversationId}/messages${suffix}`);
}

export async function markConversationRead(conversationId: string) {
  return apiFetch<{ success: boolean; conversationId?: string; readAt?: string }>(
    `/api/conversations/${conversationId}/read`,
    { method: 'PATCH' },
  );
}

export async function sendPlatformMessage(body: {
  from: string;
  to: string;
  text: string;
  attachmentIds?: string[];
}) {
  return apiFetch<{ success: boolean; message: PlatformMessage }>('/api/messages/send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function uploadMessageAttachment(file: File): Promise<MessageAttachment> {
  const data = await readFileAsBase64(file);
  const res = await apiFetch<{ success: boolean; attachment: MessageAttachment }>(
    '/api/messages/attachments',
    {
      method: 'POST',
      body: JSON.stringify({
        data,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
      }),
    },
  );
  return res.attachment;
}

export async function refreshMessageAttachmentUrl(attachmentId: string): Promise<string> {
  const res = await apiFetch<{ success: boolean; publicUrl: string }>(
    `/api/messages/attachments/${attachmentId}/url`,
  );
  return res.publicUrl;
}

export async function fetchMessagingLines() {
  const config = await getSmsConfig();
  return {
    configured: config.configured,
    webhookReachable: config.webhookReachable,
    setupHint: config.messagingSetup?.message || '',
    numbersOnProfile: config.messagingSetup?.numbersOnProfile || [],
    webhookUrl: config.smsWebhookUrl,
    lines: config.numbers.map((n) => ({ id: n.id, number: n.number })),
    defaultLine: config.defaultFrom || config.numbers[0]?.number || '',
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
