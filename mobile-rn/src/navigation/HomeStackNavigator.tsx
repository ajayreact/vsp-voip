import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { useStackScreenOptions } from '../hooks/useStackScreenOptions';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  const { screenOptions, detailOptions } = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="HomeMain" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="CallDetails"
        getComponent={() => require('../screens/calls/CallDetailsScreen').CallDetailsScreen}
        options={{ title: 'Call Details', ...detailOptions }}
      />
      <Stack.Screen
        name="NotificationsCenter"
        getComponent={() => require('../screens/notifications/NotificationsCenterScreen').NotificationsCenterScreen}
        options={{ title: 'Notifications', ...detailOptions }}
      />
    </Stack.Navigator>
  );
}

/** @deprecated Use HomeStackNavigator */
export const DashboardStackNavigator = HomeStackNavigator;
