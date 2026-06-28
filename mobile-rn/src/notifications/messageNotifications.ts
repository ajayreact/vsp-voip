import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from '../lib/logger';
import { markConversationRead } from '../messaging/messagingService';
import { navigateToConversation } from '../navigation/navigationRef';
import type { PlatformConversation } from '../messaging/types';

const MESSAGE_CHANNEL_ID = 'vsp_messages';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function initializeMessageNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(MESSAGE_CHANNEL_ID, {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f46e5',
    });
  }

  await Notifications.setNotificationCategoryAsync('message', [
    {
      identifier: 'VIEW',
      buttonTitle: 'View',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'MARK_READ',
      buttonTitle: 'Mark read',
      options: { opensAppToForeground: false },
    },
  ]);
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowBadge: true, allowAlert: true, allowSound: true },
  });
  return Boolean(requested.granted);
}

export async function updateBadgeCount(unreadTotal: number) {
  try {
    await Notifications.setBadgeCountAsync(unreadTotal);
  } catch (error) {
    logger.warn('notifications', 'Failed to set badge count', error);
  }
}

export async function notifyNewMessages(conversations: PlatformConversation[]) {
  const unread = conversations.filter((item) => item.unreadCount > 0);
  const unreadTotal = unread.reduce((sum, item) => sum + item.unreadCount, 0);
  await updateBadgeCount(unreadTotal);

  if (!unread.length) return;

  const top = unread[0];
  const preview = top.lastMessagePreview || 'New message';
  const title = top.peer || 'New message';

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: preview,
        data: {
          conversationId: top.id,
          type: 'message',
          peer: top.peer || title,
          peerNumber: top.peer,
          line: top.line,
        },
        categoryIdentifier: 'message',
        badge: unreadTotal,
        sound: 'default',
      },
      trigger: null,
    });
  } catch (error) {
    logger.warn('notifications', 'Failed to schedule message notification', error);
  }
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export async function handleNotificationAction(response: Notifications.NotificationResponse) {
  const action = response.actionIdentifier;
  const data = response.notification.request.content.data as {
    conversationId?: string;
    type?: string;
    peer?: string;
    peerNumber?: string;
    line?: string;
  };

  if (data.type !== 'message' || !data.conversationId) return;

  if (action === 'MARK_READ') {
    await markConversationRead(data.conversationId).catch(() => {});
    return;
  }

  if (
    action === 'VIEW'
    || action === Notifications.DEFAULT_ACTION_IDENTIFIER
  ) {
    navigateToConversation({
      conversationId: data.conversationId,
      peerLabel: data.peer || data.peerNumber || 'Message',
      peerNumber: data.peerNumber || data.peer,
      lineLabel: data.line,
    });
  }
}
