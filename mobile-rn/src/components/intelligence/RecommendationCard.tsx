import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RipplePressable } from '../ui/RipplePressable';
import { VspBadge } from '../vsp';
import { VSP_AI_BRANDING } from '../../ai/vspAiBranding';
import type { IntelligenceRecommendation } from '../../intelligence/types';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type RecommendationCardProps = {
  item: IntelligenceRecommendation;
  onPress?: (item: IntelligenceRecommendation) => void;
};

function iconForKind(kind: IntelligenceRecommendation['kind']) {
  switch (kind) {
    case 'callback_waiting':
      return 'call-outline';
    case 'unanswered_message':
      return 'chatbubble-ellipses-outline';
    case 'urgent_voicemail':
      return 'recording-outline';
    case 'follow_up_reminder':
      return 'alarm-outline';
    case 'sales_opportunity':
      return 'trending-up-outline';
    case 'missed_customer':
      return 'call-outline';
    case 'priority_customer':
      return 'star-outline';
    default:
      return 'sparkles-outline';
  }
}

export const RecommendationCard = memo(function RecommendationCard({
  item,
  onPress,
}: RecommendationCardProps) {
  const { colors } = useTheme();
  const tone = item.priority === 'high' ? 'error' : item.priority === 'medium' ? 'warning' : 'muted';

  return (
    <RipplePressable
      onPress={() => onPress?.(item)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={iconForKind(item.kind) as keyof typeof Ionicons.glyphMap} size={20} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <View style={styles.labelRow}>
          <VspBadge label={VSP_AI_BRANDING.recommendedBy} tone="primary" />
          {item.priority === 'high' ? <VspBadge label="High" tone={tone} /> : null}
        </View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
          {item.subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </RipplePressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  labelRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  title: { ...typography.bodyMedium, fontWeight: '600' },
  subtitle: { ...typography.caption },
});
