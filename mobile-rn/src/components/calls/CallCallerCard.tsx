import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { VspBadge } from '../vsp/VspBadge';
import type { CallUiIdentity } from '../../store/callingStore';
import { useTheme } from '../../shared/theme';
import { formatPhone } from '../../utils/format';
import { spacing, tokens, typography } from '../../shared/theme';

type Props = {
  identity: CallUiIdentity;
  statusLabel: string;
  qualityLabel?: string | null;
  durationLabel?: string;
  compact?: boolean;
};

export const CallCallerCard = memo(function CallCallerCard({
  identity,
  statusLabel,
  qualityLabel,
  durationLabel,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const avatarSize = compact ? 72 : 104;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Avatar name={identity.name} size={avatarSize} />
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
        {identity.name}
      </Text>
      {identity.company ? (
        <Text style={[styles.company, { color: colors.textMuted }]} numberOfLines={1}>
          {identity.company}
        </Text>
      ) : null}
      <Text style={[styles.number, { color: colors.textSecondary }]} numberOfLines={1}>
        {identity.number}
      </Text>
      {identity.businessLine ? (
        <Text style={[styles.line, { color: colors.primary }]} numberOfLines={1}>
          via {formatPhone(identity.businessLine)}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <VspBadge label={statusLabel} tone="primary" />
        {qualityLabel ? <VspBadge label={qualityLabel} tone="muted" /> : null}
      </View>

      {durationLabel ? (
        <Text style={[styles.duration, { color: colors.text }]} accessibilityLabel="Call duration">
          {durationLabel}
        </Text>
      ) : null}
    </View>
  );
});

type AudioRouteChipProps = {
  label: string;
  route: 'phone' | 'speaker' | 'bluetooth' | 'wired';
  onPress?: () => void;
};

const ROUTE_ICONS: Record<AudioRouteChipProps['route'], keyof typeof Ionicons.glyphMap> = {
  phone: 'phone-portrait-outline',
  speaker: 'volume-high-outline',
  bluetooth: 'bluetooth-outline',
  wired: 'headset-outline',
};

export const AudioRouteChip = memo(function AudioRouteChip({ label, route, onPress }: AudioRouteChipProps) {
  const { colors } = useTheme();
  const content = (
    <>
      <Ionicons name={ROUTE_ICONS[route]} size={16} color={colors.primary} />
      <Text style={[styles.routeLabel, { color: colors.primary }]}>{label}</Text>
      {onPress ? <Ionicons name="chevron-down" size={14} color={colors.primary} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.routeChip, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={`Audio route ${label}`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.routeChip, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
      {content}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    ...tokens.shadow.card,
  },
  name: {
    ...typography.title,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  company: {
    ...typography.bodyMedium,
    textAlign: 'center',
  },
  number: {
    ...typography.body,
    textAlign: 'center',
  },
  line: {
    ...typography.caption,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  duration: {
    ...typography.display,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xs,
  },
  routeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
  },
  routeLabel: {
    ...typography.caption,
    fontWeight: '700',
  },
});
