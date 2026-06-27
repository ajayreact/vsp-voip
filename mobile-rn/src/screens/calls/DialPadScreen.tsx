import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VspDialPad } from '../../components';
import { placeOutboundCall, getFriendlyCallError } from '../../calling/callingController';
import { useCanPlaceCalls } from '../../calling/TelnyxCallingProvider';
import { useTheme } from '../../shared/theme';
import { formatPhone } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

export function DialPadScreen() {
  const { colors } = useTheme();
  const [digits, setDigits] = useState('');
  const [placing, setPlacing] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const canPlace = useCanPlaceCalls();

  function append(d: string) {
    setDigits((prev) => prev + d);
    setCallError(null);
  }

  function backspace() {
    setDigits((prev) => prev.slice(0, -1));
  }

  async function handlePlaceCall() {
    if (!canPlace || digits.length < 3) return;
    setPlacing(true);
    setCallError(null);
    try {
      await placeOutboundCall(digits);
      setDigits('');
    } catch (error) {
      setCallError(getFriendlyCallError(error));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.displayArea}>
        {digits ? (
          <View style={styles.displayRow}>
            <Text style={[styles.number, { color: colors.text }]} numberOfLines={1}>
              {formatPhone(digits)}
            </Text>
            <Pressable
              onPress={backspace}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Delete digit"
              style={styles.deleteBtn}
            >
              <Ionicons name="backspace-outline" size={28} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.displayPlaceholder} />
        )}
      </View>

      <VspDialPad onDigit={append} variant="iphone" />

      {callError ? (
        <Text style={[styles.callError, { color: colors.error }]} accessibilityLiveRegion="polite">
          {callError}
        </Text>
      ) : null}

      <View style={styles.callWrap}>
        <Pressable
          onPress={handlePlaceCall}
          disabled={!canPlace || digits.length < 3 || placing}
          style={({ pressed }) => [
            styles.callButton,
            pressed && styles.callButtonPressed,
            (!canPlace || digits.length < 3) && styles.callButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Place call"
        >
          {placing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="call" size={32} color="#fff" />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  displayArea: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  displayPlaceholder: {
    height: 40,
  },
  number: {
    ...typography.mono,
    fontSize: 36,
    fontWeight: '300',
    flexShrink: 1,
    textAlign: 'center',
  },
  deleteBtn: {
    padding: spacing.xs,
  },
  callError: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  callWrap: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  callButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonPressed: {
    opacity: 0.85,
  },
  callButtonDisabled: {
    opacity: 0.45,
  },
});
