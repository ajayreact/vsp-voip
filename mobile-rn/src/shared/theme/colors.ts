/**
 * VSP Phone design tokens — aligned with web portal (globals.css, hero-banner, panel-card).
 * @see web/src/app/globals.css
 */
export const darkColors = {
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  primarySoft: '#312e81',
  accentText: '#a5b4fc',
  heroStart: '#4f46e5',
  heroMid: '#6366f1',
  heroEnd: '#7c3aed',
  background: '#0f172a',
  backgroundAlt: '#1e293b',
  surface: '#1e293b',
  surfaceElevated: '#334155',
  border: '#475569',
  borderSubtle: '#334155',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  error: '#f87171',
  errorSoft: '#450a0a',
  success: '#34d399',
  successSoft: '#064e3b',
  warning: '#fbbf24',
  warningSoft: '#451a03',
  white: '#ffffff',
  black: '#000000',
  tabInactive: '#64748b',
  online: '#34d399',
  offline: '#64748b',
  inbound: '#818cf8',
  outbound: '#6366f1',
  voicemail: '#c084fc',
} as const;

export const lightColors = {
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  primarySoft: '#eef2ff',
  accentText: '#4338ca',
  heroStart: '#4f46e5',
  heroMid: '#6366f1',
  heroEnd: '#7c3aed',
  background: '#f4f6f8',
  backgroundAlt: '#f1f5f9',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  border: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  text: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  error: '#dc2626',
  errorSoft: '#fef2f2',
  success: '#059669',
  successSoft: '#ecfdf5',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  white: '#ffffff',
  black: '#000000',
  tabInactive: '#94a3b8',
  online: '#059669',
  offline: '#94a3b8',
  inbound: '#4f46e5',
  outbound: '#6366f1',
  voicemail: '#7c3aed',
} as const;

export type ThemeColors = typeof darkColors | typeof lightColors;

export const colors = darkColors;
export type ColorName = keyof ThemeColors;
