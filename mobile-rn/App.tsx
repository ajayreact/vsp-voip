import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { queryClient } from './src/lib/queryClient';
import { MessagingSyncProvider } from './src/messaging/MessagingSyncProvider';
import { PushNotificationProvider } from './src/notifications';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { FontProvider } from './src/shared/theme/FontProvider';
import { useSettingsStore } from './src/store/settingsStore';
import { useColorScheme } from 'react-native';

export default function App() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const resolved =
    themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themeMode;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <FontProvider>
            <PushNotificationProvider>
              <MessagingSyncProvider>
                <SafeAreaProvider>
                  <StatusBar style={resolved === 'light' ? 'dark' : 'light'} />
                  <RootNavigator />
                </SafeAreaProvider>
              </MessagingSyncProvider>
            </PushNotificationProvider>
          </FontProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
