export const colors = {
  backgroundAlt: '#f5f5f5',
  border: '#dddddd',
  textMuted: '#888888',
  text: '#111111',
  textSecondary: '#444444',
  surface: '#ffffff',
  primary: '#4f46e5',
  primarySoft: '#eef2ff',
  accentText: '#ffffff',
  white: '#ffffff',
  error: '#dc2626',
  errorSoft: '#fef2f2',
  warning: '#f59e0b',
  warningSoft: '#fffbeb',
  success: '#16a34a',
  successSoft: '#f0fdf4',
  voicemail: '#7c3aed',
};

export function useTheme() {
  return { colors, isDark: false };
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const typography = {
  body: { fontSize: 16 },
  caption: { fontSize: 12 },
  subtitle: { fontSize: 18 },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const },
};

export const tokens = {
  radius: { pill: 999, md: 8, sm: 4 },
  shadow: { card: {} },
  touchTarget: 44,
};

export const ThemeContext = null;
export function resolveThemeColors() {
  return colors;
}
