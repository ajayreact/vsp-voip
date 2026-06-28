import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = {
  letters: string[];
  onJump: (letter: string) => void;
};

function AlphabetIndexComponent({ letters, onJump }: Props) {
  const { colors } = useTheme();
  if (letters.length <= 1) return null;

  return (
    <View style={styles.rail} pointerEvents="box-none">
      {letters.map((letter) => (
        <Pressable
          key={letter}
          onPress={() => onJump(letter)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`Jump to ${letter}`}
          style={styles.item}
        >
          <Text style={[styles.text, { color: colors.primary }]}>{letter}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const AlphabetIndex = memo(AlphabetIndexComponent);

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: 1,
  },
  item: {
    minWidth: 20,
    minHeight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
});
