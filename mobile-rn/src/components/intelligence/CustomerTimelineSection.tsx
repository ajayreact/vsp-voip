import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VspPanel } from '../vsp';
import { VSP_AI_BRANDING } from '../../ai/vspAiBranding';
import type { CustomerTimeline } from '../../intelligence/types';
import { formatRelativeTime } from '../../utils/format';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type CustomerTimelineSectionProps = {
  timeline: CustomerTimeline | null;
};

function iconForKind(kind: CustomerTimeline['items'][number]['kind']) {
  switch (kind) {
    case 'call':
      return 'call-outline';
    case 'message':
      return 'chatbubble-outline';
    case 'voicemail':
      return 'recording-outline';
    case 'insight':
      return 'sparkles-outline';
    case 'follow_up':
      return 'alarm-outline';
    case 'recommendation':
      return 'arrow-forward-circle-outline';
    default:
      return 'ellipse-outline';
  }
}

export const CustomerTimelineSection = memo(function CustomerTimelineSection({
  timeline,
}: CustomerTimelineSectionProps) {
  const { colors } = useTheme();
  if (!timeline || timeline.items.length === 0) return null;

  return (
    <VspPanel>
      <View style={styles.header}>
        <Ionicons name="time-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>{VSP_AI_BRANDING.customerTimeline}</Text>
      </View>

      {timeline.recommendedNextAction ? (
        <View style={[styles.highlight, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.highlightLabel, { color: colors.primary }]}>Recommended next action</Text>
          <Text style={[styles.highlightBody, { color: colors.text }]}>{timeline.recommendedNextAction}</Text>
        </View>
      ) : null}

      {timeline.latestFollowUp ? (
        <View style={[styles.highlight, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
          <Text style={[styles.highlightLabel, { color: colors.textSecondary }]}>Latest follow-up</Text>
          <Text style={[styles.highlightBody, { color: colors.text }]}>{timeline.latestFollowUp}</Text>
        </View>
      ) : null}

      {timeline.items.map((item, index) => (
        <View
          key={item.id}
          style={[
            styles.itemRow,
            { borderColor: colors.border },
            index === timeline.items.length - 1 ? styles.itemRowLast : null,
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.backgroundAlt }]}>
            <Ionicons name={iconForKind(item.kind) as keyof typeof Ionicons.glyphMap} size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.itemSub, { color: colors.textMuted }]} numberOfLines={2}>
              {item.subtitle}
            </Text>
            <Text style={[styles.itemTime, { color: colors.textMuted }]}>{formatRelativeTime(item.timestamp)}</Text>
          </View>
        </View>
      ))}

      <Text style={[styles.poweredBy, { color: colors.textMuted }]}>{VSP_AI_BRANDING.poweredBy}</Text>
    </VspPanel>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  title: { ...typography.subtitle, fontWeight: '700' },
  highlight: { borderRadius: 10, padding: spacing.sm, marginBottom: spacing.sm, borderWidth: StyleSheet.hairlineWidth },
  highlightLabel: { ...typography.caption, fontWeight: '700', textTransform: 'uppercase' },
  highlightBody: { ...typography.bodySmall, marginTop: 4 },
  itemRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemRowLast: { borderBottomWidth: 0 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemTitle: { ...typography.bodyMedium, fontWeight: '600' },
  itemSub: { ...typography.caption, marginTop: 2 },
  itemTime: { ...typography.caption, marginTop: 4 },
  poweredBy: { ...typography.caption, marginTop: spacing.sm },
});
