import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../shared/theme';
import { spacing, tokens, typography } from '../../shared/theme';

type BadgeTone = 'success' | 'warning' | 'error' | 'muted' | 'primary' | 'voicemail';

type VspBadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function VspBadge({ label, tone = 'muted' }: VspBadgeProps) {
  const { colors } = useTheme();
  const toneStyle = {
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    error: { bg: colors.errorSoft, fg: colors.error },
    muted: { bg: colors.backgroundAlt, fg: colors.textMuted },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    voicemail: { bg: `${colors.voicemail}22`, fg: colors.voicemail },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.bg }]}>
      <Text style={[styles.label, { color: toneStyle.fg }]}>{label}</Text>
    </View>
  );
}

type VspChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function VspChip({ label, selected, onPress }: VspChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: selected ? colors.accentText : colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

type VspSegmentProps = {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
};

/** Enterprise segmented control — not iOS Phone app tabs */
export function VspSegmentedControl({ options, value, onChange, style }: VspSegmentProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmentWrap, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }, style]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.segment,
              active && { backgroundColor: colors.surface, ...tokens.shadow.card },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: active ? colors.primary : colors.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
  chip: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.sm,
    minHeight: tokens.touchTarget - 8,
  },
  segmentLabel: {
    ...typography.bodyMedium,
    fontSize: 14,
  },
});
