import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { VspBadge, VspPanel } from '../vsp';
import { Skeleton } from '../ui/SkeletonLoader';
import { useAiTranscript, useGenerateAiTranscript } from '../../hooks/useAiTranscript';
import { filterTranscriptText } from '../../ai/transcriptService';
import { sanitizeAiUserMessage, VSP_AI_BRANDING } from '../../ai/vspAiBranding';
import type { AiTranscriptEntityType } from '../../ai/transcriptTypes';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type TranscriptCardProps = {
  entityType: AiTranscriptEntityType;
  entityId: string;
};

export function TranscriptCard({ entityType, entityId }: TranscriptCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch, isFetching } = useAiTranscript(entityType, entityId);
  const generate = useGenerateAiTranscript(entityType, entityId);

  const status = data?.status || 'unknown';
  const record = data?.transcript;
  const text = record?.transcript || '';

  const visibleText = useMemo(() => {
    if (!search.trim() || !text) return text;
    return filterTranscriptText(text, search) ? text : '';
  }, [search, text]);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
  }, [text]);

  const handleShare = useCallback(async () => {
    if (!text) return;
    await Share.share({ message: text });
  }, [text]);

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
          <Ionicons name="document-text" size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Transcript</Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => setExpanded((v) => !v)} accessibilityLabel="Expand or collapse transcript">
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={handleRefresh} disabled={isProcessing} accessibilityLabel="Refresh transcript">
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
          <Skeleton height={14} width="92%" />
          <Skeleton height={14} width="78%" />
        </View>
      ) : null}

      {!showSkeleton && expanded ? (
        <View style={styles.body}>
          {isUnavailable ? (
            <Text style={[styles.muted, { color: colors.textMuted }]}>
              {VSP_AI_BRANDING.transcriptUnavailable}
            </Text>
          ) : null}

          {isEmpty ? (
            <View style={styles.centerBlock}>
              <Text style={[styles.muted, { color: colors.textMuted }]}>{VSP_AI_BRANDING.noTranscriptYet}</Text>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => generate.mutate()}
                disabled={generate.isPending}
              >
                <Text style={[styles.primaryBtnText, { color: colors.accentText }]}>
                  {VSP_AI_BRANDING.generateTranscript}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {isProcessing ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.muted, { color: colors.textMuted }]}>{VSP_AI_BRANDING.transcribing}</Text>
            </View>
          ) : null}

          {isFailed ? (
            <View style={styles.centerBlock}>
              <Text style={[styles.error, { color: colors.error }]}>
                {sanitizeAiUserMessage(record?.errorMessage || VSP_AI_BRANDING.transcriptionFailed)}
              </Text>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => generate.mutate()}
              >
                <Text style={[styles.primaryBtnText, { color: colors.accentText }]}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {text && status === 'completed' ? (
            <>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search transcript"
                placeholderTextColor={colors.textMuted}
                style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              />
              <Text style={[styles.transcriptText, { color: colors.text }]}>
                {visibleText || (search.trim() ? 'No matches in transcript.' : text)}
              </Text>
              <View style={styles.metaRow}>
                {record?.detectedLanguage ? <VspBadge label={record.detectedLanguage} tone="muted" /> : null}
                {record?.confidence != null ? (
                  <VspBadge label={`${Math.round(record.confidence * 100)}% confidence`} tone="primary" />
                ) : null}
              </View>
              {record?.createdAt ? (
                <Text style={[styles.timestamp, { color: colors.textMuted }]}>
                  Generated {new Date(record.updatedAt || record.createdAt).toLocaleString()}
                </Text>
              ) : null}
              <View style={styles.copyRow}>
                <Pressable onPress={() => void handleCopy()} style={styles.copyBtn}>
                  <Ionicons name="copy-outline" size={16} color={colors.primary} />
                  <Text style={[styles.copyLabel, { color: colors.primary }]}>Copy</Text>
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
}

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
  transcriptText: { ...typography.body, lineHeight: 22 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
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
  search: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...typography.bodySmall,
  },
});
