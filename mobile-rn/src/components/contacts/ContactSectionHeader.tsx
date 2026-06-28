import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = {
  letter: string;
};

function ContactSectionHeaderComponent({ letter }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.backgroundAlt }]}>
      <Text style={[styles.label, { color: colors.textMuted }]} accessibilityRole="header">
        {letter}
      </Text>
    </View>
  );
}

export const ContactSectionHeader = memo(ContactSectionHeaderComponent);

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
