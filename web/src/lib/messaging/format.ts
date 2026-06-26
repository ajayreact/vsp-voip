const PENDING_STATUSES = new Set(['QUEUED', 'SENDING', 'SENT', 'queued', 'sending', 'sent']);

export function normalizeDirection(value?: string): 'inbound' | 'outbound' {
  return String(value || '').toUpperCase() === 'OUTBOUND' ? 'outbound' : 'inbound';
}

export function formatMessagingTime(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
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

export function filterConversations<T extends {
  peer?: string;
  line?: string;
  lastMessagePreview?: string | null;
}>(items: T[], query: string) {
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
