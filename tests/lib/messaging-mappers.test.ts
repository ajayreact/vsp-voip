import { describe, it, expect } from 'vitest';

const { mapChannelStatus, mapLegacySmsMessage, mapConversationRecord } = require('../../lib/messaging/mappers');
const { extractInboundMedia } = require('../../lib/messaging/WebhookService');
const { legacyStatus } = require('../../lib/messaging/legacySync');

describe('messaging mappers', () => {
  it('maps Telnyx delivery statuses to channel enums', () => {
    expect(mapChannelStatus('delivered')).toBe('DELIVERED');
    expect(mapChannelStatus('delivery_failed')).toBe('FAILED');
    expect(mapChannelStatus('queued')).toBe('QUEUED');
  });

  it('maps platform message to legacy SMS shape', () => {
    const mapped = mapLegacySmsMessage({
      id: 'msg-1',
      tenantId: 'tenant-1',
      telnyxMessageId: 'tx-1',
      from: '+15551234567',
      to: '+13099880196',
      body: 'Hello',
      direction: 'OUTBOUND',
      status: 'SENT',
      deliveryError: null,
      readAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      legacySms: { id: 'legacy-1' },
    });

    expect(mapped.id).toBe('legacy-1');
    expect(mapped.direction).toBe('outbound');
    expect(mapped.status).toBe('sent');
    expect(mapped.isRead).toBe(true);
  });

  it('maps conversation with unread count', () => {
    const mapped = mapConversationRecord({
      id: 'conv-1',
      tenantId: 'tenant-1',
      peer: '+15551234567',
      line: '+13099880196',
      type: 'CUSTOMER',
      lastMessageAt: null,
      lastMessagePreview: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { unreadCount: 3 });

    expect(mapped.unreadCount).toBe(3);
    expect(mapped.peer).toBe('+15551234567');
  });

  it('converts channel status to legacy lowercase', () => {
    expect(legacyStatus('DELIVERED')).toBe('delivered');
  });
});

describe('messaging webhook parsing', () => {
  it('extracts inbound MMS media URLs', () => {
    const urls = extractInboundMedia({
      media: [{ url: 'https://cdn.example.com/a.jpg' }],
      media_urls: ['https://cdn.example.com/b.jpg'],
    });
    expect(urls).toEqual([
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);
  });
});
