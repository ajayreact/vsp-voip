import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';

type BiometricOptInModalProps = {
  visible: boolean;
  biometricLabel: string;
  onEnable: () => void;
  onDecline: () => void;
};

export function BiometricOptInModal({
  visible,
  biometricLabel,
  onEnable,
  onDecline,
}: BiometricOptInModalProps) {
  const { colors } = useTheme();
  const iconName = biometricLabel.includes('Face') ? 'scan-outline' : 'finger-print-outline';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name={iconName} size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Enable {biometricLabel}?</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>
            Sign in faster next time. You can still use your password if {biometricLabel} fails.
          </Text>
          <Button label={`Enable ${biometricLabel}`} onPress={() => void onEnable()} style={styles.enableBtn} />
          <Button label="Not now" variant="ghost" onPress={() => void onDecline()} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  enableBtn: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
});
