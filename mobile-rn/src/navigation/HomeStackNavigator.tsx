import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { CallDetailsScreen } from '../screens/calls/CallDetailsScreen';
import { NotificationsCenterScreen } from '../screens/notifications/NotificationsCenterScreen';
import { useTheme } from '../shared/theme';
import { createStackScreenOptions, DETAIL_SCREEN_OPTIONS } from './screenOptions';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  const { colors } = useTheme();
  const screenOptions = useMemo(() => createStackScreenOptions(colors), [colors]);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="HomeMain" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CallDetails" component={CallDetailsScreen} options={{ title: 'Call Details', ...DETAIL_SCREEN_OPTIONS }} />
      <Stack.Screen
        name="NotificationsCenter"
        component={NotificationsCenterScreen}
        options={{ title: 'Notifications', ...DETAIL_SCREEN_OPTIONS }}
      />
    </Stack.Navigator>
  );
}

/** @deprecated Use HomeStackNavigator */
export const DashboardStackNavigator = HomeStackNavigator;
