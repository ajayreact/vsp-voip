import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  BiometricOptInModal,
  BiometricUnlockScreen,
  ConnectionStatus,
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
import { AuthenticatedSyncProviders } from '../providers/AuthenticatedSyncProviders';
import { FONT_SIZE_MULTIPLIERS } from '../shared/theme/typography';
import { ThemeContext, resolveThemeColors, type ThemeMode } from '../shared/theme';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const {
    isAuthenticated,
    isBootstrapping,
    sessionExpired,
    awaitingBiometric,
    pendingBiometricOptIn,
    biometricLabel,
    error,
    bootstrap,
    logout,
    clearError,
    unlockWithBiometric,
    skipBiometricUnlock,
    enableBiometricLogin,
    declineBiometricLogin,
  } = useAuth();
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);
  const hasLiveCall = useCallingStore((s) => Boolean(s.activeCall || s.incomingCall));
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const fontSizePref = useSettingsStore((s) => s.clientPrefs.fontSize);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const [showSplash, setShowSplash] = useState(true);

  const resolvedTheme: 'light' | 'dark' =
    themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themeMode;
  const colors = resolveThemeColors(resolvedTheme);

  const fontScale = FONT_SIZE_MULTIPLIERS[fontSizePref];

  const themeContextValue = useMemo(
    () => ({ mode: themeMode as ThemeMode, resolved: resolvedTheme, colors, fontScale }),
    [colors, fontScale, resolvedTheme, themeMode],
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
      setShowSplash(false);
      void hideSplashScreen();
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

  const showOfflineGate = !isOnline && !isAuthenticated && !hasLiveCall && !awaitingBiometric;

  if (showOfflineGate) {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        <OfflineScreen onRetry={handleOfflineRetry} />
      </ThemeContext.Provider>
    );
  }

  if (awaitingBiometric) {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        <BiometricUnlockScreen
          biometricLabel={biometricLabel}
          error={error}
          onUnlock={unlockWithBiometric}
          onUsePassword={skipBiometricUnlock}
        />
      </ThemeContext.Provider>
    );
  }

  const mainContent = (
    <View style={styles.root}>
      <ConnectionStatus visible={isAuthenticated && !sessionExpired} />
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
      <BiometricOptInModal
        visible={pendingBiometricOptIn}
        biometricLabel={biometricLabel}
        onEnable={enableBiometricLogin}
        onDecline={declineBiometricLogin}
      />
    </View>
  );

  return (
    <ThemeContext.Provider value={themeContextValue}>
      {isAuthenticated && !sessionExpired ? (
        <TelnyxCallingProvider>
          <AuthenticatedSyncProviders>{mainContent}</AuthenticatedSyncProviders>
        </TelnyxCallingProvider>
      ) : (
        mainContent
      )}
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
