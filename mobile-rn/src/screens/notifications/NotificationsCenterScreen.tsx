import React, { memo, useCallback, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState } from '../../components';
import { MessageDateSeparator } from '../../components/messaging/MessagingStates';
import { RipplePressable } from '../../components/ui/RipplePressable';
import {
  groupNotificationsByDay,
  type AppNotification,
  type NotificationListItem,
} from '../../notifications/notificationGrouping';
import { useNotificationsStore } from '../../notifications/notificationsStore';
import {
  navigateToConversation,
  navigateToRecentCalls,
} from '../../navigation/navigationRef';
import type { HomeStackParamList } from '../../navigation/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/types';
import { useTheme } from '../../shared/theme';
import { formatRelativeTime } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'NotificationsCenter'>;

const KIND_ICONS: Record<AppNotification['kind'], keyof typeof Ionicons.glyphMap> = {
  missed_call: 'call-outline',
  voicemail: 'recording-outline',
  sms: 'chatbubble-ellipses-outline',
  registration: 'warning-outline',
  system: 'information-circle-outline',
};

const NotificationRow = memo(function NotificationRow({
  notification,
  onPress,
  onClear,
}: {
  notification: AppNotification;
  onPress: () => void;
  onClear: () => void;
}) {
  const { colors } = useTheme();
  return (
    <RipplePressable
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          opacity: notification.isRead ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={KIND_ICONS[notification.kind]} size={20} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text, fontWeight: notification.isRead ? '500' : '700' }]}>
          {notification.title}
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={[styles.time, { color: colors.textMuted }]}>
          {formatRelativeTime(notification.createdAt)}
        </Text>
      </View>
      {!notification.isRead ? (
        <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
      ) : null}
      <Pressable
        onPress={onClear}
        hitSlop={8}
        accessibilityLabel="Clear notification"
        style={styles.clearBtn}
      >
        <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
      </Pressable>
    </RipplePressable>
  );
});

export function NotificationsCenterScreen() {
  const navigation = useNavigation<Nav>();
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const { colors } = useTheme();
  const items = useNotificationsStore((s) => s.items);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const clear = useNotificationsStore((s) => s.clear);
  const clearAll = useNotificationsStore((s) => s.clearAll);

  const listItems = useMemo(() => groupNotificationsByDay(items), [items]);

  const openDeepLink = useCallback(
    (notification: AppNotification) => {
      markRead(notification.id);
      const link = notification.deepLink;
      if (!link) return;

      if (link.screen === 'voicemail') {
        tabNavigation?.navigate('You', {
          screen: 'VoicemailDetail',
          params: { voicemailId: link.voicemailId },
        });
        return;
      }
      if (link.screen === 'conversation') {
        navigateToConversation({
          conversationId: link.conversationId,
          peerLabel: link.peerLabel || 'Message',
          peerNumber: link.peerNumber,
          lineLabel: link.lineLabel,
        });
        return;
      }
      if (link.screen === 'recent') {
        navigateToRecentCalls(link.filter);
        return;
      }
      if (link.screen === 'settings') {
        tabNavigation?.navigate('You', { screen: 'Notifications' });
      }
    },
    [markRead, tabNavigation],
  );

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear notifications', 'Remove all notifications from this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: clearAll },
    ]);
  }, [clearAll]);

  const renderItem = useCallback(
    ({ item }: { item: NotificationListItem }) => {
      if (item.type === 'separator') {
        return <MessageDateSeparator label={item.label} />;
      }
      return (
        <NotificationRow
          notification={item.notification}
          onPress={() => openDeepLink(item.notification)}
          onClear={() => clear(item.notification.id)}
        />
      );
    },
    [clear, openDeepLink],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        <Pressable onPress={markAllRead} style={styles.toolbarBtn}>
          <Text style={[styles.toolbarText, { color: colors.primary }]}>Mark all read</Text>
        </Pressable>
        <Pressable onPress={handleClearAll} style={styles.toolbarBtn}>
          <Text style={[styles.toolbarText, { color: colors.error }]}>Clear all</Text>
        </Pressable>
      </View>
      <FlashList
        data={listItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        estimatedItemSize={76}
        drawDistance={320}
        ListEmptyComponent={
          <EmptyState icon="🔔" title="No notifications" message="Alerts will appear here as they arrive." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  toolbarBtn: { minHeight: 44, justifyContent: 'center' },
  toolbarText: { ...typography.bodyMedium, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, gap: 2 },
  title: { ...typography.bodyMedium },
  body: { ...typography.caption },
  time: { ...typography.caption, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  clearBtn: { padding: 4 },
});
