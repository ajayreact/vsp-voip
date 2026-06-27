import React from 'react';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: string;
};

export function Button({ label, onPress }: ButtonProps) {
  return React.createElement('Pressable', { onPress, accessibilityLabel: label }, label);
}
