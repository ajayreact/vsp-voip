export type NotificationKind =
  | 'missed_call'
  | 'voicemail'
  | 'sms'
  | 'registration'
  | 'system';

export type NotificationDeepLink =
  | { screen: 'voicemail'; voicemailId: string }
  | { screen: 'conversation'; conversationId: string; peerLabel?: string; peerNumber?: string; lineLabel?: string }
  | { screen: 'recent'; filter?: string }
  | { screen: 'settings'; section?: 'notifications' | 'sip' };

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  deepLink?: NotificationDeepLink;
};

export type NotificationListItem =
  | { type: 'separator'; key: string; label: string }
  | { type: 'notification'; key: string; notification: AppNotification };

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function groupNotificationsByDay(
  notifications: AppNotification[],
  now = new Date(),
): NotificationListItem[] {
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 86_400_000;

  const items: NotificationListItem[] = [];
  let lastLabel: string | null = null;

  for (const notification of sorted) {
    const ts = new Date(notification.createdAt).getTime();
    let label = 'Earlier';
    if (ts >= todayStart) label = 'Today';
    else if (ts >= yesterdayStart) label = 'Yesterday';

    if (label !== lastLabel) {
      items.push({ type: 'separator', key: `sep-${label}`, label });
      lastLabel = label;
    }
    items.push({ type: 'notification', key: notification.id, notification });
  }

  return items;
}

export function notificationDedupeKey(
  kind: NotificationKind,
  referenceId: string,
): string {
  return `${kind}:${referenceId}`;
}
