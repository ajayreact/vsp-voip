import React, { memo, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/theme';
import { formatVoicemailDuration } from '../../voicemail/voicemailDisplay';
import { spacing, typography } from '../../shared/theme';

type Props = {
  isActive: boolean;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';
  positionMillis: number;
  durationMillis: number;
  durationSeconds?: number | null;
  error?: string | null;
  onToggle: () => void;
  onSeek: (positionMillis: number) => void;
};

function VoicemailPlayerComponent({
  isActive,
  status,
  positionMillis,
  durationMillis,
  durationSeconds,
  error,
  onToggle,
  onSeek,
}: Props) {
  const { colors } = useTheme();
  const trackWidthRef = useRef(240);
  const totalMs = durationMillis || (durationSeconds ?? 0) * 1000 || 1;
  const progress = isActive ? Math.min(1, positionMillis / totalMs) : 0;
  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <Pressable
        onPress={onToggle}
        style={[styles.playBtn, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause voicemail' : 'Play voicemail'}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" />
        )}
      </Pressable>

      <View style={styles.trackWrap}>
        <Pressable
          onPress={(event) => {
            const width = trackWidthRef.current;
            if (!width) return;
            const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / width));
            onSeek(Math.round(ratio * totalMs));
          }}
          onLayout={(event) => {
            trackWidthRef.current = event.nativeEvent.layout.width;
          }}
          style={styles.trackPressable}
          accessibilityRole="adjustable"
          accessibilityLabel="Seek voicemail"
        >
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View style={[styles.fill, { backgroundColor: colors.voicemail, width: `${progress * 100}%` }]} />
          </View>
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={[styles.time, { color: colors.textMuted }]}>
            {formatVoicemailDuration(Math.round(positionMillis / 1000))}
          </Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>
            {formatVoicemailDuration(Math.round(totalMs / 1000))}
          </Text>
        </View>
        {error ? (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        ) : null}
      </View>
    </View>
  );
}

export const VoicemailPlayer = memo(VoicemailPlayerComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.lg,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackWrap: { flex: 1, gap: spacing.xs },
  trackPressable: { paddingVertical: spacing.sm },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: { ...typography.caption },
  error: { ...typography.caption, marginTop: spacing.xs },
});
