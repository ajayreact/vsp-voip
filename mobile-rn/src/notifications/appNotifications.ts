import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { CallLogEntry, VoicemailRecord } from '../api/types';
import type { PlatformConversation } from '../messaging/types';
import { logger } from '../lib/logger';
import { markConversationRead } from '../messaging/messagingService';
import { navigateToConversation, navigateToRecentCalls, navigateToVoicemail } from '../navigation/navigationRef';
import { buildNotification, useNotificationsStore } from './notificationsStore';
import { formatPhone } from '../utils/format';

const MESSAGE_CHANNEL_ID = 'vsp_messages';
const VOICEMAIL_CHANNEL_ID = 'vsp_voicemail';
const CALLS_CHANNEL_ID = 'vsp_calls';
const SYSTEM_CHANNEL_ID = 'vsp_system';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function initializeAppNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(MESSAGE_CHANNEL_ID, {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f46e5',
    });
    await Notifications.setNotificationChannelAsync(VOICEMAIL_CHANNEL_ID, {
      name: 'Voicemail',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    });
    await Notifications.setNotificationChannelAsync(CALLS_CHANNEL_ID, {
      name: 'Calls',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f46e5',
    });
    await Notifications.setNotificationChannelAsync(SYSTEM_CHANNEL_ID, {
      name: 'System',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#4f46e5',
    });
  }

  await Notifications.setNotificationCategoryAsync('message', [
    { identifier: 'VIEW', buttonTitle: 'View', options: { opensAppToForeground: true } },
    { identifier: 'MARK_READ', buttonTitle: 'Mark read', options: { opensAppToForeground: false } },
  ]);
  await Notifications.setNotificationCategoryAsync('voicemail', [
    { identifier: 'VIEW', buttonTitle: 'Listen', options: { opensAppToForeground: true } },
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

  useNotificationsStore.getState().upsert(
    buildNotification({
      kind: 'sms',
      referenceId: top.id,
      title,
      body: preview,
      createdAt: top.lastMessageAt ?? undefined,
      deepLink: {
        screen: 'conversation',
        conversationId: top.id,
        peerLabel: top.peer || title,
        peerNumber: top.peer,
        lineLabel: top.line,
      },
    }),
  );

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

export async function notifyNewVoicemail(voicemail: VoicemailRecord) {
  const title = formatPhone(voicemail.from);
  const body = `New voicemail · ${voicemail.durationSeconds ?? 0}s`;

  useNotificationsStore.getState().upsert(
    buildNotification({
      kind: 'voicemail',
      referenceId: voicemail.id,
      title,
      body,
      createdAt: voicemail.createdAt,
      deepLink: { screen: 'voicemail', voicemailId: voicemail.id },
    }),
  );

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'voicemail', voicemailId: voicemail.id },
        categoryIdentifier: 'voicemail',
        sound: 'default',
      },
      trigger: null,
    });
  } catch (error) {
    logger.warn('notifications', 'Failed to schedule voicemail notification', error);
  }
}

export async function notifyMissedCall(call: CallLogEntry) {
  const peer = call.from || call.to;
  const title = formatPhone(peer);
  const body = 'Missed call';

  useNotificationsStore.getState().upsert(
    buildNotification({
      kind: 'missed_call',
      referenceId: call.id,
      title,
      body,
      createdAt: call.createdAt,
      deepLink: { screen: 'recent', filter: 'missed' },
    }),
  );

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'missed_call', callId: call.id },
        sound: 'default',
      },
      trigger: null,
    });
  } catch (error) {
    logger.warn('notifications', 'Failed to schedule missed call notification', error);
  }
}

export function notifyRegistrationWarning(message: string) {
  useNotificationsStore.getState().upsert(
    buildNotification({
      kind: 'registration',
      referenceId: 'registration',
      title: 'Phone registration',
      body: message,
      deepLink: { screen: 'settings', section: 'sip' },
    }),
  );
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
    voicemailId?: string;
    type?: string;
    peer?: string;
    peerNumber?: string;
    line?: string;
    callId?: string;
  };

  if (data.type === 'message' && data.conversationId) {
    if (action === 'MARK_READ') {
      await markConversationRead(data.conversationId).catch(() => {});
      return;
    }
    if (action === 'VIEW' || action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      navigateToConversation({
        conversationId: data.conversationId,
        peerLabel: data.peer || data.peerNumber || 'Message',
        peerNumber: data.peerNumber || data.peer,
        lineLabel: data.line,
      });
    }
    return;
  }

  if (data.type === 'voicemail' && data.voicemailId) {
    if (action === 'VIEW' || action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      navigateToVoicemail(data.voicemailId);
    }
    return;
  }

  if (data.type === 'missed_call') {
    navigateToRecentCalls('missed');
  }
}

/** @deprecated Use initializeAppNotifications */
export const initializeMessageNotifications = initializeAppNotifications;
