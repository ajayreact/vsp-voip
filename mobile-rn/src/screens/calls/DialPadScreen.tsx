import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VspDialPad } from '../../components';
import {
  AnimatedDeleteButton,
  AnimatedDialCallButton,
  DialPadSuggestions,
  buildContactSuggestions,
  buildRecentSuggestions,
} from '../../components/calls';
import { ConnectionBadge } from '../../components/ui/ConnectionBadge';
import { FadeInView } from '../../components/ui/FadeInView';
import { placeOutboundCall, getFriendlyCallError } from '../../calling/callingController';
import {
  collectRecentDialNumbers,
  filterDialSuggestions,
} from '../../calling/callDisplay';
import { useCanPlaceCalls } from '../../calling/TelnyxCallingProvider';
import { useContacts } from '../../hooks/useContacts';
import { usePhoneConnection } from '../../hooks/usePhoneConnection';
import { useRecentCalls } from '../../hooks/useRecentCalls';
import { useTheme } from '../../shared/theme';
import { formatPhone } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

export function DialPadScreen() {
  const { colors } = useTheme();
  const [digits, setDigits] = useState('');
  const [placing, setPlacing] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const canPlace = useCanPlaceCalls();
  const { label: connectionLabel } = usePhoneConnection();
  const { data: contacts = [] } = useContacts();
  const { data: recentCalls = [] } = useRecentCalls();

  const append = useCallback((digit: string) => {
    setDigits((prev) => prev + digit);
    setCallError(null);
  }, []);

  const backspace = useCallback(() => {
    setDigits((prev) => prev.slice(0, -1));
  }, []);

  const handlePaste = useCallback(async () => {
    const pasted = await Clipboard.getStringAsync();
    const cleaned = pasted.replace(/[^\d+*#]/g, '');
    if (!cleaned) return;
    setDigits(cleaned);
    setCallError(null);
  }, []);

  const handlePlaceCall = useCallback(async () => {
    if (!canPlace || digits.length < 3) {
      if (!canPlace) {
        setCallError('Phone not connected. Wait for registration to finish.');
      }
      return;
    }
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
  }, [canPlace, digits]);

  const contactSuggestions = useMemo(() => {
    const filtered = filterDialSuggestions(contacts, digits);
    return buildContactSuggestions(filtered, digits);
  }, [contacts, digits]);

  const recentSuggestions = useMemo(() => {
    if (digits.trim()) return [];
    return buildRecentSuggestions(collectRecentDialNumbers(recentCalls));
  }, [digits, recentCalls]);

  const suggestions = digits.trim() ? contactSuggestions : recentSuggestions;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <FadeInView style={styles.inner}>
        <View style={styles.topBar}>
          <ConnectionBadge connected={canPlace} label={connectionLabel} />
        </View>

        <View style={styles.displayArea}>
          <Text
            style={[styles.number, { color: digits ? colors.text : colors.textMuted }]}
            numberOfLines={1}
            onLongPress={() => {
              void handlePaste();
            }}
            accessibilityRole="text"
            accessibilityLabel={digits ? formatPhone(digits) : 'Enter number. Long press to paste.'}
          >
            {digits ? formatPhone(digits) : 'Enter number'}
          </Text>
          <AnimatedDeleteButton visible={digits.length > 0} onPress={backspace} />
        </View>

        <DialPadSuggestions
          suggestions={suggestions}
          onSelect={(value) => {
            setDigits(value.replace(/[^\d+*#]/g, ''));
            setCallError(null);
          }}
          title={digits.trim() ? 'Contacts' : 'Recent'}
        />

        <VspDialPad onDigit={append} variant="default" />

        {callError ? (
          <Text style={[styles.callError, { color: colors.error }]} accessibilityLiveRegion="polite">
            {callError}
          </Text>
        ) : null}

        <View style={styles.callWrap}>
          <AnimatedDialCallButton
            onPress={handlePlaceCall}
            disabled={!canPlace || digits.length < 3}
            loading={placing}
          />
        </View>
      </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  displayArea: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  number: {
    ...typography.mono,
    fontSize: 34,
    fontWeight: '400',
    flexShrink: 1,
    textAlign: 'center',
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
});
