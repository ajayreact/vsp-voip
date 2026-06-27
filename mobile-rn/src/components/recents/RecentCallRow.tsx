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
  isEditing?: boolean;
  selected?: boolean;
  onPress: () => void;
  onInfoPress: () => void;
  onCall: () => void;
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

function callTypeLabel(call: CallLogEntry, contact?: ContactEntry) {
  if (call.callType) return call.callType;
  if (contact?.assignedDidNumber) return 'Mobile';
  if (contact) return 'Office';
  return 'SIP';
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

  return (
    <RipplePressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
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
      <Avatar name={displayName} size={44} />
      <View style={styles.content}>
        <Text
          style={[styles.name, { color: isMissed ? colors.error : colors.text }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <View style={styles.metaRow}>
          {contact?.extensionNumber ? (
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              Ext {contact.extensionNumber}
            </Text>
          ) : null}
          {contact?.department ? (
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {contact.department}
            </Text>
          ) : null}
        </View>
        <View style={styles.detailRow}>
          <Ionicons name={iconName} size={14} color={iconColor} />
          <Text style={[styles.meta, { color: colors.textMuted }]}>{callTypeLabel(call, contact)}</Text>
        </View>
      </View>
      {!isEditing ? (
        <View style={styles.trailing}>
          <Text style={[styles.time, { color: colors.textMuted }]}>
            {formatRelativeTime(call.createdAt)}
          </Text>
          <Pressable
            onPress={() => onInfoPress()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Contact info"
            style={styles.infoBtn}
          >
            <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.time, { color: colors.textMuted }]}>
          {formatRelativeTime(call.createdAt)}
        </Text>
      )}
    </RipplePressable>
  );
}

function RecentCallRowComponent({
  call,
  contact,
  isEditing,
  selected,
  onPress,
  onInfoPress,
  onCall,
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
    <Pressable
      onPress={() => {
        swipeRef.current?.close();
        onDelete();
      }}
      style={[styles.swipeAction, styles.swipeDelete]}
      accessibilityRole="button"
      accessibilityLabel="Delete"
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.swipeLabel}>Delete</Text>
    </Pressable>
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
    minHeight: 72,
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
  name: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  meta: {
    ...typography.caption,
    fontSize: 13,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  time: {
    ...typography.caption,
    fontSize: 13,
  },
  infoBtn: {
    padding: 2,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    gap: 4,
  },
  swipeCall: {
    backgroundColor: '#34C759',
  },
  swipeDelete: {
    backgroundColor: '#FF3B30',
  },
  swipeLabel: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
});
