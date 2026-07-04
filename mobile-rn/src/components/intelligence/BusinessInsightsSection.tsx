import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VspPanel } from '../vsp';
import { FadeInView } from '../ui/FadeInView';
import { VSP_AI_BRANDING } from '../../ai/vspAiBranding';
import type { BusinessInsights } from '../../intelligence/types';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type BusinessInsightsSectionProps = {
  insights: BusinessInsights | null;
};

function trendIcon(trend: 'up' | 'down' | 'flat') {
  if (trend === 'up') return 'trending-up-outline';
  if (trend === 'down') return 'trending-down-outline';
  return 'remove-outline';
}

type RowProps = {
  label: string;
  today: number;
  week: number;
  trend: 'up' | 'down' | 'flat';
};

const InsightRow = memo(function InsightRow({ label, today, week, trend }: RowProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rowSub, { color: colors.textMuted }]}>
          Today {today} · Week {week}
        </Text>
      </View>
      <Ionicons name={trendIcon(trend) as keyof typeof Ionicons.glyphMap} size={18} color={colors.primary} />
    </View>
  );
});

export const BusinessInsightsSection = memo(function BusinessInsightsSection({
  insights,
}: BusinessInsightsSectionProps) {
  const { colors } = useTheme();
  if (!insights) return null;

  const hasMetrics =
    insights.todaysActivity > 0 ||
    insights.weeklyActivity > 0 ||
    insights.callVolumeWeek > 0 ||
    insights.messageVolumeWeek > 0 ||
    insights.voicemailVolumeWeek > 0;

  if (!hasMetrics) return null;

  return (
    <FadeInView delay={80}>
      <VspPanel>
        <View style={styles.header}>
          <Ionicons name="analytics-outline" size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>{VSP_AI_BRANDING.businessInsights}</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.backgroundAlt }]}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{insights.todaysActivity}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Today's activity</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.backgroundAlt }]}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{insights.weeklyActivity}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>This week's activity</Text>
          </View>
        </View>

        <InsightRow
          label="Call volume"
          today={insights.callVolumeToday}
          week={insights.callVolumeWeek}
          trend={insights.trends.calls}
        />
        <InsightRow
          label="Message volume"
          today={insights.messageVolumeToday}
          week={insights.messageVolumeWeek}
          trend={insights.trends.messages}
        />
        <InsightRow
          label="Voicemail volume"
          today={insights.voicemailVolumeToday}
          week={insights.voicemailVolumeWeek}
          trend={insights.trends.voicemails}
        />

        {insights.averageResponseMinutes != null ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Avg. unread response age: {insights.averageResponseMinutes} min
          </Text>
        ) : null}
        {insights.followUpCompletionRate != null ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Follow-up completion: {insights.followUpCompletionRate}%
          </Text>
        ) : null}
      </VspPanel>
    </FadeInView>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  title: { ...typography.subtitle, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  summaryCard: { flex: 1, borderRadius: 12, padding: spacing.md },
  summaryValue: { ...typography.title, fontWeight: '700' },
  summaryLabel: { ...typography.caption, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rowLabel: { ...typography.bodyMedium, fontWeight: '600' },
  rowSub: { ...typography.caption, marginTop: 2 },
  meta: { ...typography.caption, marginTop: spacing.sm },
});
