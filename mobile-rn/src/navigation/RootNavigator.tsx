import React, { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OfflineScreen, SessionExpiredScreen, SplashScreenView, hideSplashScreen } from '../components';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../store/appStore';
import { useSettingsStore } from '../store/settingsStore';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { CallOverlay } from '../calling/CallOverlay';
import { TelnyxCallingProvider } from '../calling/TelnyxCallingProvider';
import { ThemeContext, resolveThemeColors } from '../shared/theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const systemScheme = useColorScheme();
  const {
    isAuthenticated,
    isBootstrapping,
    sessionExpired,
    bootstrap,
    logout,
    clearError,
  } = useAuth();
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const [showSplash, setShowSplash] = useState(true);

  const resolvedTheme =
    themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themeMode;
  const colors = resolveThemeColors(resolvedTheme);

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    });
    return unsubscribe;
  }, [setOnline]);

  useEffect(() => {
    if (!isBootstrapping && settingsHydrated) {
      const timer = setTimeout(async () => {
        setShowSplash(false);
        await hideSplashScreen();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isBootstrapping, settingsHydrated]);

  const handleSessionSignIn = useCallback(async () => {
    clearError();
    await logout();
  }, [clearError, logout]);

  const navTheme = resolvedTheme === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
        },
      };

  if (showSplash || isBootstrapping || !settingsHydrated) {
    return (
      <ThemeContext.Provider value={{ mode: themeMode, resolved: resolvedTheme, colors }}>
        <SplashScreenView />
      </ThemeContext.Provider>
    );
  }

  if (!isOnline) {
    return (
      <ThemeContext.Provider value={{ mode: themeMode, resolved: resolvedTheme, colors }}>
        <OfflineScreen onRetry={() => NetInfo.fetch().then((s) => setOnline(Boolean(s.isConnected)))} />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ mode: themeMode, resolved: resolvedTheme, colors }}>
      <TelnyxCallingProvider>
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {sessionExpired ? (
              <Stack.Screen name="SessionExpired">
                {() => <SessionExpiredScreen onSignIn={handleSessionSignIn} />}
              </Stack.Screen>
            ) : isAuthenticated ? (
              <Stack.Screen name="Main" component={MainTabNavigator} />
            ) : (
              <Stack.Screen name="Auth" component={AuthNavigator} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
        {isAuthenticated && !sessionExpired ? <CallOverlay /> : null}
      </TelnyxCallingProvider>
    </ThemeContext.Provider>
  );
}
