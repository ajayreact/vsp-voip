import React, { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RipplePressable } from '../ui/RipplePressable';
import { useTheme } from '../../shared/theme';
import { formatPhone } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

type Suggestion = {
  id: string;
  label: string;
  sublabel?: string;
  value: string;
};

type Props = {
  suggestions: Suggestion[];
  onSelect: (value: string) => void;
  title?: string;
};

export const DialPadSuggestions = memo(function DialPadSuggestions({
  suggestions,
  onSelect,
  title = 'Suggestions',
}: Props) {
  const { colors } = useTheme();
  if (!suggestions.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {suggestions.map((item) => (
          <RipplePressable
            key={item.id}
            onPress={() => onSelect(item.value)}
            style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={`Dial ${item.label}`}
          >
            <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
              {item.label}
            </Text>
            {item.sublabel ? (
              <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
                {item.sublabel}
              </Text>
            ) : null}
          </RipplePressable>
        ))}
      </ScrollView>
    </View>
  );
});

export function buildContactSuggestions(
  contacts: { id: string; name: string; extensionNumber: string; assignedDidNumber?: string | null }[],
  digits: string,
) {
  return contacts.map((contact) => ({
    id: contact.id,
    label: contact.name,
    sublabel: contact.assignedDidNumber
      ? formatPhone(contact.assignedDidNumber)
      : `Ext ${contact.extensionNumber}`,
    value: contact.assignedDidNumber || contact.extensionNumber,
  }));
}

export function buildRecentSuggestions(numbers: string[]) {
  return numbers.map((number, index) => ({
    id: `recent-${index}-${number}`,
    label: formatPhone(number),
    value: number,
  }));
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chip: {
    minWidth: 120,
    maxWidth: 180,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  label: {
    ...typography.bodyMedium,
  },
  sub: {
    ...typography.caption,
  },
});
