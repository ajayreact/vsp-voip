import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  NetworkStatusBanner,
  OfflineScreen,
  SessionExpiredScreen,
  SplashScreenView,
  hideSplashScreen,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { useSyncAppOnline } from '../hooks/useSyncAppOnline';
import { useAppStore } from '../store/appStore';
import { useCallingStore } from '../store/callingStore';
import { useSettingsStore } from '../store/settingsStore';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { CallOverlay } from '../calling/CallOverlay';
import { TelnyxCallingProvider } from '../calling/TelnyxCallingProvider';
import { ThemeContext, resolveThemeColors } from '../shared/theme';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
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
  const hasLiveCall = useCallingStore((s) => Boolean(s.activeCall || s.incomingCall));
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const [showSplash, setShowSplash] = useState(true);

  const resolvedTheme = 'light' as const;
  const colors = resolveThemeColors(resolvedTheme);

  const themeContextValue = useMemo(
    () => ({ mode: 'light' as const, resolved: resolvedTheme, colors }),
    [colors],
  );

  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    }),
    [colors],
  );

  useSyncAppOnline();

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!isBootstrapping && settingsHydrated) {
      const timer = setTimeout(async () => {
        setShowSplash(false);
        await hideSplashScreen();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isBootstrapping, settingsHydrated]);

  const handleSessionSignIn = useCallback(async () => {
    clearError();
    await logout();
  }, [clearError, logout]);

  const handleOfflineRetry = useCallback(() => {
    void NetInfo.fetch().then((s) => setOnline(Boolean(s.isConnected)));
  }, [setOnline]);

  if (showSplash || isBootstrapping || !settingsHydrated) {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        <SplashScreenView />
      </ThemeContext.Provider>
    );
  }

  const showOfflineGate = !isOnline && !isAuthenticated && !hasLiveCall;

  if (showOfflineGate) {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        <OfflineScreen onRetry={handleOfflineRetry} />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <TelnyxCallingProvider>
        <View style={styles.root}>
          <NetworkStatusBanner />
          <NavigationContainer ref={navigationRef} theme={navTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false, freezeOnBlur: true }}>
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
        </View>
      </TelnyxCallingProvider>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
