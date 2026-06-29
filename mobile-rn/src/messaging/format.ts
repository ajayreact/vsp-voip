import type { PlatformConversation, PlatformMessage } from './types';

const PENDING_STATUSES = new Set(['QUEUED', 'SENDING', 'SENT', 'queued', 'sending', 'sent']);

export const MAX_SMS_LENGTH = 1600;
export const MAX_MMS_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function normalizeDirection(value?: string): 'inbound' | 'outbound' {
  return String(value || '').toUpperCase() === 'OUTBOUND' ? 'outbound' : 'inbound';
}

export function formatMessagingTime(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatPhoneDisplay(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value || 'Unknown';
}

export function formatMessageStatus(status?: string) {
  const key = String(status || '').toLowerCase();
  const labels: Record<string, string> = {
    queued: 'Queued',
    sending: 'Sending…',
    sent: 'Sent',
    delivered: 'Delivered',
    delivery_failed: 'Delivery failed',
    sending_failed: 'Send failed',
    delivery_unconfirmed: 'Sent (unconfirmed)',
    received: 'Received',
    failed: 'Failed',
  };
  return labels[key] || status || '';
}

export function isFailedMessageStatus(status?: string) {
  const key = String(status || '').toLowerCase();
  return key === 'delivery_failed' || key === 'sending_failed' || key === 'failed';
}

export function isPendingMessageStatus(status?: string) {
  return PENDING_STATUSES.has(String(status || ''));
}

export function isSendingMessageStatus(status?: string) {
  const key = String(status || '').toLowerCase();
  return key === 'queued' || key === 'sending';
}

export function resolveOutboundStatusLabel(params: {
  status?: string;
  optimistic?: boolean;
  deliveredAt?: string | null;
  readAt?: string | null;
}) {
  if (params.optimistic || isSendingMessageStatus(params.status)) return 'Sending…';
  if (isFailedMessageStatus(params.status)) return 'Failed';
  if (params.readAt) return 'Read';
  if (params.deliveredAt) return 'Delivered';
  const key = String(params.status || '').toLowerCase();
  if (key === 'sent' || key === 'delivery_unconfirmed') return 'Sent';
  return formatMessageStatus(params.status);
}

export function peerInitials(label: string) {
  const digits = label.replace(/\D/g, '');
  if (digits.length >= 2 && !/[a-z]/i.test(label)) {
    return digits.slice(-2);
  }
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  }
  return label.slice(0, 2).toUpperCase() || '??';
}

export function filterConversations(
  items: PlatformConversation[],
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const peer = item.peer || '';
    const line = item.line || '';
    const preview = item.lastMessagePreview || '';
    return (
      peer.toLowerCase().includes(q)
      || line.toLowerCase().includes(q)
      || preview.toLowerCase().includes(q)
      || formatPhoneDisplay(peer).toLowerCase().includes(q)
    );
  });
}

export function sortConversationsByActivity(items: PlatformConversation[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
    const bTime = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
    return bTime - aTime;
  });
}

export function mergeMessagesById(messages: PlatformMessage[]): PlatformMessage[] {
  const byId = new Map(messages.map((item) => [item.id, item]));
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function mergeConversationLists(
  previous: PlatformConversation[],
  incoming: PlatformConversation[],
  append: boolean,
) {
  const merged = append ? [...previous, ...incoming] : incoming;
  const byId = new Map(merged.map((item) => [item.id, item]));
  return sortConversationsByActivity(Array.from(byId.values()));
}

export function formatDateSeparator(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export type MessageListItem =
  | { type: 'separator'; key: string; label: string }
  | { type: 'message'; key: string; message: PlatformMessage };

export function groupMessagesWithSeparators(messages: PlatformMessage[]): MessageListItem[] {
  const items: MessageListItem[] = [];
  let lastDay = '';
  for (const message of messages) {
    const day = new Date(message.createdAt).toDateString();
    if (day !== lastDay) {
      items.push({
        type: 'separator',
        key: `sep-${day}`,
        label: formatDateSeparator(message.createdAt),
      });
      lastDay = day;
    }
    items.push({ type: 'message', key: message.id, message });
  }
  return items;
}

export function isValidMessagingPeer(value: string) {
  return value.replace(/\D/g, '').length >= 10;
}

export function formatAttachmentSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function attachmentUri(attachment: { publicUrl?: string; url?: string }) {
  return attachment.publicUrl || attachment.url || '';
}

export function normalizePeerNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (value.trim().startsWith('+')) return `+${digits}`;
  return value.trim();
}
