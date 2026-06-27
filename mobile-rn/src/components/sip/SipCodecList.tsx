import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { SipCodecEntry } from '../../sip/types';

type Props = {
  codecs: SipCodecEntry[];
  onChange: (codecs: SipCodecEntry[]) => void;
  error?: string | null;
};

export function SipCodecList({ codecs, onChange, error }: Props) {
  const { colors } = useTheme();

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= codecs.length) return;
    const next = [...codecs];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };

  const toggle = (index: number) => {
    const next = codecs.map((codec, i) => (
      i === index ? { ...codec, enabled: !codec.enabled } : codec
    ));
    onChange(next);
  };

  return (
    <View style={styles.wrap}>
      {codecs.map((codec, index) => (
        <View
          key={codec.id}
          style={[styles.row, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
        >
          <View style={styles.orderControls}>
            <Pressable
              onPress={() => move(index, -1)}
              disabled={index === 0}
              hitSlop={6}
              accessibilityLabel={`Move ${codec.label} up`}
            >
              <Ionicons name="chevron-up" size={18} color={index === 0 ? colors.border : colors.textMuted} />
            </Pressable>
            <Text style={[styles.order, { color: colors.textMuted }]}>{index + 1}</Text>
            <Pressable
              onPress={() => move(index, 1)}
              disabled={index === codecs.length - 1}
              hitSlop={6}
              accessibilityLabel={`Move ${codec.label} down`}
            >
              <Ionicons
                name="chevron-down"
                size={18}
                color={index === codecs.length - 1 ? colors.border : colors.textMuted}
              />
            </Pressable>
          </View>
          <View style={styles.labelWrap}>
            <Text style={[styles.label, { color: colors.text }]}>{codec.label}</Text>
            {codec.licensed ? (
              <Text style={[styles.badge, { color: colors.warning }]}>Licensed</Text>
            ) : null}
          </View>
          <Switch
            value={codec.enabled}
            onValueChange={() => toggle(index)}
            trackColor={{ false: colors.border, true: colors.primarySoft }}
            thumbColor={codec.enabled ? colors.primary : colors.surface}
          />
        </View>
      ))}
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  orderControls: { alignItems: 'center', width: 28 },
  order: { ...typography.caption, fontWeight: '700' },
  labelWrap: { flex: 1, gap: 2 },
  label: { ...typography.body },
  badge: { ...typography.caption, fontWeight: '600' },
  error: { ...typography.caption },
});
