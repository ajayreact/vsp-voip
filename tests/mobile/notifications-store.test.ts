import { describe, expect, it, beforeEach } from 'vitest';
import {
  groupNotificationsByDay,
  notificationDedupeKey,
} from '../../mobile-rn/src/notifications/notificationGrouping';
import type { AppNotification } from '../../mobile-rn/src/notifications/notificationGrouping';

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'sms:conv-1',
    kind: 'sms',
    title: 'Peer',
    body: 'Hello',
    createdAt: '2026-06-24T10:00:00.000Z',
    isRead: false,
    ...overrides,
  };
}

describe('notification grouping', () => {
  it('dedupes by kind and reference id', () => {
    expect(notificationDedupeKey('voicemail', 'abc')).toBe('voicemail:abc');
  });

  it('groups notifications into Today and Yesterday', () => {
    const now = new Date('2026-06-24T15:00:00.000Z');
    const items = groupNotificationsByDay(
      [
        makeNotification({ id: 'a', createdAt: '2026-06-24T14:00:00.000Z' }),
        makeNotification({ id: 'b', createdAt: '2026-06-23T14:00:00.000Z' }),
        makeNotification({ id: 'c', createdAt: '2026-06-20T14:00:00.000Z' }),
      ],
      now,
    );

    const labels = items.filter((item) => item.type === 'separator').map((item) => item.label);
    expect(labels).toEqual(['Today', 'Yesterday', 'Earlier']);
  });
});

describe('notifications store helpers', () => {
  beforeEach(() => {
    // pure grouping tests only
  });

  it('preserves chronological order within groups', () => {
    const now = new Date('2026-06-24T15:00:00.000Z');
    const grouped = groupNotificationsByDay(
      [
        makeNotification({ id: 'older', createdAt: '2026-06-24T08:00:00.000Z' }),
        makeNotification({ id: 'newer', createdAt: '2026-06-24T12:00:00.000Z' }),
      ],
      now,
    );
    const notifications = grouped
      .filter((item) => item.type === 'notification')
      .map((item) => item.notification.id);
    expect(notifications).toEqual(['newer', 'older']);
  });
});
