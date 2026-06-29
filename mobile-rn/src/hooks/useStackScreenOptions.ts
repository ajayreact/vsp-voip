import { useMemo } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useReducedMotion } from './useReducedMotion';
import { useTheme } from '../shared/theme';
import {
  createStackScreenOptions,
  detailScreenOptions,
  modalScreenOptions,
} from '../navigation/screenOptions';

export function useStackScreenOptions(): {
  screenOptions: NativeStackNavigationOptions;
  detailOptions: NativeStackNavigationOptions;
  modalOptions: NativeStackNavigationOptions;
} {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();

  return useMemo(
    () => ({
      screenOptions: createStackScreenOptions(colors, { reduceMotion }),
      detailOptions: detailScreenOptions(reduceMotion),
      modalOptions: modalScreenOptions(reduceMotion),
    }),
    [colors, reduceMotion],
  );
}
