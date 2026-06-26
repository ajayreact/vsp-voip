import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../Avatar';
import { VspBadge } from './VspBadge';
import { useTheme } from '../../shared/theme';
import { formatPhone, formatRelativeTime } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

type VspCallRowProps = {
  peer: string;
  direction: 'inbound' | 'outbound' | string;
  status: string;
  timestamp: string;
  durationLabel?: string;
  onPress?: () => void;
};

export function VspCallRow({
  peer,
  direction,
  status,
  timestamp,
  durationLabel,
  onPress,
}: VspCallRowProps) {
  const { colors } = useTheme();
  const tone = direction === 'inbound' ? 'primary' : 'muted';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.backgroundAlt : colors.surface, borderColor: colors.border },
      ]}
    >
      <Avatar name={peer} size={40} />
      <View style={styles.content}>
        <Text style={[styles.peer, { color: colors.text }]} numberOfLines={1}>
          {formatPhone(peer)}
        </Text>
        <View style={styles.metaRow}>
          <VspBadge label={direction} tone={tone} />
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {status}
            {durationLabel ? ` · ${durationLabel}` : ''}
          </Text>
        </View>
      </View>
      <Text style={[styles.time, { color: colors.textMuted }]}>{formatRelativeTime(timestamp)}</Text>
    </Pressable>
  );
}

type VspVoicemailRowProps = {
  from: string;
  durationSeconds?: number | null;
  isRead: boolean;
  timestamp: string;
  onPress?: () => void;
};

export function VspVoicemailRow({
  from,
  durationSeconds,
  isRead,
  timestamp,
  onPress,
}: VspVoicemailRowProps) {
  const { colors } = useTheme();
  const duration = durationSeconds ? `${Math.round(durationSeconds)}s` : '—';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.backgroundAlt : colors.surface,
          borderColor: colors.border,
          opacity: isRead ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.vmIcon, { backgroundColor: `${colors.voicemail}22` }]}>
        <Text style={{ color: colors.voicemail }}>▶</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.peer, { color: colors.text, fontWeight: isRead ? '500' : '700' }]} numberOfLines={1}>
          {formatPhone(from)}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          Voicemail · {duration}
        </Text>
      </View>
      {!isRead ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
      <Text style={[styles.time, { color: colors.textMuted }]}>{formatRelativeTime(timestamp)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  peer: {
    ...typography.bodyMedium,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  meta: {
    ...typography.caption,
  },
  time: {
    ...typography.caption,
  },
  vmIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
