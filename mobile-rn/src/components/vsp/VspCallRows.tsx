import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../Avatar';
import { RipplePressable } from '../ui/RipplePressable';
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

function VspCallRowComponent({
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
    <RipplePressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
    </RipplePressable>
  );
}

export const VspCallRow = memo(VspCallRowComponent);

type VspVoicemailRowProps = {
  from: string;
  contactName?: string;
  contactCompany?: string;
  businessDid?: string;
  durationSeconds?: number | null;
  isRead: boolean;
  timestamp: string;
  onPress?: () => void;
};

function VspVoicemailRowComponent({
  from,
  contactName,
  contactCompany,
  businessDid,
  durationSeconds,
  isRead,
  timestamp,
  onPress,
}: VspVoicemailRowProps) {
  const { colors } = useTheme();
  const duration = durationSeconds ? `${Math.round(durationSeconds)}s` : '—';
  const displayName = contactName || formatPhone(from);

  return (
    <RipplePressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
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
          {displayName}
        </Text>
        {contactCompany ? (
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {contactCompany}
          </Text>
        ) : null}
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          Voicemail · {duration}
          {businessDid ? ` · ${businessDid}` : ''}
        </Text>
      </View>
      {!isRead ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
      <Text style={[styles.time, { color: colors.textMuted }]}>{formatRelativeTime(timestamp)}</Text>
    </RipplePressable>
  );
}

export const VspVoicemailRow = memo(VspVoicemailRowComponent);

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
