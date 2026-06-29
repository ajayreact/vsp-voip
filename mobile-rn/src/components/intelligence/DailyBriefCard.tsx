import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VspBadge, VspPanel } from '../vsp';
import { FadeInView } from '../ui/FadeInView';
import { Skeleton } from '../ui/SkeletonLoader';
import { configureLayoutAnimation } from '../../lib/animations';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { VSP_AI_BRANDING } from '../../ai/vspAiBranding';
import type { DailyBrief } from '../../intelligence/types';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type DailyBriefCardProps = {
  brief: DailyBrief | null;
  loading?: boolean;
};

type MetricProps = { label: string; value: number; tone?: 'default' | 'alert' };

const Metric = memo(function Metric({ label, value, tone = 'default' }: MetricProps) {
  const { colors } = useTheme();
  const alert = tone === 'alert' && value > 0;
  return (
    <View style={[styles.metric, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
      <Text style={[styles.metricValue, { color: alert ? colors.error : colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
});

export const DailyBriefCard = memo(function DailyBriefCard({ brief, loading }: DailyBriefCardProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    configureLayoutAnimation(reduceMotion);
    setExpanded((v) => !v);
  };

  if (loading && !brief) {
    return (
      <VspPanel>
        <Skeleton height={18} width="55%" />
        <View style={styles.metricGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={64} style={{ flex: 1 }} />
          ))}
        </View>
      </VspPanel>
    );
  }

  if (!brief) return null;
  const m = brief.metrics;

  return (
    <FadeInView delay={40}>
      <VspPanel>
        <Pressable
          onPress={toggle}
          style={styles.header}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${VSP_AI_BRANDING.dailyBrief}, ${expanded ? 'expanded' : 'collapsed'}`}
        >
          <View style={styles.titleRow}>
            <Ionicons name="newspaper-outline" size={18} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>{VSP_AI_BRANDING.dailyBrief}</Text>
            <VspBadge label={VSP_AI_BRANDING.badgeLabel} tone="primary" />
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
        </Pressable>

        {expanded ? (
          <>
            <View style={styles.metricGrid}>
              <Metric label="Today's Calls" value={m.todaysCalls} />
              <Metric label="Missed Calls" value={m.missedCalls} tone="alert" />
              <Metric label="Unread Messages" value={m.unreadMessages} tone="alert" />
              <Metric label="Voicemails" value={m.voicemails} tone="alert" />
              <Metric label="Urgent Conversations" value={m.urgentConversations} />
              <Metric label="Pending Follow-ups" value={m.pendingFollowUps} />
              <Metric label="High Priority" value={m.highPriorityCustomers} />
              <Metric label="Callbacks" value={m.upcomingCallbacks} />
            </View>

            {brief.recentInsights.length > 0 ? (
              <View style={styles.insights}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Recent VSP Insights</Text>
                {brief.recentInsights.map((insight) => (
                  <View key={insight.id} style={[styles.insightRow, { borderColor: colors.border }]}>
                    <Text style={[styles.insightTitle, { color: colors.text }]}>{insight.title}</Text>
                    <Text style={[styles.insightBody, { color: colors.textMuted }]} numberOfLines={2}>
                      {insight.summary}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={[styles.poweredBy, { color: colors.textMuted }]}>{VSP_AI_BRANDING.poweredBy}</Text>
          </>
        ) : null}
      </VspPanel>
    </FadeInView>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  title: { ...typography.subtitle, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
    minHeight: 72,
    justifyContent: 'center',
  },
  metricValue: { ...typography.title, fontWeight: '700' },
  metricLabel: { ...typography.caption, marginTop: 2 },
  insights: { marginTop: spacing.md, gap: spacing.sm },
  sectionTitle: { ...typography.caption, fontWeight: '700', textTransform: 'uppercase' },
  insightRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  insightTitle: { ...typography.bodyMedium, fontWeight: '600' },
  insightBody: { ...typography.bodySmall, marginTop: 2 },
  poweredBy: { ...typography.caption, marginTop: spacing.sm },
});
