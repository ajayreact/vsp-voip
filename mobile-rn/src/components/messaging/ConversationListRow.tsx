import React, { memo, useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import type { ContactEntry } from '../../api/types';
import { VspConversationRow } from '../vsp/VspMessaging';
import { useTheme } from '../../shared/theme';
import {
  conversationDeliveryPreview,
  conversationDisplayName,
  resolveConversationContact,
} from '../../messaging/conversationDisplay';
import { formatPhoneDisplay } from '../../messaging/format';
import type { PlatformConversation } from '../../messaging/types';
import { spacing, typography } from '../../shared/theme';

type ConversationListRowProps = {
  conversation: PlatformConversation;
  contacts: ContactEntry[];
  pinned: boolean;
  archived: boolean;
  onPress: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

function SwipeAction({
  label,
  icon,
  tone,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'primary' | 'warning' | 'danger';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const background =
    tone === 'danger' ? colors.error : tone === 'warning' ? colors.warning : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.action, { backgroundColor: background }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export const ConversationListRow = memo(function ConversationListRow({
  conversation,
  contacts,
  pinned,
  archived,
  onPress,
  onPin,
  onArchive,
  onDelete,
}: ConversationListRowProps) {
  const swipeRef = useRef<Swipeable>(null);
  const contact = resolveConversationContact(conversation, contacts);
  const displayName = conversationDisplayName(conversation, contact);
  const phoneDisplay = formatPhoneDisplay(conversation.peer);
  const deliveryStatus = conversationDeliveryPreview(conversation);

  const closeSwipe = useCallback(() => {
    swipeRef.current?.close();
  }, []);

  const renderRightActions = useCallback(
    () => (
      <View style={styles.actions}>
        <SwipeAction
          label={pinned ? 'Unpin' : 'Pin'}
          icon={pinned ? 'pin-outline' : 'pin'}
          tone="primary"
          onPress={() => {
            closeSwipe();
            onPin();
          }}
        />
        <SwipeAction
          label={archived ? 'Restore' : 'Archive'}
          icon={archived ? 'arrow-undo-outline' : 'archive-outline'}
          tone="warning"
          onPress={() => {
            closeSwipe();
            onArchive();
          }}
        />
        <SwipeAction
          label="Delete"
          icon="trash-outline"
          tone="danger"
          onPress={() => {
            closeSwipe();
            onDelete();
          }}
        />
      </View>
    ),
    [archived, closeSwipe, onArchive, onDelete, onPin, pinned],
  );

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <VspConversationRow
        peerLabel={displayName}
        phoneNumber={contact ? phoneDisplay : undefined}
        lineLabel={conversation.line}
        preview={conversation.lastMessagePreview || 'No messages yet'}
        timestamp={conversation.lastMessageAt || undefined}
        unreadCount={conversation.unreadCount}
        deliveryStatus={deliveryStatus}
        pinned={pinned}
        archived={archived}
        onPress={onPress}
      />
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  action: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  actionLabel: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
  },
});
