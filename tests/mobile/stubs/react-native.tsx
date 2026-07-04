import React from 'react';

export const Platform = {
  OS: 'ios' as const,
  select: (spec: { ios?: unknown; android?: unknown; default?: unknown }) =>
    spec.ios ?? spec.android ?? spec.default,
};

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T) => styles,
  hairlineWidth: 1,
};

export const View = 'View';
export const Text = 'Text';
export const TextInput = 'TextInput';
export const Pressable = 'Pressable';
export const ActivityIndicator = 'ActivityIndicator';
