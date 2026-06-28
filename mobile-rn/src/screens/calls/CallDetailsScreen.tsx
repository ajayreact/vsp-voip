import React, { useMemo } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, VspBadge, VspPanel } from '../../components';
import { RipplePressable } from '../../components/ui/RipplePressable';
import { placeOutboundCall, getFriendlyCallError } from '../../calling/callingController';
import { usePhoneConnection } from '../../hooks/usePhoneConnection';
import { useRecentCalls } from '../../hooks/useRecentCalls';
import { useTheme } from '../../shared/theme';
import { formatPhone, formatRelativeTime } from '../../utils/format';
import { spacing, tokens, typography } from '../../shared/theme';
import type { RecentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RecentStackParamList, 'CallDetails'>;

export function CallDetailsScreen({ route, navigation }: Props) {
  const { callId, call: paramCall } = route.params;
  const { colors } = useTheme();
  const { canPlaceCalls } = usePhoneConnection();
  const { data: calls = [] } = useRecentCalls();
  const tabNavigation = navigation.getParent()?.getParent();

  const call = useMemo(
    () => paramCall ?? calls.find((c) => c.id === callId) ?? null,
    [paramCall, calls, callId],
  );

  if (!call) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>Call details unavailable</Text>
        <Button label="Go back" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const number = call.direction === 'inbound' ? call.from : call.to;
  const displayName = formatPhone(number);

  async function handleCall() {
    if (!canPlaceCalls) {
      Alert.alert(
        'Unable to place call',
        'The phone is not connected. Please wait while we reconnect.',
      );
      return;
    }
    try {
      await placeOutboundCall(number);
    } catch (err) {
      Alert.alert('Unable to place call', getFriendlyCallError(err));
    }
  }

  function handleCopy() {
    void Share.share({ message: number });
  }

  function handleDelete() {
    Alert.alert('Delete call log', 'This removes the entry from your recent activity on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.avatarWrap}>
            <Avatar name={displayName} size={104} />
          </View>
          <Text style={[styles.name, { color: colors.text }]} accessibilityRole="header">
            {displayName}
          </Text>
          <Text style={[styles.number, { color: colors.textMuted }]}>{number}</Text>
          <VspBadge
            label={call.status}
            tone={call.status?.toLowerCase().includes('miss') ? 'warning' : 'primary'}
          />
        </View>

        <VspPanel>
          <DetailRow label="Date" value={formatRelativeTime(call.createdAt)} />
          <DetailRow label="Duration" value={call.durationLabel || `${call.durationSeconds ?? 0}s`} />
          <DetailRow label="Type" value={call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} />
          <DetailRow label="Status" value={call.status} />
        </VspPanel>

        <View style={styles.actionsGrid}>
          <ActionTile icon="call" label="Call" onPress={() => void handleCall()} disabled={!canPlaceCalls} primary />
          <ActionTile icon="chatbubble-ellipses" label="Message" onPress={() => {}} />
          <ActionTile icon="person-add" label="Add contact" onPress={() => {}} />
          <ActionTile icon="copy-outline" label="Copy" onPress={handleCopy} />
          <ActionTile icon="trash-outline" label="Delete" onPress={handleDelete} destructive />
        </View>

        {call.callType?.includes('voicemail') ? (
          <VspPanel>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Voicemail</Text>
            <Text style={{ color: colors.textMuted }}>Open voicemail tab to listen to recordings.</Text>
            <Button
              label="Open voicemail"
              variant="secondary"
              onPress={() => tabNavigation?.navigate('You', { screen: 'VoicemailList' })}
              style={{ marginTop: spacing.sm }}
            />
          </VspPanel>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
  disabled,
  primary,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const iconColor = destructive ? colors.error : primary ? colors.primary : colors.text;
  const bg = primary ? colors.primarySoft : colors.backgroundAlt;

  return (
    <RipplePressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionTile,
        { backgroundColor: bg, borderColor: colors.border, opacity: disabled ? 0.45 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Ionicons name={icon} size={24} color={iconColor} />
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </RipplePressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  heroCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    ...tokens.shadow.card,
  },
  avatarWrap: {
    marginBottom: spacing.xs,
    ...tokens.shadow.card,
    borderRadius: 999,
  },
  name: {
    ...typography.display,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  number: {
    ...typography.body,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  detailLabel: { ...typography.caption, flex: 1 },
  detailValue: { ...typography.bodyMedium, flex: 1, textAlign: 'right' },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionTile: {
    width: '48%',
    flexGrow: 1,
    minHeight: 88,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  actionLabel: {
    ...typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: { ...typography.subtitle, marginBottom: spacing.xs },
});
