import React, { memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import type { CallLogEntry, ContactEntry } from '../../api/types';
import { Avatar } from '../Avatar';
import { RipplePressable } from '../ui/RipplePressable';
import { useTheme } from '../../shared/theme';
import { formatPhone, formatRelativeTime } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

type RecentCallRowProps = {
  call: CallLogEntry;
  contact?: ContactEntry;
  isFavorite?: boolean;
  isEditing?: boolean;
  selected?: boolean;
  onPress: () => void;
  onInfoPress: () => void;
  onCall: () => void;
  onMessage: () => void;
  onFavorite: () => void;
  onDelete: () => void;
};

function directionIcon(call: CallLogEntry): keyof typeof Ionicons.glyphMap {
  const status = (call.status || '').toLowerCase();
  const direction = (call.direction || '').toLowerCase();
  if (status.includes('miss')) return 'arrow-down-outline';
  if (direction === 'inbound') return 'arrow-down-outline';
  return 'arrow-up-outline';
}

function directionColor(call: CallLogEntry, colors: ReturnType<typeof useTheme>['colors']) {
  const status = (call.status || '').toLowerCase();
  if (status.includes('miss')) return colors.error;
  return colors.textMuted;
}

function statusLabel(call: CallLogEntry) {
  const status = (call.status || '').toLowerCase();
  if (status.includes('miss')) return 'Missed';
  if (status.includes('no-answer') || status.includes('no_answer')) return 'No answer';
  if (call.direction === 'outbound') return 'Outgoing';
  return 'Incoming';
}

function RowContent({
  call,
  contact,
  isEditing,
  selected,
  onPress,
  onInfoPress,
}: Pick<RecentCallRowProps, 'call' | 'contact' | 'isEditing' | 'selected' | 'onPress' | 'onInfoPress'>) {
  const { colors } = useTheme();
  const peer = call.direction === 'inbound' ? call.from : call.to;
  const displayName = contact?.name || formatPhone(peer);
  const isMissed = (call.status || '').toLowerCase().includes('miss');
  const iconName = directionIcon(call);
  const iconColor = directionColor(call, colors);
  const meta = [
    contact?.extensionNumber ? `Ext ${contact.extensionNumber}` : null,
    contact?.department,
  ].filter(Boolean).join(' · ');

  return (
    <RipplePressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${statusLabel(call)}, ${formatRelativeTime(call.createdAt)}`}
    >
      {isEditing ? (
        <View
          style={[
            styles.selectCircle,
            {
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primary : 'transparent',
            },
          ]}
        >
          {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
      ) : null}
      <Avatar name={displayName} size={46} />
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.name, { color: isMissed ? colors.error : colors.text }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>
            {formatRelativeTime(call.createdAt)}
          </Text>
        </View>
        {meta ? (
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        <View style={styles.detailRow}>
          <Ionicons name={iconName} size={13} color={iconColor} />
          <Text style={[styles.status, { color: colors.textMuted }]}>{statusLabel(call)}</Text>
        </View>
      </View>
      {!isEditing ? (
        <Pressable
          onPress={() => onInfoPress()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Contact info"
          style={styles.infoBtn}
        >
          <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
        </Pressable>
      ) : null}
    </RipplePressable>
  );
}

function RecentCallRowComponent({
  call,
  contact,
  isFavorite,
  isEditing,
  selected,
  onPress,
  onInfoPress,
  onCall,
  onMessage,
  onFavorite,
  onDelete,
}: RecentCallRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  if (isEditing) {
    return (
      <RowContent
        call={call}
        contact={contact}
        isEditing
        selected={selected}
        onPress={onPress}
        onInfoPress={onInfoPress}
      />
    );
  }

  const renderLeftActions = () => (
    <Pressable
      onPress={() => {
        swipeRef.current?.close();
        onCall();
      }}
      style={[styles.swipeAction, styles.swipeCall]}
      accessibilityRole="button"
      accessibilityLabel="Call"
    >
      <Ionicons name="call" size={22} color="#fff" />
      <Text style={styles.swipeLabel}>Call</Text>
    </Pressable>
  );

  const renderRightActions = () => (
    <View style={styles.swipeRightRow}>
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onMessage();
        }}
        style={[styles.swipeAction, styles.swipeMessage]}
        accessibilityRole="button"
        accessibilityLabel="Message"
      >
        <Ionicons name="chatbubble-outline" size={20} color="#fff" />
        <Text style={styles.swipeLabel}>Text</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onFavorite();
        }}
        style={[styles.swipeAction, styles.swipeFavorite]}
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? 'Unfavorite' : 'Favorite'}
      >
        <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={20} color="#fff" />
        <Text style={styles.swipeLabel}>{isFavorite ? 'Unstar' : 'Star'}</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onDelete();
        }}
        style={[styles.swipeAction, styles.swipeDelete]}
        accessibilityRole="button"
        accessibilityLabel="Delete"
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
        <Text style={styles.swipeLabel}>Delete</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
    >
      <RowContent
        call={call}
        contact={contact}
        onPress={onPress}
        onInfoPress={onInfoPress}
      />
    </Swipeable>
  );
}

export const RecentCallRow = memo(RecentCallRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
  },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.bodyMedium,
    fontWeight: '600',
    flex: 1,
  },
  meta: {
    ...typography.caption,
    fontSize: 13,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  status: {
    ...typography.caption,
    fontSize: 12,
  },
  time: {
    ...typography.caption,
    fontSize: 12,
  },
  infoBtn: {
    padding: 2,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeRightRow: {
    flexDirection: 'row',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    gap: 4,
  },
  swipeCall: {
    backgroundColor: '#34C759',
  },
  swipeMessage: {
    backgroundColor: '#007AFF',
  },
  swipeFavorite: {
    backgroundColor: '#FF9500',
  },
  swipeDelete: {
    backgroundColor: '#FF3B30',
  },
  swipeLabel: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '600',
    fontSize: 11,
  },
});
