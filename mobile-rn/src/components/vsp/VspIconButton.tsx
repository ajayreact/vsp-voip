import { Ionicons } from '@expo/vector-icons';
import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../shared/theme';
import { spacing, tokens, typography } from '../../shared/theme';

type VspIconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'md' | 'lg';
  disabled?: boolean;
};

export function VspIconButton({
  icon,
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  disabled,
}: VspIconButtonProps) {
  const { colors } = useTheme();
  const dim = size === 'lg' ? tokens.iconButton + 8 : tokens.iconButton;
  const variantColors = {
    primary: { bg: colors.primary, fg: colors.white },
    secondary: { bg: colors.surfaceElevated, fg: colors.text },
    danger: { bg: colors.errorSoft, fg: colors.error },
    success: { bg: colors.successSoft, fg: colors.success },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.wrap,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View
        style={[
          styles.circle,
          {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            backgroundColor: variantColors.bg,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name={icon} size={size === 'lg' ? 28 : 22} color={variantColors.fg} />
      </View>
      <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

type VspActionBarProps = {
  children: ReactNode;
  style?: ViewStyle;
};

/** Horizontal call action strip — enterprise layout, not iPhone circle row */
export function VspActionBar({ children, style }: VspActionBarProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.actionBar, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 72,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    ...typography.caption,
    textAlign: 'center',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderRadius: tokens.radius.xl,
  },
});
