import { createContext, useContext } from 'react';
import type { ThemeColors } from './colors';
import { darkColors, lightColors } from './colors';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeContextValue = {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  colors: ThemeColors;
  fontScale: number;
};

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  resolved: 'dark',
  colors: darkColors,
  fontScale: 1,
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function resolveThemeColors(resolved: 'light' | 'dark'): ThemeColors {
  return resolved === 'light' ? lightColors : darkColors;
}