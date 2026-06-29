import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { queryClient } from './src/lib/queryClient';
import { useProductionErrorHandlers } from './src/lib/productionErrorHandlers';
import { PushNotificationProvider } from './src/notifications';
import { NotificationsHydrationProvider } from './src/notifications/NotificationsHydrationProvider';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { FontProvider } from './src/shared/theme/FontProvider';
import { ReduceMotionProvider } from './src/providers/ReduceMotionProvider';
import { useSettingsStore } from './src/store/settingsStore';
import { useColorScheme } from 'react-native';

export default function App() {
  useProductionErrorHandlers();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const resolved =
    themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themeMode;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ReduceMotionProvider>
            <FontProvider>
            <PushNotificationProvider>
              <NotificationsHydrationProvider>
                <SafeAreaProvider>
                  <StatusBar style={resolved === 'light' ? 'dark' : 'light'} />
                  <RootNavigator />
                </SafeAreaProvider>
              </NotificationsHydrationProvider>
            </PushNotificationProvider>
            </FontProvider>
          </ReduceMotionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
