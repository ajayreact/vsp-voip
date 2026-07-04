import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import { SipFieldRow } from './SipFieldRow';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  tooltip?: string;
  error?: string | null;
  placeholder?: string;
  onTooltipPress?: () => void;
};

export function SipPasswordField({
  label,
  value,
  onChangeText,
  tooltip,
  error,
  placeholder,
  onTooltipPress,
}: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <SipFieldRow label={label} tooltip={tooltip} onTooltipPress={onTooltipPress} error={error}>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.surface, borderColor: error ? colors.error : colors.border },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: colors.text }]}
        />
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} accessibilityLabel={visible ? 'Hide password' : 'Show password'}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    </SipFieldRow>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    flex: 1,
    paddingVertical: spacing.sm,
  },
});
