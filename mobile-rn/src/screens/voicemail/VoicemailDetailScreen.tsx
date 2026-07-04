import React, { useCallback, useEffect } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, FriendlyError, VspBadge, VspPanel } from '../../components';
import { AiSummaryCard } from '../../components/ai/AiSummaryCard';
import { TranscriptCard } from '../../components/ai/TranscriptCard';
import { VoicemailPlayer } from '../../components/voicemail/VoicemailPlayer';
import { SkeletonVoicemailDetail } from '../../components/ui/SkeletonLoader';
import { buildUnifiedContactPhoneMap } from '../../contacts/unifiedContactIndex';
import { useContactsDirectory } from '../../hooks/useContactsDirectory';
import { useHiddenVoicemailIds } from '../../hooks/useHiddenVoicemailIds';
import {
  useHideVoicemailLocal,
  useMarkVoicemailRead,
  useMarkVoicemailUnreadLocal,
  useVoicemailById,
  useVoicemails,
} from '../../hooks/useVoicemails';
import { useVoicemailPlayback } from '../../hooks/useVoicemailPlayback';
import type { CallsStackParamList, YouStackParamList } from '../../navigation/types';
import { enrichVoicemail, formatVoicemailDuration, voicemailDisplayName } from '../../voicemail/voicemailDisplay';
import { voicemailStreamPath, voicemailPlaybackManager } from '../../voicemail';
import { env } from '../../shared/config/env';
import { useTheme } from '../../shared/theme';
import { formatPhone, formatRelativeTime } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<CallsStackParamList & YouStackParamList, 'VoicemailDetail'>;

export function VoicemailDetailScreen({ route, navigation }: Props) {
  const { voicemailId } = route.params;
  const { colors } = useTheme();
  const vmRaw = useVoicemailById(voicemailId);
  const { isLoading, isError } = useVoicemails();
  const { allContacts } = useContactsDirectory();
  const markRead = useMarkVoicemailRead();
  const markUnread = useMarkVoicemailUnreadLocal();
  const hideLocal = useHideVoicemailLocal();
  const { hideVoicemail } = useHiddenVoicemailIds();
  const playback = useVoicemailPlayback();

  const vm = vmRaw
    ? enrichVoicemail(vmRaw, buildUnifiedContactPhoneMap(allContacts))
    : null;

  useEffect(() => {
    if (vmRaw && !vmRaw.isRead) {
      markRead.mutate(voicemailId);
    }
  }, [markRead, vmRaw, voicemailId]);

  useEffect(() => () => {
    void voicemailPlaybackManager.stop();
  }, []);

  const isActive = playback.voicemailId === voicemailId;

  const handleShare = useCallback(async () => {
    if (!vm) return;
    const streamUrl = `${env.apiBaseUrl}${voicemailStreamPath(voicemailId)}`;
    await Share.share({
      message: `Voicemail from ${voicemailDisplayName(vm)} (${formatVoicemailDuration(vm.durationSeconds)})\n${streamUrl}`,
      title: 'Share voicemail',
    });
  }, [vm, voicemailId]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Remove voicemail',
      'Hide this voicemail on this device? The recording remains on the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void playback.stop();
            hideVoicemail(voicemailId);
            hideLocal.mutate(voicemailId);
            navigation.goBack();
          },
        },
      ],
    );
  }, [hideLocal, hideVoicemail, navigation, playback, voicemailId]);

  if (isLoading) return <SkeletonVoicemailDetail />;
  if (isError || !vm) {
    return (
      <FriendlyError
        message="Voicemail not found"
        onRetry={() => navigation.goBack()}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <VspPanel>
        <View style={styles.meta}>
          <Text style={[styles.from, { color: colors.text }]}>{voicemailDisplayName(vm)}</Text>
          <VspBadge label={vm.isRead ? 'Read' : 'New'} tone={vm.isRead ? 'muted' : 'voicemail'} />
        </View>
        {vm.contactCompany ? (
          <Text style={[styles.sub, { color: colors.textMuted }]}>{vm.contactCompany}</Text>
        ) : null}
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {formatPhone(vm.from)} · {formatRelativeTime(vm.createdAt)}
        </Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Business line {vm.businessDidLabel}
        </Text>
        <Text style={[styles.duration, { color: colors.textSecondary }]}>
          Duration {formatVoicemailDuration(vm.durationSeconds)}
        </Text>
      </VspPanel>

      <VoicemailPlayer
        isActive={isActive}
        status={isActive ? playback.status : 'idle'}
        positionMillis={isActive ? playback.positionMillis : 0}
        durationMillis={isActive ? playback.durationMillis : (vm.durationSeconds ?? 0) * 1000}
        durationSeconds={vm.durationSeconds}
        error={isActive ? playback.error : null}
        onToggle={() => void playback.toggle(voicemailId)}
        onSeek={(ms) => void playback.seek(ms)}
      />

      <View style={styles.actions}>
        <Button
          label={vm.isRead ? 'Mark unread' : 'Mark read'}
          variant="secondary"
          onPress={() => {
            if (vm.isRead) markUnread.mutate(voicemailId);
            else markRead.mutate(voicemailId);
          }}
        />
        <Button label="Share" variant="secondary" onPress={() => void handleShare()} />
        <Button label="Remove" variant="secondary" onPress={handleDelete} />
      </View>

      <TranscriptCard entityType="voicemail" entityId={voicemailId} />
      <AiSummaryCard entityType="voicemail" entityId={voicemailId} />

      <VspPanel>
        <View style={styles.placeholderRow}>
          <Ionicons name="analytics-outline" size={20} color={colors.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.placeholderTitle, { color: colors.text }]}>Analytics</Text>
            <Text style={[styles.placeholderSub, { color: colors.textMuted }]}>Coming soon</Text>
          </View>
        </View>
      </VspPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  from: {
    ...typography.title,
    flex: 1,
  },
  sub: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  duration: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  placeholderTitle: { ...typography.bodyMedium },
  placeholderSub: { ...typography.caption, marginTop: 2 },
});
