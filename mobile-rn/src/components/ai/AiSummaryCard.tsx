import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { VspBadge, VspPanel } from '../vsp';
import { Skeleton } from '../ui/SkeletonLoader';
import { useAiSummary, useGenerateAiSummary } from '../../hooks/useAiSummary';
import { formatAiSummaryForCopy } from '../../ai/aiSummaryService';
import { insightTitleForEntity, sanitizeAiUserMessage, VSP_AI_BRANDING } from '../../ai/vspAiBranding';
import type { AiSummaryEntityType } from '../../ai/types';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type AiSummaryCardProps = {
  entityType: AiSummaryEntityType;
  entityId: string;
};

function priorityTone(priority?: string): 'warning' | 'error' | 'muted' {
  const value = priority?.toLowerCase() || '';
  if (value === 'high') return 'error';
  if (value === 'medium') return 'warning';
  return 'muted';
}

export const AiSummaryCard = memo(function AiSummaryCard({ entityType, entityId }: AiSummaryCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(true);
  const { data, isLoading, isError, refetch, isFetching } = useAiSummary(entityType, entityId);
  const generate = useGenerateAiSummary(entityType, entityId);

  const status = data?.status || 'unknown';
  const summary = data?.summary;
  const result = summary?.result;

  const insightTitle = insightTitleForEntity(entityType);
  const copyText = useMemo(
    () => formatAiSummaryForCopy(result ?? null, entityType),
    [entityType, result],
  );

  const handleCopy = useCallback(async () => {
    if (!copyText) return;
    await Clipboard.setStringAsync(copyText);
  }, [copyText]);

  const handleShare = useCallback(async () => {
    if (!copyText) return;
    await Share.share({ message: copyText });
  }, [copyText]);

  const handleRefresh = useCallback(() => {
    if (status === 'not_generated' || status === 'failed' || status === 'unavailable') {
      generate.mutate();
      return;
    }
    void refetch();
  }, [generate, refetch, status]);

  const showSkeleton = isLoading && !data;
  const isProcessing = status === 'pending' || status === 'processing' || generate.isPending;
  const isUnavailable = status === 'unavailable';
  const isFailed = status === 'failed' || isError;
  const isEmpty = status === 'not_generated';

  return (
    <VspPanel>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>{insightTitle}</Text>
          <VspBadge label={VSP_AI_BRANDING.badgeLabel} tone="primary" />
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => setExpanded((v) => !v)} accessibilityLabel="Expand or collapse">
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
          <Pressable onPress={handleRefresh} disabled={isProcessing} accessibilityLabel={`Refresh ${insightTitle}`}>
            {isProcessing || isFetching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh" size={20} color={colors.primary} />
            )}
          </Pressable>
        </View>
      </View>

      {showSkeleton ? (
        <View style={styles.body}>
          <Skeleton height={14} width="90%" />
          <Skeleton height={14} width="70%" />
          <Skeleton height={14} width="80%" />
        </View>
      ) : null}

      {!showSkeleton && expanded ? (
        <View style={styles.body}>
          {isUnavailable ? (
            <Text style={[styles.muted, { color: colors.textMuted }]}>
              {VSP_AI_BRANDING.insightsUnavailable}
            </Text>
          ) : null}

          {isEmpty ? (
            <View style={styles.centerBlock}>
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                {VSP_AI_BRANDING.noInsightYet}
              </Text>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => generate.mutate()}
                disabled={generate.isPending}
              >
                <Text style={[styles.primaryBtnText, { color: colors.accentText }]}>
                  {VSP_AI_BRANDING.generateInsight}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {isProcessing ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.muted, { color: colors.textMuted }]}>{VSP_AI_BRANDING.generatingInsight}</Text>
            </View>
          ) : null}

          {isFailed ? (
            <View style={styles.centerBlock}>
              <Text style={[styles.error, { color: colors.error }]}>
                {sanitizeAiUserMessage(summary?.errorMessage || VSP_AI_BRANDING.insightFailed)}
              </Text>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => generate.mutate()}
              >
                <Text style={[styles.primaryBtnText, { color: colors.accentText }]}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {result && status === 'completed' ? (
            <>
              <Text style={[styles.summaryText, { color: colors.text }]}>
                {result.executiveSummary || result.conversationSummary || result.summary}
              </Text>
              {result.priority ? (
                <View style={styles.metaRow}>
                  <VspBadge label={`Priority: ${result.priority}`} tone={priorityTone(result.priority)} />
                  {result.sentiment ? <VspBadge label={result.sentiment} tone="muted" /> : null}
                </View>
              ) : null}
              {result.callbackRecommendation ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {VSP_AI_BRANDING.recommendedBy}
                  </Text>
                  <Text style={[styles.bullet, { color: colors.text }]}>{result.callbackRecommendation}</Text>
                </View>
              ) : null}
              {result.actionItems?.length ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Action Items</Text>
                  {result.actionItems.map((item) => (
                    <Text key={item} style={[styles.bullet, { color: colors.text }]}>
                      • {item}
                    </Text>
                  ))}
                </View>
              ) : null}
              {result.keyPoints?.length ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Key Points</Text>
                  {result.keyPoints.map((item) => (
                    <Text key={item} style={[styles.bullet, { color: colors.text }]}>
                      • {item}
                    </Text>
                  ))}
                </View>
              ) : null}
              {summary?.generatedAt ? (
                <Text style={[styles.timestamp, { color: colors.textMuted }]}>
                  Generated {new Date(summary.generatedAt).toLocaleString()}
                </Text>
              ) : null}
              <View style={styles.copyRow}>
                <Pressable onPress={() => void handleCopy()} style={styles.copyBtn}>
                  <Ionicons name="copy-outline" size={16} color={colors.primary} />
                  <Text style={[styles.copyLabel, { color: colors.primary }]}>{VSP_AI_BRANDING.copyInsight}</Text>
                </Pressable>
                <Pressable onPress={() => void handleShare()} style={styles.copyBtn}>
                  <Ionicons name="share-outline" size={16} color={colors.primary} />
                  <Text style={[styles.copyLabel, { color: colors.primary }]}>Share</Text>
                </Pressable>
              </View>
              <Text style={[styles.poweredBy, { color: colors.textMuted }]}>{VSP_AI_BRANDING.poweredBy}</Text>
            </>
          ) : null}
        </View>
      ) : null}
    </VspPanel>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { ...typography.subtitle, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { gap: spacing.sm },
  centerBlock: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  summaryText: { ...typography.body },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  section: { gap: 4 },
  sectionTitle: { ...typography.caption, fontWeight: '600', textTransform: 'uppercase' },
  bullet: { ...typography.bodySmall },
  timestamp: { ...typography.caption },
  muted: { ...typography.bodySmall },
  error: { ...typography.bodySmall, textAlign: 'center' },
  primaryBtn: {
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryBtnText: { ...typography.bodySmall, fontWeight: '600' },
  copyRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyLabel: { ...typography.caption, fontWeight: '600' },
  poweredBy: { ...typography.caption, marginTop: spacing.xs },
});
