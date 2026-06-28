import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { RipplePressable } from './ui/RipplePressable';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const variantStyle = {
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border },
    ghost: { backgroundColor: 'transparent' },
  }[variant];

  return (
    <RipplePressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyle,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
      ) : (
        <Text
          style={[
            styles.label,
            { color: variant === 'primary' ? colors.white : colors.text },
          ]}
        >
          {label}
        </Text>
      )}
    </RipplePressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.button,
  },
});
