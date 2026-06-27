import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { VoicemailRecord } from '../../api/types';
import { Button, ErrorScreen, VspBadge, VspPanel, FriendlyError } from '../../components';
import { FadeInView } from '../../components/ui/FadeInView';
import { SkeletonVoicemailDetail } from '../../components/ui/SkeletonLoader';
import type { CallsStackParamList, YouStackParamList } from '../../navigation/types';
import { fetchVoicemails, markVoicemailRead } from '../../voicemail';
import { useTheme } from '../../shared/theme';
import { formatPhone, formatRelativeTime } from '../../utils/format';
import { getFriendlyErrorMessage } from '../../utils/friendlyError';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<CallsStackParamList & YouStackParamList, 'VoicemailDetail'>;

export function VoicemailDetailScreen({ route }: Props) {
  const { voicemailId } = route.params;
  const { colors } = useTheme();
  const [vm, setVm] = useState<VoicemailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchVoicemails();
      const found = list.find((v) => v.id === voicemailId) || null;
      setVm(found);
      if (found && !found.isRead) {
        const updated = await markVoicemailRead(voicemailId);
        setVm(updated);
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'voicemail'));
    } finally {
      setLoading(false);
    }
  }, [voicemailId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <SkeletonVoicemailDetail />;
  if (error || !vm) {
    return (
      <FriendlyError
        message={error || 'Voicemail not found'}
        onRetry={load}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <VspPanel>
        <View style={styles.meta}>
          <Text style={[styles.from, { color: colors.text }]}>{formatPhone(vm.from)}</Text>
          <VspBadge label={vm.isRead ? 'Read' : 'New'} tone={vm.isRead ? 'muted' : 'voicemail'} />
        </View>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          To {formatPhone(vm.to)} · {formatRelativeTime(vm.createdAt)}
        </Text>
        <Text style={[styles.duration, { color: colors.textSecondary }]}>
          Duration {vm.durationSeconds ?? 0}s
        </Text>
      </VspPanel>

      <View style={[styles.player, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Text style={[styles.playerLabel, { color: colors.textMuted }]}>Playback</Text>
        <Button label="Play recording" variant="primary" disabled={!vm.recordingUrl} onPress={() => {}} />
        {!vm.recordingUrl ? (
          <Text style={[styles.note, { color: colors.textMuted }]}>Recording URL unavailable</Text>
        ) : null}
      </View>
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
  player: {
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  playerLabel: {
    ...typography.label,
  },
  note: {
    ...typography.caption,
  },
});
